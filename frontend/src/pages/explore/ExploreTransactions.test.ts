import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExploreTransactions } from './ExploreTransactions'

const {
  useInfiniteQueryMock,
  fetchZoraExploreMock,
  subnavPropsMock,
  searchParamsState,
  setSearchParamsMock,
} = vi.hoisted(() => ({
  useInfiniteQueryMock: vi.fn(),
  fetchZoraExploreMock: vi.fn(),
  subnavPropsMock: vi.fn(),
  searchParamsState: { value: new URLSearchParams() },
  setSearchParamsMock: vi.fn(),
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
  Link: ({ to, children, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
  useSearchParams: () => [searchParamsState.value, setSearchParamsMock],
}))

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: useInfiniteQueryMock,
}))

vi.mock('@/components/explore/ExploreSubnav', () => ({
  ExploreSubnav: (props: any) => {
    subnavPropsMock(props)
    return React.createElement('div', null, 'subnav')
  },
}))

vi.mock('@/components/explore/ExploreMetricsDashboard', () => ({
  ExploreMetricsDashboard: () => React.createElement('div', null, 'metrics'),
}))

vi.mock('@/hooks/useWindowInfiniteScrollLoadMore', () => ({
  useWindowInfiniteScrollLoadMore: () => undefined,
}))

vi.mock('@/lib/zora/client', () => ({
  fetchZoraExplore: fetchZoraExploreMock,
}))

describe('ExploreTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParamsState.value = new URLSearchParams()
    useInfiniteQueryMock.mockReturnValue({
      data: { pages: [{ edges: [], pageInfo: { hasNextPage: false, endCursor: null } }] },
      dataUpdatedAt: new Date('2026-04-02T00:00:00Z').getTime(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: null,
    })
  })

  it('falls back to LAST_TRADED_UNIQUE when LAST_TRADED fetch fails', async () => {
    let capturedOptions: any = null
    useInfiniteQueryMock.mockImplementation((options: any) => {
      capturedOptions = options
      return {
        data: { pages: [{ edges: [], pageInfo: { hasNextPage: false, endCursor: null } }] },
        dataUpdatedAt: new Date('2026-04-02T00:00:00Z').getTime(),
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        isError: false,
        error: null,
      }
    })

    fetchZoraExploreMock
      .mockRejectedValueOnce(new Error('last traded unavailable'))
      .mockResolvedValueOnce({ edges: [], pageInfo: { hasNextPage: false, endCursor: null } })

    renderToStaticMarkup(React.createElement(ExploreTransactions))
    await capturedOptions.queryFn({ pageParam: undefined })

    expect(fetchZoraExploreMock).toHaveBeenNthCalledWith(1, {
      list: 'LAST_TRADED',
      count: 20,
      after: undefined,
    })
    expect(fetchZoraExploreMock).toHaveBeenNthCalledWith(2, {
      list: 'LAST_TRADED_UNIQUE',
      count: 20,
      after: undefined,
    })
  })

  it('normalizes unsupported sort to default sort for subnav state', () => {
    searchParamsState.value = new URLSearchParams('sort=unsupported')
    renderToStaticMarkup(React.createElement(ExploreTransactions))

    expect(subnavPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currentSort: 'new',
      }),
    )
  })

  it('normalizes unsupported time filter to 1d for subnav state', () => {
    searchParamsState.value = new URLSearchParams('time=1h')
    renderToStaticMarkup(React.createElement(ExploreTransactions))

    expect(subnavPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currentTimeFilter: '1d',
      }),
    )
  })

  it('anchors time filtering to query freshness so stale activity is excluded', () => {
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [
          {
            edges: [
              {
                node: {
                  address: '0x1111111111111111111111111111111111111111',
                  name: 'Old Coin',
                  symbol: 'OLD',
                  createdAt: '2026-03-28T00:00:00Z',
                },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        ],
      },
      dataUpdatedAt: new Date('2026-04-02T00:00:00Z').getTime(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: null,
    })

    const html = renderToStaticMarkup(React.createElement(ExploreTransactions))
    expect(html).toContain('No recent activity')
    expect(html).not.toContain('Old Coin')
  })

  it('hydrates search input from q and writes q via subnav onSearch', () => {
    searchParamsState.value = new URLSearchParams('sort=new&time=1d&q=old')
    renderToStaticMarkup(React.createElement(ExploreTransactions))

    const props = subnavPropsMock.mock.calls[0]?.[0]
    expect(props.searchValue).toBe('old')

    props.onSearch('new query')

    expect(setSearchParamsMock).toHaveBeenCalledTimes(1)
    const [nextParams, options] = setSearchParamsMock.mock.calls[0] as [URLSearchParams, { replace: boolean }]
    expect(nextParams.get('sort')).toBe('new')
    expect(nextParams.get('time')).toBe('1d')
    expect(nextParams.get('q')).toBe('new query')
    expect(options).toEqual({ replace: true })
  })
})
