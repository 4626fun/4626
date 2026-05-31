import { getAddress, isAddress } from 'viem'

export type PolicyAddress = `0x${string}`

/**
 * Canonical parent CSW policy (`CANONICAL_CSW_ADDRESS`).
 *
 * One on-chain wallet — not a separate "agent wallet" vs "user wallet". The same
 * address is profiles.csw_address, the XMTP inbox, AKITA vault owner, and the
 * parent CSW for user-initiated `canonical4337` / owner-install. Use only
 * "canonical CSW" in product copy and policy code; role labels (XMTP agent,
 * vault owner) describe what uses the address, not a second account.
 *
 * Runtime env mirror: `CANONICAL_CSW_ADDRESS` (see `canonicalCswEnv.ts`).
 *
 * User-initiated frontend signing: Privy embedded EOA (owner slot 18) via
 * `legacy-owner-install`. Server automation: Privy server wallet (slot 15).
 * Base App / admin: passkey and admin EOAs on the allowlist below.
 */

// Canonical CSW migrated on 2026-04-23 from 0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef
export const CANONICAL_CSW_ADDRESS =
  '0xab6d5c10b03300326cd7fab7267ae192842967b5' as const satisfies PolicyAddress

export const CANONICAL_CSW_ALLOWED_OWNER_EOAS = [
  // Admin EOA — on-chain owner slot 1 of the canonical CSW.
  '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
  // Co-admin / Base App passkey owner — on-chain owner slot 0.
  '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
  // Secondary admin EOA — on-chain owner slot 3.
  '0xd1780fc23f810b52d8cf277e54842dd8803c9361',
  // Privy embedded EOA (slot 18) — primary user-initiated frontend owner-install signer.
  '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
  // Privy server wallet (slot 15) — server-side automation / Railway Keepr owner.
  '0x858c01556ec5a8531fa4118d595430ac7fd0baf0',
] as const satisfies readonly PolicyAddress[]

const CANONICAL_CSW_ALLOWED_OWNER_EOA_SET = new Set<string>(CANONICAL_CSW_ALLOWED_OWNER_EOAS)

/** Owners permitted to sign UserOps / execution batches on `CANONICAL_CSW_ADDRESS`. */
export const CANONICAL_CSW_EXECUTION_OWNER_ADDRESSES = [
  '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
  '0x858c01556ec5a8531fa4118d595430ac7fd0baf0',
  '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
  '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
  '0xd1780fc23f810b52d8cf277e54842dd8803c9361',
] as const satisfies readonly PolicyAddress[]

const CANONICAL_CSW_EXECUTION_OWNER_SET = new Set<string>(CANONICAL_CSW_EXECUTION_OWNER_ADDRESSES)

export function normalizePolicyAddress(value: string | null | undefined): PolicyAddress | null {
  if (!value || !isAddress(value)) return null
  return getAddress(value).toLowerCase() as PolicyAddress
}

export function isCanonicalCsw(value: string | null | undefined): boolean {
  return normalizePolicyAddress(value) === CANONICAL_CSW_ADDRESS
}

export function isAllowedOwnerEoa(value: string | null | undefined): boolean {
  const normalized = normalizePolicyAddress(value)
  if (!normalized) return false
  return CANONICAL_CSW_ALLOWED_OWNER_EOA_SET.has(normalized)
}

/** Whether `value` may sign execution on `CANONICAL_CSW_ADDRESS`. */
export function isAllowedCanonicalCswExecutionSigner(value: string | null | undefined): boolean {
  const normalized = normalizePolicyAddress(value)
  if (!normalized) return false
  return CANONICAL_CSW_EXECUTION_OWNER_SET.has(normalized)
}

export function isAllowedCanonicalSigner(value: string | null | undefined): boolean {
  return isCanonicalCsw(value) || isAllowedOwnerEoa(value)
}

export function shouldApplyCanonicalEnforcement(params: {
  canonicalAddress?: string | null
  executionAddress?: string | null
  signerAddress?: string | null
}): boolean {
  return (
    isCanonicalCsw(params.canonicalAddress ?? null) ||
    isCanonicalCsw(params.executionAddress ?? null) ||
    isAllowedOwnerEoa(params.signerAddress ?? null)
  )
}

export function resolvePolicyCanonicalAddress(params: {
  canonicalAddress?: string | null
  signerAddress?: string | null
}): PolicyAddress | null {
  const candidate = normalizePolicyAddress(params.canonicalAddress ?? null)
  if (isCanonicalCsw(candidate)) return CANONICAL_CSW_ADDRESS
  if (candidate) {
    if (isAllowedOwnerEoa(candidate)) {
      return isAllowedOwnerEoa(params.signerAddress ?? null) ? CANONICAL_CSW_ADDRESS : null
    }
    return candidate
  }
  if (isAllowedOwnerEoa(params.signerAddress ?? null)) return CANONICAL_CSW_ADDRESS
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
