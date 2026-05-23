import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

import { cn } from '@/lib/shared/utils'

import {
  formatAnimatedStatValue,
  type CreatorStatItem,
  type VolumeWindow,
} from './creatorStatsModel'

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
    <div className="flex flex-col gap-2">
      <div className="h-10 sm:h-12 lg:h-14 w-28 sm:w-32 bg-white/8 rounded animate-pulse" />
      <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
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
  const gridRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<Array<HTMLDivElement | null>>([])
  const valueRefs = useRef<Array<HTMLSpanElement | null>>([])
  const tweenStateRef = useRef<Array<{ val: number }>>([])

  useEffect(() => {
    cellRefs.current = cellRefs.current.slice(0, stats.length)
    valueRefs.current = valueRefs.current.slice(0, stats.length)
    tweenStateRef.current = stats.map(() => ({ val: 0 }))
  }, [stats])

  useGSAP(
    () => {
      const triggerEl = scrollTriggerRef?.current ?? gridRef.current?.closest('[data-creator-bridge]')
      if (!gridRef.current || !triggerEl) return

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const shouldAnimate = animate && !reducedMotion && !isLoading

      const cleanups: Array<() => void> = []

      if (!shouldAnimate) {
        stats.forEach((stat, index) => {
          const cell = cellRefs.current[index]
          const valueEl = valueRefs.current[index]
          if (cell) gsap.set(cell, { opacity: 1, y: 0, filter: 'blur(0px)' })
          if (valueEl) valueEl.textContent = stat.display
        })
        return
      }

      stats.forEach((stat, index) => {
        const cell = cellRefs.current[index]
        const valueEl = valueRefs.current[index]
        if (!cell) return

        gsap.set(cell, { opacity: 0, y: 28, filter: 'blur(8px)', willChange: 'transform,opacity,filter' })

        const entranceTween = gsap.to(cell, {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          ease: 'power3.out',
          scrollTrigger: {
            trigger: triggerEl,
            start: 'top 75%',
            end: 'center center',
            scrub: 0.85,
          },
        })
        cleanups.push(() => {
          entranceTween.scrollTrigger?.kill()
          entranceTween.kill()
        })

        if (
          valueEl &&
          (stat.kind === 'currency' || stat.kind === 'integer') &&
          stat.raw != null &&
          Number.isFinite(stat.raw)
        ) {
          const state = { val: 0 }
          tweenStateRef.current[index] = state
          const countTween = gsap.to(state, {
            val: stat.raw,
            ease: 'power3.out',
            snap: stat.kind === 'integer' ? { val: 1 } : undefined,
            scrollTrigger: {
              trigger: triggerEl,
              start: 'top 70%',
              end: 'center center',
              scrub: 0.85,
            },
            onUpdate: () => {
              if (valueEl) {
                valueEl.textContent = formatAnimatedStatValue(stat.kind, state.val)
              }
            },
          })
          cleanups.push(() => {
            countTween.scrollTrigger?.kill()
            countTween.kill()
          })
        } else if (valueEl) {
          valueEl.textContent = stat.display
        }
      })

      return () => {
        cleanups.forEach((cleanup) => cleanup())
      }
    },
    { dependencies: [stats, animate, isLoading, scrollTriggerRef], scope: gridRef },
  )

  return (
    <div
      ref={gridRef}
      className={cn(
        'w-full max-w-5xl mx-auto px-4 sm:px-8 pointer-events-auto',
        className,
      )}
      aria-label="Creator statistics"
    >
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10 sm:gap-x-10 sm:gap-y-12 lg:gap-y-14">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <StatSkeleton key={`skeleton-${index}`} />
            ))
          : stats.map((stat, index) => {
              const isVolumeToggle = stat.id === 'volume' && stat.toggleable && onVolumeWindowChange

              return (
                <div
                  key={stat.id}
                  ref={(el) => {
                    cellRefs.current[index] = el
                  }}
                  className="flex flex-col gap-2 sm:gap-2.5 min-w-0"
                >
                  <span
                    ref={(el) => {
                      valueRefs.current[index] = el
                    }}
                    className={cn(
                      'font-semibold tabular-nums text-4xl sm:text-5xl lg:text-6xl leading-none',
                      stat.toneClass,
                      stat.valueClassName,
                    )}
                  >
                    {stat.display}
                  </span>
                  {isVolumeToggle ? (
                    <button
                      type="button"
                      onClick={() => onVolumeWindowChange(volumeWindow === '24h' ? 'all' : '24h')}
                      className="text-left text-[11px] sm:text-xs text-zinc-400 font-mono uppercase tracking-[2px] hover:text-zinc-200 transition-colors underline-offset-4 hover:underline"
                      title="Toggle 24H vs all-time volume"
                    >
                      {stat.label}
                    </button>
                  ) : (
                    <span className="text-[11px] sm:text-xs text-zinc-400 font-mono uppercase tracking-[2px]">
                      {stat.label}
                    </span>
                  )}
                  {stat.footer ? <div className="mt-0.5">{stat.footer}</div> : null}
                </div>
              )
            })}
      </div>
    </div>
  )
}
