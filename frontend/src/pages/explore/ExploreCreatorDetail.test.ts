import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExploreCreatorDetail } from './ExploreCreatorDetail'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
  Navigate: ({ to }: any) => React.createElement('div', null, `Navigate:${to}`),
  useParams: () => ({ chain: 'base', tokenAddress: '0x1111111111111111111111111111111111111111' }),
}))

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => null,
}))

vi.mock('@/components/explore/CreatorEthosAvatar', () => ({
  CreatorEthosAvatar: () => React.createElement('div', { 'data-testid': 'creator-ethos-avatar' }),
}))

vi.mock('@/components/explore/ethosPageTheme', () => ({
  useCreatorEthosPageTheme: () => ({
    ethosUserkey: null,
    ethosScore: null,
    theme: {
      isActive: false,
      accentTextClass: 'text-zinc-400',
      accentStrongTextClass: 'text-white',
      levelLabel: 'Neutral',
      dividerStyle: {},
      outlineCtaClass: 'border-white/20 text-white hover:bg-white/10',
    },
    hasPositiveScore: false,
    isLoading: false,
  }),
}))

vi.mock('@/components/explore/EthosPageAmbience', () => ({
  EthosPageAmbience: () => null,
  EthosHeroScoreWash: () => null,
  EthosBlurOrbs: () => null,
}))

vi.mock('@/components/explore/CreatorImmersiveStatsBeat', () => ({
  CreatorImmersiveStatsBeat: () =>
    React.createElement(
      'div',
      { 'data-testid': 'creator-immersive-stats-beat' },
      React.createElement('span', null, '24H volume'),
      React.createElement('span', null, 'Market cap'),
      React.createElement('span', null, 'Ethos score'),
    ),
}))

vi.mock('@/components/explore/CreatorVaultReserveBeat', () => ({
  CreatorVaultReserveBeat: () =>
    React.createElement('div', { 'data-testid': 'creator-vault-reserve-beat' }, 'Creator vaults & strategies.'),
}))

vi.mock('@/lib/zora/client', () => ({
  fetchZoraCoin: vi.fn(async () => ({
    address: '0x1111111111111111111111111111111111111111',
    creatorAddress: '0x2222222222222222222222222222222222222222',
    creatorProfile: { handle: 'akita' },
    payoutRecipientAddress: '0x2222222222222222222222222222222222222222',
    name: 'Jesse Pollak',
    symbol: 'JESSE',
    volume24h: '12345',
    marketCap: '67890',
    uniqueHolders: 123,
    createdAt: '2026-03-08T00:00:00.000Z',
  })),
}))

vi.mock('@/lib/zora/hooks', () => ({
  useZoraProfile: () => ({
    data: {
      displayName: 'Jesse Pollak',
      handle: 'jessepollak',
      publicWallet: { walletAddress: '0x2222222222222222222222222222222222222222' },
    },
  }),
  useZoraProfileCoins: () => ({
    data: {
      createdCoins: {
        edges: Array.from({ length: 45 }, (_, index) => ({
          node: {
            id: `coin-${index}`,
            address: `0x${String(index + 1).padStart(40, '0')}`,
            coinType: index === 0 ? 'CREATOR' : 'CONTENT',
            name: `Coin ${index}`,
            symbol: `C${index}`,
            createdAt: `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}T00:00:00.000Z`,
          },
        })),
      },
    },
    isLoading: false,
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'coin') {
      return {
        data: {
          address: '0x1111111111111111111111111111111111111111',
          creatorAddress: '0x2222222222222222222222222222222222222222',
          creatorProfile: { handle: 'jessepollak' },
          payoutRecipientAddress: '0x2222222222222222222222222222222222222222',
          name: 'Jesse Pollak',
          symbol: 'JESSE',
          volume24h: '12345',
          marketCap: '67890',
          uniqueHolders: 123,
          createdAt: '2026-03-08T00:00:00.000Z',
        },
        isLoading: false,
      }
    }

    if (queryKey[0] === 'uniswap' && queryKey[1] === 'poolsByToken') {
      return {
        data: [{
          id: '0xpool',
          token0: { id: '0x1111111111111111111111111111111111111111', symbol: 'JESSE', name: 'Jesse', decimals: '18' },
          token1: { id: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: '18' },
          feeTier: '3000',
          liquidity: '0',
          sqrtPrice: '0',
          token0Price: '0',
          token1Price: '0',
          volumeUSD: '0',
          feesUSD: '0',
          txCount: '0',
          totalValueLockedUSD: '1000',
          hooks: '',
          createdAtTimestamp: '0',
        }],
        isLoading: false,
      }
    }

    if (queryKey[0] === 'uniswap' && queryKey[1] === 'poolSwaps') {
      return {
        data: [{
          id: 'swap-1',
          timestamp: '1710000000',
          transaction: { id: '0xtxhash', timestamp: '1710000000' },
          token0: { id: '0x1111111111111111111111111111111111111111', symbol: 'JESSE', decimals: '18' },
          token1: { id: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: '18' },
          sender: '0x3333333333333333333333333333333333333333',
          origin: '0x4444444444444444444444444444444444444444',
          amount0: '-12.5',
          amount1: '0.04',
          amountUSD: '125',
        }],
        isLoading: false,
      }
    }

    return { data: undefined, isLoading: false }
  }),
}))

vi.mock('@/lib/uniswap/hooks', () => ({
  usePoolHistory: () => ({
    data: { timeframe: '1d', volumeUSD: 125, feesUSD: 5, tvlUSD: 1000, priceChangePercent: 2, dataPoints: [] },
    isLoading: false,
  }),
}))

describe('ExploreCreatorDetail', () => {
  it('renders recent creator transactions and a creator chat CTA', () => {
    const html = renderToStaticMarkup(React.createElement(ExploreCreatorDetail))

    expect(html).toContain('Recent Activity')
    expect(html).toContain('Latest swaps from the highest-liquidity pool')
    expect(html).toContain('$125.00')
    expect(html).toContain('Message Creator')
    expect(html).toContain('data-testid="creator-immersive-stats-beat"')
    expect(html).toContain('24H volume')
    expect(html).toContain('Market cap')
    expect(html).toContain('data-testid="creator-vault-reserve-beat"')
  })
})
