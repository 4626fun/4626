import { getAddress, isAddress } from 'viem'

import { CANONICAL_CSW_ADDRESS, type PolicyAddress } from '@/wallet/canonicalWalletPolicy'

/**
 * XMTP agent inbox address for client surfaces (chat rail, auto-DM, AMOE).
 * Optional `VITE_CANONICAL_CSW_ADDRESS` override; otherwise the policy constant.
 */
export function resolveClientAgentXmtpAddress(): PolicyAddress {
  const override = String(import.meta.env.VITE_CANONICAL_CSW_ADDRESS ?? '').trim()
  if (override && isAddress(override)) {
    return getAddress(override).toLowerCase() as PolicyAddress
  }
  return CANONICAL_CSW_ADDRESS
}

export function resolveClientAgentXmtpAddressLower(): string {
  return resolveClientAgentXmtpAddress().toLowerCase()
}
