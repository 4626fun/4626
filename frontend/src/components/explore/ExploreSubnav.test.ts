import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExploreSubnav, applyExploreParamChange } from './ExploreSubnav'

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
  useLocation: () => ({ pathname: '/explore/creators' }),
}))

vi.mock('@/lib/uniswap/hooks', () => ({
  useUniswapServiceStatus: () => ({ data: { available: true } }),
}))

describe('ExploreSubnav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a Trends tab that links to /explore/trends', () => {
    const html = renderToStaticMarkup(React.createElement(ExploreSubnav))

    expect(html).toContain('Trends')
    expect(html).toContain('href="/explore/trends"')
  })

  it('uses callback as single source for sort updates when provided', () => {
    const onSortChange = vi.fn()
    applyExploreParamChange({
      value: 'marketCap',
      currentValue: 'volume',
      onChange: onSortChange,
    })

    expect(onSortChange).toHaveBeenCalledWith('marketCap')
  })

  it('skips change callback when next value matches current value', () => {
    const onSortChange = vi.fn()
    applyExploreParamChange({
      value: 'marketCap',
      currentValue: 'marketCap',
      onChange: onSortChange,
    })

    expect(onSortChange).not.toHaveBeenCalled()
  })

  it('no-ops when no callback is provided', () => {
    applyExploreParamChange({
      value: 'marketCap',
      currentValue: 'volume',
    })
  })
})
