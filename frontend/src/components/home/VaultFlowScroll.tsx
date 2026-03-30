import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion'

import { SHARE_DISTRIBUTION_ROWS, STRATEGY_CARDS } from './launchConfig'

type Props = {
  depositTokens: string
  shareTokens: string
}

// SVG flow geometry — 800 × 120 viewBox, source at centre-top
// Middle path uses a slight S-curve to avoid a degenerate zero-width bounding
// box which would make linearGradient (objectBoundingBox) render invisible.
const DIST_PATHS = [
  'M 400 18 C 400 65 133 65 133 108',
  'M 400 18 C 390 55 410 75 400 108',
  'M 400 18 C 400 65 667 65 667 108',
] as const
const DIST_DESTS = [{ cx: 133, cy: 108 }, { cx: 400, cy: 108 }, { cx: 667, cy: 108 }] as const

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

const STAGE_NAV = [
  { n: '01', label: 'Deposit' },
  { n: '02', label: 'Mint' },
  { n: '03', label: 'Distribute' },
  { n: '04', label: 'Deploy' },
] as const

// Geometric scramble characters — brand-kit "Technical Luxury" aesthetic
const SCRAMBLE_CHARS = ['●', '■', '▲', '◆', '○', '□', '△', '◊', '✶', '✕']

// Decodes a string from geometric symbols → final text over ~800ms
function useTextScramble(text: string, trigger: boolean) {
  const [output, setOutput] = useState(text)
  const frame = useRef(0)
  const progress = useRef(0)

  useEffect(() => {
    if (!trigger) { setOutput(text); return }
    progress.current = 0
    const animate = () => {
      progress.current += 0.7
      setOutput(
        text
          .split('')
          .map((char, i) => {
            if (char === ' ' || i < Math.floor(progress.current)) return char
            return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
          })
          .join(''),
      )
      if (progress.current < text.length + 4) {
        frame.current = requestAnimationFrame(animate)
      } else {
        setOutput(text)
      }
    }
    frame.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame.current)
  }, [trigger, text])

  return output
}

// ── Numbered step chip with text-scramble decode on mount/trigger
function StepChip({ n, label, active }: { n: string; label: string; active: boolean }) {
  const decoded = useTextScramble(label, active)
  return (
    <div className="mb-6 inline-flex items-center gap-2.5">
      <div className="flex h-[18px] w-[26px] items-center justify-center rounded border border-white/[0.1] bg-white/[0.04]">
        <span className="font-mono text-[9px] font-semibold text-zinc-500">{n}</span>
      </div>
      <span className="font-mono text-[9px] font-medium uppercase tracking-[0.28em] text-zinc-500">{decoded}</span>
    </div>
  )
}

// ── Vault visual — Stage 2
function VaultCore({ size = 152 }: { size?: number }) {
  const rings = [
    { mul: 2.4, dur: 9,   delay: 0,   opacity: [0.18, 0.38, 0.18], borderOpacity: '0.06' },
    { mul: 1.9, dur: 7,   delay: 1.8, opacity: [0.28, 0.55, 0.28], borderOpacity: '0.08' },
    { mul: 1.55,dur: 5.5, delay: 3.2, opacity: [0.40, 0.75, 0.40], borderOpacity: '0.13' },
    { mul: 1.26,dur: 4,   delay: 4.2, opacity: [0.55, 1.00, 0.55], borderOpacity: '0.20' },
  ]
  return (
    <div className="relative flex items-center justify-center" style={{ width: size * 2.6, height: size * 2.6 }}>
      {rings.map((r, i) => (
        <motion.div
          key={i}
          className="absolute rounded-[22px] border border-brand-primary"
          style={{
            width: size * r.mul,
            height: size * r.mul,
            borderColor: `rgba(0,82,255,${r.borderOpacity})`,
          }}
          animate={{ scale: [1, 1.02 + i * 0.008, 1], opacity: r.opacity }}
          transition={{ duration: r.dur, repeat: Infinity, ease: 'easeInOut', delay: r.delay }}
        />
      ))}

      {/* Core box */}
      <div
        className="relative z-10 flex flex-col items-center justify-center overflow-hidden rounded-[20px] bg-black/95"
        style={{
          width: size,
          height: size,
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: [
            '0 0 0 1px rgba(0,82,255,0.14)',
            '0 0 55px -8px rgba(0,82,255,0.75)',
            '0 0 130px -30px rgba(0,82,255,0.38)',
            '0 0 220px -60px rgba(0,82,255,0.18)',
            'inset 0 1px 0 rgba(255,255,255,0.06)',
          ].join(', '),
        }}
      >
        {/* Inner dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(0,82,255,0.7) 1px, transparent 1px)',
            backgroundSize: '12px 12px',
          }}
        />

        <span className="relative font-mono text-[7px] font-semibold uppercase tracking-[0.32em] text-zinc-600">
          ERC
        </span>
        <span
          className="relative font-mono font-black leading-none text-brand-primary"
          style={{
            fontSize: size * 0.27,
            textShadow: '0 0 24px rgba(0,82,255,0.7), 0 0 56px rgba(0,82,255,0.35)',
          }}
        >
          4626
        </span>
        <span className="relative mt-1 font-mono text-[7px] font-semibold uppercase tracking-[0.24em] text-zinc-700">
          VAULT
        </span>

        {/* Status dot */}
        <motion.div
          className="absolute bottom-3 right-3 h-1.5 w-1.5 rounded-full bg-brand-primary"
          animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.2, 0.9] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ boxShadow: '0 0 6px rgba(0,82,255,0.9)' }}
        />
      </div>
    </div>
  )
}

