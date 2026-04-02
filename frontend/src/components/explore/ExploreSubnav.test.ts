import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExploreSubnav, applyExploreParamChange } from './ExploreSubnav'

const { searchParamsState, setSearchParamsMock } = vi.hoisted(() => ({
  searchParamsState: { value: new URLSearchParams() },
  setSearchParamsMock: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
  useLocation: () => ({ pathname: '/explore/creators' }),
  useSearchParams: () => [searchParamsState.value, setSearchParamsMock],
}))

vi.mock('@/lib/uniswap/hooks', () => ({
  useUniswapServiceStatus: () => ({ data: { available: true } }),
}))

describe('ExploreSubnav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParamsState.value = new URLSearchParams()
  })

  it('renders a Trends tab that links to /explore/trends', () => {
    const html = renderToStaticMarkup(React.createElement(ExploreSubnav))

    expect(html).toContain('Trends')
    expect(html).toContain('href="/explore/trends"')
  })

  it('uses callback as single source for sort updates when provided', () => {
    const onSortChange = vi.fn()
    const currentParams = new URLSearchParams('sort=volume')
    applyExploreParamChange({
      key: 'sort',
      value: 'marketCap',
      onChange: onSortChange,
      searchParams: currentParams,
      setSearchParams: setSearchParamsMock,
    })

    expect(onSortChange).toHaveBeenCalledWith('marketCap')
    expect(setSearchParamsMock).not.toHaveBeenCalled()
  })

  it('falls back to internal URL write when no sort callback is provided', () => {
    const currentParams = new URLSearchParams('time=1d')
    applyExploreParamChange({
      key: 'sort',
      value: 'marketCap',
      searchParams: currentParams,
      setSearchParams: setSearchParamsMock,
    })

    expect(setSearchParamsMock).toHaveBeenCalledTimes(1)
    const [params, options] = setSearchParamsMock.mock.calls[0] as [URLSearchParams, { replace: boolean }]
    expect(params.get('sort')).toBe('marketCap')
    expect(params.get('time')).toBe('1d')
    expect(options).toEqual({ replace: true })
  })

  it('skips fallback URL write when next sort matches current value', () => {
    const currentParams = new URLSearchParams('sort=marketCap&time=1d')
    applyExploreParamChange({
      key: 'sort',
      value: 'marketCap',
      searchParams: currentParams,
      setSearchParams: setSearchParamsMock,
    })

    expect(setSearchParamsMock).not.toHaveBeenCalled()
  })
})
