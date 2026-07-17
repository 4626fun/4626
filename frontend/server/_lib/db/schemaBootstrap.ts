/**
 * schemaBootstrap.ts
 *
 * **CANONICAL CONDENSATION LAYER** (see AGENTS.md + docs/operations/supabase-schema-condensation.md)
 *
 * Single source of truth: `supabase/migrations/`
 * - Only one Supabase project (`qajpnuvqlcfseghnldkl`).
 * - Never duplicate DDL in `frontend/db/migrations-legacy/` (archived historical mirror) or as raw strings in ensure* functions.
 * - All new tables/columns go through proper migrations.
 * - Runtime cold-start needs delegate here.
 *
 * This module provides safe, idempotent runtime bootstrapping for the small
 * number of tables that legitimately need to be created on cold-start in dev,
 * preview, or certain Railway/Hermit contexts (AMOE replay store, Alfaclub
 * vigilante tables, certain control-plane tables, etc.).
 *
 * All ensure*Schema helpers are now centrally protected by withEnsureOnce()
 * (idempotent + concurrent-safe). The old thin no-arg wrappers in
 * chat/ and workspace/ have been fully migrated to direct canonical usage.
 *
 * Usage (example):
 *   await ensureMigrationApplied(db, '20260429000000_amoe_zk_submissions.sql')
 *   await ensureAlfaclubSchema(db)
 *   await ensureCriticalAppTables(db)
 *
 * The helper is intentionally conservative: it only runs when it detects
 * missing objects, and it never drops anything.
 *
 * When adding new runtime bootstrap needs:
 *   1. Create the migration in supabase/migrations/
 *   2. Call from the relevant ensure* function via this helper
 *   3. Update the duplication report
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

const MIGRATIONS_RELATIVE = 'supabase/migrations'

/** Injected by `packages/server-core/build.mjs` when dist entries are bundled. */
declare const __4626_SUPABASE_MIGRATIONS_ROOT__: string | undefined

let migrationsRootCache: string | null = null

/**
 * Locate `supabase/migrations` without relying on `import.meta.url` depth.
 * Bundled `@4626/server-core/dist/*.js` lives under `packages/server-core/dist/`,
 * so a fixed `../../../../../supabase/migrations` offset resolves outside the repo.
 */
export function resolveSupabaseMigrationsRoot(): string {
  if (migrationsRootCache) return migrationsRootCache

  const envOverride = String(process.env.SUPABASE_MIGRATIONS_DIR ?? '').trim()
  if (envOverride) {
    migrationsRootCache = resolve(envOverride)
    return migrationsRootCache
  }

  const injected =
    typeof __4626_SUPABASE_MIGRATIONS_ROOT__ === 'string'
      ? __4626_SUPABASE_MIGRATIONS_ROOT__.trim()
      : ''
  if (injected) {
    const resolvedInjected = resolve(injected)
    if (existsSync(resolvedInjected)) {
      migrationsRootCache = resolvedInjected
      return migrationsRootCache
    }
  }

  const searchStarts = [process.cwd(), dirname(fileURLToPath(import.meta.url))]
  const seen = new Set<string>()

  for (const start of searchStarts) {
    let dir = resolve(start)
    for (let depth = 0; depth < 12; depth++) {
      if (seen.has(dir)) break
      seen.add(dir)

      const candidate = resolve(dir, MIGRATIONS_RELATIVE)
      if (existsSync(candidate)) {
        migrationsRootCache = candidate
        return migrationsRootCache
      }

      const parent = resolve(dir, '..')
      if (parent === dir) break
      dir = parent
    }
  }

  throw new Error(
    `[schemaBootstrap] Could not locate ${MIGRATIONS_RELATIVE}. ` +
      'Set SUPABASE_MIGRATIONS_DIR or include supabase/migrations in the serverless bundle.',
  )
}

const ensuredFiles = new Set<string>()

/**
 * Durable DB-side ledger (public.schema_bootstrap_ledger, created by
 * 20260713070000_schema_bootstrap_ledger.sql). Without it, every serverless
 * cold start replayed full migration files: thousands of no-op-but-locking DDL
 * statements (ALTER TABLE on creator_coins averaged ~1.9s under ACCESS
 * EXCLUSIVE lock) and constant PostgREST schema-cache invalidations.
 * With it, a cold start does one cheap SELECT per file.
 *
 * To force a re-apply on next cold start:
 *   DELETE FROM public.schema_bootstrap_ledger WHERE filename = '<file>.sql';
 */
let ledgerAvailable: boolean | null = null

async function isLedgerAvailable(db: Db): Promise<boolean> {
  if (ledgerAvailable !== null) return ledgerAvailable
  try {
    const result = await db.sql`SELECT to_regclass('public.schema_bootstrap_ledger') IS NOT NULL AS ok;`
    ledgerAvailable = Boolean(result.rows?.[0]?.ok)
  } catch {
    ledgerAvailable = false
  }
  return ledgerAvailable
}

async function isRecordedInLedger(db: Db, filename: string): Promise<boolean> {
  if (!(await isLedgerAvailable(db))) return false
  try {
    const result = await db.sql`SELECT 1 FROM public.schema_bootstrap_ledger WHERE filename = ${filename} LIMIT 1;`
    return (result.rows?.length ?? 0) > 0
  } catch {
    return false
  }
}

