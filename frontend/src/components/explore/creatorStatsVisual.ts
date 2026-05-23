import gsap from 'gsap'

/** Scroll progress where sequential reveal ends and the all-stats finale begins. */
export const CREATOR_STATS_FINALE_START = 0.68

/** Share of the finale segment used to stagger stats in; the rest is a hold plateau. */
export const CREATOR_STATS_FINALE_ENTER_SHARE = 0.22

/** Opacity for the most recently revealed stat (still visible, no longer in focus). */
export const CREATOR_STATS_REVEALED_OPACITY = 0.69

/** Share of each stat slot spent fading in (dice-roll + count-up). */
export const CREATOR_STATS_SLOT_ENTER_RATIO = 0.14

/** Share of each stat slot held at full focus before handing off to the next stat. */
export const CREATOR_STATS_SLOT_HOLD_RATIO = 0.78

/** Share of each stat slot used for a soft crossfade into the next stat. */
export const CREATOR_STATS_SLOT_EXIT_RATIO = 0.18

/** Scroll share of each stat segment used for fade-in (rest maps to hold + handoff). */
const SLOT_SCROLL_ENTER_SHARE = 0.1

/** Scroll share where the stat stays pinned at full focus. */
const SLOT_SCROLL_HOLD_SHARE = 0.84

const STACK_GAP_PX = 96
const FINALE_ROW_GAP_PX = 58
const REVEALED_SCALE = 0.72
const FINALE_SCALE = 0.46
const PAST_BLUR_MIN_PX = 3
const PAST_BLUR_STEP_PX = 2
const PAST_OPACITY_STEP = 0.08
const ENTER_EASE = 'sine.out'
const EXIT_EASE = 'sine.inOut'
const FINALE_EASE = 'power1.inOut'

function pastStatVisual(stackDepth: number): { opacity: number; blur: number } {
  const depth = Math.max(1, stackDepth)
  return {
    opacity: gsap.utils.clamp(
      0.42,
      CREATOR_STATS_REVEALED_OPACITY,
      CREATOR_STATS_REVEALED_OPACITY - (depth - 1) * PAST_OPACITY_STEP,
    ),
    blur: gsap.utils.clamp(2.5, 9, PAST_BLUR_MIN_PX + (depth - 1) * PAST_BLUR_STEP_PX),
  }
}

export type CreatorStatVisualState = {
  opacity: number
  focus: number
  x: number
  y: number
  blur: number
  scale: number
  finale: boolean
  visible: boolean
  zIndex: number
}

function revealSlotSize(total: number, revealEnd: number = CREATOR_STATS_FINALE_START): number {
  if (total <= 0) return revealEnd
  return revealEnd / total
}

/** Map wheel/scroll distance within a stat segment so most scroll stays on the hold plateau. */
function scrollSegmentToSlotLocal(segmentT: number): number {
  const t = gsap.utils.clamp(0, 1, segmentT)
  const enterEnd = CREATOR_STATS_SLOT_ENTER_RATIO
  const holdEnd = CREATOR_STATS_SLOT_ENTER_RATIO + CREATOR_STATS_SLOT_HOLD_RATIO
  const scrollHoldEnd = SLOT_SCROLL_ENTER_SHARE + SLOT_SCROLL_HOLD_SHARE

  if (t <= SLOT_SCROLL_ENTER_SHARE) {
    return gsap.utils.mapRange(0, SLOT_SCROLL_ENTER_SHARE, 0, enterEnd, t)
  }

  if (t <= scrollHoldEnd) {
    return gsap.utils.mapRange(SLOT_SCROLL_ENTER_SHARE, scrollHoldEnd, enterEnd, holdEnd, t)
  }

  return gsap.utils.mapRange(scrollHoldEnd, 1, holdEnd, 1, t)
}

function revealSlotCursor(scrollProgress: number, total: number, revealEnd: number = CREATOR_STATS_FINALE_START): number {
  const slotSize = revealSlotSize(total, revealEnd)
  const rawSlot = scrollProgress / slotSize
  const index = Math.floor(rawSlot)
  const segmentT = rawSlot - index
  const remappedLocal = scrollSegmentToSlotLocal(segmentT)
  return gsap.utils.clamp(0, Math.max(0, total - 1) + 0.999, index + remappedLocal)
}

function stackAnchorY(slotCursor: number): number {
  return slotCursor * (STACK_GAP_PX * 0.5)
}

