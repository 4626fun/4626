import type { Address } from "viem";

import type { BasePublicClient } from "./baseClient.js";

/**
 * Binary-search for the block at which `address` first acquired bytecode.
 *
 * This lets the full-history scan start at the real deployment block
 * instead of scanning the entire Base chain (~45M blocks, most of them
 * empty for our event). On a typical RPC this search takes ~25 calls
 * (log2 of Base's total block count) and finishes in under a second.
 *
 * Contract: returns the LOWEST block number at which `eth_getCode` for
 * `address` returns non-empty code. If the address has never been
 * deployed, returns `null`.
 */
export async function findDeploymentBlock(
  client: BasePublicClient,
  address: Address,
): Promise<bigint | null> {
  const tip = await client.getBlockNumber();

  // Confirm the contract exists at the tip. If not, we can't search.
  const tipCode = await client.getCode({ address, blockNumber: tip });
  if (!tipCode || tipCode === "0x") return null;

  let lo = 0n;
  let hi = tip;

  // Standard upper-bound binary search: we're looking for the smallest
  // block where code is present. Invariant: `hi` always points to a
  // block with code; `lo` always points to a block without (or is 0).
  while (lo < hi) {
    const mid = lo + (hi - lo) / 2n;
    let code: `0x${string}` | undefined;
    try {
      code = await client.getCode({ address, blockNumber: mid });
    } catch {
      // Some RPCs prune old state and throw for blocks below a
      // retention window. If we can't tell whether code existed, move
      // the floor up — this will overestimate the deployment block
      // (we'll start scanning slightly later than strictly necessary),
      // but that's acceptable and cheaper than failing hard.
      lo = mid + 1n;
      continue;
    }
    if (code && code !== "0x") hi = mid;
    else lo = mid + 1n;
  }

  return lo;
}
