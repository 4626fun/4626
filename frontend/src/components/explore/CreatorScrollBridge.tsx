import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { cn } from '@/lib/shared/utils'

gsap.registerPlugin(ScrollTrigger)

export type CreatorScrollBridgeTone = 'void' | 'void-to-lime' | 'lime-to-void'

type CreatorScrollBridgeProps = {
  tone?: CreatorScrollBridgeTone
  className?: string
  animate?: boolean
}

const BRIDGE_HEIGHT_CLASS = 'min-h-[240vh] md:min-h-[280vh]'

const TONE_BG: Record<CreatorScrollBridgeTone, string> = {
  void: 'bg-black',
  'void-to-lime': 'bg-gradient-to-b from-black from-35% via-black via-70% to-[#d9df72]',
  'lime-to-void': 'bg-gradient-to-b from-[#d9df72] from-15% via-zinc-950 via-55% to-zinc-950',
}

export function CreatorScrollBridge({ tone = 'void', className, animate = true }: CreatorScrollBridgeProps) {
  const bridgeRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (!animate || !bridgeRef.current || !hintRef.current) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(hintRef.current, { opacity: 0.4 })
        return
      }

      const tween = gsap.fromTo(
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

      return () => {
        tween.scrollTrigger?.kill()
        tween.kill()
      }
    },
    { scope: bridgeRef, dependencies: [animate, tone] },
  )

  const showStarfield = tone === 'void' || tone === 'void-to-lime'

  return (
    <div
      ref={bridgeRef}
      aria-hidden
      className={cn('relative left-1/2 w-screen -translate-x-1/2 overflow-clip', BRIDGE_HEIGHT_CLASS, TONE_BG[tone], className)}
    >
      {showStarfield ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.32]"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.45) 50%, transparent 51%),
              radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.32) 50%, transparent 51%),
              radial-gradient(1px 1px at 80% 20%, rgba(255,255,255,0.4) 50%, transparent 51%),
              radial-gradient(1px 1px at 30% 80%, rgba(255,255,255,0.28) 50%, transparent 51%)
            `,
            backgroundSize: '220px 220px',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
          }}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/80 to-transparent" />
      {tone === 'void' ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black to-transparent" />
      ) : null}
      {tone === 'void-to-lime' ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#d9df72] to-transparent" />
      ) : null}
      {tone === 'lime-to-void' ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#d9df72] to-transparent" />
      ) : null}

      <div className="sticky top-0 flex h-screen items-center justify-center">
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
    </div>
  )
}