async function recordInLedger(db: Db, filename: string): Promise<void> {
  if (!(await isLedgerAvailable(db))) return
  await db.sql`
    INSERT INTO public.schema_bootstrap_ledger (filename) VALUES (${filename})
    ON CONFLICT (filename) DO NOTHING;
  `.catch(() => {})
}

/**
 * Per-helper idempotency + concurrent safety state.
 * This centralizes the "ensure once" pattern that was previously duplicated
 * (and sometimes incorrectly implemented) in legacy wrapper modules.
 */
type EnsureOnceState = {
  ensured: boolean
  promise: Promise<void> | null
}

const ensureOnceStates = new Map<string, EnsureOnceState>()

/**
 * Wraps a bootstrap function so it is guaranteed to run at most once per
 * process, with safe concurrent call coalescing.
 *
 * This is the single source of truth for the "ensure once" behavior.
 */
export async function withEnsureOnce(
  name: string,
  fn: () => Promise<void>
): Promise<void> {
  let state = ensureOnceStates.get(name)
  if (!state) {
    state = { ensured: false, promise: null }
    ensureOnceStates.set(name, state)
  }

  if (state.ensured) return
  if (state.promise) return state.promise

  state.promise = (async () => {
    try {
      await fn()
      state!.ensured = true
    } catch (error) {
      state!.ensured = false
      throw error
    } finally {
      state!.promise = null
    }
  })()

  return state.promise
}

function readMigration(filename: string): string {
  const full = resolve(resolveSupabaseMigrationsRoot(), filename)
  try {
    return readFileSync(full, 'utf8')
  } catch (e) {
    throw new Error(`[schemaBootstrap] Could not read migration ${filename} at ${full}: ${e}`)
  }
}

/**
 * Very lightweight splitter that respects simple $$ ... $$ dollar-quoted blocks
 * and standard semicolons. Good enough for our forward-only DDL migrations.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inDollarQuote = false
  let dollarTag = ''

  const normalizeStatement = (raw: string): string | null => {
    const lines = raw.split(/\r?\n/)
    while (lines.length > 0) {
      const first = lines[0]?.trim() ?? ''
      if (first === '' || first.startsWith('--')) {
        lines.shift()
        continue
      }
      break
    }
    const normalized = lines.join('\n').trim()
    if (!normalized || normalized === ';') return null
    return normalized
  }

  const lines = sql.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!inDollarQuote) {
      const dollarMatch = trimmed.match(/\$\$/)
      if (dollarMatch) {
        inDollarQuote = true
        dollarTag = '$$'
      }
    } else {
      if (trimmed.includes('$$')) {
        inDollarQuote = false
      }
    }

    current += line + '\n'

    if (!inDollarQuote && trimmed.endsWith(';')) {
      const stmt = normalizeStatement(current)
      if (stmt) {
        statements.push(stmt)
      }
      current = ''
    }
  }

  if (current.trim()) {
    const stmt = normalizeStatement(current)
    if (stmt) statements.push(stmt)
  }

  return statements.filter((s) => s.length > 0)
}

/**
 * Execute a specific migration file from supabase/migrations/ if it looks like
 * the objects it manages are not yet present.
 *
 * This is intentionally simple and conservative. For complex migrations you
 * should still rely on proper Supabase migration application in prod.
 */
export async function ensureMigrationApplied(
  db: Db,
  filename: string,
  preflightCheck?: () => Promise<boolean>,
  options?: { strict?: boolean; verifyRecorded?: boolean },
): Promise<boolean> {
  if (ensuredFiles.has(filename)) return true

  // Durable cross-process short-circuit: skip the DDL replay entirely when a
  // previous process already applied this file against this database.
  if (await isRecordedInLedger(db, filename)) {
    if (!options?.verifyRecorded || !preflightCheck || await preflightCheck()) {
      ensuredFiles.add(filename)
      return true
    }
  }

  if (preflightCheck) {
    const alreadyGood = await preflightCheck()
    if (alreadyGood) {
      ensuredFiles.add(filename)
      await recordInLedger(db, filename)
      return true
    }
  }

  const sql = readMigration(filename)
  const statements = splitStatements(sql)

  console.log(`[schemaBootstrap] Applying ${filename} (${statements.length} statements) for cold-start bootstrap`)

  for (const stmt of statements) {
    try {
      await db.sql([stmt] as unknown as TemplateStringsArray)
    } catch (e: any) {
      const msg = String(e?.message ?? e)
      // Common benign cases during bootstrap
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate key') ||
        msg.includes('relation') && msg.includes('already exists')
      ) {
        continue
      }
      if (options?.strict) throw e
      console.warn(`[schemaBootstrap] Non-fatal error applying statement from ${filename}:`, msg)
    }
  }

  if (preflightCheck && !(await preflightCheck())) {
    throw new Error(
      `[schemaBootstrap] Migration ${filename} did not create all probed objects`,
    )
  }

  ensuredFiles.add(filename)
  await recordInLedger(db, filename)
  return true
}

/**
 * Convenience helper for the common case of "these critical AMOE / Alfaclub /
 * control-plane migrations must exist".
 */
