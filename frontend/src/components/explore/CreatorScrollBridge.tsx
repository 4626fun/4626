import { forwardRef, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { cn } from '@/lib/shared/utils'

gsap.registerPlugin(ScrollTrigger)

/** Timeline section accent — keep in sync with ExploreCreatorDetail timeline bg */
export const CREATOR_PAGE_LIME = '#d9df72'

export type CreatorScrollBridgeTone = 'void' | 'void-to-lime' | 'lime-to-void'

type CreatorScrollBridgeProps = {
  tone?: CreatorScrollBridgeTone
  className?: string
  animate?: boolean
  caption?: ReactNode
  centerContent?: ReactNode
}

const DEFAULT_BRIDGE_HEIGHT_CLASS = 'min-h-[240vh] md:min-h-[280vh]'
const STATS_BRIDGE_HEIGHT_CLASS = 'h-[240vh] md:h-[280vh]'

const BASE_BG: Record<CreatorScrollBridgeTone, string> = {
  void: 'bg-transparent',
  'void-to-lime': 'bg-transparent',
  'lime-to-void': 'bg-[#d9df72]',
}

/** Short edge ramps only — tall solid-stop gradients read as black/lime bands over the timeline. */
function BridgeEdgeFades({ tone }: { tone: CreatorScrollBridgeTone }) {
  const edge = 'pointer-events-none absolute inset-x-0 z-[1]'
  const lime = CREATOR_PAGE_LIME
  const limeRgb = '217,223,114'

  if (tone === 'void') {
    return (
      <>
        <div
          className={cn(edge, 'top-0 h-[min(18vh,160px)] bg-gradient-to-b from-[var(--explore-canvas,#010101)] via-[color-mix(in_srgb,var(--explore-canvas,#010101)_55%,transparent)] to-transparent')}
        />
        <div
          className={cn(edge, 'bottom-0 h-[min(20vh,180px)] bg-gradient-to-t from-[var(--explore-canvas,#010101)] via-[color-mix(in_srgb,var(--explore-canvas,#010101)_50%,transparent)] to-transparent')}
        />
      </>
    )
  }

  if (tone === 'void-to-lime') {
    return (
      <>
        <div
          className={cn(edge, 'top-0 h-[min(18vh,160px)] bg-gradient-to-b from-[var(--explore-canvas,#010101)] via-[color-mix(in_srgb,var(--explore-canvas,#010101)_50%,transparent)] to-transparent')}
        />
        <div
          className={cn(edge, 'bottom-0 h-[min(22vh,200px)]')}
          style={{
            background: `linear-gradient(to top, ${lime} 0%, rgba(${limeRgb},0.72) 28%, rgba(${limeRgb},0.22) 62%, transparent 100%)`,
          }}
        />
      </>
    )
  }

  return (
    <>
      <div
        className={cn(edge, 'top-0 h-[min(22vh,200px)]')}
        style={{
          background: `linear-gradient(to bottom, ${lime} 0%, rgba(${limeRgb},0.55) 32%, rgba(9,9,11,0.12) 68%, transparent 100%)`,
        }}
      />
      <div className={cn(edge, 'bottom-0 h-[min(22vh,200px)] bg-gradient-to-t from-[var(--explore-canvas,#010101)] via-zinc-950/70 to-transparent')} />
    </>
  )
}

export const CreatorScrollBridge = forwardRef<HTMLDivElement, CreatorScrollBridgeProps>(function CreatorScrollBridge(
  { tone = 'void', className, animate = true, caption, centerContent },
  forwardedRef,
) {
  const bridgeRef = useRef<HTMLDivElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const captionRef = useRef<HTMLDivElement>(null)

  const setBridgeRef = (node: HTMLDivElement | null) => {
    bridgeRef.current = node
    if (typeof forwardedRef === 'function') {
      forwardedRef(node)
    } else if (forwardedRef) {
      forwardedRef.current = node
    }
  }

  useGSAP(
    () => {
      if (!bridgeRef.current) return
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const cleanups: Array<() => void> = []

      if (hintRef.current && !centerContent) {
        if (!animate || reducedMotion) {
          gsap.set(hintRef.current, { opacity: reducedMotion ? 0.4 : 0.35 })
        } else {
          const hintTween = gsap.fromTo(
            hintRef.current,
            { opacity: 0, y: 14 },
            {
              opacity: 0.42,
              y: 0,
              ease: 'none',
              scrollTrigger: {
                trigger: bridgeRef.current,
                start: 'top 88%',
                end: 'center center',
                scrub: 0.75,
              },
            },
          )
          cleanups.push(() => {
            hintTween.scrollTrigger?.kill()
            hintTween.kill()
          })
        }
      }

      if (captionRef.current && animate && !reducedMotion) {
        const captionTween = gsap.fromTo(
          captionRef.current,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: bridgeRef.current,
              start: 'top 72%',
              end: 'top 38%',
              scrub: 0.85,
            },
          },
        )
        cleanups.push(() => {
          captionTween.scrollTrigger?.kill()
          captionTween.kill()
        })
      } else if (captionRef.current) {
        gsap.set(captionRef.current, { opacity: 1 })
      }

      return () => {
        cleanups.forEach((cleanup) => cleanup())
      }
    },
    { scope: bridgeRef, dependencies: [animate, tone, caption, centerContent] },
  )

  const showStarfield = tone === 'void' || tone === 'void-to-lime'
  const bridgeHeightClass = centerContent ? STATS_BRIDGE_HEIGHT_CLASS : DEFAULT_BRIDGE_HEIGHT_CLASS

  return (
    <div
      ref={setBridgeRef}
      data-creator-bridge=""
      aria-hidden={!caption && !centerContent}
      className={cn(
        // Full-bleed without transform — transform breaks position:sticky (homepage uses margin breakout).
        'relative left-1/2 w-screen max-w-[100vw] -ml-[50vw] overflow-clip',
        bridgeHeightClass,
        BASE_BG[tone],
        className,
      )}
    >
      {showStarfield ? (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          aria-hidden
          style={{
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
          }}
        >
          <div
            className="absolute inset-[-10%] opacity-[0.35]"
            style={{
              backgroundImage: `
                radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.45) 50%, transparent 51%),
                radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.32) 50%, transparent 51%),
                radial-gradient(1px 1px at 80% 20%, rgba(255,255,255,0.4) 50%, transparent 51%),
                radial-gradient(1px 1px at 30% 80%, rgba(255,255,255,0.28) 50%, transparent 51%)
              `,
              backgroundSize: '220px 220px',
            }}
          />
          <div
            className="absolute inset-[-10%] opacity-[0.22]"
            style={{
              backgroundImage: `
                radial-gradient(1.5px 1.5px at 25% 25%, rgba(220,215,255,0.55) 50%, transparent 51%),
                radial-gradient(1.5px 1.5px at 75% 65%, rgba(220,215,255,0.45) 50%, transparent 51%)
              `,
              backgroundSize: '360px 360px',
            }}
          />
        </div>
      ) : null}

      <BridgeEdgeFades tone={tone} />

      <div
        ref={pinRef}
        className={cn(
          'sticky top-0 flex h-screen w-full flex-col',
          centerContent && 'items-center justify-center',
        )}
      >
        {caption ? (
          <div className="flex flex-1 items-end px-6 pb-10 sm:px-10 sm:pb-14 lg:px-16 lg:pb-16">
            <div
              ref={captionRef}
              className={cn(
                'max-w-2xl opacity-0',
                tone === 'void-to-lime' ? 'text-zinc-400' : 'text-zinc-500',
              )}
            >
              {caption}
            </div>
          </div>
        ) : centerContent ? null : (
          <div className="flex-1" />
        )}

        {centerContent ? (
          <div className="relative z-[2] flex flex-1 flex-col items-center justify-center px-5 sm:px-8 py-10 sm:py-14 text-center">
            {centerContent}
            <div ref={hintRef} className="mt-10 sm:mt-14 flex flex-col items-center gap-2.5 opacity-35">
              <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-zinc-500">Scroll</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="text-zinc-600"
                aria-hidden
              >
                <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center pb-[min(18vh,160px)]">
            <div ref={hintRef} className="flex flex-col items-center gap-2.5 opacity-0">
              <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-zinc-500">Scroll</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="text-zinc-600"
                aria-hidden
              >
                <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
