// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'

import { APP_ACCEPTED_ROUTES, APP_PUBLIC_ROUTES, MARKETING_ONLY_ROUTES } from './routeDefinitions'

describe('AlfaClub host cutover route registration', () => {
  it('removes AlfaClub product routes from marketing/app route tables', () => {
    const marketingPaths = MARKETING_ONLY_ROUTES.map((route) => route.path)
    const publicPaths = APP_PUBLIC_ROUTES.map((route) => route.path)
    const acceptedPaths = APP_ACCEPTED_ROUTES.map((route) => route.path)

    expect(marketingPaths).not.toContain('/alfaclub/key-safety')
    expect(publicPaths).not.toContain('/alfaclub')
    expect(publicPaths).not.toContain('/alfaclub/trading-rooms')
    expect(acceptedPaths).not.toContain('/alfaclub/liquidity')
    expect(acceptedPaths).not.toContain('/alfaclub/liquidity-pools')
  })
})
