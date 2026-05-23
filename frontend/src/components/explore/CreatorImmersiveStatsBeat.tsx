import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

import { cn } from '@/lib/shared/utils'

import {
  getDiceRollStatDisplay,
  type CreatorStatItem,
  type VolumeWindow,
} from './creatorStatsModel'
import { CreatorStatsScrollNav } from './CreatorStatsScrollNav'
import {
  buildCreatorStatsSnapPoints,
  creatorStatsStackMinHeightPx,
  CREATOR_STATS_SCROLL_SCRUB,
  CREATOR_STATS_SCROLL_SNAP,
  getCreatorStatVisualState,
  snapCreatorStatsProgress,
} from './creatorStatsVisual'
import {
  resolveCreatorStatsActiveSnapIndex,
  scrollToCreatorStatsSnapIndex,
} from './creatorStatsScrollNav'

gsap.registerPlugin(ScrollTrigger)

type CreatorImmersiveStatsBeatProps = {
  stats: CreatorStatItem[]
  animate?: boolean
  isLoading?: boolean
  volumeWindow: VolumeWindow
  onVolumeWindowChange?: (window: VolumeWindow) => void
  /** ScrollTrigger trigger element — the bridge container. */
  scrollTriggerRef?: React.RefObject<HTMLDivElement | null>
  className?: string
}

function StatSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="h-12 sm:h-16 w-40 sm:w-48 bg-white/8 rounded animate-pulse" />
      <div className="h-3 w-28 bg-white/5 rounded animate-pulse" />
    </div>
  )
}

