#!/usr/bin/env tsx
/**
 * Read-only InverseAKITA trade-journal verification.
 *
 * This command performs SELECTs and static source inspection only. It never
 * reconciles, claims, dispatches, posts, or invokes an execution provider.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { getDb, type DbPool } from '../../server/_lib/db/postgres.js'

type Severity = 'healthy' | 'warn' | 'fail'

type OutcomeCounts = {
  executed: number
  rejected: number
  blocked: number
  failed: number
  incomplete: number
}

export type InverseAkitaTradeJournalHealthSnapshot = {
  schemaComplete: boolean
  outcomeCounts: OutcomeCounts
  pendingDecisions: number
  unknownDecisions: number
  incompleteAttribution: number
  openLifecycles: number
  reconciliationAgeMinutes: number | null
  lastSuccessfulDispatchAgeMinutes: number | null
  sendUnknownDeliveries: number
  terminalReplyBacklog: number
  terminalReplySendUnknown: number
  terminalReplyLastSuccessAgeMinutes: number | null
  latestAnalysisAgeMinutes: number | null
  latestAnalysisFailed: boolean
  latestAnalysisFallback: boolean
  analysisSamples: number
  analysisFallbacks: number
  wrongRoomDispatches: number
  duplicateWindows: number
  duplicateParents: number
  overlappingLegacyBriefs: number
  ownershipInversions: number
  rawTextLeakage: number
  nonAnalysisOnlyRows: number
  executionReachability: number
}

export type InverseAkitaTradeJournalHealthResult = {
  status: Severity
  exitCode: number
  strict: boolean
  sampleWindowHours: number
  baseline: 'available' | 'unavailable'
  baselineSampleSize: number | null
  checks: Array<{
    id: string
    severity: Severity
    detail: string
  }>
}

type VerificationOptions = {
  loadSnapshot: (windowHours: number) => Promise<InverseAkitaTradeJournalHealthSnapshot>
  inspectArchitecture: () => { executionReachability: number }
  env: Record<string, string | undefined>
  now: Date
  windowHours: number
  strict: boolean
}

type HealthQueryRow = {
  executed_count: string
  rejected_count: string
  blocked_count: string
  failed_count: string
  incomplete_count: string
  pending_decisions: string
  unknown_decisions: string
  incomplete_attribution: string
  open_lifecycles: string
  reconciliation_age_minutes: string | number | null
  last_dispatch_age_minutes: string | number | null
  latest_analysis_age_minutes: string | number | null
  latest_analysis_failed: boolean
  latest_analysis_fallback: boolean
  analysis_samples: string
  analysis_fallbacks: string
  wrong_room_dispatches: string
  duplicate_windows: string
  duplicate_parents: string
  overlapping_legacy_briefs: string
  raw_text_leakage: string
  non_analysis_only_rows: string
  send_unknown_deliveries: string
  terminal_reply_backlog: string
  terminal_reply_send_unknown: string
  terminal_reply_last_success_age_minutes: string | number | null
}

const EXPECTED_TABLES = [
  'alfaclub.inverse_opinion_source_messages',
  'alfaclub.inverse_opinion_trade_decisions',
  'alfaclub.inverse_position_lifecycles',
  'alfaclub.inverse_position_lifecycle_events',
  'alfaclub.inverse_opinion_trade_analyses',
  'alfaclub.inverse_opinion_trade_journal_dispatch',
  'alfaclub.inverse_opinion_trade_journal_deliveries',
  'alfaclub.inverse_opinion_reply_deliveries',
  'alfaclub.daily_brief_dispatch',
] as const

const JOURNAL_SOURCE_ROOTS = [
  'inverseAkitaTradeJournal.ts',
  'inverseAkitaTradeJournalSender.ts',
  'inverseAkitaTradeJournalEvidence.ts',
  'inverseAkitaTradeJournalAnalysis.ts',
] as const

const EMPTY_SNAPSHOT: InverseAkitaTradeJournalHealthSnapshot = {
  schemaComplete: false,
  outcomeCounts: { executed: 0, rejected: 0, blocked: 0, failed: 0, incomplete: 0 },
  pendingDecisions: 0,
  unknownDecisions: 0,
  incompleteAttribution: 0,
  openLifecycles: 0,
  reconciliationAgeMinutes: null,
  lastSuccessfulDispatchAgeMinutes: null,
  sendUnknownDeliveries: 0,
  terminalReplyBacklog: 0,
  terminalReplySendUnknown: 0,
  terminalReplyLastSuccessAgeMinutes: null,
  latestAnalysisAgeMinutes: null,
  latestAnalysisFailed: false,
  latestAnalysisFallback: false,
  analysisSamples: 0,
  analysisFallbacks: 0,
  wrongRoomDispatches: 0,
  duplicateWindows: 0,
  duplicateParents: 0,
  overlappingLegacyBriefs: 0,
  ownershipInversions: 0,
  rawTextLeakage: 0,
  nonAnalysisOnlyRows: 0,
  executionReachability: 0,
}

function count(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function boolEnv(env: Record<string, string | undefined>, name: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(env[name] ?? '').trim().toLowerCase())
}

function addCheck(
  checks: InverseAkitaTradeJournalHealthResult['checks'],
  id: string,
  severity: Severity,
  detail: string,
): void {
  checks.push({ id, severity, detail })
}

async function hasRequiredSchema(db: DbPool): Promise<boolean> {
  const tables = await db.sql<{ present_count: string }>`
    SELECT count(*)::text AS present_count
    FROM unnest(${EXPECTED_TABLES as unknown as string[]}::text[]) AS expected(name)
    WHERE to_regclass(expected.name) IS NOT NULL
  `
  return count(tables.rows[0]?.present_count) === EXPECTED_TABLES.length
}

export async function loadInverseAkitaTradeJournalHealthSnapshot(
  windowHours: number,
): Promise<InverseAkitaTradeJournalHealthSnapshot> {
  const db = await getDb()
  if (!db) throw new Error('database_unavailable')
  if (!(await hasRequiredSchema(db))) return { ...EMPTY_SNAPSHOT }

  const result = await db.sql<HealthQueryRow>`
    WITH
    decisions AS (
      SELECT
        count(*) FILTER (WHERE terminal_outcome = 'executed')::text AS executed_count,
        count(*) FILTER (WHERE terminal_outcome = 'rejected')::text AS rejected_count,
        count(*) FILTER (WHERE terminal_outcome = 'blocked')::text AS blocked_count,
        count(*) FILTER (WHERE terminal_outcome = 'failed')::text AS failed_count,
        count(*) FILTER (WHERE terminal_outcome = 'incomplete')::text AS incomplete_count,
        count(*) FILTER (WHERE terminal_outcome IS NULL)::text AS pending_decisions,
        count(*) FILTER (WHERE execution_phase = 'unknown')::text AS unknown_decisions,
        count(*) FILTER (WHERE attribution_quality <> 'complete')::text AS incomplete_attribution
      FROM alfaclub.inverse_opinion_trade_decisions
      WHERE observed_at >= now() - (${windowHours}::text || ' hours')::interval
    ),
    lifecycles AS (
      SELECT
        count(*) FILTER (WHERE closed_at IS NULL)::text AS open_lifecycles,
        max(EXTRACT(EPOCH FROM (now() - COALESCE(last_reconciled_at, opened_at))) / 60)
          FILTER (WHERE closed_at IS NULL) AS reconciliation_age_minutes,
        count(*) FILTER (WHERE attribution_quality <> 'complete')::text AS incomplete_attribution
      FROM alfaclub.inverse_position_lifecycles
    ),
    dispatch AS (
      SELECT
        EXTRACT(EPOCH FROM (now() - max(sent_at))) / 60 AS last_dispatch_age_minutes,
        count(*) FILTER (WHERE room_id <> '1659')::text AS wrong_room_dispatches
      FROM alfaclub.inverse_opinion_trade_journal_dispatch
    ),
    deliveries AS (
      SELECT count(*) FILTER (WHERE delivery_state = 'send_unknown')::text
        AS send_unknown_deliveries
      FROM alfaclub.inverse_opinion_trade_journal_deliveries
    ),
    terminal_reply_deliveries AS (
      SELECT
        count(*) FILTER (
          WHERE delivery_state IN ('pending', 'sending', 'failed')
        )::text AS terminal_reply_backlog,
        count(*) FILTER (
          WHERE delivery_state = 'send_unknown'
        )::text AS terminal_reply_send_unknown,
        EXTRACT(EPOCH FROM (now() - max(sent_at))) / 60
          AS terminal_reply_last_success_age_minutes
      FROM alfaclub.inverse_opinion_reply_deliveries
    ),
    duplicate_windows AS (
      SELECT count(*)::text AS duplicate_windows
      FROM (
        SELECT room_id, reporting_window_start, reporting_window_end
        FROM alfaclub.inverse_opinion_trade_journal_dispatch
        GROUP BY room_id, reporting_window_start, reporting_window_end
        HAVING count(*) > 1
      ) duplicates
    ),
    duplicate_parents AS (
      SELECT count(*)::text AS duplicate_parents
      FROM (
        SELECT parent_message_id
        FROM alfaclub.inverse_opinion_trade_journal_dispatch
        WHERE parent_message_id IS NOT NULL
        GROUP BY parent_message_id
        HAVING count(*) > 1
      ) duplicates
    ),
    legacy_overlap AS (
      SELECT count(*)::text AS overlapping_legacy_briefs
      FROM alfaclub.inverse_opinion_trade_journal_dispatch journal
      JOIN alfaclub.daily_brief_dispatch legacy
        ON legacy.room_id = journal.room_id
       AND legacy.snapshot_ts > journal.reporting_window_start
       AND legacy.snapshot_ts <= journal.reporting_window_end
      WHERE journal.dispatch_state = 'sent'
    ),
    analyses AS (
      SELECT
        EXTRACT(EPOCH FROM (
          now() - max(created_at)
        )) / 60 AS latest_analysis_age_minutes,
        COALESCE((array_agg(failure_reason IS NOT NULL ORDER BY created_at DESC))[1], false)
          AS latest_analysis_failed,
        COALESCE((array_agg(
          failure_reason IS NOT NULL OR (verdict = 'watch' AND confidence <= 0.2)
          ORDER BY created_at DESC
        ))[1], false) AS latest_analysis_fallback,
        count(*) FILTER (
          WHERE created_at >= now() - (${windowHours}::text || ' hours')::interval
        )::text AS analysis_samples,
        count(*) FILTER (
          WHERE created_at >= now() - (${windowHours}::text || ' hours')::interval
            AND (failure_reason IS NOT NULL OR (verdict = 'watch' AND confidence <= 0.2))
        )::text AS analysis_fallbacks,
        count(*) FILTER (WHERE analysis_only IS NOT TRUE)::text AS non_analysis_only_rows,
        count(*) FILTER (
          WHERE evidence_bundle::text ~* '"(source.?text|raw.?text|message.?text|source.?excerpt)"[[:space:]]*:'
             OR interpretation::text ~* '"(source.?text|raw.?text|message.?text|source.?excerpt)"[[:space:]]*:'
             OR evidence_bundle::text ~* 'https?://[^" ]+/(messages?|chat)/'
             OR interpretation::text ~* 'https?://[^" ]+/(messages?|chat)/'
        )::text AS raw_text_leakage
      FROM alfaclub.inverse_opinion_trade_analyses
    )
    SELECT
      decisions.executed_count,
      decisions.rejected_count,
      decisions.blocked_count,
      decisions.failed_count,
      decisions.incomplete_count,
      decisions.pending_decisions,
      decisions.unknown_decisions,
      (decisions.incomplete_attribution::bigint + lifecycles.incomplete_attribution::bigint)::text
        AS incomplete_attribution,
      lifecycles.open_lifecycles,
      lifecycles.reconciliation_age_minutes,
      dispatch.last_dispatch_age_minutes,
      dispatch.wrong_room_dispatches,
      deliveries.send_unknown_deliveries,
      terminal_reply_deliveries.terminal_reply_backlog,
      terminal_reply_deliveries.terminal_reply_send_unknown,
      terminal_reply_deliveries.terminal_reply_last_success_age_minutes,
      duplicate_windows.duplicate_windows,
      duplicate_parents.duplicate_parents,
      legacy_overlap.overlapping_legacy_briefs,
      analyses.latest_analysis_age_minutes,
      analyses.latest_analysis_failed,
      analyses.latest_analysis_fallback,
      analyses.analysis_samples,
      analyses.analysis_fallbacks,
      analyses.raw_text_leakage,
      analyses.non_analysis_only_rows
    FROM decisions, lifecycles, dispatch, deliveries, terminal_reply_deliveries,
      duplicate_windows, duplicate_parents, legacy_overlap, analyses
  `
  const row = result.rows[0]
  if (!row) throw new Error('health_query_empty')

  return {
    schemaComplete: true,
    outcomeCounts: {
      executed: count(row.executed_count),
      rejected: count(row.rejected_count),
      blocked: count(row.blocked_count),
      failed: count(row.failed_count),
      incomplete: count(row.incomplete_count),
    },
    pendingDecisions: count(row.pending_decisions),
    unknownDecisions: count(row.unknown_decisions),
    incompleteAttribution: count(row.incomplete_attribution),
    openLifecycles: count(row.open_lifecycles),
    reconciliationAgeMinutes: row.reconciliation_age_minutes == null
      ? null
      : Math.round(count(row.reconciliation_age_minutes)),
    lastSuccessfulDispatchAgeMinutes: row.last_dispatch_age_minutes == null
      ? null
      : Math.round(count(row.last_dispatch_age_minutes)),
    sendUnknownDeliveries: count(row.send_unknown_deliveries),
    terminalReplyBacklog: count(row.terminal_reply_backlog),
    terminalReplySendUnknown: count(row.terminal_reply_send_unknown),
    terminalReplyLastSuccessAgeMinutes:
      row.terminal_reply_last_success_age_minutes == null
        ? null
        : Math.round(count(row.terminal_reply_last_success_age_minutes)),
    latestAnalysisAgeMinutes: row.latest_analysis_age_minutes == null
      ? null
      : Math.round(count(row.latest_analysis_age_minutes)),
    latestAnalysisFailed: Boolean(row.latest_analysis_failed),
    latestAnalysisFallback: Boolean(row.latest_analysis_fallback),
    analysisSamples: count(row.analysis_samples),
    analysisFallbacks: count(row.analysis_fallbacks),
    wrongRoomDispatches: count(row.wrong_room_dispatches),
    duplicateWindows: count(row.duplicate_windows),
    duplicateParents: count(row.duplicate_parents),
    overlappingLegacyBriefs: count(row.overlapping_legacy_briefs),
    ownershipInversions: 0,
    rawTextLeakage: count(row.raw_text_leakage),
    nonAnalysisOnlyRows: count(row.non_analysis_only_rows),
    executionReachability: 0,
  }
}

function localImports(source: string, parent: string): string[] {
  return [...source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)]
    .map((match) => match[1]!)
    .filter((specifier) => !specifier.endsWith('.json'))
    .map((specifier) => resolve(dirname(parent), specifier.replace(/\.js$/, '.ts')))
}

export function inspectInverseAkitaJournalArchitecture(): { executionReachability: number } {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../server/_lib/alfaclub')
  const pending = JOURNAL_SOURCE_ROOTS.map((name) => resolve(root, name))
  const visited = new Set<string>()
  let executionReachability = 0

  while (pending.length > 0) {
    const path = pending.pop()!
    if (visited.has(path)) continue
    visited.add(path)
    const source = readFileSync(path, 'utf8')
    if (
      /from\s+['"][^'"]*\/arena\//.test(source)
      || /\b(?:execute|submit|place|close)(?:Trade|Position)\s*\(/.test(source)
      || /\b(?:run|send)[A-Z]\w*(?:Trade|Order)\s*\(/.test(source)
    ) {
      executionReachability += 1
    }
    for (const imported of localImports(source, path)) {
      if (imported.includes('/alfaclub/') || imported.endsWith('/schemaBootstrap.ts')) {
        pending.push(imported)
      }
    }
  }
  return { executionReachability }
}

function ownershipInversions(env: Record<string, string | undefined>): number {
  const railway = Boolean(String(env.RAILWAY_SERVICE_ID ?? '').trim())
  const vercel = Boolean(String(env.VERCEL ?? env.VERCEL_ENV ?? '').trim())
  const capture = boolEnv(env, 'ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED')
  const publication = boolEnv(env, 'ALFACLUB_INVERSE_AKITA_TRADE_JOURNAL_PUBLISH_ENABLED')
  return Number(railway && publication) + Number(vercel && capture)
}

export async function runInverseAkitaTradeJournalVerification(
  options: VerificationOptions,
): Promise<InverseAkitaTradeJournalHealthResult> {
  const checks: InverseAkitaTradeJournalHealthResult['checks'] = []
  const baselineSampleSizeRaw = Number(
    options.env.ALFACLUB_INVERSE_AKITA_TRADE_JOURNAL_BASELINE_SAMPLE_SIZE,
  )
  const baselineAvailable = Number.isInteger(baselineSampleSizeRaw)
    && baselineSampleSizeRaw > 0
    && Boolean(
      String(
        options.env.ALFACLUB_INVERSE_AKITA_TRADE_JOURNAL_BASELINE_CAPTURED_AT ?? '',
      ).trim(),
    )

  let snapshot: InverseAkitaTradeJournalHealthSnapshot
  try {
    snapshot = await options.loadSnapshot(options.windowHours)
  } catch {
    addCheck(checks, 'database', 'fail', 'database_unavailable')
    return {
      status: 'fail',
      exitCode: 1,
      strict: options.strict,
      sampleWindowHours: options.windowHours,
      baseline: baselineAvailable ? 'available' : 'unavailable',
      baselineSampleSize: baselineAvailable ? baselineSampleSizeRaw : null,
      checks,
    }
  }

  const architecture = options.inspectArchitecture()
  snapshot.executionReachability += architecture.executionReachability
  snapshot.ownershipInversions += ownershipInversions(options.env)

  addCheck(checks, 'database', 'healthy', 'read_only_selects_completed')
  addCheck(
    checks,
    'schema',
    snapshot.schemaComplete ? 'healthy' : 'fail',
    snapshot.schemaComplete ? `required_tables=${EXPECTED_TABLES.length}` : 'required_schema_incomplete',
  )
  addCheck(
    checks,
    'outcomes',
    'healthy',
    Object.entries(snapshot.outcomeCounts).map(([key, value]) => `${key}=${value}`).join(' '),
  )
  addCheck(
    checks,
    'decision_backlog',
    snapshot.pendingDecisions || snapshot.unknownDecisions ? 'warn' : 'healthy',
    `pending=${snapshot.pendingDecisions} unknown=${snapshot.unknownDecisions}`,
  )
  addCheck(
    checks,
    'attribution',
    snapshot.incompleteAttribution ? 'warn' : 'healthy',
    `incomplete=${snapshot.incompleteAttribution}`,
  )
  addCheck(
    checks,
    'lifecycles',
    snapshot.reconciliationAgeMinutes == null && snapshot.openLifecycles > 0 ? 'warn' : 'healthy',
    `open=${snapshot.openLifecycles} reconciliation_age_min=${snapshot.reconciliationAgeMinutes ?? 'unavailable'}`,
  )
  addCheck(
    checks,
    'dispatch',
    snapshot.lastSuccessfulDispatchAgeMinutes == null ? 'warn' : 'healthy',
    `last_success_age_min=${snapshot.lastSuccessfulDispatchAgeMinutes ?? 'unavailable'}`,
  )
  addCheck(
    checks,
    'delivery_reconciliation',
    snapshot.sendUnknownDeliveries > 0 ? 'warn' : 'healthy',
    `send_unknown=${snapshot.sendUnknownDeliveries}`,
  )
  addCheck(
    checks,
    'terminal_reply_delivery',
    snapshot.terminalReplyBacklog > 0 || snapshot.terminalReplySendUnknown > 0
      ? 'warn'
      : 'healthy',
    `backlog=${snapshot.terminalReplyBacklog} send_unknown=${snapshot.terminalReplySendUnknown} last_success_age_min=${snapshot.terminalReplyLastSuccessAgeMinutes ?? 'unavailable'}`,
  )
  if (snapshot.lastSuccessfulDispatchAgeMinutes == null) {
    const observedOutcomes = Object.values(snapshot.outcomeCounts).reduce(
      (total, value) => total + value,
      0,
    )
    const firstRun = snapshot.incompleteAttribution > 0
      ? 'incomplete_lineage'
      : observedOutcomes > 0 || snapshot.openLifecycles > 0
        ? 'post_cutover_activity'
        : 'baseline_unavailable'
    addCheck(
      checks,
      'first_run_lineage',
      firstRun === 'post_cutover_activity' ? 'healthy' : 'warn',
      `first_run=${firstRun}`,
    )
  }
  addCheck(
    checks,
    'analysis',
    snapshot.latestAnalysisFailed || snapshot.latestAnalysisFallback ? 'warn' : 'healthy',
    `samples=${snapshot.analysisSamples} fallbacks=${snapshot.analysisFallbacks} latest_age_min=${snapshot.latestAnalysisAgeMinutes ?? 'unavailable'} latest_failure=${snapshot.latestAnalysisFailed} latest_fallback=${snapshot.latestAnalysisFallback}`,
  )
  addCheck(
    checks,
    'observational_baseline',
    baselineAvailable ? 'healthy' : 'warn',
    `sample_window_hours=${options.windowHours} baseline=${baselineAvailable ? 'available' : 'unavailable'} baseline_sample_size=${baselineAvailable ? baselineSampleSizeRaw : 'unavailable'}`,
  )

  const strictCounts: Array<[string, number]> = [
    ['wrong_room', snapshot.wrongRoomDispatches],
    ['duplicate_window', snapshot.duplicateWindows],
    ['duplicate_parent', snapshot.duplicateParents],
    ['legacy_journal_overlap', snapshot.overlappingLegacyBriefs],
    ['ownership_inversion', snapshot.ownershipInversions],
    ['raw_text_leakage', snapshot.rawTextLeakage],
    ['non_analysis_only', snapshot.nonAnalysisOnlyRows],
    ['analysis_execution_reachability', snapshot.executionReachability],
  ]
  for (const [id, value] of strictCounts) {
    addCheck(checks, id, value > 0 ? 'fail' : 'healthy', `violations=${value}`)
  }

  if (
    options.strict
    && boolEnv(options.env, 'ALFACLUB_INVERSE_AKITA_TRADE_JOURNAL_PUBLISH_ENABLED')
    && snapshot.lastSuccessfulDispatchAgeMinutes == null
  ) {
    addCheck(checks, 'mandatory_dispatch_state', 'fail', 'publication_enabled_without_successful_dispatch')
  }

  const hasFailure = checks.some((check) => check.severity === 'fail')
  const hasWarning = checks.some((check) => check.severity === 'warn')
  return {
    status: hasFailure ? 'fail' : hasWarning ? 'warn' : 'healthy',
    exitCode: hasFailure ? 1 : 0,
    strict: options.strict,
    sampleWindowHours: options.windowHours,
    baseline: baselineAvailable ? 'available' : 'unavailable',
    baselineSampleSize: baselineAvailable ? baselineSampleSizeRaw : null,
    checks,
  }
}

export function formatInverseAkitaTradeJournalHealth(
  result: InverseAkitaTradeJournalHealthResult,
): string {
  const lines = [`[inverse-akita-trade-journal] ${result.status.toUpperCase()}`]
  for (const check of result.checks) {
    lines.push(`  ${check.severity.toUpperCase().padEnd(7)} ${check.id}: ${check.detail}`)
  }
  lines.push(
    `[inverse-akita-trade-journal] summary status=${result.status} strict=${result.strict} sample_window_hours=${result.sampleWindowHours} baseline=${result.baseline}`,
  )
  return lines.join('\n')
}

function readPositiveIntArg(name: string, fallback: number): number {
  const prefix = `--${name}=`
  const argv = process.argv.slice(2)
  const index = argv.indexOf(`--${name}`)
  const raw = index >= 0 ? argv[index + 1] : argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

async function main(): Promise<void> {
  const result = await runInverseAkitaTradeJournalVerification({
    loadSnapshot: loadInverseAkitaTradeJournalHealthSnapshot,
    inspectArchitecture: inspectInverseAkitaJournalArchitecture,
    env: process.env,
    now: new Date(),
    windowHours: readPositiveIntArg('window-hours', 24),
    strict: process.argv.slice(2).includes('--strict'),
  })
  console.log(formatInverseAkitaTradeJournalHealth(result))
  process.exit(result.exitCode)
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (entry === import.meta.url) {
  void main()
}
