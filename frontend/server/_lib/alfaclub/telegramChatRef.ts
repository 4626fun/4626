/**
 * Parse Telegram chat / forum-topic references from env or operator input.
 */

function normalizeEnvScalar(raw: string | undefined): string {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  const first = value[0]
  const last = value[value.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1).trim()
  }
  return value
}

function parseOptionalPositiveInt(value: string | undefined, max: number): number | null {
  const raw = normalizeEnvScalar(value)
  if (!/^\d+$/.test(raw)) return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(n, max)
}

export function parseTelegramChatRef(value: string | null): {
  chatId: string | null
  inferredThreadId: number | null
} {
  const raw = String(value ?? '').trim()
  if (!raw) return { chatId: null, inferredThreadId: null }

  const privateRoomUrlMatch = /^https?:\/\/t\.me\/c\/(\d+)(?:\/(\d+))?\/?$/i.exec(raw)
  if (privateRoomUrlMatch) {
    const roomDigits = privateRoomUrlMatch[1]
    return {
      chatId: `-100${roomDigits}`,
      inferredThreadId: parseOptionalPositiveInt(privateRoomUrlMatch[2], 2_000_000_000),
    }
  }

  const publicChatUrlMatch = /^https?:\/\/t\.me\/([A-Za-z0-9_]{5,})(?:\/(\d+))?\/?$/i.exec(raw)
  if (publicChatUrlMatch) {
    const handle = publicChatUrlMatch[1]
    return {
      chatId: `@${handle}`,
      inferredThreadId: parseOptionalPositiveInt(publicChatUrlMatch[2], 2_000_000_000),
    }
  }

  return { chatId: raw, inferredThreadId: null }
}

export function normalizeTelegramChatIdForMatch(chatId: string): string {
  return String(chatId ?? '').trim()
}

/**
 * Telegram → AlfaClub relay posts often prefix the payload (`@user: /alfa …`).
 * The chat bridge only treats lines that start with `/` as slash commands.
 */
export function extractTelegramRelayCommandText(rawText: string): string {
  const trimmed = String(rawText ?? '').trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('/')) {
    const firstLine = trimmed.split('\n', 1)[0]?.trim() ?? trimmed
    return firstLine
  }
  const relayMatch = /^(?:\[[^\]]+\]\s+)?(?:@[\w]+|tg:\d+):\s+(\S[\s\S]*)$/i.exec(trimmed)
  if (relayMatch?.[1]) {
    const inner = relayMatch[1].trim()
    const firstLine = inner.split('\n', 1)[0]?.trim() ?? inner
    if (firstLine.startsWith('/')) return firstLine
  }
  return trimmed
}
