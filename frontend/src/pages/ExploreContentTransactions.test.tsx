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
          dataUpdatedAt: new Date('2026-04-02T00:00:00Z').getTime(),
        }
      }
      if (queryKey.includes('poolSwaps')) {
        return { data: [], isLoading: false, dataUpdatedAt: new Date('2026-04-02T00:00:00Z').getTime() }
      }
      return { data: [], isLoading: false, dataUpdatedAt: new Date('2026-04-02T00:00:00Z').getTime() }
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

  it('anchors time filtering to query freshness so stale swaps are excluded', () => {
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
          dataUpdatedAt: new Date('2026-04-02T00:00:00Z').getTime(),
        }
      }
      if (queryKey.includes('poolsByToken')) {
        return {
          data: [
            {
              id: 'pool-1',
              totalValueLockedUSD: '1000',
              token0: { symbol: 'TEST' },
              token1: { symbol: 'WETH' },
            },
          ],
          isLoading: false,
          dataUpdatedAt: new Date('2026-04-02T00:00:00Z').getTime(),
        }
      }
      if (queryKey.includes('poolSwaps')) {
        return {
          data: [
            {
              id: 'swap-1',
              amount0: '1',
              amount1: '-1',
              amountUSD: '25',
              timestamp: '1711929600', // 2024-04-01T00:00:00Z, stale relative to 2026 dataUpdatedAt
              token0: { id: '0x1111111111111111111111111111111111111111', symbol: 'TEST' },
              token1: { id: '0x2222222222222222222222222222222222222222', symbol: 'WETH' },
              transaction: { id: '0xtx', timestamp: '1711929600' },
              origin: '0x3333333333333333333333333333333333333333',
              sender: '0x3333333333333333333333333333333333333333',
            },
          ],
          isLoading: false,
          dataUpdatedAt: new Date('2026-04-02T00:00:00Z').getTime(),
        }
      }
      return { data: [], isLoading: false, dataUpdatedAt: new Date('2026-04-02T00:00:00Z').getTime() }
    })

    searchParamsState.value = new URLSearchParams('time=1d')
    const html = renderToStaticMarkup(React.createElement(ExploreContentTransactions))

    expect(html).toContain('No swap transactions found for this content pool yet.')
    expect(html).not.toContain('0xtx')
  })
})
