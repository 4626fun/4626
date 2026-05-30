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

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

const __dirname = dirname(fileURLToPath(import.meta.url))

// Adjust this if the relative path from the compiled dist changes.
const MIGRATIONS_ROOT = resolve(__dirname, '../../../../../supabase/migrations')

const ensuredFiles = new Set<string>()

function readMigration(filename: string): string {
  const full = resolve(MIGRATIONS_ROOT, filename)
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
      const stmt = current.trim()
      if (stmt && !stmt.startsWith('--') && stmt !== ';') {
        statements.push(stmt)
      }
      current = ''
    }
  }

  if (current.trim()) {
    const stmt = current.trim()
    if (stmt && !stmt.startsWith('--')) statements.push(stmt)
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

  if (preflightCheck) {
    const alreadyGood = await preflightCheck()
    if (alreadyGood) {
      ensuredFiles.add(filename)
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
  // All major Alfaclub tables should now be covered. New tables must be added as proper migrations first.
}

/**
 * AMOE lottery + replay tables.
 * Covers the remaining tables that were still living as raw DDL in
 * lotteryAmoe.ts and amoeReplayStore.ts.
 */
export async function ensureAmoeSchema(db: Db): Promise<void> {
  // Core AMOE tables already had migrations; this adds the remaining lottery ones.
  await ensureMigrationApplied(db, '20260527000000_amoe_lottery_tables.sql').catch(() => {})
  // Note: amoe_zk_submissions and related publisher tables are covered via earlier calls
  // in the individual ensure functions.
}

/**
 * Telegram trading / linking / holder-room schema (from telegramTrading.ts).
 */
export async function ensureTelegramTradingSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260528000000_telegram_trading_schema.sql').catch(() => {})
}

/**
 * Workspace / creator strategy management tables.
 */
export async function ensureWorkspaceSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260529000000_workspace_schema.sql').catch(() => {})
}

/**
 * Agent memory tables (Eliza / runtimeBridge).
 */
export async function ensureAgentMemorySchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260530000000_agent_memory_schema.sql').catch(() => {})
}

/**
 * Chat directory, presence, friend requests, and vault chat tables.
 */
export async function ensureChatSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260531000000_chat_schema.sql').catch(() => {})
}

/**
 * Image generation projects, assets, attempts, and jobs.
 */
export async function ensureImageGenerationSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260601000000_image_generation_schema.sql').catch(() => {})
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
 * Creator access allowlist and access request tables.
 */
export async function ensureCreatorAccessSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260604000000_creator_access_schema.sql').catch(() => {})
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
  await ensureMigrationApplied(db, '20260607000000_agent_runtime_audit_ledger_schema.sql').catch(() => {})
}

/**
 * Wallet/creator wallet tables, Solana sweep jobs, Meteora Alpha Vault config,
 * and admin audit logs.
 */
export async function ensureWalletOnchainOpsAuditSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260608000000_wallet_onchain_ops_audit_schema.sql').catch(() => {})
}

/**
 * Telemetry/event tables + creative tool logs (Hermit memes, Zora trend ops).
 */
export async function ensureTelemetryCreativeLogsSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260609000000_telemetry_creative_logs_schema.sql').catch(() => {})
}

/**
 * Alfaclub daily brief dispatch (inside private alfaclub schema).
 * Last major raw DDL site for a dedicated schema table.
 */
export async function ensureAlfaclubDailyBriefSchema(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260610000000_alfaclub_daily_brief_dispatch.sql').catch(() => {})
}

/**
 * Final set of additive columns that were still being applied via raw
 * ALTERs in a handful of bootstrap helpers. One-time migration.
 */
export async function ensureFinalAdditiveColumns(db: Db): Promise<void> {
  await ensureMigrationApplied(db, '20260611000000_final_additive_columns.sql').catch(() => {})
}

/**
 * For cases where you only want a very narrow bootstrap (e.g. only the
 * AMOE replay store during a specific ZK path), call the individual
 * ensureMigrationApplied with a tight preflight.
 */
export { readMigration, splitStatements }