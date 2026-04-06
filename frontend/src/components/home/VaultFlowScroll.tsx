import { useEffect, useRef, useState } from 'react'
import { motion, type MotionValue, useMotionValueEvent, useScroll, useTransform } from 'framer-motion'

import { fetchZoraCoin, fetchZoraProfile } from '@/lib/zora/client'
import { STORY_CONTENT } from '@/features/home/vault-flow/model/storyContent'

const AKITA_ADDRESS = '0x5b674196812451b7cec024fe9d22d2c0b172fa75' as const
const TOTAL_TOKENS  = 50_000_000
const STORY_SCROLL_VH = 2800
const STRATEGY_REVENUE_PULSES = [
  { strategy: 'Charm', value: '+$1.00' },
  { strategy: 'Ajna', value: '+$0.21' },
  { strategy: 'Solana', value: '+$6.30' },
] as const

// Centralized scroll timeline so pacing can be tuned in one place.
const TIMING = {
  beat1: { inStart: 0.00, inEnd: 0.04, holdEnd: 0.12, outEnd: 0.16 },
  beat2: {
    inStart: 0.18, inEnd: 0.24, holdEnd: 0.32, outEnd: 0.36,
    phase1: [0.19, 0.24, 0.265, 0.285] as const,
    phase2: [0.255, 0.29, 0.33, 0.36] as const,
    phase3: [0.305, 0.335, 0.35, 0.36] as const,
  },
  beat3: {
    inStart: 0.39, inEnd: 0.45, holdEnd: 0.53, outEnd: 0.56,
    slot: [0.462, 0.49] as const,
    slitGlow: [0.462, 0.49, 0.55] as const,
    rotateDrop: [0.475, 0.505, 0.525] as const,
    count: [0.39, 0.485] as const,
  },
  beat4: { inStart: 0.54, inEnd: 0.60, holdEnd: 0.66, outEnd: 0.70 },
  beat5: {
    inStart: 0.68, inEnd: 0.74, holdEnd: 0.86, outEnd: 0.90,
    pathA: [0.74, 0.79] as const,
    pathB: [0.765, 0.815] as const,
    pathC: [0.79, 0.84] as const,
    cardA: [0.78, 0.805] as const,
    cardB: [0.805, 0.83] as const,
    cardC: [0.83, 0.855] as const,
  },
  beat6: {
    inStart: 0.84, inEnd: 0.89, holdEnd: 0.985, outEnd: 1.0,
    pathL: [0.89, 0.935] as const,
    pathR: [0.905, 0.95] as const,
    pathBL: [0.935, 0.97] as const,
    pathBR: [0.95, 0.98] as const,
    cardA: [0.92, 0.945] as const,
    cardB: [0.935, 0.96] as const,
    cardC: [0.95, 0.975] as const,
    cardD: [0.965, 0.99] as const,
    revA: [0.895, 0.925, 0.995] as const,
    revB: [0.91, 0.94, 0.997] as const,
    revC: [0.925, 0.955, 1] as const,
    growthPanel: [0.93, 0.955, 0.997, 1] as const,
    growthBar: [0.89, 0.985] as const,
    growthCurve: [0.89, 0.94, 0.965, 0.985] as const,
  },
} as const

