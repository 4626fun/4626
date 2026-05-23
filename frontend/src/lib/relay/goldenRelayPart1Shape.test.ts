import { describe, expect, it } from 'vitest'
import { encodeFunctionData, getAddress } from 'viem'

import {
  describeGoldenPart1ExecuteBatchInnerCall,
  validateGoldenCswDepositoryPart1UserCall,
} from './goldenRelayPart1Shape'
import {
  GOLDEN_RELAY_PART1_DEPOSIT_WEI,
  RELAY_DEPOSITORY_ABI,
  RELAY_DEPOSITORY_BASE,
} from '@/lib/wallet/cswOwnerAbi'

const CSW = '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF' as const
const ORDER_ID =
  '0x8cc58ae3d8f127fbe4c8327958cf9c638f4d3b25547ddcbb190c8ce8e853797a' as const

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