export function VaultFlowScroll({ depositTokens, shareTokens }: Props) {
  const uid = useId().replace(/:/g, '')
  const outerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: outerRef, offset: ['start start', 'end end'] })

  const [activeStageIdx, setActiveStageIdx] = useState(0)

  // ══════════════════════════════════════════════════════
  // Stage envelopes — 1000vh outer (~900vh actual scroll).
  // Hero is now min-h-screen, so VaultFlowScroll Stage 1 needs
  // only a short hold before the narrative begins.
  // All transitions are clean crossfades (y: 24→0→-40) —
  // no positional offset hacks. Visual continuity comes from
  // design consistency, not pixel-matching.
  // ══════════════════════════════════════════════════════
  const s1o = useTransform(scrollYProgress, [0.00, 0.01, 0.15, 0.20], [1, 1, 1, 0])
  const s2o = useTransform(scrollYProgress, [0.15, 0.20, 0.38, 0.43], [0, 1, 1, 0])
  const s3o = useTransform(scrollYProgress, [0.34, 0.39, 0.70, 0.75], [0, 1, 1, 0])
  const s4o = useTransform(scrollYProgress, [0.66, 0.71, 0.99, 1.00], [0, 1, 1, 1])

  const s1y = useTransform(scrollYProgress, [0.00, 0.15, 0.20], [0, 0, -40])
  const s2y = useTransform(scrollYProgress, [0.15, 0.20, 0.38, 0.43], [24, 0, 0, -40])
  const s3y = useTransform(scrollYProgress, [0.34, 0.39, 0.70, 0.75], [24, 0, 0, -40])
  const s4y = useTransform(scrollYProgress, [0.66, 0.71, 1.00], [24, 0, 0])

  const s1scale = useTransform(scrollYProgress, [0.00, 0.15, 0.20], [1, 1, 1.015])
  const s2scale = useTransform(scrollYProgress, [0.15, 0.20, 0.38, 0.43], [0.97, 1, 1, 1.015])
  const s3scale = useTransform(scrollYProgress, [0.34, 0.39, 0.70, 0.75], [0.97, 1, 1, 1.015])
  const s4scale = useTransform(scrollYProgress, [0.66, 0.71, 1.00], [0.97, 1, 1])

  // ── Progress rail
  const progressH = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  // ── Stage 1→2: both stage's source elements share the same top anchor,
  // so the crossfade naturally reads as the big number morphing into the pill.
  // s1NumberScale gently contracts the number as it fades.
  // s2PillEnterScale gives the pill a very subtle grow-in (1.08→1).
  const s1NumberScale    = useTransform(scrollYProgress, [0.12, 0.20], [1, 0.08])
  const s2PillEnterScale = useTransform(scrollYProgress, [0.15, 0.21], [1.08, 1])
  const s2PillEnterOp    = useTransform(scrollYProgress, [0.15, 0.20], [0, 1])

  // ── Stage 2 particle story (0.20–0.38, ~162vh)
  // Smoothstep easing: t² · (3 − 2t)
  const _s2TopRaw     = useTransform(scrollYProgress, [0.20, 0.27], [0, 1])
  const s2TrailTopLen = useTransform(_s2TopRaw, (t) => t * t * (3 - 2 * t))
  const s2WhiteDotY   = useTransform(_s2TopRaw, (t) => 52 * t * t * (3 - 2 * t))
  const s2WhiteDotOp  = useTransform(scrollYProgress, [0.20, 0.21, 0.26, 0.27], [0, 1, 1, 0])
  const s2VaultGlow   = useTransform(scrollYProgress, [0.26, 0.30, 0.33], [0, 1, 0])
  const _s2BotRaw     = useTransform(scrollYProgress, [0.30, 0.37], [0, 1])
  const s2TrailBotLen = useTransform(_s2BotRaw, (t) => t * t * (3 - 2 * t))
  const s2BlueDotY    = useTransform(_s2BotRaw, (t) => 52 * t * t * (3 - 2 * t))
  const s2BlueDotOp   = useTransform(scrollYProgress, [0.29, 0.30, 0.36, 0.37], [0, 1, 1, 0])
  const s2MintedOp    = useTransform(scrollYProgress, [0.35, 0.38], [0, 1])

  // ══════════════════════════════════════════════════════
  // Stage 3 — per-path sequential reveals
  // Visible window 0.39–0.70 = ~279 vh (3 paths × ~93vh).
  // ══════════════════════════════════════════════════════
  const s3PillOp = useTransform(scrollYProgress, [0.39, 0.42], [0, 1])
  const s3PillY  = useTransform(scrollYProgress, [0.39, 0.42], [12, 0])

  // Path 0 — CCA Launch
  const _s3p0r = useTransform(scrollYProgress, [0.42, 0.48], [0, 1])
  const s3p0   = useTransform(_s3p0r, (t) => t * t * (3 - 2 * t))
  const s3pOp0 = useTransform(scrollYProgress, [0.41, 0.43], [0, 1])
  const s3d0   = useTransform(scrollYProgress, [0.48, 0.51], [0, 1])
  const s3c0o  = useTransform(scrollYProgress, [0.51, 0.54], [0, 1])
  const s3c0y  = useTransform(scrollYProgress, [0.51, 0.54], [24, 0])

  // Path 1 — Creator Vesting
  const _s3p1r = useTransform(scrollYProgress, [0.54, 0.60], [0, 1])
  const s3p1   = useTransform(_s3p1r, (t) => t * t * (3 - 2 * t))
  const s3pOp1 = useTransform(scrollYProgress, [0.53, 0.55], [0, 1])
  const s3d1   = useTransform(scrollYProgress, [0.60, 0.63], [0, 1])
  const s3c1o  = useTransform(scrollYProgress, [0.63, 0.66], [0, 1])
  const s3c1y  = useTransform(scrollYProgress, [0.63, 0.66], [24, 0])

  // Path 2 — LP Reserve
  const _s3p2r = useTransform(scrollYProgress, [0.63, 0.68], [0, 1])
  const s3p2   = useTransform(_s3p2r, (t) => t * t * (3 - 2 * t))
  const s3pOp2 = useTransform(scrollYProgress, [0.62, 0.64], [0, 1])
  const s3d2   = useTransform(scrollYProgress, [0.68, 0.70], [0, 1])
  const s3c2o  = useTransform(scrollYProgress, [0.69, 0.72], [0, 1])
  const s3c2y  = useTransform(scrollYProgress, [0.69, 0.72], [24, 0])

  const s3CardMotions = [
    { opacity: s3c0o, y: s3c0y },
    { opacity: s3c1o, y: s3c1y },
    { opacity: s3c2o, y: s3c2y },
  ]

  // ══════════════════════════════════════════════════════
  // Stage 4 — per-path sequential reveals
  // Visible window 0.71–1.00 = ~261 vh (4 paths × ~65vh).
  // ══════════════════════════════════════════════════════
  const s4PillOp = useTransform(scrollYProgress, [0.71, 0.74], [0, 1])
  const s4PillY  = useTransform(scrollYProgress, [0.71, 0.74], [12, 0])

  // Path 0 — Charm
  const _s4p0r = useTransform(scrollYProgress, [0.74, 0.77], [0, 1])
  const s4p0   = useTransform(_s4p0r, (t) => t * t * (3 - 2 * t))
  const s4pOp0 = useTransform(scrollYProgress, [0.73, 0.75], [0, 1])
  const s4d0   = useTransform(scrollYProgress, [0.77, 0.79], [0, 1])
  const s4c0o  = useTransform(scrollYProgress, [0.79, 0.82], [0, 1])
  const s4c0y  = useTransform(scrollYProgress, [0.79, 0.82], [24, 0])

  // Path 1 — Ajna
  const _s4p1r = useTransform(scrollYProgress, [0.82, 0.85], [0, 1])
  const s4p1   = useTransform(_s4p1r, (t) => t * t * (3 - 2 * t))
  const s4pOp1 = useTransform(scrollYProgress, [0.81, 0.83], [0, 1])
  const s4d1   = useTransform(scrollYProgress, [0.85, 0.87], [0, 1])
  const s4c1o  = useTransform(scrollYProgress, [0.87, 0.90], [0, 1])
  const s4c1y  = useTransform(scrollYProgress, [0.87, 0.90], [24, 0])

  // Path 2 — Solana
  const _s4p2r = useTransform(scrollYProgress, [0.90, 0.93], [0, 1])
  const s4p2   = useTransform(_s4p2r, (t) => t * t * (3 - 2 * t))
  const s4pOp2 = useTransform(scrollYProgress, [0.89, 0.91], [0, 1])
  const s4d2   = useTransform(scrollYProgress, [0.93, 0.95], [0, 1])
  const s4c2o  = useTransform(scrollYProgress, [0.95, 0.97], [0, 1])
  const s4c2y  = useTransform(scrollYProgress, [0.95, 0.97], [24, 0])

  // Path 3 — Idle Reserve
  const _s4p3r = useTransform(scrollYProgress, [0.94, 0.97], [0, 1])
  const s4p3   = useTransform(_s4p3r, (t) => t * t * (3 - 2 * t))
  const s4pOp3 = useTransform(scrollYProgress, [0.93, 0.95], [0, 1])
  const s4d3   = useTransform(scrollYProgress, [0.97, 0.99], [0, 1])
  const s4c3o  = useTransform(scrollYProgress, [0.97, 1.00], [0, 1])
  const s4c3y  = useTransform(scrollYProgress, [0.97, 1.00], [24, 0])

  const s4CardMotions = [
    { opacity: s4c0o, y: s4c0y },
    { opacity: s4c1o, y: s4c1y },
    { opacity: s4c2o, y: s4c2y },
    { opacity: s4c3o, y: s4c3y },
  ]

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (v < 0.15)      setActiveStageIdx(0)
    else if (v < 0.38) setActiveStageIdx(1)
    else if (v < 0.70) setActiveStageIdx(2)
    else               setActiveStageIdx(3)
  })

  return (
    <>
      {/* ══════════════════════════════════════════════════
          DESKTOP  sticky-scroll cinematic flow  (sm+)
      ══════════════════════════════════════════════════ */}
      <div
        ref={outerRef}
        className="relative hidden sm:block"
        style={{ height: '1000vh' }}
      >
        <div className="sticky top-0 h-screen overflow-hidden">

          {/* Film-grain overlay */}
          <div
            className="pointer-events-none absolute inset-0 z-20 opacity-[0.028] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
            aria-hidden="true"
          />

          {/* Ambient radial glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,82,255,0.10) 0%, rgba(0,82,255,0.03) 45%, transparent 70%)',
            }}
            aria-hidden="true"
          />

          {/* ── Left progress rail */}
          <div className="absolute left-6 top-16 bottom-16 w-px" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <motion.div
              className="absolute inset-x-0 top-0 origin-top"
              style={{
                height: progressH,
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.35), rgba(0,82,255,0.6))',
                borderRadius: 1,
              }}
            />
          </div>

          {/* ── Stage nav indicators */}
          <div className="absolute left-9 top-1/2 -translate-y-1/2 flex flex-col gap-5">
            {STAGE_NAV.map((s, i) => (
              <motion.div
                key={s.n}
                className="flex items-center gap-3"
                animate={{ opacity: activeStageIdx === i ? 1 : 0.16 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                <motion.div
                  className="h-px rounded-full bg-white"
                  animate={{ width: activeStageIdx === i ? 18 : 6, opacity: activeStageIdx === i ? 0.7 : 0.3 }}
                  transition={{ duration: 0.4 }}
                />
                <span className="text-[8px] font-semibold uppercase tracking-[0.24em] text-zinc-400">{s.label}</span>
              </motion.div>
            ))}
          </div>

          {/* ════════════════════════════════════
              STAGE 1 — Deposit
          ════════════════════════════════════ */}
          <motion.div
            style={{ opacity: s1o, y: s1y, scale: s1scale }}
            className="absolute inset-0 flex flex-col items-center justify-start pt-[15vh] sm:pt-[18vh] px-16 text-center"
          >
            {/* Subtle horizontal scan line */}
            <motion.div
              className="pointer-events-none absolute left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)' }}
              animate={{ top: ['-2%', '102%'] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'linear', repeatDelay: 5 }}
              aria-hidden="true"
            />

            <StepChip n="01" label="Deposit" active={activeStageIdx === 0} />

            {/* Main number — gradient text, scales down as stage exits */}
            <motion.p
              className="mt-8 font-mono font-black leading-none"
              style={{
                fontSize: 'clamp(3.2rem, 9vw, 8rem)',
                background: 'linear-gradient(170deg, #ffffff 30%, #a0a0b0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                scale: s1NumberScale,
              }}
            >
              {depositTokens}
            </motion.p>

            {/* TOKEN label + Zora badge */}
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="inline-flex items-center gap-2">
                <div className="h-px w-8 bg-gradient-to-r from-transparent to-zinc-700" />
                <span className="font-mono text-sm font-medium tracking-[0.32em] text-zinc-500">TOKEN</span>
                <div className="h-px w-8 bg-gradient-to-l from-transparent to-zinc-700" />
              </div>

              {/* Zora creator coin badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5">
                <img src="/protocols/zora.svg" alt="Zora" className="h-4 w-4 rounded-full" loading="lazy" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Zora Creator Coin
                </span>
              </div>
            </div>

            <p className="mt-9 max-w-xs text-[13px] font-light leading-[1.8] text-zinc-600">
              Creator deposits into an ERC-4626 vault.&nbsp;
              <span className="text-zinc-500">The principal remains intact while share tokens are minted 1:1.</span>
            </p>

          </motion.div>

          {/* ════════════════════════════════════
              STAGE 2 — Vault Mint (particle story)
          ════════════════════════════════════ */}
          <motion.div
            style={{ opacity: s2o, y: s2y, scale: s2scale }}
            className="absolute inset-0 flex flex-col items-center justify-start pt-[15vh] sm:pt-[18vh] px-16 text-center"
          >
            <StepChip n="02" label="Mint" active={activeStageIdx === 1} />

            {/* Deposit pill — shares top anchor with Stage 1's number */}
            <motion.div
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-1.5"
              style={{ scale: s2PillEnterScale, opacity: s2PillEnterOp }}
            >
              <img src="/protocols/zora.svg" alt="Zora" className="h-3.5 w-3.5 rounded-full opacity-75" loading="lazy" />
              <span className="font-mono text-xs text-zinc-500">{depositTokens}</span>
              <span className="font-mono text-xs tracking-wider text-zinc-700">TOKEN</span>
            </motion.div>

            {/* ── Animated connector: TOKEN pill → vault entrance */}
            <div className="relative flex items-center justify-center" style={{ height: 52, width: 32 }}>
              {/* static dim track */}
              <div
                className="absolute left-1/2 top-0 w-px -translate-x-1/2"
                style={{ height: '100%', background: 'rgba(255,255,255,0.05)' }}
              />
              {/* growing luminous trail */}
              <motion.div
                className="absolute left-1/2 top-0 w-px -translate-x-1/2 origin-top"
                style={{
                  height: '100%',
                  scaleY: s2TrailTopLen,
                  background: 'linear-gradient(to bottom, rgba(210,210,230,0.55), rgba(120,120,150,0.15))',
                }}
              />
              {/* white particle traveling from pill to vault */}
              <motion.div
                className="pointer-events-none absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full"
                style={{
                  y: s2WhiteDotY,
                  opacity: s2WhiteDotOp,
                  background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(200,210,240,0.6) 100%)',
                  boxShadow: '0 0 10px 4px rgba(255,255,255,0.45), 0 0 20px 8px rgba(200,220,255,0.2)',
                }}
                aria-hidden="true"
              />
            </div>

            {/* VaultCore — with scroll-driven glow when particle enters */}
            <div className="relative">
              <motion.div
                className="pointer-events-none absolute inset-[-32px] rounded-full"
                style={{
                  opacity: s2VaultGlow,
                  background: 'radial-gradient(circle, rgba(0,82,255,0.18) 0%, transparent 70%)',
                  boxShadow: '0 0 70px 24px rgba(0,82,255,0.4)',
                }}
                aria-hidden="true"
              />
              <VaultCore size={148} />
            </div>

            {/* ── Animated connector: vault exit → minted output */}
            <div className="relative flex items-center justify-center" style={{ height: 52, width: 32 }}>
              {/* static dim track */}
              <div
                className="absolute left-1/2 top-0 w-px -translate-x-1/2"
                style={{ height: '100%', background: 'rgba(0,82,255,0.07)' }}
              />
              {/* growing blue trail */}
              <motion.div
                className="absolute left-1/2 top-0 w-px -translate-x-1/2 origin-top"
                style={{
                  height: '100%',
                  scaleY: s2TrailBotLen,
                  background: 'linear-gradient(to bottom, rgba(0,82,255,0.65), rgba(0,82,255,0.15))',
                }}
              />
              {/* blue particle traveling from vault to minted output */}
              <motion.div
                className="pointer-events-none absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full"
                style={{
                  y: s2BlueDotY,
                  opacity: s2BlueDotOp,
                  background: 'radial-gradient(circle, rgba(100,160,255,1) 0%, rgba(0,82,255,0.6) 100%)',
                  boxShadow: '0 0 10px 4px rgba(0,82,255,0.55), 0 0 24px 8px rgba(0,82,255,0.25)',
                }}
                aria-hidden="true"
              />
            </div>

            {/* Minted output — revealed only when blue particle arrives */}
            <motion.div style={{ opacity: s2MintedOp }}>
              <div
                className="inline-flex items-center gap-2 rounded-full border px-5 py-2"
                style={{
                  borderColor: 'rgba(0,82,255,0.32)',
                  background: 'rgba(0,82,255,0.06)',
                  boxShadow: '0 0 24px -6px rgba(0,82,255,0.5)',
                }}
              >
                <span
                  className="font-mono font-semibold"
                  style={{
                    fontSize: '0.85rem',
                    color: 'transparent',
                    background: 'linear-gradient(135deg, #4080ff, #0052ff)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {shareTokens}
                </span>
              </div>
              <p className="mt-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.28em] text-brand-primary/40">
                MINTED
              </p>
            </motion.div>

            <p className="mt-8 max-w-xs text-[13px] font-light leading-[1.8] text-zinc-600">
              Vault mints an equal share supply — 1:1 at launch.
              <span className="text-zinc-500"> Both assets are now live, ready for distribution.</span>
            </p>
          </motion.div>

          {/* ════════════════════════════════════
              STAGE 3 — ■TOKEN Distribution
          ════════════════════════════════════ */}
          <motion.div
            style={{ opacity: s3o, y: s3y, scale: s3scale }}
            className="absolute inset-0 flex flex-col items-center justify-start pt-[15vh] sm:pt-[18vh] px-10 lg:px-16"
          >
            <StepChip n="03" label="Distribute" active={activeStageIdx === 2} />

            {/* Source pill — same top anchor as Stage 2's deposit pill */}
            <motion.div className="mt-8" style={{ opacity: s3PillOp, y: s3PillY }}>
              <div
                className="inline-flex items-center gap-2.5 rounded-full px-5 py-2 font-mono text-xs font-semibold"
                style={{
                  border: '1px solid rgba(0,82,255,0.35)',
                  background: 'rgba(0,82,255,0.07)',
                  boxShadow: '0 0 28px -6px rgba(0,82,255,0.55), 0 0 60px -20px rgba(0,82,255,0.25)',
                  color: 'transparent',
                  backgroundImage: 'linear-gradient(135deg, #5090ff, #0052ff)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                }}
              >
                {shareTokens}
              </div>
            </motion.div>

            {/* SVG fan — paths draw one at a time */}
            <div className="relative w-full max-w-2xl">
              <svg viewBox="0 0 800 120" preserveAspectRatio="xMidYMid meet" className="w-full" aria-hidden="true" style={{ height: 108 }}>
                <defs>
                  <linearGradient id={`${uid}-dg`} gradientUnits="userSpaceOnUse" x1="400" y1="18" x2="400" y2="108">
                    <stop offset="0%" stopColor="rgba(0,82,255,0.85)" />
                    <stop offset="100%" stopColor="rgba(0,82,255,0.12)" />
                  </linearGradient>
                  <filter id={`${uid}-df`} x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="4" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* Source dot */}
                <motion.circle cx={400} cy={18} r={5} fill={`url(#${uid}-dg)`} filter={`url(#${uid}-df)`}
                  style={{ opacity: s3PillOp, scale: s3PillOp }} />

                {/* Per-path sequential draws */}
                <motion.path d={DIST_PATHS[0]} stroke={`url(#${uid}-dg)`} strokeWidth="1.5" fill="none"
                  strokeLinecap="round" style={{ pathLength: s3p0, opacity: s3pOp0 }} />
                <motion.path d={DIST_PATHS[1]} stroke={`url(#${uid}-dg)`} strokeWidth="1.5" fill="none"
                  strokeLinecap="round" style={{ pathLength: s3p1, opacity: s3pOp1 }} />
                <motion.path d={DIST_PATHS[2]} stroke={`url(#${uid}-dg)`} strokeWidth="1.5" fill="none"
                  strokeLinecap="round" style={{ pathLength: s3p2, opacity: s3pOp2 }} />

                {/* Per-destination dots */}
                <motion.circle cx={DIST_DESTS[0].cx} cy={DIST_DESTS[0].cy} r={4} fill="rgba(0,82,255,0.7)"
                  filter={`url(#${uid}-df)`} style={{ opacity: s3d0, scale: s3d0 }} />
                <motion.circle cx={DIST_DESTS[1].cx} cy={DIST_DESTS[1].cy} r={4} fill="rgba(0,82,255,0.7)"
                  filter={`url(#${uid}-df)`} style={{ opacity: s3d1, scale: s3d1 }} />
                <motion.circle cx={DIST_DESTS[2].cx} cy={DIST_DESTS[2].cy} r={4} fill="rgba(0,82,255,0.7)"
                  filter={`url(#${uid}-df)`} style={{ opacity: s3d2, scale: s3d2 }} />
              </svg>

              {/* Token-amount labels — appear with each dot, positioned at destination x% */}
              <motion.span
                className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-brand-primary/65"
                style={{ left: '16.6%', top: '100%', opacity: s3d0 }}
              >
                20,000,000
              </motion.span>
              <motion.span
                className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-brand-primary/65"
                style={{ left: '50%', top: '100%', opacity: s3d1 }}
              >
                20,000,000
              </motion.span>
              <motion.span
                className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-brand-primary/65"
                style={{ left: '83.4%', top: '100%', opacity: s3d2 }}
              >
                10,000,000
              </motion.span>
            </div>

            {/* Cards — one at a time */}
            <div className="grid w-full max-w-2xl grid-cols-3 gap-4 lg:gap-5">
              {SHARE_DISTRIBUTION_ROWS.map((row, i) => (
                <motion.div
                  key={row.title}
                  className="relative flex flex-col overflow-hidden rounded-[18px] p-5 lg:p-6"
                  style={{
                    ...s3CardMotions[i],
                    border: '1px solid rgba(0,82,255,0.18)',
                    background: 'linear-gradient(160deg, rgba(0,82,255,0.09) 0%, rgba(0,82,255,0.03) 60%, rgba(0,0,0,0) 100%)',
                  }}
                >
                  {/* Top accent line */}
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-primary/50 to-transparent" />

                  <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-zinc-600">{row.title}</p>
                  <p
                    className="mt-3 font-mono font-black leading-none"
                    style={{
                      fontSize: 'clamp(2.4rem, 5vw, 4rem)',
                      textShadow: '0 0 28px rgba(0,82,255,0.65), 0 0 55px rgba(0,82,255,0.28)',
                      color: '#3370ff',
                    }}
                  >
                    {row.percent}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-brand-primary/55">{row.amount}</p>
                  <p className="mt-2.5 grow text-[11px] font-light leading-relaxed text-zinc-500">{row.description}</p>
                  <Link
                    to={row.route}
                    className="mt-4 self-end text-[9px] font-medium tracking-[0.14em] text-brand-primary/50 hover:text-brand-primary/80 transition-colors"
                  >
                    Learn more →
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ════════════════════════════════════
              STAGE 4 — TOKEN Strategies
          ════════════════════════════════════ */}
          <motion.div
            style={{ opacity: s4o, y: s4y, scale: s4scale }}
            className="absolute inset-0 flex flex-col items-center justify-start pt-[15vh] sm:pt-[18vh] px-10 lg:px-14"
          >
            <StepChip n="04" label="Deploy" active={activeStageIdx === 3} />

            {/* Source pill — same top anchor as all other stages */}
            <motion.div className="mt-8" style={{ opacity: s4PillOp, y: s4PillY }}>
              <div
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.16] px-5 py-2 font-mono text-xs font-semibold text-zinc-200"
                style={{ background: 'rgba(255,255,255,0.04)', boxShadow: '0 0 22px -8px rgba(255,255,255,0.2)' }}
              >
                {depositTokens}&nbsp;<span className="font-medium text-zinc-500">TOKEN</span>
              </div>
            </motion.div>

            {/* SVG fan — paths draw one at a time */}
            <div className="relative w-full max-w-3xl">
              <svg viewBox="0 0 800 120" preserveAspectRatio="xMidYMid meet" className="w-full" aria-hidden="true" style={{ height: 108 }}>
                <defs>
                  <linearGradient id={`${uid}-sg`} gradientUnits="userSpaceOnUse" x1="400" y1="18" x2="400" y2="108">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
                  </linearGradient>
                  <filter id={`${uid}-sf`} x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="3.5" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* Source dot */}
                <motion.circle cx={400} cy={18} r={4} fill="rgba(255,255,255,0.7)" filter={`url(#${uid}-sf)`}
                  style={{ opacity: s4PillOp, scale: s4PillOp }} />

                {/* Per-path sequential draws */}
                <motion.path d={STRAT_PATHS[0]} stroke={`url(#${uid}-sg)`} strokeWidth="1.5" fill="none"
                  strokeLinecap="round" style={{ pathLength: s4p0, opacity: s4pOp0 }} />
                <motion.path d={STRAT_PATHS[1]} stroke={`url(#${uid}-sg)`} strokeWidth="1.5" fill="none"
                  strokeLinecap="round" style={{ pathLength: s4p1, opacity: s4pOp1 }} />
                <motion.path d={STRAT_PATHS[2]} stroke={`url(#${uid}-sg)`} strokeWidth="1.5" fill="none"
                  strokeLinecap="round" style={{ pathLength: s4p2, opacity: s4pOp2 }} />
                <motion.path d={STRAT_PATHS[3]} stroke={`url(#${uid}-sg)`} strokeWidth="1.5" fill="none"
                  strokeLinecap="round" style={{ pathLength: s4p3, opacity: s4pOp3 }} />

                {/* Per-destination dots */}
                <motion.circle cx={STRAT_DESTS[0].cx} cy={STRAT_DESTS[0].cy} r={3.5} fill="rgba(255,255,255,0.45)"
                  filter={`url(#${uid}-sf)`} style={{ opacity: s4d0, scale: s4d0 }} />
                <motion.circle cx={STRAT_DESTS[1].cx} cy={STRAT_DESTS[1].cy} r={3.5} fill="rgba(255,255,255,0.45)"
                  filter={`url(#${uid}-sf)`} style={{ opacity: s4d1, scale: s4d1 }} />
                <motion.circle cx={STRAT_DESTS[2].cx} cy={STRAT_DESTS[2].cy} r={3.5} fill="rgba(255,255,255,0.45)"
                  filter={`url(#${uid}-sf)`} style={{ opacity: s4d2, scale: s4d2 }} />
                <motion.circle cx={STRAT_DESTS[3].cx} cy={STRAT_DESTS[3].cy} r={3.5} fill="rgba(255,255,255,0.45)"
                  filter={`url(#${uid}-sf)`} style={{ opacity: s4d3, scale: s4d3 }} />
              </svg>

              {/* Token-amount labels — appear with each dot */}
              <motion.span
                className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500"
                style={{ left: '12.5%', top: '100%', opacity: s4d0 }}
              >
                15,000,000
              </motion.span>
              <motion.span
                className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500"
                style={{ left: '37.5%', top: '100%', opacity: s4d1 }}
              >
                15,000,000
              </motion.span>
              <motion.span
                className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500"
                style={{ left: '62.5%', top: '100%', opacity: s4d2 }}
              >
                15,000,000
              </motion.span>
              <motion.span
                className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500"
                style={{ left: '87.5%', top: '100%', opacity: s4d3 }}
              >
                5,000,000
              </motion.span>
            </div>

            {/* Cards — one at a time */}
            <div className="grid w-full max-w-3xl grid-cols-4 gap-3 lg:gap-5">
              {STRATEGY_CARDS.map((card, i) => (
                <motion.div
                  key={card.label}
                  className="relative flex flex-col overflow-hidden rounded-[18px] p-4 lg:p-5"
                  style={{
                    ...s4CardMotions[i],
                    border: '1px solid rgba(255,255,255,0.09)',
                    background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 60%, transparent 100%)',
                  }}
                >
                  {/* Top accent line */}
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                  <div className="mb-3 flex items-center gap-1.5">
                    {card.icon ? (
                      <img src={card.icon} alt={card.iconAlt} className={card.iconClassName} loading="lazy" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-white/15" aria-hidden="true" />
                    )}
                    <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-zinc-600">{card.label}</p>
                  </div>

                  <p
                    className="font-mono font-black leading-none"
                    style={{
                      fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
                      textShadow: '0 0 22px rgba(255,255,255,0.4), 0 0 48px rgba(255,255,255,0.18)',
                      color: '#e8e8ef',
                    }}
                  >
                    {card.percent}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-600">{card.amount}</p>
                  <p className="mt-2 grow text-[11px] font-light leading-relaxed text-zinc-500">{card.description}</p>
                  <Link
                    to={card.route}
                    className="mt-3 self-end text-[9px] font-medium tracking-[0.14em] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    Learn more →
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MOBILE: stacked sections
      ══════════════════════════════════════════════════ */}
      <div className="sm:hidden">

        <section className="cinematic-section no-divider-top no-divider-bottom !py-20">
          <div className="mx-auto max-w-sm px-5 text-center">
            <p className="mb-5 text-[9px] font-medium uppercase tracking-[0.3em] text-zinc-600">01 · Deposit</p>
            <p
              className="font-mono font-black leading-none"
              style={{
                fontSize: '3.2rem',
                background: 'linear-gradient(170deg, #ffffff 30%, #a0a0b0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {depositTokens}
            </p>
            <p className="mt-3 font-mono text-sm tracking-[0.28em] text-zinc-500">TOKEN</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
              <img src="/protocols/zora.svg" alt="Zora" className="h-3.5 w-3.5 rounded-full" loading="lazy" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Zora Creator Coin</span>
            </div>
            <p className="mt-6 text-sm font-light leading-relaxed text-zinc-600">
              Depositing into ERC-4626 vault — minting share tokens 1:1.
            </p>
          </div>
        </section>

        <section className="cinematic-section no-divider-top no-divider-bottom !py-16">
          <div className="mx-auto flex max-w-sm flex-col items-center px-5 text-center">
            <p className="mb-4 text-[9px] font-medium uppercase tracking-[0.3em] text-zinc-600">02 · Mint</p>
            <p className="mb-5 font-mono text-xs text-zinc-500">{depositTokens} TOKEN →</p>
            <div
              className="flex flex-col items-center justify-center overflow-hidden rounded-[16px] bg-black/95"
              style={{ width: 124, height: 124, border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 0 44px -8px rgba(0,82,255,0.6)' }}
            >
              <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{ backgroundImage: 'radial-gradient(circle, rgba(0,82,255,0.7) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
              <span className="relative font-mono text-[7px] uppercase tracking-widest text-zinc-600">ERC</span>
              <span className="relative font-mono text-2xl font-black text-brand-primary" style={{ textShadow: '0 0 20px rgba(0,82,255,0.7)' }}>4626</span>
              <span className="relative mt-1 font-mono text-[7px] uppercase tracking-widest text-zinc-700">VAULT</span>
            </div>
            <p className="mt-5 font-mono text-sm font-semibold text-brand-primary">→ {shareTokens}</p>
            <p className="mt-1 font-mono text-[9px] tracking-[0.28em] text-brand-primary/45">MINTED</p>
          </div>
        </section>

        <section className="cinematic-section no-divider-top no-divider-bottom !py-16">
          <div className="mx-auto max-w-sm px-5">
            <p className="mb-2 text-center text-[9px] font-medium uppercase tracking-[0.3em] text-zinc-600">03 · Distribute</p>
            <p className="mb-7 text-center font-mono text-lg font-bold text-brand-primary">{shareTokens}</p>
            <div className="space-y-3">
              {SHARE_DISTRIBUTION_ROWS.map((row) => (
                <div key={row.title} className="relative overflow-hidden rounded-[16px] p-4"
                  style={{ border: '1px solid rgba(0,82,255,0.18)', background: 'linear-gradient(160deg, rgba(0,82,255,0.08), transparent)' }}>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-primary/45 to-transparent" />
                  <div className="flex items-baseline justify-between">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">{row.title}</p>
                    <div className="text-right">
                      <p className="font-mono text-2xl font-black text-brand-primary">{row.percent}</p>
                      <p className="font-mono text-[9px] text-brand-primary/50">{row.amount}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] font-light leading-relaxed text-zinc-500">{row.description}</p>
                  <Link to={row.route} className="mt-2 block text-right text-[9px] font-medium text-brand-primary/45 hover:text-brand-primary/70">Learn more →</Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="cinematic-section no-divider-top no-divider-bottom !py-16">
          <div className="mx-auto max-w-sm px-5">
            <p className="mb-2 text-center text-[9px] font-medium uppercase tracking-[0.3em] text-zinc-600">04 · Deploy</p>
            <p className="mb-7 text-center font-mono text-lg font-bold text-zinc-200">
              {depositTokens} <span className="text-zinc-500">TOKEN</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {STRATEGY_CARDS.map((card) => (
                <div key={card.label} className="relative overflow-hidden rounded-[16px] p-4"
                  style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'linear-gradient(160deg, rgba(255,255,255,0.05), transparent)' }}>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  <div className="mb-2.5 flex items-center gap-1.5">
                    {card.icon ? (
                      <img src={card.icon} alt={card.iconAlt} className={card.iconClassName} loading="lazy" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-white/15" aria-hidden="true" />
                    )}
                    <p className="text-[8px] font-semibold uppercase tracking-widest text-zinc-600">{card.label}</p>
                  </div>
                  <p className="font-mono text-2xl font-black text-zinc-100">{card.percent}</p>
                  <p className="font-mono text-[9px] text-zinc-600">{card.amount}</p>
                  <p className="mt-1.5 text-[11px] font-light leading-relaxed text-zinc-500">{card.description}</p>
                  <Link to={card.route} className="mt-2 block text-right text-[9px] font-medium text-zinc-600 hover:text-zinc-400">Learn more →</Link>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </>
  )
}
