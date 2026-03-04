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
        ip_hash TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    // Backfill/migrate older tables that were created without newer columns.
    // `IF NOT EXISTS` is supported on modern Postgres versions; if it throws, we ignore.
    try {
      await db.sql`ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS ip_hash TEXT NULL;`
    } catch {
      // ignore (older Postgres or restricted perms)
    }
    schemaEnsured = true
  } catch {
    schemaEnsured = false
  }
}

export type AdminAction = 
  | 'waitlist_approve'
  | 'waitlist_deny'
  | 'waitlist_delete'
  | 'creator_approve'
  | 'creator_deny'
  | 'creator_revoke'
  | 'creator_restore'
  | 'note_update'

/**
 * Hash an IP address for privacy-preserving audit logging.
 * One-way hash - can detect same IP but can't reverse to original.
 */
function hashIp(ip: string | undefined): string | null {
  if (!ip) return null
  // Simple hash - enough for detecting patterns, not reversible
  let hash = 0x811c9dc5
  for (let i = 0; i < ip.length; i++) {
    hash ^= ip.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

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
    // Store hashed IP only - privacy preserving, still useful for detecting patterns
    const ipHash = hashIp(ipAddress)
    await db.sql`
      INSERT INTO admin_logs (admin_address, action, target_type, target_id, details, ip_hash)
      VALUES (
        ${adminAddress.toLowerCase()},
        ${action},
        ${targetType},
        ${String(targetId)},
        ${details ? JSON.stringify(details) : null},
        ${ipHash}
      );
    `
  } catch (err) {
    // Audit logging should not break the main flow
    console.warn('admin_audit: failed to log action', { action, targetType, targetId, err })
  }
}
