/**
 * Canonical CSW runtime env (`CANONICAL_CSW_*`).
 *
 * One smart wallet address for profiles, XMTP, vault owner, and swap execution.
 * Legacy `XMTP_AGENT_CSW_*` / `XMTP_AGENT_PRIVY_WALLET_ID` aliases were removed —
 * set `CANONICAL_CSW_*` on Railway/Vercel/local env.
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
  return readEnvFirst('CANONICAL_CSW_ADDRESS')
}

/** Chain id where the canonical CSW is deployed (default Base mainnet). */
export function readCanonicalCswChainIdEnv(): number {
  const raw = readEnvFirst('CANONICAL_CSW_CHAIN_ID')
  return Number(raw || '8453') || 8453
}

/** Optional MultiOwnable owner-index hint for the server Privy signer. */
export function readCanonicalCswOwnerIndexEnv(): string {
  return readEnvFirst('CANONICAL_CSW_OWNER_INDEX')
}

/** Privy server wallet id that signs UserOps / XMTP for the canonical CSW. */
export function readCanonicalCswPrivyWalletIdEnv(): string {
  return readEnvFirst('CANONICAL_CSW_PRIVY_WALLET_ID')
}

/**
 * When true, honor a configured address that differs from `CANONICAL_CSW_ADDRESS`.
 * Emergency escape hatch only — business identity still uses the policy constant.
 */
export function readCanonicalCswSkipEnforcementEnv(): boolean {
  return readEnvFlag('CANONICAL_CSW_SKIP_ENFORCEMENT')
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
  const configured = readCanonicalCswAddressEnv()
  if (isAddressLike(configured)) return configured.toLowerCase() as `0x${string}`
  return CANONICAL_CSW_ADDRESS.toLowerCase() as `0x${string}`
}
