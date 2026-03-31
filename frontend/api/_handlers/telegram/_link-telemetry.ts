import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'
import { trackTelegramLinkEvent } from '../../../server/_lib/telegramLinkTelemetry.js'
import { checkDurableRateLimit } from '../../../server/_lib/durableRateLimit.js'
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

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
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

  const body = (await readJsonBody<TelegramLinkTelemetryBody>(req).catch(() => null)) ?? (req.body as TelegramLinkTelemetryBody | null) ?? {}
  const event = asTrimmed(body.event)
  if (!event || !event.startsWith('telegram_link_')) {
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
    flowId: asTrimmed(flowId),
    source: asTrimmed(source) || 'telegram-miniapp-client',
    phase: asTrimmed(phase),
    status: asTrimmed(status),
    telegramUserId: asTrimmed(telegramUserId),
    privyUserId: asTrimmed(privyUserId),
    chatId: asTrimmed(chatId),
    payload: payloadRest,
  })

  return res.status(200).json({
    success: true,
    data: { accepted: true },
  } satisfies ApiEnvelope<{ accepted: true }>)
}
