import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
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


export function VaultFlowScroll({ depositTokens, shareTokens }: Props) {
  const uid = useId().replace(/:/g, '')
  const outerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: outerRef,
    offset: ['start start', 'end end'],
  })

  const scroll = useSpring(scrollYProgress, {
    stiffness: 58,
    damping: 24,
    mass: 1.4,
  })

  const [activeStageIdx, setActiveStageIdx] = useState(0)
  const [cameoIdx, setCameoIdx] = useState(0)
  const [cameoIcons, setCameoIcons] = useState<Record<string, string>>({})

  const smoothstep = (t: number) => t * t * (3 - 2 * t)

  useMotionValueEvent(scroll, 'change', (v) => {
    if (v < 0.42) setActiveStageIdx(0)
    else if (v < 0.62) setActiveStageIdx(1)
    else if (v < 0.84) setActiveStageIdx(2)
    else setActiveStageIdx(3)
  })

  // Cycle through creator cameos on the descending deposit pill
  useEffect(() => {
    const id = setInterval(() => {
      setCameoIdx((prev) => (prev + 1) % CREATOR_CAMEOS.length)
    }, 1600)
    return () => clearInterval(id)
  }, [])

  // Prefetch real token/profile images for creator cameos
  useEffect(() => {
    const run = async () => {
      const updates: Record<string, string> = {}
      await Promise.allSettled(
        CREATOR_CAMEOS.map(async (c) => {
          if (c.staticIcon) { updates[c.key] = c.staticIcon; return }
          try {
            if (c.zoraAddress) {
              const coin = await fetchZoraCoin(c.zoraAddress as `0x${string}`)
              const img = coin?.mediaContent?.previewImage?.small ?? coin?.creatorProfile?.avatar?.previewImage?.small
              if (img) { updates[c.key] = img; return }
            }
            if (c.zoraHandle) {
              const profile = await fetchZoraProfile(c.zoraHandle)
              const coinAddr = profile?.creatorCoin?.address
              if (coinAddr) {
                const coin = await fetchZoraCoin(coinAddr as `0x${string}`)
                const img = coin?.mediaContent?.previewImage?.small
                if (img) { updates[c.key] = img; return }
              }
              const avatar = profile?.avatar?.small
              if (avatar) { updates[c.key] = avatar }
            }
          } catch {
            // fall back to initials circle
          }
        }),
      )
      setCameoIcons((prev) => ({ ...prev, ...updates }))
    }
    run()
  }, [])

  const currentStage = STAGE_NAV[activeStageIdx]

  // HUD / camera
  const progressH = useTransform(scroll, [0, 1], ['0%', '100%'])
  const cueOpacity = useTransform(scroll, [0, 0.10, 0.24], [0.88, 0.88, 0])

  // Camera — continuous slow drift, no kinks
  const worldY = useTransform(scroll, [0, 1], [0, -6])
  // Stays flat (1.0) through freefall + ALL distribution stages, then a slow cinematic
  // zoom into the deploy phase — starts at 0.86 and reaches full depth at 1.0,
  // giving ~210 vh of zoom travel at 1500 vh total (≈ 3–4 s of comfortable scroll).
  // Capped at 1.75 so the deployment cards stay at a readable distance.
  const worldScale = useTransform(scroll, [0, 0.86, 0.93, 1.0], [1, 1.0, 1.3, 1.75])
  // Tilt eases once freefall settles, holds flat for vault fly-through
  const worldRotateX = useTransform(scroll, [0, 0.44, 0.62, 1], [8, 2, 0, 0])
  const worldTransform = useMotionTemplate`
    translate3d(0, ${worldY}%, 0)
    scale(${worldScale})
    rotateX(${worldRotateX}deg)
  `

  const atmosphereOpacity = useTransform(scroll, [0, 1], [0.22, 0.42])

  // Hero plane — stays large and legible through the freefall, gentle exit
  // Hard freeze plateau: everything is IDENTICAL at 0.36 and 0.46 so the hero
  // (title + pills) looks completely frozen while the user scrolls ~110 vh
  // (≈ 1-2 s of normal scrolling at 1100 vh total height).
  const heroZ = useTransform(scroll, [0, 0.28, 0.46, 0.58], [170, 40, 40, -60])
  const heroY = useTransform(scroll, [0, 0.58], [0, -12])
  const heroScale = useTransform(scroll, [0, 0.28, 0.46, 0.58], [1, 0.94, 0.94, 0.88])
  const heroOpacity = useTransform(scroll, [0, 0.46, 0.60], [1, 1, 0])
  const heroBlur = useTransform(scroll, [0.48, 0.58], [0, 7])
  const heroFilter = useMotionTemplate`blur(${heroBlur}px)`
  const heroTransform = useMotionTemplate`
    translate3d(-50%, ${heroY}px, ${heroZ}px)
    scale(${heroScale})
  `

  // Pill -> vault connector — starts only after the freeze pause ends (0.46)
  const _topRaw = useTransform(scroll, [0.46, 0.56], [0, 1])
  const topTrail = useTransform(_topRaw, smoothstep)
  const topDotY = useTransform(topTrail, (t) => 108 * t)
  const topDotOp = useTransform(scroll, [0.46, 0.48, 0.55, 0.57], [0, 1, 1, 0])

  // Deposit node — rides the connector wire with the white dot
  const depositNodeZ = useTransform(scroll, [0.46, 0.54, 0.66], [-220, 20, -90])
  const depositNodeScale = useTransform(scroll, [0.46, 0.54, 0.62], [1.08, 1, 0.94])
  const depositNodeOpacity = useTransform(scroll, [0.46, 0.50, 0.58, 0.62], [0, 1, 1, 0])
  const depositNodeTransform = useMotionTemplate`
    translate3d(-50%, ${topDotY}px, ${depositNodeZ}px)
    scale(${depositNodeScale})
  `

  // Vault — rockets toward camera while off-screen, slows to a crawl once visible,
  // then settles into the vault anchor with a tiny overshoot before the deposit sequence
  // Vault stays at Z=0 after capture — world zooms in around it for "entering" feel
  const vaultZ = useTransform(scroll, [0, 0.08, 0.28, 0.36, 0.80, 0.88], [260, 180, 18, 0, 0, -120])
  // Scale locks at 1 once captured — no shrinking until it fades out
  const vaultScale = useTransform(scroll, [0, 0.08, 0.28, 0.36, 0.88], [1.55, 1.38, 1.06, 1, 1])
  // Stays visible as a container through distributions, fades as world zooms through
  const vaultOpacity = useTransform(scroll, [0, 0.06, 0.50, 0.58, 0.80, 0.88], [0, 0.65, 1, 0.45, 0.45, 0])
  // Glow/flash: mint phase only — starts after deposit dot arrives (~0.47)
  const vaultGlow = useTransform(scroll, [0.44, 0.52, 0.56, 0.60], [0, 1, 0.3, 0])
  const vaultFlash = useTransform(scroll, [0.40, 0.48, 0.54, 0.58], [0, 1, 0.2, 0])
  // Persistent vault square — fades in at capture, holds through ALL distribution
  // stages, only dissolves as the world zooms into the deploy phase
  const vaultSquare = useTransform(scroll, [0.36, 0.42, 0.88, 0.95], [0, 0.45, 0.45, 0])
  // Deposit arrival glow — large white ring pulse when dot lands on vault (~0.47)
  const depositArrivalGlow = useTransform(scroll, [0.45, 0.49, 0.53, 0.58], [0, 1, 0.45, 0])
  // Entry radial bloom: peaks as vault rushes, bridges into deploy
  const vaultEntry = useTransform(scroll, [0.82, 0.87, 0.94], [0, 1, 0])

  // ── Distribution fan chart — one curved path + card revealed at a time ─
  // Section envelope fades in at 0.52, holds, fades as vault rushes at 0.88
  // Dist section fades in AFTER the deposit connector finishes (~0.60) giving
  // the cameo cycle a clear pause before distributions start
  const distSectionOp = useTransform(scroll, [0.58, 0.64, 0.84, 0.90], [0, 1, 1, 0])

  // Path + card 0 (CCA Launch — left): 0.62 start — extra gap after cameos
  const _n0Raw = useTransform(scroll, [0.62, 0.68], [0, 1])
  const node0Op = useTransform(_n0Raw, smoothstep)
  const dist0CardY = useTransform(scroll, [0.62, 0.68], [20, 0])
  const _ot0Raw = useTransform(scroll, [0.62, 0.67], [0, 1])
  const orbitTrav0 = useTransform(_ot0Raw, smoothstep)
  // Border glow: dot arrives → soft persistent glow stays until section fades
  const nodeGlow0 = useTransform(scroll, [0.66, 0.70, 0.84, 0.90], [0, 1, 1, 0])

  // Path + card 1 (Creator Vesting — center): 0.72 start
  const _n1Raw = useTransform(scroll, [0.72, 0.77], [0, 1])
  const node1Op = useTransform(_n1Raw, smoothstep)
  const dist1CardY = useTransform(scroll, [0.72, 0.77], [20, 0])
  const _ot1Raw = useTransform(scroll, [0.72, 0.77], [0, 1])
  const orbitTrav1 = useTransform(_ot1Raw, smoothstep)
  const nodeGlow1 = useTransform(scroll, [0.76, 0.80, 0.84, 0.90], [0, 1, 1, 0])

  // Path + card 2 (LP Reserve — right): 0.80 start
  const _n2Raw = useTransform(scroll, [0.80, 0.84], [0, 1])
  const node2Op = useTransform(_n2Raw, smoothstep)
  const dist2CardY = useTransform(scroll, [0.80, 0.84], [20, 0])
  const _ot2Raw = useTransform(scroll, [0.80, 0.84], [0, 1])
  const orbitTrav2 = useTransform(_ot2Raw, smoothstep)
  const nodeGlow2 = useTransform(scroll, [0.83, 0.86, 0.90, 0.94], [0, 1, 1, 0])

  // "× ERC-4626" reveals as the vault captures the Zorb (~0.34) so the full
  // title is on screen BEFORE the freeze pause. zoraShiftX keeps "Zora" centred.
  const ercRevealOp = useTransform(scroll, [0.32, 0.42], [0, 1])
  const ercRevealX = useTransform(scroll, [0.32, 0.42], [-14, 0])
  const zoraShiftX = useTransform(scroll, [0.32, 0.42], ['6.5vw', '0vw'])
  // 4626 pill appears during the pause so users see the full identity at rest
  const vaultOsPillOp = useTransform(scroll, [0.38, 0.46], [0, 1])

  // Freefall entrance — two-speed design:
  //   0→0.08  : fast off-screen rush (user doesn't see this)
  //   0.08→0.28: slow visible hang — the Zorb drifts down for ~1-2 seconds of scrolling
  //   0.28→0.32: tiny overshoot past the anchor (bounce feel)
  //   0.32→0.36: settles back to 0 (vault capture)
  const zorbFallY = useTransform(scroll, [0, 0.08, 0.28, 0.32, 0.36], [-240, -70, -5, 4, 0])
  const zorbFallRotZ = useTransform(scroll, [0, 0.08, 0.28, 0.36], [-24, -19, -3, 0])

  const vaultTransform = useMotionTemplate`
    translate3d(-50%, ${zorbFallY}vh, ${vaultZ}px)
    scale(${vaultScale})
    rotateZ(${zorbFallRotZ}deg)
  `

  // Share node — appears ABOVE vault after minting, stays through all distributions
  const shareZ = useTransform(scroll, [0.48, 0.60], [-180, 0])
  const shareScale = useTransform(scroll, [0.52, 0.58], [0.94, 1])
  const shareOpacity = useTransform(scroll, [0.52, 0.58, 0.80, 0.88], [0, 1, 1, 0])
  const shareTransform = useMotionTemplate`
    translate3d(-50%, 0px, ${shareZ}px)
    scale(${shareScale})
  `

  // Cube interior POV — fades in as vault rushes through camera into deploy phase
  // Cube POV fades in once zoom has built enough momentum (~0.91)
  const cubeOp = useTransform(scroll, [0.90, 0.96, 1.0], [0, 0.85, 0.75])

  // Dot positions along each distribution bezier path (cubic Bezier formula)
  // Path 0: M 400 10 C 400 60 130 60 130 100
  const dist0DotX = useTransform(orbitTrav0, (t) =>
    (1 - t) ** 3 * 400 + 3 * (1 - t) ** 2 * t * 400 + 3 * (1 - t) * t ** 2 * 130 + t ** 3 * 130,
  )
  const dist0DotY = useTransform(orbitTrav0, (t) =>
    (1 - t) ** 3 * 10 + 3 * (1 - t) ** 2 * t * 60 + 3 * (1 - t) * t ** 2 * 60 + t ** 3 * 100,
  )
  const distDotOp0 = useTransform(scroll, [0.62, 0.64, 0.67, 0.69], [0, 1, 1, 0])

  // Path 1: M 400 10 C 400 60 400 60 400 100 (x stays at 400)
  const dist1DotY = useTransform(orbitTrav1, (t) =>
    (1 - t) ** 3 * 10 + 3 * (1 - t) ** 2 * t * 60 + 3 * (1 - t) * t ** 2 * 60 + t ** 3 * 100,
  )
  const distDotOp1 = useTransform(scroll, [0.72, 0.74, 0.77, 0.79], [0, 1, 1, 0])

  // Path 2: M 400 10 C 400 60 670 60 670 100
  const dist2DotX = useTransform(orbitTrav2, (t) =>
    (1 - t) ** 3 * 400 + 3 * (1 - t) ** 2 * t * 400 + 3 * (1 - t) * t ** 2 * 670 + t ** 3 * 670,
  )
  const dist2DotY = useTransform(orbitTrav2, (t) =>
    (1 - t) ** 3 * 10 + 3 * (1 - t) ** 2 * t * 60 + 3 * (1 - t) * t ** 2 * 60 + t ** 3 * 100,
  )
  const distDotOp2 = useTransform(scroll, [0.80, 0.81, 0.84, 0.86], [0, 1, 1, 0])



  // Deploy chamber — begins as bloom fades out (0.88); all 4 cards in by 1.0
  // Deploy content arrives while the zoom is in full swing (0.93+)
  const deployZ = useTransform(scroll, [0.93, 0.99, 1], [-180, 0, 0])
  const deployOpacity = useTransform(scroll, [0.93, 0.98], [0, 1])
  const deployBlur = useTransform(scroll, [0.92, 0.97, 1], [10, 0, 0])
  const deployTransform = useMotionTemplate`translate3d(0px, 0px, ${deployZ}px)`
  const deployFilter = useMotionTemplate`blur(${deployBlur}px)`
  const deployTitleOp = useTransform(scroll, [0.93, 0.97], [0, 1])
  const deployTitleY = useTransform(scroll, [0.93, 0.97], [18, 0])

  const s4PillOp = useTransform(scroll, [0.94, 0.98], [0, 1])
  const s4PillY = useTransform(scroll, [0.94, 0.98], [12, 0])

  // Stage 4 sequential fan — 4 cards packed into 0.92–1.0
  const _s4p0r = useTransform(scroll, [0.91, 0.94], [0, 1])
  const s4p0 = useTransform(_s4p0r, smoothstep)
  const s4pOp0 = useTransform(scroll, [0.91, 0.94], [0, 1])
  const s4d0 = useTransform(scroll, [0.93, 0.95], [0, 1])
  const s4c0o = useTransform(scroll, [0.93, 0.96], [0, 1])
  const s4c0y = useTransform(scroll, [0.93, 0.96], [24, 0])

  const _s4p1r = useTransform(scroll, [0.93, 0.96], [0, 1])
  const s4p1 = useTransform(_s4p1r, smoothstep)
  const s4pOp1 = useTransform(scroll, [0.93, 0.96], [0, 1])
  const s4d1 = useTransform(scroll, [0.95, 0.97], [0, 1])
  const s4c1o = useTransform(scroll, [0.95, 0.98], [0, 1])
  const s4c1y = useTransform(scroll, [0.95, 0.98], [24, 0])

  const _s4p2r = useTransform(scroll, [0.95, 0.97], [0, 1])
  const s4p2 = useTransform(_s4p2r, smoothstep)
  const s4pOp2 = useTransform(scroll, [0.95, 0.97], [0, 1])
  const s4d2 = useTransform(scroll, [0.96, 0.98], [0, 1])
  const s4c2o = useTransform(scroll, [0.96, 0.99], [0, 1])
  const s4c2y = useTransform(scroll, [0.96, 0.99], [24, 0])

  const _s4p3r = useTransform(scroll, [0.96, 0.98], [0, 1])
  const s4p3 = useTransform(_s4p3r, smoothstep)
  const s4pOp3 = useTransform(scroll, [0.96, 0.98], [0, 1])
  const s4d3 = useTransform(scroll, [0.97, 0.99], [0, 1])
  const s4c3o = useTransform(scroll, [0.97, 1.0], [0, 1])
  const s4c3y = useTransform(scroll, [0.97, 1.0], [24, 0])

  const s4CardMotions = [
    { opacity: s4c0o, y: s4c0y },
    { opacity: s4c1o, y: s4c1y },
    { opacity: s4c2o, y: s4c2y },
    { opacity: s4c3o, y: s4c3y },
  ] as const

  return (
    <>
      {/* DESKTOP — 1 continuous world */}
      <div
        ref={outerRef}
        className="relative hidden sm:block"
        style={{ height: '1500vh' }}
      >
        <div
          className="sticky top-0 h-screen overflow-hidden bg-black"
          style={{ perspective: '1100px' }}
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

          {/* Left rail */}
          <div
            className="absolute bottom-16 left-6 top-16 w-px"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <motion.div
              className="absolute inset-x-0 top-0 origin-top"
              style={{
                height: progressH,
                background:
                  'linear-gradient(to bottom, rgba(255,255,255,0.35), rgba(0,82,255,0.6))',
                borderRadius: 1,
              }}
            />
          </div>

          {/* Stage nav */}
          <div className="absolute left-9 top-1/2 flex -translate-y-1/2 flex-col gap-5">
            {STAGE_NAV.map((s, i) => (
              <motion.div
                key={s.n}
                className="flex items-center gap-3"
                animate={{ opacity: activeStageIdx === i ? 1 : 0.16 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                <motion.div
                  className="h-px rounded-full bg-white"
                  animate={{
                    width: activeStageIdx === i ? 18 : 6,
                    opacity: activeStageIdx === i ? 0.7 : 0.3,
                  }}
                  transition={{ duration: 0.4 }}
                />
                <span className="text-[8px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                  {s.label}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Current stage chip */}
          <div className="pointer-events-none absolute inset-x-0 top-10 z-30 flex justify-center">
            <StepChip n={currentStage.n} label={currentStage.label} active />
          </div>

          {/* Scroll cue */}
          <motion.div
            className="pointer-events-none absolute inset-x-0 bottom-10 z-30 flex flex-col items-center gap-2"
            style={{ opacity: cueOpacity }}
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-600">
              Scroll to descend
            </span>
            <motion.div
              className="h-7 w-px bg-gradient-to-b from-white/0 via-white/30 to-brand-primary/65"
              animate={{ scaleY: [0.75, 1, 0.75], opacity: [0.35, 0.85, 0.35] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>

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
              className="absolute left-1/2 top-[20vh] w-full max-w-4xl px-8 text-center"
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

              <div
                className="font-mono font-black leading-none text-center overflow-hidden"
                style={{ fontSize: 'clamp(1.8rem, 5.2vw, 5.2rem)', whiteSpace: 'nowrap' }}
              >
                {/* "Zora" starts centred; shifts left as ERC-4626 expands in */}
                <motion.span
                  style={{
                    display: 'inline-block',
                    x: zoraShiftX,
                    background: 'linear-gradient(170deg, #ffffff 28%, #9da3b3 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Zora
                </motion.span>
                {/* "× ERC-4626" slides and fades in from the right */}
                <motion.span
                  style={{
                    display: 'inline-block',
                    opacity: ercRevealOp,
                    x: ercRevealX,
                    background: 'linear-gradient(170deg, #ffffff 28%, #9da3b3 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  <span style={{ WebkitTextFillColor: 'rgba(160,180,255,0.82)' }}>&thinsp;×&thinsp;</span>ERC-4626
                </motion.span>
              </div>

              <div className="mt-5 flex items-center justify-center gap-2">
                {/* Zora pill — visible from the start */}
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5">
                  <img
                    src="/protocols/zora.svg"
                    alt="Zora"
                    className="h-4 w-4 rounded-full"
                    loading="lazy"
                  />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Zora Creator Coin
                  </span>
                </div>
                {/* 4626 pill — appears once vault captures Zorb */}
                <motion.div
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5"
                  style={{ opacity: vaultOsPillOp }}
                >
                  <img
                    src="/app-icon.svg"
                    alt="4626"
                    className="h-4 w-4 rounded-[4px]"
                    loading="lazy"
                  />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    4626 Vault OS
                  </span>
                </motion.div>
              </div>

              <p className="mx-auto mt-8 max-w-lg text-[13px] font-light leading-[1.85] text-zinc-600">
                Every deposit lives inside a single protocol vault, and
                <span className="text-zinc-500"> only the verified creator of that coin can open the door.</span>
              </p>
            </motion.div>

            {/* Compressed deposit node */}
            <motion.div
              className="absolute left-1/2 top-[40vh] z-20"
              style={{
                transform: depositNodeTransform,
                opacity: depositNodeOpacity,
              }}
            >
              <div className="inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.035] px-4 py-1.5 shadow-[0_0_32px_-12px_rgba(255,255,255,0.18)]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={CREATOR_CAMEOS[cameoIdx].key}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.35 }}
                  >
                    {cameoIcons[CREATOR_CAMEOS[cameoIdx].key] ? (
                      <img
                        src={cameoIcons[CREATOR_CAMEOS[cameoIdx].key]}
                        alt={CREATOR_CAMEOS[cameoIdx].label}
                        className="h-3.5 w-3.5 rounded-full object-cover opacity-80"
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[5px] font-black text-white"
                        style={{ background: CREATOR_CAMEOS[cameoIdx].color }}
                      >
                        {CREATOR_CAMEOS[cameoIdx].initials}
                      </span>
                    )}
                    <span className="font-mono text-xs text-zinc-400">{depositTokens}</span>
                    <span className="font-mono text-xs lowercase tracking-wider text-zinc-300">
                      {CREATOR_CAMEOS[cameoIdx].label}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>
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
            <motion.div
              className="absolute left-1/2 top-[44vh] z-20"
              style={{
                transform: vaultTransform,
                opacity: vaultOpacity,
              }}
            >
              <div className="relative">
                {/* Ambient blue glow */}
                <motion.div
                  className="pointer-events-none absolute inset-[-40px] rounded-full"
                  style={{
                    opacity: vaultGlow,
                    background:
                      'radial-gradient(circle, rgba(0,82,255,0.14) 0%, transparent 70%)',
                    boxShadow: '0 0 70px 24px rgba(0,82,255,0.35)',
                  }}
                  aria-hidden="true"
                />
                {/* White outline flash — fades in on deposit, holds through mint */}
                <motion.div
                  className="pointer-events-none absolute"
                  style={{
                    inset: -4,
                    borderRadius: 31,
                    opacity: vaultFlash,
                    boxShadow: [
                      '0 0 0 1.5px rgba(255,255,255,0.82)',
                      '0 0 20px 4px rgba(255,255,255,0.50)',
                      '0 0 55px 14px rgba(220,228,255,0.26)',
                      '0 0 110px 36px rgba(200,215,255,0.12)',
                    ].join(', '),
                  }}
                  aria-hidden="true"
                />
                {/* Deposit arrival glow — large radial pulse when dot lands */}
                <motion.div
                  className="pointer-events-none absolute"
                  style={{
                    inset: -20,
                    borderRadius: 47,
                    opacity: depositArrivalGlow,
                    boxShadow: [
                      '0 0 0 2px rgba(255,255,255,0.95)',
                      '0 0 36px 10px rgba(255,255,255,0.55)',
                      '0 0 90px 30px rgba(220,230,255,0.28)',
                      '0 0 180px 60px rgba(180,200,255,0.12)',
                    ].join(', '),
                  }}
                  aria-hidden="true"
                />
                {/* Persistent vault square — stays visible as the "captured" frame
                    through all distribution stages. Thinner and cooler than the
                    flash so it reads as a resting state, not an event. */}
                <motion.div
                  className="pointer-events-none absolute"
                  style={{
                    inset: -6,
                    borderRadius: 34,
                    opacity: vaultSquare,
                    border: '1px solid rgba(255,255,255,0.32)',
                    boxShadow: [
                      '0 0 0 1px rgba(180,200,255,0.12)',
                      '0 0 14px 3px rgba(180,200,255,0.18)',
                      '0 0 40px 10px rgba(140,170,255,0.08)',
                    ].join(', '),
                  }}
                  aria-hidden="true"
                />
                <ZorbViewer size={148} />
              </div>
            </motion.div>

            {/* Distribution fan chart — same visual language as the deploy section */}
            <motion.div
              className="pointer-events-none absolute inset-x-0 top-[55vh] z-30 px-10 lg:px-14"
              style={{ opacity: distSectionOp }}
            >
              <div className="mx-auto max-w-3xl">
                {/* Curved fan SVG — white/silver palette matching deploy section */}
                <div className="relative mx-auto w-full">
                  <svg
                    viewBox="0 0 800 110"
                    preserveAspectRatio="xMidYMid meet"
                    className="w-full"
                    aria-hidden="true"
                    style={{ height: 92 }}
                  >
                    <defs>
                      <linearGradient
                        id={`${uid}-dg`}
                        gradientUnits="userSpaceOnUse"
                        x1="400" y1="10" x2="400" y2="100"
                      >
                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0.06} />
                      </linearGradient>
                      {/* White glow — for stroke/path */}
                      <filter id={`${uid}-df`} x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="3.5" result="b" />
                        <feMerge>
                          <feMergeNode in="b" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      {/* Blue glow — for origin dot, endpoint dots, traveling dots */}
                      <filter id={`${uid}-bf`} x="-120%" y="-120%" width="340%" height="340%">
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feFlood floodColor="#60a5fa" floodOpacity="0.9" result="color" />
                        <feComposite in="color" in2="blur" operator="in" result="glow" />
                        <feMerge>
                          <feMergeNode in="glow" />
                          <feMergeNode in="glow" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* Origin dot — share supply — blue */}
                    <motion.circle
                      cx={400} cy={10} r={4.5}
                      fill="#93c5fd"
                      filter={`url(#${uid}-bf)`}
                      style={{ opacity: distSectionOp }}
                    />

                    {/* Path 0 — CCA Launch (left) */}
                    <motion.path
                      d={DIST_PATHS[0]}
                      stroke={`url(#${uid}-dg)`}
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      style={{ pathLength: orbitTrav0, opacity: node0Op }}
                    />
                    {/* Path 1 — Creator Vesting (center) */}
                    <motion.path
                      d={DIST_PATHS[1]}
                      stroke={`url(#${uid}-dg)`}
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      style={{ pathLength: orbitTrav1, opacity: node1Op }}
                    />
                    {/* Path 2 — LP Reserve (right) */}
                    <motion.path
                      d={DIST_PATHS[2]}
                      stroke={`url(#${uid}-dg)`}
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      style={{ pathLength: orbitTrav2, opacity: node2Op }}
                    />

                    {/* Destination dots — blue glow that pulses in on dot arrival */}
                    <motion.circle
                      cx={DIST_DESTS[0].cx} cy={DIST_DESTS[0].cy} r={4}
                      fill="#93c5fd"
                      filter={`url(#${uid}-bf)`}
                      style={{ opacity: nodeGlow0 }}
                    />
                    <motion.circle
                      cx={DIST_DESTS[1].cx} cy={DIST_DESTS[1].cy} r={4}
                      fill="#93c5fd"
                      filter={`url(#${uid}-bf)`}
                      style={{ opacity: nodeGlow1 }}
                    />
                    <motion.circle
                      cx={DIST_DESTS[2].cx} cy={DIST_DESTS[2].cy} r={4}
                      fill="#93c5fd"
                      filter={`url(#${uid}-bf)`}
                      style={{ opacity: nodeGlow2 }}
                    />

                    {/* Traveling dots — lead each path draw, blue to match endpoints */}
                    <motion.g style={{ opacity: distDotOp0 }}>
                      <motion.circle
                        r={4}
                        fill="#bfdbfe"
                        filter={`url(#${uid}-bf)`}
                        style={{ x: dist0DotX, y: dist0DotY }}
                      />
                    </motion.g>
                    <motion.g style={{ opacity: distDotOp1 }}>
                      <motion.circle
                        r={4}
                        fill="#bfdbfe"
                        filter={`url(#${uid}-bf)`}
                        style={{ x: 400, y: dist1DotY }}
                      />
                    </motion.g>
                    <motion.g style={{ opacity: distDotOp2 }}>
                      <motion.circle
                        r={4}
                        fill="#bfdbfe"
                        filter={`url(#${uid}-bf)`}
                        style={{ x: dist2DotX, y: dist2DotY }}
                      />
                    </motion.g>
                  </svg>

                  {/* Amount labels under each path endpoint */}
                  <motion.span
                    className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500"
                    style={{ left: '16.25%', top: '100%', opacity: node0Op }}
                  >
                    {SHARE_DISTRIBUTION_ROWS[0].amount}
                  </motion.span>
                  <motion.span
                    className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500"
                    style={{ left: '50%', top: '100%', opacity: node1Op }}
                  >
                    {SHARE_DISTRIBUTION_ROWS[1].amount}
                  </motion.span>
                  <motion.span
                    className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500"
                    style={{ left: '83.75%', top: '100%', opacity: node2Op }}
                  >
                    {SHARE_DISTRIBUTION_ROWS[2].amount}
                  </motion.span>
                </div>

                {/* Distribution cards — 3-column grid, one appears at a time */}
                <div className="mt-8 grid w-full grid-cols-3 gap-3 lg:gap-5">
                  {SHARE_DISTRIBUTION_ROWS.map((row, i) => {
                    const ops = [node0Op, node1Op, node2Op]
                    const ys = [dist0CardY, dist1CardY, dist2CardY]
                    const glows = [nodeGlow0, nodeGlow1, nodeGlow2]
                    return (
                      <motion.div
                        key={row.title}
                        className="relative flex flex-col overflow-hidden rounded-[18px] p-4 lg:p-5"
                        style={{
                          opacity: ops[i],
                          y: ys[i],
                          border: '1px solid rgba(255,255,255,0.09)',
                          background:
                            'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 60%, transparent 100%)',
                          boxShadow:
                            '0 18px 90px -48px rgba(255,255,255,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
                        }}
                      >
                        {/* Top edge highlight */}
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                        {/* Arrival glow — soft white ring */}
                        <motion.div
                          className="pointer-events-none absolute rounded-[18px]"
                          style={{
                            inset: -2,
                            opacity: glows[i],
                            boxShadow:
                              '0 0 0 1px rgba(255,255,255,0.28), 0 0 24px 6px rgba(255,255,255,0.12), 0 0 60px 18px rgba(200,215,255,0.08)',
                          }}
                          aria-hidden="true"
                        />
                        <div className="mb-1.5 flex items-center gap-1.5">
                          {row.icon && (
                            <img
                              src={row.icon}
                              alt={row.title}
                              className="h-3 w-3 opacity-70"
                              loading="lazy"
                            />
                          )}
                          <p className="font-mono text-[7.5px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                            {row.title}
                          </p>
                        </div>
                        <p
                          className="font-mono font-black leading-none"
                          style={{
                            fontSize: '2.2rem',
                            color: '#f0f0f8',
                            textShadow:
                              '0 0 22px rgba(255,255,255,0.5), 0 0 48px rgba(255,255,255,0.22)',
                          }}
                        >
                          {row.percent}
                        </p>
                        <p className="mt-1 font-mono text-[9px] text-zinc-500">
                          {row.amount}
                        </p>
                        <p className="mt-2.5 grow text-[10px] font-light leading-relaxed text-zinc-400">
                          {row.description}
                        </p>
                        <Link
                          to={row.route}
                          className="mt-3 text-[8px] font-medium tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-300"
                        >
                          Learn more →
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>

            {/* Minted shares node — floats ABOVE the vault, marks where distributions begin */}
            <motion.div
              className="absolute left-1/2 top-[49vh] z-25"
              style={{
                transform: shareTransform,
                opacity: shareOpacity,
              }}
            >
              <div className="flex flex-col items-center gap-2">
                <div
                  className="inline-flex items-center rounded-full border px-5 py-2 font-mono text-xs font-semibold"
                  style={{
                    borderColor: 'rgba(0,82,255,0.40)',
                    background: 'rgba(0,82,255,0.08)',
                    color: 'rgba(100,160,255,0.95)',
                    boxShadow: [
                      '0 0 0 1px rgba(0,82,255,0.18)',
                      '0 0 32px -6px rgba(0,82,255,0.60)',
                      '0 0 64px -16px rgba(0,82,255,0.28)',
                      'inset 0 1px 0 rgba(120,170,255,0.12)',
                    ].join(', '),
                  }}
                >
                  {shareTokens}
                </div>
                <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
                  Minted share supply
                </p>
              </div>
            </motion.div>


            {/* Deploy chamber */}
            <motion.section
              className="absolute inset-x-0 top-[50vh] z-10 px-10 lg:px-14"
              style={{
                transform: deployTransform,
                opacity: deployOpacity,
                filter: deployFilter,
              }}
            >
              <div className="mx-auto max-w-4xl">
                <motion.div
                  className="mb-8 text-center"
                  style={{ opacity: deployTitleOp, y: deployTitleY }}
                >
                  <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.32em] text-zinc-400">
                    Principal deployment
                  </p>
                  <p className="mx-auto mt-3 max-w-lg text-[13px] font-light leading-[1.8] text-zinc-400">
                    The original deposit stays intact in the vault and spreads across strategy lanes below.
                  </p>
                </motion.div>

                <motion.div
                  className="mb-6 flex justify-center"
                  style={{ opacity: s4PillOp, y: s4PillY }}
                >
                  <div
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.16] px-5 py-2 font-mono text-xs font-semibold text-zinc-200"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      boxShadow: '0 0 22px -8px rgba(255,255,255,0.2)',
                    }}
                  >
                    {depositTokens}&nbsp;
                    <span className="font-medium text-zinc-500">TOKEN</span>
                  </div>
                </motion.div>

                <div className="relative mx-auto w-full max-w-3xl">
                  <svg
                    viewBox="0 0 800 120"
                    preserveAspectRatio="xMidYMid meet"
                    className="w-full"
                    aria-hidden="true"
                    style={{ height: 108 }}
                  >
                    <defs>
                      <linearGradient
                        id={`${uid}-sg`}
                        gradientUnits="userSpaceOnUse"
                        x1="400"
                        y1="18"
                        x2="400"
                        y2="108"
                      >
                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0.06} />
                      </linearGradient>
                      <filter id={`${uid}-sf`} x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="3.5" result="b" />
                        <feMerge>
                          <feMergeNode in="b" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    <motion.circle
                      cx={400}
                      cy={18}
                      r={4}
                      fill="rgba(255,255,255,0.7)"
                      filter={`url(#${uid}-sf)`}
                      style={{ opacity: s4PillOp, scale: s4PillOp }}
                    />

                    <motion.path
                      d={STRAT_PATHS[0]}
                      stroke={`url(#${uid}-sg)`}
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      style={{ pathLength: s4p0, opacity: s4pOp0 }}
                    />
                    <motion.path
                      d={STRAT_PATHS[1]}
                      stroke={`url(#${uid}-sg)`}
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      style={{ pathLength: s4p1, opacity: s4pOp1 }}
                    />
                    <motion.path
                      d={STRAT_PATHS[2]}
                      stroke={`url(#${uid}-sg)`}
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      style={{ pathLength: s4p2, opacity: s4pOp2 }}
                    />
                    <motion.path
                      d={STRAT_PATHS[3]}
                      stroke={`url(#${uid}-sg)`}
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      style={{ pathLength: s4p3, opacity: s4pOp3 }}
                    />

                    <motion.circle
                      cx={STRAT_DESTS[0].cx}
                      cy={STRAT_DESTS[0].cy}
                      r={3.5}
                      fill="rgba(255,255,255,0.45)"
                      filter={`url(#${uid}-sf)`}
                      style={{ opacity: s4d0, scale: s4d0 }}
                    />
                    <motion.circle
                      cx={STRAT_DESTS[1].cx}
                      cy={STRAT_DESTS[1].cy}
                      r={3.5}
                      fill="rgba(255,255,255,0.45)"
                      filter={`url(#${uid}-sf)`}
                      style={{ opacity: s4d1, scale: s4d1 }}
                    />
                    <motion.circle
                      cx={STRAT_DESTS[2].cx}
                      cy={STRAT_DESTS[2].cy}
                      r={3.5}
                      fill="rgba(255,255,255,0.45)"
                      filter={`url(#${uid}-sf)`}
                      style={{ opacity: s4d2, scale: s4d2 }}
                    />
                    <motion.circle
                      cx={STRAT_DESTS[3].cx}
                      cy={STRAT_DESTS[3].cy}
                      r={3.5}
                      fill="rgba(255,255,255,0.45)"
                      filter={`url(#${uid}-sf)`}
                      style={{ opacity: s4d3, scale: s4d3 }}
                    />
                  </svg>

                  <motion.span
                    className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500"
                    style={{ left: '12.5%', top: '100%', opacity: s4d0 }}
                  >
                    {STRATEGY_CARDS[0]?.amount}
                  </motion.span>
                  <motion.span
                    className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500"
                    style={{ left: '37.5%', top: '100%', opacity: s4d1 }}
                  >
                    {STRATEGY_CARDS[1]?.amount}
                  </motion.span>
                  <motion.span
                    className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500"
                    style={{ left: '62.5%', top: '100%', opacity: s4d2 }}
                  >
                    {STRATEGY_CARDS[2]?.amount}
                  </motion.span>
                  <motion.span
                    className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-zinc-500"
                    style={{ left: '87.5%', top: '100%', opacity: s4d3 }}
                  >
                    {STRATEGY_CARDS[3]?.amount}
                  </motion.span>
                </div>

                <div className="mt-10 grid w-full grid-cols-4 gap-3 lg:gap-5">
                  {STRATEGY_CARDS.map((card, i) => (
                    <motion.div
                      key={card.label}
                      className="relative flex flex-col overflow-hidden rounded-[18px] p-4 lg:p-5"
                      style={{
                        ...s4CardMotions[i],
                        border: '1px solid rgba(255,255,255,0.09)',
                        background:
                          'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 60%, transparent 100%)',
                        boxShadow:
                          '0 18px 90px -48px rgba(255,255,255,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
                      }}
                    >
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                      <div className="mb-3 flex items-center gap-1.5">
                        {card.icon ? (
                          <img
                            src={card.icon}
                            alt={card.iconAlt}
                            className={card.iconClassName}
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-white/15" aria-hidden="true" />
                        )}
                        <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
                          {card.label}
                        </p>
                      </div>

                      <p
                        className="font-mono font-black leading-none"
                        style={{
                          fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
                          textShadow:
                            '0 0 22px rgba(255,255,255,0.5), 0 0 48px rgba(255,255,255,0.25)',
                          color: '#f0f0f8',
                        }}
                      >
                        {card.percent}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-zinc-400">{card.amount}</p>
                      <p className="mt-2 grow text-[11px] font-light leading-relaxed text-zinc-400">
                        {card.description}
                      </p>
                      <Link
                        to={card.route}
                        className="mt-3 self-end text-[9px] font-medium tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-200"
                      >
                        Learn more →
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.section>
          </motion.div>

          {/* Cube interior POV — you're inside the ERC-4626 vault cube,
              looking out through its walls at the surrounding Zorb sphere.
              The cube wireframe shows the vault structure; the sphere rings
              beyond it show the Zorb/Zora world that contains everything. */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-[8]"
            style={{ opacity: cubeOp }}
            aria-hidden="true"
          >
            {/* Ambient glow from the sphere surface illuminating the cube interior */}
            <div
              className="absolute inset-0"
              style={{
                background: [
                  'radial-gradient(ellipse 55% 55% at 50% 50%, rgba(140,170,255,0.06) 0%, transparent 70%)',
                  'radial-gradient(ellipse 90% 40% at 50% 0%,   rgba(180,200,255,0.04) 0%, transparent 60%)',
                  'radial-gradient(ellipse 90% 40% at 50% 100%, rgba(180,200,255,0.04) 0%, transparent 60%)',
                ].join(', '),
              }}
            />

            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
            >
              <defs>
                {/* Radial fade: sphere rings are brightest at edge, fading to centre */}
                <radialGradient id="sphere-fade" cx="50%" cy="50%" r="50%">
                  <stop offset="55%"  stopColor="rgba(200,215,255,0)"   />
                  <stop offset="80%"  stopColor="rgba(200,215,255,0.08)" />
                  <stop offset="100%" stopColor="rgba(200,215,255,0.18)" />
                </radialGradient>
              </defs>

              {/* ── SPHERE SURFACE (Zorb surrounding the cube) ─────────────────
                  The sphere is larger than the cube. From inside we see its
                  inner surface as partial arcs peeking past the cube edges.    */}

              {/* Equatorial ring of the sphere — just visible at mid-height */}
              <ellipse
                cx="50" cy="50" rx="52" ry="10"
                fill="none"
                stroke="rgba(180,200,255,0.09)"
                strokeWidth="0.22"
                strokeDasharray="1.4 2.2"
              />
              {/* Upper latitude ring */}
              <ellipse
                cx="50" cy="22" rx="40" ry="7"
                fill="none"
                stroke="rgba(180,200,255,0.06)"
                strokeWidth="0.16"
                strokeDasharray="1.2 2.6"
              />
              {/* Lower latitude ring */}
              <ellipse
                cx="50" cy="78" rx="40" ry="7"
                fill="none"
                stroke="rgba(180,200,255,0.06)"
                strokeWidth="0.16"
                strokeDasharray="1.2 2.6"
              />
              {/* Vertical meridian — sphere longitude line through centre */}
              <ellipse
                cx="50" cy="50" rx="9" ry="52"
                fill="none"
                stroke="rgba(180,200,255,0.07)"
                strokeWidth="0.16"
                strokeDasharray="1.2 2.8"
              />
              {/* Radial fill — gives the cube interior a sphere-lit ambience */}
              <rect x="0" y="0" width="100" height="100" fill="url(#sphere-fade)" />

              {/* ── CUBE INTERIOR WALLS ─────────────────────────────────────── */}

              {/* Back wall — the far face of the cube */}
              <rect
                x="30" y="26" width="40" height="48"
                rx="2.6" ry="2.6"
                fill="none"
                stroke="rgba(255,255,255,0.09)"
                strokeWidth="0.20"
              />
              {/* 4 perspective edges — back wall corner → screen corner */}
              <line x1="30" y1="26" x2="0"   y2="0"   stroke="rgba(255,255,255,0.06)" strokeWidth="0.16" />
              <line x1="70" y1="26" x2="100" y2="0"   stroke="rgba(255,255,255,0.06)" strokeWidth="0.16" />
              <line x1="70" y1="74" x2="100" y2="100" stroke="rgba(255,255,255,0.06)" strokeWidth="0.16" />
              <line x1="30" y1="74" x2="0"   y2="100" stroke="rgba(255,255,255,0.06)" strokeWidth="0.16" />
              {/* Horizontal mid-wall depth guides */}
              <line x1="30" y1="50" x2="0"   y2="50"  stroke="rgba(255,255,255,0.03)" strokeWidth="0.12" />
              <line x1="70" y1="50" x2="100" y2="50"  stroke="rgba(255,255,255,0.03)" strokeWidth="0.12" />
              {/* Vertical mid-wall depth guides */}
              <line x1="50" y1="26" x2="50"  y2="0"   stroke="rgba(255,255,255,0.03)" strokeWidth="0.12" />
              <line x1="50" y1="74" x2="50"  y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="0.12" />
            </svg>
          </motion.div>
        </div>
      </div>

      {/* MOBILE — keep this simpler / stacked */}
      <div className="sm:hidden">
        <section className="cinematic-section no-divider-top no-divider-bottom !py-20">
          <div className="mx-auto max-w-sm px-5 text-center">
            <p className="mb-5 text-[9px] font-medium uppercase tracking-[0.3em] text-zinc-600">
              01 · Deposit
            </p>
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
              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Zora Creator Coin
              </span>
            </div>
            <p className="mt-6 text-sm font-light leading-relaxed text-zinc-600">
              Depositing into ERC-4626 vault — minting share tokens 1:1.
            </p>
          </div>
        </section>

        <section className="cinematic-section no-divider-top no-divider-bottom !py-16">
          <div className="mx-auto flex max-w-sm flex-col items-center px-5 text-center">
            <p className="mb-4 text-[9px] font-medium uppercase tracking-[0.3em] text-zinc-600">
              02 · Mint
            </p>
            <p className="mb-5 font-mono text-xs text-zinc-500">{depositTokens} TOKEN →</p>
            <div
              className="relative flex flex-col items-center justify-center overflow-hidden rounded-[16px] bg-black/95"
              style={{
                width: 124,
                height: 124,
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 0 44px -8px rgba(0,82,255,0.6)',
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage:
                    'radial-gradient(circle, rgba(0,82,255,0.7) 1px, transparent 1px)',
                  backgroundSize: '10px 10px',
                }}
              />
              <span className="relative font-mono text-[7px] uppercase tracking-widest text-zinc-600">ERC</span>
              <span
                className="relative font-mono text-2xl font-black text-brand-primary"
                style={{ textShadow: '0 0 20px rgba(0,82,255,0.7)' }}
              >
                4626
              </span>
              <span className="relative mt-1 font-mono text-[7px] uppercase tracking-widest text-zinc-700">
                VAULT
              </span>
            </div>
            <p className="mt-5 font-mono text-sm font-semibold text-brand-primary">→ {shareTokens}</p>
            <p className="mt-1 font-mono text-[9px] tracking-[0.28em] text-brand-primary/45">MINTED</p>
          </div>
        </section>

        <section className="cinematic-section no-divider-top no-divider-bottom !py-16">
          <div className="mx-auto max-w-sm px-5">
            <p className="mb-2 text-center text-[9px] font-medium uppercase tracking-[0.3em] text-zinc-600">
              03 · Distribute
            </p>
            <p className="mb-7 text-center font-mono text-lg font-bold text-brand-primary">
              {shareTokens}
            </p>
            <div className="space-y-3">
              {SHARE_DISTRIBUTION_ROWS.map((row) => (
                <div
                  key={row.title}
                  className="relative overflow-hidden rounded-[16px] p-4"
                  style={{
                    border: '1px solid rgba(0,82,255,0.18)',
                    background: 'linear-gradient(160deg, rgba(0,82,255,0.08), transparent)',
                  }}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-primary/45 to-transparent" />
                  <div className="flex items-baseline justify-between">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
                      {row.title}
                    </p>
                    <div className="text-right">
                      <p className="font-mono text-2xl font-black text-brand-primary">{row.percent}</p>
                      <p className="font-mono text-[9px] text-brand-primary/50">{row.amount}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] font-light leading-relaxed text-zinc-500">
                    {row.description}
                  </p>
                  <Link
                    to={row.route}
                    className="mt-2 block text-right text-[9px] font-medium text-brand-primary/45 hover:text-brand-primary/70"
                  >
                    Learn more →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="cinematic-section no-divider-top no-divider-bottom !py-16">
          <div className="mx-auto max-w-sm px-5">
            <p className="mb-2 text-center text-[9px] font-medium uppercase tracking-[0.3em] text-zinc-600">
              04 · Deploy
            </p>
            <p className="mb-7 text-center font-mono text-lg font-bold text-zinc-200">
              {depositTokens} <span className="text-zinc-500">TOKEN</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {STRATEGY_CARDS.map((card) => (
                <div
                  key={card.label}
                  className="relative overflow-hidden rounded-[16px] p-4"
                  style={{
                    border: '1px solid rgba(255,255,255,0.09)',
                    background: 'linear-gradient(160deg, rgba(255,255,255,0.05), transparent)',
                  }}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  <div className="mb-2.5 flex items-center gap-1.5">
                    {card.icon ? (
                      <img src={card.icon} alt={card.iconAlt} className={card.iconClassName} loading="lazy" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-white/15" aria-hidden="true" />
                    )}
                    <p className="text-[8px] font-semibold uppercase tracking-widest text-zinc-600">
                      {card.label}
                    </p>
                  </div>
                  <p className="font-mono text-2xl font-black text-zinc-100">{card.percent}</p>
                  <p className="font-mono text-[9px] text-zinc-600">{card.amount}</p>
                  <p className="mt-1.5 text-[11px] font-light leading-relaxed text-zinc-500">
                    {card.description}
                  </p>
                  <Link
                    to={card.route}
                    className="mt-2 block text-right text-[9px] font-medium text-zinc-600 hover:text-zinc-400"
                  >
                    Learn more →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
