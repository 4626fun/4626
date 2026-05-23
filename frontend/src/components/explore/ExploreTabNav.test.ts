import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExploreTabNav } from './ExploreTabNav'

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
    React.createElement('a', { href: to, ...props }, children),
  useLocation: () => ({ pathname: '/explore/creators', search: '' }),
}))

describe('ExploreTabNav', () => {
  it('renders all explore list tabs with stable routes', () => {
    const html = renderToStaticMarkup(React.createElement(ExploreTabNav))

    expect(html).toContain('Creators')
    expect(html).toContain('Content')
    expect(html).toContain('Vaults')
    expect(html).toContain('Trends')
    expect(html).toContain('Transactions')
    expect(html).toContain('href="/explore/creators"')
    expect(html).toContain('href="/explore/trends"')
  })
})
