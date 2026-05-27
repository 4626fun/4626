import { describe, expect, it } from 'vitest'

import {
  buildExploreTabSearchParams,
  getExploreListTabKey,
  shouldShowExploreTableLoading,
} from './exploreListNavigation'

describe('exploreListNavigation', () => {
  it('resolves list tab keys from pathname', () => {
    expect(getExploreListTabKey('/explore/creators')).toBe('/explore/creators')
    expect(getExploreListTabKey('/explore/creators/base/0xabc')).toBeNull()
  })

  it('preserves only q when building tab search', () => {
    expect(buildExploreTabSearchParams('?sort=ethosScore&time=1d&q=akita')).toBe('?q=akita')
    expect(buildExploreTabSearchParams('?sort=volume')).toBe('')
    expect(buildExploreTabSearchParams(undefined)).toBe('')
    expect(buildExploreTabSearchParams(null)).toBe('')
  })

  it('shows table loading on initial fetch without rows', () => {
    expect(shouldShowExploreTableLoading({ isLoading: true, isFetching: true, hasRows: false })).toBe(true)
    expect(shouldShowExploreTableLoading({ isLoading: false, isFetching: true, hasRows: false })).toBe(true)
    expect(shouldShowExploreTableLoading({ isLoading: false, isFetching: true, hasRows: true })).toBe(false)
  })

  it('suppresses table overlay during active search with no rows', () => {
    expect(
      shouldShowExploreTableLoading({
        isLoading: false,
        isFetching: true,
        hasRows: false,
        hasActiveSearch: true,
      }),
    ).toBe(false)
  })
})
