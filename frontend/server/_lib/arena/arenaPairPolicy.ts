import type { ArenaConfig } from './arenaConfig.js'
import type { ArenaPairValidationResult } from './arenaTypes.js'

const PLAIN_PAIR_RE = /^[A-Z0-9]{2,20}$/
const HIP3_PAIR_RE = /^xyz:[A-Z0-9]{2,20}$/

function normalizeHip3Pair(input: string): string {
  const [prefix, symbol] = input.split(':')
  return `${prefix.toLowerCase()}:${(symbol ?? '').toUpperCase()}`
}

function normalizePair(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (trimmed.includes(':')) return normalizeHip3Pair(trimmed)
  return trimmed.toUpperCase()
}

export function validateArenaPair(pairInput: string, config: ArenaConfig): ArenaPairValidationResult {
  const normalizedPair = normalizePair(pairInput)
  if (!normalizedPair) {
    return {
      ok: false,
      reason: 'empty_pair',
      message: 'Pair is required (e.g. BTC or xyz:GOLD).',
    }
  }

  // HIP-3 pairs are required to be xyz: prefixed.
  if (normalizedPair.includes(':') && !normalizedPair.startsWith('xyz:')) {
    return {
      ok: false,
      reason: 'hip3_prefix_required',
      message: 'HIP-3 pairs must use the xyz: prefix (example: xyz:GOLD).',
    }
  }

  if (normalizedPair.startsWith('xyz:')) {
    if (config.hip3PrefixRequired && !HIP3_PAIR_RE.test(normalizedPair)) {
      return {
        ok: false,
        reason: 'invalid_pair_format',
        message: 'Invalid HIP-3 pair format. Use xyz:<SYMBOL> with alphanumeric symbol.',
      }
    }
    if (config.assetAllowlist && !config.assetAllowlist.has(normalizedPair.toUpperCase())) {
      return {
        ok: false,
        reason: 'asset_not_allowlisted',
        message: `Pair ${normalizedPair} is not allowed by ARENA_ASSET_ALLOWLIST.`,
      }
    }
    return { ok: true, normalizedPair, market: 'hip3' }
  }

  if (!PLAIN_PAIR_RE.test(normalizedPair)) {
    return {
      ok: false,
      reason: 'invalid_pair_format',
      message: 'Invalid perp pair format. Use alphanumeric symbol (example: BTC).',
    }
  }

  if (config.assetAllowlist && !config.assetAllowlist.has(normalizedPair.toUpperCase())) {
    return {
      ok: false,
      reason: 'asset_not_allowlisted',
      message: `Pair ${normalizedPair} is not allowed by ARENA_ASSET_ALLOWLIST.`,
    }
  }
  return { ok: true, normalizedPair, market: 'crypto' }
}

/** Normalize a coin symbol for allowlist membership checks. */
export function normalizeAllowlistKey(symbol: string): string {
  const trimmed = symbol.trim()
  if (!trimmed) return ''
  if (trimmed.includes(':')) {
    const [prefix, sym] = trimmed.split(':')
    return `${prefix.toLowerCase()}:${sym.toUpperCase()}`
  }
  return trimmed.toUpperCase()
}

/** When allowlist is null/empty, all coins pass. */
export function isAssetAllowlisted(coin: string, allowlist: Set<string> | null | undefined): boolean {
  if (!allowlist || allowlist.size === 0) return true
  const key = normalizeAllowlistKey(coin)
  return allowlist.has(key) || allowlist.has(key.toUpperCase())
}
