import { ensureWalletOnchainOpsAuditSchema } from '../db/schemaBootstrap.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let creatorWalletsEnsured = false

export async function ensureCreatorWalletsSchema(db: Db): Promise<void> {
  if (creatorWalletsEnsured) return
  try {
    await ensureWalletOnchainOpsAuditSchema(db as any)
    creatorWalletsEnsured = true
  } catch (err) {
    // Don't permanently lock out future attempts if a migration fails transiently.
    creatorWalletsEnsured = false
    throw err
  }
}