export function CreatorImmersiveStatsBeat({
  stats,
  animate = true,
  isLoading = false,
  volumeWindow,
  onVolumeWindowChange,
  scrollTriggerRef,
  className,
}: CreatorImmersiveStatsBeatProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const eyebrowRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<Array<HTMLDivElement | null>>([])
  const valueRefs = useRef<Array<HTMLSpanElement | null>>([])
  const labelRefs = useRef<Array<HTMLElement | null>>([])
  const masterStRef = useRef<ScrollTrigger | null>(null)
  const [activeSnapIndex, setActiveSnapIndex] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefersReducedMotion(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const useScrollReveal = animate && !isLoading && !prefersReducedMotion

  const scrollToSnapIndex = (index: number) => {
    const master = masterStRef.current
    if (!master) return
    scrollToCreatorStatsSnapIndex(master, stats.length, index, {
      duration: prefersReducedMotion ? 0 : 0.9,
      immediate: prefersReducedMotion,
    })
  }

  useEffect(() => {
    cellRefs.current = cellRefs.current.slice(0, stats.length)
    valueRefs.current = valueRefs.current.slice(0, stats.length)
    labelRefs.current = labelRefs.current.slice(0, stats.length)
  }, [stats])

  useGSAP(
    () => {
      const triggerEl = scrollTriggerRef?.current ?? rootRef.current?.closest('[data-creator-bridge]')
      if (!rootRef.current || !triggerEl || stats.length === 0) return

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const shouldAnimate = animate && !reducedMotion && !isLoading

      const applyStatFrame = (scrollProgress: number) => {
        if (eyebrowRef.current) {
          const eyebrowProgress = gsap.utils.clamp(
            0,
            1,
            gsap.utils.mapRange(0, 0.08, 0, 1, scrollProgress),
          )
          gsap.set(eyebrowRef.current, {
            opacity: eyebrowProgress,
            y: 6 * (1 - eyebrowProgress),
            force3D: true,
          })
        }

        if (stackRef.current) {
          gsap.set(stackRef.current, {
            minHeight: creatorStatsStackMinHeightPx(scrollProgress, stats.length),
          })
        }

        stats.forEach((stat, index) => {
          const cell = cellRefs.current[index]
          const valueEl = valueRefs.current[index]
          if (!cell) return

          const visual = getCreatorStatVisualState(scrollProgress, index, stats.length)

          gsap.set(cell, {
            opacity: visual.opacity,
            top: visual.finale ? 0 : '50%',
            x: visual.x,
            yPercent: visual.finale ? 0 : -50,
            y: visual.y,
            scale: visual.scale,
            filter: visual.blur > 0.05 ? `blur(${visual.blur.toFixed(2)}px)` : 'none',
            pointerEvents: visual.focus > 0.45 || visual.finale ? 'auto' : 'none',
            zIndex: visual.zIndex,
            transformOrigin: visual.finale ? 'top center' : 'center center',
            force3D: true,
          })

          const labelEl = labelRefs.current[index]
          if (labelEl) {
            const labelOpacity = visual.finale
              ? 1
              : gsap.utils.clamp(0, 1, gsap.utils.mapRange(0.72, 0.92, 0, 1, visual.focus))
            gsap.set(labelEl, { opacity: labelOpacity })
          }

          if (!valueEl) return

          if (visual.finale) {
            valueEl.textContent = stat.display
          } else if (visual.focus > 0.04) {
            valueEl.textContent = getDiceRollStatDisplay(stat, visual.focus, index)
          } else if (visual.visible) {
            valueEl.textContent = stat.display
          }
        })
      }

      if (!shouldAnimate) {
        if (eyebrowRef.current) gsap.set(eyebrowRef.current, { opacity: 1, y: 0 })
        stats.forEach((stat, index) => {
          const cell = cellRefs.current[index]
          const valueEl = valueRefs.current[index]
          if (cell) {
            gsap.set(cell, {
              opacity: 1,
              y: 0,
              scale: 1,
              filter: 'blur(0px)',
              position: 'relative',
              transformOrigin: 'center center',
            })
          }
          if (valueEl) valueEl.textContent = stat.display
        })
        return
      }

      if (eyebrowRef.current) gsap.set(eyebrowRef.current, { opacity: 0, y: 8 })
      stats.forEach((_stat, index) => {
        const cell = cellRefs.current[index]
        if (cell) {
          gsap.set(cell, {
            opacity: 0,
            y: 28,
            scale: 0.72,
            filter: 'blur(8px)',
            willChange: 'transform,opacity,filter',
            transformOrigin: 'center center',
          })
        }
      })

      const snapPoints = buildCreatorStatsSnapPoints(stats.length)
      let normalizeScroll: { kill: () => void } | null = null
      let lastSnapIndex = -1

      const updateActiveSnapIndex = (progress: number) => {
        const nextIndex = resolveCreatorStatsActiveSnapIndex(progress, snapPoints)
        if (nextIndex === lastSnapIndex) return
        lastSnapIndex = nextIndex
        setActiveSnapIndex(nextIndex)
      }

      const enableNormalizedScroll = () => {
        if (normalizeScroll) return
        const result = ScrollTrigger.normalizeScroll({
          type: 'wheel,touch',
          allowNestedScroll: true,
          momentum: (self) => Math.min(1.6, Math.abs(self.velocityY / 950)),
        })
        if (result && typeof result === 'object' && 'kill' in result) {
          normalizeScroll = result as { kill: () => void }
        }
      }

      const disableNormalizedScroll = () => {
        normalizeScroll?.kill()
        normalizeScroll = null
      }

      const master = ScrollTrigger.create({
        trigger: triggerEl,
        start: 'top top',
        end: 'bottom bottom',
        scrub: CREATOR_STATS_SCROLL_SCRUB,
        snap: {
          snapTo: (progress) => snapCreatorStatsProgress(progress, snapPoints),
          ...CREATOR_STATS_SCROLL_SNAP,
        },
        onEnter: enableNormalizedScroll,
        onEnterBack: enableNormalizedScroll,
        onLeave: disableNormalizedScroll,
        onLeaveBack: disableNormalizedScroll,
        onUpdate: (self) => {
          applyStatFrame(self.progress)
          updateActiveSnapIndex(self.progress)
        },
      })

      masterStRef.current = master
      applyStatFrame(master.progress)
      updateActiveSnapIndex(master.progress)

      return () => {
        masterStRef.current = null
        disableNormalizedScroll()
        master.kill()
      }
    },
    { dependencies: [stats, animate, isLoading, scrollTriggerRef, prefersReducedMotion], scope: rootRef },
  )

  const showScrollNav = useScrollReveal && !isLoading && activeSnapIndex < stats.length

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative w-full max-w-[min(100%,72rem)] mx-auto px-2 sm:px-4 lg:px-8 pointer-events-auto text-center',
        className,
      )}
      aria-label="Creator statistics"
    >
      <div
        ref={eyebrowRef}
        className={cn(
          'relative z-20 inline-flex items-center gap-3.5 text-[11px] font-medium uppercase tracking-[0.32em] text-[rgba(220,200,160,0.55)] mb-8 sm:mb-10',
          !useScrollReveal && 'opacity-100',
        )}
      >
        <span className="h-px w-8 sm:w-14 bg-gradient-to-r from-transparent via-[rgba(220,200,160,0.55)] to-transparent" />
        <span>On-chain metrics</span>
        <span className="h-px w-8 sm:w-14 bg-gradient-to-r from-transparent via-[rgba(220,200,160,0.55)] to-transparent" />
      </div>

      <div
        ref={stackRef}
        data-stats-stack=""
        className={cn(
          useScrollReveal
            ? 'relative min-h-[12rem] sm:min-h-[14rem] lg:min-h-[16rem] lg:pr-16'
            : 'flex flex-col items-center gap-12 sm:gap-14',
        )}
      >
        {isLoading ? (
          <StatSkeleton />
        ) : (
          stats.map((stat, index) => {
            const isVolumeToggle = stat.id === 'volume' && stat.toggleable && onVolumeWindowChange
            const valueUsesGradient = stat.id !== 'ethos' || stat.display === '—'

            return (
              <div
                key={stat.id}
                ref={(el) => {
                  cellRefs.current[index] = el
                }}
                className={cn(
                  'flex flex-col items-center gap-3 sm:gap-4 min-w-0 w-full',
                  useScrollReveal && 'absolute inset-x-0 top-1/2 lg:max-w-none',
                )}
              >
                <p className="font-serif font-normal text-[clamp(3rem,11vw,7.5rem)] leading-[1.02] tracking-[-0.02em] m-0">
                  <span
                    ref={(el) => {
                      valueRefs.current[index] = el
                    }}
                    className={cn(
                      'tabular-nums inline-block',
                      valueUsesGradient
                        ? 'bg-gradient-to-b from-[#F5F8FF] to-[#8F98AE] bg-clip-text text-transparent'
                        : stat.toneClass,
                      stat.valueClassName,
                    )}
                  >
                    {stat.display}
                  </span>
                </p>

                {isVolumeToggle ? (
                  <button
                    ref={(el) => {
                      labelRefs.current[index] = el
                    }}
                    type="button"
                    onClick={() => onVolumeWindowChange(volumeWindow === '24h' ? 'all' : '24h')}
                    className="text-[11px] sm:text-xs text-zinc-400/90 font-mono uppercase tracking-[0.22em] hover:text-zinc-200 transition-colors underline-offset-4 hover:underline"
                    style={useScrollReveal ? { opacity: 0 } : undefined}
                    title="Toggle 24H vs all-time volume"
                  >
                    {stat.label}
                  </button>
                ) : (
                  <span
                    ref={(el) => {
                      labelRefs.current[index] = el
                    }}
                    className="text-[11px] sm:text-xs text-zinc-400/90 font-mono uppercase tracking-[0.22em]"
                    style={useScrollReveal ? { opacity: 0 } : undefined}
                  >
                    {stat.label}
                  </span>
                )}

                {stat.footer ? <div className="mt-1 flex justify-center">{stat.footer}</div> : null}
              </div>
            )
          })
        )}
      </div>

      {showScrollNav ? (
        <CreatorStatsScrollNav
          stats={stats}
          activeIndex={activeSnapIndex}
          onSelect={scrollToSnapIndex}
          className="mt-8 sm:mt-10 lg:mt-0"
        />
      ) : null}
    </div>
  )
}
