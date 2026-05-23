import { useEffect, useRef, useState } from 'react'
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
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="h-12 sm:h-16 w-40 sm:w-48 bg-white/8 rounded animate-pulse" />
      <div className="h-3 w-28 bg-white/5 rounded animate-pulse" />
    </div>
  )
}

/** Crossfading slots — adjacent stats overlap so scroll never hits an empty frame. */
function statSlotProgress(scrollProgress: number, index: number, total: number): number {
  if (total <= 0) return 1
  const slotSize = 1 / total
  const fade = Math.min(slotSize * 0.22, 0.09)

  const visibleStart = index === 0 ? 0 : index * slotSize - fade * 0.45
  const visibleEnd = index === total - 1 ? 1 : (index + 1) * slotSize + fade * 0.45
  const peakStart = index * slotSize + (index === 0 ? fade * 0.15 : fade * 0.35)
  const peakEnd = (index + 1) * slotSize - (index === total - 1 ? fade * 0.15 : fade * 0.35)

  if (scrollProgress <= visibleStart || scrollProgress >= visibleEnd) return 0
  if (scrollProgress >= peakStart && scrollProgress <= peakEnd) return 1
  if (scrollProgress < peakStart) {
    return gsap.utils.clamp(0, 1, gsap.utils.mapRange(visibleStart, peakStart, 0, 1, scrollProgress))
  }
  return gsap.utils.clamp(0, 1, gsap.utils.mapRange(peakEnd, visibleEnd, 1, 0, scrollProgress))
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
  const eyebrowRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<Array<HTMLDivElement | null>>([])
  const valueRefs = useRef<Array<HTMLSpanElement | null>>([])
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

  useEffect(() => {
    cellRefs.current = cellRefs.current.slice(0, stats.length)
    valueRefs.current = valueRefs.current.slice(0, stats.length)
  }, [stats])

  useGSAP(
    () => {
      const triggerEl = scrollTriggerRef?.current ?? rootRef.current?.closest('[data-creator-bridge]')
      if (!rootRef.current || !triggerEl || stats.length === 0) return

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const shouldAnimate = animate && !reducedMotion && !isLoading

      const applyStatFrame = (scrollProgress: number) => {
        if (eyebrowRef.current) {
          const eyebrowProgress = gsap.utils.clamp(0, 1, gsap.utils.mapRange(0, 0.06, 0, 1, scrollProgress))
          gsap.set(eyebrowRef.current, {
            opacity: eyebrowProgress,
            y: 8 * (1 - eyebrowProgress),
          })
        }

        stats.forEach((stat, index) => {
          const cell = cellRefs.current[index]
          const valueEl = valueRefs.current[index]
          if (!cell) return

          const eased = gsap.parseEase('power3.out')(statSlotProgress(scrollProgress, index, stats.length))

          gsap.set(cell, {
            opacity: eased,
            y: 28 * (1 - eased),
            filter: `blur(${8 * (1 - eased)}px)`,
            pointerEvents: eased > 0.45 ? 'auto' : 'none',
            zIndex: eased > 0.05 ? index + 1 : index,
          })

          if (!valueEl) return

          if (
            (stat.kind === 'currency' || stat.kind === 'integer') &&
            stat.raw != null &&
            Number.isFinite(stat.raw)
          ) {
            valueEl.textContent = formatAnimatedStatValue(stat.kind, stat.raw * eased)
          } else {
            valueEl.textContent = stat.display
          }
        })
      }

      if (!shouldAnimate) {
        if (eyebrowRef.current) gsap.set(eyebrowRef.current, { opacity: 1, y: 0 })
        stats.forEach((stat, index) => {
          const cell = cellRefs.current[index]
          const valueEl = valueRefs.current[index]
          if (cell) gsap.set(cell, { opacity: 1, y: 0, filter: 'blur(0px)', position: 'relative' })
          if (valueEl) valueEl.textContent = stat.display
        })
        return
      }

      if (eyebrowRef.current) gsap.set(eyebrowRef.current, { opacity: 0, y: 8 })
      stats.forEach((stat, index) => {
        const cell = cellRefs.current[index]
        if (cell) {
          gsap.set(cell, { opacity: 0, y: 28, filter: 'blur(8px)', willChange: 'transform,opacity,filter' })
        }
      })

      const master = ScrollTrigger.create({
        trigger: triggerEl,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.55,
        onUpdate: (self) => {
          applyStatFrame(self.progress)
        },
      })

      applyStatFrame(master.progress)

      return () => {
        master.kill()
      }
    },
    { dependencies: [stats, animate, isLoading, scrollTriggerRef, prefersReducedMotion], scope: rootRef },
  )

  return (
    <div
      ref={rootRef}
      className={cn('w-full max-w-3xl mx-auto px-4 sm:px-6 pointer-events-auto text-center', className)}
      aria-label="Creator statistics"
    >
      <div
        ref={eyebrowRef}
        className={cn(
          'inline-flex items-center gap-3.5 text-[11px] font-medium uppercase tracking-[0.32em] text-[rgba(220,200,160,0.55)] mb-8 sm:mb-10',
          !useScrollReveal && 'opacity-100',
        )}
      >
        <span className="h-px w-8 sm:w-14 bg-gradient-to-r from-transparent via-[rgba(220,200,160,0.55)] to-transparent" />
        <span>On-chain metrics</span>
        <span className="h-px w-8 sm:w-14 bg-gradient-to-r from-transparent via-[rgba(220,200,160,0.55)] to-transparent" />
      </div>

      <div
        className={cn(
          useScrollReveal
            ? 'relative min-h-[8rem] sm:min-h-[9rem] lg:min-h-[10rem]'
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
                  'flex flex-col items-center gap-4 sm:gap-5 min-w-0 w-full',
                  useScrollReveal && 'absolute inset-x-0 top-0',
                )}
              >
                <p className="font-serif font-normal text-[clamp(2.75rem,10vw,6.25rem)] leading-[1.05] tracking-[-0.02em] m-0">
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
                    type="button"
                    onClick={() => onVolumeWindowChange(volumeWindow === '24h' ? 'all' : '24h')}
                    className="text-[11px] sm:text-xs text-zinc-400/90 font-mono uppercase tracking-[0.22em] hover:text-zinc-200 transition-colors underline-offset-4 hover:underline"
                    title="Toggle 24H vs all-time volume"
                  >
                    {stat.label}
                  </button>
                ) : (
                  <span className="text-[11px] sm:text-xs text-zinc-400/90 font-mono uppercase tracking-[0.22em]">
                    {stat.label}
                  </span>
                )}

                {stat.footer ? <div className="mt-1 flex justify-center">{stat.footer}</div> : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
