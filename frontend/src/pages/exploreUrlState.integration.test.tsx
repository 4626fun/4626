// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { useExploreSubnavParams } from './exploreShared'

vi.mock('@/lib/uniswap/hooks', () => ({
  useUniswapServiceStatus: () => ({ data: { available: true } }),
}))

function UrlStateHarness() {
  const location = useLocation()
  const { currentSort, currentTimeFilter, searchQuery, handleSearchChange, handleSortChange, handleTimeFilterChange } =
    useExploreSubnavParams({
      sortValues: ['volume', 'marketCap', 'priceChange', 'new'] as const,
      defaultSort: 'volume',
      sortAliases: { fees24h: 'priceChange' },
      timeValues: ['1d', '1w', '1y'] as const,
      defaultTime: '1d',
    })

  return (
    <div>
      <ExploreSubnav
        searchPlaceholder="Search"
        searchValue={searchQuery}
        onSearch={handleSearchChange}
        onSortChange={handleSortChange}
        onTimeFilterChange={handleTimeFilterChange}
        currentSort={currentSort}
        currentTimeFilter={currentTimeFilter}
        disableUniswapTimeGating
      />
      <div data-testid="location">{`${location.pathname}${location.search}`}</div>
    </div>
  )
}

describe('Explore URL state integration', () => {
  it('canonicalizes legacy/invalid params on mount', async () => {
    const router = createMemoryRouter(
      [{ path: '/explore/content', element: <UrlStateHarness /> }],
      {
        initialEntries: ['/explore/content?sort=fees24h&time=invalid&q=%20%20coin%20%20'],
      },
    )
    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/explore/content?sort=priceChange&time=1d&q=coin')
    })
  })

  it('restores URL-backed state on back/forward navigation', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(
      [{ path: '/explore/content', element: <UrlStateHarness /> }],
      {
        initialEntries: [
          '/explore/content?sort=volume&time=1d&q=alpha',
          '/explore/content?sort=marketCap&time=1w&q=beta',
        ],
        initialIndex: 1,
      },
    )
    render(<RouterProvider router={router} />)

    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('beta')
    await user.click(screen.getByRole('button', { name: 'Price change' }))
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toContain('sort=priceChange')
    })

    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/explore/content?sort=volume&time=1d&q=alpha')
      expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('alpha')
    })

    await act(async () => {
      await router.navigate(1)
    })
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toContain('sort=priceChange')
      expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('beta')
    })
  })
})
