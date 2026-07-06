import { getAddress, type Address } from 'viem'

/**
 * Canonical hot keeper / Ajna automation EOA for 4626 Base mainnet.
 *
 * Single key lane: `KPR_PRIVATE_KEY` (+ optional explicit pins below).
 * Retired: separate `4626_KEEPER_AUTOMATION_*` / `0xed401e…` (never activated on-chain).
 */
export const CANONICAL_KEEPER_AUTOMATION_EOA =
  '0xed7efe34d25a0b219de1b25ac99eb35e48cc1379' as const satisfies Address

/** Shell-safe alias (bash cannot `export 4626_*`). */
export const KEEPER_AUTOMATION_PUBLIC_KEY_ENV_SHELL = 'KEEPER_AUTOMATION_PUBLIC_KEY' as const

/** Shell-safe alias for the automation signer private key. */
export const KEEPER_AUTOMATION_PRIVATE_KEY_ENV_SHELL = 'KEEPER_AUTOMATION_PRIVATE_KEY' as const

/** Vercel-compatible legacy public key env (numeric prefix — avoid in shell `.env`). */
export const KEEPER_AUTOMATION_PUBLIC_KEY_ENV_LEGACY = '4626_KEEPER_AUTOMATION_PUBLIC_KEY' as const

/** Vercel-compatible legacy private key env. */
export const KEEPER_AUTOMATION_PRIVATE_KEY_ENV_LEGACY = '4626_KEEPER_AUTOMATION_PRIVATE_KEY' as const

/** Explicit Ajna keeper override — preferred pin in local `.env` files. */
export const PROTOCOL_AJNA_KEEPER_ENV = 'PROTOCOL_AJNA_KEEPER' as const

/** Explicit payout-router keeper override. */
export const PAYOUT_ROUTER_KEEPER_ENV = 'PAYOUT_ROUTER_KEEPER' as const

/** Primary server signing key for keeper + automation fallback chain. */
export const KPR_PRIVATE_KEY_ENV = 'KPR_PRIVATE_KEY' as const

export function normalizeKeeperAutomationEoa(value: string | null | undefined): Address | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  try {
    return getAddress(raw)
  } catch {
    return null
  }
}

export function isCanonicalKeeperAutomationEoa(value: string | null | undefined): boolean {
  const normalized = normalizeKeeperAutomationEoa(value)
  return normalized?.toLowerCase() === CANONICAL_KEEPER_AUTOMATION_EOA
}
