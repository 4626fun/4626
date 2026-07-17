#!/usr/bin/env tsx
/**
 * InverseAKITA shadow-lane health probe (read-only).
 *
 * Checks DB sampler warm-up, decision ledger + 8h outcomes, local export /
 * claim gate, and optionally Hermit `/healthz` counter-trade ticker state.
 *
 * Usage:
 *   pnpm -C frontend ops:inverse-akita:shadow-health
 *   pnpm -C frontend ops:inverse-akita:shadow-health -- --strict --hermit-url https://4626-production.up.railway.app/healthz
 *
 * Exit codes:
 *   0 — ok (warnings allowed unless --strict)
 *   1 — failed check (--strict treats warnings as failures, or critical error)
 *   2 — configuration error (missing DATABASE_URL)
 */

import { exportSettledDecisionsJsonl } from '../../server/_lib/alfaclub/decisions/publicLedgerExport.js'
import { getDb } from '../../server/_lib/db/postgres.js'
import {
  ensureAlfaclubDecisionLedgerSchema,
  ensureAlfaclubMarketFeatureSnapshotSchema,
} from '../../server/_lib/db/schemaBootstrap.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code: number) => void
}

type Severity = 'ok' | 'warn' | 'fail'

type CheckResult = {
  id: string
  severity: Severity
  detail: string
}

const DEFAULT_MIN_SAMPLES_PER_SYMBOL = 12
const DEFAULT_TARGET_SYMBOLS = 12
const DEFAULT_HERMIT_HEALTH_URL =
  process.env.INV_AKITA_HERMIT_HEALTH_URL?.trim() ||
  process.env.HERMIT_HEALTH_URL?.trim() ||
  'https://4626-production.up.railway.app/healthz'