type Props = {
  depositTokens: string
  shareTokens: string
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const GRAIN_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

const BLUE   = '59,130,246'
const ORANGE = '245,158,11'

const BEAT_ACCENTS: Record<number, string> = {
  1: `radial-gradient(ellipse 70% 50% at 50% 65%, rgba(${BLUE},0.06) 0%, transparent 70%)`,
  2: `radial-gradient(ellipse 70% 55% at 50% 55%, rgba(${BLUE},0.08) 0%, transparent 70%)`,
  3: `radial-gradient(ellipse 55% 45% at 50% 50%, rgba(${BLUE},0.07) 0%, transparent 70%)`,
  4: `radial-gradient(ellipse 60% 55% at 50% 50%, rgba(${BLUE},0.14) 0%, transparent 70%)`,
  5: `radial-gradient(ellipse 85% 55% at 50% 55%, rgba(${BLUE},0.08) 0%, transparent 70%)`,
  6: `radial-gradient(ellipse 85% 60% at 50% 55%, rgba(${ORANGE},0.06) 0%, transparent 70%)`,
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// Beat 2 — deposit flow animation: $TOKEN → vault → ■TOKEN
const FLOW_CYCLE = 3.6 // seconds for one full deposit cycle

function DepositFlowViz({ avatarSrc }: { avatarSrc: string | null }) {
  const tokenRing = {
    border: '1.5px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
  }
  const inputPath = 'path("M 78 100 C 168 100 230 74 286 74 C 308 74 320 86 320 104 L 320 164")'
  const outputPath = 'path("M 320 110 C 342 100 392 82 466 82 C 512 82 548 90 572 100")'

  return (
    <div className="mb-6 w-full max-w-[640px] sm:mb-8" data-testid="beat-2-vault-machine">
      <div className="relative mx-auto h-[190px] w-full">
        {/* Subtle motion guides so the input/output path reads clearly. */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 640 190" aria-hidden="true">
          <path
            d="M 78 100 C 168 100 230 74 286 74 C 308 74 320 86 320 104 L 320 164"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 320 110 C 342 100 392 82 466 82 C 512 82 548 90 572 100"
            stroke={`rgba(${BLUE},0.13)`}
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>

        {/* Single $AKITA token following one continuous cubic-bezier pass into the vault. */}
        <motion.div
          className="pointer-events-none absolute left-0 top-0 z-20"
          data-testid="beat-2-input-token"
          style={{ offsetPath: inputPath, offsetRotate: '0deg' }}
          animate={{
            offsetDistance: ['0%', '100%'],
            scale: [1, 0.97, 0.90, 0.74],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            offsetDistance: { duration: FLOW_CYCLE, repeat: Infinity, ease: 'linear' },
            scale: { duration: FLOW_CYCLE, repeat: Infinity, times: [0, 0.55, 0.86, 1], ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: FLOW_CYCLE, repeat: Infinity, times: [0, 0.08, 0.9, 1], ease: 'linear' },
          }}
        >
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-14 w-14 overflow-hidden rounded-full" style={tokenRing}>
              {avatarSrc
                ? <img src={avatarSrc} alt={STORY_CONTENT.creatorTokenSymbol} className="h-full w-full rounded-full object-cover" loading="lazy" />
                : <div className="flex h-full w-full items-center justify-center"><div className="h-2.5 w-2.5 rounded-full bg-white/40" /></div>
              }
            </div>
            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {STORY_CONTENT.creatorTokenSymbol.toLowerCase()}
            </span>
          </div>
        </motion.div>

        {/* Vault machine */}
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
          <motion.div
            className="relative h-[116px] w-[128px] overflow-hidden rounded-[28px]"
            animate={{
              scale: [1, 1.02, 1],
              boxShadow: [
                `0 0 0px rgba(${BLUE},0)`,
                `0 0 34px rgba(${BLUE},0.20)`,
                `0 0 10px rgba(${BLUE},0.08)`,
              ],
            }}
            transition={{
              duration: FLOW_CYCLE,
              repeat: Infinity,
              times: [0, 0.58, 1],
              ease: 'easeInOut',
            }}
            style={{
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
            }}
          >
            <div
              className="absolute left-1/2 top-3 h-2 w-16 -translate-x-1/2 rounded-full"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            />

            <motion.div
              className="absolute left-1/2 top-5 w-px -translate-x-1/2"
              animate={{ height: [10, 10, 42, 56], opacity: [0, 0.12, 0.40, 0.08] }}
              transition={{
                duration: FLOW_CYCLE,
                repeat: Infinity,
                times: [0, 0.46, 0.62, 0.82],
                ease: 'easeInOut',
              }}
              style={{ background: `linear-gradient(to bottom, rgba(${BLUE},0.04), rgba(${BLUE},0.45), rgba(${BLUE},0.02))` }}
            />

            <motion.div
              className="absolute inset-x-3 bottom-3 rounded-[18px]"
              animate={{
                height: ['18%', '18%', '34%', '22%'],
                opacity: [0.18, 0.18, 0.34, 0.18],
              }}
              transition={{
                duration: FLOW_CYCLE,
                repeat: Infinity,
                times: [0, 0.52, 0.72, 1],
                ease: 'easeInOut',
              }}
              style={{
                background: `linear-gradient(180deg, rgba(${BLUE},0.00), rgba(${BLUE},0.18))`,
                filter: `blur(1px)`,
              }}
            />

            <div className="absolute inset-0 flex items-center justify-center">
              <img src="/brand/4626.svg" alt="4626 vault" className="h-11 w-11 object-contain" loading="lazy" style={{ opacity: 0.82 }} />
            </div>
          </motion.div>
          <span className="text-[10px] font-mono" style={{ color: `rgba(${BLUE},0.45)` }}>vault</span>
        </div>

        {/* Single ■AKITA token minted out of the vault on one continuous cubic-bezier pass. */}
        <motion.div
          className="pointer-events-none absolute left-0 top-0 z-20"
          data-testid="beat-2-output-token"
          style={{ offsetPath: outputPath, offsetRotate: '0deg' }}
          animate={{
            offsetDistance: ['0%', '100%'],
            scale: [0.72, 0.86, 0.95, 1],
            opacity: [0, 0, 1, 1, 0],
          }}
          transition={{
            offsetDistance: { duration: FLOW_CYCLE, repeat: Infinity, ease: 'linear' },
            scale: { duration: FLOW_CYCLE, repeat: Infinity, times: [0, 0.35, 0.75, 1], ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: FLOW_CYCLE, repeat: Infinity, times: [0, 0.2, 0.34, 0.9, 1], ease: 'linear' },
          }}
        >
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-14 w-14 overflow-hidden rounded-lg" style={{ boxShadow: `0 0 20px rgba(${BLUE},0.16)` }}>
              <img src={STORY_CONTENT.shareTokenBadgeSrc} alt={STORY_CONTENT.shareTokenSymbol} className="h-full w-full object-contain" loading="lazy" />
            </div>
            <span className="text-[10px] font-mono" style={{ color: `rgba(${BLUE},0.50)` }}>
              {STORY_CONTENT.shareTokenSymbol}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}


// Beat 4 — two parallel vertical lines with a downward blue pulse.
const MINT_LINE_BG   = `rgba(${BLUE},0.12)`
const MINT_PULSE_GRD = `linear-gradient(to bottom, transparent 0%, rgba(${BLUE},0.90) 50%, transparent 100%)`

function MintLines() {
  const t = { repeat: Infinity, duration: 1.5, ease: 'linear' as const }
  return (
    <div className="flex items-center gap-5">
      <div className="w-[1px] h-20 relative overflow-hidden" style={{ background: MINT_LINE_BG }}>
        <motion.div className="absolute top-0 w-full" style={{ height: '45%', background: MINT_PULSE_GRD }}
          initial={{ y: '-100%' }} animate={{ y: '240%' }} transition={{ ...t, delay: 0 }} />
      </div>
      <p className="text-[9px] uppercase tracking-[0.38em] font-medium select-none" style={{ color: `rgba(${BLUE},0.55)` }}>
        mints
      </p>
      <div className="w-[1px] h-20 relative overflow-hidden" style={{ background: MINT_LINE_BG }}>
        <motion.div className="absolute top-0 w-full" style={{ height: '45%', background: MINT_PULSE_GRD }}
          initial={{ y: '-100%' }} animate={{ y: '240%' }} transition={{ ...t, delay: 0.25 }} />
      </div>
    </div>
  )
}

function DepositSlot({ testId }: { testId?: string }) {
  return (
    <div className="flex flex-col items-center gap-2" aria-hidden="true" data-testid={testId}>
      <div
        className="h-px w-36"
        style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.18), rgba(255,255,255,0.02))' }}
      />
      <div
        className="h-3 w-24 rounded-full"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 26px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      />
    </div>
  )
}

// Beat 5 — three cubic bezier paths fanning from a central source to three cards.
// viewBox 600×120: source (300,6), endpoints (80,114) (300,114) (520,114).
// Paths are white so they read as neutral connectors; nodes are blue accent dots.
type PathProps3 = { p1: MotionValue<number>; p2: MotionValue<number>; p3: MotionValue<number> }

function DistributionPaths({ p1, p2, p3 }: PathProps3) {
  const stroke = 'rgba(255,255,255,0.38)'
  const dot    = `rgba(${BLUE},0.95)`
  return (
    <svg viewBox="0 0 600 120" className="w-full max-w-3xl mx-auto" style={{ height: 120, overflow: 'visible' }} aria-hidden="true">
      <circle cx="300" cy="6" r="3.5" fill={dot} />
      <motion.path d="M 300 6 C 300 65 80 65 80 114"   stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: p1 }} />
      <motion.path d="M 300 6 C 300 65 300 65 300 114" stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: p2 }} />
      <motion.path d="M 300 6 C 300 65 520 65 520 114" stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: p3 }} />
      <motion.circle cx="80"  cy="114" r="3" fill={dot} style={{ opacity: p1 }} />
      <motion.circle cx="300" cy="114" r="3" fill={dot} style={{ opacity: p2 }} />
      <motion.circle cx="520" cy="114" r="3" fill={dot} style={{ opacity: p3 }} />
    </svg>
  )
}

