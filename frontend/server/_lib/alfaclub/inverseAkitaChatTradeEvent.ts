/**
 * Deterministic parser for AlfaClub Chip / `trade-completed` system chat payloads.
 *
 * UI label is often "Chip"; the websocket sender is usually `trade-completed`
 * (empty username). Directional HL opens become InverseAKITA fades once we
 * attribute a wallet: payload address → recent human speaker → room creator.
 */

import type { CounterTradeSide } from './counterTradeConfig.js'

export type InverseAkitaChatTradeEventParse = {
  userSide: CounterTradeSide
  pair: string
  /** Wallet from payload when present. */
  userAddress: string | null
  direction: 'open' | 'close'
  source: 'hl_market' | 'hl_fill_dir'
}

const CHIP_SYSTEM_SENDERS = new Set([
  'trade-completed',
  'chip',
  'chipbot',
  'alfaclub-chip',
])

function normalizeHexAddress(value: unknown): string | null {
  const address = String(value ?? '')
    .trim()
    .toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(address) ? address : null
}

function normalizePair(raw: unknown): string | null {
  const pair = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
  if (!pair) return null
  if (!/^[A-Z0-9]+(?::[A-Z0-9]+)?$/.test(pair)) return null
  return pair
}

function parseVerificationEnvelope(raw: unknown): {
  direction: 'open' | 'close' | null
  reduceOnly: boolean
} {
  if (!raw || typeof raw !== 'object') {
    return { direction: null, reduceOnly: false }
  }
  const text = String((raw as { text?: unknown }).text ?? '').trim()
  if (!text.startsWith('{')) {
    return { direction: null, reduceOnly: false }
  }
  try {
    const parsed = JSON.parse(text) as {
      direction?: unknown
      order?: { reduceOnly?: unknown }
    }
    const directionRaw = String(parsed.direction ?? '')
      .trim()
      .toLowerCase()
    const direction =
      directionRaw === 'open' || directionRaw === 'close' ? directionRaw : null
    const reduceOnly = parsed.order?.reduceOnly === true
    return { direction, reduceOnly }
  } catch {
    return { direction: null, reduceOnly: false }
  }
}

function parseFillDir(raw: unknown): {
  action: 'open' | 'close' | null
  side: CounterTradeSide | null
} {
  const dir = String(raw ?? '')
    .trim()
    .toLowerCase()
  const match = /^(open|close)\s+(long|short)$/.exec(dir)
  if (!match) return { action: null, side: null }
  return {
    action: match[1] as 'open' | 'close',
    side: match[2] as CounterTradeSide,
  }
}

/**
 * Parse a chat text blob into a directional trade lean, or null when the
 * payload is not an actionable open signal (TP/SL fills, position snapshots,
 * token calls, spot memecoins, malformed JSON, etc.).
 */
export function parseInverseAkitaChatTradeEvent(
  text: string,
): InverseAkitaChatTradeEventParse | null {
  const trimmed = String(text ?? '').trim()
  if (!trimmed.startsWith('{')) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return null
  }

  if (String(parsed.type ?? '') === 'spot-trade-completed') {
    // Spot memecoins are not InverseAKITA HL perps — skip.
    return null
  }

  // Compact HL fill cards: {"coin":"BTC","dir":"Open Long",...}
  if (parsed.dir != null && parsed.coin != null && parsed.order_type == null) {
    const pair = normalizePair(parsed.coin)
    const { action, side } = parseFillDir(parsed.dir)
    if (!pair || action !== 'open' || !side) return null
    return {
      userSide: side,
      pair,
      userAddress: normalizeHexAddress(parsed.userAddress ?? parsed.user),
      direction: 'open',
      source: 'hl_fill_dir',
    }
  }

  if (String(parsed.order_type ?? '') !== 'market') {
    return null
  }

  // Position-snapshot companion posts share the oid — skip so we only act once
  // on the size-bearing open/close message.
  if (parsed.position != null) {
    return null
  }

  const pair = normalizePair(parsed.asset)
  if (!pair) return null

  const { direction, reduceOnly } = parseVerificationEnvelope(parsed.verificationDetails)
  if (reduceOnly) return null
  // Chat fades only on fresh opens for now (closes are noisy / often TP-SL).
  if (direction !== 'open') return null

  if (typeof parsed.isBuy !== 'boolean') return null

  const userSide: CounterTradeSide = parsed.isBuy ? 'long' : 'short'

  return {
    userSide,
    pair,
    userAddress: normalizeHexAddress(parsed.userAddress ?? parsed.user),
    direction,
    source: 'hl_market',
  }
}

/** True for AlfaClub Chip / trade-completed system senders (not a wallet). */
export function isAlfaClubTradeCompletedSender(sender: string | null | undefined): boolean {
  const normalized = String(sender ?? '')
    .trim()
    .toLowerCase()
  return CHIP_SYSTEM_SENDERS.has(normalized)
}

export function isAlfaClubChipUsername(username: string | null | undefined): boolean {
  const normalized = String(username ?? '')
    .trim()
    .toLowerCase()
  return normalized === 'chip' || normalized === 'chipbot'
}

/** True when the chat row is an AlfaClub Chip / trade-completed system card. */
export function isAlfaClubChipSystemMessage(params: {
  sender?: string | null
  username?: string | null
}): boolean {
  return (
    isAlfaClubTradeCompletedSender(params.sender) || isAlfaClubChipUsername(params.username)
  )
}

/**
 * Attribute a Chip trade to a wallet for stake gating:
 * 1) payload userAddress
 * 2) most recent human hex speaker at/before the trade (any staker can trade)
 * 3) room creator fallback
 */
export function resolveInverseAkitaTradeEventAuthor(params: {
  payloadAddress?: string | null
  roomCreatorAddress?: string | null
  messageDate: number
  excludeAddresses?: readonly string[]
  priorSpeakers: ReadonlyArray<{ sender?: string | null; date?: number | null }>
}): string | null {
  const fromPayload = normalizeHexAddress(params.payloadAddress)
  if (fromPayload) return fromPayload

  const excluded = new Set(
    (params.excludeAddresses ?? [])
      .map((value) => normalizeHexAddress(value))
      .filter((value): value is string => Boolean(value)),
  )
  const messageDate = Number(params.messageDate)
  const dated = Number.isFinite(messageDate) ? messageDate : Number.POSITIVE_INFINITY

  const candidates = params.priorSpeakers
    .map((entry) => ({
      sender: normalizeHexAddress(entry.sender),
      date: Number(entry.date),
    }))
    .filter(
      (entry): entry is { sender: string; date: number } =>
        Boolean(entry.sender) && Number.isFinite(entry.date) && entry.date <= dated,
    )
    .sort((a, b) => b.date - a.date)

  for (const candidate of candidates) {
    if (excluded.has(candidate.sender)) continue
    return candidate.sender
  }

  return normalizeHexAddress(params.roomCreatorAddress)
}
