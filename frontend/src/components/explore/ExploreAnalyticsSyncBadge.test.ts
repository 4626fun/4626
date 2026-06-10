import { describe, expect, it } from 'vitest'

import { resolveExploreAnalyticsSyncBadge } from '@/components/explore/ExploreAnalyticsSyncBadge'

describe('resolveExploreAnalyticsSyncBadge', () => {
  it('shows partial index when backfill is incomplete', () => {
    expect(resolveExploreAnalyticsSyncBadge({ exact: false, syncStatus: 'running' }).label).toBe(
      'Partial index',
    )
  })

  it('shows full index when exact and idle', () => {
    expect(resolveExploreAnalyticsSyncBadge({ exact: true, syncStatus: 'idle' }).label).toBe('Full index')
  })

  it('shows sync error state', () => {
    expect(resolveExploreAnalyticsSyncBadge({ exact: false, syncStatus: 'error' }).label).toBe('Sync error')
  })
})