function readArg(name: string, fallback: string): string {
  const prefix = `--${name}=`
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === `--${name}` && argv[i + 1]) return argv[i + 1]
    if (argv[i].startsWith(prefix)) return argv[i].slice(prefix.length)
  }
  return fallback
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`)
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = Number(readArg(name, String(fallback)))
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

function push(results: CheckResult[], id: string, severity: Severity, detail: string): void {
  results.push({ id, severity, detail })
}

function ageMinutes(isoOrDate: string | Date | null | undefined): number | null {
  if (!isoOrDate) return null
  const ms = new Date(isoOrDate).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.round((Date.now() - ms) / 60_000)
}

async function checkDatabase(results: CheckResult[]): Promise<ReturnType<typeof getDb>> {
  const db = await getDb()
  if (!db) {
    push(results, 'database', 'fail', 'DATABASE_URL not configured or Postgres unavailable')
    return null
  }
  push(results, 'database', 'ok', 'Postgres connection available')
  return db
}

async function checkSchemas(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, results: CheckResult[]): Promise<void> {
  try {
    await ensureAlfaclubMarketFeatureSnapshotSchema(db)
    await ensureAlfaclubDecisionLedgerSchema(db)
    const reg = await db.sql<{ snapshots: boolean; ledger: boolean; outcomes: boolean }>`
      SELECT
        to_regclass('alfaclub.market_feature_snapshots') IS NOT NULL AS snapshots,
        to_regclass('alfaclub.decision_ledger') IS NOT NULL AS ledger,
        to_regclass('alfaclub.decision_outcomes') IS NOT NULL AS outcomes
    `
    const row = reg.rows[0]
    if (!row?.snapshots || !row?.ledger || !row?.outcomes) {
      push(
        results,
        'schema',
        'fail',
        `missing tables snapshots=${Boolean(row?.snapshots)} ledger=${Boolean(row?.ledger)} outcomes=${Boolean(row?.outcomes)}`,
      )
      return
    }
    push(results, 'schema', 'ok', 'market_feature_snapshots + decision_ledger + decision_outcomes present')
  } catch (err) {
    push(
      results,
      'schema',
      'fail',
      err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
    )
  }
}

async function checkFeatureSnapshots(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  results: CheckResult[],
  minSamplesPerSymbol: number,
  targetSymbols: number,
): Promise<void> {
  const summary = await db.sql<{
    total_7d: string
    symbol_count_7d: string
    latest_observed_at: Date | string | null
  }>`
    SELECT
      count(*)::text AS total_7d,
      count(DISTINCT symbol)::text AS symbol_count_7d,
      max(observed_at) AS latest_observed_at
    FROM alfaclub.market_feature_snapshots
    WHERE observed_at >= now() - interval '7 days'
  `
  const warm = await db.sql<{ symbol: string; sample_count: string }>`
    SELECT symbol, count(*)::text AS sample_count
    FROM alfaclub.market_feature_snapshots
    WHERE observed_at >= now() - interval '7 days'
    GROUP BY symbol
    HAVING count(*) >= ${minSamplesPerSymbol}
    ORDER BY count(*) DESC
  `
  const row = summary.rows[0]
  const total7d = Number(row?.total_7d ?? 0)
  const symbolCount7d = Number(row?.symbol_count_7d ?? 0)
  const warmCount = warm.rows.length
  const latestAgeMin = ageMinutes(row?.latest_observed_at)

  if (total7d === 0) {
    push(results, 'sampler', 'fail', 'no market_feature_snapshots in the last 7 days')
    return
  }

  const samplerDetail = [
    `7d_total=${total7d}`,
    `symbols_7d=${symbolCount7d}`,
    `symbols_warm>=${minSamplesPerSymbol}=${warmCount}`,
    latestAgeMin != null ? `latest_age_min=${latestAgeMin}` : 'latest_age_min=unknown',
  ].join(' ')

  if (warmCount < targetSymbols) {
    push(results, 'sampler', 'warn', `${samplerDetail} (target warm symbols=${targetSymbols})`)
  } else {
    push(results, 'sampler', 'ok', samplerDetail)
  }

  if (latestAgeMin != null && latestAgeMin > 15) {
    push(results, 'sampler_freshness', 'warn', `latest snapshot is ${latestAgeMin}m old (cron expects ~5m cadence)`)
  } else {
    push(results, 'sampler_freshness', 'ok', `latest snapshot age ${latestAgeMin ?? 'unknown'}m`)
  }
}

async function checkDecisionLedger(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, results: CheckResult[]): Promise<void> {
  const counts = await db.sql<{
    total: string
    last_24h: string
    hermit_entry: string
    acp_canary: string
    latest_observed_at: Date | string | null
  }>`
    SELECT
      count(*)::text AS total,
      count(*) FILTER (WHERE observed_at >= now() - interval '24 hours')::text AS last_24h,
      count(*) FILTER (WHERE idempotency_key LIKE 'hermit-entry:%')::text AS hermit_entry,
      count(*) FILTER (WHERE idempotency_key LIKE 'virtuals:%')::text AS acp_canary,
      max(observed_at) AS latest_observed_at
    FROM alfaclub.decision_ledger
  `
  const row = counts.rows[0]
  const total = Number(row?.total ?? 0)
  const last24h = Number(row?.last_24h ?? 0)
  const hermitEntry = Number(row?.hermit_entry ?? 0)
  const acpCanary = Number(row?.acp_canary ?? 0)

  if (total === 0) {
    push(results, 'decision_ledger', 'warn', 'no decision_ledger rows yet')
  } else {
    push(
      results,
      'decision_ledger',
      'ok',
      `total=${total} last_24h=${last24h} hermit_entry=${hermitEntry} acp_canary=${acpCanary} latest_age_min=${ageMinutes(row?.latest_observed_at) ?? 'unknown'}`,
    )
  }

  if (hermitEntry === 0) {
    push(
      results,
      'entry_advisory_ledger',
      'warn',
      'no hermit-entry:* ledger rows yet (wait for next successful counter-trade entry with INV_AKITA_ENTRY_ADVISORY_ENABLED=1)',
    )
  } else {
    push(results, 'entry_advisory_ledger', 'ok', `hermit-entry rows=${hermitEntry}`)
  }
}

async function checkOutcomes(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, results: CheckResult[]): Promise<void> {
  const outcome = await db.sql<{
    pending_8h: string
    settled_8h: string
    overdue_pending_8h: string
  }>`
    SELECT
      count(*) FILTER (WHERE status = 'pending' AND horizon_hours = 8)::text AS pending_8h,
      count(*) FILTER (WHERE status = 'settled' AND horizon_hours = 8)::text AS settled_8h,
      count(*) FILTER (
        WHERE status = 'pending'
          AND horizon_hours = 8
          AND due_at < now()
      )::text AS overdue_pending_8h
    FROM alfaclub.decision_outcomes
  `
  const row = outcome.rows[0]
  const pending8h = Number(row?.pending_8h ?? 0)
  const settled8h = Number(row?.settled_8h ?? 0)
  const overdue = Number(row?.overdue_pending_8h ?? 0)

  push(
    results,
    'outcomes_8h',
    settled8h > 0 ? 'ok' : 'warn',
    `pending=${pending8h} settled=${settled8h} overdue_pending=${overdue}`,
  )

  if (overdue > 0) {
    push(
      results,
      'outcome_settle',
      'warn',
      `${overdue} pending 8h outcomes past due_at — verify /api/v1/alfaclub/decision-outcome-settle cron`,
    )
  } else {
    push(results, 'outcome_settle', 'ok', 'no overdue 8h pending outcomes')
  }
}

async function checkExportReport(results: CheckResult[]): Promise<void> {
  const data = await exportSettledDecisionsJsonl()
  const { report } = data
  push(
    results,
    'export_claim_gate',
    report.claimAllowed ? 'ok' : 'warn',
    `rowCount=${data.rowCount} sampleSize=${report.sampleSize} claimAllowed=${report.claimAllowed} edgeBps=${report.conditionalInverseEdgeBps} ci95=[${report.bootstrapCi95.join(',')}]`,
  )
}

async function checkHermitHealth(results: CheckResult[], url: string): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      push(results, 'hermit_health', 'fail', `GET ${url} returned HTTP ${res.status}`)
      return
    }
    const body = (await res.json()) as {
      counterTradeEffective?: boolean
      counterTradeEffectiveReason?: string | null
      counterTrade?: {
        lastTickAt?: string | null
        lastResult?: { ok?: boolean; reason?: string }
      }
    }
    const effective = body.counterTradeEffective === true
    const lastTickAgeMin = ageMinutes(body.counterTrade?.lastTickAt)
    const lastReason =
      body.counterTradeEffectiveReason
      ?? body.counterTrade?.lastResult?.reason
      ?? 'unknown'

    if (!effective) {
      push(
        results,
        'hermit_counter_trade',
        'fail',
        `counter_trade_not_effective reason=${lastReason}`,
      )
      return
    }

    const detail = [
      'counter_trade_effective=true',
      lastTickAgeMin != null ? `last_tick_age_min=${lastTickAgeMin}` : 'last_tick_age_min=unknown',
      `last_reason=${lastReason}`,
    ].join(' ')

    if (lastTickAgeMin != null && lastTickAgeMin > 10) {
      push(results, 'hermit_counter_trade', 'warn', `${detail} (expected ~2m cadence)`)
    } else {
      push(results, 'hermit_counter_trade', 'ok', detail)
    }
  } catch (err) {
    push(
      results,
      'hermit_health',
      'fail',
      err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function checkExportHttp(results: CheckResult[], baseUrl: string, cronSecret: string): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/alfaclub/decision-ledger-export`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    if (!res.ok) {
      push(results, 'export_http', 'fail', `GET export returned HTTP ${res.status}`)
      return
    }
    const body = (await res.json()) as {
      success?: boolean
      data?: { rowCount?: number; report?: { claimAllowed?: boolean; sampleSize?: number } }
    }
    if (!body.success) {
      push(results, 'export_http', 'fail', 'export endpoint success=false')
      return
    }
    push(
      results,
      'export_http',
      body.data?.report?.claimAllowed ? 'ok' : 'warn',
      `rowCount=${body.data?.rowCount ?? 0} claimAllowed=${Boolean(body.data?.report?.claimAllowed)} sampleSize=${body.data?.report?.sampleSize ?? 0}`,
    )
  } catch (err) {
    push(
      results,
      'export_http',
      'fail',
      err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
    )
  } finally {
    clearTimeout(timeout)
  }
}

