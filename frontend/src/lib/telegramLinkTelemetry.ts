import { apiFetch } from './apiBase'
import { logger } from './logger'

type TelegramLinkTelemetryEventInput = {
  event: string
  flowId?: string | null
  source?: string | null
  phase?: string | null
  status?: string | null
  telegramUserId?: string | null
  privyUserId?: string | null
  chatId?: string | null
  [key: string]: unknown
}

function asTrimmed(value: unknown, maxLength = 256): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

export function createTelegramLinkFlowId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `tg-link-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function trackTelegramLinkTelemetryEvent(input: TelegramLinkTelemetryEventInput): void {
  const event = asTrimmed(input.event, 128)
  if (!event) return

  const body = {
    ...input,
    event,
    flowId: asTrimmed(input.flowId, 128),
    source: asTrimmed(input.source, 64) ?? 'telegram-miniapp-client',
    phase: asTrimmed(input.phase, 64),
    status: asTrimmed(input.status, 64),
    telegramUserId: asTrimmed(input.telegramUserId, 128),
    privyUserId: asTrimmed(input.privyUserId, 128),
    chatId: asTrimmed(input.chatId, 128),
  }

  if (import.meta.env.DEV) {
    logger.info('[TelegramLink] telemetry', body)
  }

  void apiFetch('/api/telegram/link/telemetry', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).catch(() => {
    // Telemetry must never block or disrupt the linking flow.
  })
}
