import { describe, expect, it, vi } from 'vitest'

import {
  RELAY_PART1_USER_OP_GAS_BUFFER_UNITS,
  estimateRelayPart1UserOpGasReserveWei,
  relayPart1UserOpGasReserveFallbackWei,
  resolveRelayPart1UserOpGasReserveWei,
} from '@/lib/relay/relayPart1GasReserve'
import { GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI } from '@/lib/wallet/cswOwnerAbi'

describe('relayPart1GasReserve', () => {
  it('estimates reserve as gasPrice × buffer units', () => {
    expect(estimateRelayPart1UserOpGasReserveWei(1_000_000_000n)).toBe(
      1_000_000_000n * RELAY_PART1_USER_OP_GAS_BUFFER_UNITS,
    )
  })

  it('falls back to golden wei for non-positive gas price', () => {
    expect(estimateRelayPart1UserOpGasReserveWei(0n)).toBe(GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI)
  })

  it('resolves live gas price from public client', async () => {
    const publicClient = {
      getGasPrice: vi.fn(async () => 2_500_000_000n),
    }
    await expect(resolveRelayPart1UserOpGasReserveWei(publicClient)).resolves.toBe(
      2_500_000_000n * RELAY_PART1_USER_OP_GAS_BUFFER_UNITS,
    )
  })

  it('uses golden fallback when gas price lookup fails', async () => {
    const publicClient = {
      getGasPrice: vi.fn(async () => {
        throw new Error('rpc down')
      }),
    }
    await expect(resolveRelayPart1UserOpGasReserveWei(publicClient)).resolves.toBe(
      relayPart1UserOpGasReserveFallbackWei(),
    )
  })
})
