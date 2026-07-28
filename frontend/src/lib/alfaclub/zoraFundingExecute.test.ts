import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import { assertZoraFundingExecute } from './zoraFundingExecute'
import {
  encodeMinimalNativeEthFundingExecute,
  encodeMinimalWethFundingExecute,
  encodeWethFundingWithV4SettlePull,
} from './zoraFundingExecuteFixtures'

const SENDER = getAddress('0x1000000000000000000000000000000000000001')
const CREATOR = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
const OTHER = getAddress('0x9000000000000000000000000000000000000009')
const USDC = getAddress('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')

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

  it('rejects V3 payerIsUser after Permit2 transfer (double WETH pull)', () => {
    const data = encodeMinimalWethFundingExecute({
      inputAmount: 1_000_000_000_000_000n,
      amountOutMinimum: 250n,
      payerIsUser: true,
    })
    expect(() =>
      assertZoraFundingExecute({
        data,
        sender: SENDER,
        creatorCoin: CREATOR,
        inputAmount: 1_000_000_000_000_000n,
        mode: 'wethPermit2',
      }),
    ).toThrow(/must not pull V3 input from the user/i)
  })

  it('rejects V4 SETTLE that pulls an unrelated token from the user', () => {
    const data = encodeWethFundingWithV4SettlePull({
      inputAmount: 1_000_000_000_000_000n,
      amountOutMinimum: 250n,
      settleToken: USDC,
      settleAmount: 1_000_000n,
      settlePayerIsUser: true,
    })
    expect(() =>
      assertZoraFundingExecute({
        data,
        sender: SENDER,
        creatorCoin: CREATOR,
        inputAmount: 1_000_000_000_000_000n,
        mode: 'wethPermit2',
      }),
    ).toThrow(/V4 SETTLE must use WETH/i)
  })

  it('rejects V4 SETTLE payerIsUser even for WETH', () => {
    const data = encodeWethFundingWithV4SettlePull({
      inputAmount: 1_000_000_000_000_000n,
      amountOutMinimum: 250n,
      settleToken: getAddress('0x4200000000000000000000000000000000000006'),
      settleAmount: 1_000_000_000_000_000n,
      settlePayerIsUser: true,
    })
    expect(() =>
      assertZoraFundingExecute({
        data,
        sender: SENDER,
        creatorCoin: CREATOR,
        inputAmount: 1_000_000_000_000_000n,
        mode: 'wethPermit2',
      }),
    ).toThrow(/SETTLE must not pull WETH from the user/i)
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