export async function ensureCriticalAppTables(db: Db): Promise<void> {
  // These are the tables that have historically needed runtime bootstrap
  // outside of normal Supabase migration application.

  await ensureMigrationApplied(db, '20260429000000_amoe_zk_submissions.sql')
  await ensureMigrationApplied(db, '20260429010000_amoe_points_burn_ledger.sql')
  await ensureMigrationApplied(db, '20260429020000_amoe_publisher_runs.sql')
  await ensureMigrationApplied(db, '20260430190000_amoe_entry_refund_source.sql')

  await ensureMigrationApplied(db, '20260501000000_alfaclub_user_preferences.sql')

  await ensureMigrationApplied(db, '20260518165000_control_plane_operations.sql')
  await ensureMigrationApplied(db, '20260518190000_control_plane_stages_events_and_payment_ledgers.sql')

  // Add more here only when a new table genuinely needs cold-start creation.
}

/**
 * Dedicated helper for the alfaclub schema (good example of using a private
 * schema inside the single Supabase project for isolation).
 *
 * Now covers the core user_preference + the extracted vigilante tables
 * (chat_ingest, room access). All new Alfaclub DDL must land in supabase/migrations/
 * and be wired here.
 */
export async function ensureAlfaclubSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260501000000_alfaclub_user_preferences.sql').catch(() => {})
  await ensureMigrationApplied(db, '20260526000000_alfaclub_chat_ingest.sql').catch(() => {})
  await ensureMigrationApplied(db, '20260526010000_alfaclub_room_access.sql').catch(() => {})
  await ensureMigrationApplied(db, '20260526020000_alfaclub_vigilante_core.sql').catch(() => {})
  await ensureMigrationApplied(db, '20260526030000_alfaclub_radar_and_cooldown.sql').catch(() => {})
  await ensureMigrationApplied(db, '20260602000000_alfaclub_room_welcome.sql').catch(() => {})
  await ensureMigrationApplied(db, '20260710000000_alfaclub_room_label_cache.sql').catch(() => {})
  // All major Alfaclub tables should now be covered. New tables must be added as proper migrations first.
}

/**
 * AMOE lottery + replay tables.
 * Covers the remaining tables that were still living as raw DDL in
 * lotteryAmoe.ts and amoeReplayStore.ts.
 */
export async function ensureAmoeSchema(db: Db): Promise<void> {
  await withEnsureOnce('amoe', async () => {
    // Core AMOE tables already had migrations; this adds the remaining lottery ones.
    await ensureMigrationApplied(db, '20260527000000_amoe_lottery_tables.sql').catch(() => {})
    await ensureMigrationApplied(db, '20260707060000_amoe_wallet_allowlist_snapshots.sql').catch(() => {})
    // Note: amoe_zk_submissions and related publisher tables are covered via earlier calls
    // in the individual ensure functions.
  })
}

/**
 * Telegram trading / linking / holder-room schema (from telegramTrading.ts).
 *
 * Centralizes the previous "ensure once" wrapper + pgcrypto side-effect that
 * used to live in the legacy telegramTrading.ts module.
 */
