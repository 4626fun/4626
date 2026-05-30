import { getDb, isDbConfigured } from '../db/postgres.js'
import { ensureWorkspaceSchema as ensureWorkspaceSchemaFromBootstrap } from '../db/schemaBootstrap.js'

let workspaceSchemaEnsured = false

export async function ensureWorkspaceSchema(): Promise<void> {
  if (!isDbConfigured()) return
  if (workspaceSchemaEnsured) return

  const db = await getDb()
  if (!db) return

  try {
    // Condensed path — all workspace tables now live in the authoritative migration.
    await ensureWorkspaceSchemaFromBootstrap(db)

    workspaceSchemaEnsured = true
  } catch (error) {
    workspaceSchemaEnsured = false
    throw error
  }
}
