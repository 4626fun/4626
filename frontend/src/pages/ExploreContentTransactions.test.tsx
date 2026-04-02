import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExploreContentTransactions } from './ExploreContentTransactions'

const { useQueryMock, searchParamsState, setSearchParamsMock, subnavPropsMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  searchParamsState: { value: new URLSearchParams() },
  setSearchParamsMock: vi.fn(),
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
  Navigate: ({ to }: any) => React.createElement('div', { 'data-to': to }),
  useParams: () => ({
    chain: 'base',
    contentCoinAddress: '0x1111111111111111111111111111111111111111',
  }),
  useSearchParams: () => [searchParamsState.value, setSearchParamsMock],
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}))

vi.mock('@/components/explore/ExploreSubnav', () => ({
  ExploreSubnav: (props: any) => {
    subnavPropsMock(props)
    return React.createElement('div', null, 'subnav')
  },
}))

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => null,
}))

describe('ExploreContentTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'coin') {
        return {
          data: {
            name: 'Test Coin',
            symbol: 'TEST',
            description: 'desc',
            creatorProfile: { handle: 'tester.base.eth' },
            marketCap: '100',
            uniqueHolders: '5',
            createdAt: '2026-04-01T00:00:00Z',
            mediaContent: null,
          },
          isLoading: false,
        }
      }
      if (queryKey.includes('poolSwaps')) {
        return { data: [], isLoading: false }
      }
      return { data: [], isLoading: false }
    })
  })

  it('hydrates subnav state from URL params', () => {
    searchParamsState.value = new URLSearchParams('sort=volume&time=1w&q=abc123')
    renderToStaticMarkup(React.createElement(ExploreContentTransactions))

    expect(subnavPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currentSort: 'volume',
        currentTimeFilter: '1w',
        searchValue: 'abc123',
      }),
    )
  })

  it('writes trimmed search query into URL params', () => {
    searchParamsState.value = new URLSearchParams('sort=new&time=1d')
    renderToStaticMarkup(React.createElement(ExploreContentTransactions))
    const props = subnavPropsMock.mock.calls[0]?.[0]
    expect(props).toBeTruthy()

    props.onSearch('  wallet:0xabc  ')

    expect(setSearchParamsMock).toHaveBeenCalledTimes(1)
    const [nextParams, options] = setSearchParamsMock.mock.calls[0] as [URLSearchParams, { replace?: boolean }]
    expect(nextParams.get('sort')).toBe('new')
    expect(nextParams.get('time')).toBe('1d')
    expect(nextParams.get('q')).toBe('wallet:0xabc')
    expect(options).toEqual({ replace: true })
  })
})
