import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getClientIp,
  rateLimitKey,
  trackTelegramLinkEvent,
} from '@4626/server-core'
import { checkDurableRateLimit } from '../../../server/_lib/infra/durableRateLimit.js'
import { verifyTelegramLinkApiSecret } from './webhook/services/access.js'

type TelegramLinkTelemetryBody = {
  event?: string
  flowId?: string | null
  source?: string | null
  phase?: string | null
  status?: string | null
  telegramUserId?: string | null
  privyUserId?: string | null
  chatId?: string | null
  [key: string]: unknown
}
const TELEGRAM_LINK_TELEMETRY_MAX_BODY_BYTES = 65_536

const TELEMETRY_EVENT_PREFIX = 'telegram_link_'
const TELEMETRY_EVENT_MAX_LENGTH = 96
const TELEMETRY_ID_MAX_LENGTH = 128
const TELEMETRY_FIELD_MAX_LENGTH = 64
const TELEMETRY_PAYLOAD_MAX_KEYS = 40
const TELEMETRY_PAYLOAD_MAX_DEPTH = 4
const TELEMETRY_PAYLOAD_MAX_ARRAY_ITEMS = 20
const TELEMETRY_PAYLOAD_MAX_STRING_LENGTH = 512

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asBoundedTrimmed(value: unknown, maxLength: number): string {
  const trimmed = asTrimmed(value)
  if (!trimmed) return ''
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function sanitizePayloadValue(value: unknown, depth: number): unknown {
  if (value == null) return null
  if (typeof value === 'string') {
    return value.length > TELEMETRY_PAYLOAD_MAX_STRING_LENGTH
      ? value.slice(0, TELEMETRY_PAYLOAD_MAX_STRING_LENGTH)
      : value
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
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
  if (!verifyTelegramLinkApiSecret(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized telemetry request' } satisfies ApiEnvelope<never>)
  }
  const clientIp = getClientIp(req as any) || 'unknown'
  const rate = await checkDurableRateLimit(rateLimitKey('telegram-link-telemetry', clientIp), {
    windowMs: 60_000,
    maxRequests: 60,
  })
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  let body: TelegramLinkTelemetryBody
  try {
    body = (await readBoundedJsonObjectBody<TelegramLinkTelemetryBody>(req, {
      maxBytes: TELEGRAM_LINK_TELEMETRY_MAX_BODY_BYTES,
    })) ?? {}
  } catch {
    return res.status(413).json({ success: false, error: 'Request body too large' } satisfies ApiEnvelope<never>)
  }
  const event = asBoundedTrimmed(body.event, TELEMETRY_EVENT_MAX_LENGTH)
  if (!event || !event.startsWith(TELEMETRY_EVENT_PREFIX)) {
    return res.status(400).json({ success: false, error: 'Missing or invalid event' } satisfies ApiEnvelope<never>)
  }

  const {
    event: _event,
    flowId,
    source,
    phase,
    status,
    telegramUserId,
    privyUserId,
    chatId,
    ...payloadRest
  } = body

  await trackTelegramLinkEvent({
    event,
    flowId: asBoundedTrimmed(flowId, TELEMETRY_ID_MAX_LENGTH),
    source: asBoundedTrimmed(source, TELEMETRY_FIELD_MAX_LENGTH) || 'telegram-miniapp-client',
    phase: asBoundedTrimmed(phase, TELEMETRY_FIELD_MAX_LENGTH),
    status: asBoundedTrimmed(status, TELEMETRY_FIELD_MAX_LENGTH),
    telegramUserId: asBoundedTrimmed(telegramUserId, TELEMETRY_ID_MAX_LENGTH),
    privyUserId: asBoundedTrimmed(privyUserId, TELEMETRY_ID_MAX_LENGTH),
    chatId: asBoundedTrimmed(chatId, TELEMETRY_ID_MAX_LENGTH),
    payload: sanitizeTelemetryPayload(payloadRest),
  })

  return res.status(200).json({
    success: true,
    data: { accepted: true },
  } satisfies ApiEnvelope<{ accepted: true }>)
}
