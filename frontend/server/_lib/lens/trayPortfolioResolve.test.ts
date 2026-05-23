import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getTrayWalletPortfolioDebank: vi.fn(),
  getTrayWalletPortfolioBaseEtherscan: vi.fn(),
}))

vi.mock('./debankPortfolio.js', () => ({
  getTrayWalletPortfolioDebank: mocks.getTrayWalletPortfolioDebank,
}))

vi.mock('./baseTrayPortfolioEtherscan.js', () => ({
  getTrayWalletPortfolioBaseEtherscan: mocks.getTrayWalletPortfolioBaseEtherscan,
}))

const { getTrayWalletPortfolioDebank, getTrayWalletPortfolioBaseEtherscan } = mocks

import { resolveTrayWalletPortfolio } from './trayPortfolioResolve.js'

const ADDR = '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef'

function portfolio(overrides: Partial<{ totalUsdValue: number; topTokens: unknown[] }> = {}) {
  return {
    address: ADDR,
    totalUsdValue: overrides.totalUsdValue ?? 10,
    topTokens: overrides.topTokens ?? [{ id: 'base', chain: 'base', name: 'ETH', symbol: 'ETH', amount: 1, price: 1, usdValue: 10 }],
    activeChains: [{ id: 'base', name: 'Base', usdValue: 10 }],
    protocols: [],
    asOf: Date.now(),
  }
}

describe('resolveTrayWalletPortfolio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefers DeBank when lite portfolio has tokens', async () => {
    getTrayWalletPortfolioDebank.mockResolvedValue(portfolio())
    getTrayWalletPortfolioBaseEtherscan.mockResolvedValue(null)

    const resolved = await resolveTrayWalletPortfolio(ADDR)
    expect(resolved.source).toBe('debank')
    expect(getTrayWalletPortfolioBaseEtherscan).not.toHaveBeenCalled()
  })

  it('falls back to Base Etherscan when DeBank returns empty', async () => {
    getTrayWalletPortfolioDebank.mockResolvedValue(null)
    getTrayWalletPortfolioBaseEtherscan.mockResolvedValue(portfolio({ totalUsdValue: 5 }))

    const resolved = await resolveTrayWalletPortfolio(ADDR)
    expect(resolved.source).toBe('base-etherscan')
    expect(resolved.portfolio?.totalUsdValue).toBe(5)
  })

  it('uses DeBank when only total is available (no token rows)', async () => {
    getTrayWalletPortfolioDebank.mockResolvedValue(portfolio({ totalUsdValue: 9.98, topTokens: [] }))
    getTrayWalletPortfolioBaseEtherscan.mockResolvedValue(portfolio({ totalUsdValue: 8 }))

    const resolved = await resolveTrayWalletPortfolio(ADDR)
    expect(resolved.source).toBe('debank')
    expect(resolved.portfolio?.totalUsdValue).toBeCloseTo(9.98, 2)
    expect(getTrayWalletPortfolioBaseEtherscan).not.toHaveBeenCalled()
  })
})
