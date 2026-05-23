import type { PublicClient } from 'viem'

import { GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI } from '../wallet/cswOwnerAbi'

/** Conservative gas-unit budget for a CSW self-funded Part 1 UserOp (depositNative). */
export const RELAY_PART1_USER_OP_GAS_BUFFER_UNITS = 400_000n

/** Shared implementation — not exported so Vite cannot tree-shake it away from `resolve*`. */
function relayPart1UserOpGasReserveFromGasPrice(gasPrice: bigint): bigint {
  if (gasPrice <= 0n) return GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI
  return gasPrice * RELAY_PART1_USER_OP_GAS_BUFFER_UNITS
}

/**
 * Live EntryPoint v0.6 prefund estimate: `gasPrice × buffer units`.
 * Matches server-side Relay deposit simulation.
 */
export function estimateRelayPart1UserOpGasReserveWei(gasPrice: bigint): bigint {
  return relayPart1UserOpGasReserveFromGasPrice(gasPrice)
}

/** Fallback to the May 5 golden trace when gas price is unavailable. */
export function relayPart1UserOpGasReserveFallbackWei(): bigint {
  return GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI
}

export async function resolveRelayPart1UserOpGasReserveWei(
  publicClient: Pick<PublicClient, 'getGasPrice'> | null | undefined,
): Promise<bigint> {
  if (!publicClient) {
    return relayPart1UserOpGasReserveFallbackWei()
  }
  try {
    const gasPrice = await publicClient.getGasPrice()
    return relayPart1UserOpGasReserveFromGasPrice(gasPrice)
  } catch {
    return relayPart1UserOpGasReserveFallbackWei()
  }
}
