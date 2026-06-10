import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
  trackChatCommandCenterEvent,
} from '@4626/server-core'

type TelemetryBody = {
  event?: string
  conversationId?: string | null
  conversationType?: string | null
  commandId?: string | null
  source?: string | null
  [key: string]: unknown
}

const TELEMETRY_EVENT_MAX_LENGTH = 96
const TELEMETRY_ID_MAX_LENGTH = 128
const TELEMETRY_FIELD_MAX_LENGTH = 64
const TELEMETRY_PAYLOAD_MAX_KEYS = 40
const TELEMETRY_PAYLOAD_MAX_DEPTH = 4
const TELEMETRY_PAYLOAD_MAX_ARRAY_ITEMS = 20
const TELEMETRY_PAYLOAD_MAX_STRING_LENGTH = 512
const TELEMETRY_EVENT_RE = /^[a-z0-9_:.-]+$/i

function asBoundedTrimmed(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function sanitizePayloadValue(value: unknown, depth: number): unknown {
  if (value == null) return null
  if (typeof value === 'string') {
    return value.length > TELEMETRY_PAYLOAD_MAX_STRING_LENGTH
      ? value.slice(0, TELEMETRY_PAYLOAD_MAX_STRING_LENGTH)
      : value
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  if (typeof value !== 'object') return undefined
  if (depth >= TELEMETRY_PAYLOAD_MAX_DEPTH) return '[max-depth]'

  if (Array.isArray(value)) {
    return value
      .slice(0, TELEMETRY_PAYLOAD_MAX_ARRAY_ITEMS)
      .map((entry) => sanitizePayloadValue(entry, depth + 1))
      .filter((entry) => entry !== undefined)
  }

  const out: Record<string, unknown> = {}
  const source = value as Record<string, unknown>
  let count = 0
  for (const [rawKey, rawValue] of Object.entries(source)) {
    if (count >= TELEMETRY_PAYLOAD_MAX_KEYS) break
    const key = asBoundedTrimmed(rawKey, TELEMETRY_FIELD_MAX_LENGTH)
    if (!key || key === '__proto__' || key === 'prototype' || key === 'constructor') continue
    const sanitized = sanitizePayloadValue(rawValue, depth + 1)
    if (sanitized === undefined) continue
    out[key] = sanitized
    count += 1
  }
  return out
}

function sanitizeTelemetryPayload(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizePayloadValue(value, 0)
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return {}
  return sanitized as Record<string, unknown>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('v1-chat-telemetry', getClientIp(req)),
    RATE_LIMITS.chatTelemetry,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const rawBody = await readBoundedJsonObjectBody(req, { maxBytes: 65_536 })
  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
    ? (rawBody as TelemetryBody)
    : {}
  const event = asBoundedTrimmed(body.event, TELEMETRY_EVENT_MAX_LENGTH)
  if (!event || !TELEMETRY_EVENT_RE.test(event)) {
    return res.status(400).json({ success: false, error: 'Missing event' } satisfies ApiEnvelope<never>)
  }

  const {
    event: _event,
    conversationId,
    conversationType,
    commandId,
    source,
    ...payloadRest
  } = body ?? {}

  void trackChatCommandCenterEvent({
    event,
    conversationId: asBoundedTrimmed(conversationId, TELEMETRY_ID_MAX_LENGTH),
    conversationType: asBoundedTrimmed(conversationType, TELEMETRY_FIELD_MAX_LENGTH),
    commandId: asBoundedTrimmed(commandId, TELEMETRY_ID_MAX_LENGTH),
    source: asBoundedTrimmed(source, TELEMETRY_FIELD_MAX_LENGTH),
    payload: sanitizeTelemetryPayload(payloadRest),
  })

  return res.status(200).json({
    success: true,
    data: { accepted: true },
  } satisfies ApiEnvelope<{ accepted: true }>)
}
