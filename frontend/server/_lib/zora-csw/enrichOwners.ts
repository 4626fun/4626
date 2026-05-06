// SPDX-License-Identifier: MIT
//
// Pure helper for the Zora CSW enrich cron handler. Wraps the
// `ownerAtIndex` / `nextOwnerIndex` multicall logic and decodes the
// owner-encoding variants (32-byte address, 64-byte passkey, removed
// slot).
//
// SOURCE-OF-TRUTH NOTE
// ====================
// Mirrors `indexer/src/enrichOwners.ts`. The CLI is canonical for
// full-history backfills; this module is the minimal serverless-safe
// surface used by the Vercel cron. If the on-chain ABI ever changes,
// update both places.

import {
  getAddress,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'

const COINBASE_SMART_WALLET_ABI = [
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'removedOwnersCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const satisfies Abi

/** Hard ceiling on owner enumeration — defends against pathological loops. */
export const MAX_OWNER_INDEX = 64

export type EnrichedOwners = {
  /** EOA owners currently installed on the CSW (checksummed). */
  addressOwners: Address[]
  /** Passkey owners (raw bytes); included for completeness, not stored. */
  passkeyOwnerCount: number
  /** Result of `nextOwnerIndex` at read time; null if the call reverted. */
  nextOwnerIndex: bigint | null
  /** Result of `removedOwnersCount` at read time; null if the call reverted. */
  removedOwnersCount: bigint | null
}

/**
 * Enumerate current owners of a Coinbase Smart Wallet.
 *
 * The contract stores owners at indices 0..nextOwnerIndex-1, but
 * indices can be "removed" (returned as empty bytes) when someone
 * calls `removeOwnerAtIndex`. We skip those gracefully.
 *
 * Owner encoding:
 *   - 32 bytes  → address (abi-encoded; address occupies low 20 bytes)
 *   - 64 bytes  → passkey (x, y of a P-256 public key)
 *   - 0 bytes   → slot was removed
 *
 * Only address owners can sign a plain `addOwnerAddress` tx, which is
 * what the install flow needs — so we surface those separately.
 */
export async function enrichCswOwners(
  client: PublicClient,
  cswAddress: Address,
): Promise<EnrichedOwners> {
  // First pull the bounds so we don't waste RPC on empty slots past
  // the end. Fall back to brute-force enumeration if these calls
  // revert (e.g., the CSW was self-destructed or is a weird variant).
  let nextOwnerIndex: bigint | null = null
  let removedOwnersCount: bigint | null = null
  try {
    const results = await client.multicall({
      contracts: [
        {
          address: cswAddress,
          abi: COINBASE_SMART_WALLET_ABI,
          functionName: 'nextOwnerIndex',
        },
        {
          address: cswAddress,
          abi: COINBASE_SMART_WALLET_ABI,
          functionName: 'removedOwnersCount',
        },
      ],
      allowFailure: true,
    })
    if (results[0]?.status === 'success') {
      nextOwnerIndex = results[0].result as bigint
    }
    if (results[1]?.status === 'success') {
      removedOwnersCount = results[1].result as bigint
    }
  } catch {
    // Ignore — we'll brute-force below.
  }

  const maxIdx =
    nextOwnerIndex !== null
      ? Number(nextOwnerIndex < BigInt(MAX_OWNER_INDEX) ? nextOwnerIndex : BigInt(MAX_OWNER_INDEX))
      : MAX_OWNER_INDEX

  if (maxIdx === 0) {
    return { addressOwners: [], passkeyOwnerCount: 0, nextOwnerIndex, removedOwnersCount }
  }

  const calls = Array.from({ length: maxIdx }, (_, i) => ({
    address: cswAddress,
    abi: COINBASE_SMART_WALLET_ABI,
    functionName: 'ownerAtIndex' as const,
    args: [BigInt(i)] as const,
  }))

  const rawResults = await client.multicall({
    contracts: calls,
    allowFailure: true,
  })

  const addressOwners: Address[] = []
  let passkeyOwnerCount = 0

  for (const result of rawResults) {
    if (result.status !== 'success') continue
    const bytes = result.result as Hex
    if (!bytes || bytes === '0x') continue // removed slot

    const hex = bytes.slice(2)
    if (hex.length === 64) {
      // 32 bytes = abi-encoded address; address occupies the low 20 bytes.
      const addrHex = '0x' + hex.slice(24)
      try {
        addressOwners.push(getAddress(addrHex as Address))
      } catch {
        // Not a valid address — skip.
      }
    } else if (hex.length === 128) {
      passkeyOwnerCount += 1
    }
    // Unknown length: ignore rather than fail the whole enrichment.
  }

  return { addressOwners, passkeyOwnerCount, nextOwnerIndex, removedOwnersCount }
}
