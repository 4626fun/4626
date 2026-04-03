import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'

import { fetchZoraCoin, fetchZoraProfile } from '@/lib/zora/client'
import { ZorbViewer } from './ModelViewer'
import { SHARE_DISTRIBUTION_ROWS, STRATEGY_CARDS } from './launchConfig'

const CREATOR_CAMEOS = [
  { key: 'zora',    label: 'zora creator coin', initials: 'ZO', color: '#a1a1aa', staticIcon: '/protocols/zora.svg',  zoraAddress: null,                                          zoraHandle: null },
  { key: 'jesse',   label: 'jesse',             initials: 'JP', color: '#0052ff', staticIcon: null,                  zoraAddress: null,                                          zoraHandle: 'jessepollak' },
  { key: 'akita',   label: 'akita',             initials: 'AK', color: '#f97316', staticIcon: null,                  zoraAddress: '0x5b674196812451b7cec024fe9d22d2c0b172fa75', zoraHandle: null },
  { key: 'gabriel', label: 'gabrielhaines',     initials: 'GH', color: '#8b5cf6', staticIcon: null,                  zoraAddress: null,                                          zoraHandle: 'gabrielhaines' },
] as const

type Props = {
  depositTokens: string
  shareTokens: string
}

// SVG flow geometry — 800 × 120 viewBox, source at centre-top
// Middle path uses a slight S-curve to avoid a degenerate zero-width bounding
// box which would make linearGradient (objectBoundingBox) render invisible.

const STRAT_PATHS = [
  'M 400 18 C 400 65 100 65 100 108',
  'M 400 18 C 400 65 300 65 300 108',
  'M 400 18 C 400 65 500 65 500 108',
  'M 400 18 C 400 65 700 65 700 108',
] as const
const STRAT_DESTS = [
  { cx: 100, cy: 108 }, { cx: 300, cy: 108 },
  { cx: 500, cy: 108 }, { cx: 700, cy: 108 },
] as const

// Distribution fan — 3 curved paths from origin to left / center / right
const DIST_PATHS = [
  'M 400 10 C 400 60 130 60 130 100',
  'M 400 10 C 400 60 400 60 400 100',
  'M 400 10 C 400 60 670 60 670 100',
] as const
const DIST_DESTS = [
  { cx: 130, cy: 100 }, { cx: 400, cy: 100 }, { cx: 670, cy: 100 },
] as const

const STAGE_NAV = [
  { n: '01', label: 'Deposit' },
  { n: '02', label: 'Mint' },
  { n: '03', label: 'Distribute' },
  { n: '04', label: 'Deploy' },
] as const

// Geometric scramble characters — brand-kit "Technical Luxury" aesthetic
const SCRAMBLE_CHARS = ['●', '■', '▲', '◆', '○', '□', '△', '◊', '✶', '✕']

const smoothstep = (t: number) => t * t * (3 - 2 * t)


// Renders a MotionValue<number> as text via a DOM ref — bypasses React's render cycle entirely.
const MotionNumber = memo(function MotionNumber({
  value,
  className,
  style,
  format = (n: number) => n.toLocaleString(),
}: {
  value: MotionValue<number>
  className?: string
  style?: CSSProperties
  format?: (n: number) => string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useMotionValueEvent(value, 'change', (latest) => {
    if (ref.current) ref.current.textContent = format(Math.round(latest))
  })
  return (
    <span ref={ref} className={className} style={style}>
      {format(Math.round(value.get()))}
    </span>
  )
})

// Decodes a string from geometric symbols → final text over ~800ms.
// Writes directly to a DOM ref — no setState, no React re-render per rAF tick.
function useTextScramble(text: string, trigger: boolean) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const frame   = useRef(0)
  const progress = useRef(0)

  useEffect(() => {
    if (!trigger) {
      cancelAnimationFrame(frame.current)
      return
    }
    progress.current = 0
    const animate = () => {
      progress.current += 0.7
      if (spanRef.current) {
        spanRef.current.textContent = text
          .split('')
          .map((char, i) =>
            char === ' ' || i < Math.floor(progress.current)
              ? char
              : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)],
          )
          .join('')
      }
      if (progress.current < text.length + 4) {
        frame.current = requestAnimationFrame(animate)
      } else if (spanRef.current) {
        spanRef.current.textContent = text
      }
    }
    frame.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame.current)
  }, [trigger, text])

  return spanRef
}

// ── Numbered step chip with text-scramble decode on mount/trigger
function StepChip({ n, label, active }: { n: string; label: string; active: boolean }) {
  const spanRef = useTextScramble(label, active)
  return (
    <div className="mb-6 inline-flex items-center gap-2.5">
      <div className="flex h-[18px] w-[26px] items-center justify-center rounded border border-white/[0.1] bg-white/[0.04]">
        <span className="font-mono text-[9px] font-semibold text-zinc-500">{n}</span>
      </div>
      <span ref={spanRef} className="font-mono text-[9px] font-medium uppercase tracking-[0.28em] text-zinc-500">{label}</span>
    </div>
  )
}

// ── Memoised sub-components ───────────────────────────────────────────────────
// After P0 eliminates per-frame state churn, renders only fire on discrete
// events (stage change, cardPhase, hardStop). Memo prevents those rare parent
// renders from propagating into stable subtrees whose MotionValue props never
// change reference.

