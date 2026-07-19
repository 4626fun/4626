import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import { assertZoraFundingExecute } from './zoraFundingExecute'
import {
  encodeMinimalNativeEthFundingExecute,
  encodeMinimalWethFundingExecute,
} from './zoraFundingExecuteFixtures'

const SENDER = getAddress('0x1000000000000000000000000000000000000001')
const CREATOR = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
const OTHER = getAddress('0x9000000000000000000000000000000000000009')

describe('assertZoraFundingExecute', () => {
  it('accepts a WETH Permit2 funding plan bound to creator coin and sender', () => {
    const data = encodeMinimalWethFundingExecute({
      inputAmount: 1_000_000_000_000_000n,
      amountOutMinimum: 250n,
    })
    expect(
      assertZoraFundingExecute({
        data,
        sender: SENDER,
        creatorCoin: CREATOR,
        inputAmount: 1_000_000_000_000_000n,
        mode: 'wethPermit2',
        minOutputAmount: 200n,
      }).amountOutMinimum,
    ).toBe(250n)
  })

  it('rejects unrelated Permit2 token transfers', () => {
    const data = encodeMinimalWethFundingExecute({
      inputAmount: 1n,
      amountOutMinimum: 250n,
      transferToken: OTHER,
    })
    expect(() =>
      assertZoraFundingExecute({
        data,
        sender: SENDER,
        creatorCoin: CREATOR,
        inputAmount: 1n,
        mode: 'wethPermit2',
      }),
    ).toThrow(/WETH only/i)
  })

  it('rejects a guaranteed output below the Sudoswap buy limit', () => {
    const data = encodeMinimalWethFundingExecute({
      inputAmount: 1n,
      amountOutMinimum: 199n,
    })
    expect(() =>
      assertZoraFundingExecute({
        data,
        sender: SENDER,
        creatorCoin: CREATOR,
        inputAmount: 1n,
        mode: 'wethPermit2',
        minOutputAmount: 200n,
      }),
    ).toThrow(/guaranteed output does not cover/i)
  })

  it('rejects delivery to a third-party recipient', () => {
    const data = encodeMinimalWethFundingExecute({
      inputAmount: 1n,
      amountOutMinimum: 250n,
      recipient: OTHER,
    })
    expect(() =>
      assertZoraFundingExecute({
        data,
        sender: SENDER,
        creatorCoin: CREATOR,
        inputAmount: 1n,
        mode: 'wethPermit2',
      }),
    ).toThrow(/execution wallet/i)
  })

  it('accepts native ETH wrap funding', () => {
    const data = encodeMinimalNativeEthFundingExecute({
      inputAmount: 1_000_000_000_000_000n,
      amountOutMinimum: 250n,
    })
    expect(
      assertZoraFundingExecute({
        data,
        sender: SENDER,
        creatorCoin: CREATOR,
        inputAmount: 1_000_000_000_000_000n,
        mode: 'nativeEth',
        minOutputAmount: 200n,
      }).amountOutMinimum,
    ).toBe(250n)
  })
})
