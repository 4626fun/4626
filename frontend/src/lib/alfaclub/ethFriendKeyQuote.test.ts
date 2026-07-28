import { describe, expect, it } from 'vitest'

import {
  estimateEthWeiForRequiredAkita,
  estimateEthWeiForRequiredPairErc20,
  formatEthWeiForInput,
  fundingCoversSudoswapBuy,
} from './ethFriendKeyQuote'

describe('estimateEthWeiForRequiredPairErc20', () => {
  it('scales probe rate with a buffer (Akita alias)', () => {
    const eth = estimateEthWeiForRequiredAkita({
      requiredAkita: 200n,
      probeEthWei: 100n,
      probeAkitaOut: 100n,
      bufferBps: 100n,
    })
    // raw=200, +1% buffer => 202
    expect(eth).toBe(202n)
  })

  it('rounds up fractional wei', () => {
    const eth = estimateEthWeiForRequiredPairErc20({
      requiredPairErc20: 3n,
      probeEthWei: 100n,
      probePairErc20Out: 200n,
      bufferBps: 0n,
    })
    // ceil(3*100/200)=2
    expect(eth).toBe(2n)
  })
})

describe('formatEthWeiForInput', () => {
  it('formats whole and fractional ether', () => {
    expect(formatEthWeiForInput(10n ** 18n)).toBe('1')
    expect(formatEthWeiForInput(1_500_000_000_000_000_000n)).toBe('1.5')
    expect(formatEthWeiForInput(1_000_000_000_000_000n)).toBe('0.001')
  })
})

describe('fundingCoversSudoswapBuy', () => {
  it('accepts either pair-ERC20 or legacy Akita field names', () => {
    expect(
      fundingCoversSudoswapBuy({
        fundingPairErc20Out: 10n,
        requiredPairErc20: 10n,
      }),
    ).toBe(true)
    expect(
      fundingCoversSudoswapBuy({
        fundingAkitaOut: 9n,
        requiredAkita: 10n,
      }),
    ).toBe(false)
  })
})
