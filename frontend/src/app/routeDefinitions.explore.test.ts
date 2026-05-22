import { describe, expect, it } from 'vitest'

import { EXPLORE_LIST_CHILD_ROUTES, EXPLORE_ROUTES } from './routeDefinitions'

describe('explore list routes', () => {
  it('redirects bare /explore to creators', () => {
    const indexRoute = EXPLORE_LIST_CHILD_ROUTES.find((route) => route.index === true)
    expect(indexRoute).toBeDefined()
    expect(indexRoute?.path).toBe('creators')
  })

  it('mounts list pages under ExploreListLayout', () => {
    const layoutRoute = EXPLORE_ROUTES.find((route) => route.path === '/explore')
    expect(layoutRoute?.children?.map((route) => route.path)).toEqual(
      expect.arrayContaining(['creators', 'content', 'vaults', 'trends', 'transactions']),
    )
  })
})
