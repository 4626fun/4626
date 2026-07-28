import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

vi.mock('@/lib/zora/zoraTradeApi', () => ({
  fetchZoraTradeQuoteFromApi: vi.fn(async () => ({
    call: { target: '0x1', data: '0x', value: '0' },
    quote: { amountOut: '111' },
  })),
  readZoraQuoteAmountOut: vi.fn(() => 111n),
}))

vi.mock('@/lib/uniswap/tradingApi', () => ({
  fetchTradeQuote: vi.fn(async () => ({
    quote: { output: { amount: '222' } },
  })),
}))

vi.mock('@/lib/uniswap/swapUtils', async () => {
  const actual = await vi.importActual<any>('@/lib/uniswap/swapUtils')
  return {
    ...actual,
    getNestedAmountOut: vi.fn(() => '222'),
  }
})

import { fetchEthToPairErc20AmountOut } from './ethPairErc20FundingQuote'
import { resolveFriendKeyFundingLane } from './friendKeyFundingLane'
import { fetchZoraTradeQuoteFromApi } from '@/lib/zora/zoraTradeApi'
import { fetchTradeQuote } from '@/lib/uniswap/tradingApi'

describe('fetchEthToPairErc20AmountOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('quotes Creator Coin funding via Zora', async () => {
    const lane = resolveFriendKeyFundingLane({ kind: 'creatorCoin' })
    const out = await fetchEthToPairErc20AmountOut({
      lane,
      amountInWei: 10n ** 15n,
      sender: '0x0000000000000000000000000000000000000001',
      slippagePct: 1,
    })
    expect(out).toBe(111n)
    expect(fetchZoraTradeQuoteFromApi).toHaveBeenCalled()
    expect(fetchTradeQuote).not.toHaveBeenCalled()
  })

  it('quotes ShareOFT funding via Uniswap', async () => {
    const lane = resolveFriendKeyFundingLane({
      kind: 'shareOft',
      shareOft: getAddress('0x44710150A469DE368Abc82F05e6217086Be84626'),
    })
    const out = await fetchEthToPairErc20AmountOut({
      lane,
      amountInWei: 10n ** 15n,
      sender: '0x0000000000000000000000000000000000000001',
      slippagePct: 1,
    })
    expect(out).toBe(222n)
    expect(fetchTradeQuote).toHaveBeenCalled()
    expect(fetchZoraTradeQuoteFromApi).not.toHaveBeenCalled()
  })
})
