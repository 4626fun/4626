import { getAddress, isAddress } from 'viem'

export type PolicyAddress = `0x${string}`

export const TARGET_CANONICAL_CSW_ADDRESS =
  '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef' as const satisfies PolicyAddress

export const TARGET_ALLOWED_OWNER_EOA_ADDRESSES = [
  '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
  '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
  '0xd1780fc23f810b52d8cf277e54842dd8803c9361',
  // Privy embedded EOA owner of the canonical CSW. Verified on-chain via
  // isOwnerAddress() on the canonical CSW — this EOA signs UserOps that are
  // executed by the canonical CBSW. Without it, the swap page's
  // `isReady` gate stays false in canonical mode (handleQuote returns
  // before even attempting fetchTradeQuote) even though the embedded
  // wallet is a real, registered owner of the CSW.
  '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
] as const satisfies readonly PolicyAddress[]

const TARGET_ALLOWED_OWNER_EOA_SET = new Set<string>(TARGET_ALLOWED_OWNER_EOA_ADDRESSES)

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
  if (isAllowedOwnerEoa(params.signerAddress ?? null)) return TARGET_CANONICAL_CSW_ADDRESS
  return candidate
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