/** Focus for the active stat within its scroll slot (enter → hold → soft exit). */
export function getCreatorStatSlotFocus(scrollProgress: number, index: number, total: number): number {
  if (total <= 0) return 1

  const slotCursor = revealSlotCursor(scrollProgress, total)
  const localT = slotCursor - index
  if (localT <= 0 || localT >= 1) return localT >= 1 ? 0 : 0

  const enterEnd = CREATOR_STATS_SLOT_ENTER_RATIO
  const holdEnd = CREATOR_STATS_SLOT_ENTER_RATIO + CREATOR_STATS_SLOT_HOLD_RATIO

  if (localT < enterEnd) {
    const enterT = gsap.utils.clamp(0, 1, localT / enterEnd)
    return gsap.parseEase(ENTER_EASE)(enterT)
  }

  if (localT < holdEnd) {
    return 1
  }

  const exitT = gsap.utils.clamp(
    0,
    1,
    (localT - holdEnd) / Math.max(CREATOR_STATS_SLOT_EXIT_RATIO, 0.001),
  )
  return gsap.utils.interpolate(1, 0, gsap.parseEase(EXIT_EASE)(exitT))
}

/** True when scroll progress is in the all-stats finale segment. */
export function isCreatorStatsFinaleProgress(scrollProgress: number): boolean {
  return scrollProgress >= CREATOR_STATS_FINALE_START
}

function finaleLayoutY(index: number): number {
  return 8 + index * FINALE_ROW_GAP_PX
}

function finaleStatEnter(finaleT: number, index: number, total: number): number {
  if (finaleT >= CREATOR_STATS_FINALE_ENTER_SHARE) return 1

  const staggerSpan = CREATOR_STATS_FINALE_ENTER_SHARE / Math.max(total, 1)
  const statStart = index * staggerSpan * 0.85
  const localT = gsap.utils.clamp(0, 1, (finaleT - statStart) / Math.max(staggerSpan * 0.55, 0.001))
  return gsap.parseEase(FINALE_EASE)(localT)
}

function futureStatVisual(preEnter: number): Pick<CreatorStatVisualState, 'opacity' | 'focus' | 'y' | 'blur' | 'scale' | 'visible'> {
  const t = gsap.parseEase(ENTER_EASE)(preEnter)
  return {
    opacity: t * 0.12,
    focus: t * 0.15,
    y: 22 * (1 - t),
    blur: 6 * (1 - t),
    scale: gsap.utils.interpolate(REVEALED_SCALE, 0.96, t),
    visible: t > 0.02,
  }
}

function pastStatState(
  stackDepth: number,
  slotCursor: number,
  index: number,
): Pick<CreatorStatVisualState, 'opacity' | 'focus' | 'y' | 'blur' | 'scale' | 'visible' | 'zIndex'> {
  const depth = Math.max(1, stackDepth)
  const past = pastStatVisual(depth)
  const anchor = stackAnchorY(slotCursor)
  const fractionalDepth = Math.max(1, slotCursor - index)

  return {
    opacity: past.opacity,
    focus: 0,
    y: anchor - fractionalDepth * STACK_GAP_PX,
    blur: past.blur,
    scale: REVEALED_SCALE,
    visible: true,
    zIndex: index + 1,
  }
}

