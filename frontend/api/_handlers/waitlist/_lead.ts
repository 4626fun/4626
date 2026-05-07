import crypto from 'node:crypto'

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  getDb,
  handleOptions,
  rateLimitKey,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '../../../packages/server-core/src/index.js'

const BODY_MAX_BYTES = 16_384
const VALID_ROLES = new Set(['creator', 'builder', 'depositor', 'partner', 'other'])

type LeadBody = {
  email?: unknown
  role?: unknown
  xHandle?: unknown
  x_handle?: unknown
  website?: unknown
  utm_source?: unknown
  utm_medium?: unknown
  utm_campaign?: unknown
  utm_content?: unknown
  utm_term?: unknown
  referrer?: unknown
  visitor_id?: unknown
  session_id?: unknown
  first_touch?: unknown
}

type LeadResponse = {
  id: string
  status: 'new' | 'updated'
}

function toStringOrNull(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

function normalizeEmail(value: unknown): string | null {
  const email = toStringOrNull(value, 254)?.toLowerCase() ?? null
  if (!email) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

function normalizeRole(value: unknown): string | null {
  const role = toStringOrNull(value, 32)?.toLowerCase() ?? null
  return role && VALID_ROLES.has(role) ? role : null
}

function normalizeXHandle(value: unknown): string | null {
  const raw = toStringOrNull(value, 64)
  if (!raw) return null
  return raw.replace(/^@+/, '').slice(0, 32) || null
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const output: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string') output[key] = raw.slice(0, 512)
    else if (typeof raw === 'number' || typeof raw === 'boolean' || raw === null) output[key] = raw
  }
  return output
}

function hashIp(value: string): string | null {
  const normalized = value.trim()
  if (!normalized) return null
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

function readCountry(req: VercelRequest): string | null {
  const raw = req.headers['x-vercel-ip-country']
  const value = Array.isArray(raw) ? raw[0] : raw
  return toStringOrNull(value, 2)?.toUpperCase() ?? null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(rateLimitKey('waitlist:lead', getClientIp(req)), RATE_LIMITS.general)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = await readBoundedJsonObjectBody<LeadBody>(req, { maxBytes: BODY_MAX_BYTES }).catch(() => null)
  if (!body) {
    return res.status(400).json({ success: false, error: 'Invalid request body' } satisfies ApiEnvelope<never>)
  }

  if (toStringOrNull(body.website, 256)) {
    return res.status(200).json({
      success: true,
      data: { id: 'honeypot', status: 'new' },
    } satisfies ApiEnvelope<LeadResponse>)
  }

  const email = normalizeEmail(body.email)
  const role = normalizeRole(body.role)
  if (!email || !role) {
    return res.status(400).json({ success: false, error: 'Valid email and role are required' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    const result = await db.sql`
      INSERT INTO public.waitlist_leads (
        email,
        role,
        x_handle,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        referrer,
        first_touch,
        visitor_id,
        session_id,
        ip_country,
        ip_hash
      )
      VALUES (
        ${email},
        ${role},
        ${normalizeXHandle(body.xHandle ?? body.x_handle)},
        ${toStringOrNull(body.utm_source, 128)},
        ${toStringOrNull(body.utm_medium, 128)},
        ${toStringOrNull(body.utm_campaign, 128)},
        ${toStringOrNull(body.utm_content, 128)},
        ${toStringOrNull(body.utm_term, 128)},
        ${toStringOrNull(body.referrer, 1024)},
        ${JSON.stringify(normalizeJsonObject(body.first_touch))}::jsonb,
        ${toStringOrNull(body.visitor_id, 128)},
        ${toStringOrNull(body.session_id, 128)},
        ${readCountry(req)},
        ${hashIp(getClientIp(req))}
      )
      ON CONFLICT (email)
      DO UPDATE SET
        role = EXCLUDED.role,
        x_handle = COALESCE(EXCLUDED.x_handle, public.waitlist_leads.x_handle),
        utm_source = COALESCE(public.waitlist_leads.utm_source, EXCLUDED.utm_source),
        utm_medium = COALESCE(public.waitlist_leads.utm_medium, EXCLUDED.utm_medium),
        utm_campaign = COALESCE(public.waitlist_leads.utm_campaign, EXCLUDED.utm_campaign),
        utm_content = COALESCE(public.waitlist_leads.utm_content, EXCLUDED.utm_content),
        utm_term = COALESCE(public.waitlist_leads.utm_term, EXCLUDED.utm_term),
        referrer = COALESCE(public.waitlist_leads.referrer, EXCLUDED.referrer),
        first_touch = CASE
          WHEN public.waitlist_leads.first_touch = '{}'::jsonb THEN EXCLUDED.first_touch
          ELSE public.waitlist_leads.first_touch
        END,
        visitor_id = COALESCE(public.waitlist_leads.visitor_id, EXCLUDED.visitor_id),
        session_id = COALESCE(EXCLUDED.session_id, public.waitlist_leads.session_id),
        ip_country = COALESCE(public.waitlist_leads.ip_country, EXCLUDED.ip_country),
        ip_hash = COALESCE(public.waitlist_leads.ip_hash, EXCLUDED.ip_hash),
        updated_at = NOW()
      RETURNING id, (xmax = 0) AS inserted;
    `

    const row = result.rows?.[0] ?? {}
    return res.status(200).json({
      success: true,
      data: {
        id: String(row.id ?? ''),
        status: row.inserted ? 'new' : 'updated',
      } satisfies LeadResponse,
    } satisfies ApiEnvelope<LeadResponse>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'waitlist_lead_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
