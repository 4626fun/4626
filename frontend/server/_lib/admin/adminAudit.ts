/**
 * Admin audit logging for sensitive actions.
 */

import { createHmac, randomBytes } from 'node:crypto'
import { ensureWalletOnchainOpsAuditSchema } from '../db/schemaBootstrap.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let schemaEnsured = false

export async function ensureAdminAuditSchema(db: Db): Promise<void> {
  if (schemaEnsured) return
  try {
    await ensureWalletOnchainOpsAuditSchema(db as any)
    schemaEnsured = true
  } catch {
    schemaEnsured = false
  }
}

export type AdminAction =
  | 'waitlist_approve'
  | 'waitlist_deny'
  | 'waitlist_delete'
  | 'waitlist_regenerate_points_dry_run'
  | 'waitlist_regenerate_points_execute'
  | 'profile_merge_dry_run'
  | 'profile_merge_execute'
  | 'creator_approve'
  | 'creator_deny'
  | 'creator_revoke'
  | 'creator_restore'
  | 'note_update'

/**
 * Hash an IP address for privacy-preserving audit logging.
 *
 * L-10 (4626-358): the previous implementation used FNV-1a truncated to
 * 32 bits, which (a) has ~4B output space vs ~4B IPv4 space making
 * collisions nearly guaranteed for any non-trivial log, and (b) is
 * trivially reversible — a dictionary of 2^32 IPs can be precomputed
 * in minutes. Replace with HMAC-SHA256 keyed by ADMIN_IP_HASH_SALT,
 * truncated to 16 hex chars (64 bits) which is enough to detect
 * same-IP patterns while keeping the output space large enough to
 * avoid routine collisions (expected ~2^-32 for 65k distinct IPs).
 *
 * Without a configured salt we use a process-lifetime random salt so
 * pseudonyms are unlinkable across deployments; a warning logs the
 * misconfiguration in production.
 */
let cachedIpHashSalt: string | null = null
let loggedIpHashSaltWarning = false

function getIpHashSalt(): string {
  if (cachedIpHashSalt !== null) return cachedIpHashSalt
  const configured = String(process.env.ADMIN_IP_HASH_SALT ?? '').trim()
  if (configured.length >= 16) {
    cachedIpHashSalt = configured
    return cachedIpHashSalt
  }
  const isProduction = String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production'
  if (isProduction && !loggedIpHashSaltWarning) {
    loggedIpHashSaltWarning = true
    console.warn(
      '[admin_audit] ADMIN_IP_HASH_SALT is missing or <16 chars in production; '
        + 'falling back to a process-lifetime random salt. IP hashes will not be '
        + 'stable across restarts. Set ADMIN_IP_HASH_SALT to a stable high-entropy '
        + 'value to restore same-IP detection across deploys.',
    )
  }
  cachedIpHashSalt = randomBytes(32).toString('hex')
  return cachedIpHashSalt
}

function hashIp(ip: string | undefined): string | null {
  if (!ip) return null
  const normalized = ip.trim()
  if (!normalized) return null
  return createHmac('sha256', getIpHashSalt()).update(normalized).digest('hex').slice(0, 16)
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
