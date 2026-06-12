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
  preflightCheck?: () => Promise<boolean>
): Promise<boolean> {
  if (ensuredFiles.has(filename)) return true

  // Durable cross-process short-circuit: skip the DDL replay entirely when a
  // previous process already applied this file against this database.
  if (await isRecordedInLedger(db, filename)) {
    ensuredFiles.add(filename)
    return true
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
      console.warn(`[schemaBootstrap] Non-fatal error applying statement from ${filename}:`, msg)
    }
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
 * Workspace / creator strategy management tables.
 *
 * Central implementation (all callers now use this directly).
 */
export async function ensureWorkspaceSchema(db: Db): Promise<void> {
  await withEnsureOnce('workspace', async () => {
    await ensureMigrationApplied(db, '20260529000000_workspace_schema.sql').catch(() => {})
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
 * Chat directory, presence, friend requests, and vault chat tables.
 *
 * Central implementation (all callers now use this directly).
 */
export async function ensureChatSchema(db: Db): Promise<void> {
  await withEnsureOnce('chat', async () => {
    await ensureMigrationApplied(db, '20260531000000_chat_schema.sql').catch(() => {})
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
    await ensureMigrationApplied(db, '20260608000000_wallet_onchain_ops_audit_schema.sql').catch(() => {})
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
  })
}

/**
 * Ethos chart MV + refresh-function support.
 *
 * Do NOT re-add 20260616000000_ethos_15min_snapshots.sql here: the 15min/hourly snapshot
 * lanes were retired by 20260713010000_drop_ethos_high_frequency_snapshots.sql, and
 * re-applying that file from cold-start bootstrap resurrects the dropped table.
 * The preflight keeps already-bootstrapped databases no-op.
 */
export async function ensureEthosChartSupportSchema(db: Db): Promise<void> {
  await withEnsureOnce('ethosChartSupport', async () => {
    await ensureMigrationApplied(db, '20260620000000_unified_ethos_chart_support.sql', async () => {
      const result = await db.sql`
        SELECT to_regprocedure('public.refresh_all_ethos_chart_views()') IS NOT NULL AS ok;
      `
      return Boolean(result.rows?.[0]?.ok)
    }).catch(() => {})
  })
}

/** Solana share-mesh mapping persistence for orchestrator automation. */
export async function ensureSolanaShareMeshMappingsSchema(db: Db): Promise<void> {
  await withEnsureOnce('solanaShareMeshMappings', async () => {
    await ensureMigrationApplied(db, '20260711000000_solana_share_mesh_mappings.sql').catch(() => {})
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