import { getAddress, isAddress } from 'viem'

import { CANONICAL_CSW_ADDRESS, type PolicyAddress } from '@/wallet/canonicalWalletPolicy'

/**
 * XMTP agent inbox address for client surfaces (chat rail, auto-DM, AMOE).
 * Prefer `VITE_AGENT_XMTP_ADDRESS` when set; otherwise the policy canonical CSW.
 */
export function resolveClientAgentXmtpAddress(): PolicyAddress {
  const override = String(import.meta.env.VITE_AGENT_XMTP_ADDRESS ?? '').trim()
  if (override && isAddress(override)) {
    return getAddress(override).toLowerCase() as PolicyAddress
  }
  return CANONICAL_CSW_ADDRESS
}

export function resolveClientAgentXmtpAddressLower(): string {
  return resolveClientAgentXmtpAddress().toLowerCase()
}
