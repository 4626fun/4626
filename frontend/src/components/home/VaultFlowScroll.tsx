import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
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
import { STORY_CONTENT } from './vault-flow/model/storyContent'
import { deriveStoryState, type StoryState } from './vault-flow/model/storyClock'
import {
  isBeat,
  isMintConfirmed,
  isDeployStrategiesVisible,
  isEarningTogetherVisible,
  isDistributionVisible,
} from './vault-flow/model/storySelectors'
import { DesktopDistributionHandoffScene } from './vault-flow/scenes/DesktopDistributionHandoffScene'
import { DesktopDeployStrategiesScene } from './vault-flow/scenes/DesktopDeployStrategiesScene'
import { DesktopEarningTogetherScene } from './vault-flow/scenes/DesktopEarningTogetherScene'

const AKITA_ADDRESS = '0x5b674196812451b7cec024fe9d22d2c0b172fa75' as const

type Props = {
  depositTokens: string
  shareTokens: string
}

const STAGE_NAV = [
  { n: '01', label: 'Deposit' },
  { n: '02', label: 'Mint' },
  { n: '03', label: 'Distribute' },
  { n: '04', label: 'Deploy' },
] as const

// Geometric scramble characters — brand-kit "Technical Luxury" aesthetic
const SCRAMBLE_CHARS = ['●', '■', '▲', '◆', '○', '□', '△', '◊', '✶', '✕']
const SHARE_TOKEN_SYMBOL = '■AKITA'
const SHARE_TOKEN_ALT = '■AKITA share token'
const SHARE_TOKEN_BADGE_SRC = '/akita-share-token-badge.webp'


// Precomputed star-field: 42 hand-placed white dots over a 900×600 tile.
// Used as a background-image so it repeats seamlessly and costs zero JS.
const STAR_FIELD_BG = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><circle cx="42" cy="38" r="0.9" fill="white" opacity="0.7"/><circle cx="247" cy="89" r="0.55" fill="white" opacity="0.5"/><circle cx="612" cy="23" r="1.0" fill="white" opacity="0.72"/><circle cx="754" cy="156" r="0.65" fill="white" opacity="0.62"/><circle cx="125" cy="234" r="0.45" fill="white" opacity="0.45"/><circle cx="389" cy="178" r="0.75" fill="white" opacity="0.65"/><circle cx="528" cy="312" r="0.55" fill="white" opacity="0.5"/><circle cx="837" cy="89" r="0.85" fill="white" opacity="0.68"/><circle cx="193" cy="456" r="0.65" fill="white" opacity="0.55"/><circle cx="671" cy="398" r="0.45" fill="white" opacity="0.45"/><circle cx="76" cy="523" r="0.95" fill="white" opacity="0.7"/><circle cx="445" cy="512" r="0.55" fill="white" opacity="0.52"/><circle cx="823" cy="445" r="0.75" fill="white" opacity="0.62"/><circle cx="301" cy="67" r="0.65" fill="white" opacity="0.6"/><circle cx="567" cy="478" r="0.85" fill="white" opacity="0.68"/><circle cx="148" cy="389" r="0.45" fill="white" opacity="0.45"/><circle cx="712" cy="234" r="0.75" fill="white" opacity="0.65"/><circle cx="234" cy="545" r="0.55" fill="white" opacity="0.5"/><circle cx="489" cy="145" r="0.65" fill="white" opacity="0.58"/><circle cx="867" cy="512" r="0.85" fill="white" opacity="0.7"/><circle cx="356" cy="423" r="0.45" fill="white" opacity="0.45"/><circle cx="623" cy="567" r="0.75" fill="white" opacity="0.65"/><circle cx="89" cy="178" r="0.55" fill="white" opacity="0.52"/><circle cx="478" cy="289" r="0.85" fill="white" opacity="0.7"/><circle cx="756" cy="345" r="0.65" fill="white" opacity="0.6"/><circle cx="167" cy="312" r="0.45" fill="white" opacity="0.45"/><circle cx="534" cy="56" r="0.75" fill="white" opacity="0.67"/><circle cx="812" cy="178" r="0.55" fill="white" opacity="0.52"/><circle cx="289" cy="423" r="0.85" fill="white" opacity="0.7"/><circle cx="645" cy="123" r="0.65" fill="white" opacity="0.62"/><circle cx="23" cy="267" r="0.45" fill="white" opacity="0.45"/><circle cx="412" cy="534" r="0.75" fill="white" opacity="0.65"/><circle cx="778" cy="267" r="0.55" fill="white" opacity="0.52"/><circle cx="134" cy="89" r="0.85" fill="white" opacity="0.7"/><circle cx="567" cy="389" r="0.65" fill="white" opacity="0.6"/><circle cx="345" cy="234" r="0.45" fill="white" opacity="0.45"/><circle cx="689" cy="478" r="0.75" fill="white" opacity="0.65"/><circle cx="201" cy="156" r="0.55" fill="white" opacity="0.52"/><circle cx="456" cy="367" r="0.85" fill="white" opacity="0.7"/><circle cx="823" cy="323" r="0.65" fill="white" opacity="0.62"/><circle cx="59" cy="467" r="0.55" fill="white" opacity="0.5"/><circle cx="720" cy="545" r="0.8" fill="white" opacity="0.65"/></svg>')}")`

