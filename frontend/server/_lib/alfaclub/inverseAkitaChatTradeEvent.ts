/**
 * Deterministic parser for AlfaClub `trade-completed` system chat payloads.
 *
 * These posts use sender=`trade-completed` (not a wallet). Directional HL market
 * opens are treated as the author's lean so InverseAKITA can fade them once a
 * wallet is attributed (payload userAddress, or room creator fallback).
 */

import type { CounterTradeSide } from './counterTradeConfig.js'

export type InverseAkitaChatTradeEventParse = {
  userSide: CounterTradeSide
  pair: string
  /** Wallet from payload when present (spot fills). */
  userAddress: string | null
  direction: 'open' | 'close'
  source: 'hl_market' | 'spot_completed'
}

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

/**
 * Parse a chat text blob into a directional trade lean, or null when the
 * payload is not an actionable open/close signal (TP/SL fills, position
 * snapshots, token calls, malformed JSON, etc.).
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
    userAddress: normalizeHexAddress(parsed.userAddress),
    direction,
    source: 'hl_market',
  }
}

export function isAlfaClubTradeCompletedSender(sender: string | null | undefined): boolean {
  return String(sender ?? '')
    .trim()
    .toLowerCase() === 'trade-completed'
}
