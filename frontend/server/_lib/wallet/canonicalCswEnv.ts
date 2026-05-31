/**
 * Canonical CSW runtime env (`CANONICAL_CSW_*`).
 *
 * One smart wallet address for profiles, XMTP, vault owner, and swap execution.
 * Prefer `CANONICAL_CSW_*` in all new config; legacy `XMTP_AGENT_CSW_*` keys are
 * read as fallbacks only until Railway/Vercel env is migrated.
 */

import { CANONICAL_CSW_ADDRESS } from '../../../src/wallet/canonicalWalletPolicy.js'

function readEnvFirst(...keys: readonly string[]): string {
  for (const key of keys) {
    const value = (process.env[key] ?? '').trim()
    if (value) return value
  }
  return ''
}

function readEnvFlag(...keys: readonly string[]): boolean {
  return /^(1|true|yes)$/i.test(readEnvFirst(...keys))
}

/** On-chain canonical parent CSW address (XMTP inbox, vault owner, swap sender). */
export function readCanonicalCswAddressEnv(): string {
  return readEnvFirst('CANONICAL_CSW_ADDRESS', 'XMTP_AGENT_CSW_ADDRESS')
}

/** Chain id where the canonical CSW is deployed (default Base mainnet). */
export function readCanonicalCswChainIdEnv(): number {
  const raw = readEnvFirst('CANONICAL_CSW_CHAIN_ID', 'XMTP_AGENT_CSW_CHAIN_ID')
  return Number(raw || '8453') || 8453
}

/** Optional MultiOwnable owner-index hint for the server Privy signer. */
export function readCanonicalCswOwnerIndexEnv(): string {
  return readEnvFirst('CANONICAL_CSW_OWNER_INDEX', 'XMTP_AGENT_CSW_OWNER_INDEX')
}

/** Privy server wallet id that signs UserOps / XMTP for the canonical CSW. */
export function readCanonicalCswPrivyWalletIdEnv(): string {
  return readEnvFirst('CANONICAL_CSW_PRIVY_WALLET_ID', 'XMTP_AGENT_PRIVY_WALLET_ID')
}

/**
 * When true, honor a configured address that differs from `CANONICAL_CSW_ADDRESS`.
 * Emergency escape hatch only — business identity still uses the policy constant.
 */
export function readCanonicalCswSkipEnforcementEnv(): boolean {
  return readEnvFlag('CANONICAL_CSW_SKIP_ENFORCEMENT', 'XMTP_AGENT_CSW_SKIP_CANONICAL')
}

export function hasCanonicalCswRuntimeConfig(): boolean {
  return Boolean(readCanonicalCswAddressEnv() && readCanonicalCswPrivyWalletIdEnv())
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

/**
 * Public XMTP agent inbox / agent-directory address for server handlers.
 * Mirrors client `resolveClientAgentXmtpAddress()` precedence.
 */
export function resolveServerAgentInboxAddress(): `0x${string}` {
  const candidates = [
    readCanonicalCswAddressEnv(),
    (process.env.XMTP_AGENT_ADDRESS ?? '').trim(),
    (process.env.VITE_AGENT_XMTP_ADDRESS ?? '').trim(),
    CANONICAL_CSW_ADDRESS,
  ]
  for (const raw of candidates) {
    if (isAddressLike(raw)) return raw.toLowerCase() as `0x${string}`
  }
  return CANONICAL_CSW_ADDRESS.toLowerCase() as `0x${string}`
}
