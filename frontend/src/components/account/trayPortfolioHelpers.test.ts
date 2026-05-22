import { describe, expect, it } from 'vitest'

import {
  buildTrayAssetHoldings,
  buildTrayHoldings,
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
