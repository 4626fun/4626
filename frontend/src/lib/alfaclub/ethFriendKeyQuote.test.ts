import { describe, expect, it } from 'vitest'

import {
  estimateEthWeiForRequiredAkita,
  formatEthWeiForInput,
  fundingCoversSudoswapBuy,
} from './ethFriendKeyQuote'

describe('estimateEthWeiForRequiredAkita', () => {
  it('scales a probe quote up to the required Creator Coin amount with buffer', () => {
    const eth = estimateEthWeiForRequiredAkita({
      requiredAkita: 250n * 10n ** 18n,
      probeEthWei: 10n ** 15n,
      probeAkitaOut: 100n * 10n ** 18n,
      bufferBps: 100n,
    })
    expect(eth).toBe(2_525_000_000_000_000n)
  })

  it('rounds up when the division is not exact', () => {
    const eth = estimateEthWeiForRequiredAkita({
      requiredAkita: 3n,
      probeEthWei: 10n,
      probeAkitaOut: 2n,
      bufferBps: 0n,
    })
    expect(eth).toBe(15n)
  })
})

describe('formatEthWeiForInput', () => {
  it('formats whole and fractional ETH without trailing zeros', () => {
    expect(formatEthWeiForInput(10n ** 18n)).toBe('1')
    expect(formatEthWeiForInput(1_500_000_000_000_000_000n)).toBe('1.5')
    expect(formatEthWeiForInput(1_000_000_000_000_000n)).toBe('0.001')
  })
})

describe('fundingCoversSudoswapBuy', () => {
  it('requires funding output to meet the Sudoswap buy input', () => {
    expect(
      fundingCoversSudoswapBuy({
        fundingAkitaOut: 99n,
        requiredAkita: 100n,
      }),
    ).toBe(false)
    expect(
      fundingCoversSudoswapBuy({
        fundingAkitaOut: 100n,
        requiredAkita: 100n,
      }),
    ).toBe(true)
  })
})
