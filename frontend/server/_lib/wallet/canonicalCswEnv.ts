/**
 * Canonical + protocol CSW runtime env.
 *
 * - `PROTOCOL_CSW_*` — 4626 agent / XMTP / ERC-8004 / Railway Keepr sender.
 * - `CANONICAL_CSW_*` — operator account CSW (personal custody, AMOE, swaps).
 *
 * Legacy `XMTP_AGENT_CSW_*` aliases were removed — set `PROTOCOL_CSW_*` and
 * `CANONICAL_CSW_*` on Railway/Vercel/local env.
 */

import {
  CANONICAL_CSW_ADDRESS,
  PROTOCOL_CSW_ADDRESS,
} from '../../../src/wallet/canonicalWalletPolicy.js'

/** Hard-cutover env aliases — code no longer reads these; ops must migrate to CANONICAL_CSW_*. */
export const RETIRED_CANONICAL_CSW_ENV_KEYS = [
  'XMTP_AGENT_CSW_ADDRESS',
  'XMTP_AGENT_CSW_CHAIN_ID',
  'XMTP_AGENT_CSW_OWNER_INDEX',
  'XMTP_AGENT_PRIVY_WALLET_ID',
  'XMTP_AGENT_CSW_SKIP_CANONICAL',
  'XMTP_AGENT_ADDRESS',
  'VITE_AGENT_XMTP_ADDRESS',
] as const

export type RetiredCanonicalCswEnvKey = (typeof RETIRED_CANONICAL_CSW_ENV_KEYS)[number]

/** Non-empty retired env vars still present in the process environment (ops drift signal). */
export function listRetiredCanonicalCswEnvKeys(): RetiredCanonicalCswEnvKey[] {
  return RETIRED_CANONICAL_CSW_ENV_KEYS.filter((key) => Boolean((process.env[key] ?? '').trim()))
}

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

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

/** Operator account CSW (`profiles.csw_address` for the admin account). */
export function readCanonicalCswAddressEnv(): string {
  return readEnvFirst('CANONICAL_CSW_ADDRESS')
}

/** 4626 protocol agent CSW (XMTP inbox, ERC-8004 agent wallet, Railway sender). */
export function readProtocolCswAddressEnv(): string {
  return readEnvFirst('PROTOCOL_CSW_ADDRESS')
}

/** Chain id where the protocol CSW is deployed (default Base mainnet). */
export function readProtocolCswChainIdEnv(): number {
  const raw = readEnvFirst('PROTOCOL_CSW_CHAIN_ID', 'CANONICAL_CSW_CHAIN_ID')
  return Number(raw || '8453') || 8453
}

/** Optional MultiOwnable owner-index hint for the server Privy signer on the protocol CSW. */
export function readProtocolCswOwnerIndexEnv(): string {
  return readEnvFirst('PROTOCOL_CSW_OWNER_INDEX')
}

/** Privy server wallet id that signs UserOps / XMTP for the protocol CSW. */
export function readProtocolCswPrivyWalletIdEnv(): string {
  return readEnvFirst('PROTOCOL_CSW_PRIVY_WALLET_ID', 'CANONICAL_CSW_PRIVY_WALLET_ID')
}

/** Chain id where the canonical CSW is deployed (default Base mainnet). */
export function readCanonicalCswChainIdEnv(): number {
  const raw = readEnvFirst('CANONICAL_CSW_CHAIN_ID')
  return Number(raw || '8453') || 8453
}

/** Optional MultiOwnable owner-index hint for the server Privy signer on the operator CSW. */
export function readCanonicalCswOwnerIndexEnv(): string {
  return readEnvFirst('CANONICAL_CSW_OWNER_INDEX')
}

/** Privy server wallet id that signs UserOps for the operator canonical CSW. */
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

export function hasProtocolCswRuntimeConfig(): boolean {
  return Boolean(readProtocolCswPrivyWalletIdEnv())
}

/**
 * Protocol agent CSW for Railway XMTP / ERC-8004 UserOps.
 * Prefers `PROTOCOL_CSW_ADDRESS` env, then policy constant.
 */
export function resolveServerAgentCswAddress(): `0x${string}` {
  const protocol = readProtocolCswAddressEnv()
  if (isAddressLike(protocol)) return protocol.toLowerCase() as `0x${string}`
  return PROTOCOL_CSW_ADDRESS.toLowerCase() as `0x${string}`
}

/**
 * Public XMTP agent inbox / agent-directory address for server handlers.
 * Mirrors client `resolveClientAgentXmtpAddress()` precedence.
 */
export function resolveServerAgentInboxAddress(): `0x${string}` {
  return resolveServerAgentCswAddress()
}
