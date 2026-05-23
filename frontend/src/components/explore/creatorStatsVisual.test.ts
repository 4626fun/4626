import { describe, expect, it } from 'vitest'

import {
  CREATOR_STATS_FINALE_START,
  CREATOR_STATS_REVEALED_OPACITY,
  CREATOR_STATS_SLOT_HOLD_RATIO,
  buildCreatorStatsSnapPoints,
  creatorStatsHoldSampleProgress,
  creatorStatsStackMinHeightPx,
  getCreatorStatSlotFocus,
  getCreatorStatVisualState,
  snapCreatorStatsProgress,
} from './creatorStatsVisual'

describe('creatorStatsVisual', () => {
  const total = 6

  it('reveals the first stat at the start of scroll', () => {
    const state = getCreatorStatVisualState(0.02, 0, total)
    expect(state.visible).toBe(true)
    expect(state.opacity).toBeGreaterThan(0)
    expect(state.focus).toBeGreaterThan(0)
  })

  it('keeps earlier stats dimmed once focus moves forward', () => {
    const midProgress = creatorStatsHoldSampleProgress(2, total)
    const nearestPast = getCreatorStatVisualState(midProgress, 1, total)
    const oldestPast = getCreatorStatVisualState(midProgress, 0, total)
    const active = getCreatorStatVisualState(midProgress, 2, total)

    expect(nearestPast.visible).toBe(true)
    expect(nearestPast.opacity).toBeGreaterThan(0.55)
    expect(nearestPast.opacity).toBeLessThanOrEqual(CREATOR_STATS_REVEALED_OPACITY + 0.01)
    expect(nearestPast.blur).toBeGreaterThan(3)
    expect(oldestPast.opacity).toBeLessThan(nearestPast.opacity)
    expect(oldestPast.blur).toBeGreaterThan(nearestPast.blur)
    expect(active.opacity).toBeGreaterThan(CREATOR_STATS_REVEALED_OPACITY)
    expect(active.focus).toBe(1)
  })

  it('holds each stat at full focus mid-slot before advancing', () => {
    for (let index = 0; index < total; index += 1) {
      const holdProgress = creatorStatsHoldSampleProgress(index, total)
      expect(getCreatorStatSlotFocus(holdProgress, index, total)).toBe(1)
    }
    expect(CREATOR_STATS_SLOT_HOLD_RATIO).toBeGreaterThan(0.7)
  })

  it('maps most scroll distance within a segment to the hold plateau', () => {
    const slotSize = CREATOR_STATS_FINALE_START / total
    // Middle of the scroll hold band (10% enter + 84% hold).
    const holdScrollMid = slotSize * (0.1 + 0.84 * 0.5)
    const progress = slotSize + holdScrollMid
    expect(getCreatorStatSlotFocus(progress, 1, total)).toBe(1)
  })

  it('shows every stat in the finale segment after the stagger window', () => {
    for (let index = 0; index < total; index += 1) {
      const state = getCreatorStatVisualState(0.94, index, total)
      expect(state.finale).toBe(true)
      expect(state.visible).toBe(true)
      expect(state.opacity).toBe(1)
    }
  })

  it('grows stack height for finale and deeper stacks', () => {
    expect(creatorStatsStackMinHeightPx(0.1, total)).toBeLessThan(creatorStatsStackMinHeightPx(0.98, total))
  })

  it('builds snap points at each stat hold and the finale', () => {
    const points = buildCreatorStatsSnapPoints(total)
    expect(points).toHaveLength(total + 1)
    expect(points[0]).toBeLessThan(points[1]!)
    expect(points[points.length - 1]!).toBeGreaterThan(CREATOR_STATS_FINALE_START)
    expect(snapCreatorStatsProgress(points[2]! + 0.01, points)).toBe(points[2])
  })

  it('lays out finale stats vertically below the section title', () => {
    const first = getCreatorStatVisualState(0.94, 0, total)
    const second = getCreatorStatVisualState(0.94, 1, total)
    expect(first.finale).toBe(true)
    expect(first.x).toBe(0)
    expect(second.x).toBe(0)
    expect(first.y).toBeGreaterThanOrEqual(0)
    expect(second.y).toBeGreaterThan(first.y)
  })
})