/** Scroll-scrubbed layout for one stat cell in the immersive beat. */
export function getCreatorStatVisualState(
  scrollProgress: number,
  index: number,
  total: number,
): CreatorStatVisualState {
  if (total <= 0) {
    return { opacity: 1, focus: 1, x: 0, y: 0, blur: 0, scale: 1, finale: true, visible: true, zIndex: 1 }
  }

  const clampedProgress = gsap.utils.clamp(0, 1, scrollProgress)

  if (clampedProgress >= CREATOR_STATS_FINALE_START) {
    const finaleT = gsap.utils.clamp(
      0,
      1,
      (clampedProgress - CREATOR_STATS_FINALE_START) / (1 - CREATOR_STATS_FINALE_START),
    )
    const enter = finaleStatEnter(finaleT, index, total)
    const settle = enter
    const layoutY = finaleLayoutY(index)

    return {
      opacity: enter,
      focus: 1,
      x: 0,
      y: gsap.utils.interpolate(layoutY + 12, layoutY, settle),
      blur: gsap.utils.interpolate(3, 0, settle),
      scale: gsap.utils.interpolate(1, FINALE_SCALE, settle),
      finale: true,
      visible: enter > 0.02,
      zIndex: index + 1,
    }
  }

  const slotCursor = revealSlotCursor(clampedProgress, total)
  const delta = slotCursor - index
  const anchor = stackAnchorY(slotCursor)

  if (delta < -0.14) {
    return {
      opacity: 0,
      focus: 0,
      x: 0,
      y: anchor + 24,
      blur: 6,
      scale: 0.96,
      finale: false,
      visible: false,
      zIndex: index,
    }
  }

  if (delta < 0) {
    const pre = futureStatVisual(gsap.utils.clamp(0, 1, gsap.utils.mapRange(-0.14, 0, 0, 1, delta)))
    return {
      ...pre,
      x: 0,
      y: anchor + pre.y,
      finale: false,
      zIndex: index,
    }
  }

  if (delta >= 1) {
    return {
      ...pastStatState(delta, slotCursor, index),
      x: 0,
      finale: false,
    }
  }

  const easedFocus = getCreatorStatSlotFocus(clampedProgress, index, total)
  const exitBlend =
    delta > CREATOR_STATS_SLOT_ENTER_RATIO + CREATOR_STATS_SLOT_HOLD_RATIO
      ? gsap.utils.clamp(
          0,
          1,
          (delta - (CREATOR_STATS_SLOT_ENTER_RATIO + CREATOR_STATS_SLOT_HOLD_RATIO)) /
            Math.max(CREATOR_STATS_SLOT_EXIT_RATIO, 0.001),
        )
      : 0
  const pastBlend = gsap.parseEase(EXIT_EASE)(exitBlend)
  const past = pastStatVisual(1)

  return {
    opacity: gsap.utils.interpolate(
      gsap.utils.interpolate(CREATOR_STATS_REVEALED_OPACITY, 1, easedFocus),
      past.opacity,
      pastBlend * 0.85,
    ),
    focus: easedFocus,
    x: 0,
    y: gsap.utils.interpolate(anchor + 22 * (1 - easedFocus), anchor - STACK_GAP_PX * 0.12, pastBlend * 0.85),
    blur: gsap.utils.interpolate(6 * (1 - easedFocus), past.blur, pastBlend * 0.7),
    scale: gsap.utils.interpolate(REVEALED_SCALE, 1, easedFocus),
    finale: false,
    visible: easedFocus > 0.02 || pastBlend > 0.04,
    zIndex: total + 2,
  }
}

/** Minimum stack area height (px) for the pinned stats viewport. */
export function creatorStatsStackMinHeightPx(scrollProgress: number, total: number): number {
  if (total <= 0) return 128

  if (scrollProgress >= CREATOR_STATS_FINALE_START) {
    return Math.max(420, total * FINALE_ROW_GAP_PX + 112)
  }

  const slotCursor = revealSlotCursor(scrollProgress, total)
  return Math.max(200, 140 + slotCursor * (STACK_GAP_PX * 0.72))
}

/** Progress point in the middle of a stat's hold plateau (for tests / tuning). */
export function creatorStatsHoldSampleProgress(statIndex: number, total: number): number {
  const slotSize = revealSlotSize(total)
  const holdScrollMid = SLOT_SCROLL_ENTER_SHARE + SLOT_SCROLL_HOLD_SHARE * 0.5
  return statIndex * slotSize + slotSize * holdScrollMid
}

/** ScrollTrigger.snap targets — center of each stat hold, plus the all-stats finale. */
export function buildCreatorStatsSnapPoints(total: number): number[] {
  if (total <= 0) return [0]

  const slotSize = revealSlotSize(total)
  const holdScrollMid = SLOT_SCROLL_ENTER_SHARE + SLOT_SCROLL_HOLD_SHARE * 0.5
  const points: number[] = []

  for (let index = 0; index < total; index += 1) {
    points.push(Math.min(CREATOR_STATS_FINALE_START - 0.001, index * slotSize + slotSize * holdScrollMid))
  }

  points.push(CREATOR_STATS_FINALE_START + (1 - CREATOR_STATS_FINALE_START) * 0.72)
  return points
}

export function snapCreatorStatsProgress(progress: number, snapPoints: number[]): number {
  if (snapPoints.length === 0) return progress

  let closest = snapPoints[0]!
  let minDistance = Math.abs(progress - closest)
  for (const point of snapPoints) {
    const distance = Math.abs(progress - point)
    if (distance < minDistance) {
      minDistance = distance
      closest = point
    }
  }
  return closest
}

/** Recommended ScrollTrigger scrub duration (seconds of smoothing). */
export const CREATOR_STATS_SCROLL_SCRUB = 3.4

/** ScrollTrigger.snap config — settles on the nearest stat hold after wheel/trackpad input. */
export const CREATOR_STATS_SCROLL_SNAP = {
  duration: { min: 0.65, max: 1.65 },
  delay: 0.18,
  ease: 'power2.inOut',
} as const
