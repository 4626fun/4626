import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  ensureCreatorAccessSchema,
  getDb,
  isDbConfigured,
  getSessionAddress,
  isAdminAddress,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'


import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../../server/_lib/db/supabaseAdmin.js'

import { logAdminAction } from '../../../../server/_lib/admin/adminAudit.js'


type DenyBody = {
  requestId: number
  note?: string
}

type DenyResponse = {
  requestId: number
  denied: true
}

const DENY_BODY_MAX_BYTES = 16_384

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }
  const rate = checkRateLimit(
    rateLimitKey('admin-creator-access-deny', admin.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: DENY_BODY_MAX_BYTES }))
  const requestId = typeof body?.requestId === 'number' && Number.isFinite(body.requestId) ? Math.floor(body.requestId) : NaN
  const note = typeof body?.note === 'string' ? body.note.slice(0, 4000) : null
  if (!Number.isFinite(requestId) || requestId <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid requestId' } satisfies ApiEnvelope<never>)
  }

  if (isSupabaseAdminConfigured()) {
    try {
      const supabase = getSupabaseAdmin()
      const now = new Date().toISOString()
      const u = await supabase
        .from('access_requests')
        .update({
          status: 'denied',
          reviewed_at: now,
          reviewed_by: admin,
          decision_note: note,
          updated_at: now,
        })
        .eq('id', requestId)
        .select('id')
        .limit(1)
      if (u.error) throw new Error(u.error.message)
      if (!Array.isArray(u.data) || u.data.length === 0) {
        return res.status(404).json({ success: false, error: 'Request not found' } satisfies ApiEnvelope<never>)
      }

      // Audit log
      const db = isDbConfigured() ? await getDb() : null
      if (db) {
        await logAdminAction({
          db: db as any,
          adminAddress: admin,
          action: 'creator_deny',
          targetType: 'access_request',
          targetId: requestId,
          details: { note },
          ipAddress: getClientIp(req),
        })
      }

      return res.status(200).json({
        success: true,
        data: { requestId, denied: true } satisfies DenyResponse,
      } satisfies ApiEnvelope<DenyResponse>)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Supabase deny failed'
      return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
    }
  }

  const db = isDbConfigured() ? await getDb() : null
  if (!db) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }

  await ensureCreatorAccessSchema()
  if (!db.query) {
    return res.status(500).json({ success: false, error: 'Database driver missing query()' } satisfies ApiEnvelope<never>)
  }

  const u = await db.query(
    `UPDATE access_requests
       SET status = 'denied',
           reviewed_at = NOW(),
           reviewed_by = $1,
           decision_note = $2,
           updated_at = NOW()
     WHERE id = $3
     RETURNING id;`,
    [admin, note, requestId],
  )

  if (u.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Request not found' } satisfies ApiEnvelope<never>)
  }

  // Audit log
  await logAdminAction({
    db: db as any,
    adminAddress: admin,
    action: 'creator_deny',
    targetType: 'access_request',
    targetId: requestId,
    details: { note },
    ipAddress: getClientIp(req),
  })

  return res.status(200).json({
    success: true,
    data: { requestId, denied: true } satisfies DenyResponse,
  } satisfies ApiEnvelope<DenyResponse>)
}
