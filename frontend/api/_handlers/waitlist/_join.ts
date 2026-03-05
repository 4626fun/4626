import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

type JoinWaitlistBody = { email?: string }
type JoinWaitlistResponse = { ok: true; waitlistEntryId: number }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(value: unknown): string | null {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<JoinWaitlistBody>(req).catch(() => null)) ?? (req.body as JoinWaitlistBody | null) ?? {}
  const email = normalizeEmail(body?.email)
  if (!email) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  await ensureWaitlistSchema(db as any)

  const result = await db.sql`
    INSERT INTO profiles (email, created_at, updated_at)
    VALUES (${email}, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE
      SET updated_at = NOW()
    RETURNING id;
  `
  const idRaw = result.rows?.[0]?.id
  const waitlistEntryId = typeof idRaw === 'number' ? idRaw : Number(idRaw)
  if (!Number.isFinite(waitlistEntryId) || waitlistEntryId <= 0) {
    return res.status(500).json({ success: false, error: 'Failed to create waitlist entry' } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: { ok: true, waitlistEntryId } satisfies JoinWaitlistResponse,
  } satisfies ApiEnvelope<JoinWaitlistResponse>)
}

