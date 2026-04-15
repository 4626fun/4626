import { apiFetch } from '@/lib/api/apiBase'
import { logger } from '@/lib/observability/logger'

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

const TELEGRAM_LINK_TELEMETRY_DEDUPE_WINDOW_MS = 750
const recentTelemetryByPayload = new Map<string, number>()

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

function getTelemetryPayloadKey(body: Record<string, unknown>): string {
  try {
    return JSON.stringify(body)
  } catch {
    return `${body.event ?? 'unknown'}:${body.flowId ?? 'none'}:${body.phase ?? 'none'}:${body.status ?? 'none'}`
  }
}

function shouldSkipDuplicateTelemetry(body: Record<string, unknown>): boolean {
  const now = Date.now()
  for (const [key, seenAt] of recentTelemetryByPayload) {
    if (now - seenAt > TELEGRAM_LINK_TELEMETRY_DEDUPE_WINDOW_MS) {
      recentTelemetryByPayload.delete(key)
    }
  }

  const payloadKey = getTelemetryPayloadKey(body)
  const lastSeenAt = recentTelemetryByPayload.get(payloadKey)
  if (typeof lastSeenAt === 'number' && now - lastSeenAt <= TELEGRAM_LINK_TELEMETRY_DEDUPE_WINDOW_MS) {
    return true
  }

  recentTelemetryByPayload.set(payloadKey, now)
  return false
}

export function resetTelegramLinkTelemetryDeduper(): void {
  recentTelemetryByPayload.clear()
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

  if (shouldSkipDuplicateTelemetry(body)) return

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
