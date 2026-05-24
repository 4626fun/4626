import { decodeAbiParameters, getAddress, type Hex, type PublicClient } from 'viem'

import { CSW_OWNER_READ_ABI } from '@/lib/wallet/cswOwnerAbi'
import { classifyOwnerBytes, decodeOwnerAddress } from '@/lib/removeOwner/removeOwnerHelpers'

/** Base App session-key lane signs with owner slot 2 (observed May 2026). */
export const BASE_APP_SESSION_KEY_OWNER_INDEX = 2

/**
 * Observed session-key signer on Base App CSWs (owner slot 2). Prefer on-chain
 * `ownerAtIndex(2)` when readable; keep this as a telemetry fallback only.
 */
export const KNOWN_BASE_APP_SESSION_KEY_SIGNER =
  '0xCf8D17Ce01B73637ef936fe7c47bA7100b820142' as const

export type SelfAuthOwnerDiscoverySeed = {
  ownerIndex: number | null
  ownerSignerAddress: `0x${string}` | null
  sessionKeyOwner: boolean
  /** owner[0] is WebAuthn passkey bytes and no user-facing EOA owners exist. */
  passkeyFirst: boolean
}

function isEmptyOwnerBytes(ownerBytes: Hex): boolean {
  const normalized = ownerBytes.toLowerCase()
  if (normalized === '0x') return true
  return /^0x0+$/.test(normalized)
}

function isUserFacingEoaOwner(bytes: Hex, index: number): boolean {
  if (index === BASE_APP_SESSION_KEY_OWNER_INDEX) return false
  if (isEmptyOwnerBytes(bytes)) return false
  return classifyOwnerBytes(bytes) === 'EOA'
}

function decodeOwnerAtIndexAddress(ownerBytes: Hex): `0x${string}` | null {
  const fromHelper = decodeOwnerAddress(ownerBytes)
  if (fromHelper) return fromHelper
  try {
    const [ownerAddress] = decodeAbiParameters([{ type: 'address' }], ownerBytes)
    return getAddress(ownerAddress)
  } catch {
    return null
  }
}

/**
 * Pre-flight owner discovery for Base App self-auth Relay Part 1.
 *
 * Passkey-first CSWs expose:
 * - owner[0]: 64-byte WebAuthn passkey
 * - owner[2]: 32-byte session-key address (Base App signing lane)
 *
 * Seeding this before `wallet_prepareCalls` lets us pick `inner_secp256k1` payload
 * mode and no-chain hash candidates on the first sign attempt.
 */
export async function discoverSelfAuthOwnerFromChain(params: {
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  /** When set, only treat slot 2 as session-key if owner[0] is passkey. */
  requirePasskeyAtZero?: boolean
}): Promise<SelfAuthOwnerDiscoverySeed> {
  const empty: SelfAuthOwnerDiscoverySeed = {
    ownerIndex: null,
    ownerSignerAddress: null,
    sessionKeyOwner: false,
    passkeyFirst: false,
  }

  try {
    const ownerCountRaw = await params.publicClient.readContract({
      address: params.fundingCsw,
      abi: CSW_OWNER_READ_ABI,
      functionName: 'ownerCount',
    })
    const ownerCount = Number(ownerCountRaw)
    if (!Number.isFinite(ownerCount) || ownerCount <= 0) return empty

    const slotResults = await Promise.allSettled(
      Array.from({ length: Math.min(ownerCount, BASE_APP_SESSION_KEY_OWNER_INDEX + 1) }, (_, idx) =>
        params.publicClient.readContract({
          address: params.fundingCsw,
          abi: CSW_OWNER_READ_ABI,
          functionName: 'ownerAtIndex',
          args: [BigInt(idx)],
        }),
      ),
    )

    const ownerBytesByIndex: Hex[] = []
    for (const result of slotResults) {
      if (result.status !== 'fulfilled') continue
      const bytes = result.value
      if (typeof bytes === 'string' && bytes.startsWith('0x')) {
        ownerBytesByIndex.push(bytes as Hex)
      }
    }

    const owner0Type = ownerBytesByIndex[0] ? classifyOwnerBytes(ownerBytesByIndex[0]) : 'unknown'
    const hasUserEoaOwner = ownerBytesByIndex.some((bytes, idx) => isUserFacingEoaOwner(bytes, idx))
    const passkeyFirst = owner0Type === 'passkey' && !hasUserEoaOwner

    if (params.requirePasskeyAtZero && !passkeyFirst) {
      return { ...empty, passkeyFirst: false }
    }

    if (ownerCount <= BASE_APP_SESSION_KEY_OWNER_INDEX) {
      return { ...empty, passkeyFirst }
    }

    const sessionSlotResult = await params.publicClient.readContract({
      address: params.fundingCsw,
      abi: CSW_OWNER_READ_ABI,
      functionName: 'ownerAtIndex',
      args: [BigInt(BASE_APP_SESSION_KEY_OWNER_INDEX)],
    })
    const sessionOwnerBytes =
      typeof sessionSlotResult === 'string' && sessionSlotResult.startsWith('0x')
        ? (sessionSlotResult as Hex)
        : null
    if (!sessionOwnerBytes || isEmptyOwnerBytes(sessionOwnerBytes) || classifyOwnerBytes(sessionOwnerBytes) !== 'EOA') {
      return { ...empty, passkeyFirst }
    }

    const sessionSigner = decodeOwnerAtIndexAddress(sessionOwnerBytes)
    if (!sessionSigner) {
      return { ...empty, passkeyFirst }
    }

    return {
      ownerIndex: BASE_APP_SESSION_KEY_OWNER_INDEX,
      ownerSignerAddress: sessionSigner,
      sessionKeyOwner: true,
      passkeyFirst,
    }
  } catch {
    return empty
  }
}

export function mergeSelfAuthOwnerDiscovery(
  seed: SelfAuthOwnerDiscoverySeed | null | undefined,
  runtime: {
    ownerIndex?: number | null
    ownerSignerAddress?: `0x${string}` | null
    sessionKeyOwner?: boolean
  },
): SelfAuthOwnerDiscoverySeed {
  return {
    ownerIndex: runtime.ownerIndex ?? seed?.ownerIndex ?? null,
    ownerSignerAddress: runtime.ownerSignerAddress ?? seed?.ownerSignerAddress ?? null,
    sessionKeyOwner: runtime.sessionKeyOwner === true || seed?.sessionKeyOwner === true,
    passkeyFirst: seed?.passkeyFirst === true,
  }
}
