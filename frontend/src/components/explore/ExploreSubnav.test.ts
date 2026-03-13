import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExploreSubnav } from './ExploreSubnav'

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
  useLocation: () => ({ pathname: '/explore/creators' }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

vi.mock('@/lib/uniswap/hooks', () => ({
  useUniswapServiceStatus: () => ({ data: { available: true } }),
}))

describe('ExploreSubnav', () => {
  it('renders a Trends tab that links to /explore/trends', () => {
    const html = renderToStaticMarkup(React.createElement(ExploreSubnav))

    expect(html).toContain('Trends')
    expect(html).toContain('href="/explore/trends"')
  })
})

