import { getDb, isDbConfigured } from "../db/postgres.js"

// M-31 (4626-340) / L-11 (4626-359): The CRE runtime tables
//   (cre_runtime_records, cre_runtime_decisions, cre_runtime_replay_nonces)
// are now defined by Supabase migrations under supabase/migrations/.
// This helper previously issued CREATE TABLE IF NOT EXISTS DDL at
// application boot, which caused schema drift across environments and
// made the schema invisible to migration tooling.
//
// The function is retained as a presence check so callers can verify
// the expected tables exist before using them. A missing table is
// surfaced via the returned boolean and via a logged warning; it is
// never auto-healed with DDL from application code.

let runtimeSchemaVerified = false
let loggedMissingSchemaWarning = false

const REQUIRED_TABLES = [
  "cre_runtime_records",
  "cre_runtime_decisions",
  "cre_runtime_replay_nonces",
] as const

export async function ensureCreRuntimeSchema(): Promise<boolean> {
  if (!isDbConfigured()) return false
  if (runtimeSchemaVerified) return true

  const db = await getDb()
  if (!db) return false

  try {
    for (const tableName of REQUIRED_TABLES) {
      const result = await db.sql`
        SELECT to_regclass(${`public.${tableName}`}) IS NOT NULL AS exists;
      `
      const exists = Boolean(result.rows?.[0]?.exists)
      if (!exists) {
        if (!loggedMissingSchemaWarning) {
          loggedMissingSchemaWarning = true
          // eslint-disable-next-line no-console
          console.warn(
            `[cre_runtime_schema] missing table "${tableName}". Run Supabase migrations (supabase/migrations/*_cre_runtime_and_agent_rate_limits_schema.sql).`,
          )
        }
        return false
      }
    }
    runtimeSchemaVerified = true
    return true
  } catch (error) {
    runtimeSchemaVerified = false
    // Do not re-throw: callers treat a false return as "skip DB path".
    // eslint-disable-next-line no-console
    console.warn("[cre_runtime_schema] verification query failed", { error })
    return false
  }
}
