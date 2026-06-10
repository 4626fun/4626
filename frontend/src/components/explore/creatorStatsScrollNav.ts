import gsap from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import type { ScrollTrigger } from 'gsap/ScrollTrigger'

import { buildCreatorStatsSnapPoints, snapCreatorStatsProgress } from './creatorStatsVisual'

gsap.registerPlugin(ScrollToPlugin)

export const CREATOR_STATS_FINALE_NAV_LABEL = 'All metrics'

/** GSAP timeline / snap nav labels aligned to `CreatorStatItem.id` order + finale. */
export const CREATOR_STATS_TIMELINE_LABELS = [
  'volume',
  'marketCap',
  'holders',
  'ethos',
  'coinsCreated',
  'created',
  'finale',
] as const

export function resolveCreatorStatsActiveSnapIndex(progress: number, snapPoints: number[]): number {
  if (snapPoints.length === 0) return 0

  let closestIndex = 0
  let minDistance = Infinity
  snapPoints.forEach((point, index) => {
    const distance = Math.abs(progress - point)
    if (distance < minDistance) {
      minDistance = distance
      closestIndex = index
    }
  })
  return closestIndex
}

export function scrollToCreatorStatsSnapPoint(
  scrollTrigger: ScrollTrigger,
  progress: number,
  options?: { duration?: number; immediate?: boolean },
): void {
  const y = scrollTrigger.start + (scrollTrigger.end - scrollTrigger.start) * gsap.utils.clamp(0, 1, progress)
  const duration = options?.immediate ? 0 : (options?.duration ?? 0.9)

  gsap.to(window, {
    scrollTo: { y, autoKill: true },
    duration,
    ease: 'power2.inOut',
    overwrite: 'auto',
  })
}

export function scrollToCreatorStatsSnapIndex(
  scrollTrigger: ScrollTrigger,
  statCount: number,
  snapIndex: number,
  options?: { duration?: number; immediate?: boolean },
): void {
  const snapPoints = buildCreatorStatsSnapPoints(statCount)
  const clampedIndex = gsap.utils.clamp(0, snapPoints.length - 1, snapIndex)
  const progress = snapPoints[clampedIndex] ?? 0
  scrollToCreatorStatsSnapPoint(scrollTrigger, progress, options)
}

export function nearestCreatorStatsSnapProgress(progress: number, statCount: number): number {
  return snapCreatorStatsProgress(progress, buildCreatorStatsSnapPoints(statCount))
}
