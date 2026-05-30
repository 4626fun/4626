import type { PublicClient } from 'viem'

import { GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI } from '../../../src/lib/wallet/cswOwnerAbi.js'

/** Conservative gas-unit budget for a CSW self-funded Part 1 UserOp (depositNative). */
export const RELAY_PART1_USER_OP_GAS_BUFFER_UNITS = 400_000n

/**
 * Live EntryPoint v0.6 prefund estimate: `gasPrice × buffer units`.
 * Implemented here (not re-exported from `src/`) so API routes never pull
 * client `@/` aliases through the server bundle.
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
