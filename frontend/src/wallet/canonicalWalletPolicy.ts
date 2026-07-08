import { getAddress, isAddress } from 'viem'

export type PolicyAddress = `0x${string}`

/**
 * Platform wallet policy — two distinct CSW pins:
 *
 * - `PROTOCOL_CSW_ADDRESS` — 4626 agent / XMTP inbox / ERC-8004 identity /
 *   Railway Keepr sender for agent #2205 (`4626.base.eth` target). Zora protocol
 *   CSW with Privy server signer at owner slot 2 (`0x858c…`).
 * - `CANONICAL_CSW_ADDRESS` — the 4626 operator account CSW (`profiles.csw_address`
 *   for the admin account): personal custody, sponsored swaps, AKITA vault owner, owner-install.
 *
 * Do not conflate protocol agent identity with the operator account wallet.
 * Runtime env: `PROTOCOL_CSW_*` + `CANONICAL_CSW_*` (`canonicalCswEnv.ts`).
 */

/** 4626 protocol agent CSW (Zora CSW; `4626.base.eth` target). */
export const PROTOCOL_CSW_ADDRESS =
  '0x793ca28123cba3ca3c20b9c6c67f37510c89c145' as const satisfies PolicyAddress

/** Privy server wallet (`0x858c…`) — owner slot 2 on `PROTOCOL_CSW_ADDRESS`. */
export const PROTOCOL_CSW_EXECUTION_OWNER_ADDRESSES = [
  '0x858c01556ec5a8531fa4118d595430ac7fd0baf0',
] as const satisfies readonly PolicyAddress[]

const PROTOCOL_CSW_EXECUTION_OWNER_SET = new Set<string>(PROTOCOL_CSW_EXECUTION_OWNER_ADDRESSES)

// Operator account CSW (personal canonical account; migrated 2026-04-23 from 0x4beabd…)
export const CANONICAL_CSW_ADDRESS =
  '0xab6d5c10b03300326cd7fab7267ae192842967b5' as const satisfies PolicyAddress

export const CANONICAL_CSW_ALLOWED_OWNER_EOAS = [
  // When adding a new owner to CANONICAL_CSW_ADDRESS on-chain (`addOwnerAddress`),
  // append the owner EOA here AND to CANONICAL_CSW_EXECUTION_OWNER_ADDRESSES below,
  // then run canonicalWalletPolicy.test.ts. See csw-agent-lifecycle.mdc § Owner allowlist.
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

export function isProtocolCsw(value: string | null | undefined): boolean {
  return normalizePolicyAddress(value) === PROTOCOL_CSW_ADDRESS
}

export function isCanonicalCsw(value: string | null | undefined): boolean {
  return normalizePolicyAddress(value) === CANONICAL_CSW_ADDRESS
}

/** Whether `value` may sign execution on `PROTOCOL_CSW_ADDRESS`. */
export function isAllowedProtocolCswExecutionSigner(value: string | null | undefined): boolean {
  const normalized = normalizePolicyAddress(value)
  if (!normalized) return false
  return PROTOCOL_CSW_EXECUTION_OWNER_SET.has(normalized)
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

/** True when the active profile or execution wallet is the platform canonical CSW. */
export function shouldApplyCanonicalEnforcement(params: {
  canonicalAddress?: string | null
  executionAddress?: string | null
  /** Reserved for call-site compatibility; enforcement is identity-scoped, not signer-scoped. */
  signerAddress?: string | null
}): boolean {
  return (
    isCanonicalCsw(params.canonicalAddress ?? null) ||
    isCanonicalCsw(params.executionAddress ?? null)
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
