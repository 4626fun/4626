import type { PublicClient } from 'viem'

import { GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI } from '../../../src/lib/wallet/cswOwnerAbi.js'

/** Conservative gas-unit budget for a CSW self-funded Part 1 UserOp (depositNative). */
export const RELAY_PART1_USER_OP_GAS_BUFFER_UNITS = 400_000n

/**
 * Live EntryPoint v0.6 prefund estimate for Relay Part 1 preview simulation.
 * Kept server-local so Vite API bundling never tree-shakes shared client exports.
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
