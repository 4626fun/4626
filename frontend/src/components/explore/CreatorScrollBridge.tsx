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
const STATS_BRIDGE_HEIGHT_CLASS = 'min-h-[180vh] md:min-h-[220vh]'

const BASE_BG: Record<CreatorScrollBridgeTone, string> = {
  void: 'bg-black',
  'void-to-lime': 'bg-black',
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
        <div className={cn(edge, 'top-0 h-[min(18vh,160px)] bg-gradient-to-b from-black via-black/55 to-transparent')} />
        <div className={cn(edge, 'bottom-0 h-[min(20vh,180px)] bg-gradient-to-t from-black via-black/50 to-transparent')} />
      </>
    )
  }

  if (tone === 'void-to-lime') {
    return (
      <>
        <div className={cn(edge, 'top-0 h-[min(18vh,160px)] bg-gradient-to-b from-black via-black/50 to-transparent')} />
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
      <div className={cn(edge, 'bottom-0 h-[min(22vh,200px)] bg-gradient-to-t from-black via-zinc-950/70 to-transparent')} />
    </>
  )
}

export const CreatorScrollBridge = forwardRef<HTMLDivElement, CreatorScrollBridgeProps>(function CreatorScrollBridge(
  { tone = 'void', className, animate = true, caption, centerContent },
  forwardedRef,
) {
  const bridgeRef = useRef<HTMLDivElement>(null)
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
        'relative left-1/2 w-screen -translate-x-1/2 overflow-clip',
        bridgeHeightClass,
        BASE_BG[tone],
        className,
      )}
    >
      {showStarfield ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.28]"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.45) 50%, transparent 51%),
              radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.32) 50%, transparent 51%),
              radial-gradient(1px 1px at 80% 20%, rgba(255,255,255,0.4) 50%, transparent 51%),
              radial-gradient(1px 1px at 30% 80%, rgba(255,255,255,0.28) 50%, transparent 51%)
            `,
            backgroundSize: '220px 220px',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)',
          }}
        />
      ) : null}

      <BridgeEdgeFades tone={tone} />

      <div className="sticky top-0 flex h-screen flex-col">
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
          <div className="flex flex-1 flex-col items-center justify-center py-10 sm:py-14">
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
