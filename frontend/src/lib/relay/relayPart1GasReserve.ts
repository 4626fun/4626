import type { PublicClient } from 'viem'

import { GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI } from '@/lib/wallet/cswOwnerAbi'

/** Conservative gas-unit budget for a CSW self-funded Part 1 UserOp (depositNative). */
export const RELAY_PART1_USER_OP_GAS_BUFFER_UNITS = 400_000n

/**
 * Live EntryPoint v0.6 prefund estimate: `gasPrice × buffer units`.
 * Logic is duplicated in `server/_lib/relay/relayPart1GasReserve.ts` for preview API bundling.
 */
export async function resolveRelayPart1UserOpGasReserveWei(
  publicClient: Pick<PublicClient, 'getGasPrice'> | null | undefined,
): Promise<bigint> {
  if (!publicClient) {
    return GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI
  }
  try {
    const gasPrice = await publicClient.getGasPrice()
    if (gasPrice <= 0n) {
      return GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI
    }
    return gasPrice * RELAY_PART1_USER_OP_GAS_BUFFER_UNITS
  } catch {
    return GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI
  }
}

/** @deprecated Use resolveRelayPart1UserOpGasReserveWei — kept for unit tests only. */
export function estimateRelayPart1UserOpGasReserveWei(gasPrice: bigint): bigint {
  if (gasPrice <= 0n) return GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI
  return gasPrice * RELAY_PART1_USER_OP_GAS_BUFFER_UNITS
}

/** @deprecated Use resolveRelayPart1UserOpGasReserveWei — kept for unit tests only. */
export function relayPart1UserOpGasReserveFallbackWei(): bigint {
  return GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI
}
