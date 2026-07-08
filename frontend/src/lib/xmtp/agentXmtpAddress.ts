import { getAddress, isAddress } from 'viem'

import { PROTOCOL_CSW_ADDRESS, type PolicyAddress } from '@/wallet/canonicalWalletPolicy'

/**
 * XMTP agent inbox address for client surfaces (chat rail, auto-DM, AMOE publisher peer).
 * Optional `VITE_PROTOCOL_CSW_ADDRESS` override; otherwise the protocol policy constant.
 */
export function resolveClientAgentXmtpAddress(): PolicyAddress {
  const protocolOverride = String(import.meta.env.VITE_PROTOCOL_CSW_ADDRESS ?? '').trim()
  if (protocolOverride && isAddress(protocolOverride)) {
    return getAddress(protocolOverride).toLowerCase() as PolicyAddress
  }
  const legacyOverride = String(import.meta.env.VITE_CANONICAL_CSW_ADDRESS ?? '').trim()
  if (legacyOverride && isAddress(legacyOverride)) {
    return getAddress(legacyOverride).toLowerCase() as PolicyAddress
  }
  return PROTOCOL_CSW_ADDRESS
}

export function resolveClientAgentXmtpAddressLower(): string {
  return resolveClientAgentXmtpAddress().toLowerCase()
}
