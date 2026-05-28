import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getTrayWalletPortfolioDebank: vi.fn(),
  getTrayWalletPortfolioBaseEtherscan: vi.fn(),
  hasDebankAccessKey: vi.fn(() => true),
  hasEtherscanApiKey: vi.fn(() => true),
  preferTrayPortfolioEtherscan: vi.fn(() => false),
}))

vi.mock('./debankPortfolio.js', () => ({
  getTrayWalletPortfolioDebank: mocks.getTrayWalletPortfolioDebank,
}))

vi.mock('./baseTrayPortfolioEtherscan.js', () => ({
  getTrayWalletPortfolioBaseEtherscan: mocks.getTrayWalletPortfolioBaseEtherscan,
}))

vi.mock('./etherscanV2.js', () => ({
  hasDebankAccessKey: mocks.hasDebankAccessKey,
  hasEtherscanApiKey: mocks.hasEtherscanApiKey,
  preferTrayPortfolioEtherscan: mocks.preferTrayPortfolioEtherscan,
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
    mocks.hasDebankAccessKey.mockReturnValue(true)
    mocks.hasEtherscanApiKey.mockReturnValue(true)
    mocks.preferTrayPortfolioEtherscan.mockReturnValue(false)
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

  it('uses Etherscan v2 when DeBank has balance but no token rows', async () => {
    getTrayWalletPortfolioDebank.mockResolvedValue(portfolio({ totalUsdValue: 9.98, topTokens: [] }))
    getTrayWalletPortfolioBaseEtherscan.mockResolvedValue(portfolio({ totalUsdValue: 8 }))

    const resolved = await resolveTrayWalletPortfolio(ADDR)
    expect(resolved.source).toBe('base-etherscan')
    expect(resolved.portfolio?.totalUsdValue).toBe(8)
    expect(getTrayWalletPortfolioBaseEtherscan).toHaveBeenCalled()
  })

  it('uses Etherscan v2 only when DeBank key is not configured', async () => {
    mocks.hasDebankAccessKey.mockReturnValue(false)
    getTrayWalletPortfolioBaseEtherscan.mockResolvedValue(portfolio({ totalUsdValue: 12 }))

    const resolved = await resolveTrayWalletPortfolio(ADDR)
    expect(resolved.source).toBe('base-etherscan')
    expect(getTrayWalletPortfolioDebank).not.toHaveBeenCalled()
  })

  it('falls back to DeBank when Etherscan-first returns an empty portfolio shell', async () => {
    mocks.preferTrayPortfolioEtherscan.mockReturnValue(true)
    getTrayWalletPortfolioBaseEtherscan.mockResolvedValue(
      portfolio({ totalUsdValue: 0, topTokens: [] }),
    )
    getTrayWalletPortfolioDebank.mockResolvedValue(portfolio({ totalUsdValue: 42 }))

    const resolved = await resolveTrayWalletPortfolio(ADDR)
    expect(resolved.source).toBe('debank')
    expect(resolved.portfolio?.totalUsdValue).toBe(42)
    expect(getTrayWalletPortfolioDebank).toHaveBeenCalled()
  })

  it('does not return an empty Etherscan portfolio when DeBank has token rows', async () => {
    getTrayWalletPortfolioDebank.mockResolvedValue(portfolio({ totalUsdValue: 15 }))
    getTrayWalletPortfolioBaseEtherscan.mockResolvedValue(
      portfolio({ totalUsdValue: 0, topTokens: [] }),
    )

    const resolved = await resolveTrayWalletPortfolio(ADDR)
    expect(resolved.source).toBe('debank')
    expect(resolved.portfolio?.topTokens.length).toBeGreaterThan(0)
  })
})
