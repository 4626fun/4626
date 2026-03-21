import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExploreCreators } from './ExploreCreators'

const { useQueryMock, useInfiniteQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useInfiniteQueryMock: vi.fn(),
}))

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) =>
        ({ children, ...props }: any) => React.createElement(tag, props, children),
    },
  ),
}))

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
  useInfiniteQuery: useInfiniteQueryMock,
}))

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => null,
  META: { explore: { title: 'Explore', description: 'Explore creators' } },
}))

vi.mock('@/components/explore/ExploreSubnav', () => ({
  ExploreSubnav: () => React.createElement('div', null, 'subnav'),
}))

vi.mock('@/components/explore/TokenRow', () => ({
  TokenRow: () => React.createElement('div', null, 'token-row'),
  TokenTableHeader: () => React.createElement('div', null, 'table-header'),
  TokenRowSkeleton: () => React.createElement('div', null, 'skeleton'),
}))

vi.mock('@/components/explore/tableColumns', () => ({
  getExploreColumns: () => [],
}))

vi.mock('@/hooks/useMigratedCoins', () => ({
  useMigratedCoins: () => ({ migratedCoins: new Set<string>() }),
}))

const BASE_COIN = {
  address: '0x1111111111111111111111111111111111111111',
  creatorAddress: '0x2222222222222222222222222222222222222222',
  payoutRecipientAddress: '0x2222222222222222222222222222222222222222',
  symbol: 'TRND',
  name: 'Trend One',
  createdAt: '2026-01-01T00:00:00.000Z',
  marketCap: '5730',
  volume24h: '5730',
}

function configureQueries(params?: {
  metrics?: {
    exact: boolean
    creatorsTotal: number
    creatorsNew24h: number
    marketCap: number
    volume24h: number
    fees24h: number
  }
  liveEdges?: any[]
  pageEdges?: any[]
}) {
  const metrics = params?.metrics ?? {
    exact: false,
    creatorsTotal: 1507,
    creatorsNew24h: 12,
    marketCap: 6260000,
    volume24h: 5720,
    fees24h: 57.17,
  }
  const liveEdges = params?.liveEdges ?? []
  const pageEdges = params?.pageEdges ?? []

  useInfiniteQueryMock.mockReturnValue({
    data: {
      pages: [
        {
          edges: pageEdges,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      ],
    },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isError: false,
    error: null,
  })

  useQueryMock.mockImplementation((opts: any) => {
    const queryKey = Array.isArray(opts?.queryKey) ? opts.queryKey : []
    const queryType = String(queryKey[2] ?? '')

    if (queryType === 'metrics') {
      return {
        data: {
          exact: metrics.exact,
          syncStatus: 'running',
          updatedAt: '2025-01-01T00:00:00.000Z',
          sync: {
            lastFullSyncAt: null,
            driftEstimateTotal: null,
          },
          totals: {
            creatorsTotal: metrics.creatorsTotal,
            creatorsNew24h: metrics.creatorsNew24h,
            creatorCoinsMarketCapUsd: metrics.marketCap,
            creatorCoinsVolume24hUsd: metrics.volume24h,
            creatorCoinsFees24hUsd: metrics.fees24h,
            partial: !metrics.exact,
            sampledCreators: 100,
          },
        },
      }
    }

    if (queryType === 'live') {
      return {
        data: {
          edges: liveEdges,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      }
    }

    return {
      data: [],
      isLoading: false,
      isFetching: false,
    }
  })
}

describe('ExploreCreators', () => {
  it('uses partial-sync copy and includes live estimate status', () => {
    configureQueries()
    const html = renderToStaticMarkup(React.createElement(ExploreCreators))

    expect(html).toContain('Indexed creators')
    expect(html).toContain('1,507')
    expect(html).toContain('Creator list is still syncing')
    expect(html).toContain('Live estimate updates every 10s')
    expect(html).not.toContain('No creators available')
  })

  it('prefers live metric cards when canonical totals are partial', () => {
    configureQueries({
      metrics: {
        exact: false,
        creatorsTotal: 2000,
        creatorsNew24h: 25,
        marketCap: 100,
        volume24h: 200,
        fees24h: 2,
      },
      liveEdges: [{ node: BASE_COIN }],
      pageEdges: [{ node: BASE_COIN }],
    })

    const html = renderToStaticMarkup(React.createElement(ExploreCreators))

    expect(html).toContain('Live estimate updates every 10s')
    expect(html).toContain('Indexed 1 creators')
    expect(html).toContain('$5.73K')
    expect(html).toContain('$57.30')
    expect(html).not.toContain('$100.00')
  })
})
