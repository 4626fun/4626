import { AKITA_DEFAULTS } from '../../../src/config/contracts.defaults.js'

declare const process: { env: Record<string, string | undefined> }

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export type AmoeCreatorTargetResolution =
  | { ok: true; creatorCoin: `0x${string}`; source: 'request' | 'protocol-default' }
  | { ok: false; error: 'invalid_creator_coin' | 'amoe_default_creator_coin_not_configured' }

function normalizeAddress(value: string | null | undefined): `0x${string}` | null {
  const trimmed = String(value ?? '').trim()
  if (!ADDRESS_RE.test(trimmed)) return null
  return trimmed.toLowerCase() as `0x${string}`
}

export function readProtocolAmoeCreatorCoin(): `0x${string}` | null {
  return (
    normalizeAddress(process.env.LOTTERY_AMOE_PROTOCOL_CREATOR_COIN) ??
    normalizeAddress(process.env.LOTTERY_AMOE_DEFAULT_CREATOR_COIN) ??
    normalizeAddress(AKITA_DEFAULTS.token)
  )
}

export function resolveAmoeCreatorTarget(value: unknown): AmoeCreatorTargetResolution {
  if (typeof value === 'string' && value.trim().length > 0) {
    const creatorCoin = normalizeAddress(value)
    if (!creatorCoin) return { ok: false, error: 'invalid_creator_coin' }
    return { ok: true, creatorCoin, source: 'request' }
  }

  const creatorCoin = readProtocolAmoeCreatorCoin()
  if (!creatorCoin) return { ok: false, error: 'amoe_default_creator_coin_not_configured' }
  return { ok: true, creatorCoin, source: 'protocol-default' }
}
