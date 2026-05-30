import { getDb, isDbConfigured } from '../db/postgres.js'
import { ensureChatSchema } from '../db/schemaBootstrap.js'

let chatSchemaEnsured = false

export async function ensureChatSchema(): Promise<void> {
  if (!isDbConfigured() || chatSchemaEnsured) return
  const db = await getDb()
  if (!db) return

  // Condensed path — all chat tables now live in the authoritative migration.
  await ensureChatSchema(db)

  // Legacy raw blocks below are transitional and will be removed in follow-up.
  // All definitions now live in supabase/migrations/20260531000000_chat_schema.sql.

  chatSchemaEnsured = true
}