// Beat 6 — four independent bezier arcs, all originating from the source node.
// SVG viewBox 600×120 + overflow:visible so arcs extend into the grid below.
// Grid geometry (SVG px coords):
//   top-row cards:    y=128–214  →  endpoint at top edge y=128
//   bottom-row cards: y=226–312  →  endpoint at top edge y=226
//   left column cx=150, right column cx=450
// Top paths control points at y=80 (short arc), bottom paths at y=165 (deep arc).
type PathProps2 = {
  pLeft: MotionValue<number>
  pRight: MotionValue<number>
  pBotLeft: MotionValue<number>
  pBotRight: MotionValue<number>
}

function StrategyBranches({ pLeft, pRight, pBotLeft, pBotRight }: PathProps2) {
  const stroke   = 'rgba(255,255,255,0.22)'
  const nodeFill = `rgba(${ORANGE},0.65)`
  const nodeGlow = `drop-shadow(0 0 4px rgba(${ORANGE},0.40))`
  return (
    <svg viewBox="0 0 600 120" className="w-full max-w-2xl mx-auto" style={{ height: 120, overflow: 'visible' }} aria-hidden="true">
      {/* source */}
      <circle cx="300" cy="6" r="4" fill={nodeFill} style={{ filter: nodeGlow }} />

      {/* top-row arcs — tighter curve, arrives at top of top cards */}
      <motion.path d="M 300 6 C 300 80 150 80 150 128" stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: pLeft }} />
      <motion.path d="M 300 6 C 300 80 450 80 450 128" stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: pRight }} />

      {/* bottom-row arcs — deeper curve, arrives at top of bottom cards */}
      <motion.path d="M 300 6 C 300 165 150 165 150 226" stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: pBotLeft }} />
      <motion.path d="M 300 6 C 300 165 450 165 450 226" stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: pBotRight }} />

      {/* four endpoint nodes */}
      <motion.circle cx="150" cy="128" r="3.5" fill={nodeFill} style={{ opacity: pLeft,    filter: nodeGlow }} />
      <motion.circle cx="450" cy="128" r="3.5" fill={nodeFill} style={{ opacity: pRight,   filter: nodeGlow }} />
      <motion.circle cx="150" cy="226" r="3.5" fill={nodeFill} style={{ opacity: pBotLeft, filter: nodeGlow }} />
      <motion.circle cx="450" cy="226" r="3.5" fill={nodeFill} style={{ opacity: pBotRight,filter: nodeGlow }} />
    </svg>
  )
}


// ── Root ───────────────────────────────────────────────────────────────────────

