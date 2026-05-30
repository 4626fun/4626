import { getAddress, isAddress } from 'viem'

export type PolicyAddress = `0x${string}`

// Canonical CSW migrated on 2026-04-23 from 0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef
// to the address below. Rationale: the prior canonical address was created via
// an unknown device/account (passkey at idx 0 + two nonce-0 EVM owners that
// have never signed anything). None of the previously-listed "allowed owner
// EOA" addresses were ever actually on-chain owners of the old canonical —
// the policy was aspirational. The address below is the CSW that is truly
// controlled by this project: Privy server wallet is owner at idx 15, the
// project's admin EOA at idx 1, and historically-used Privy embedded EOA at
// idx 18. See git blame for full forensics.
export const TARGET_CANONICAL_CSW_ADDRESS =
  '0xab6d5c10b03300326cd7fab7267ae192842967b5' as const satisfies PolicyAddress

export const TARGET_ALLOWED_OWNER_EOA_ADDRESSES = [
  // Admin EOA — on-chain owner slot 1 of the canonical (agent) CSW.
  '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
  // Historical co-admin — on-chain owner slot 0 of the canonical (agent) CSW.
  '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
  // Secondary admin EOA — on-chain owner slot 3 of the canonical (agent) CSW.
  '0xd1780fc23f810b52d8cf277e54842dd8803c9361',
  // Privy embedded EOA (historical, slot 18). ONLY for legacy identity / profile
  // resolution. This EOA is no longer authorized for execution (swaps, UserOps,
  // canonical4337) on the agent CSW. Using it for signing will be rejected.
  '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
  // Privy server wallet (slot 15) — the active automation / Railway Keepr owner.
  // This is the only embedded-style signer that should drive canonical4337
  // actions on the agent CSW for automation.
  '0x858c01556ec5a8531fa4118d595430ac7fd0baf0',
] as const satisfies readonly PolicyAddress[]

const TARGET_ALLOWED_OWNER_EOA_SET = new Set<string>(TARGET_ALLOWED_OWNER_EOA_ADDRESSES)

// Active execution signers for the agent CSW (TARGET_CANONICAL_CSW_ADDRESS).
// These are the ONLY owners permitted to sign canonical4337 / sponsored UserOps
// and general execution batches on the agent wallet. The historical embedded EOA
// above is deliberately excluded from this set.
export const AGENT_CSW_ACTIVE_EXECUTION_OWNER_ADDRESSES = [
  // Current active automation owner (Railway Keepr / XMTP primary).
  '0x858c01556ec5a8531fa4118d595430ac7fd0baf0',
  // Project admin EOAs that are still valid owners.
  '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
  '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
  '0xd1780fc23f810b52d8cf277e54842dd8803c9361',
] as const satisfies readonly PolicyAddress[]

const AGENT_CSW_ACTIVE_EXECUTION_OWNER_SET = new Set<string>(AGENT_CSW_ACTIVE_EXECUTION_OWNER_ADDRESSES)

export function normalizePolicyAddress(value: string | null | undefined): PolicyAddress | null {
  if (!value || !isAddress(value)) return null
  return getAddress(value).toLowerCase() as PolicyAddress
}

export function isTargetCanonicalCsw(value: string | null | undefined): boolean {
  return normalizePolicyAddress(value) === TARGET_CANONICAL_CSW_ADDRESS
}

export function isAllowedOwnerEoa(value: string | null | undefined): boolean {
  const normalized = normalizePolicyAddress(value)
  if (!normalized) return false
  return TARGET_ALLOWED_OWNER_EOA_SET.has(normalized)
}

/**
 * Strict check for execution signing on the agent CSW.
 * Returns true ONLY for the currently active automation + admin owners.
 * The historical embedded EOA (ceca...) will return false here even though
 * it may still pass the broader isAllowedOwnerEoa (for legacy identity use).
 */
export function isAllowedAgentCswExecutionSigner(value: string | null | undefined): boolean {
  const normalized = normalizePolicyAddress(value)
  if (!normalized) return false
  return AGENT_CSW_ACTIVE_EXECUTION_OWNER_SET.has(normalized)
}

export function isAllowedCanonicalSigner(value: string | null | undefined): boolean {
  return isTargetCanonicalCsw(value) || isAllowedOwnerEoa(value)
}

export function shouldApplyCanonicalEnforcement(params: {
  canonicalAddress?: string | null
  executionAddress?: string | null
  signerAddress?: string | null
}): boolean {
  return (
    isTargetCanonicalCsw(params.canonicalAddress ?? null) ||
    isTargetCanonicalCsw(params.executionAddress ?? null) ||
    isAllowedOwnerEoa(params.signerAddress ?? null)
  )
}

export function resolvePolicyCanonicalAddress(params: {
  canonicalAddress?: string | null
  signerAddress?: string | null
}): PolicyAddress | null {
  const candidate = normalizePolicyAddress(params.canonicalAddress ?? null)
  if (isTargetCanonicalCsw(candidate)) return TARGET_CANONICAL_CSW_ADDRESS
  if (candidate) {
    if (isAllowedOwnerEoa(candidate)) {
      return isAllowedOwnerEoa(params.signerAddress ?? null) ? TARGET_CANONICAL_CSW_ADDRESS : null
    }
    return candidate
  }
  // Only collapse signer-only sessions onto the agent CSW when no distinct canonical is known.
  if (isAllowedOwnerEoa(params.signerAddress ?? null)) return TARGET_CANONICAL_CSW_ADDRESS
  return null
}

export function hasContractBytecode(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim().toLowerCase()
  return trimmed !== '' && trimmed !== '0x'
}

export async function isEoaAddressByCode(params: {
  address: string | null | undefined
  getBytecode: (address: PolicyAddress) => Promise<`0x${string}` | null | undefined>
}): Promise<boolean> {
  const normalized = normalizePolicyAddress(params.address)
  if (!normalized) return false
  const bytecode = await params.getBytecode(normalized)
  return !hasContractBytecode(bytecode)
}
