import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { trackTelegramLinkEvent } from '../../../server/_lib/telegramLinkTelemetry.js'

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