const smoothstep = (t: number) => t * t * (3 - 2 * t)
const parseTokenAmount = (value: string) => {
  const numeric = value.replace(/[^0-9]/g, '')
  return numeric ? Number(numeric) : 0
}
const stripShareTokenSymbol = (value: string) => value.replace(SHARE_TOKEN_SYMBOL, '').trim()
const SHARE_DISTRIBUTION_AMOUNTS = STORY_CONTENT.distribution.map((row) => parseTokenAmount(row.amount))
const SHARE_DISTRIBUTION_TOTAL = SHARE_DISTRIBUTION_AMOUNTS.reduce((sum, amount) => sum + amount, 0)


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
      <div className="absolute left-8 top-1/2 hidden -translate-y-1/2 sm:block">
        <div className="relative flex flex-col">
          {/* Vertical connector track behind dots */}
          <div
            className="pointer-events-none absolute left-[3px] top-3 bottom-3 w-px"
            style={{ background: 'rgba(255,255,255,0.07)' }}
            aria-hidden="true"
          />
          {STAGE_NAV.map((s, i) => (
            <motion.div
              key={s.n}
              className="relative flex items-center gap-3 py-[11px]"
              animate={{ opacity: activeStageIdx === i ? 1 : activeStageIdx > i ? 0.38 : 0.14 }}
              transition={{ duration: 0.65, ease: [0.32, 0, 0.67, 0] }}
            >
              {/* Stage dot — glows on active */}
              <motion.div
                className="relative z-10 flex-shrink-0 rounded-full"
                animate={{
                  width:      activeStageIdx === i ? 7 : 4,
                  height:     activeStageIdx === i ? 7 : 4,
                  background: activeStageIdx === i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.25)',
                  boxShadow:  activeStageIdx === i
                    ? '0 0 0 2px rgba(100,160,255,0.18), 0 0 8px 3px rgba(100,160,255,0.55)'
                    : '0 0 0 0 transparent',
                }}
                transition={{ duration: 0.55, ease: [0.32, 0, 0.67, 0] }}
              />
              <span className="text-[8px] font-semibold uppercase tracking-[0.24em] text-zinc-400">{s.label}</span>
            </motion.div>
          ))}
        </div>
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
}
const VaultScene = memo(function VaultScene({
  uid, vaultTransform, vaultOpacity, vaultLidOp, vaultWallOp,
  vaultPostProgress, vaultTopProgress, vaultGlow, landingFlash,
  zoraGreenFlash, coinEntryGlow,
}: VaultSceneProps) {
  return (
    <motion.div className="absolute left-1/2 top-[44vh] z-20" style={{ transform: vaultTransform, opacity: vaultOpacity }}>
      <div className="relative">
        {/*
          ─── CUBE GEOMETRY ───────────────────────────────────────────────────────
          8 vertices (SVG coords, viewBox 0 0 244 310):
            Front face   │  Back face
            TL (0, 28)   │  TL (28, 52)
            TR (244, 28) │  TR (216, 52)
            BR (244,302) │  BR (216,238)
            BL (0, 302)  │  BL (28, 238)

          Div-space (px from div top, SVG 244→228px → scale ≈ 0.934):
            Front top    → −164px   Back top    → −142px
            Floor inner  →   44px   Front outer →  108px

          Sphere mask (198×204px) keeps the 210px orb tucked inside the front face:
            shell left = −51px, top = −162px
            orb left = −6px inside shell, top = −4px inside shell

          Glow (140×140): center same, left = −22, top = −116
          ─────────────────────────────────────────────────────────────────────── */}

        {/* ── FLOOR (LID) — bottom face, fills in after walls ─────────────────── */}
        <motion.div
          className="pointer-events-none absolute"
          style={{ bottom: -20, left: -66, right: -66, height: 80, opacity: vaultLidOp }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 244 80" width="100%" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={`${uid}-floor-fill`} x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%"   stopColor="rgba(60,110,255,0.05)" />
                <stop offset="100%" stopColor="rgba(20,50,180,0.20)" />
              </linearGradient>
            </defs>
            {/* Floor face polygon — trapezoid matching back-bottom→front-bottom */}
            <polygon points="28,8 216,8 244,72 0,72" fill={`url(#${uid}-floor-fill)`} />
            {/* Front bottom edge (outer) */}
            <line x1="0" y1="72" x2="244" y2="72" stroke="rgba(160,205,255,0.62)" strokeWidth="1.5" />
            {/* Back bottom edge (inner) */}
            <line x1="28" y1="8" x2="216" y2="8" stroke="rgba(100,148,255,0.28)" strokeWidth="0.8" />
            {/* Left and right depth diagonals */}
            <line x1="0" y1="72" x2="28" y2="8"   stroke="rgba(120,168,255,0.32)" strokeWidth="0.8" />
            <line x1="244" y1="72" x2="216" y2="8" stroke="rgba(120,168,255,0.32)" strokeWidth="0.8" />
            {/* Corner brackets — all 4 corners of the floor face */}
            <polyline points="0,60 0,72 16,72"      stroke="rgba(185,218,255,0.55)" strokeWidth="1.3" fill="none" />
            <polyline points="228,72 244,72 244,60"  stroke="rgba(185,218,255,0.55)" strokeWidth="1.3" fill="none" />
            <polyline points="28,0 28,8 42,8"        stroke="rgba(185,218,255,0.45)" strokeWidth="1.1" fill="none" />
            <polyline points="202,8 216,8 216,0"     stroke="rgba(185,218,255,0.45)" strokeWidth="1.1" fill="none" />
            {/* Floor center marker */}
            <circle cx="122" cy="40" r="2.4" fill="none" stroke="rgba(140,188,255,0.35)" strokeWidth="0.7" />
            {/* Ground shadow ellipse */}
            <ellipse cx="122" cy="74" rx="96" ry="5" fill="rgba(60,110,255,0.14)" />
          </svg>
        </motion.div>

        {/* ── WALLS — full 11-edge wireframe (all but back-bottom which lid draws) */}
        <motion.div
          className="pointer-events-none absolute"
          style={{ left: -66, right: -66, bottom: -20, height: 310, opacity: vaultWallOp }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 244 310" width="100%" height="310" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id={`${uid}-back-post-blur`} x="-80%" y="-20%" width="260%" height="140%">
                <feGaussianBlur stdDeviation="0.6" />
              </filter>
              {/* Front-edge glow — soft bloom on the bright front edges */}
              <filter id={`${uid}-front-glow`} x="-120%" y="-20%" width="340%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Interior fill — slightly warmer atmosphere now */}
            <motion.polygon
              points="0,28 244,28 244,302 0,302"
              fill="rgba(80,130,255,0.032)"
              style={{ opacity: vaultTopProgress }}
            />

            {/* ── FRONT POSTS — glow copies (rendered first, behind sharp lines) */}
            <motion.path d="M 0 302 L 0 28"    stroke="rgba(140,200,255,0.18)" strokeWidth="5" strokeLinecap="round" filter={`url(#${uid}-front-glow)`} style={{ pathLength: vaultPostProgress }} />
            <motion.path d="M 244 302 L 244 28" stroke="rgba(140,200,255,0.18)" strokeWidth="5" strokeLinecap="round" filter={`url(#${uid}-front-glow)`} style={{ pathLength: vaultPostProgress }} />

            {/* ── FRONT POSTS — sharp lines on top */}
            <motion.path d="M 0 302 L 0 28"    stroke="rgba(172,218,255,0.76)" strokeWidth="1.5" strokeLinecap="round" style={{ pathLength: vaultPostProgress }} />
            <motion.path d="M 244 302 L 244 28" stroke="rgba(172,218,255,0.76)" strokeWidth="1.5" strokeLinecap="round" style={{ pathLength: vaultPostProgress }} />

            {/* ── BACK POSTS — dimmer, slightly blurred */}
            <motion.path d="M 28 238 L 28 52"   stroke="rgba(86,124,210,0.17)" strokeWidth="0.75" strokeLinecap="round" filter={`url(#${uid}-back-post-blur)`} style={{ pathLength: vaultPostProgress }} />
            <motion.path d="M 216 238 L 216 52"  stroke="rgba(86,124,210,0.17)" strokeWidth="0.75" strokeLinecap="round" filter={`url(#${uid}-back-post-blur)`} style={{ pathLength: vaultPostProgress }} />

            {/* ── FRONT TOP EDGE — glow copy */}
            <motion.path d="M 0 28 L 244 28"    stroke="rgba(160,215,255,0.15)" strokeWidth="5" strokeLinecap="round" filter={`url(#${uid}-front-glow)`} style={{ pathLength: vaultTopProgress }} />
            {/* ── FRONT TOP EDGE — sharp */}
            <motion.path d="M 0 28 L 244 28"    stroke="rgba(208,234,255,0.80)" strokeWidth="1.5" strokeLinecap="round" style={{ pathLength: vaultTopProgress }} />

            {/* ── BACK TOP EDGE */}
            <motion.path d="M 28 52 L 216 52"   stroke="rgba(86,124,210,0.17)" strokeWidth="0.7" strokeLinecap="round" style={{ pathLength: vaultTopProgress }} />

            {/* ── TOP-FACE DEPTH DIAGONALS */}
            <motion.path d="M 0 28 L 28 52"     stroke="rgba(124,164,245,0.35)" strokeWidth="0.85" strokeLinecap="round" style={{ pathLength: vaultTopProgress }} />
            <motion.path d="M 244 28 L 216 52"  stroke="rgba(124,164,245,0.35)" strokeWidth="0.85" strokeLinecap="round" style={{ pathLength: vaultTopProgress }} />

            {/* ── TOP CORNER BRACKETS */}
            <motion.polyline points="0,28 18,28"    stroke="rgba(220,244,255,0.88)" strokeWidth="2.0" fill="none" style={{ opacity: vaultTopProgress }} />
            <motion.polyline points="0,28 0,48"     stroke="rgba(220,244,255,0.88)" strokeWidth="2.0" fill="none" style={{ opacity: vaultTopProgress }} />
            <motion.polyline points="226,28 244,28" stroke="rgba(220,244,255,0.88)" strokeWidth="2.0" fill="none" style={{ opacity: vaultTopProgress }} />
            <motion.polyline points="244,28 244,48" stroke="rgba(220,244,255,0.88)" strokeWidth="2.0" fill="none" style={{ opacity: vaultTopProgress }} />

          </svg>
        </motion.div>

        {/* ── SPHERE inside the cube ────────────────────────────────────────────
            210×210px glass orb — naturally sits inside the cube front face.
            A soft bottom mask feathers it into the floor instead of a hard clip.
            center = (48, −61) from vault anchor.

            Glow (160×160, 25px inset from sphere edge):
            left = −57+25 = −32,  top = −166+25 = −141.                         */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: -57,
            top: -168,
            width: 210,
            height: 232,
            maskImage: 'linear-gradient(to bottom, black 72%, transparent 97%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 72%, transparent 97%)',
          }}
          aria-hidden="true"
        >
          {/* Sphere body — dark navy base with rich glass highlight */}
          <div
            className="absolute"
            style={{
              left: 0, top: 2, width: 210, height: 210,
              borderRadius: '50%',
              background: [
                // Solid dark-navy base so the orb reads as an object, not void
                'radial-gradient(circle at 50% 50%, rgba(6,14,46,0.94) 0%, rgba(3,7,28,0.98) 100%)',
                // Primary specular — strong catch-light at upper-left
                'radial-gradient(circle at 33% 25%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.06) 20%, transparent 38%)',
                // Secondary highlight — cool-blue diffuse
                'radial-gradient(circle at 42% 38%, rgba(160,210,255,0.11) 0%, transparent 52%)',
                // Bottom depth shadow
                'radial-gradient(circle at 50% 74%, rgba(0,0,20,0.55) 0%, transparent 56%)',
                // Edge vignette
                'radial-gradient(circle at 50% 50%, transparent 56%, rgba(0,8,38,0.22) 80%, rgba(0,4,22,0.34) 100%)',
              ].join(', '),
              boxShadow: [
                'inset 0 0 0 0.5px rgba(140,190,255,0.18)',
                'inset 0 0 48px 8px rgba(18,55,200,0.07)',
                'inset 0 -28px 44px -20px rgba(0,0,48,0.18)',
              ].join(', '),
            }}
          />
          {/* Rim ring — crisper edge definition */}
          <div
            className="absolute"
            style={{
              left: 0, top: 2, width: 210, height: 210,
              borderRadius: '50%',
              border: '1px solid rgba(160,205,255,0.14)',
            }}
          />
          {/* Breathing pulse — slow ambient luminance suggesting the vault is alive */}
          <motion.div
            className="absolute"
            style={{
              left: 18, top: 20, width: 174, height: 174,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 50% 48%, rgba(60,120,255,0.09) 0%, transparent 68%)',
            }}
            animate={{ opacity: [0.4, 0.85, 0.4] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          />
        </div>

        {/* ── GLOWS (centered on sphere, 160×160, left=−32, top=−141) ─────── */}
        {/* Blue ambient */}
        <motion.div
          className="pointer-events-none absolute"
          style={{
            left: -32, top: -141, width: 160, height: 160, borderRadius: '50%',
            opacity: vaultGlow, background: 'transparent',
            boxShadow: [
              '0 0 28px 10px rgba(0,82,255,0.56)',
              '0 0 62px 24px rgba(0,82,255,0.26)',
              '0 0 120px 48px rgba(0,82,255,0.10)',
            ].join(', '),
          }}
          aria-hidden="true"
        />
        {/* White landing flash */}
        <motion.div
          className="pointer-events-none absolute"
          style={{
            left: -32, top: -141, width: 160, height: 160, borderRadius: '50%',
            opacity: landingFlash,
            background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.17) 0%, rgba(210,230,255,0.05) 52%, transparent 76%)',
            boxShadow: [
              '0 0 0 1px rgba(255,255,255,0.60)',
              '0 0 16px 6px rgba(255,255,255,0.36)',
              '0 0 44px 16px rgba(210,230,255,0.18)',
              '0 0 108px 38px rgba(140,180,255,0.08)',
            ].join(', '),
          }}
          aria-hidden="true"
        />
        {/* Zora neon-green deposit flash */}
        <motion.div
          className="pointer-events-none absolute"
          style={{
            left: -40, top: -149, width: 176, height: 176, borderRadius: '50%',
            opacity: zoraGreenFlash, background: 'transparent',
            boxShadow: [
              '0 0 30px 11px rgba(57,255,20,0.70)',
              '0 0 72px 28px rgba(57,255,20,0.34)',
              '0 0 140px 56px rgba(57,255,20,0.12)',
            ].join(', '),
          }}
          aria-hidden="true"
        />
        {/* Orange-blue share-token mint glow */}
        <motion.div
          className="pointer-events-none absolute"
          style={{
            left: -32, top: -141, width: 160, height: 160, borderRadius: '50%',
            opacity: coinEntryGlow, background: 'transparent',
            boxShadow: [
              '0 0 22px 9px rgba(249,115,22,0.46)',
              '0 0 58px 22px rgba(0,82,255,0.32)',
              '0 0 112px 44px rgba(0,82,255,0.14)',
            ].join(', '),
          }}
          aria-hidden="true"
        />

        {/* Layout anchor — maintains relative container height */}
        <div className="h-24 w-24" aria-hidden="true" />
      </div>
    </motion.div>
  )
})


