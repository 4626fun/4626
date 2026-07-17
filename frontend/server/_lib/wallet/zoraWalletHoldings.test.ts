import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveTrayWalletPortfolioMock = vi.fn()
const getCoinMock = vi.fn()

vi.mock('../lens/trayPortfolioResolve.js', () => ({
  resolveTrayWalletPortfolio: (...args: unknown[]) => resolveTrayWalletPortfolioMock(...args),
}))

vi.mock('../../zora/_shared.js', () => ({
  requireServerKey: () => 'test-zora-key',
}))

vi.mock('@zoralabs/coins-sdk', () => ({
  setApiKey: vi.fn(),
  getCoin: (...args: unknown[]) => getCoinMock(...args),
}))

import {
  clampTopTokenCount,
  formatHoldingAmount,
  MAX_TOP_TOKEN_COUNT,
  normalizeExtraTokenAddresses,
  parseExtraTokenAddressesQuery,
  parseZoraProfileBalance,
  resolveZoraWalletHoldings,
  unionZoraLookupAddresses,
} from './zoraWalletHoldings.js'

describe('zoraWalletHoldings helpers', () => {
  it('parses human-readable Zora profile balances', () => {
    expect(parseZoraProfileBalance('1250.5')).toBe(1250.5)
    expect(parseZoraProfileBalance('0')).toBe(0)
  })

  it('parses large integer balances as wei', () => {
    expect(parseZoraProfileBalance('1000000000000000000')).toBe(1)
  })

  it('formats holding amounts for swap rows', () => {
    expect(formatHoldingAmount(1250.5)).toBe('1,250.5')
    expect(formatHoldingAmount(0)).toBe('0')
  })

  it('clamps top token count to the raised max of 200', () => {
    expect(MAX_TOP_TOKEN_COUNT).toBe(200)
    expect(clampTopTokenCount(undefined)).toBe(200)
    expect(clampTopTokenCount(50)).toBe(50)
    expect(clampTopTokenCount(500)).toBe(200)
    expect(clampTopTokenCount(-1)).toBe(200)
  })

  it('normalizes and caps extra token addresses', () => {
    expect(
      normalizeExtraTokenAddresses([
        '0x1111111111111111111111111111111111111111',
        '0x1111111111111111111111111111111111111111',
        'not-an-address',
        '0x2222222222222222222222222222222222222222',
      ]),
    ).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ])
  })

  it('parses comma-separated extraTokens query values', () => {
    expect(
      parseExtraTokenAddressesQuery(
        '0x1111111111111111111111111111111111111111, 0x2222222222222222222222222222222222222222',
      ),
    ).toHaveLength(2)
  })

  it('unions portfolio lookup addresses with pinned extras', () => {
    expect(
      unionZoraLookupAddresses(
        ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
        ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
      ),
    ).toEqual([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ])
  })
})

describe('resolveZoraWalletHoldings pin path', () => {
  const WALLET = '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5'
  const PINNED = '0xcccccccccccccccccccccccccccccccccccccccc'
  const IN_PORTFOLIO = '0xdddddddddddddddddddddddddddddddddddddddd'

  beforeEach(() => {
    resolveTrayWalletPortfolioMock.mockReset()
    getCoinMock.mockReset()
  })

  it('looks up a pinned creator coin absent from topTokens and omits zero balances', async () => {
    resolveTrayWalletPortfolioMock.mockResolvedValue({
      portfolio: {
        asOf: 1,
        totalUsdValue: 1,
        activeChains: [],
        topTokens: [
          {
            id: IN_PORTFOLIO,
            chain: 'base',
            name: 'Other',
            symbol: 'OTH',
            amount: 1,
            price: 1,
            usdValue: 1,
          },
        ],
        protocols: [],
      },
      source: 'debank',
    })

    getCoinMock.mockImplementation(async ({ address }: { address: string }) => {
      const lc = String(address).toLowerCase()
      if (lc === PINNED) {
        return {
          data: {
            zora20Token: {
              address: PINNED,
              symbol: 'PIN',
              name: 'Pinned Creator',
              coinType: 'CREATOR',
              tokenPrice: 2,
            },
          },
        }
      }
      return { data: { zora20Token: null } }
    })

    const readPinnedBalance = vi.fn(async () => ({ amount: 0, decimals: 18 }))

    const zeroBalance = await resolveZoraWalletHoldings({
      wallet: WALLET,
      topTokenCount: 200,
      extraTokenAddresses: [PINNED],
      readPinnedBalance,
    })
    expect(zeroBalance?.creator ?? []).toEqual([])
    expect(resolveTrayWalletPortfolioMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ topTokenCount: 200 }),
    )
    expect(readPinnedBalance).toHaveBeenCalled()

    readPinnedBalance.mockResolvedValue({ amount: 1, decimals: 18 })

    const withBalance = await resolveZoraWalletHoldings({
      wallet: WALLET,
      topTokenCount: 200,
      extraTokenAddresses: [PINNED],
      readPinnedBalance,
    })
    expect(withBalance?.creator).toEqual([
      expect.objectContaining({
        symbol: 'PIN',
        name: 'Pinned Creator',
        coinType: 'CREATOR',
        amount: 1,
        usdValue: 2,
      }),
    ])
  })

  it('still surfaces portfolio Zora coins without requiring pin', async () => {
    resolveTrayWalletPortfolioMock.mockResolvedValue({
      portfolio: {
        asOf: 2,
        totalUsdValue: 5,
        activeChains: [],
        topTokens: [
          {
            id: IN_PORTFOLIO,
            chain: 'base',
            name: 'Creator',
            symbol: 'CR',
            amount: 3,
            price: 1,
            usdValue: 3,
          },
        ],
        protocols: [],
      },
      source: 'base-etherscan',
    })
    getCoinMock.mockResolvedValue({
      data: {
        zora20Token: {
          address: IN_PORTFOLIO,
          symbol: 'CR',
          name: 'Creator',
          coinType: 'CONTENT',
        },
      },
    })

    const result = await resolveZoraWalletHoldings({
      wallet: WALLET,
      topTokenCount: 200,
    })
    expect(result?.content).toEqual([
      expect.objectContaining({
        symbol: 'CR',
        coinType: 'CONTENT',
        amount: 3,
      }),
    ])
    expect(result?.creator).toEqual([])
  })
})
