import { describe, expect, it } from 'vitest'
import { encodeFunctionData, getAddress } from 'viem'

import {
  describeGoldenPart1ExecuteBatchInnerCall,
  validateGoldenCswDepositoryPart1UserCall,
} from './goldenRelayPart1Shape'
import {
  GOLDEN_RELAY_PART1_DEPOSIT_WEI,
  GOLDEN_RELAY_PART1_ORDER_ID,
  GOLDEN_RELAY_PART1_PROBE_CSW,
  RELAY_DEPOSITORY_ABI,
  RELAY_DEPOSITORY_BASE,
  RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR,
} from '@/lib/wallet/cswOwnerAbi'

const CSW = GOLDEN_RELAY_PART1_PROBE_CSW
const ORDER_ID = GOLDEN_RELAY_PART1_ORDER_ID

describe('validateGoldenCswDepositoryPart1UserCall', () => {
  const goldenData = encodeFunctionData({
    abi: RELAY_DEPOSITORY_ABI,
    functionName: 'depositNative',
    args: [CSW, ORDER_ID],
  })

  const goldenUserCall = {
    to: RELAY_DEPOSITORY_BASE,
    data: goldenData,
    value: `0x${GOLDEN_RELAY_PART1_DEPOSIT_WEI.toString(16)}` as `0x${string}`,
  }

  it('accepts the Tenderly golden executeBatch inner call', () => {
    expect(
      validateGoldenCswDepositoryPart1UserCall({
        userCall: goldenUserCall,
        fundingCsw: CSW,
        orderId: ORDER_ID,
      }),
    ).toBeNull()

    expect(describeGoldenPart1ExecuteBatchInnerCall(goldenUserCall)).toEqual({
      target: getAddress(RELAY_DEPOSITORY_BASE),
      value: GOLDEN_RELAY_PART1_DEPOSIT_WEI.toString(10),
      data: goldenData,
    })
  })

  it('accepts live Relay quotes above the golden floor', () => {
    const higherDeposit = GOLDEN_RELAY_PART1_DEPOSIT_WEI + 5_000_000_000n
    expect(
      validateGoldenCswDepositoryPart1UserCall({
        userCall: {
          ...goldenUserCall,
          value: higherDeposit.toString(10),
        },
        fundingCsw: CSW,
        orderId: ORDER_ID,
      }),
    ).toBeNull()
  })

  it('accepts the exact May 5 Tenderly inner executeBatch call (probe CSW deposit)', () => {
    const may5Calldata =
      '0x49290c1c0000000000000000000000004beabd0afbcc2f0440cdef1c3c745d43fae704ef8cc58ae3d8f127fbe4c8327958cf9c638f4d3b25547ddcbb190c8ce8e853797a' as const
    const may5UserCall = {
      to: RELAY_DEPOSITORY_BASE,
      data: may5Calldata,
      value: '18871666861048',
    }

    expect(
      validateGoldenCswDepositoryPart1UserCall({
        userCall: may5UserCall,
        fundingCsw: CSW,
        orderId: ORDER_ID,
      }),
    ).toBeNull()

    expect(describeGoldenPart1ExecuteBatchInnerCall(may5UserCall)).toEqual({
      target: getAddress(RELAY_DEPOSITORY_BASE),
      value: '18871666861048',
      data: may5Calldata,
    })
  })

  it('rejects router targets', () => {
    expect(
      validateGoldenCswDepositoryPart1UserCall({
        userCall: {
          ...goldenUserCall,
          to: '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f',
        },
        fundingCsw: CSW,
      }),
    ).toMatch(/RelayDepository/)
  })
})
