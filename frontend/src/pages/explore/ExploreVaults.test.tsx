import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExploreVaults } from './ExploreVaults'

const { useInfiniteQueryMock, apiFetchMock, searchParamsState, subnavPropsMock } = vi.hoisted(() => ({
  useInfiniteQueryMock: vi.fn(),
  apiFetchMock: vi.fn(),
  searchParamsState: { value: new URLSearchParams() },
  subnavPropsMock: vi.fn(),
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
  useSearchParams: () => [searchParamsState.value, vi.fn()],
}))

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: useInfiniteQueryMock,
}))

vi.mock('@/lib/apiBase', () => ({
  apiFetch: apiFetchMock,
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

describe('ExploreVaults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParamsState.value = new URLSearchParams()
    useInfiniteQueryMock.mockReturnValue({
      data: { pages: [{ items: [], nextCursor: null, count: 0 }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: null,
    })
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { items: [], nextCursor: null, count: 0 } }),
    })
  })

  it('normalizes unsupported params before querying vault endpoint', async () => {
    searchParamsState.value = new URLSearchParams('sort=unsupported&time=1m')
    let capturedOptions: any = null
    useInfiniteQueryMock.mockImplementation((options: any) => {
      capturedOptions = options
      return {
        data: { pages: [{ items: [], nextCursor: null, count: 0 }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        isError: false,
        error: null,
      }
    })

    renderToStaticMarkup(React.createElement(ExploreVaults))

    expect(capturedOptions?.queryKey).toEqual(['explore', 'vaults', 'volume', '1d', ''])
    expect(subnavPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currentSort: 'volume',
        currentTimeFilter: '1d',
      }),
    )

    await capturedOptions.queryFn({ pageParam: undefined })
    const [requestUrl] = apiFetchMock.mock.calls[0] as [string, unknown]
    expect(requestUrl).toContain('sort=volume')
    expect(requestUrl).toContain('time=1d')
  })
})
