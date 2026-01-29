import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { getDb, isDbConfigured } from '../../../../server/_lib/postgres.js'
import { getSessionAddress, isAdminAddress } from '../../../../server/_lib/session.js'
import { ensureWaitlistSchema } from '../../../../server/_lib/waitlistSchema.js'

type Body = { id?: number; note?: string | null }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  if (!isAdminAddress(admin)) return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)

  const body = (await readJsonBody<Body>(req)) ?? {}
  const id = typeof body.id === 'number' ? Math.floor(body.id) : NaN
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, error: 'Missing id' } satisfies ApiEnvelope<never>)
  }
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null

  const db = isDbConfigured() ? await getDb() : null
  if (!db) return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)
  if (!db.query) return res.status(500).json({ success: false, error: 'Database driver missing query()' } satisfies ApiEnvelope<never>)

  const q = await db.query(
    `UPDATE profiles
     SET app_access_status = 'approved',
         app_access_decision_note = $2,
         app_access_decided_at = NOW(),
         app_access_decided_by = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id;`,
    [id, note, admin],
  )
  if (!q.rows || q.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Signup not found' } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({ success: true, data: { id, status: 'approved' } } satisfies ApiEnvelope<any>)
}

