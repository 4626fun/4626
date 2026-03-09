import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExploreCreators } from './ExploreCreators'

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
  useQuery: vi.fn(() => ({
    data: {
      exact: false,
      syncStatus: 'running',
      sync: {
        lastFullSyncAt: null,
      },
      totals: {
        creatorsTotal: 1507,
        creatorsNew24h: 12,
        creatorCoinsMarketCapUsd: 6260000,
        creatorCoinsVolume24hUsd: 5720,
        creatorCoinsFees24hUsd: 57.17,
      },
    },
  })),
  useInfiniteQuery: vi.fn(() => ({
    data: {
      pages: [
        {
          edges: [],
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
  })),
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
  useMigratedCoins: () => ({ migratedCoins: [] }),
}))

describe('ExploreCreators', () => {
  it('uses partial-sync copy instead of claiming no creators exist', () => {
    const html = renderToStaticMarkup(React.createElement(ExploreCreators))

    expect(html).toContain('Indexed creators')
    expect(html).toContain('1,507')
    expect(html).toContain('Creator list is still syncing')
    expect(html).not.toContain('No creators available')
  })
})
