import { memo, useEffect, useRef, useState } from 'react'
import { motion, type MotionValue, useMotionValueEvent, useScroll, useTransform } from 'framer-motion'

import { fetchZoraCoin, fetchZoraProfile } from '@/lib/zora/client'
import { STORY_CONTENT } from './vault-flow/model/storyContent'

const AKITA_ADDRESS = '0x5b674196812451b7cec024fe9d22d2c0b172fa75' as const
const TOTAL_TOKENS  = 50_000_000

type Props = {
  depositTokens: string
  shareTokens: string
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const GRAIN_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

const BLUE = '59,130,246'

const BEAT_ACCENTS: Record<number, string> = {
  1: `radial-gradient(ellipse 70% 50% at 50% 65%, rgba(${BLUE},0.04) 0%, transparent 70%)`,
  2: `radial-gradient(ellipse 70% 55% at 50% 55%, rgba(${BLUE},0.06) 0%, transparent 70%)`,
  3: `radial-gradient(ellipse 55% 45% at 50% 50%, rgba(${BLUE},0.05) 0%, transparent 70%)`,
  4: `radial-gradient(ellipse 60% 55% at 50% 50%, rgba(${BLUE},0.10) 0%, transparent 70%)`,
  5: `radial-gradient(ellipse 85% 55% at 50% 55%, rgba(${BLUE},0.06) 0%, transparent 70%)`,
  6: `radial-gradient(ellipse 85% 60% at 50% 60%, rgba(${BLUE},0.07) 0%, transparent 70%)`,
  7: `radial-gradient(ellipse 60% 60% at 50% 50%, rgba(${BLUE},0.09) 0%, transparent 70%)`,
  8: `radial-gradient(ellipse 70% 50% at 50% 55%, rgba(${BLUE},0.04) 0%, transparent 70%)`,
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const AvatarNode = memo(function AvatarNode({ src, name }: { src: string | null; name: string }) {
  return (
    <div
      className="w-20 h-20 rounded-full flex items-center justify-center mb-10 overflow-hidden"
      style={{
        border: '1px solid rgba(249,115,22,0.18)',
        background: 'rgba(249,115,22,0.05)',
        boxShadow: '0 0 40px rgba(249,115,22,0.08), 0 0 0 8px rgba(249,115,22,0.03)',
      }}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover rounded-full" loading="lazy" />
      ) : (
        <div className="w-2 h-2 bg-white rounded-full" style={{ boxShadow: '0 0 12px rgba(255,255,255,1)' }} />
      )}
    </div>
  )
})

