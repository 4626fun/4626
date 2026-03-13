import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExploreTrends } from './ExploreTrends'

const { useInfiniteQueryMock, fetchZoraExploreMock } = vi.hoisted(() => ({
  useInfiniteQueryMock: vi.fn(),
  fetchZoraExploreMock: vi.fn(),
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
  useInfiniteQuery: useInfiniteQueryMock,
}))

vi.mock('@/components/explore/ExploreSubnav', () => ({
  ExploreSubnav: () => React.createElement('div', null, 'subnav'),
}))

vi.mock('@/components/explore/PoolRow', () => ({
  PoolRow: () => React.createElement('div', null, 'pool-row'),
  PoolTableHeader: () => React.createElement('div', null, 'table-header'),
  PoolRowSkeleton: () => React.createElement('div', null, 'skeleton'),
}))

vi.mock('@/lib/zora/client', () => ({
  fetchZoraExplore: fetchZoraExploreMock,
}))

vi.mock('@/hooks/useMigratedCoins', () => ({
  useMigratedCoins: () => ({ migratedCoins: [] }),
}))

describe('ExploreTrends', () => {
  it('renders the trends page shell', () => {
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [{ edges: [], pageInfo: { hasNextPage: false, endCursor: null } }],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: null,
    })

    const html = renderToStaticMarkup(React.createElement(ExploreTrends))
    expect(html).toContain('Top Trends on Base')
  })

  it('maps default sort to TOP_VOLUME_TRENDS_24H and requests that list', async () => {
    let capturedOptions: any = null
    useInfiniteQueryMock.mockImplementation((options: any) => {
      capturedOptions = options
      return {
        data: {
          pages: [{ edges: [], pageInfo: { hasNextPage: false, endCursor: null } }],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        isError: false,
        error: null,
      }
    })
    fetchZoraExploreMock.mockResolvedValue({
      edges: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    })

    renderToStaticMarkup(React.createElement(ExploreTrends))

    expect(capturedOptions?.queryKey).toEqual(['explore', 'trends', 'TOP_VOLUME_TRENDS_24H'])
    await capturedOptions.queryFn({ pageParam: undefined })
    expect(fetchZoraExploreMock).toHaveBeenCalledWith({
      list: 'TOP_VOLUME_TRENDS_24H',
      count: 20,
      after: undefined,
    })
  })
})