export async function ensureTelegramTradingSchema(db: Db): Promise<void> {
  await withEnsureOnce('telegramTrading', async () => {
    await ensureMigrationApplied(db, '20260528000000_telegram_trading_schema.sql').catch(() => {})
    // One-time extension required by some telegram trading paths.
    // Safe and idempotent to call on every cold start.
    await db.sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`.catch(() => {})
  })
}

/**
 * Agent memory tables (Eliza / runtimeBridge).
 */
export async function ensureAgentMemorySchema(db: Db): Promise<void> {
  await withEnsureOnce('agentMemory', async () => {
    await ensureMigrationApplied(db, '20260530000000_agent_memory_schema.sql').catch(() => {})
  })
}

/**
 * Chat presence and friend requests.
 *
 * Central implementation (all callers now use this directly).
 */
export async function ensureChatSchema(db: Db): Promise<void> {
  await withEnsureOnce('chat', async () => {
    await ensureMigrationApplied(db, '20260714101000_chat_schema_bootstrap_slim.sql').catch(() => {})
  })
}

/**
 * Image generation projects, assets, attempts, and jobs.
 */
export async function ensureImageGenerationSchema(db: Db): Promise<void> {
  await withEnsureOnce('imageGeneration', async () => {
    await ensureMigrationApplied(db, '20260601000000_image_generation_schema.sql').catch(() => {})
  })
}

/**
 * Wallet intelligence and feedback cache tables.
 */
export async function ensureWalletIntelligenceCacheSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260602000000_wallet_intelligence_cache_schema.sql').catch(() => {})
}

/**
 * Zora CSW gate Telegram tokens and entry challenges.
 */
export async function ensureZoraCswGateSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260603000000_zora_csw_gate_schema.sql').catch(() => {})
}

/**
 * Keeper CRE attestation + strategy health tables.
 */
export async function ensureKeeperCreSchema(db: Db): Promise<void> {
  await withEnsureOnce('keeperCre', async () => {
    await ensureMigrationApplied(db, '20260611100000_keeper_cre_attestation_schema.sql').catch(() => {})
  })
}

/**
 * Creator access allowlist and access request tables.
 */
export async function ensureCreatorAccessSchema(db: Db): Promise<void> {
  await withEnsureOnce('creatorAccess', async () => {
    await ensureMigrationApplied(db, '20260604000000_creator_access_schema.sql').catch(() => {})
  })
}

/**
 * Agent access nonces and room access tokens.
 */
export async function ensureAgentAccessProofSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260605000000_agent_access_schema.sql').catch(() => {})
}

/**
 * Auth nonces (general + agent/SIWA) + cross-context handoff codes.
 * Extracted from the three small auth/* ensure functions.
 */
export async function ensureAuthNonceHandoffSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260606000000_auth_nonce_handoff_schema.sql').catch(() => {})
}

/**
 * Creator metrics base tables.
 */
export async function ensureCreatorMetricsBaseSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260527010000_creator_metrics_base_tables.sql').catch(() => {})
}

/**
 * Agent runtime leases, background task queue, API audit, control audit events,
 * and keepr send ledger.
 */
export async function ensureAgentRuntimeAuditLedgerSchema(db: Db): Promise<void> {
  await withEnsureOnce('agentRuntimeAuditLedger', async () => {
    await ensureMigrationApplied(db, '20260607000000_agent_runtime_audit_ledger_schema.sql').catch(() => {})
  })
}

/**
 * Wallet/creator wallet tables, Solana sweep jobs, Meteora Alpha Vault config,
 * and admin audit logs.
 */
export async function ensureWalletOnchainOpsAuditSchema(db: Db): Promise<void> {
  await withEnsureOnce('walletOnchainOpsAudit', async () => {
    await ensureMigrationApplied(db, '20260714061000_wallet_onchain_ops_bootstrap_slim.sql').catch(() => {})
  })
}

/**
 * Telemetry/event tables + creative tool logs (Hermit memes, Zora trend ops).
 */
export async function ensureTelemetryCreativeLogsSchema(db: Db): Promise<void> {
  await withEnsureOnce('telemetryCreativeLogs', async () => {
    await ensureMigrationApplied(db, '20260609000000_telemetry_creative_logs_schema.sql').catch(() => {})
  })
}

/**
 * Alfaclub daily brief dispatch (inside private alfaclub schema).
 * Last major raw DDL site for a dedicated schema table.
 */
export async function ensureAlfaclubDailyBriefSchema(db: Db): Promise<void> {
  await withEnsureOnce('alfaclubDailyBrief', async () => {
    await ensureMigrationApplied(db, '20260610000000_alfaclub_daily_brief_dispatch.sql').catch(() => {})
    await ensureMigrationApplied(db, '20260706000000_alfaclub_command_reply_ledger.sql').catch(() => {})
  })
}

/** Hermit position alert subscriptions (liquidation / target PnL Telegram DMs). */
export async function ensureAlfaclubPositionAlertSchema(db: Db): Promise<void> {
  await withEnsureOnce('alfaclubPositionAlert', async () => {
    await ensureMigrationApplied(db, '20260707000000_alfaclub_position_alerts.sql').catch(() => {})
    await ensureMigrationApplied(db, '20260708120000_position_alert_xmtp_enabled.sql').catch(() => {})
  })
}

/** ProLiquid Telegram assistive signal ingest/scoring cache. */
export async function ensureAlfaclubProliquidSignalSchema(db: Db): Promise<void> {
  await withEnsureOnce('alfaclubProliquidSignal', async () => {
    await ensureMigrationApplied(db, '20260606010000_alfaclub_proliquid_signal_ingest.sql').catch(() => {})
  })
}

/** Room/user Arena identity mapping for per-room and per-user execution overrides. */
export async function ensureAlfaclubArenaIdentityMappingSchema(db: Db): Promise<void> {
  await withEnsureOnce('alfaclubArenaIdentityMapping', async () => {
    await ensureMigrationApplied(db, '20260708000000_alfaclub_arena_identity_mappings.sql').catch(() => {})
  })
}

/** Room-level counter-trade automation schema + ledgers. */
export async function ensureAlfaclubCounterTradeSchema(db: Db): Promise<void> {
  await withEnsureOnce('alfaclubCounterTrade', async () => {
    await ensureMigrationApplied(db, '20260709000000_alfaclub_counter_trade_engine.sql').catch(() => {})
    await ensureMigrationApplied(db, '20260714180000_alfaclub_counter_trade_room_config_overrides.sql').catch(
      () => {},
    )
  })
}

/** Read-only Funding/OI shadow observations and fixed-horizon outcomes. */
export async function ensureAlfaclubFundingOiObservationSchema(db: Db): Promise<void> {
  await withEnsureOnce('alfaclubFundingOiObservation', async () => {
    await ensureMigrationApplied(db, '20260712130000_alfaclub_funding_oi_shadow_observations.sql')
  })
}

/** Continuous Hyperliquid market feature snapshots for honest ΔF/ΔOI. */
export async function ensureAlfaclubMarketFeatureSnapshotSchema(db: Db): Promise<void> {
  await withEnsureOnce('alfaclubMarketFeatureSnapshots', async () => {
    await ensureMigrationApplied(
      db,
      '20260716000000_inv_akita_feature_snapshots.sql',
      async () => {
        const result =
          await db.sql`SELECT to_regclass('alfaclub.market_feature_snapshots') IS NOT NULL AS ok;`
        return Boolean(result.rows?.[0]?.ok)
      },
    )
  })
}

/** InverseAKITA advisory decision ledger + point-in-time outcomes. */
export async function ensureAlfaclubDecisionLedgerSchema(db: Db): Promise<void> {
  await withEnsureOnce('alfaclubDecisionLedger', async () => {
    await ensureMigrationApplied(
      db,
      '20260716010000_inv_akita_decision_ledger.sql',
      async () => {
        const result = await db.sql`
          SELECT
            to_regclass('alfaclub.decision_ledger') IS NOT NULL
            AND to_regclass('alfaclub.decision_outcomes') IS NOT NULL
            AS ok;
        `
        return Boolean(result.rows?.[0]?.ok)
      },
    )
  })
}

/** Durable InverseAKITA source-opinion, decision, and position lifecycle authority. */
export async function ensureAlfaclubInverseOpinionTradeSchema(db: Db): Promise<void> {
  await withEnsureOnce('alfaclubInverseOpinionTrade', async () => {
    await ensureMigrationApplied(
      db,
      '20260717000000_alfaclub_inverse_opinion_trade_lifecycle.sql',
      async () => {
        const result = await db.sql`
          SELECT
            to_regclass('alfaclub.inverse_opinion_source_messages') IS NOT NULL
            AND to_regclass('alfaclub.inverse_opinion_trade_decisions') IS NOT NULL
            AND to_regclass('alfaclub.inverse_position_lifecycles') IS NOT NULL
            AND to_regclass('alfaclub.inverse_position_lifecycle_events') IS NOT NULL
            AND to_regclass('alfaclub.inverse_position_lifecycles_one_open_idx') IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM pg_trigger
              WHERE tgname = 'inverse_opinion_decision_transition_guard'
                AND NOT tgisinternal
            )
            AND EXISTS (
              SELECT 1
              FROM pg_trigger
              WHERE tgname = 'inverse_position_lifecycle_transition_guard'
                AND NOT tgisinternal
            )
            AND NOT EXISTS (
              SELECT 1
              FROM pg_class AS c
              JOIN pg_namespace AS n ON n.oid = c.relnamespace
              WHERE n.nspname = 'alfaclub'
                AND c.relname IN (
                  'inverse_opinion_source_messages',
                  'inverse_opinion_trade_decisions',
                  'inverse_position_lifecycles',
                  'inverse_position_lifecycle_events'
                )
                AND c.relrowsecurity IS NOT TRUE
            )
            AS ok;
        `
        return Boolean(result.rows?.[0]?.ok)
      },
      { strict: true, verifyRecorded: true },
    )
    await ensureMigrationApplied(
      db,
      '20260717030000_alfaclub_inverse_opinion_trade_execution_guards.sql',
      async () => {
        const result = await db.sql`
          SELECT
            to_regclass('alfaclub.inverse_opinion_fill_claims') IS NOT NULL
            AND to_regclass('alfaclub.inverse_opinion_trade_decisions_claim_expiry_idx') IS NOT NULL
            AND to_regclass('alfaclub.inverse_opinion_trade_decisions_recovery_idx') IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'alfaclub'
                AND table_name = 'inverse_opinion_trade_decisions'
                AND column_name = 'execution_claim_token'
            )
            AND EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'alfaclub'
                AND table_name = 'inverse_opinion_trade_decisions'
                AND column_name = 'recovery_deadline_at'
            )
            AND EXISTS (
              SELECT 1
              FROM pg_proc AS p
              JOIN pg_namespace AS n ON n.oid = p.pronamespace
              WHERE n.nspname = 'alfaclub'
                AND p.proname = 'enforce_inverse_opinion_decision_transition'
                AND pg_get_functiondef(p.oid) LIKE '%illegal same-phase inverse opinion decision update%'
            )
            AND EXISTS (
              SELECT 1
              FROM pg_proc AS p
              JOIN pg_namespace AS n ON n.oid = p.pronamespace
              WHERE n.nspname = 'alfaclub'
                AND p.proname = 'enforce_inverse_position_lifecycle_transition'
                AND pg_get_functiondef(p.oid) LIKE '%generation must increment%'
            )
            AND EXISTS (
              SELECT 1
              FROM pg_class AS c
              JOIN pg_namespace AS n ON n.oid = c.relnamespace
              WHERE n.nspname = 'alfaclub'
                AND c.relname = 'inverse_opinion_fill_claims'
                AND c.relrowsecurity IS TRUE
            )
            AS ok;
        `
        return Boolean(result.rows?.[0]?.ok)
      },
      { strict: true, verifyRecorded: true },
    )
    await ensureMigrationApplied(
      db,
      '20260717010000_alfaclub_inverse_opinion_trade_analysis.sql',
      async () => {
        const result = await db.sql`
          SELECT
            to_regclass('alfaclub.inverse_opinion_trade_analyses') IS NOT NULL
            AND to_regclass('alfaclub.inverse_opinion_trade_analyses_lifecycle_time_idx')
              IS NOT NULL
            AND to_regclass('alfaclub.inverse_opinion_trade_analyses_window_idx') IS NOT NULL
            AND (
              SELECT count(*) = 8
              FROM pg_constraint
              WHERE connamespace = 'alfaclub'::regnamespace
                AND conname IN (
                  'inverse_opinion_trade_analysis_window_check',
                  'inverse_opinion_trade_analysis_evidence_object_check',
                  'inverse_opinion_trade_analysis_interpretation_object_check',
                  'inverse_opinion_trade_analysis_verdict_check',
                  'inverse_opinion_trade_analysis_confidence_check',
                  'inverse_opinion_trade_analysis_refs_array_check',
                  'inverse_opinion_trade_analysis_closed_assessment_check',
                  'inverse_opinion_trade_analysis_only_check'
                )
            )
            AND EXISTS (
              SELECT 1
              FROM pg_class AS c
              JOIN pg_namespace AS n ON n.oid = c.relnamespace
              WHERE n.nspname = 'alfaclub'
                AND c.relname = 'inverse_opinion_trade_analyses'
                AND c.relrowsecurity IS TRUE
            )
            AND has_schema_privilege('service_role', 'alfaclub', 'USAGE')
            AND has_table_privilege(
              'service_role',
              'alfaclub.inverse_opinion_trade_analyses',
              'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
            )
            AND NOT has_table_privilege(
              'anon',
              'alfaclub.inverse_opinion_trade_analyses',
              'SELECT, INSERT, UPDATE, DELETE'
            )
            AND NOT has_table_privilege(
              'authenticated',
              'alfaclub.inverse_opinion_trade_analyses',
              'SELECT, INSERT, UPDATE, DELETE'
            )
            AS ok;
        `
        return Boolean(result.rows?.[0]?.ok)
      },
      { strict: true, verifyRecorded: true },
    )
    await ensureMigrationApplied(
      db,
      '20260717020000_alfaclub_inverse_opinion_trade_journal_dispatch.sql',
      async () => {
        const result = await db.sql`
          SELECT
            to_regclass('alfaclub.inverse_opinion_trade_journal_dispatch') IS NOT NULL
            AND to_regclass('alfaclub.inverse_opinion_trade_journal_revision_audit') IS NOT NULL
            AND to_regclass('alfaclub.inverse_journal_dispatch_state_lease_idx') IS NOT NULL
            AND (
              SELECT count(*) = 8
              FROM pg_constraint
              WHERE connamespace = 'alfaclub'::regnamespace
                AND conname IN (
                  'inverse_journal_dispatch_room_check',
                  'inverse_journal_dispatch_window_check',
                  'inverse_journal_dispatch_window_length_check',
                  'inverse_journal_dispatch_state_check',
                  'inverse_journal_dispatch_attempt_check',
                  'inverse_journal_dispatch_revision_check',
                  'inverse_journal_dispatch_content_hash_check',
                  'inverse_journal_dispatch_sent_check'
                )
            )
            AND (
              SELECT count(*) = 6
              FROM pg_constraint
              WHERE connamespace = 'alfaclub'::regnamespace
                AND conname IN (
                  'inverse_journal_revision_number_check',
                  'inverse_journal_revision_operator_check',
                  'inverse_journal_revision_state_check',
                  'inverse_journal_revision_sent_check',
                  'inverse_journal_revision_hash_check',
                  'inverse_journal_revision_marker_check'
                )
            )
            AND NOT EXISTS (
              SELECT 1
              FROM pg_class AS c
              JOIN pg_namespace AS n ON n.oid = c.relnamespace
              WHERE n.nspname = 'alfaclub'
                AND c.relname IN (
                  'inverse_opinion_trade_journal_dispatch',
                  'inverse_opinion_trade_journal_revision_audit'
                )
                AND c.relrowsecurity IS NOT TRUE
            )
            AND has_schema_privilege('service_role', 'alfaclub', 'USAGE')
            AND has_table_privilege(
              'service_role',
              'alfaclub.inverse_opinion_trade_journal_dispatch',
              'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
            )
            AND has_table_privilege(
              'service_role',
              'alfaclub.inverse_opinion_trade_journal_revision_audit',
              'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
            )
            AND NOT has_table_privilege(
              'anon',
              'alfaclub.inverse_opinion_trade_journal_dispatch',
              'SELECT, INSERT, UPDATE, DELETE'
            )
            AND NOT has_table_privilege(
              'authenticated',
              'alfaclub.inverse_opinion_trade_journal_revision_audit',
              'SELECT, INSERT, UPDATE, DELETE'
            )
            AS ok;
        `
        return Boolean(result.rows?.[0]?.ok)
      },
      { strict: true, verifyRecorded: true },
    )
    await ensureMigrationApplied(
      db,
      '20260717040000_alfaclub_inverse_opinion_trade_journal_reliability.sql',
      async () => {
        const result = await db.sql`
          SELECT
            to_regclass('alfaclub.inverse_opinion_trade_journal_deliveries') IS NOT NULL
            AND to_regclass('alfaclub.inverse_opinion_trade_journal_resolution_audit') IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM pg_class AS c
              JOIN pg_namespace AS n ON n.oid = c.relnamespace
              WHERE n.nspname = 'alfaclub'
                AND c.relname = 'inverse_opinion_trade_journal_deliveries'
                AND c.relrowsecurity IS TRUE
            )
            AND EXISTS (
              SELECT 1
              FROM pg_class AS c
              JOIN pg_namespace AS n ON n.oid = c.relnamespace
              WHERE n.nspname = 'alfaclub'
                AND c.relname = 'inverse_opinion_trade_journal_resolution_audit'
                AND c.relrowsecurity IS TRUE
            )
            AS ok;
        `
        return Boolean(result.rows?.[0]?.ok)
      },
      { strict: true, verifyRecorded: true },
    )
    await ensureMigrationApplied(
      db,
      '20260717050000_alfaclub_inverse_opinion_trade_recovery_completion.sql',
      async () => {
        const result = await db.sql`
          SELECT
            to_regclass('alfaclub.inverse_opinion_trade_decisions_submitted_recovery_idx')
              IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'alfaclub'
                AND table_name = 'inverse_opinion_trade_journal_deliveries'
                AND column_name = 'public_text'
                AND character_maximum_length = 2000
            )
            AND EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'alfaclub'
                AND table_name = 'inverse_opinion_trade_journal_revision_audit'
                AND column_name = 'last_error_code'
                AND character_maximum_length = 128
            )
            AS ok;
        `
        return Boolean(result.rows?.[0]?.ok)
      },
      { strict: true, verifyRecorded: true },
    )
    await ensureMigrationApplied(
      db,
      '20260717060000_alfaclub_inverse_opinion_trade_revision_recovery.sql',
      async () => {
        const result = await db.sql`
          SELECT
            to_regclass('alfaclub.inverse_journal_revision_recovery_idx') IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'alfaclub'
                AND table_name = 'inverse_opinion_trade_journal_revision_audit'
                AND column_name = 'public_text'
                AND character_maximum_length = 2000
            )
            AND EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'alfaclub'
                AND table_name = 'inverse_opinion_trade_journal_revision_audit'
                AND column_name = 'claimant_token'
                AND data_type = 'uuid'
            )
            AND EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'alfaclub'
                AND table_name = 'inverse_opinion_trade_journal_revision_audit'
                AND column_name = 'send_started_at'
                AND data_type = 'timestamp with time zone'
            )
            AND (
              SELECT count(*) = 5
              FROM pg_constraint
              WHERE connamespace = 'alfaclub'::regnamespace
                AND conname IN (
                  'inverse_journal_revision_public_text_check',
                  'inverse_journal_revision_recovery_attempt_check',
                  'inverse_journal_revision_requested_recovery_check',
                  'inverse_journal_revision_resolution_operator_check',
                  'inverse_journal_revision_resolution_check'
                )
            )
            AND EXISTS (
              SELECT 1
              FROM pg_trigger
              WHERE tgname = 'inverse_journal_revision_immutable_payload_guard'
                AND NOT tgisinternal
            )
            AS ok;
        `
        return Boolean(result.rows?.[0]?.ok)
      },
      { strict: true, verifyRecorded: true },
    )
    await ensureMigrationApplied(
      db,
      '20260717070000_alfaclub_inverse_opinion_reply_delivery.sql',
      async () => {
        const result = await db.sql`
          SELECT
            to_regclass('alfaclub.inverse_opinion_reply_deliveries') IS NOT NULL
            AND to_regclass('alfaclub.inverse_opinion_reply_delivery_recovery_idx') IS NOT NULL
            AND (
              SELECT count(*) = 7
              FROM pg_constraint
              WHERE connamespace = 'alfaclub'::regnamespace
                AND conname IN (
                  'inverse_opinion_reply_delivery_kind_check',
                  'inverse_opinion_reply_delivery_text_check',
                  'inverse_opinion_reply_delivery_client_id_check',
                  'inverse_opinion_reply_delivery_state_check',
                  'inverse_opinion_reply_delivery_attempt_check',
                  'inverse_opinion_reply_delivery_lease_check',
                  'inverse_opinion_reply_delivery_sent_check'
                )
            )
            AND EXISTS (
              SELECT 1
              FROM pg_trigger
              WHERE tgname = 'inverse_opinion_reply_delivery_payload_guard'
                AND NOT tgisinternal
            )
            AND EXISTS (
              SELECT 1
              FROM pg_class AS c
              JOIN pg_namespace AS n ON n.oid = c.relnamespace
              WHERE n.nspname = 'alfaclub'
                AND c.relname = 'inverse_opinion_reply_deliveries'
                AND c.relrowsecurity IS TRUE
            )
            AND has_table_privilege(
              'service_role',
              'alfaclub.inverse_opinion_reply_deliveries',
              'SELECT, INSERT, UPDATE, DELETE'
            )
            AND NOT has_table_privilege(
              'anon',
              'alfaclub.inverse_opinion_reply_deliveries',
              'SELECT, INSERT, UPDATE, DELETE'
            )
            AND NOT has_table_privilege(
              'authenticated',
              'alfaclub.inverse_opinion_reply_deliveries',
              'SELECT, INSERT, UPDATE, DELETE'
            )
            AS ok;
        `
        return Boolean(result.rows?.[0]?.ok)
      },
      { strict: true, verifyRecorded: true },
    )
    await ensureMigrationApplied(
      db,
      '20260717080000_alfaclub_inverse_opinion_reply_resolution.sql',
      async () => {
        const result = await db.sql`
          SELECT
            to_regclass('alfaclub.inverse_opinion_reply_delivery_resolution_audit') IS NOT NULL
            AND to_regclass(
              'alfaclub.inverse_opinion_reply_delivery_resolution_audit_pkey'
            ) IS NOT NULL
            AND (
              SELECT count(*) = 7
              FROM pg_constraint
              WHERE connamespace = 'alfaclub'::regnamespace
                AND conname IN (
                  'inverse_opinion_reply_delivery_resolution_audit_pkey',
                  'inverse_opinion_reply_resolution_delivery_fk',
                  'inverse_opinion_reply_resolution_operator_check',
                  'inverse_opinion_reply_resolution_kind_check',
                  'inverse_opinion_reply_resolution_action_check',
                  'inverse_opinion_reply_resolution_state_check',
                  'inverse_opinion_reply_resolution_note_check'
                )
            )
            AND EXISTS (
              SELECT 1
              FROM pg_class AS c
              JOIN pg_namespace AS n ON n.oid = c.relnamespace
              WHERE n.nspname = 'alfaclub'
                AND c.relname = 'inverse_opinion_reply_delivery_resolution_audit'
                AND c.relrowsecurity IS TRUE
            )
            AND has_table_privilege(
              'service_role',
              'alfaclub.inverse_opinion_reply_delivery_resolution_audit',
              'SELECT, INSERT'
            )
            AND NOT has_table_privilege(
              'service_role',
              'alfaclub.inverse_opinion_reply_delivery_resolution_audit',
              'UPDATE, DELETE'
            )
            AND NOT has_table_privilege(
              'anon',
              'alfaclub.inverse_opinion_reply_delivery_resolution_audit',
              'SELECT, INSERT, UPDATE, DELETE'
            )
            AND NOT has_table_privilege(
              'authenticated',
              'alfaclub.inverse_opinion_reply_delivery_resolution_audit',
              'SELECT, INSERT, UPDATE, DELETE'
            )
            AS ok;
        `
        return Boolean(result.rows?.[0]?.ok)
      },
      { strict: true, verifyRecorded: true },
    )
  })
}

/** AlfaClub room <-> XMTP group bridge: message-origin loop-prevention ledger. */
export async function ensureAlfaclubRoomXmtpBridgeSchema(db: Db): Promise<void> {
  await withEnsureOnce('alfaclubRoomXmtpBridge', async () => {
    await ensureMigrationApplied(db, '20260708130000_alfaclub_room_xmtp_bridge.sql').catch(() => {})
  })
}

// NOTE (2026-07-13): ensureEthosChartSupportSchema was removed. The entire Ethos chart
// matview layer (20260620000000_unified_ethos_chart_support.sql) was retired by
// 20260713110000_retire_ethos_chart_matview_layer.sql — the matviews had no readers.
// Do NOT re-add a bootstrap hook for that file (or 20260616000000_ethos_15min_snapshots.sql);
// re-applying either from cold start resurrects dropped objects.

/** Solana share-mesh mapping persistence for orchestrator automation. */
export async function ensureSolanaShareMeshMappingsSchema(db: Db): Promise<void> {
  await withEnsureOnce('solanaShareMeshMappings', async () => {
    await ensureMigrationApplied(db, '20260711000000_solana_share_mesh_mappings.sql').catch(() => {})
  })
}

/** Solana Meteora DLMM pool provisioning status for share-mesh launch automation. */
export async function ensureSolanaMeteoraPoolStatusSchema(db: Db): Promise<void> {
  await withEnsureOnce('solanaMeteoraPoolStatus', async () => {
    await ensureMigrationApplied(db, '20260711010000_solana_meteora_pool_status.sql').catch(() => {})
  })
}

/** Solana creator-share-hook (Token-2022 lottery lane) provisioning status. */
export async function ensureSolanaHookStatusSchema(db: Db): Promise<void> {
  await withEnsureOnce('solanaHookStatus', async () => {
    await ensureMigrationApplied(db, '20260713140000_solana_hook_status.sql').catch(() => {})
  })
}

/** Per-creator B2 relay readiness and enablement (orchestrator mint gating). */
export async function ensureSolanaCreatorRelayConfigSchema(db: Db): Promise<void> {
  await withEnsureOnce('solanaCreatorRelayConfig', async () => {
    await ensureMigrationApplied(db, '20260714000000_solana_creator_relay_config.sql').catch(() => {})
  })
}

/** Durable Solana lottery entry inbox + ingest cursor (LZ-era exactly-once). */
export async function ensureSolanaLotteryEntryInboxSchema(db: Db): Promise<void> {
  await withEnsureOnce('solanaLotteryEntryInbox', async () => {
    await ensureMigrationApplied(
      db,
      '20260717090000_solana_lottery_entry_inbox.sql',
      undefined,
      { strict: true },
    )
    await ensureMigrationApplied(
      db,
      '20260717100000_solana_lottery_entry_inbox_attempt_fencing.sql',
      undefined,
      { strict: true },
    )
  })
}

/** Base MCP human-approval requests (durable approval flow store). */
export async function ensureBaseMcpApprovalSchema(db: Db): Promise<void> {
  await withEnsureOnce('baseMcpApproval', async () => {
    await ensureMigrationApplied(db, '20260712000000_base_mcp_approval_requests.sql').catch(() => {})
  })
}

/**
 * Final set of additive columns that were still being applied via raw
 * ALTERs in a handful of bootstrap helpers. One-time migration.
 *
 * The preflight matters operationally: without it, every cold start replayed
 * 17 ALTER TABLE statements, each taking an ACCESS EXCLUSIVE lock on hot
 * tables (creator_coins averaged ~1.9s per call queued behind reads) and
 * invalidating PostgREST's schema cache. Probe the last column added to each
 * touched table instead; if all exist the migration is a guaranteed no-op.
 */
export async function ensureFinalAdditiveColumns(db: Db): Promise<void> {
  await withEnsureOnce('finalAdditiveColumns', async () => {
    await ensureMigrationApplied(db, '20260611000000_final_additive_columns.sql', async () => {
      const result = await db.sql`
        SELECT
          EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'creator_coins'
                    AND column_name = 'sparkline_30d_updated_at')
          AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'creator_metrics_state'
                    AND column_name = 'explore_last_sync_at')
          AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'deploys'
                    AND column_name = 'next_run_after')
          AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'alfaclub_publications'
                    AND column_name = 'last_submission_at')
          AS ok;
      `
      return Boolean(result.rows?.[0]?.ok)
    }).catch(() => {})
  })
}

/**
 * For cases where you only want a very narrow bootstrap (e.g. only the
 * AMOE replay store during a specific ZK path), call the individual
 * ensureMigrationApplied with a tight preflight.
 */
export { readMigration, splitStatements }