export function VaultFlowScroll(_props: Props) {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const numberRef    = useRef<HTMLDivElement>(null)
  const growthDayRef = useRef<HTMLSpanElement>(null)
  const growthRatioRef = useRef<HTMLSpanElement>(null)

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })

  // ── Timing system ──────────────────────────────────────────────────────────
  // 2800vh total.  1% = 28vh.
  //
  // Every crossfade uses the SAME ±30px y-motion so each scroll unit feels
  // identical regardless of where you are in the story:
  //   entry: y +30 → 0  (rises into position from below)
  //   exit:  y 0 → -30  (drifts upward and out)
  //
  // Crossfade windows are 4–6% (112–168vh), with explicit gaps between beats.
  //
  // Exception: Beat 3 exits via a hard clip-through-floor; Beat 4 enters
  // with a 150px pop-up — these are deliberate moment-of-transformation beats.
  //
  //  Beat  │ in       │ hold / sequence │ out
  //  ────────────────────────────────────────────────────────────
  //  1     │ 0–4%     │ 4–12%           │ 12–16%
  //  2     │ 18–24%   │ 24–32%          │ 32–36%
  //  3     │ 39–45%   │ 45–53%          │ clip 47.5–52.5%, opac 53–56%
  //  4     │ 54–60%   │ 60–66%          │ 66–70%
  //  5     │ 68–74%   │ paths+cards     │ 86–90%
  //  6     │ 84–89%   │ branches+cards  │ 98.5–100%

  const t = TIMING

  // Beat 1: The Threshold
  const opacityBeat1 = useTransform(
    scrollYProgress,
    [t.beat1.inStart, t.beat1.inEnd, t.beat1.holdEnd, t.beat1.outEnd],
    [1, 1, 1, 0],
  )
  const yBeat1 = useTransform(scrollYProgress, [t.beat1.inStart, t.beat1.outEnd], [0, -30])

  // Beat 2: Deposit → Mint — sequential, single-focus reveals.
  // Phase 1 (deposit) clears before phase 2 (receive) becomes dominant so the user
  // never has to parse multiple competing headlines at once.
  const opacityBeat2 = useTransform(
    scrollYProgress,
    [t.beat2.inStart, t.beat2.inEnd, t.beat2.holdEnd, t.beat2.outEnd],
    [0, 1, 1, 0],
  )
  const yBeat2 = useTransform(scrollYProgress, [t.beat2.inStart, t.beat2.inEnd, t.beat2.outEnd], [30, 0, -30])
  const b2P1   = useTransform(scrollYProgress, t.beat2.phase1, [0, 1, 1, 0])
  const b2Y1   = useTransform(scrollYProgress, [t.beat2.phase1[0], t.beat2.phase1[1], t.beat2.phase1[3]], [18, 0, -10])
  const b2P2   = useTransform(scrollYProgress, t.beat2.phase2, [0, 1, 1, 0])
  const b2Y2   = useTransform(scrollYProgress, [t.beat2.phase2[0], t.beat2.phase2[1], t.beat2.phase2[3]], [18, 0, -10])
  const b2P3   = useTransform(scrollYProgress, t.beat2.phase3, [0, 1, 1, 0])
  const b2Y3   = useTransform(scrollYProgress, [t.beat2.phase3[0], t.beat2.phase3[1], t.beat2.phase3[3]], [12, 0, -6])

  // Beat 3: The Commitment — keep the bill centered while it rotates to 90deg,
  // then perform the left/down drop into the slit as a second phase.
  const opacityBeat3 = useTransform(
    scrollYProgress,
    [t.beat3.inStart, t.beat3.inEnd, t.beat3.holdEnd, t.beat3.outEnd],
    [0, 1, 1, 0],
  )
  const scaleBeat3   = useTransform(scrollYProgress, [t.beat3.inStart, t.beat3.inEnd], [0.92, 1])
  const billRotate3  = useTransform(scrollYProgress, t.beat3.rotateDrop, [0, 90, 90])
  const billX3       = useTransform(scrollYProgress, t.beat3.rotateDrop, [0, 0, 0])
  const billY3       = useTransform(scrollYProgress, t.beat3.rotateDrop, [0, 0, 118])
  const billScale3   = useTransform(scrollYProgress, t.beat3.rotateDrop, [1, 1, 0.9])
  const slotOpacity3 = useTransform(scrollYProgress, t.beat3.slot, [0, 1])
  const slitGlow3    = useTransform(scrollYProgress, t.beat3.slitGlow, [0.94, 1, 0.98])
  const countMV      = useTransform(scrollYProgress, t.beat3.count, [0, TOTAL_TOKENS])

  // Beat 4: The Mint — shares appear only after the bill has committed into the slit.
  const opacityBeat4 = useTransform(
    scrollYProgress,
    [t.beat4.inStart, t.beat4.inEnd, t.beat4.holdEnd, t.beat4.outEnd],
    [0, 1, 1, 0],
  )
  const scaleBeat4 = useTransform(scrollYProgress, [t.beat4.inStart, t.beat4.inEnd], [0.72, 1])
  const yBeat4     = useTransform(scrollYProgress, [t.beat4.inStart, t.beat4.inEnd, t.beat4.outEnd], [150, 0, -30])

  // Beat 5: Distribution — one continuous cubic-bezier sweep (no path-by-path staging).
  const opacityBeat5 = useTransform(
    scrollYProgress,
    [t.beat5.inStart, t.beat5.inEnd, t.beat5.holdEnd, t.beat5.outEnd],
    [0, 1, 1, 0],
  )
  const yBeat5 = useTransform(
    scrollYProgress,
    [t.beat5.inStart, t.beat5.inEnd, t.beat5.holdEnd, t.beat5.outEnd],
    [30, 0, 0, -30],
  )
  const path5Progress = useTransform(scrollYProgress, [t.beat5.pathA[0], t.beat5.pathC[1]], [0, 1])
  const path5A = path5Progress
  const path5B = path5Progress
  const path5C = path5Progress
  const opac5A = useTransform(scrollYProgress, t.beat5.cardA, [0, 1])
  const opac5B = useTransform(scrollYProgress, t.beat5.cardB, [0, 1])
  const opac5C = useTransform(scrollYProgress, t.beat5.cardC, [0, 1])

  // Beat 6: Yield Strategies — one shared branch expansion, then value accretion story.
  const opacityBeat6 = useTransform(
    scrollYProgress,
    [t.beat6.inStart, t.beat6.inEnd, t.beat6.holdEnd, t.beat6.outEnd],
    [0, 1, 1, 0],
  )
  const yBeat6 = useTransform(scrollYProgress, [t.beat6.inStart, t.beat6.inEnd, t.beat6.outEnd], [30, 0, -24])
  const path6Progress = useTransform(scrollYProgress, [t.beat6.pathL[0], t.beat6.pathBR[1]], [0, 1])
  const path6L = path6Progress
  const path6R = path6Progress
  const path6BL = path6Progress
  const path6BR = path6Progress
  const opac6A = useTransform(scrollYProgress, t.beat6.cardA, [0, 1])
  const opac6B = useTransform(scrollYProgress, t.beat6.cardB, [0, 1])
  const opac6C = useTransform(scrollYProgress, t.beat6.cardC, [0, 1])
  const opac6D = useTransform(scrollYProgress, t.beat6.cardD, [0, 1])
  const y6A    = useTransform(scrollYProgress, t.beat6.cardA, [16, 0])
  const y6B    = useTransform(scrollYProgress, t.beat6.cardB, [16, 0])
  const y6C    = useTransform(scrollYProgress, t.beat6.cardC, [16, 0])
  const y6D    = useTransform(scrollYProgress, t.beat6.cardD, [16, 0])
  const rev6A  = useTransform(scrollYProgress, t.beat6.revA, [0, 1, 0.35])
  const rev6B  = useTransform(scrollYProgress, t.beat6.revB, [0, 1, 0.25])
  const rev6C  = useTransform(scrollYProgress, t.beat6.revC, [0, 1, 0.2])
  const rev6YA = useTransform(scrollYProgress, t.beat6.revA, [8, 0, -4])
  const rev6YB = useTransform(scrollYProgress, t.beat6.revB, [8, 0, -4])
  const rev6YC = useTransform(scrollYProgress, t.beat6.revC, [8, 0, -4])
  const growthPanelOpacity6 = useTransform(scrollYProgress, t.beat6.growthPanel, [0, 1, 1, 0])
  const growthProgress6 = useTransform(scrollYProgress, t.beat6.growthBar, [0, 1])
  const growthDay6 = useTransform(scrollYProgress, t.beat6.growthCurve, [0, 24, 30, 75])
  const growthRatio6 = useTransform(scrollYProgress, t.beat6.growthCurve, [1, 1.024, 1.03, 1.075])

  // Drive counter DOM text directly — avoids re-renders on every frame.
  useMotionValueEvent(countMV, 'change', (v) => {
    if (numberRef.current) numberRef.current.textContent = Math.floor(v).toLocaleString()
  })
  useMotionValueEvent(growthDay6, 'change', (v) => {
    if (growthDayRef.current) growthDayRef.current.textContent = `Day ${Math.max(0, Math.floor(v))}`
  })
  useMotionValueEvent(growthRatio6, 'change', (v) => {
    if (growthRatioRef.current) growthRatioRef.current.textContent = v.toFixed(3).replace(/\.?0+$/, '')
  })

  useEffect(() => {
    const run = async () => {
      try {
        const coin    = await fetchZoraCoin(AKITA_ADDRESS)
        const coinAny = coin as any
        const img =
          coin?.mediaContent?.previewImage?.small ??
          coin?.mediaContent?.previewImage?.medium ??
          coin?.creatorProfile?.avatar?.previewImage?.small ??
          coinAny?.image ??
          coinAny?.metadata?.image
        if (img) { setAvatarSrc(img); return }
        const creatorAddr = coin?.creatorAddress
        if (creatorAddr) {
          const profile = await fetchZoraProfile(creatorAddr)
          const avatar  = profile?.avatar?.small ?? profile?.avatar?.medium
          if (avatar) setAvatarSrc(avatar)
        }
      } catch { /* fall back to dot */ }
    }
    run()
  }, [])

  const dist  = STORY_CONTENT.distribution
  const strats = STORY_CONTENT.strategies
  const cardOpacities  = [opac5A, opac5B, opac5C]
  const cardPaths      = [path5A, path5B, path5C]
  const stratOpacities = [opac6A, opac6B, opac6C, opac6D]
  const stratYs        = [y6A, y6B, y6C, y6D]

  // ── Layout note ────────────────────────────────────────────────────────────
  // Beats 4, 5 and 6 each use a single centered flex-column container so
  // sub-element spacing is controlled by gap/margin rather than independent
  // absolute positions.  The container top is chosen so the stack is visually
  // centred in the viewport (50vh).  Approximate stack heights:
  //   Beat 4: badge 20 + gap 8 + MintLines 80 + gap 12 + count ~80 ≈ 200px → top = 50vh − 100px
  //   Beat 5: source 76 + SVG 120 + gap 4 + cards ~130 ≈ 330px → top = 50vh − 165px
  //   Beat 6: source 40 + SVG 120 + gap 8 + 2×2 grid ~252 + APY 32 ≈ 452px → top = 50vh − 226px

  return (
    // 2800vh — extended scroll with deliberate inter-beat breathing room.
    <div
      ref={containerRef}
      className="bg-black text-white relative font-sans selection:bg-white/20"
      style={{ height: `${STORY_SCROLL_VH}vh`, borderTop: '1px solid rgba(255,255,255,0.035)' }}
    >
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">

        {/* Grain */}
        <div className="absolute inset-0 pointer-events-none z-10"
          style={{ backgroundImage: GRAIN_URL, backgroundSize: '256px 256px', opacity: 0.038 }} />

        {/* Scroll progress bar */}
        <motion.div
          className="absolute top-0 left-0 h-[1px] w-full origin-left z-20 pointer-events-none"
          style={{ scaleX: scrollYProgress, background: 'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.38))' }}
        />

        {/* ── Beat 1 ─────────────────────────────────────────────────────── */}
        <motion.div style={{ opacity: opacityBeat1, y: yBeat1 }}
          className="absolute inset-0 flex flex-col items-center justify-center px-6"
          data-testid="beat-1-threshold">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[1] }} />
          <p className="text-[10px] uppercase tracking-[0.44em] font-medium mb-8" style={{ color: `rgba(${BLUE},0.55)` }}>
            Introducing
          </p>
          <h2 className="mb-5 text-3xl font-medium leading-tight tracking-tight text-center md:text-5xl" style={{ color: 'rgba(255,255,255,0.90)' }}>
            Earn Together.
          </h2>
          <p className="text-base md:text-xl font-light text-center" style={{ color: 'rgba(255,255,255,0.36)' }}>
            ERC-4626 Tokenized Creator Vaults
          </p>
        </motion.div>

        {/* ── Beat 2 ─────────────────────────────────────────────────────── */}
        {/* Three phases: (1) deposit token, (2) receive token, (3) explanation. */}
        <motion.div style={{ opacity: opacityBeat2, y: yBeat2 }}
          className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-0"
          data-testid="beat-2-authority">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[2] }} />

          <div className="relative flex min-h-[340px] w-full max-w-2xl items-center justify-center">
            {/* Phase 1 — creator coin + "Deposit $akita." */}
            <motion.div
              style={{ opacity: b2P1, y: b2Y1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            >
              <div className="h-16 w-16 overflow-hidden rounded-full" style={{
                border: '1.5px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
              }}>
                {avatarSrc
                  ? <img src={avatarSrc} alt={STORY_CONTENT.creatorTokenSymbol} className="h-full w-full rounded-full object-cover" loading="lazy" />
                  : <div className="flex h-full w-full items-center justify-center"><div className="h-2.5 w-2.5 rounded-full bg-white/30" /></div>
                }
              </div>
              <h2 className="text-center text-2xl font-medium tracking-tight text-white md:text-3xl">
                Deposit {STORY_CONTENT.creatorTokenSymbol.toLowerCase()}.
              </h2>
            </motion.div>

            {/* Phase 2 — complete token flow + "Receive ■AKITA." */}
            <motion.div
              style={{ opacity: b2P2, y: b2Y2 }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              <DepositFlowViz avatarSrc={avatarSrc} />
              <h2 className="text-center text-2xl font-medium tracking-tight md:text-3xl" style={{ color: `rgba(${BLUE},0.90)` }}>
                Receive {STORY_CONTENT.shareTokenSymbol}.
              </h2>
              <motion.p
                style={{ opacity: b2P3, y: b2Y3, color: 'rgba(255,255,255,0.38)' }}
                className="mt-5 max-w-sm text-center text-sm font-light leading-relaxed md:text-base"
              >
                <span style={{ color: `rgba(${BLUE},0.70)` }}>{STORY_CONTENT.shareTokenSymbol}</span>{' '}
                is the vault&apos;s share token — your proportional stake in all yield generated.
              </motion.p>
            </motion.div>
          </div>
        </motion.div>

        {/* ── Beat 3 ─────────────────────────────────────────────────────── */}
        {/* Exit: inner content drops through overflow:hidden floor — hard clip, no fade. */}
        <motion.div style={{ opacity: opacityBeat3, scale: scaleBeat3 }}
          className="absolute inset-0 flex flex-col items-center justify-center px-6"
          data-testid="beat-3-commitment">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[3] }} />
          <div className="flex flex-col items-center justify-center overflow-hidden w-full" style={{ height: '58vh' }}>
            <div className="relative flex w-full items-center justify-center" style={{ minHeight: 420 }}>
              <motion.div
                style={{ opacity: slotOpacity3, scale: slitGlow3 }}
                className="absolute left-1/2 top-[294px] -translate-x-1/2"
              >
                <DepositSlot testId="deposit-slit" />
              </motion.div>

              <motion.div
                className="flex flex-col items-center"
                style={{ x: billX3, y: billY3, rotate: billRotate3, scale: billScale3, transformOrigin: '50% 50%' }}
                data-testid="deposit-bill"
              >
                <div
                  className="flex w-[86vw] max-w-[640px] flex-col items-center rounded-[2rem] px-8 py-8 md:w-auto md:min-w-[640px] md:px-12 md:py-10"
                  style={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 30px 80px rgba(0,0,0,0.30)',
                  }}
                >
                  <p className="mb-8 max-w-xs text-center text-xs font-light leading-relaxed" style={{ color: 'rgba(255,255,255,0.32)' }}>
                    To deploy a vault, a creator must first deposit:
                  </p>
                  <motion.div className="flex flex-col items-center" style={{ scale: scaleBeat3 }}>
                    <div
                      ref={numberRef}
                      className="text-6xl md:text-8xl lg:text-9xl font-semibold tracking-tighter tabular-nums text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50"
                      data-testid="deposited-counter"
                    >
                      {STORY_CONTENT.defaultDepositTokens}
                    </div>
                    <p className="mt-8 text-xl tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {STORY_CONTENT.creatorTokenSymbol.toLowerCase()} tokens
                    </p>
                    <p className="mt-3 text-xs font-mono" style={{ color: `rgba(${BLUE},0.50)` }}>
                      = 5% of total supply
                    </p>
                  </motion.div>
                </div>
              </motion.div>

              <motion.div
                className="pointer-events-none absolute inset-0"
                style={{ opacity: opacityBeat3 }}
              />
            </div>
          </div>
        </motion.div>

        {/* ── Beat 4 ─────────────────────────────────────────────────────── */}
        {/* The slot remains visible so the minted shares feel like they emerge from the deposit. */}
        <motion.div style={{ opacity: opacityBeat4, scale: scaleBeat4, y: yBeat4, paddingTop: 'calc(50vh - 122px)' }}
          className="absolute inset-0 flex flex-col items-center px-6"
          data-testid="beat-4-mint">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[4] }} />

          <div className="relative flex flex-col items-center">
            <DepositSlot />
            <div className="mt-5">
              <MintLines />
            </div>

            {/* Minted count */}
            <p className="mt-3 text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tighter tabular-nums text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
              {STORY_CONTENT.defaultDepositTokens}
            </p>

            {/* Badge identity — sits at the BOTTOM, away from Beat 5's incoming top-label */}
            <div className="mt-3 flex items-center gap-2">
              <img src={STORY_CONTENT.shareTokenBadgeSrc} alt="" aria-hidden="true" className="h-4 w-4 object-contain" loading="lazy" />
              <span className="font-mono text-sm" style={{ color: `rgba(${BLUE},0.90)` }}>
                {STORY_CONTENT.shareTokenSymbol}
              </span>
              <span className="ml-1 text-[10px] uppercase tracking-[0.3em]" style={{ color: `rgba(${BLUE},0.50)` }}>
                shares minted
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── Beat 5 ─────────────────────────────────────────────────────── */}
        {/* Single flex-column centred at 50vh − 165px (stack ≈ 330px tall). */}
        {/* Source → bezier paths → 3 distribution cards, one card at a time. */}
        <motion.div style={{ opacity: opacityBeat5, y: yBeat5, paddingTop: 'calc(50vh - 140px)' }}
          className="absolute inset-0 flex flex-col items-center px-6"
          data-testid="beat-5-structure">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[5] }} />

          {/* Accessibility landmarks */}
          <div aria-label="distribution summary" className="sr-only" />
          <div aria-label="distribution checkpoint progress" role="progressbar" className="sr-only" />

          <div className="relative flex flex-col items-center w-full max-w-3xl">
            {/* Source: text-only "50,000,000 ■AKITA" — no badge icon so there is nothing
                to clash with Beat 4's badge (which exits at the bottom of the screen).
                The ■ symbol carries the identity without needing the image duplicate. */}
            <div className="flex flex-col items-center mb-2">
              <p className="text-[10px] uppercase tracking-[0.38em] font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.22)' }}>
                Initial deposit only
              </p>
              <p className="font-mono text-sm font-medium">
                <span style={{ color: 'rgba(255,255,255,0.58)' }}>{STORY_CONTENT.defaultDepositTokens} </span>
                <span style={{ color: `rgba(${BLUE},0.90)` }}>{STORY_CONTENT.shareTokenSymbol}</span>
              </p>
              <p className="mt-1.5 text-[11px] text-center max-w-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>
                A portion distributed to the public via Uniswap CCA — over {STORY_CONTENT.defaultAuctionWindow}
              </p>
            </div>

            {/* Bezier paths — SVG source dot is the continuation of the badge above */}
            <DistributionPaths p1={cardPaths[0]} p2={cardPaths[1]} p3={cardPaths[2]} />

            {/* Distribution cards — fade in one at a time as paths reach them */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-1">
              {dist.map((row, i) => (
                <motion.div key={row.title} style={{ opacity: cardOpacities[i] }}>
                  <div className="p-6 rounded-3xl h-full" style={{
                    border: `1px solid rgba(${BLUE},0.22)`,
                    background: `rgba(${BLUE},0.04)`,
                    backdropFilter: 'blur(12px)',
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(${BLUE},0.10), 0 0 28px rgba(${BLUE},0.14)`,
                  }}>
                    <div className="text-4xl font-medium mb-3 tracking-tight">{row.percent}</div>
                    <div className="text-sm mb-6 font-mono">
                      <span style={{ color: 'rgba(255,255,255,0.36)' }}>{row.amount} </span>
                      <span style={{ color: `rgba(${BLUE},0.75)` }}>{STORY_CONTENT.shareTokenSymbol}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      {row.icon && (
                        <img src={row.icon} alt="" aria-hidden="true" className="h-4 w-4 object-contain opacity-60" loading="lazy" />
                      )}
                      <p className="font-medium text-lg" style={{ color: 'rgba(255,255,255,0.90)' }}>{row.title}</p>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>{row.purposeCopy}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Beat 6 ─────────────────────────────────────────────────────── */}
        {/* Single flex-column centred at 50vh − 226px (stack ≈ 452px tall). */}
        {/* Source → two bezier branches → 2×2 strategy grid → blended APY.  */}
        {/* Left branch: strats[0] Charm (top-left), strats[2] Solana (btm-left)  */}
        {/* Right branch: strats[1] Ajna (top-right), strats[3] Idle (btm-right) */}
        <motion.div style={{ opacity: opacityBeat6, y: yBeat6, paddingTop: 'calc(50vh - 226px)' }}
          className="absolute inset-0 flex flex-col items-center px-6"
          data-testid="beat-6-strategies">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[6] }} />

          <div className="relative flex flex-col items-center w-full max-w-2xl">
            {/* Source label — the deposited underlying token */}
            <div className="flex flex-col items-center mb-2">
              <p className="text-xs uppercase tracking-[0.32em] font-medium" style={{ color: 'rgba(255,255,255,0.26)' }}>
                Immediately put to work
              </p>
              <p className="mt-1 text-lg font-mono">
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>{STORY_CONTENT.defaultDepositTokens} </span>
                <span style={{ color: `rgba(${ORANGE},0.65)` }}>{STORY_CONTENT.creatorTokenSymbol.toLowerCase()}</span>
              </p>
              <p className="mt-1 text-[11px] text-center max-w-xs font-light" style={{ color: 'rgba(255,255,255,0.26)' }}>
                begins generating yield for the vault the moment it's deposited
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <motion.span
                  className="rounded-full px-2.5 py-1 font-mono text-[10px]"
                  style={{
                    opacity: rev6A,
                    y: rev6YA,
                    color: `rgba(${ORANGE},0.92)`,
                    border: `1px solid rgba(${ORANGE},0.30)`,
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  {STRATEGY_REVENUE_PULSES[0].value}
                </motion.span>
                <motion.span
                  className="rounded-full px-2.5 py-1 font-mono text-[10px]"
                  style={{
                    opacity: rev6B,
                    y: rev6YB,
                    color: `rgba(${ORANGE},0.92)`,
                    border: `1px solid rgba(${ORANGE},0.30)`,
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  {STRATEGY_REVENUE_PULSES[1].value}
                </motion.span>
                <motion.span
                  className="rounded-full px-2.5 py-1 font-mono text-[10px]"
                  style={{
                    opacity: rev6C,
                    y: rev6YC,
                    color: `rgba(${ORANGE},0.92)`,
                    border: `1px solid rgba(${ORANGE},0.30)`,
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  {STRATEGY_REVENUE_PULSES[2].value}
                </motion.span>
              </div>
            </div>

            {/* Two-branch bezier SVG — left col, right col */}
            <StrategyBranches pLeft={path6L} pRight={path6R} pBotLeft={path6BL} pBotRight={path6BR} />

            {/* 2×2 strategy grid */}
            <div className="grid grid-cols-2 gap-3 w-full mt-2">
              {strats.map((s, i) => (
                <motion.div key={s.label} style={{ opacity: stratOpacities[i], y: stratYs[i] }}>
                  <div className="flex items-center justify-between rounded-2xl px-4 py-4" style={{
                    border: `1px solid rgba(${ORANGE},0.08)`,
                    background: 'rgba(255,255,255,0.012)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(${ORANGE},0.05), 0 0 20px rgba(${ORANGE},0.07)`,
                  }}>
                    <div className="flex items-center gap-3 min-w-0">
                      {s.icon ? (
                        <img src={s.icon} alt={s.iconAlt} className={s.iconClassName} loading="lazy" />
                      ) : (
                        <div className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: 'rgba(255,255,255,0.08)' }} />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{s.label}</p>
                        <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.32)' }}>{s.purposeCopy}</p>
                      </div>
                    </div>
                    <div className="ml-4 flex shrink-0 flex-col items-end gap-0.5">
                      <span className="font-mono text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.72)' }}>{s.percent}</span>
                      {s.apy !== '—' ? (
                        <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.26)' }}>
                          {s.apy}{' '}
                          <span style={{ color: 'rgba(255,255,255,0.14)' }}>APR</span>
                        </span>
                      ) : (
                        <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>—</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Blended APR */}
            <p className="mt-4 font-mono text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Blended APR:{' '}
              <span style={{ color: 'rgba(255,255,255,0.48)' }}>{STORY_CONTENT.blendedApy}</span>
            </p>

            {/* Value accrual equation */}
            <motion.div
              style={{ opacity: growthPanelOpacity6 }}
              className="mt-4 w-full max-w-lg rounded-2xl px-4 py-3"
              data-testid="beat-6-growth-equation"
            >
              <div
                className="relative overflow-hidden rounded-xl px-4 py-3"
                style={{
                  border: `1px solid rgba(${ORANGE},0.18)`,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                }}
              >
                <motion.div
                  className="pointer-events-none absolute inset-y-0 left-0"
                  style={{
                    scaleX: growthProgress6,
                    background: `linear-gradient(90deg, rgba(${ORANGE},0.18), rgba(${ORANGE},0))`,
                    transformOrigin: 'left center',
                  }}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <span ref={growthDayRef} className="font-mono text-[10px] tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.40)' }}>
                    Day 0
                  </span>
                  <p className="font-mono text-sm md:text-base">
                    <span style={{ color: 'rgba(255,255,255,0.86)' }}>1 {STORY_CONTENT.shareTokenSymbol}</span>
                    <span style={{ color: 'rgba(255,255,255,0.46)' }}> = </span>
                    <span style={{ color: `rgba(${ORANGE},0.92)` }}>$</span>
                    <span ref={growthRatioRef} style={{ color: `rgba(${ORANGE},0.92)` }}>1.000</span>
                    <span style={{ color: `rgba(${ORANGE},0.92)` }}> {STORY_CONTENT.creatorTokenSymbol.toLowerCase()}</span>
                  </p>
                </div>
                <p className="relative mt-1 text-center font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
                  accrues as strategies generate yield
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>

      </div>
    </div>
  )
}