function summarize(results: CheckResult[], strict: boolean): number {
  console.log('[inverse-akita-shadow-health]')
  for (const row of results) {
    const tag = row.severity.toUpperCase().padEnd(4)
    console.log(`  ${tag} ${row.id}: ${row.detail}`)
  }

  const fails = results.filter((row) => row.severity === 'fail')
  const warns = results.filter((row) => row.severity === 'warn')
  console.log('')
  console.log(
    `[inverse-akita-shadow-health] summary ok=${results.length - fails.length - warns.length} warn=${warns.length} fail=${fails.length} strict=${strict}`,
  )

  if (fails.length > 0) return 1
  if (strict && warns.length > 0) return 1
  return 0
}

async function main(): Promise<void> {
  const strict = hasFlag('strict')
  const minSamplesPerSymbol = readPositiveInt('min-samples-per-symbol', DEFAULT_MIN_SAMPLES_PER_SYMBOL)
  const targetSymbols = readPositiveInt('target-symbols', DEFAULT_TARGET_SYMBOLS)
  const hermitUrl = readArg('hermit-url', hasFlag('skip-hermit') ? '' : DEFAULT_HERMIT_HEALTH_URL)
  const exportBaseUrl = readArg('export-base-url', 'https://app.4626.fun')
  const cronSecret = process.env.CRON_SECRET?.trim() ?? ''
  const probeExportHttp = hasFlag('probe-export-http')

  const results: CheckResult[] = []

  const db = await checkDatabase(results)
  if (!db) {
    process.exit(summarize(results, strict))
    return
  }

  await checkSchemas(db, results)
  await checkFeatureSnapshots(db, results, minSamplesPerSymbol, targetSymbols)
  await checkDecisionLedger(db, results)
  await checkOutcomes(db, results)
  await checkExportReport(results)

  if (hermitUrl) {
    await checkHermitHealth(results, hermitUrl)
  } else {
    push(results, 'hermit_health', 'ok', 'skipped (--skip-hermit or empty --hermit-url)')
  }

  if (probeExportHttp) {
    if (!cronSecret) {
      push(results, 'export_http', 'fail', 'CRON_SECRET required for --probe-export-http')
    } else {
      await checkExportHttp(results, exportBaseUrl, cronSecret)
    }
  }

  process.exit(summarize(results, strict))
}

void main()