type HUDProps = {
  progressH: MotionValue<string>
  cueOpacity: MotionValue<number>
  stage2LabelOp: MotionValue<number>
  activeStageIdx: number
}
const HUD = memo(function HUD({ progressH, cueOpacity, stage2LabelOp, activeStageIdx }: HUDProps) {
  const currentStage = STAGE_NAV[activeStageIdx]
  return (
    <>
      <div className="absolute bottom-16 left-6 top-16 w-px" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <motion.div
          className="absolute inset-x-0 top-0 origin-top"
          style={{
            height: progressH,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.35), rgba(0,82,255,0.6))',
            borderRadius: 1,
          }}
        />
      </div>
      <div className="absolute left-9 top-1/2 hidden -translate-y-1/2 flex-col gap-5 sm:flex">
        {STAGE_NAV.map((s, i) => (
          <motion.div
            key={s.n}
            className="flex items-center gap-3"
            animate={{ opacity: activeStageIdx === i ? 1 : 0.16 }}
            transition={{ duration: 0.65, ease: [0.32, 0, 0.67, 0] }}
          >
            <motion.div
              className="h-px rounded-full bg-white"
              animate={{ width: activeStageIdx === i ? 20 : 6, opacity: activeStageIdx === i ? 0.75 : 0.25 }}
              transition={{ duration: 0.65, ease: [0.32, 0, 0.67, 0] }}
            />
            <span className="text-[8px] font-semibold uppercase tracking-[0.24em] text-zinc-400">{s.label}</span>
          </motion.div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-10 z-30 flex justify-center">
        <StepChip n={currentStage.n} label={currentStage.label} active />
      </div>
      <motion.div
        className="pointer-events-none absolute right-4 top-10 z-30 hidden sm:flex items-center gap-1.5"
        style={{ opacity: stage2LabelOp }}
        aria-hidden="true"
      >
        <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.28em] text-zinc-600">Phase</span>
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-400">02</span>
        <span className="h-px w-3 bg-zinc-700" />
        <span className="font-mono text-[8px] uppercase tracking-[0.28em] text-zinc-600">Mint</span>
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-10 z-30 flex flex-col items-center gap-2"
        style={{ opacity: cueOpacity }}
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-600">Scroll to descend</span>
        <motion.div
          className="h-7 w-px bg-gradient-to-b from-white/0 via-white/30 to-brand-primary/65"
          animate={{ scaleY: [0.75, 1, 0.75], opacity: [0.35, 0.85, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </>
  )
})

type VaultSceneProps = {
  uid: string
  vaultTransform: MotionValue<string>
  vaultOpacity: MotionValue<number>
  vaultLidOp: MotionValue<number>
  vaultWallOp: MotionValue<number>
  vaultPostProgress: MotionValue<number>
  vaultTopProgress: MotionValue<number>
  vaultGlow: MotionValue<number>
  landingFlash: MotionValue<number>
  zoraGreenFlash: MotionValue<number>
  coinEntryGlow: MotionValue<number>
  zorbFillScale: MotionValue<number>
  zorbFillOp: MotionValue<number>
}
const VaultScene = memo(function VaultScene({
  uid, vaultTransform, vaultOpacity, vaultLidOp, vaultWallOp,
  vaultPostProgress, vaultTopProgress, vaultGlow, landingFlash,
  zoraGreenFlash, coinEntryGlow, zorbFillScale, zorbFillOp,
}: VaultSceneProps) {
  return (
    <motion.div className="absolute left-1/2 top-[44vh] z-20" style={{ transform: vaultTransform, opacity: vaultOpacity }}>
      <div className="relative">
        <motion.div className="pointer-events-none absolute" style={{ bottom: -20, left: -66, right: -66, height: 80, opacity: vaultLidOp }} aria-hidden="true">
          <svg viewBox="0 0 244 80" width="100%" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={`${uid}-xz-fill`} x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor="rgba(80,130,255,0.06)" />
                <stop offset="100%" stopColor="rgba(20,55,180,0.22)" />
              </linearGradient>
            </defs>
            <polygon points="28,8 216,8 244,72 0,72" fill={`url(#${uid}-xz-fill)`} />
            <line x1="0" y1="72" x2="244" y2="72" stroke="rgba(160,205,255,0.68)" strokeWidth="1.6" />
            <line x1="28" y1="8" x2="216" y2="8" stroke="rgba(100,148,255,0.30)" strokeWidth="0.9" />
            <line x1="28" y1="8" x2="0" y2="72" stroke="rgba(130,178,255,0.36)" strokeWidth="0.9" />
            <line x1="216" y1="8" x2="244" y2="72" stroke="rgba(130,178,255,0.36)" strokeWidth="0.9" />
            <line x1="10" y1="32" x2="234" y2="32" stroke="rgba(80,130,200,0.11)" strokeWidth="0.7" />
            <line x1="18" y1="52" x2="226" y2="52" stroke="rgba(80,130,200,0.11)" strokeWidth="0.7" />
            <line x1="84" y1="8" x2="72" y2="72" stroke="rgba(80,130,200,0.09)" strokeWidth="0.7" />
            <line x1="122" y1="8" x2="122" y2="72" stroke="rgba(80,130,200,0.09)" strokeWidth="0.7" />
            <line x1="160" y1="8" x2="172" y2="72" stroke="rgba(80,130,200,0.09)" strokeWidth="0.7" />
            <polyline points="28,20 28,8 42,8" stroke="rgba(190,220,255,0.56)" strokeWidth="1.4" fill="none" />
            <polyline points="202,8 216,8 216,20" stroke="rgba(190,220,255,0.56)" strokeWidth="1.4" fill="none" />
            <polyline points="0,60 0,72 16,72" stroke="rgba(190,220,255,0.56)" strokeWidth="1.4" fill="none" />
            <polyline points="228,72 244,72 244,60" stroke="rgba(190,220,255,0.56)" strokeWidth="1.4" fill="none" />
            <circle cx="122" cy="40" r="2.8" fill="none" stroke="rgba(155,198,255,0.40)" strokeWidth="0.8" />
            <line x1="114" y1="40" x2="130" y2="40" stroke="rgba(155,198,255,0.28)" strokeWidth="0.7" />
            <line x1="122" y1="32" x2="122" y2="48" stroke="rgba(155,198,255,0.28)" strokeWidth="0.7" />
            <ellipse cx="122" cy="75" rx="100" ry="5.5" fill="rgba(70,120,255,0.16)" />
          </svg>
        </motion.div>

        <motion.div className="pointer-events-none absolute" style={{ left: -66, right: -66, bottom: -20, height: 310, opacity: vaultWallOp }} aria-hidden="true">
          <svg viewBox="0 0 244 310" width="100%" height="310" fill="none" xmlns="http://www.w3.org/2000/svg">
            <motion.polygon points="0,28 244,28 244,302 0,302" fill="rgba(140,195,255,0.025)" style={{ opacity: vaultTopProgress }} />
            <motion.polygon points="28,52 216,52 216,238 28,238" fill="rgba(100,155,255,0.018)" style={{ opacity: vaultTopProgress }} />
            <motion.path d="M 0 302 L 0 28" stroke="rgba(170,215,255,0.65)" strokeWidth="1.4" strokeLinecap="round" style={{ pathLength: vaultPostProgress }} />
            <motion.path d="M 244 302 L 244 28" stroke="rgba(170,215,255,0.65)" strokeWidth="1.4" strokeLinecap="round" style={{ pathLength: vaultPostProgress }} />
            <motion.path d="M 28 238 L 28 52" stroke="rgba(130,175,255,0.32)" strokeWidth="0.9" strokeLinecap="round" style={{ pathLength: vaultPostProgress }} />
            <motion.path d="M 216 238 L 216 52" stroke="rgba(130,175,255,0.32)" strokeWidth="0.9" strokeLinecap="round" style={{ pathLength: vaultPostProgress }} />
            <motion.path d="M 0 28 L 244 28" stroke="rgba(200,230,255,0.70)" strokeWidth="1.4" strokeLinecap="round" style={{ pathLength: vaultTopProgress }} />
            <motion.path d="M 28 52 L 216 52" stroke="rgba(130,175,255,0.30)" strokeWidth="0.9" strokeLinecap="round" style={{ pathLength: vaultTopProgress }} />
            <motion.path d="M 0 28 L 28 52" stroke="rgba(155,195,255,0.40)" strokeWidth="0.9" strokeLinecap="round" style={{ pathLength: vaultTopProgress }} />
            <motion.path d="M 244 28 L 216 52" stroke="rgba(155,195,255,0.40)" strokeWidth="0.9" strokeLinecap="round" style={{ pathLength: vaultTopProgress }} />
            <motion.path d="M 0 302 L 244 302" stroke="rgba(155,200,255,0.45)" strokeWidth="1.1" strokeLinecap="round" style={{ pathLength: vaultTopProgress }} />
            <motion.path d="M 28 238 L 216 238" stroke="rgba(120,165,255,0.25)" strokeWidth="0.8" strokeLinecap="round" style={{ pathLength: vaultTopProgress }} />
            <motion.path d="M 0 302 L 28 238" stroke="rgba(140,185,255,0.32)" strokeWidth="0.9" strokeLinecap="round" style={{ pathLength: vaultTopProgress }} />
            <motion.path d="M 244 302 L 216 238" stroke="rgba(140,185,255,0.32)" strokeWidth="0.9" strokeLinecap="round" style={{ pathLength: vaultTopProgress }} />
            <motion.path d="M 0 165 L 244 165" stroke="rgba(155,195,255,0.22)" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="4 6" style={{ opacity: vaultTopProgress }} />
            <motion.path d="M 28 145 L 216 145" stroke="rgba(120,160,255,0.14)" strokeWidth="0.6" strokeLinecap="round" strokeDasharray="3 5" style={{ opacity: vaultTopProgress }} />
            <motion.path d="M 0 165 L 28 145" stroke="rgba(140,185,255,0.16)" strokeWidth="0.6" strokeLinecap="round" style={{ opacity: vaultTopProgress }} />
            <motion.path d="M 244 165 L 216 145" stroke="rgba(140,185,255,0.16)" strokeWidth="0.6" strokeLinecap="round" style={{ opacity: vaultTopProgress }} />
            <motion.polyline points="0,28 16,28" stroke="rgba(210,240,255,0.80)" strokeWidth="1.8" fill="none" style={{ opacity: vaultTopProgress }} />
            <motion.polyline points="0,28 0,46" stroke="rgba(210,240,255,0.80)" strokeWidth="1.8" fill="none" style={{ opacity: vaultTopProgress }} />
            <motion.polyline points="228,28 244,28" stroke="rgba(210,240,255,0.80)" strokeWidth="1.8" fill="none" style={{ opacity: vaultTopProgress }} />
            <motion.polyline points="244,28 244,46" stroke="rgba(210,240,255,0.80)" strokeWidth="1.8" fill="none" style={{ opacity: vaultTopProgress }} />
            <motion.polyline points="0,284 0,302 16,302" stroke="rgba(180,215,255,0.50)" strokeWidth="1.3" fill="none" style={{ opacity: vaultTopProgress }} />
            <motion.polyline points="228,302 244,302 244,284" stroke="rgba(180,215,255,0.50)" strokeWidth="1.3" fill="none" style={{ opacity: vaultTopProgress }} />
          </svg>
        </motion.div>

        <motion.div className="pointer-events-none absolute" style={{ inset: 20, borderRadius: '50%', opacity: vaultGlow, background: 'transparent', boxShadow: ['0 0 26px 10px rgba(0,82,255,0.60)', '0 0 60px 22px rgba(0,82,255,0.30)', '0 0 110px 44px rgba(0,82,255,0.12)'].join(', ') }} aria-hidden="true" />
        <motion.div className="pointer-events-none absolute" style={{ inset: 20, borderRadius: '50%', opacity: landingFlash, background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.20) 0%, rgba(210,230,255,0.08) 50%, transparent 75%)', boxShadow: ['0 0 0 1px rgba(255,255,255,0.75)', '0 0 16px 5px rgba(255,255,255,0.50)', '0 0 42px 14px rgba(210,230,255,0.28)', '0 0 100px 36px rgba(140,180,255,0.12)'].join(', ') }} aria-hidden="true" />
        <motion.div className="pointer-events-none absolute" style={{ inset: 14, borderRadius: '50%', opacity: zoraGreenFlash, background: 'transparent', boxShadow: ['0 0 28px 10px rgba(57,255,20,0.75)', '0 0 70px 28px rgba(57,255,20,0.38)', '0 0 130px 55px rgba(57,255,20,0.14)'].join(', ') }} aria-hidden="true" />
        <motion.div className="pointer-events-none absolute" style={{ inset: 20, borderRadius: '50%', opacity: coinEntryGlow, background: 'transparent', boxShadow: ['0 0 22px 8px rgba(249,115,22,0.50)', '0 0 55px 20px rgba(0,82,255,0.36)', '0 0 105px 42px rgba(0,82,255,0.16)'].join(', ') }} aria-hidden="true" />
        {/* ── Deposit fill — orange warmth rises from bottom, no hard edge ── */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            scaleY: zorbFillScale,
            opacity: zorbFillOp,
            transformOrigin: '50% 100%',
            background: 'radial-gradient(circle at 50% 80%, rgba(249,115,22,0.50) 0%, rgba(249,100,0,0.22) 28%, rgba(249,80,0,0.05) 50%, transparent 62%)',
          }}
          aria-hidden="true"
        />
        <ZorbViewer size={96} />
      </div>
    </motion.div>
  )
})

type DistributionFanProps = {
  uid: string
  distSectionOp: MotionValue<number>
  node0Op: MotionValue<number>; node1Op: MotionValue<number>; node2Op: MotionValue<number>
  orbitTrav0: MotionValue<number>; orbitTrav1: MotionValue<number>; orbitTrav2: MotionValue<number>
  nodeGlow0: MotionValue<number>; nodeGlow1: MotionValue<number>; nodeGlow2: MotionValue<number>
  distGreen0: MotionValue<number>; distGreen1: MotionValue<number>; distGreen2: MotionValue<number>
  distDotOp0: MotionValue<number>; distDotOp1: MotionValue<number>; distDotOp2: MotionValue<number>
  dist0DotX: MotionValue<number>; dist0DotY: MotionValue<number>
  dist1DotY: MotionValue<number>
  dist2DotX: MotionValue<number>; dist2DotY: MotionValue<number>
  dist0CardY: MotionValue<number>; dist1CardY: MotionValue<number>; dist2CardY: MotionValue<number>
  distCount0MV: MotionValue<number>; distCount1MV: MotionValue<number>; distCount2MV: MotionValue<number>
}
const DistributionFan = memo(function DistributionFan({
  uid, distSectionOp,
  node0Op, node1Op, node2Op,
  orbitTrav0, orbitTrav1, orbitTrav2,
  nodeGlow0, nodeGlow1, nodeGlow2,
  distGreen0, distGreen1, distGreen2,
  distDotOp0, distDotOp1, distDotOp2,
  dist0DotX, dist0DotY, dist1DotY, dist2DotX, dist2DotY,
  dist0CardY, dist1CardY, dist2CardY,
  distCount0MV, distCount1MV, distCount2MV,
}: DistributionFanProps) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 z-30 px-3 sm:px-10 lg:px-14"
      style={{ top: 'clamp(46vh, 50vh, 54vh)', opacity: distSectionOp }}
    >
      <div className="mx-auto max-w-3xl">
        {/* Stage 3 section header */}
        <motion.div className="mb-3 flex items-center justify-center gap-2" style={{ opacity: distSectionOp }}>
          <span className="h-px w-5 flex-shrink-0" style={{ background: 'rgba(100,160,255,0.25)' }} />
          <span className="font-mono text-[7px] uppercase tracking-[0.30em]" style={{ color: 'rgba(100,160,255,0.50)' }}>■AKITA · distributing</span>
          <span className="h-px w-5 flex-shrink-0" style={{ background: 'rgba(100,160,255,0.25)' }} />
        </motion.div>
        <div className="relative mx-auto w-full">
          <svg viewBox="0 0 800 110" preserveAspectRatio="xMidYMid meet" className="w-full" aria-hidden="true" style={{ height: 92 }}>
            <defs>
              <linearGradient id={`${uid}-dg`} gradientUnits="userSpaceOnUse" x1="400" y1="10" x2="400" y2="100">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0.06} />
              </linearGradient>
              <filter id={`${uid}-df`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="3.5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id={`${uid}-bf`} x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feFlood floodColor="#60a5fa" floodOpacity="0.9" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge><feMergeNode in="glow" /><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <motion.circle cx={400} cy={10} r={4.5} fill="#93c5fd" filter={`url(#${uid}-bf)`} style={{ opacity: distSectionOp }} />
            <motion.path d={DIST_PATHS[0]} stroke={`url(#${uid}-dg)`} strokeWidth="1.5" fill="none" strokeLinecap="round" style={{ pathLength: orbitTrav0, opacity: node0Op }} />
            <motion.path d={DIST_PATHS[1]} stroke={`url(#${uid}-dg)`} strokeWidth="1.5" fill="none" strokeLinecap="round" style={{ pathLength: orbitTrav1, opacity: node1Op }} />
            <motion.path d={DIST_PATHS[2]} stroke={`url(#${uid}-dg)`} strokeWidth="1.5" fill="none" strokeLinecap="round" style={{ pathLength: orbitTrav2, opacity: node2Op }} />
            <motion.circle cx={DIST_DESTS[0].cx} cy={DIST_DESTS[0].cy} r={4} fill="#93c5fd" filter={`url(#${uid}-bf)`} style={{ opacity: nodeGlow0 }} />
            <motion.circle cx={DIST_DESTS[1].cx} cy={DIST_DESTS[1].cy} r={4} fill="#93c5fd" filter={`url(#${uid}-bf)`} style={{ opacity: nodeGlow1 }} />
            <motion.circle cx={DIST_DESTS[2].cx} cy={DIST_DESTS[2].cy} r={4} fill="#93c5fd" filter={`url(#${uid}-bf)`} style={{ opacity: nodeGlow2 }} />
            <motion.g style={{ opacity: distDotOp0 }}><motion.circle r={4} fill="#bfdbfe" filter={`url(#${uid}-bf)`} style={{ x: dist0DotX, y: dist0DotY }} /></motion.g>
            <motion.g style={{ opacity: distDotOp1 }}><motion.circle r={4} fill="#bfdbfe" filter={`url(#${uid}-bf)`} style={{ x: 400, y: dist1DotY }} /></motion.g>
            <motion.g style={{ opacity: distDotOp2 }}><motion.circle r={4} fill="#bfdbfe" filter={`url(#${uid}-bf)`} style={{ x: dist2DotX, y: dist2DotY }} /></motion.g>
          </svg>
          {([
            { left: '16.25%', op: node0Op, countMV: distCount0MV },
            { left: '50%',    op: node1Op, countMV: distCount1MV },
            { left: '83.75%', op: node2Op, countMV: distCount2MV },
          ] as const).map(({ left, op, countMV }) => (
            <motion.div key={left} className="pointer-events-none absolute flex -translate-x-1/2 flex-row items-baseline gap-1" style={{ left, top: 'calc(100% + 6px)', opacity: op }}>
              <MotionNumber value={countMV} className="font-mono text-[9px] font-semibold tabular-nums" style={{ color: 'rgba(255,255,255,0.90)' }} />
              <span className="font-mono text-[7px] font-medium" style={{ color: 'rgba(100,160,255,0.75)' }}>■AKITA</span>
            </motion.div>
          ))}
        </div>
        <div className="mt-8 grid w-full grid-cols-3 gap-1.5 sm:gap-3 lg:gap-5" style={{ perspective: '800px' }}>
          {SHARE_DISTRIBUTION_ROWS.map((row, i) => {
            const ops = [node0Op, node1Op, node2Op]
            const ys = [dist0CardY, dist1CardY, dist2CardY]
            const glows = [nodeGlow0, nodeGlow1, nodeGlow2]
            const greenFlashes = [distGreen0, distGreen1, distGreen2]
            const rotYValues = [-7, 0, 7]
            const liveCountMVs = [distCount0MV, distCount1MV, distCount2MV]
            return (
              <motion.div
                key={row.title}
                className="group relative flex flex-col overflow-hidden rounded-[14px] p-2.5 sm:rounded-[18px] sm:p-4 lg:p-5"
                style={{ opacity: ops[i], y: ys[i], rotateY: rotYValues[i], transformOrigin: 'center bottom', border: '1px solid rgba(255,255,255,0.09)', background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 60%, transparent 100%)', boxShadow: '0 18px 90px -48px rgba(255,255,255,0.18), inset 0 1px 0 rgba(255,255,255,0.05)', transition: 'transform 0.45s ease' }}
                whileHover={{ rotateY: 0 }}
                transition={{ duration: 0.45, ease: [0.25, 0, 0.35, 1] }}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                <motion.div className="pointer-events-none absolute rounded-[18px]" style={{ inset: -2, opacity: glows[i], boxShadow: '0 0 0 1px rgba(255,255,255,0.28), 0 0 24px 6px rgba(255,255,255,0.12), 0 0 60px 18px rgba(200,215,255,0.08)' }} aria-hidden="true" />
                <motion.div className="pointer-events-none absolute rounded-[14px] sm:rounded-[18px]" style={{ inset: -1, opacity: greenFlashes[i], boxShadow: ['0 0 0 1px rgba(57,255,20,0.55)', '0 0 18px 4px rgba(57,255,20,0.35)', '0 0 50px 14px rgba(57,255,20,0.12)'].join(', ') }} aria-hidden="true" />
                <div className="mb-1.5 flex items-center gap-1.5">
                  {row.icon && <img src={row.icon} alt={row.title} className="h-3 w-3 opacity-70" loading="lazy" />}
                  <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.22em] text-zinc-500 sm:text-[9px]">{row.title}</p>
                </div>
                <p className="font-mono font-black leading-none" style={{ fontSize: 'clamp(1.6rem, 5.5vw, 2.6rem)', color: '#f0f0f8', textShadow: '0 0 22px rgba(255,255,255,0.5), 0 0 48px rgba(255,255,255,0.22)' }}>{row.percent}</p>
                <p className="mt-1 font-mono text-[9.5px] font-medium tabular-nums text-white/70 sm:text-[10px]">
                  <MotionNumber value={liveCountMVs[i]} />{' '}
                  <span style={{ color: 'rgba(100,160,255,0.70)' }}>■AKITA</span>
                </p>
                <p className="mt-2.5 grow text-[10.5px] font-light leading-relaxed text-zinc-400 sm:text-[11px]">{row.description}</p>
                <Link to={row.route} className="mt-3 text-[8px] font-medium tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-300">Learn more →</Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
})

type DeploySectionProps = {
  uid: string
  deployTransform: MotionValue<string>
  deployOpacity: MotionValue<number>
  deployFilter: MotionValue<string>
  deployTitleOp: MotionValue<number>
  deployTitleY: MotionValue<number>
  s4p0: MotionValue<number>; s4p1: MotionValue<number>; s4p2: MotionValue<number>; s4p3: MotionValue<number>
  s4pOp0: MotionValue<number>; s4pOp1: MotionValue<number>; s4pOp2: MotionValue<number>; s4pOp3: MotionValue<number>
  s4d0: MotionValue<number>; s4d1: MotionValue<number>; s4d2: MotionValue<number>; s4d3: MotionValue<number>
  s4c0o: MotionValue<number>; s4c0y: MotionValue<number>
  s4c1o: MotionValue<number>; s4c1y: MotionValue<number>
  s4c2o: MotionValue<number>; s4c2y: MotionValue<number>
  s4c3o: MotionValue<number>; s4c3y: MotionValue<number>
}
const DeploySection = memo(function DeploySection({
  uid, deployTransform, deployOpacity, deployFilter,
  deployTitleOp, deployTitleY,
  s4p0, s4p1, s4p2, s4p3,
  s4pOp0, s4pOp1, s4pOp2, s4pOp3,
  s4d0, s4d1, s4d2, s4d3,
  s4c0o, s4c0y, s4c1o, s4c1y, s4c2o, s4c2y, s4c3o, s4c3y,
}: DeploySectionProps) {
  const cardMotions = [
    { opacity: s4c0o, y: s4c0y },
    { opacity: s4c1o, y: s4c1y },
    { opacity: s4c2o, y: s4c2y },
    { opacity: s4c3o, y: s4c3y },
  ]
  return (
    <motion.section
      className="absolute inset-x-0 z-10 px-3 sm:px-10 lg:px-14"
      style={{ top: 'clamp(52vh, calc(32vh + 380px), 84vh)', transform: deployTransform, opacity: deployOpacity, filter: deployFilter }}
    >
      <div className="mx-auto max-w-4xl">
        <motion.div className="mb-4 flex flex-col items-center gap-1 text-center" style={{ opacity: deployTitleOp, y: deployTitleY }}>
          <div className="flex items-center gap-2">
            <span className="h-px w-5 flex-shrink-0" style={{ background: 'rgba(249,115,22,0.28)' }} />
            <p className="font-mono text-[7px] font-semibold uppercase tracking-[0.30em]" style={{ color: 'rgba(249,115,22,0.55)' }}>akita · yield strategies</p>
            <span className="h-px w-5 flex-shrink-0" style={{ background: 'rgba(249,115,22,0.28)' }} />
          </div>
          <p className="font-mono text-[10px] font-black tracking-tight text-white/80">50,000,000 akita deployed</p>
        </motion.div>
        <div className="relative mx-auto w-full max-w-3xl">
          <svg viewBox="0 0 800 120" preserveAspectRatio="xMidYMid meet" className="w-full" aria-hidden="true" style={{ height: 108 }}>
            <defs>
              <linearGradient id={`${uid}-sg`} gradientUnits="userSpaceOnUse" x1="400" y1="18" x2="400" y2="108">
                <stop offset="0%" stopColor="rgba(249,115,22,0.90)" />
                <stop offset="100%" stopColor="rgba(249,115,22,0.08)" />
              </linearGradient>
              <filter id={`${uid}-sf`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="3.5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <motion.circle cx={400} cy={18} r={4} fill="rgba(249,115,22,0.85)" filter={`url(#${uid}-sf)`} style={{ opacity: deployTitleOp, scale: deployTitleOp }} />
            <motion.path d={STRAT_PATHS[0]} stroke={`url(#${uid}-sg)`} strokeWidth="1.5" fill="none" strokeLinecap="round" style={{ pathLength: s4p0, opacity: s4pOp0 }} />
            <motion.path d={STRAT_PATHS[1]} stroke={`url(#${uid}-sg)`} strokeWidth="1.5" fill="none" strokeLinecap="round" style={{ pathLength: s4p1, opacity: s4pOp1 }} />
            <motion.path d={STRAT_PATHS[2]} stroke={`url(#${uid}-sg)`} strokeWidth="1.5" fill="none" strokeLinecap="round" style={{ pathLength: s4p2, opacity: s4pOp2 }} />
            <motion.path d={STRAT_PATHS[3]} stroke={`url(#${uid}-sg)`} strokeWidth="1.5" fill="none" strokeLinecap="round" style={{ pathLength: s4p3, opacity: s4pOp3 }} />
            <motion.circle cx={STRAT_DESTS[0].cx} cy={STRAT_DESTS[0].cy} r={3.5} fill="rgba(249,115,22,0.75)" filter={`url(#${uid}-sf)`} style={{ opacity: s4d0, scale: s4d0 }} />
            <motion.circle cx={STRAT_DESTS[1].cx} cy={STRAT_DESTS[1].cy} r={3.5} fill="rgba(249,115,22,0.75)" filter={`url(#${uid}-sf)`} style={{ opacity: s4d1, scale: s4d1 }} />
            <motion.circle cx={STRAT_DESTS[2].cx} cy={STRAT_DESTS[2].cy} r={3.5} fill="rgba(249,115,22,0.75)" filter={`url(#${uid}-sf)`} style={{ opacity: s4d2, scale: s4d2 }} />
            <motion.circle cx={STRAT_DESTS[3].cx} cy={STRAT_DESTS[3].cy} r={3.5} fill="rgba(249,115,22,0.75)" filter={`url(#${uid}-sf)`} style={{ opacity: s4d3, scale: s4d3 }} />
          </svg>
          <motion.span className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500" style={{ left: '12.5%', top: '100%', opacity: s4d0 }}>{STRATEGY_CARDS[0]?.amount} <span style={{ color: 'rgba(249,115,22,0.55)' }}>akita</span></motion.span>
          <motion.span className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500" style={{ left: '37.5%', top: '100%', opacity: s4d1 }}>{STRATEGY_CARDS[1]?.amount} <span style={{ color: 'rgba(249,115,22,0.55)' }}>akita</span></motion.span>
          <motion.span className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500" style={{ left: '62.5%', top: '100%', opacity: s4d2 }}>{STRATEGY_CARDS[2]?.amount} <span style={{ color: 'rgba(249,115,22,0.55)' }}>akita</span></motion.span>
          <motion.span className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500" style={{ left: '87.5%', top: '100%', opacity: s4d3 }}>{STRATEGY_CARDS[3]?.amount} <span style={{ color: 'rgba(249,115,22,0.55)' }}>akita</span></motion.span>
        </div>
        <div className="mt-8 -mx-3 overflow-x-auto sm:mx-0 sm:overflow-visible">
          <div className="flex items-stretch gap-2 px-3 pb-1 sm:grid sm:grid-cols-4 sm:gap-3 sm:px-0 lg:gap-4">
            {STRATEGY_CARDS.map((card, i) => (
              <motion.div
                key={card.label}
                className="flex-shrink-0 sm:flex-shrink"
                style={{ opacity: cardMotions[i].opacity, y: cardMotions[i].y, minWidth: 'clamp(148px, 40vw, 176px)' }}
              >
                <motion.div
                  className="relative flex h-full flex-col overflow-hidden rounded-2xl p-3 sm:p-4 lg:p-5"
                  whileHover={{ y: -3, boxShadow: '0 24px 64px -20px rgba(0,82,255,0.22), 0 0 0 1px rgba(255,255,255,0.13), inset 0 1px 0 rgba(255,255,255,0.08)' }}
                  transition={{ duration: 0.30, ease: [0.25, 0, 0.35, 1] }}
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 55%, rgba(0,0,0,0) 100%)',
                    boxShadow: '0 12px 48px -18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {/* Top shimmer line */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" aria-hidden="true" />

                  {/* Protocol icon + label row */}
                  <div className="mb-2.5 flex items-center gap-2">
                    {card.icon ? (
                      <img src={card.icon} alt={card.iconAlt} className={card.iconClassName} loading="lazy" />
                    ) : (
                      <div className="h-3 w-3 rounded-full border border-white/20 bg-white/10" aria-hidden="true" />
                    )}
                    <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-300">{card.label}</p>
                  </div>

                  {/* Allocation percentage — primary number */}
                  <p
                    className="font-mono font-black leading-none"
                    style={{
                      fontSize: 'clamp(2rem, 5vw, 2.6rem)',
                      color: '#f0f0f8',
                      textShadow: '0 0 18px rgba(255,255,255,0.45)',
                    }}
                  >
                    {card.percent}
                  </p>

                  {/* Token amount */}
                  <p className="mt-1.5 font-mono text-[10px] font-medium text-zinc-400">
                    {card.amount}{' '}
                    <span style={{ color: 'rgba(249,115,22,0.60)' }}>akita</span>
                  </p>

                  {/* Description */}
                  <p className="mt-2.5 grow text-[11px] font-light leading-relaxed text-zinc-500">
                    {card.description}
                  </p>

                  {/* Separator + link */}
                  <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-3">
                    <Link
                      to={card.route}
                      className="text-[9px] font-medium tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-200"
                    >
                      Learn more →
                    </Link>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  )
})

export function VaultFlowScroll({ depositTokens: _depositTokens, shareTokens: _shareTokens }: Props) {
  const uid = useId().replace(/:/g, '')
  const outerRef = useRef<HTMLDivElement>(null)
  // Respects the OS/browser reduced-motion preference to skip expensive camera moves
  // and GPU-intensive glow effects.
  const prefersReducedMotion = useReducedMotion() ?? false

  const { scrollYProgress } = useScroll({
    target: outerRef,
    offset: ['start start', 'end end'],
  })

  // Slightly stiffer spring so Stage 1 feels responsive while still cinematic.
  const scroll = useSpring(scrollYProgress, {
    stiffness: 65,
    damping: 22,
    mass: 1.1,
  })

  const [activeStageIdx, setActiveStageIdx] = useState(0)
  const activeStageRef = useRef(0)
  // depositComplete is state (not a ref) so the card label updates correctly at the
  // hard-stop pause between v=0.48 and v=0.54 when cardPhase is still 1.
  const [depositComplete, setDepositComplete] = useState(false)
  const depositCompleteRef = useRef(false)
  const [cameoIcons, setCameoIcons] = useState<Record<string, string>>({})
  // Generalised checkpoint system — 4 hard stops, one per stage completion.
  // Pure side-effect: blocks scroll for `dur` seconds, no React state needed.
  const hardStopFired = useRef({ s1: false, s2: false, s3: false, s4: false })

  const fireHardStop = useCallback((_label: string, dur: number) => {
    const block = (e: Event) => e.preventDefault()
    document.addEventListener('wheel',     block, { passive: false })
    document.addEventListener('touchmove', block, { passive: false })
    setTimeout(() => {
      document.removeEventListener('wheel',     block)
      document.removeEventListener('touchmove', block)
    }, dur * 1000)
  }, [])

  // Card phase — drives AnimatePresence for the deposit/distribute/deploy card
  const cardPhaseRef = useRef<1 | 2 | 3>(1)
  const [cardPhase, setCardPhase] = useState<1 | 2 | 3>(1)

  useMotionValueEvent(scroll, 'change', (v) => {
    // Ref guard: only setState when stage actually changes — eliminates per-frame
    // React reconciliation calls during continuous scrolling.
    const nextStage = v < 0.30 ? 0 : v < 0.48 ? 1 : v < 0.74 ? 2 : 3
    if (nextStage !== activeStageRef.current) {
      activeStageRef.current = nextStage
      setActiveStageIdx(nextStage)
    }

    // Deposit complete — one-time flip folded here; avoids a second event handler on
    // depositFillPct that would fire setDepositCount on every frame.
    if (!depositCompleteRef.current && v >= 0.46) {
      depositCompleteRef.current = true
      setDepositComplete(true)
    }

    // Advance (or retreat) the card phase
    const next: 1 | 2 | 3 = v >= 0.79 ? 3 : v >= 0.52 ? 2 : 1
    if (next !== cardPhaseRef.current) {
      cardPhaseRef.current = next
      setCardPhase(next)
    }

    const f = hardStopFired.current
    // Checkpoint 1: vault fully sealed + cage walls drawn (vaultTopProgress hits 1.0 at 0.32)
    if (!f.s1 && v >= 0.32) { f.s1 = true; fireHardStop('vault sealed', 2.0) }
    // Checkpoint 2: deposit fill done (0.46) + ■AKITA right column fully visible (0.50)
    if (!f.s2 && v >= 0.50) { f.s2 = true; fireHardStop('shares minted', 2.0) }
    // Checkpoint 3: all 3 distribution paths complete (_d2Raw hits 1.0 at 0.70)
    if (!f.s3 && v >= 0.70) { f.s3 = true; fireHardStop('take a moment', 3.2) }
    // Checkpoint 4: all 4 strategy cards at 90%+ opacity
    if (!f.s4 && v >= 0.99) { f.s4 = true; fireHardStop('strategies deployed', 2.5) }
  })

  // Prefetch real token/profile images for creator cameos.
  // Tries multiple fallback paths because the Zora API returns images at
  // different fields depending on coin vs profile vs creator wallet lookup.
  useEffect(() => {
    const run = async () => {
      const updates: Record<string, string> = {}
      await Promise.allSettled(
        CREATOR_CAMEOS.map(async (c) => {
          if (c.staticIcon) { updates[c.key] = c.staticIcon; return }
          try {
            // ── Path A: coin address → coin media / coin creatorProfile avatar
            if (c.zoraAddress) {
              const coin = await fetchZoraCoin(c.zoraAddress as `0x${string}`)
              const coinAny = coin as any
              const img =
                coin?.mediaContent?.previewImage?.small ??
                coin?.mediaContent?.previewImage?.medium ??
                coin?.creatorProfile?.avatar?.previewImage?.small ??
                coinAny?.image ??
                coinAny?.metadata?.image
              if (img) { updates[c.key] = img; return }

              // A2: coin has a creatorAddress → look up that profile's avatar
              const creatorAddr = coin?.creatorAddress
              if (creatorAddr) {
                const creatorProfile = await fetchZoraProfile(creatorAddr)
                const avatar =
                  creatorProfile?.avatar?.small ??
                  creatorProfile?.avatar?.medium
                if (avatar) { updates[c.key] = avatar; return }
              }
            }

            // ── Path B: handle → profile avatar (direct, most reliable)
            if (c.zoraHandle) {
              const profile = await fetchZoraProfile(c.zoraHandle)
              const avatar =
                profile?.avatar?.small ??
                profile?.avatar?.medium
              if (avatar) { updates[c.key] = avatar; return }

              // B2: profile has a creator coin → coin's media image
              const coinAddr = profile?.creatorCoin?.address
              if (coinAddr) {
                const coin = await fetchZoraCoin(coinAddr as `0x${string}`)
                const coinAny = coin as any
                const img =
                  coin?.mediaContent?.previewImage?.small ??
                  coinAny?.image ??
                  coin?.creatorProfile?.avatar?.previewImage?.small
                if (img) { updates[c.key] = img; return }
              }
            }
          } catch {
            // silently fall back to coloured initials circle
          }
        }),
      )
      setCameoIcons((prev) => ({ ...prev, ...updates }))
    }
    run()
  }, [])

  const shareTokenLogo = cameoIcons['akita'] ?? '/app-icon.svg'

  // HUD / camera
  const progressH = useTransform(scroll, [0, 1], ['0%', '100%'])
  // Brief delay before cue reveals so the cold-open curtain lifts first.
  const cueOpacity = useTransform(scroll, [0, 0.012, 0.035, 0.084], [0, 0.88, 0.88, 0])
  // Opening curtain — scene begins in near-darkness and reveals itself on first scroll.
  // Lifts quickly so the cold-open feel doesn't overstay its welcome.
  const openingCurtain = useTransform(scroll, [0, 0.026, 0.09], [0.82, 0.32, 0])
  // Dive flash — fires as the camera "enters" the reflection Zorb at Stage 3→4 boundary.
  // Holds partially through flash so the white-out reads as a portal crossing.
  // Starts at zoom peak (0.77), giving one beat of visible reflection before the flash.
  const diveFlash = useTransform(scroll, [0.74, 0.755, 0.78, 0.87], [0, 0.82, 0.55, 0])

  // Camera — continuous slow drift, no kinks
  const worldY = useTransform(scroll, [0, 1], [0, -6])
  // Camera zoom-in: flat during freefall + deposit + all distributions. At 0.74 the world
  // rushes in to 2.2× (the "entering the reflection" moment), then settles back for Stage 4.
  // The 1% gap after Checkpoint 3 (0.72) gives a beat of rest before the dive fires.
  // reduced-motion: skip the zoom entirely to avoid a GPU-intensive composite at 2.2× scale.
  const _worldScaleBase = useTransform(
    scroll,
    [0,    0.74,  0.77,  0.83,  1.0],
    [1.25, 1.25,  2.20,  1.25,  1.25],
  )
  const worldScale = useTransform(_worldScaleBase, v => prefersReducedMotion ? 1.25 : v)
  // Deep cinematic opening tilt: 10° bird's-eye → unlocks to flat as Zorb descends and lands.
  // Tilt finishes slightly sooner (0.36 vs 0.40) to unlock the scene a beat earlier.
  // reduced-motion: hold at 0° — the tilt is disorienting for vestibular sensitivity.
  const _worldRotateXBase = useTransform(scroll, [0, 0.09, 0.20, 0.36, 1], [10, 5, 1.5, 0, 0])
  const worldRotateX = useTransform(_worldRotateXBase, v => prefersReducedMotion ? 0 : v)
  const worldTransform = useMotionTemplate`
    translate3d(0, ${worldY}%, 0)
    scale(${worldScale})
    rotateX(${worldRotateX}deg)
  `

  // Dark cold-open: atmosphere starts at 0 (near-black sky), builds as Zorb lands and scene unfolds.
  const atmosphereOpacity = useTransform(scroll, [0, 0.09, 0.20, 1], [0, 0.04, 0.22, 0.44])

  // Hero plane — waits in the deep while the Zorb takes its solo moment, then sweeps in
  // from 260px behind camera and locks into position as the title cross-fades up.
  // Arrives 2% sooner (0.13 vs 0.15) to tighten the cold-open before story begins.
  const heroZ = useTransform(scroll, [0, 0.13, 0.32, 0.44], [260, 32, 32, -60])
  const heroY = useTransform(scroll, [0, 0.44], [0, -12])
  // Slight scale-down on arrival: the plane "punches through" the depth field and settles.
  const heroScale = useTransform(scroll, [0, 0.13, 0.32, 0.44], [1.08, 0.96, 0.96, 0.88])
  // Hero text appears at 0.12 — Zorb has landed, vault starts sealing, story begins.
  const heroOpacity = useTransform(scroll, [0, 0.12, 0.18, 0.32, 0.46], [0, 0, 1, 1, 0])
  const heroTitleOpacity = useTransform(scroll, [0.12, 0.18], [0, 1])
  const heroTitleY = useTransform(scroll, [0.12, 0.18], [20, 0])
  const heroPillsOpacity = useTransform(scroll, [0.12, 0.18], [0, 1])
  const heroPillsY = useTransform(scroll, [0.12, 0.18], [14, 0])
  const heroBodyOpacity = useTransform(scroll, [0.18, 0.26], [0, 1])
  const heroBodyY = useTransform(scroll, [0.18, 0.26], [12, 0])
  const heroBlur = useTransform(scroll, [0.32, 0.42], [0, 7])
  const heroFilter = useMotionTemplate`blur(${heroBlur}px)`
  const heroTransform = useMotionTemplate`
    translate3d(-50%, ${heroY}px, ${heroZ}px)
    scale(${heroScale})
  `

  // Pill -> vault connector — starts only after the freeze pause ends (0.44)
  const _topRaw = useTransform(scroll, [0.34, 0.44], [0, 1])
  const topTrail = useTransform(_topRaw, smoothstep)
  // Start 90px above the card anchor so the card descends from above the vault
  const topDotY = useTransform(topTrail, (t) => -90 + 198 * t)
  const topDotOp = useTransform(scroll, [0.34, 0.36, 0.42, 0.44], [0, 1, 1, 0])

  // Card entrance: pop-overshoot (1.20) → micro-bounce (1.04) → settle (1.0).
  const depositNodeScale = useTransform(scroll, [0.34, 0.37, 0.42], [1.20, 1.04, 1])
  // Card fades in once, then PERSISTS through stage 4 — it IS the principal card.
  const depositNodeOpacity = useTransform(scroll, [0.34, 0.38], [0, 1])
  const depositNodeTransform = useMotionTemplate`translate3d(-50%, ${topDotY}px, 0px) scale(${depositNodeScale})`

  // Vault — rockets toward camera while off-screen, slows to a crawl once visible,
  // then settles into the vault anchor with a tiny overshoot before the deposit sequence
  // Vault stays at Z=0 after capture — world zooms in around it for "entering" feel
  // Zorb starts as a near-invisible spark at extreme depth, accelerates toward viewer in two phases:
  //   Phase 1 (0→0.08): ultra-fast rush from deep space (the "comet" phase — mostly hidden by curtain)
  //   Phase 2 (0.08→0.26): visible descent, overshoots, lands with precision.
  // Zorb stays at Z=0 through the entire distribution phase (0.26-0.74).
  // At 0.74 it rockets toward the camera (Z→900px) as the dive/zoom-in that bridges into stage 4.
  const vaultZ = useTransform(scroll, [0, 0.05, 0.09, 0.12, 0.16, 0.74, 0.77], [-600, -80, -20, 18, 0, 0, 900])
  // Scale: invisible point → rapid growth → 1.4× overshoot → soft landing at 1.0
  const vaultScale = useTransform(scroll, [0, 0.04, 0.09, 0.12, 0.16, 0.77], [0.04, 0.10, 1.40, 1.06, 1, 1])
  // Starts dark, ignites to full brightness during freefall, stays at 1.0 through all distributions,
  // brightens one last beat as it rushes at camera, then hits 0 — we're inside.
  const vaultOpacity = useTransform(scroll, [0, 0.026, 0.064, 0.40, 0.74, 0.77, 0.78], [0, 0.35, 1, 1, 0.85, 1.0, 0])
  // Landing unlock flash — bright burst the moment the Zorb settles on the platform
  // reduced-motion: suppress flashes to avoid strobing effects.
  const _landingFlashBase = useTransform(scroll, [0.15, 0.19, 0.24, 0.30], [0, 1, 0.45, 0])
  const landingFlash = useTransform(_landingFlashBase, v => prefersReducedMotion ? 0 : v)
  // Glow/flash: mint phase only — starts after deposit dot arrives
  const _vaultGlowBase = useTransform(scroll, [0.24, 0.32, 0.36, 0.40], [0, 1, 0.3, 0])
  const vaultGlow = useTransform(_vaultGlowBase, v => prefersReducedMotion ? 0 : v)
  // vaultFlash removed — coinEntryGlow at 0.60+ is the single glow event
  // Vault lid — snaps closed on capture, turning the open tray into a sealed vault
  const vaultLidOp = useTransform(scroll, [0.16, 0.24, 0.74, 0.78], [0, 1, 1, 0])

  // Vault walls — 4 corner posts grow upward as deposit threshold nears
  // then fade out with the Zorb dive. Posts animate first, then top edges connect.
  const vaultPostProgress = useTransform(scroll, [0.18, 0.28], [0, 1])
  const vaultTopProgress  = useTransform(scroll, [0.28, 0.32], [0, 1])
  const vaultWallOp       = useTransform(scroll, [0.18, 0.22, 0.74, 0.78], [0, 1, 1, 0])

  // Share Zorb reflection — materialises after deposit fill, holds at FULL opacity through the
  // zoom peak (0.77) so the dive visually enters the reflection, then snaps out quickly.
  const shareZorbOp = useTransform(scroll, [0.48, 0.52, 0.77, 0.80], [0, 1, 1, 0])

  // Coin entry glow — fires when deposit fill completes, sustains through all distributions,
  // fades as the dive begins
  const _coinEntryGlowBase = useTransform(scroll, [0.48, 0.53, 0.74, 0.78], [0, 1, 1, 0])
  const coinEntryGlow = useTransform(_coinEntryGlowBase, v => prefersReducedMotion ? 0 : v)
  // Zora neon-green mint flash — a quick tribute to Zora's new identity.
  const _zoraGreenFlashBase = useTransform(scroll, [0.46, 0.485, 0.52], [0, 1, 0])
  const zoraGreenFlash = useTransform(_zoraGreenFlashBase, v => prefersReducedMotion ? 0 : v)
  // Green flash on each distribution card when its path finishes drawing
  const distGreen0 = useTransform(scroll, [0.58, 0.595, 0.63], [0, 1, 0])
  const distGreen1 = useTransform(scroll, [0.65, 0.665, 0.70], [0, 1, 0])
  const distGreen2 = useTransform(scroll, [0.70, 0.715, 0.74], [0, 1, 0])
  // Entry radial bloom: peaks as vault rushes through camera, fully faded before deploy content reads
  const vaultEntry = useTransform(scroll, [0.77, 0.81, 0.85], [0, 1, 0])

  // ── Distribution fan chart — one curved path + card revealed at a time ─
  // Fades in immediately after deposit fill completes (0.48), holds through all 3 paths,
  // fades just before zoom peak (0.74) so cards clear before the camera rushes in.
  const distSectionOp = useTransform(scroll, [0.48, 0.53, 0.74, 0.78], [0, 1, 1, 0])

  // Distribution paths cascade in — each path starts as the previous one finishes.
  // All 3 complete by 0.70 (2% earlier than before). Checkpoint 3 fires at 0.70.
  //
  // Path + card 0 (CCA Launch — left): 0.50 start
  const _d0Raw = useTransform(scroll, [0.50, 0.58], [0, 1])
  const orbitTrav0 = useTransform(_d0Raw, smoothstep)
  const node0Op = orbitTrav0
  const dist0CardY = useTransform(scroll, [0.50, 0.58], [22, 0])
  // Glow stays ON through all distributions, fades with dive
  const nodeGlow0 = useTransform(scroll, [0.57, 0.60, 0.74, 0.78], [0, 1, 1, 0])

  // Path + card 1 (Creator Vesting — center): 0.58 start
  const _d1Raw = useTransform(scroll, [0.58, 0.65], [0, 1])
  const orbitTrav1 = useTransform(_d1Raw, smoothstep)
  const node1Op = orbitTrav1
  const dist1CardY = useTransform(scroll, [0.58, 0.65], [22, 0])
  const nodeGlow1 = useTransform(scroll, [0.64, 0.67, 0.74, 0.78], [0, 1, 1, 0])

  // Path + card 2 (LP Reserve — right): 0.65 start
  const _d2Raw = useTransform(scroll, [0.65, 0.70], [0, 1])
  const orbitTrav2 = useTransform(_d2Raw, smoothstep)
  const node2Op = orbitTrav2
  const dist2CardY = useTransform(scroll, [0.65, 0.70], [22, 0])
  const nodeGlow2 = useTransform(scroll, [0.69, 0.71, 0.74, 0.78], [0, 1, 1, 0])

  // "× ERC-4626" suffix appears only after the vault captures the Zorb (~0.28)
  // ercSuffixOp removed — title is now static "Welcome to 4626.fun"
  // 4626 pill appears during the pause so users see the full identity at rest
  // Phase 2 corner badge — visible during mint / deposit phase only
  const stage2LabelOp = useTransform(scroll, [0.32, 0.38, 0.52, 0.58], [0, 1, 1, 0])
  // Deposit fill — drives the counter and progress bar in the deposit pill
  const depositFillPct = useTransform(scroll, [0.34, 0.46], [0, 1])
  // Distributing counter: counts UP with deposit fill (0→50M in sync with left column),
  // then drains as each distribution orbit completes. Starting at 0 ensures both
  // counters animate together during the fill phase.
  const remainingMinted = useTransform(
    [depositFillPct, orbitTrav0, orbitTrav1, orbitTrav2],
    ([fill, t0, t1, t2]) => {
      const minted = Math.round((fill as number) * 50_000_000)
      const distributed = Math.round(
        (t0 as number) * 20_000_000 +
        (t1 as number) * 20_000_000 +
        (t2 as number) * 10_000_000,
      )
      return Math.max(0, minted - distributed)
    },
  )
  const depositFillWidth = useTransform(depositFillPct, v => `${(Math.min(v, 1) * 100).toFixed(1)}%`)
  // Zorb fill overlay — GPU-only scaleY from bottom (no clipPath string generation)
  const _zorbFillScaleBase = useTransform(depositFillPct, v => Math.min(v, 1))
  const zorbFillScale = useTransform(_zorbFillScaleBase, v => prefersReducedMotion ? 1 : v)
  const _zorbFillOpBase = useTransform(scroll, [0.32, 0.36, 0.46, 0.52], [0, 0.65, 0.65, 0])
  const zorbFillOp = useTransform(_zorbFillOpBase, v => prefersReducedMotion ? 0 : v)
  // "Vault initiated" confirmation badge — flashes after fill completes
  const vaultInitOp = useTransform(scroll, [0.48, 0.51, 0.53, 0.58], [0, 1, 1, 0])

  // (APY reveal removed — allocation percentages are shown permanently)

  // Per-card distribution counters — MotionValues only, no React state
  const distCount0MV = useTransform(scroll, [0.50, 0.58], [0, 20_000_000])
  const distCount1MV = useTransform(scroll, [0.58, 0.65], [0, 20_000_000])
  const distCount2MV = useTransform(scroll, [0.65, 0.70], [0, 10_000_000])

  // Freefall: Zorb descends from high in the frame, gaining speed as it approaches.
  // -32vh start → overshoot +4.5vh → snap to 0 on landing. Rotation unwinds simultaneously.
  // Slightly faster landing (0.16 vs 0.18) to reach the deposit phase sooner.
  // reduced-motion: skip freefall animation, Zorb appears at rest position immediately.
  const _zorbFallYBase = useTransform(scroll, [0, 0.05, 0.10, 0.13, 0.16], [-32, -22, -2, 4.5, 0])
  const zorbFallY = useTransform(_zorbFallYBase, v => prefersReducedMotion ? 0 : v)
  const zorbFallRotZ = useTransform(scroll, [0, 0.05, 0.10, 0.16], [-18, -12, -2.5, 0])

  const vaultTransform = useMotionTemplate`
    translate3d(-50%, ${zorbFallY}vh, ${vaultZ}px)
    scale(${vaultScale})
    rotateZ(${zorbFallRotZ}deg)
  `

  // Cube interior POV — fades in during the vault-rush moment, then holds steady through all of stage 4.
  const cubeOp = useTransform(scroll, [0.80, 0.87, 1.0], [0, 1.0, 0.82])

  // Dot positions along each distribution bezier path (cubic Bezier formula)
  // Path 0: M 400 10 C 400 60 130 60 130 100
  const dist0DotX = useTransform(orbitTrav0, (t) =>
    (1 - t) ** 3 * 400 + 3 * (1 - t) ** 2 * t * 400 + 3 * (1 - t) * t ** 2 * 130 + t ** 3 * 130,
  )
  const dist0DotY = useTransform(orbitTrav0, (t) =>
    (1 - t) ** 3 * 10 + 3 * (1 - t) ** 2 * t * 60 + 3 * (1 - t) * t ** 2 * 60 + t ** 3 * 100,
  )
  const distDotOp0 = useTransform(scroll, [0.50, 0.52, 0.58, 0.60], [0, 1, 1, 0])

  // Path 1: M 400 10 C 400 60 400 60 400 100 (x stays at 400)
  const dist1DotY = useTransform(orbitTrav1, (t) =>
    (1 - t) ** 3 * 10 + 3 * (1 - t) ** 2 * t * 60 + 3 * (1 - t) * t ** 2 * 60 + t ** 3 * 100,
  )
  const distDotOp1 = useTransform(scroll, [0.58, 0.60, 0.65, 0.67], [0, 1, 1, 0])

  // Path 2: M 400 10 C 400 60 670 60 670 100
  const dist2DotX = useTransform(orbitTrav2, (t) =>
    (1 - t) ** 3 * 400 + 3 * (1 - t) ** 2 * t * 400 + 3 * (1 - t) * t ** 2 * 670 + t ** 3 * 670,
  )
  const dist2DotY = useTransform(orbitTrav2, (t) =>
    (1 - t) ** 3 * 10 + 3 * (1 - t) ** 2 * t * 60 + 3 * (1 - t) * t ** 2 * 60 + t ** 3 * 100,
  )
  const distDotOp2 = useTransform(scroll, [0.65, 0.67, 0.70, 0.72], [0, 1, 1, 0])



  // Deploy chamber — rises from depth after the dive clears Stage 3.
  // Stage 4 from 0.78→1.0 = generous scroll runway.
  // Title and pill lock in before the fan cards start unfolding.
  const deployZ = useTransform(scroll, [0.78, 0.85, 1.0], [-240, 0, 0])
  const deployOpacity = useTransform(scroll, [0.78, 0.85], [0, 1])
  const deployBlur = useTransform(scroll, [0.78, 0.85, 1.0], [18, 0, 0])
  const deployTransform = useMotionTemplate`translate3d(0px, 0px, ${deployZ}px)`
  const deployFilter = useMotionTemplate`blur(${deployBlur}px)`
  const deployTitleOp = useTransform(scroll, [0.80, 0.87], [0, 1])
  const deployTitleY = useTransform(scroll, [0.80, 0.87], [28, 0])

  // (Principal card timing kept here for future use — deploy title/chamber serve this role.)

  // Stage 4 fan — cards stagger in starting at 0.86.
  // Stage 4 spans 0.78-1.0 (22% of scroll) giving each card a ~0.06 window.
  // s4cNo (linear 0→1) doubles as the raw input for s4pN (smoothstepped) — saves 4 MV objects.
  const s4c0o = useTransform(scroll, [0.85, 0.92], [0, 1])
  const s4p0 = useTransform(s4c0o, smoothstep)
  const s4d0 = useTransform(scroll, [0.87, 0.94], [0, 1])
  const s4c0y = useTransform(scroll, [0.85, 0.92], [28, 0])

  const s4c1o = useTransform(scroll, [0.89, 0.96], [0, 1])
  const s4p1 = useTransform(s4c1o, smoothstep)
  const s4d1 = useTransform(scroll, [0.91, 0.97], [0, 1])
  const s4c1y = useTransform(scroll, [0.89, 0.96], [28, 0])

  const s4c2o = useTransform(scroll, [0.93, 0.98], [0, 1])
  const s4p2 = useTransform(s4c2o, smoothstep)
  const s4d2 = useTransform(scroll, [0.94, 1.0], [0, 1])
  const s4c2y = useTransform(scroll, [0.93, 0.98], [28, 0])

  const s4c3o = useTransform(scroll, [0.96, 1.0], [0, 1])
  const s4p3 = useTransform(s4c3o, smoothstep)
  const s4d3 = useTransform(scroll, [0.97, 1.0], [0, 1])
  const s4c3y = useTransform(scroll, [0.96, 1.0], [28, 0])

  return (
    <>
      {/* Cinematic world — single scroll-driven path for all screen sizes.
          Safe-area padding ensures content clears the home indicator in Telegram
          WebApp, Base app WebView, and iOS Safari.                              */}
      <div
        ref={outerRef}
        className="relative block"
        style={{ height: '3200vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div
          className="sticky top-0 h-screen overflow-hidden bg-black"
          style={{ perspective: 'clamp(600px, 90vw, 1100px)' }}
        >
          {/* Atmosphere */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 78% 54% at 50% 34%, rgba(0,82,255,0.10) 0%, rgba(0,82,255,0.035) 44%, transparent 70%)',
            }}
            aria-hidden="true"
          />
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: atmosphereOpacity,
              background:
                'radial-gradient(ellipse 72% 72% at 50% 52%, rgba(255,255,255,0.055) 0%, transparent 64%)',
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.028] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 24%, transparent 76%, rgba(255,255,255,0.02) 100%)',
            }}
            aria-hidden="true"
          />

          <HUD
            progressH={progressH}
            cueOpacity={cueOpacity}
            stage2LabelOp={stage2LabelOp}
            activeStageIdx={activeStageIdx}
          />

          {/* Entry flash — full-screen radial bloom as vault rushes through the camera */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-40"
            style={{
              opacity: vaultEntry,
              background:
                'radial-gradient(circle at 50% 50%, rgba(30,80,255,0.30) 0%, rgba(0,30,120,0.16) 38%, transparent 68%)',
            }}
            aria-hidden="true"
          />

          {/* WORLD */}
          <motion.div
            className="absolute inset-x-0 top-0 h-[250vh]"
            style={{
              transform: worldTransform,
              transformStyle: 'preserve-3d',
              // Pivot around the vault's exact Y position — vault stays locked at eye level
              // while the world rotates forward underneath it
              transformOrigin: '50% 50vh 0px',
            }}
          >
            {/* Central spine */}
            <div
              className="pointer-events-none absolute left-1/2 top-[32vh] h-[56vh] w-px -translate-x-1/2"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(255,255,255,0.04), rgba(0,82,255,0.08), rgba(255,255,255,0.025))',
              }}
              aria-hidden="true"
            />

            {/* HERO / Deposit plane */}
            <motion.div
              className="absolute left-1/2 top-[20vh] flex w-full max-w-4xl flex-col items-center px-4 sm:px-8 text-center"
              style={{
                transform: heroTransform,
                opacity: heroOpacity,
                filter: heroFilter,
              }}
            >
              <motion.div
                className="pointer-events-none absolute left-1/2 top-6 h-px w-[44vw] max-w-[620px]"
                style={{
                  x: '-50%',
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
                }}
                animate={{ opacity: [0.2, 0.55, 0.2] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden="true"
              />

              <motion.div
                className="font-mono font-black leading-none text-center overflow-hidden"
                style={{
                  fontSize: 'clamp(1.4rem, 5.2vw, 5.2rem)',
                  whiteSpace: 'nowrap',
                  opacity: heroTitleOpacity,
                  y: heroTitleY,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    background: 'linear-gradient(170deg, #ffffff 28%, #9da3b3 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Welcome to{' '}
                  <span style={{ WebkitTextFillColor: 'rgba(160,180,255,0.90)' }}>4626.fun</span>
                </span>
              </motion.div>

              {/* Subtitle pills — "Zora Creator Coin" appears with the title;
                  "→ ERC-4626 Vault" appears once the vault seals around the Zorb */}
              <motion.div
                className="mx-auto mt-5 flex w-full max-w-lg items-center justify-center gap-2"
                style={{ opacity: heroPillsOpacity, y: heroPillsY }}
              >
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5">
                  <img src="/protocols/zora.svg" alt="Zora" className="h-3.5 w-3.5 rounded-full" loading="lazy" />
                  <span className="text-[8px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Creator Coin
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5">
                    <img src="/app-icon.svg" alt="4626" className="h-3.5 w-3.5 rounded-[3px]" loading="lazy" />
                    <span className="text-[8px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      ERC-4626 Vault
                    </span>
                  </div>
              </motion.div>

              <motion.p
                className="mx-auto mt-7 max-w-sm text-center text-[13px] font-light leading-[1.85] text-zinc-600 sm:text-[14px]"
                style={{ opacity: heroBodyOpacity, y: heroBodyY }}
              >
                Deposit your creator coin once.{' '}
                <span className="text-zinc-400">Creators and holders earn together — and every trader has a chance to win big.</span>
              </motion.p>
            </motion.div>

            {/* Deposit card — starts at 32vh (above vault) and descends to vault level */}
            <motion.div
              className="absolute left-1/2 top-[32vh] z-30"
              style={{
                transform: depositNodeTransform,
                opacity: depositNodeOpacity,
              }}
            >
              {/* ── Deposit / Distribute / Deploy card ───────────────────────────────
                  Phases swap via a venetian-blind clipPath wipe (top → bottom reveal).
                  Each face is driven by React state so transitions are intentional,
                  not a continuous scroll-position cross-fade. */}
              <div style={{ perspective: '700px', width: 'min(264px, 90vw)' }}>
                <div
                  className="relative overflow-hidden rounded-2xl"
                  style={{
                    transform: 'rotateY(-3deg)',
                    transition: 'transform 0.5s cubic-bezier(0.22,1,0.36,1)',
                    background: 'rgba(7,7,19,0.90)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: prefersReducedMotion ? 'none' : 'blur(20px)',
                    boxShadow: '0 8px 32px -8px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.transform = 'rotateY(0deg)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.transform = 'rotateY(-3deg)')}
                >
                  {/* Phase-keyed accent line — colour shifts with each phase */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px]"
                    style={{
                      background: cardPhase === 1
                        ? 'linear-gradient(90deg,transparent 0%,rgba(249,115,22,0.9) 38%,rgba(59,95,255,0.9) 62%,transparent 100%)'
                        : cardPhase === 2
                        ? 'linear-gradient(90deg,transparent 0%,rgba(100,160,255,0.85) 50%,transparent 100%)'
                        : 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.30) 50%,transparent 100%)',
                      transition: 'background 0.4s ease',
                    }}
                    aria-hidden="true"
                  />

                  {/* Blind wipe — content reveals top→bottom on phase change */}
                  <div className="overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={cardPhase}
                        initial={{ clipPath: 'inset(0% 0% 100% 0%)' }}
                        animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
                        exit={{ clipPath: 'inset(100% 0% 0% 0%)' }}
                        transition={{ duration: 0.30, ease: [0.22, 1, 0.36, 1] }}
                        className="flex flex-col gap-2.5 px-4 py-4"
                      >
                        {cardPhase === 1 && (
                          <>
                            {/* Token label */}
                            <div className="flex items-center gap-1.5">
                              {cameoIcons['akita'] ? (
                                <img src={cameoIcons['akita']} alt="" className="h-3.5 w-3.5 rounded-full object-cover opacity-70" loading="lazy" />
                              ) : (
                                <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[4px] font-black text-white" style={{ background: '#f97316' }}>AK</span>
                              )}
                              <span className="font-mono text-[7px] uppercase tracking-[0.24em]" style={{ color: 'rgba(249,115,22,0.65)' }}>
                                {depositComplete ? 'akita · deposited ✓' : 'akita · pouring into vault'}
                              </span>
                            </div>

                            {/* Static deposit amount — user arrives with 50M, not counting up */}
                            <div className="font-mono text-[28px] font-black leading-none tracking-tight text-white">
                              50,000,000
                            </div>

                            {depositComplete ? (
                              /* Mint confirmation */
                              <span className="font-mono text-[7px] tracking-[0.16em]" style={{ color: 'rgba(57,255,20,0.80)' }}>
                                50,000,000 ■AKITA minted ✓
                              </span>
                            ) : (
                              /* Pour progress bar — drains left→right as akita flows into the vault */
                              <div className="flex flex-col gap-1.5">
                                <div className="overflow-hidden rounded-full bg-white/[0.05]" style={{ height: 2 }}>
                                  <motion.div
                                    className="h-full rounded-full"
                                    style={{
                                      width: depositFillWidth,
                                      background: 'linear-gradient(90deg,#f97316 0%,#fb923c 100%)',
                                      boxShadow: '0 0 6px 1px rgba(249,115,22,0.55)',
                                    }}
                                  />
                                </div>
                                <span className="font-mono text-[7px] tracking-[0.16em]" style={{ color: 'rgba(249,115,22,0.40)' }}>
                                  pouring into vault…
                                </span>
                              </div>
                            )}
                          </>
                        )}

                        {cardPhase === 2 && (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center overflow-hidden rounded-full"
                                style={{ border: '1px solid rgba(100,160,255,0.40)' }}
                              >
                                <img src={shareTokenLogo} alt="" className="h-full w-full object-cover" loading="lazy" />
                              </span>
                              <span className="font-mono text-[7px] uppercase tracking-[0.24em]" style={{ color: 'rgba(100,160,255,0.70)' }}>
                                ■AKITA · distributing
                              </span>
                            </div>
                            <MotionNumber
                              value={remainingMinted}
                              className="font-mono text-[28px] font-black leading-none tracking-tight block"
                              style={{ color: 'rgba(120,175,255,1)' }}
                            />
                            <span className="font-mono text-[7px] tracking-[0.16em]" style={{ color: 'rgba(100,160,255,0.38)' }}>
                              shares remaining to distribute
                            </span>
                          </>
                        )}

                        {cardPhase === 3 && (
                          <>
                            <div className="flex items-center gap-1.5">
                              {cameoIcons['akita'] ? (
                                <img src={cameoIcons['akita']} alt="" className="h-3.5 w-3.5 rounded-full object-cover opacity-70" loading="lazy" />
                              ) : (
                                <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[4px] font-black text-white" style={{ background: '#f97316' }}>AK</span>
                              )}
                              <span className="font-mono text-[7px] uppercase tracking-[0.24em]" style={{ color: 'rgba(249,115,22,0.60)' }}>
                                akita · principal deployed
                              </span>
                            </div>
                            {/* Same 28px as phase 1 — visual consistency across the card */}
                            <div className="font-mono text-[28px] font-black leading-none tracking-tight text-white">
                              50,000,000
                            </div>
                            <span className="font-mono text-[8px] tracking-[0.14em]" style={{ color: 'rgba(249,115,22,0.45)' }}>
                              akita
                            </span>
                            <span className="mt-1 font-mono text-[7px] tracking-[0.16em]" style={{ color: 'rgba(100,160,255,0.38)' }}>
                              4 yield strategies ↓
                            </span>
                          </>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Vault initiated — fades with deposited side */}
              <motion.div
                className="mt-2.5 flex items-center justify-center gap-2"
                style={{ opacity: vaultInitOp }}
              >
                <span className="h-px w-8 bg-blue-500/40" />
                <span className="font-mono text-[8px] tracking-[0.28em] text-blue-400">vault initiated</span>
                <span className="h-px w-8 bg-blue-500/40" />
              </motion.div>
            </motion.div>

            {/* Connector: deposit -> vault */}
            <div
              className="absolute left-1/2 top-[40vh] z-10 -translate-x-1/2"
              style={{ width: 32, height: 108 }}
            >
              <div
                className="absolute left-1/2 top-0 w-px -translate-x-1/2"
                style={{ height: '100%', background: 'rgba(255,255,255,0.05)' }}
              />
              <motion.div
                className="absolute left-1/2 top-0 w-px origin-top -translate-x-1/2"
                style={{
                  height: '100%',
                  scaleY: topTrail,
                  background:
                    'linear-gradient(to bottom, rgba(210,210,230,0.55), rgba(120,120,150,0.12))',
                }}
              />
              <motion.div
                className="pointer-events-none absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 rounded-full"
                style={{
                  y: topDotY,
                  opacity: topDotOp,
                  background: 'rgba(255,255,255,0.9)',
                  boxShadow:
                    '0 0 14px 6px rgba(255,255,255,0.55), 0 0 28px 12px rgba(200,220,255,0.25)',
                }}
                aria-hidden="true"
              />
            </div>

            {/* Vault */}
            <VaultScene
              uid={uid}
              vaultTransform={vaultTransform}
              vaultOpacity={vaultOpacity}
              vaultLidOp={vaultLidOp}
              vaultWallOp={vaultWallOp}
              vaultPostProgress={vaultPostProgress}
              vaultTopProgress={vaultTopProgress}
              vaultGlow={vaultGlow}
              landingFlash={landingFlash}
              zoraGreenFlash={zoraGreenFlash}
              coinEntryGlow={coinEntryGlow}
              zorbFillScale={zorbFillScale}
              zorbFillOp={zorbFillOp}
            />

            {/* ── ■AKITA glass-floor reflection ──────────────────────────────────────
                Lives in WORLD SPACE as a sibling to VaultScene — NOT inside it.
                This means the worldScale zoom-in (0.73→0.76, 1.25→2.2×) carries it
                toward the camera naturally, making Stage 3→4 read as "diving INTO the
                minted ■AKITA Zorb." Z position stays at 0 (no dive animation).
                Materialises after deposit completes (0.50), fades as dive begins (0.73). */}
            <motion.div
              className="pointer-events-none absolute z-20 flex flex-col items-center"
              style={{ top: 'calc(44vh + 48px)', left: '50%', x: '-50%', width: 200, opacity: shareZorbOp }}
              aria-hidden="true"
            >
              {/* Glowing mirror plane — marks the vault's glass floor / Zorb's bottom edge */}
              <div
                style={{
                  width: '100%',
                  height: 1,
                  background: 'linear-gradient(90deg, transparent 0%, rgba(100,160,255,0.22) 8%, rgba(180,220,255,0.88) 28%, rgba(215,240,255,1.0) 50%, rgba(180,220,255,0.88) 72%, rgba(100,160,255,0.22) 92%, transparent 100%)',
                  boxShadow: '0 0 10px 2.5px rgba(0,82,255,0.30)',
                }}
              />
              {/* ■AKITA label — identity stamp between plane and reflection */}
              <div className="mb-1 mt-1.5 flex items-center justify-center gap-1.5">
                <span className="font-mono text-[8px] font-semibold" style={{ color: 'rgba(100,160,255,0.65)' }}>■AKITA</span>
                <span className="h-px w-2.5 flex-shrink-0" style={{ background: 'rgba(100,160,255,0.28)' }} />
                <span className="font-mono text-[7px]" style={{ color: 'rgba(100,160,255,0.38)' }}>minted</span>
              </div>
              {/* Gradient-masked reflected Zorb — same size=96 as original, vertically flipped */}
              <div
                style={{
                  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.62) 20%, transparent 76%)',
                  maskImage:       'linear-gradient(to bottom, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.62) 20%, transparent 76%)',
                }}
              >
                {/* Vertical flip + blue-shift: hue-rotate 192° → electric blue-cyan */}
                <div style={{ transform: 'scaleY(-1)', filter: 'hue-rotate(192deg) saturate(1.55) brightness(0.65)' }}>
                  <ZorbViewer size={96} />
                </div>
              </div>
            </motion.div>

            {/* Distribution fan chart */}
            <DistributionFan
              uid={uid}
              distSectionOp={distSectionOp}
              node0Op={node0Op} node1Op={node1Op} node2Op={node2Op}
              orbitTrav0={orbitTrav0} orbitTrav1={orbitTrav1} orbitTrav2={orbitTrav2}
              nodeGlow0={nodeGlow0} nodeGlow1={nodeGlow1} nodeGlow2={nodeGlow2}
              distGreen0={distGreen0} distGreen1={distGreen1} distGreen2={distGreen2}
              distDotOp0={distDotOp0} distDotOp1={distDotOp1} distDotOp2={distDotOp2}
              dist0DotX={dist0DotX} dist0DotY={dist0DotY}
              dist1DotY={dist1DotY}
              dist2DotX={dist2DotX} dist2DotY={dist2DotY}
              dist0CardY={dist0CardY} dist1CardY={dist1CardY} dist2CardY={dist2CardY}
              distCount0MV={distCount0MV} distCount1MV={distCount1MV} distCount2MV={distCount2MV}
            />


            {/* Deploy chamber */}
            <DeploySection
              uid={uid}
              deployTransform={deployTransform}
              deployOpacity={deployOpacity}
              deployFilter={deployFilter}
              deployTitleOp={deployTitleOp}
              deployTitleY={deployTitleY}
              s4p0={s4p0} s4p1={s4p1} s4p2={s4p2} s4p3={s4p3}
              s4pOp0={s4c0o} s4pOp1={s4c1o} s4pOp2={s4c2o} s4pOp3={s4c3o}
              s4d0={s4d0} s4d1={s4d1} s4d2={s4d2} s4d3={s4d3}
              s4c0o={s4c0o} s4c0y={s4c0y}
              s4c1o={s4c1o} s4c1y={s4c1y}
              s4c2o={s4c2o} s4c2y={s4c2y}
              s4c3o={s4c3o} s4c3y={s4c3y}
            />
          </motion.div>

          {/* Opening curtain — lifts as scene awakens, reveals Zorb emerging from darkness */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-50"
            style={{
              opacity: openingCurtain,
              background: 'linear-gradient(180deg, #000008 0%, rgba(0,0,10,0.92) 55%, rgba(0,0,14,0.78) 100%)',
            }}
            aria-hidden="true"
          />

          {/* Dive flash — camera punches through the Zorb surface at the deposit→distribution
              transition. A radial white-to-blue burst centred on the sphere, selling the
              "we are now inside the vault" moment before distributions appear.             */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-[49]"
            style={{
              opacity: diveFlash,
              background: 'radial-gradient(ellipse 60% 55% at 50% 44%, rgba(255,255,255,0.92) 0%, rgba(220,235,255,0.60) 28%, rgba(140,180,255,0.24) 56%, transparent 78%)',
            }}
            aria-hidden="true"
          />

          {/* Cube interior POV — faint perspective box outline, you're inside the vault */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-[8]"
            style={{ opacity: cubeOp }}
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
            >
              {/* Back wall — the far face of the cube, rounded corners */}
              <rect
                x="30" y="26" width="40" height="48"
                rx="2.6" ry="2.6"
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="0.18"
              />
              {/* 4 perspective edges — corner of back wall → corner of screen */}
              <line x1="30" y1="26" x2="0"   y2="0"   stroke="rgba(255,255,255,0.05)" strokeWidth="0.14" />
              <line x1="70" y1="26" x2="100" y2="0"   stroke="rgba(255,255,255,0.05)" strokeWidth="0.14" />
              <line x1="70" y1="74" x2="100" y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="0.14" />
              <line x1="30" y1="74" x2="0"   y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="0.14" />
              {/* Wall midpoint lines — horizontal depth guides */}
              <line x1="30" y1="50" x2="0"   y2="50"  stroke="rgba(255,255,255,0.025)" strokeWidth="0.1" />
              <line x1="70" y1="50" x2="100" y2="50"  stroke="rgba(255,255,255,0.025)" strokeWidth="0.1" />
              {/* Wall midpoint lines — vertical depth guides */}
              <line x1="50" y1="26" x2="50"  y2="0"   stroke="rgba(255,255,255,0.025)" strokeWidth="0.1" />
              <line x1="50" y1="74" x2="50"  y2="100" stroke="rgba(255,255,255,0.025)" strokeWidth="0.1" />
            </svg>
          </motion.div>

        </div>
      </div>

    </>
  )
}
