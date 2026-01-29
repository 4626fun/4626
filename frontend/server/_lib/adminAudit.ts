/**
 * Admin audit logging for sensitive actions.
 */

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let schemaEnsured = false

export async function ensureAdminAuditSchema(db: Db): Promise<void> {
  if (schemaEnsured) return
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id BIGSERIAL PRIMARY KEY,
        admin_address TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        details JSONB NULL,
        ip_address TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`CREATE INDEX IF NOT EXISTS admin_logs_admin_idx ON admin_logs (admin_address, created_at DESC);`
    await db.sql`CREATE INDEX IF NOT EXISTS admin_logs_action_idx ON admin_logs (action, created_at DESC);`
    await db.sql`CREATE INDEX IF NOT EXISTS admin_logs_target_idx ON admin_logs (target_type, target_id);`
    schemaEnsured = true
  } catch {
    schemaEnsured = false
  }
}

export type AdminAction = 
  | 'waitlist_approve'
  | 'waitlist_deny'
  | 'creator_approve'
  | 'creator_deny'
  | 'creator_revoke'
  | 'creator_restore'
  | 'note_update'

export async function logAdminAction(params: {
  db: Db
  adminAddress: string
  action: AdminAction
  targetType: 'profile' | 'access_request' | 'allowlist'
  targetId: string | number
  details?: Record<string, any>
  ipAddress?: string
}): Promise<void> {
  const { db, adminAddress, action, targetType, targetId, details, ipAddress } = params
  
  try {
    await ensureAdminAuditSchema(db)
    await db.sql`
      INSERT INTO admin_logs (admin_address, action, target_type, target_id, details, ip_address)
      VALUES (
        ${adminAddress.toLowerCase()},
        ${action},
        ${targetType},
        ${String(targetId)},
        ${details ? JSON.stringify(details) : null},
        ${ipAddress || null}
      );
    `
  } catch (err) {
    // Audit logging should not break the main flow
    console.warn('admin_audit: failed to log action', { action, targetType, targetId, err })
  }
}
