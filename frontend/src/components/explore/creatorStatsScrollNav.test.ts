import { describe, expect, it } from 'vitest'

import { buildCreatorStatsSnapPoints } from './creatorStatsVisual'
import {
  CREATOR_STATS_TIMELINE_LABELS,
  nearestCreatorStatsSnapProgress,
  resolveCreatorStatsActiveSnapIndex,
} from './creatorStatsScrollNav'

describe('creatorStatsScrollNav', () => {
  const total = 6
  const snapPoints = buildCreatorStatsSnapPoints(total)

  it('exposes timeline labels for each stat plus finale', () => {
    expect(CREATOR_STATS_TIMELINE_LABELS).toHaveLength(total + 1)
    expect(CREATOR_STATS_TIMELINE_LABELS[0]).toBe('volume')
    expect(CREATOR_STATS_TIMELINE_LABELS.at(-1)).toBe('finale')
  })

  it('resolves the nearest snap index for scroll progress', () => {
    expect(resolveCreatorStatsActiveSnapIndex(snapPoints[2]!, snapPoints)).toBe(2)
    expect(resolveCreatorStatsActiveSnapIndex(snapPoints.at(-1)!, snapPoints)).toBe(snapPoints.length - 1)
  })

  it('snaps arbitrary progress to the nearest hold point', () => {
    const nearSecond = snapPoints[1]! + (snapPoints[2]! - snapPoints[1]!) * 0.2
    expect(nearestCreatorStatsSnapProgress(nearSecond, total)).toBe(snapPoints[1])
  })
})
