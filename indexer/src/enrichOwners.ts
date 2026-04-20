import { getAddress, type Address, type Hex } from "viem";

import type { BasePublicClient } from "./baseClient.js";
import { COINBASE_SMART_WALLET_ABI, MAX_OWNER_INDEX } from "./constants.js";

export type EnrichedOwners = {
  /** EOA owners currently installed on the CSW. Checksummed. */
  addressOwners: Address[];
  /** Passkey owners (raw bytes) — present on most Zora CSWs. Included for completeness. */
  passkeyOwnerCount: number;
  /** Result of `nextOwnerIndex` at read time; bounds enumeration. */
  nextOwnerIndex: bigint | null;
  /** Result of `removedOwnersCount` at read time. */
  removedOwnersCount: bigint | null;
};

/**
 * Enumerate current owners of a Coinbase Smart Wallet.
 *
 * The contract stores owners at indices 0..nextOwnerIndex-1, but
 * indices can be "removed" (returned as empty bytes) when someone
 * calls removeOwnerAtIndex. We skip those gracefully.
 *
 * Owner encoding varies:
 *   - 32 bytes  → address (abi.encoded)
 *   - 64 bytes  → passkey (x, y coordinates of a P-256 public key)
 *   - 0 bytes   → slot was removed
 *
 * Only address owners can sign a plain `addOwnerAddress` tx, which is
 * what our install flow needs — so we return those separately.
 */
export async function enrichCswOwners(
  client: BasePublicClient,
  cswAddress: Address,
): Promise<EnrichedOwners> {
  // First pull the bounds so we don't waste RPC on empty slots past
  // the end. Fall back to brute-force enumeration if these calls
  // revert (e.g., the CSW was self-destructed or is a weird variant).
  let nextOwnerIndex: bigint | null = null;
  let removedOwnersCount: bigint | null = null;
  try {
    const results = await client.multicall({
      contracts: [
        {
          address: cswAddress,
          abi: COINBASE_SMART_WALLET_ABI,
          functionName: "nextOwnerIndex",
        },
        {
          address: cswAddress,
          abi: COINBASE_SMART_WALLET_ABI,
          functionName: "removedOwnersCount",
        },
      ],
      allowFailure: true,
    });
    if (results[0]?.status === "success") nextOwnerIndex = results[0].result as bigint;
    if (results[1]?.status === "success") removedOwnersCount = results[1].result as bigint;
  } catch {
    // Ignore — we'll brute-force below.
  }

  const maxIdx = nextOwnerIndex !== null
    ? Number(nextOwnerIndex < BigInt(MAX_OWNER_INDEX) ? nextOwnerIndex : BigInt(MAX_OWNER_INDEX))
    : MAX_OWNER_INDEX;

  if (maxIdx === 0) {
    return { addressOwners: [], passkeyOwnerCount: 0, nextOwnerIndex, removedOwnersCount };
  }

  // Fan out all owner reads in a single multicall batch.
  const calls = Array.from({ length: maxIdx }, (_, i) => ({
    address: cswAddress,
    abi: COINBASE_SMART_WALLET_ABI,
    functionName: "ownerAtIndex" as const,
    args: [BigInt(i)] as const,
  }));

  const rawResults = await client.multicall({
    contracts: calls,
    allowFailure: true,
  });

  const addressOwners: Address[] = [];
  let passkeyOwnerCount = 0;

  for (const result of rawResults) {
    if (result.status !== "success") continue;
    const bytes = result.result as Hex;
    if (!bytes || bytes === "0x") continue; // removed slot

    const hex = bytes.slice(2);
    if (hex.length === 64) {
      // 32 bytes = abi-encoded address. The address occupies the last
      // 20 bytes (low-order), left-padded with zeros.
      const addrHex = "0x" + hex.slice(24);
      try {
        addressOwners.push(getAddress(addrHex as Address));
      } catch {
        // Not a valid address — skip.
      }
    } else if (hex.length === 128) {
      // 64 bytes = passkey public key (x,y).
      passkeyOwnerCount += 1;
    } else {
      // Unknown length; ignore rather than error the whole enrichment.
    }
  }

  return { addressOwners, passkeyOwnerCount, nextOwnerIndex, removedOwnersCount };
}
