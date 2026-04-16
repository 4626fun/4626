import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  isDbConfigured,
  getSessionAddress,
  isAdminAddress,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'



import { ensureWaitlistSchema } from '../../../../server/_lib/onboarding/waitlistSchema.js'
import { logAdminAction } from '../../../../server/_lib/admin/adminAudit.js'


type Body = { id?: number; note?: string | null }

const WAITLIST_DELETE_BODY_MAX_BYTES = 16_384

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

/**
 * DELETE a waitlist profile by id.
 *
 * Use this to remove duplicate/orphan profiles (e.g. synthetic-email profiles
 * created by the auth bridge that were superseded by a real signup).
 *
 * Admin-only. Permanently deletes the row and any associated referral data.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  if (!isAdminAddress(admin)) return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  const rate = checkRateLimit(
    rateLimitKey('admin-waitlist-delete', admin.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: WAITLIST_DELETE_BODY_MAX_BYTES })) as Body
  const id = typeof body.id === 'number' ? Math.floor(body.id) : NaN
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, error: 'Missing id' } satisfies ApiEnvelope<never>)
  }
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null

  const db = isDbConfigured() ? await getDb() : null
  if (!db) return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)
  if (!db.query) return res.status(500).json({ success: false, error: 'Database driver missing query()' } satisfies ApiEnvelope<never>)

  // Fetch the profile first so we can log what was deleted.
  const existing = await db.query(
    `SELECT id, email, primary_wallet, privy_user_id FROM profiles WHERE id = $1;`,
    [id],
  )
  if (!existing.rows || existing.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Profile not found' } satisfies ApiEnvelope<never>)
  }
  const profile = existing.rows[0] as { id: number; email: string; primary_wallet: string | null; privy_user_id: string | null }

  // Delete associated referral conversions first (FK safety).
  try {
    await db.query(`DELETE FROM referral_conversions WHERE invitee_signup_id = $1 OR referrer_signup_id = $1;`, [id])
  } catch {
    // Table may not exist or no rows — ignore.
  }

  // Delete associated points ledger entries from the unified points table.
  try {
    await db.query(`DELETE FROM points WHERE signup_id = $1;`, [id])
  } catch {
    // Table may not exist — ignore.
  }

  // Delete the profile.
  const deleted = await db.query(`DELETE FROM profiles WHERE id = $1 RETURNING id;`, [id])
  if (!deleted.rows || deleted.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Profile not found' } satisfies ApiEnvelope<never>)
  }

  // Audit log
  await logAdminAction({
    db: db as any,
    adminAddress: admin,
    action: 'waitlist_delete',
    targetType: 'profile',
    targetId: id,
    details: {
      note,
      deletedEmail: profile.email,
      deletedWallet: profile.primary_wallet,
      deletedPrivyUserId: profile.privy_user_id,
    },
    ipAddress: getClientIp(req),
  })

  return res.status(200).json({ success: true, data: { id, deleted: true } } satisfies ApiEnvelope<any>)
}