function DripLine({ delay = 0 }: { delay?: number }) {
  return (
    <div className="w-[1px] h-32 mb-12 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
      <motion.div
        className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-transparent to-white/80"
        initial={{ y: '-100%' }}
        animate={{ y: '200%' }}
        transition={{ repeat: Infinity, duration: 2.5, ease: 'linear', delay }}
      />
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

// Beat 6 — two bezier branches from a central source to left and right columns.
// viewBox 600×120: source (300,6), left-col centre (150,114), right-col centre (450,114).
// x-positions are scaled for a max-w-2xl (672 px) 2-column grid.
type PathProps2 = { pLeft: MotionValue<number>; pRight: MotionValue<number> }

function StrategyBranches({ pLeft, pRight }: PathProps2) {
  const stroke = `rgba(${BLUE},0.45)`
  const dot    = `rgba(${BLUE},0.70)`
  return (
    <svg viewBox="0 0 600 120" className="w-full max-w-2xl mx-auto" style={{ height: 120, overflow: 'visible' }} aria-hidden="true">
      <circle cx="300" cy="6" r="3" fill={`rgba(${BLUE},0.80)`} />
      <motion.path d="M 300 6 C 300 65 150 65 150 114" stroke={stroke} strokeWidth="1" fill="none" strokeLinecap="round" style={{ pathLength: pLeft }} />
      <motion.path d="M 300 6 C 300 65 450 65 450 114" stroke={stroke} strokeWidth="1" fill="none" strokeLinecap="round" style={{ pathLength: pRight }} />
      <motion.circle cx="150" cy="114" r="2.5" fill={dot} style={{ opacity: pLeft }} />
      <motion.circle cx="450" cy="114" r="2.5" fill={dot} style={{ opacity: pRight }} />
    </svg>
  )
}

// Beat 7 — two counter-rotating conic arcs.
const RING_MASK       = 'radial-gradient(farthest-side, transparent calc(100% - 1.5px), white calc(100% - 1.5px))'
const RING_MASK_INNER = 'radial-gradient(farthest-side, transparent calc(100% - 1px), white calc(100% - 1px))'

function ConicRing() {
  return (
    <>
      <motion.div className="absolute inset-0 rounded-full" animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
        style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.55) 22%, transparent 44%)', WebkitMask: RING_MASK, mask: RING_MASK }} />
      <motion.div className="absolute inset-5 rounded-full" animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 3.5, ease: 'linear' }}
        style={{ background: 'conic-gradient(from 180deg, transparent 0%, rgba(255,255,255,0.32) 18%, transparent 36%)', WebkitMask: RING_MASK_INNER, mask: RING_MASK_INNER }} />
    </>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export function VaultFlowScroll(_props: Props) {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const numberRef    = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })

  // ── Timing system ──────────────────────────────────────────────────────────
  // 1600vh total.  1% = 16vh.
  //
  // Every crossfade uses the SAME ±30px y-motion so each scroll unit feels
  // identical regardless of where you are in the story:
  //   entry: y +30 → 0  (rises into position from below)
  //   exit:  y 0 → -30  (drifts upward and out)
  //
  // Crossfade windows are 4–5% (64–80vh) so dissolves read as intentional.
  //
  // Exception: Beat 3 exits via a hard clip-through-floor; Beat 4 enters
  // with a 150px pop-up — these are deliberate moment-of-transformation beats.
  //
  //  Beat  │ in       │ hold        │ out
  //  ─────────────────────────────────────────────────────────
  //  1     │ 0–2%     │ 2–8%        │ 8–12%
  //  2     │ 8–12%    │ 12–18%      │ 18–22%
  //  3     │ 18–22%   │ 22–28%      │ clip 27–30%, opac 30–32%
  //  4     │ 30–34%   │ 34–42%      │ 42–46%
  //  5     │ 42–47%   │ (paths+hold)│ 65–69%
  //  6     │ 65–70%   │ (stagger+hold)│ 90–93%
  //  7     │ 90–93%   │ 93–97%      │ 97–99%
  //  8     │ 97–99%   │ 99–100%     │ —

  // Beat 1: The Threshold
  const opacityBeat1 = useTransform(scrollYProgress, [0, 0.02, 0.08, 0.12], [1, 1, 1, 0])
  const yBeat1       = useTransform(scrollYProgress, [0, 0.12], [0, -30])

  // Beat 2: Creator Authority
  const opacityBeat2 = useTransform(scrollYProgress, [0.08, 0.12, 0.18, 0.22], [0, 1, 1, 0])
  const yBeat2       = useTransform(scrollYProgress, [0.08, 0.12, 0.22], [30, 0, -30])

  // Beat 3: The Commitment — scale-in, then hard clip exit through "vault floor"
  const opacityBeat3 = useTransform(scrollYProgress, [0.18, 0.22, 0.30, 0.32], [0, 1, 1, 0])
  const scaleBeat3   = useTransform(scrollYProgress, [0.18, 0.22], [0.92, 1])
  const yBeat3       = useTransform(scrollYProgress, [0.27, 0.30], [0, 320])
  const countMV      = useTransform(scrollYProgress, [0.18, 0.27], [0, TOTAL_TOKENS])

  // Beat 4: The Mint — dramatic pop up from 150px (intentional contrast with Beat 3)
  const opacityBeat4 = useTransform(scrollYProgress, [0.30, 0.34, 0.42, 0.46], [0, 1, 1, 0])
  const scaleBeat4   = useTransform(scrollYProgress, [0.30, 0.34], [0.72, 1])
  const yBeat4       = useTransform(scrollYProgress, [0.30, 0.34, 0.46], [150, 0, -30])

  // Beat 5: Distribution — in 42–47%, paths 47–65%, cards 54–68%, hold 68–71%, out 71–75%
  // 5% stagger between each path+card so the "one at a time" distribution reads clearly.
  // 4% crossfade window with Beat 4 (exits upward) — no visual collision.
  const opacityBeat5 = useTransform(scrollYProgress, [0.42, 0.47, 0.71, 0.75], [0, 1, 1, 0])
  const yBeat5       = useTransform(scrollYProgress, [0.42, 0.47, 0.71, 0.75], [30, 0, 0, -30])
  const path5A       = useTransform(scrollYProgress, [0.47, 0.55], [0, 1])
  const path5B       = useTransform(scrollYProgress, [0.52, 0.60], [0, 1])
  const path5C       = useTransform(scrollYProgress, [0.57, 0.65], [0, 1])
  const opac5A       = useTransform(scrollYProgress, [0.54, 0.58], [0, 1])
  const opac5B       = useTransform(scrollYProgress, [0.59, 0.63], [0, 1])
  const opac5C       = useTransform(scrollYProgress, [0.64, 0.68], [0, 1])

  // Beat 6: Yield Strategies — in 71–76%, branches 76–87%, cards 83–91%, hold 91–93%, out 93–96%
  const opacityBeat6 = useTransform(scrollYProgress, [0.71, 0.76, 0.93, 0.96], [0, 1, 1, 0])
  const yBeat6       = useTransform(scrollYProgress, [0.71, 0.76, 0.93, 0.96], [30, 0, 0, -30])
  const path6L       = useTransform(scrollYProgress, [0.76, 0.84], [0, 1])
  const path6R       = useTransform(scrollYProgress, [0.79, 0.87], [0, 1])
  const opac6A       = useTransform(scrollYProgress, [0.83, 0.87], [0, 1])
  const opac6B       = useTransform(scrollYProgress, [0.85, 0.88], [0, 1])
  const opac6C       = useTransform(scrollYProgress, [0.87, 0.90], [0, 1])
  const opac6D       = useTransform(scrollYProgress, [0.88, 0.91], [0, 1])
  const y6A          = useTransform(scrollYProgress, [0.83, 0.87], [12, 0])
  const y6B          = useTransform(scrollYProgress, [0.85, 0.88], [12, 0])
  const y6C          = useTransform(scrollYProgress, [0.87, 0.90], [12, 0])
  const y6D          = useTransform(scrollYProgress, [0.88, 0.91], [12, 0])

  // Beat 7: Activation — scale-in (not y) to feel like a reveal, not just another slide
  const opacityBeat7 = useTransform(scrollYProgress, [0.93, 0.96, 0.98, 1.0], [0, 1, 1, 0])
  const scaleBeat7   = useTransform(scrollYProgress, [0.96, 0.98], [0.88, 1])
  const glowBeat7    = useTransform(
    scrollYProgress,
    [0.96, 0.98],
    [`0px 0px 0px rgba(${BLUE},0)`, `0px 0px 70px rgba(${BLUE},0.22)`],
  )

  // Beat 8: Entry Point — fades in from below, holds to end
  const opacityBeat8 = useTransform(scrollYProgress, [0.97, 0.99, 1.0], [0, 1, 1])
  const yBeat8       = useTransform(scrollYProgress, [0.97, 0.99], [30, 0])

  // Drive counter DOM text directly — avoids re-renders on every frame.
  useMotionValueEvent(countMV, 'change', (v) => {
    if (numberRef.current) numberRef.current.textContent = Math.floor(v).toLocaleString()
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
    // 1600vh — 8 beats with hold + rest windows (≥48vh dwell at full reveal each)
    <div
      ref={containerRef}
      className="h-[1600vh] bg-black text-white relative font-sans selection:bg-white/20"
      style={{ borderTop: '1px solid rgba(255,255,255,0.035)' }}
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
          <DripLine />
          <h1 className="text-3xl md:text-5xl font-medium tracking-tight text-center leading-tight" style={{ color: 'rgba(255,255,255,0.90)' }}>
            What does it mean<br />to deploy a vault?
          </h1>
        </motion.div>

        {/* ── Beat 2 ─────────────────────────────────────────────────────── */}
        <motion.div style={{ opacity: opacityBeat2, y: yBeat2 }}
          className="absolute inset-0 flex flex-col items-center justify-center px-6"
          data-testid="beat-2-authority">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[2] }} />
          <AvatarNode src={avatarSrc} name={STORY_CONTENT.creatorName} />
          <h2 className="text-2xl md:text-4xl font-medium tracking-tight mb-6 text-center text-white">
            Only you can do this.
          </h2>
          <p className="text-base md:text-xl leading-relaxed font-light text-center max-w-md" style={{ color: 'rgba(255,255,255,0.45)' }}>
            No one else can deploy a vault for {STORY_CONTENT.creatorTokenSymbol}.<br />
            The authority is absolute.
          </p>
        </motion.div>

        {/* ── Beat 3 ─────────────────────────────────────────────────────── */}
        {/* Exit: inner content drops through overflow:hidden floor — hard clip, no fade. */}
        <motion.div style={{ opacity: opacityBeat3, scale: scaleBeat3 }}
          className="absolute inset-0 flex flex-col items-center justify-center px-6"
          data-testid="beat-3-commitment">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[3] }} />
          <div className="flex flex-col items-center justify-center overflow-hidden w-full" style={{ height: '55vh' }}>
            <motion.div className="flex flex-col items-center" style={{ y: yBeat3 }}>
              <p className="text-xs uppercase tracking-[0.32em] mb-8 font-medium" style={{ color: 'rgba(255,255,255,0.32)' }}>
                The Commitment
              </p>
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
            </motion.div>
          </div>
        </motion.div>

        {/* ── Beat 4 ─────────────────────────────────────────────────────── */}
        {/* Stack order: MintLines (top) → large count (centre) → badge identity (bottom).  */}
        {/* This puts the ■AKITA badge at the BOTTOM so it does not collide with Beat 5's  */}
        {/* source label (which appears at the TOP during the crossfade).                   */}
        {/* Stack ≈ 208px → paddingTop = calc(50vh − 104px)                               */}
        <motion.div style={{ opacity: opacityBeat4, scale: scaleBeat4, y: yBeat4, paddingTop: 'calc(50vh - 104px)' }}
          className="absolute inset-0 flex flex-col items-center px-6"
          data-testid="beat-4-mint">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[4] }} />

          <div className="relative flex flex-col items-center">
            {/* Mint channel — establishes the "minting" action before the count appears */}
            <MintLines />

            {/* Minted count */}
            <p className="mt-3 text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tighter tabular-nums text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
              {STORY_CONTENT.defaultDepositTokens}
            </p>

            {/* Badge identity — sits at the BOTTOM, away from Beat 5's incoming top-label */}
            <div className="flex items-center gap-2 mt-4">
              <img src={STORY_CONTENT.shareTokenBadgeSrc} alt="" aria-hidden="true" className="h-4 w-4 object-contain" loading="lazy" />
              <span className="font-mono text-sm" style={{ color: `rgba(${BLUE},0.90)` }}>
                {STORY_CONTENT.shareTokenSymbol}
              </span>
              <span className="text-[10px] uppercase tracking-[0.3em] ml-1" style={{ color: `rgba(${BLUE},0.50)` }}>
                vault token issued
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
                The distribution
              </p>
              <p className="font-mono text-sm font-medium">
                <span style={{ color: 'rgba(255,255,255,0.58)' }}>{STORY_CONTENT.defaultDepositTokens} </span>
                <span style={{ color: `rgba(${BLUE},0.90)` }}>{STORY_CONTENT.shareTokenSymbol}</span>
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
                Where the yield comes from
              </p>
              <p className="mt-1 text-lg font-mono" style={{ color: 'rgba(255,255,255,0.50)' }}>
                {STORY_CONTENT.defaultDepositTokens} {STORY_CONTENT.creatorTokenSymbol.toLowerCase()} deposited
              </p>
            </div>

            {/* Two-branch bezier SVG — left col, right col */}
            <StrategyBranches pLeft={path6L} pRight={path6R} />

            {/* 2×2 strategy grid */}
            <div className="grid grid-cols-2 gap-3 w-full mt-2">
              {strats.map((s, i) => (
                <motion.div key={s.label} style={{ opacity: stratOpacities[i], y: stratYs[i] }}>
                  <div className="flex items-center justify-between rounded-2xl px-4 py-4" style={{
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.012)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
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
                      <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.26)' }}>{s.apy}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Blended APY */}
            <p className="mt-4 font-mono text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Blended yield:{' '}
              <span style={{ color: 'rgba(255,255,255,0.48)' }}>{STORY_CONTENT.blendedApy}</span>
            </p>
          </div>
        </motion.div>

        {/* ── Beat 7 ─────────────────────────────────────────────────────── */}
        <motion.div style={{ opacity: opacityBeat7 }}
          className="absolute inset-0 flex flex-col items-center justify-center px-6"
          data-testid="beat-7-activation">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[7] }} />
          <motion.div
            style={{ scale: scaleBeat7, boxShadow: glowBeat7, background: 'rgba(255,255,255,0.015)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}
            className="relative flex w-44 h-44 md:w-56 md:h-56 items-center justify-center rounded-full"
          >
            <ConicRing />
            <img src="/brand/4626v2.svg" alt="4626 vault" className="relative z-10 w-10 h-10 object-contain" style={{ opacity: 0.80 }} loading="lazy" />
          </motion.div>
          <div className="mt-16 text-center">
            <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/55">
              The vault is live.
            </h2>
            <p className="mt-6 text-xl md:text-2xl font-light tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Value flows. The system runs.
            </p>
          </div>
        </motion.div>

        {/* ── Beat 8 ─────────────────────────────────────────────────────── */}
        <motion.div style={{ opacity: opacityBeat8, y: yBeat8 }}
          className="absolute inset-0 flex flex-col items-center justify-center px-6"
          data-testid="beat-8-entry">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[8] }} />
          <DripLine delay={1} />
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-12 text-center" style={{ color: 'rgba(255,255,255,0.90)' }}>
            The vault is open.
          </h2>
          <p className="text-lg font-light text-center max-w-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
            {STORY_CONTENT.copy?.earningTogether?.summary ?? 'Creator earns. Participants earn. Value keeps flowing.'}
          </p>
        </motion.div>

      </div>
    </div>
  )
}
