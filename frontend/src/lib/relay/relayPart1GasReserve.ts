import type { PublicClient } from 'viem'

import { GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI } from '../wallet/cswOwnerAbi.js'

/** Conservative gas-unit budget for a CSW self-funded Part 1 UserOp (depositNative). */
export const RELAY_PART1_USER_OP_GAS_BUFFER_UNITS = 400_000n

/**
 * Live EntryPoint v0.6 prefund estimate: `gasPrice × buffer units`.
 * Server re-exports this module from `server/_lib/relay/relayPart1GasReserve.ts`.
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
