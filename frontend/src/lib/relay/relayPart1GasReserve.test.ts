import { describe, expect, it, vi } from 'vitest'

import {
  RELAY_PART1_USER_OP_GAS_BUFFER_UNITS,
  resolveRelayPart1UserOpGasReserveWei,
} from '@/lib/relay/relayPart1GasReserve'
import { GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI } from '@/lib/wallet/cswOwnerAbi'

describe('relayPart1GasReserve', () => {
  it('resolves live gas price from public client', async () => {
    const publicClient = {
      getGasPrice: vi.fn(async () => 2_500_000_000n),
    }
    await expect(resolveRelayPart1UserOpGasReserveWei(publicClient)).resolves.toBe(
      2_500_000_000n * RELAY_PART1_USER_OP_GAS_BUFFER_UNITS,
    )
  })

  it('uses golden fallback when public client is missing', async () => {
    await expect(resolveRelayPart1UserOpGasReserveWei(null)).resolves.toBe(
      GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI,
    )
  })

  it('uses golden fallback when gas price lookup fails or is non-positive', async () => {
    const failingClient = {
      getGasPrice: vi.fn(async () => {
        throw new Error('rpc down')
      }),
    }
    await expect(resolveRelayPart1UserOpGasReserveWei(failingClient)).resolves.toBe(
      GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI,
    )

    const zeroClient = {
      getGasPrice: vi.fn(async () => 0n),
    }
    await expect(resolveRelayPart1UserOpGasReserveWei(zeroClient)).resolves.toBe(
      GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI,
    )
  })
})