type HeroBlockProps = {
  heroTransform: MotionValue<string>
  heroOpacity: MotionValue<number>
  heroFilter: MotionValue<string>
  heroTitleOpacity: MotionValue<number>
  heroTitleY: MotionValue<number>
  heroPillsOpacity: MotionValue<number>
  heroPillsY: MotionValue<number>
  heroBodyOpacity: MotionValue<number>
  heroBodyY: MotionValue<number>
}
const HeroBlock = memo(function HeroBlock({
  heroTransform, heroOpacity, heroFilter,
  heroTitleOpacity, heroTitleY, heroPillsOpacity, heroPillsY, heroBodyOpacity, heroBodyY,
}: HeroBlockProps) {
  return (
    <>
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
    </>
  )
})

type DepositCardBlockProps = {
  depositNodeTransform: MotionValue<string>
  depositNodeOpacity: MotionValue<number>
  cardPhase: 1 | 2 | 3
  cameoIcons: Record<string, string>
  depositComplete: boolean
  displayDepositTokens: string
  displayShareAmount: string
  normalizedShareTokens: string
  depositFillWidth: MotionValue<string>
  remainingMinted: MotionValue<number>
  vaultInitOp: MotionValue<number>
  topTrail: MotionValue<number>
  topDotY: MotionValue<number>
  topDotOp: MotionValue<number>
  prefersReducedMotion: boolean
}
const DepositCardBlock = memo(function DepositCardBlock({
  depositNodeTransform, depositNodeOpacity,
  cardPhase, cameoIcons, depositComplete,
  displayDepositTokens, displayShareAmount, normalizedShareTokens,
  depositFillWidth, remainingMinted,
  vaultInitOp, topTrail, topDotY, topDotOp,
  prefersReducedMotion,
}: DepositCardBlockProps) {
  return (
    <>
      {/* Deposit card — starts at 32vh (above vault) and descends to vault level */}
      <motion.div
        className={`absolute left-1/2 top-[32vh] z-30 ${(cardPhase === 2 || cardPhase === 3) ? 'hidden sm:block' : ''}`}
        style={{
          transform: depositNodeTransform,
          opacity: depositNodeOpacity,
        }}
      >
        {/* ── Deposit / Distribute / Deploy card ───────────────────────────────
            Phases swap via a venetian-blind clipPath wipe (top → bottom reveal).
            Each face is driven by React state so transitions are intentional,
            not a continuous scroll-position cross-fade. */}
        <div
          style={{
            perspective: '700px',
            width: cardPhase === 2
              ? 'clamp(272px, 78vw, 360px)'
              : cardPhase === 3
              ? 'clamp(176px, 46vw, 228px)'
              : depositComplete || cardPhase !== 1
              ? 'clamp(248px, 68vw, 340px)'
              : 'min(280px, 90vw)',
          }}
        >
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{
              transform: 'rotateY(-3deg)',
              transition: 'transform 0.5s cubic-bezier(0.22,1,0.36,1)',
              background: 'linear-gradient(168deg, rgba(14,16,32,0.90) 0%, rgba(7,7,19,0.96) 100%)',
              border: '1px solid rgba(255,255,255,0.07)',
              backdropFilter: prefersReducedMotion ? 'none' : 'blur(24px)',
              boxShadow: '0 12px 48px -12px rgba(0,0,0,0.82), 0 0 0 0.5px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(8,12,24,0.38)',
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
                  className="flex flex-col gap-2 px-3 py-3 sm:gap-2.5 sm:px-4 sm:py-4"
                >
                  {cardPhase === 1 && (
                    <>
                      {/* Token label */}
                      <div className="flex items-center gap-1.5">
                        {cameoIcons['akita'] ? (
                          <img src={cameoIcons['akita']} alt="akita creator coin" className="h-3.5 w-3.5 rounded-full object-cover opacity-70" loading="lazy" />
                        ) : (
                          <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[4px] font-black text-white" style={{ background: '#f97316' }}>AK</span>
                        )}
                        <span className="font-mono text-[6px] uppercase tracking-[0.22em] sm:text-[7px] sm:tracking-[0.24em]" style={{ color: 'rgba(249,115,22,0.65)' }}>
                          {depositComplete ? 'vault mint confirmed' : 'akita · pouring into vault'}
                        </span>
                      </div>

                      {depositComplete ? (
                        <>
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] sm:items-end sm:gap-3">
                            <div className="flex min-w-0 flex-col gap-1.5">
                              <span className="font-mono text-[6px] uppercase tracking-[0.22em] sm:text-[7px] sm:tracking-[0.24em]" style={{ color: 'rgba(249,115,22,0.62)' }}>
                                akita deposit
                              </span>
                              <div className="font-mono font-black leading-none tracking-tight text-white" style={{ fontSize: 'clamp(0.96rem, 4.2vw, 1.45rem)' }}>
                                {displayDepositTokens}
                              </div>
                              <span className="font-mono text-[6px] tracking-[0.14em] sm:text-[7px] sm:tracking-[0.16em]" style={{ color: 'rgba(249,115,22,0.42)' }}>
                                creator coin deposited
                              </span>
                            </div>
                            <div className="h-px w-full bg-white/[0.07] sm:h-full sm:w-px" />
                            <div className="flex min-w-0 flex-col gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full"
                                  style={{ border: '1px solid rgba(100,160,255,0.40)' }}
                                >
                                  <img src={SHARE_TOKEN_BADGE_SRC} alt={SHARE_TOKEN_ALT} className="h-full w-full object-cover" loading="lazy" />
                                </span>
                                <span className="font-mono text-[6px] uppercase tracking-[0.22em] sm:text-[7px] sm:tracking-[0.24em]" style={{ color: 'rgba(100,160,255,0.72)' }}>
                                  {SHARE_TOKEN_SYMBOL} minted
                                </span>
                              </div>
                              <div className="font-mono font-black leading-none tracking-tight" style={{ color: 'rgba(120,175,255,1)', fontSize: 'clamp(0.96rem, 4.2vw, 1.45rem)' }}>
                                {displayShareAmount}
                              </div>
                              <span className="font-mono text-[6px] tracking-[0.14em] sm:text-[7px] sm:tracking-[0.16em]" style={{ color: 'rgba(100,160,255,0.42)' }}>
                                vault share token live
                              </span>
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-col gap-1.5 border-t border-white/[0.06] pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <span className="font-mono text-[6px] tracking-[0.14em] sm:text-[7px] sm:tracking-[0.16em]" style={{ color: 'rgba(57,255,20,0.80)' }}>
                              {normalizedShareTokens} minted ✓
                            </span>
                            <span className="font-mono text-[6px] tracking-[0.14em] sm:text-[7px] sm:tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.30)' }}>
                              creators + holders aligned
                            </span>
                          </div>
                        </>
                      ) : (
                        /* Pour progress bar — drains left→right as akita flows into the vault */
                        <div className="flex flex-col gap-1.5">
                          <div className="font-mono text-[28px] font-black leading-none tracking-tight text-white">
                            {displayDepositTokens}
                          </div>
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
                          <img src={SHARE_TOKEN_BADGE_SRC} alt={SHARE_TOKEN_ALT} className="h-full w-full object-cover" loading="lazy" />
                        </span>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span className="font-mono text-[7px] uppercase tracking-[0.16em] sm:text-[7px] sm:tracking-[0.24em]" style={{ color: 'rgba(100,160,255,0.86)' }}>
                            share fan-out
                          </span>
                          <span className="font-mono text-[6px] uppercase tracking-[0.16em] text-white/45 sm:hidden">
                            live routing
                          </span>
                          <span className="hidden font-mono text-[7px] uppercase tracking-[0.24em] sm:inline" style={{ color: 'rgba(100,160,255,0.70)' }}>
                            {SHARE_TOKEN_SYMBOL} · distributing
                          </span>
                        </div>
                      </div>
                      <MotionNumber
                        value={remainingMinted}
                        className="block font-mono font-black leading-none tracking-tight"
                        style={{ color: 'rgba(120,175,255,1)', fontSize: 'clamp(2rem, 10vw, 28px)' }}
                      />
                      <span className="font-mono text-[6px] tracking-[0.14em] sm:text-[7px] sm:tracking-[0.16em]" style={{ color: 'rgba(100,160,255,0.38)' }}>
                        shares remaining to distribute
                      </span>
                    </>
                  )}

                  {cardPhase === 3 && (
                    <>
                      <div className="flex items-center gap-1.5">
                        {cameoIcons['akita'] ? (
                          <img src={cameoIcons['akita']} alt="akita creator coin" className="h-3.5 w-3.5 rounded-full object-cover opacity-70" loading="lazy" />
                        ) : (
                          <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[4px] font-black text-white" style={{ background: '#f97316' }}>AK</span>
                        )}
                        <span className="font-mono text-[6px] uppercase tracking-[0.20em] sm:text-[7px] sm:tracking-[0.24em]" style={{ color: 'rgba(249,115,22,0.60)' }}>
                          akita · principal deployed
                        </span>
                      </div>
                      <div className="font-mono font-black leading-none tracking-tight text-white" style={{ fontSize: 'clamp(1.5rem, 8vw, 28px)' }}>
                        {displayDepositTokens}
                      </div>
                      <span className="font-mono text-[7px] tracking-[0.14em]" style={{ color: 'rgba(249,115,22,0.45)' }}>
                        akita
                      </span>
                      <span className="mt-1 font-mono text-[6px] tracking-[0.14em] sm:text-[7px] sm:tracking-[0.16em]" style={{ color: 'rgba(100,160,255,0.38)' }}>
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
    </>
  )
})


export function VaultFlowScroll({
  depositTokens,
  shareTokens,
}: Props) {
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
  const [desktopStoryState, setDesktopStoryState] = useState<StoryState>(() =>
    deriveStoryState(0, 'desktop'),
  )
  const desktopStoryStateRef = useRef<StoryState>(desktopStoryState)
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
    const nextStoryState = deriveStoryState(v, 'desktop')
    const prevStoryState = desktopStoryStateRef.current
    desktopStoryStateRef.current = nextStoryState
    if (
      nextStoryState.beat !== prevStoryState.beat ||
      nextStoryState.phase !== prevStoryState.phase ||
      nextStoryState.allocationRepresentation !== prevStoryState.allocationRepresentation ||
      nextStoryState.milestonesHard.loopActive !== prevStoryState.milestonesHard.loopActive ||
      nextStoryState.milestonesSoft.reEntryHintVisible !== prevStoryState.milestonesSoft.reEntryHintVisible
    ) {
      setDesktopStoryState(nextStoryState)
    }

    // Ref guard: only setState when stage actually changes — eliminates per-frame
    // React reconciliation calls during continuous scrolling.
    const nextStage =
      (isBeat(nextStoryState, 'creatorEstablishes') || isBeat(nextStoryState, 'valueFlowsIn')) ? 0 :
      isBeat(nextStoryState, 'participantDeposits') ? 1 :
      isBeat(nextStoryState, 'distributionMeaningful') ? 2 :
      3 // deployStrategies or earningTogether
    if (nextStage !== activeStageRef.current) {
      activeStageRef.current = nextStage
      setActiveStageIdx(nextStage)
    }

    // Deposit complete — one-time flip on mint milestone.
    if (!depositCompleteRef.current && isMintConfirmed(nextStoryState)) {
      depositCompleteRef.current = true
      setDepositComplete(true)
    }

    // Advance (or retreat) the card phase
    const next: 1 | 2 | 3 =
      (isDeployStrategiesVisible(nextStoryState) || isEarningTogetherVisible(nextStoryState)) ? 3 :
      isDistributionVisible(nextStoryState) ? 2 :
      1
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
    if (!f.s3 && v >= 0.71) { f.s3 = true; fireHardStop('take a moment', 3.2) }
    // Checkpoint 4: all 4 strategy cards at 90%+ opacity
    if (!f.s4 && v >= 0.95) { f.s4 = true; fireHardStop('strategies deployed', 2.5) }
  })

  // Fetch akita token image — only avatar used in this component.
  // Tries coin media first, falls back to creator profile avatar.
  useEffect(() => {
    const run = async () => {
      try {
        const coin = await fetchZoraCoin(AKITA_ADDRESS)
        const coinAny = coin as any
        const img =
          coin?.mediaContent?.previewImage?.small ??
          coin?.mediaContent?.previewImage?.medium ??
          coin?.creatorProfile?.avatar?.previewImage?.small ??
          coinAny?.image ??
          coinAny?.metadata?.image
        if (img) { setCameoIcons({ akita: img }); return }

        const creatorAddr = coin?.creatorAddress
        if (creatorAddr) {
          const profile = await fetchZoraProfile(creatorAddr)
          const avatar = profile?.avatar?.small ?? profile?.avatar?.medium
          if (avatar) setCameoIcons({ akita: avatar })
        }
      } catch {
        // fall back to app-icon.svg
      }
    }
    run()
  }, [])

  const normalizedShareTokens = shareTokens.includes(SHARE_TOKEN_SYMBOL)
    ? shareTokens
    : `${shareTokens} ${SHARE_TOKEN_SYMBOL}`
  const displayDepositTokens = depositTokens
  const displayShareAmount = stripShareTokenSymbol(normalizedShareTokens) || depositTokens
  const totalShareCount = parseTokenAmount(normalizedShareTokens) || SHARE_DISTRIBUTION_TOTAL

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

  // Atmosphere: starts with a whisper of blue at scroll=0 so the cold-open
  // isn't pure void, then blooms as the Zorb lands.
  const atmosphereOpacity = useTransform(scroll, [0, 0.06, 0.20, 1], [0.06, 0.14, 0.32, 0.50])

  // Hero plane — waits in the deep while the Zorb takes its solo moment, then sweeps in
  // from 260px behind camera and locks into position as the title cross-fades up.
  // Arrives 2% sooner (0.13 vs 0.15) to tighten the cold-open before story begins.
  const heroZ = useTransform(scroll, [0, 0.13, 0.30, 0.38], [260, 32, 32, -60])
  const heroY = useTransform(scroll, [0, 0.38], [0, -12])
  const heroScale = useTransform(scroll, [0, 0.13, 0.30, 0.38], [1.08, 0.96, 0.96, 0.88])
  // Hero text: crisp from 0.18-0.30, then a brisk 8% fade that clears before the deposit card enters.
  const heroOpacity = useTransform(scroll, [0, 0.12, 0.18, 0.30, 0.38], [0, 0, 1, 1, 0])
  const heroTitleOpacity = useTransform(scroll, [0.12, 0.18], [0, 1])
  const heroTitleY = useTransform(scroll, [0.12, 0.18], [20, 0])
  const heroPillsOpacity = useTransform(scroll, [0.12, 0.18], [0, 1])
  const heroPillsY = useTransform(scroll, [0.12, 0.18], [14, 0])
  const heroBodyOpacity = useTransform(scroll, [0.18, 0.26], [0, 1])
  const heroBodyY = useTransform(scroll, [0.18, 0.26], [12, 0])
  const heroBlur = useTransform(scroll, [0.30, 0.38], [0, 10])
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
  // During Stage 3 distribution, lift the card above the vault so the sphere + fan stay visible.
  // Returns to baseline before the stage 4 dive so the two lifts don't stack.
  const stage3CardLift = useTransform(scroll, [0.52, 0.56, 0.73, 0.76], [0, -160, -160, 0])
  const stage3CardScale = useTransform(scroll, [0.52, 0.56, 0.73, 0.76], [1, 0.82, 0.82, 1])
  // During Stage 4, dock the summary card upward so the strategy grid owns the center.
  const stage4CardLift = useTransform(scroll, [0.76, 0.82, 0.90], [0, -128, -208])
  const stage4CardScale = useTransform(scroll, [0.76, 0.82, 0.90], [1, 0.86, 0.68])
  const depositNodeY = useTransform(() => topDotY.get() + stage3CardLift.get() + stage4CardLift.get())
  const depositNodeVisualScale = useTransform(() => depositNodeScale.get() * stage3CardScale.get() * stage4CardScale.get())
  const depositNodeTransform = useMotionTemplate`translate3d(-50%, ${depositNodeY}px, 0px) scale(${depositNodeVisualScale})`

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


  // Coin entry glow — fires when deposit fill completes, sustains through all distributions,
  // fades as the dive begins
  const _coinEntryGlowBase = useTransform(scroll, [0.50, 0.54, 0.74, 0.78], [0, 1, 1, 0])
  const coinEntryGlow = useTransform(_coinEntryGlowBase, v => prefersReducedMotion ? 0 : v)
  // Zora neon-green mint flash — a quick tribute to Zora's new identity.
  const _zoraGreenFlashBase = useTransform(scroll, [0.46, 0.485, 0.52], [0, 1, 0])
  const zoraGreenFlash = useTransform(_zoraGreenFlashBase, v => prefersReducedMotion ? 0 : v)
  // Entry radial bloom: peaks as vault rushes through camera, fully faded before deploy content reads
  const vaultEntry = useTransform(scroll, [0.77, 0.81, 0.85], [0, 1, 0])

  // Distribution path progress — used for remainingMinted counter in the deposit card.
  const _d0Raw = useTransform(scroll, [0.53, 0.60], [0, 1])
  const orbitTrav0 = useTransform(_d0Raw, smoothstep)

  const _d1Raw = useTransform(scroll, [0.60, 0.66], [0, 1])
  const orbitTrav1 = useTransform(_d1Raw, smoothstep)

  const _d2Raw = useTransform(scroll, [0.66, 0.71], [0, 1])
  const orbitTrav2 = useTransform(_d2Raw, smoothstep)

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
      const minted = Math.round((fill as number) * totalShareCount)
      const distributed = Math.round(
        (t0 as number) * SHARE_DISTRIBUTION_AMOUNTS[0] +
        (t1 as number) * SHARE_DISTRIBUTION_AMOUNTS[1] +
        (t2 as number) * SHARE_DISTRIBUTION_AMOUNTS[2],
      )
      return Math.max(0, minted - distributed)
    },
  )
  const depositFillWidth = useTransform(depositFillPct, v => `${(Math.min(v, 1) * 100).toFixed(1)}%`)
  // "Vault initiated" confirmation badge — flashes after fill completes
  const vaultInitOp = useTransform(scroll, [0.48, 0.51, 0.52, 0.55], [0, 1, 1, 0])

  // (APY reveal removed — allocation percentages are shown permanently)

  // Vault cage entry freefall: drops in from -32vh, overshoots +4.5vh, snaps to rest.
  // Rotation unwinds simultaneously for a natural arc. Reduced-motion: skip, appear at rest.
  const _vaultFallYBase = useTransform(scroll, [0, 0.05, 0.10, 0.13, 0.16], [-32, -22, -2, 4.5, 0])
  const vaultFallY = useTransform(_vaultFallYBase, v => prefersReducedMotion ? 0 : v)
  const vaultFallRotZ = useTransform(scroll, [0, 0.05, 0.10, 0.16], [-18, -12, -2.5, 0])

  const vaultTransform = useMotionTemplate`
    translate3d(-50%, ${vaultFallY}vh, ${vaultZ}px)
    scale(${vaultScale})
    rotateZ(${vaultFallRotZ}deg)
  `

  // Cube interior POV — fades in during the vault-rush moment, then holds steady through all of stage 4.
  const cubeOp = useTransform(scroll, [0.80, 0.87, 1.0], [0, 1.0, 0.82])

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
          {/* ── SCENE LAYERS (back → front) ──────────────────────────────────── */}

          {/* 1. Deep-space nebula — always faintly visible from frame 0 */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: [
                'radial-gradient(ellipse 78% 54% at 50% 34%, rgba(0,82,255,0.10) 0%, rgba(0,82,255,0.035) 44%, transparent 70%)',
                'radial-gradient(ellipse 50% 40% at 30% 60%, rgba(0,40,160,0.04) 0%, transparent 70%)',
                'radial-gradient(ellipse 40% 35% at 72% 28%, rgba(60,0,180,0.03) 0%, transparent 68%)',
              ].join(', '),
            }}
            aria-hidden="true"
          />

          {/* 2. Star field — tiny white dots, very low opacity */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.22]"
            style={{
              backgroundImage: STAR_FIELD_BG,
              backgroundRepeat: 'repeat',
              backgroundSize: '900px 600px',
            }}
            aria-hidden="true"
          />

          {/* 3. Scroll-driven atmosphere bloom */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: atmosphereOpacity,
              background: [
                'radial-gradient(ellipse 72% 72% at 50% 52%, rgba(255,255,255,0.055) 0%, transparent 64%)',
                'radial-gradient(ellipse 44% 38% at 50% 44%, rgba(60,100,200,0.042) 0%, transparent 68%)',
              ].join(', '),
            }}
            aria-hidden="true"
          />

          {/* 4. Film grain — subtle texture over everything */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.032] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
            aria-hidden="true"
          />

          {/* 5. Edge vignette — dim top/bottom so content floats */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,6,0.18) 0%, transparent 18%, transparent 80%, rgba(0,0,6,0.14) 100%)',
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

            {/* HERO / Deposit plane — unmounted once distribution starts; hero opacity
                reaches 0 at v=0.38 and distributionMeaningful begins at v=0.42, so the
                unmount is invisible. */}
            {(isBeat(desktopStoryState, 'creatorEstablishes') ||
              isBeat(desktopStoryState, 'valueFlowsIn') ||
              isBeat(desktopStoryState, 'participantDeposits')) && (
              <HeroBlock
                heroTransform={heroTransform}
                heroOpacity={heroOpacity}
                heroFilter={heroFilter}
                heroTitleOpacity={heroTitleOpacity}
                heroTitleY={heroTitleY}
                heroPillsOpacity={heroPillsOpacity}
                heroPillsY={heroPillsY}
                heroBodyOpacity={heroBodyOpacity}
                heroBodyY={heroBodyY}
              />
            )}

            {/* Deposit card + connector — not mounted during the two earliest beats where
                depositNodeOpacity is 0. Mounts at participantDeposits (v=0.26), 8 scroll
                units before the visible fade-in at v=0.34, and stays through earningTogether. */}
            {(!isBeat(desktopStoryState, 'creatorEstablishes') &&
              !isBeat(desktopStoryState, 'valueFlowsIn')) && (
              <DepositCardBlock
                depositNodeTransform={depositNodeTransform}
                depositNodeOpacity={depositNodeOpacity}
                cardPhase={cardPhase}
                cameoIcons={cameoIcons}
                depositComplete={depositComplete}
                displayDepositTokens={displayDepositTokens}
                displayShareAmount={displayShareAmount}
                normalizedShareTokens={normalizedShareTokens}
                depositFillWidth={depositFillWidth}
                remainingMinted={remainingMinted}
                vaultInitOp={vaultInitOp}
                topTrail={topTrail}
                topDotY={topDotY}
                topDotOp={topDotOp}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}

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
            />


            {/* Distribution handoff — semantic scene, always active */}
            <DesktopDistributionHandoffScene
              state={desktopStoryState}
              content={STORY_CONTENT}
            />

            {/* Deploy strategies — semantic scene, always active */}
            <DesktopDeployStrategiesScene
              state={desktopStoryState}
              content={STORY_CONTENT}
            />
          </motion.div>

          {/* Earning together — final-beat overlay, self-gated via isEarningTogetherVisible.
              Lives outside the world motion.div so it renders above the cube-interior POV
              (z-8) regardless of world camera transforms at this scroll depth. */}
          <DesktopEarningTogetherScene
            state={desktopStoryState}
            content={STORY_CONTENT}
          />

          {/* Opening curtain — lifts as scene awakens, vault descends from darkness */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-50"
            style={{
              opacity: openingCurtain,
              background: 'linear-gradient(180deg, #000008 0%, rgba(0,0,10,0.92) 55%, rgba(0,0,14,0.78) 100%)',
            }}
            aria-hidden="true"
          />

          {/* Dive flash — full-screen burst as the vault rushes through the camera at the
              Stage 3 → Stage 4 boundary, selling the "entered the vault" transition.      */}
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
