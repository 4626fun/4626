import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  getDb,
  handleOptions,
  rateLimitKey,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '@4626/server-core'

const BODY_MAX_BYTES = 16_384
const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{1,80}$/

type EventBody = {
  event_name?: unknown
  session_id?: unknown
  visitor_id?: unknown
  path?: unknown
  referrer?: unknown
  utm_source?: unknown
  utm_medium?: unknown
  utm_campaign?: unknown
  utm_content?: unknown
  utm_term?: unknown
  props?: unknown
}

function toStringOrNull(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

function normalizeProps(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const output: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string') output[key] = raw.slice(0, 512)
    else if (typeof raw === 'number' || typeof raw === 'boolean' || raw === null) output[key] = raw
  }
  return output
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = await checkDurableRateLimit(rateLimitKey('analytics:event', getClientIp(req)), RATE_LIMITS.general, { failClosed: true })
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = await readBoundedJsonObjectBody<EventBody>(req, { maxBytes: BODY_MAX_BYTES }).catch(() => null)
  if (!body) {
    return res.status(400).json({ success: false, error: 'Invalid request body' } satisfies ApiEnvelope<never>)
  }

  const eventName = toStringOrNull(body.event_name, 80)
  const path = toStringOrNull(body.path, 512)
  if (!eventName || !EVENT_NAME_PATTERN.test(eventName) || !path) {
    return res.status(400).json({ success: false, error: 'Valid event_name and path are required' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    await db.sql`
      INSERT INTO public.website_events (
        event_name,
        session_id,
        visitor_id,
        path,
        referrer,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        props
      )
      VALUES (
        ${eventName},
        ${toStringOrNull(body.session_id, 128)},
        ${toStringOrNull(body.visitor_id, 128)},
        ${path},
        ${toStringOrNull(body.referrer, 1024)},
        ${toStringOrNull(body.utm_source, 128)},
        ${toStringOrNull(body.utm_medium, 128)},
        ${toStringOrNull(body.utm_campaign, 128)},
        ${toStringOrNull(body.utm_content, 128)},
        ${toStringOrNull(body.utm_term, 128)},
        ${JSON.stringify(normalizeProps(body.props))}::jsonb
      );
    `
    return res.status(200).json({ success: true, data: { ok: true } } satisfies ApiEnvelope<{ ok: true }>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'website_event_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
