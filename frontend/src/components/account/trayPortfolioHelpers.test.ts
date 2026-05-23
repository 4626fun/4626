import { describe, expect, it } from 'vitest'

import {
  buildTrayAssetHoldings,
  buildTrayHoldings,
  buildTrayHoldingsFromPortfolios,
  buildTrayTokenRowsFromPortfolios,
  buildTrayWalletSources,
  parseDebankToken,
} from './trayPortfolioHelpers'

const CSW = '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef'

describe('buildTrayWalletSources', () => {
  it('omits external EOA when it matches canonical CSW', () => {
    expect(
      buildTrayWalletSources({
        cswAddress: CSW,
        externalEoaAddress: CSW,
      }),
    ).toEqual([
      {
        kind: 'canonical',
        address: CSW,
        label: '4626 CSW',
      },
    ])
  })

  it('keeps distinct external and canonical wallets', () => {
    const external = '0x1111111111111111111111111111111111111111'
    expect(
      buildTrayWalletSources({
        cswAddress: CSW,
        externalEoaAddress: external,
      }),
    ).toHaveLength(2)
  })
})

describe('buildTrayHoldingsFromPortfolios', () => {
  it('maps unified portfolio snapshots into network totals', () => {
    const wallet = { kind: 'canonical' as const, address: CSW, label: '4626 CSW' }
    const holdings = buildTrayHoldingsFromPortfolios({
      wallets: [wallet],
      portfolios: {
        [CSW.toLowerCase()]: {
          address: CSW,
          totalUsdValue: 12,
          topTokens: [],
          activeChains: [{ id: 'base', name: 'Base', usdValue: 12 }],
          protocols: [],
          asOf: Date.now(),
        },
      },
    })
    expect(holdings.aggregateUsd).toBe(12)
    expect(holdings.rows[0]?.networkId).toBe('base')
  })
})

describe('buildTrayHoldings', () => {
  it('does not double-count balance when the same address is passed twice', () => {
    const holdings = buildTrayHoldings({
      wallets: [
        { kind: 'canonical', address: CSW, label: '4626 CSW' },
        { kind: 'external', address: CSW, label: 'External EOA' },
      ],
      debankResults: {
        [CSW.toLowerCase()]: {
          totalUsdValue: 9.98,
          chains: [{ id: 'base', name: 'Base', usdValue: 9.98 }],
        },
      },
    })

    expect(holdings.aggregateUsd).toBeCloseTo(9.98, 2)
    expect(holdings.rows[0]?.wallets).toHaveLength(1)
    expect(holdings.rows[0]?.usdTotal).toBeCloseTo(9.98, 2)
  })
})

describe('parseDebankToken', () => {
  it('accepts native Base ETH id from DeBank', () => {
    const parsed = parseDebankToken({
      id: 'base',
      symbol: 'ETH',
      name: 'Ether',
      amount: 0.002,
      usdValue: 4.57,
    })
    expect(parsed?.tokenKey).toBe('native:base')
    expect(parsed?.symbol).toBe('ETH')
  })

  it('accepts standard ERC-20 contract ids', () => {
    const token = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    const parsed = parseDebankToken({
      id: token,
      symbol: 'USDC',
      name: 'USD Coin',
      amount: 10,
      usdValue: 10,
    })
    expect(parsed?.tokenAddress).toBe(token.toLowerCase())
  })
})

describe('buildTrayTokenRowsFromPortfolios', () => {
  it('maps server portfolio topTokens into tray rows', () => {
    const wallet = { kind: 'canonical' as const, address: CSW, label: '4626 CSW' }
    const rows = buildTrayTokenRowsFromPortfolios({
      wallets: [wallet],
      portfolios: {
        [CSW.toLowerCase()]: {
          address: CSW,
          totalUsdValue: 9.98,
          topTokens: [
            {
              id: 'base',
              chain: 'base',
              name: 'Ether',
              symbol: 'ETH',
              amount: 0.002,
              price: 2285,
              usdValue: 4.57,
            },
          ],
          activeChains: [],
          protocols: [],
          asOf: Date.now(),
        },
      },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.token.id).toBe('base')
    const holdings = buildTrayAssetHoldings(rows)
    expect(holdings[0]?.symbol).toBe('ETH')
    expect(holdings[0]?.usdValue).toBeCloseTo(4.57, 2)
  })
})

describe('buildTrayAssetHoldings', () => {
  it('merges duplicate wallet rows for the same token without inflating balances', () => {
    const wallet = { kind: 'canonical' as const, address: CSW, label: '4626 CSW' }
    const token = {
      id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      symbol: 'USDC',
      name: 'USD Coin',
      amount: 5,
      usdValue: 5,
    }
    const rows = [
      { token, wallet },
      { token, wallet },
    ]
    const holdings = buildTrayAssetHoldings(rows)
    expect(holdings).toHaveLength(1)
    expect(holdings[0]?.amount).toBe(5)
    expect(holdings[0]?.usdValue).toBe(5)
  })
})
