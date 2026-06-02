import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExploreCreators } from './ExploreCreators'

const { useInfiniteQueryMock, useQueriesMock, useQueryMock, searchParamsMock } = vi.hoisted(() => ({
  useInfiniteQueryMock: vi.fn(),
  useQueriesMock: vi.fn(),
  useQueryMock: vi.fn(),
  searchParamsMock: { value: new URLSearchParams() },
}))

vi.mock('@/features/explore/useExploreCreatorsHeroMetrics', () => ({
  useExploreCreatorsHeroMetrics: () => ({
    syncStatus: 'running',
    creatorsTotalCount: 1507,
  }),
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  motion: new Proxy(
    ((component: any) => component) as any,
    {
      get: (_, tag: string) =>
        ({ children, ...props }: any) => React.createElement(tag, props, children),
    },
  ),
  m: new Proxy(
    ((component: any) => component) as any,
    {
      get: (_, tag: string) =>
        ({ children, ...props }: any) => React.createElement(tag, props, children),
    },
  ),
}))

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [searchParamsMock.value, vi.fn()],
  useLocation: () => ({ pathname: '/explore/creators', search: searchParamsMock.value.toString(), hash: '', state: null }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
  useInfiniteQuery: useInfiniteQueryMock,
  useQueries: useQueriesMock,
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

vi.mock('@/components/explore/tableColumns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/explore/tableColumns')>()
  return {
    ...actual,
    getExploreColumns: () => [],
    getHorizontalScrollStops: () => [0],
    EXPLORE_COLLAPSED_IDENTITY_WIDTH_PX: actual.EXPLORE_COLLAPSED_IDENTITY_WIDTH_PX ?? 280,
  }
})

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
  pageEdges?: any[]
  isFetching?: boolean
  isFetchingNextPage?: boolean
  hasNextPage?: boolean
  searchQuery?: string
}) {
  const pageEdges = params?.pageEdges ?? []
  searchParamsMock.value = params?.searchQuery
    ? new URLSearchParams({ q: params.searchQuery })
    : new URLSearchParams()

  useInfiniteQueryMock.mockReturnValue({
    data: {
      pages: [
        {
          edges: pageEdges,
          pageInfo: { hasNextPage: params?.hasNextPage ?? false, endCursor: null },
        },
      ],
    },
    fetchNextPage: vi.fn(),
    hasNextPage: params?.hasNextPage ?? false,
    isFetchingNextPage: params?.isFetchingNextPage ?? false,
    isFetching: params?.isFetching ?? false,
    isLoading: false,
    isError: false,
    error: null,
  })

  useQueryMock.mockReturnValue({
    data: [],
    isLoading: false,
    isFetching: false,
  })

  useQueriesMock.mockImplementation((opts: any) => {
    const queries = Array.isArray(opts?.queries) ? opts.queries : []
    return queries.map(() => ({
      data: null,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    }))
  })
}

describe('ExploreCreators', () => {
  it('shows syncing empty state when indexed totals exist but rows are empty', () => {
    configureQueries()
    const html = renderToStaticMarkup(React.createElement(ExploreCreators))

    expect(html).toContain('Creator list is still syncing')
    expect(html).not.toContain('No creators available')
  })

  it('renders loaded creator rows', () => {
    configureQueries({
      pageEdges: [{ node: BASE_COIN }],
    })

    const html = renderToStaticMarkup(React.createElement(ExploreCreators))

    expect(html).toContain('token-row')
    expect(html).toContain('Showing 1 creators')
  })

  it('does not stack loading overlay on empty search results while list refetches', () => {
    configureQueries({
      isFetching: true,
      searchQuery: 'zzzznotfound',
    })

    const html = renderToStaticMarkup(React.createElement(ExploreCreators))

    expect(html).toContain('No creators found matching your search')
    expect(html).not.toContain('Loading creators')
    expect(html).not.toContain('aria-busy="true"')
  })
})
