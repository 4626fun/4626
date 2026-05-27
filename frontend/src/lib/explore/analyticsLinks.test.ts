import { describe, expect, it } from 'vitest'

import {
  getDuneDashboardUrl,
  getExploreAnalyticsDocsUrl,
  getExploreAssetsManifestUrl,
} from '@/lib/explore/analyticsLinks'

describe('analyticsLinks', () => {
  it('defaults docs URL to docs.4626.fun explore analytics page', () => {
    expect(getExploreAnalyticsDocsUrl()).toBe('https://docs.4626.fun/users/explore-analytics')
  })

  it('returns null Dune URL when unset', () => {
    expect(getDuneDashboardUrl()).toBeNull()
  })

  it('resolves manifest path for integrators', () => {
    expect(getExploreAssetsManifestUrl()).toBe('/data/explore-assets-manifest.json')
  })
})
