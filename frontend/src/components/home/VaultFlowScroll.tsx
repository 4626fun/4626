import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  motion,
  useMotionTemplate,
  useMotionValueEvent,
  useReducedMotion,
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
    if (!trigger) {
      cancelAnimationFrame(frame.current)
      return
    }
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

  return trigger ? output : text
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
    stiffness: 100,
    damping: 30,
    mass: 0.9,
  })

  const [activeStageIdx, setActiveStageIdx] = useState(0)
  const [cameoIcons, setCameoIcons] = useState<Record<string, string>>({})
  const [vaultOsPillVisible, setVaultOsPillVisible] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const smoothstep = (t: number) => t * t * (3 - 2 * t)

  useMotionValueEvent(scroll, 'change', (v) => {
    if (v < 0.42) setActiveStageIdx(0)
    else if (v < 0.62) setActiveStageIdx(1)
    else if (v < 0.84) setActiveStageIdx(2)
    else setActiveStageIdx(3)
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

  const currentStage = STAGE_NAV[activeStageIdx]

  // HUD / camera
  const progressH = useTransform(scroll, [0, 1], ['0%', '100%'])
  const cueOpacity = useTransform(scroll, [0, 0.07, 0.16], [0.88, 0.88, 0])

  // Camera — continuous slow drift, no kinks
  const worldY = useTransform(scroll, [0, 1], [0, -6])
  // Flat through freefall + distributions. At 0.91 the camera rushes through the vault:
  // peaks around 2.1× at 0.95 (the "passing through" moment) then settles to 1.45× for
  // deploy content so stage 4 remains legible on narrower screens.
  const worldScale = useTransform(scroll, [0, 0.86, 0.91, 0.95, 1.0], [1.25, 1.25, 1.55, 2.40, 1.65])
  // Eases freefall tilt to 0° by 0.62, stays flat for the rest of the scroll.
  const worldRotateX = useTransform(scroll, [0, 0.36, 0.52, 1], [8, 2, 0, 0])
  const worldTransform = useMotionTemplate`
    translate3d(0, ${worldY}%, 0)
    scale(${worldScale})
    rotateX(${worldRotateX}deg)
  `

  const atmosphereOpacity = useTransform(scroll, [0, 1], [0.22, 0.42])

  // Hero plane — stays hidden during the initial Zorb drop, then reveals in steps.
  // We keep the same hold/fade window later so stage transitions remain stable.
  const heroZ = useTransform(scroll, [0, 0.20, 0.44, 0.56], [170, 40, 40, -60])
  const heroY = useTransform(scroll, [0, 0.56], [0, -12])
  const heroScale = useTransform(scroll, [0, 0.20, 0.44, 0.56], [1, 0.94, 0.94, 0.88])
  const heroOpacity = useTransform(scroll, [0, 0.15, 0.22, 0.44, 0.58], [0, 0, 1, 1, 0])
  const heroTitleOpacity = useTransform(scroll, [0.15, 0.22], [0, 1])
  const heroTitleY = useTransform(scroll, [0.15, 0.22], [14, 0])
  const heroPillsOpacity = useTransform(scroll, [0.15, 0.22], [0, 1])
  const heroPillsY = useTransform(scroll, [0.15, 0.22], [12, 0])
  const heroBodyOpacity = useTransform(scroll, [0.24, 0.32], [0, 1])
  const heroBodyY = useTransform(scroll, [0.24, 0.32], [10, 0])
  const heroBlur = useTransform(scroll, [0.44, 0.54], [0, 7])
  const heroFilter = useMotionTemplate`blur(${heroBlur}px)`
  const heroTransform = useMotionTemplate`
    translate3d(-50%, ${heroY}px, ${heroZ}px)
    scale(${heroScale})
  `

  // Pill -> vault connector — starts only after the freeze pause ends (0.46)
  const _topRaw = useTransform(scroll, [0.46, 0.56], [0, 1])
  const topTrail = useTransform(_topRaw, smoothstep)
  // Start 90px above the card anchor so the card descends from above the vault
  const topDotY = useTransform(topTrail, (t) => -90 + 198 * t)
  const topDotOp = useTransform(scroll, [0.46, 0.48, 0.55, 0.57], [0, 1, 1, 0])

  const depositNodeScale = useTransform(scroll, [0.46, 0.54, 0.84, 0.90], [1.08, 1, 1, 0.94])
  // Card stays visible through all of stage 3 (distributions); deposited side fades independently
  const depositNodeOpacity = useTransform(scroll, [0.46, 0.50, 0.84, 0.90], [0, 1, 1, 0])
  // Left column + arrow fade out when distributions begin, leaving only the minted side
  const depositedSideOp = useTransform(scroll, [0.62, 0.68], [1, 0])
  const depositNodeTransform = useMotionTemplate`translate3d(-50%, ${topDotY}px, 0px) scale(${depositNodeScale})`

  // Vault — rockets toward camera while off-screen, slows to a crawl once visible,
  // then settles into the vault anchor with a tiny overshoot before the deposit sequence
  // Vault stays at Z=0 after capture — world zooms in around it for "entering" feel
  const vaultZ = useTransform(scroll, [0, 0.05, 0.20, 0.28, 0.80, 0.88], [260, 180, 18, 0, 0, -120])
  // Scale locks at 1 once captured — no shrinking until it fades out
  const vaultScale = useTransform(scroll, [0, 0.05, 0.20, 0.28, 0.88], [1.55, 1.38, 1.06, 1, 1])
  // Stays visible as a container through distributions, fades as world zooms through
  // At 0.91 the vault briefly brightens (camera approaching), then goes dark as we
  // rush through it — the white flash reinforces the "passing through the portal" feel.
  // Zorb stays bright through all of stage 3 — only dims as zoom begins (0.91+)
  const vaultOpacity = useTransform(scroll, [0, 0.03, 0.50, 0.58, 0.91, 0.93, 1.0], [0, 0.65, 1, 0.72, 0.9, 0, 0])
  // Glow/flash: mint phase only — starts after deposit dot arrives
  const vaultGlow = useTransform(scroll, [0.36, 0.44, 0.48, 0.52], [0, 1, 0.3, 0])
  // vaultFlash removed — coinEntryGlow at 0.60+ is the single glow event
  // Vault tray (open cradle) — visible BEFORE capture so users see the "landing zone" as the Zorb falls
  const vaultTrayOp = useTransform(scroll, [0.10, 0.20, 0.91, 0.94], [0, 0.55, 0.55, 0])
  // Vault lid — snaps closed on capture, turning the open tray into a sealed vault
  const vaultLidOp = useTransform(scroll, [0.28, 0.36, 0.91, 0.94], [0, 1, 1, 0])
  // depositArrivalGlow removed — coinEntryGlow at 0.60+ is the single glow event
  // Coin entry glow — fires the moment deposit fill completes, sustains through stage 3
  // Orange-to-blue: the creator coin's energy is absorbed, vault activates
  const coinEntryGlow = useTransform(scroll, [0.60, 0.66, 0.84, 0.90], [0, 1, 1, 0])
  // Platform edge flare — near-edge of vault seal brightens on same beat
  const coinEntryFlare = useTransform(scroll, [0.60, 0.65, 0.84, 0.90], [0, 1, 0.65, 0])
  // Entry radial bloom: peaks as vault rushes, bridges into deploy
  const vaultEntry = useTransform(scroll, [0.82, 0.87, 0.94], [0, 1, 0])

  // ── Distribution fan chart — one curved path + card revealed at a time ─
  // Section envelope fades in at 0.52, holds, fades as vault rushes at 0.88
  // Dist section fades in AFTER the deposit connector finishes (~0.60) and stays
  // fully opaque well into the zoom phase so users can see it during the zoom-in
  // Distributions hold through stage 3, then clear slightly earlier to give stage 4 more runway.
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
  const nodeGlow2 = useTransform(scroll, [0.83, 0.86, 0.88, 0.90], [0, 1, 1, 0])

  // Remaining ■AKITA shares — starts at total minted (50M) and decreases as each
  // distribution orbit line completes: CCA 20M, vesting 20M, LP 10M.
  const remainingMinted = useTransform(
    [orbitTrav0, orbitTrav1, orbitTrav2],
    ([t0, t1, t2]) =>
      Math.round(50_000_000 - ((t0 as number) * 20_000_000 + (t1 as number) * 20_000_000 + (t2 as number) * 10_000_000)),
  )

  // "× ERC-4626" suffix appears only after the vault captures the Zorb (~0.28)
  const ercSuffixOp = useTransform(scroll, [0.28, 0.36], [0, 1])
  // 4626 pill appears during the pause so users see the full identity at rest
  const vaultOsPillOp = useTransform(scroll, [0.30, 0.38], [0, 1])
  // Phase 2 corner badge — visible during mint / deposit phase only
  const stage2LabelOp = useTransform(scroll, [0.44, 0.50, 0.64, 0.70], [0, 1, 1, 0])
  // Deposit fill — drives the counter and progress bar in the deposit pill
  const depositFillPct = useTransform(scroll, [0.46, 0.58], [0, 1])
  const depositFillWidth = useTransform(depositFillPct, v => `${(Math.min(v, 1) * 100).toFixed(1)}%`)
  // "Vault initiated" confirmation badge — flashes after fill completes
  const vaultInitOp = useTransform(scroll, [0.60, 0.63, 0.66, 0.70], [0, 1, 1, 0])
  // Mount the 4626 pill in the DOM only once it becomes visible (prevents layout shift)
  useMotionValueEvent(vaultOsPillOp, 'change', (v) => {
    if (v > 0.02) setVaultOsPillVisible(true)
  })

  // Drive a React state integer so the deposit counter renders correctly in JSX
  const [depositCount, setDepositCount] = useState(0)
  useMotionValueEvent(depositFillPct, 'change', (v) => {
    setDepositCount(Math.round(Math.min(v, 1) * 50_000_000))
  })
  // Drive remaining-shares counter — drains as each orbit distribution line completes
  const [remainingCount, setRemainingCount] = useState(50_000_000)
  useMotionValueEvent(remainingMinted, 'change', (v) => setRemainingCount(v))

  // Freefall entrance — two-speed design:
  //   0→0.05  : fast off-screen rush (user doesn't see this)
  //   0.05→0.20: slow visible hang — the Zorb drifts down
  //   0.20→0.24: tiny overshoot past the anchor (bounce feel)
  //   0.24→0.28: settles back to 0 (vault capture)
  const zorbFallY = useTransform(scroll, [0, 0.05, 0.20, 0.24, 0.28], [-240, -70, -5, 4, 0])
  const zorbFallRotZ = useTransform(scroll, [0, 0.05, 0.20, 0.28], [-24, -19, -3, 0])

  const vaultTransform = useMotionTemplate`
    translate3d(-50%, ${zorbFallY}vh, ${vaultZ}px)
    scale(${vaultScale})
    rotateZ(${zorbFallRotZ}deg)
  `

  // Share node — floats in above Zorb during distributions, then morphs to underlying $akita at stage 4.
  // Parent stays visible the whole time; children cross-fade at the stage-3→4 boundary.
  const shareY = useTransform(scroll, [0.48, 0.60], [30, 0])
  const shareScale = useTransform(scroll, [0.52, 0.58], [0.94, 1])
  // Visible from stage-2 mint through end of stage-3 distributions
  const shareOpacity = useTransform(scroll, [0.52, 0.58, 0.84, 0.90], [0, 1, 1, 0])
  const shareTransform = useMotionTemplate`translate3d(-50%, ${shareY}px, 0px) scale(${shareScale})`

  // Cube interior POV — starts slightly earlier so stage 4 has more visible dwell time.
  const cubeOp = useTransform(scroll, [0.88, 0.91, 0.95, 1.0], [0, 1.0, 0.85, 0.8])

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



  // Deploy chamber — widened timing so the final stage plays longer before scroll end.
  const deployZ = useTransform(scroll, [0.88, 0.95, 1.0], [-180, 0, 0])
  const deployOpacity = useTransform(scroll, [0.88, 0.94], [0, 1])
  const deployBlur = useTransform(scroll, [0.88, 0.94, 1.0], [10, 0, 0])
  const deployTransform = useMotionTemplate`translate3d(0px, 0px, ${deployZ}px)`
  const deployFilter = useMotionTemplate`blur(${deployBlur}px)`
  const deployTitleOp = useTransform(scroll, [0.89, 0.95], [0, 1])
  const deployTitleY = useTransform(scroll, [0.89, 0.95], [18, 0])

  const s4PillOp = useTransform(scroll, [0.89, 0.95], [0, 1])
  const s4PillY = useTransform(scroll, [0.95, 1.0], [12, 0])

  // Stage 4 sequential fan — expanded window so each card has more dwell time.
  const _s4p0r = useTransform(scroll, [0.90, 0.93], [0, 1])
  const s4p0 = useTransform(_s4p0r, smoothstep)
  const s4pOp0 = useTransform(scroll, [0.90, 0.93], [0, 1])
  const s4d0 = useTransform(scroll, [0.91, 0.94], [0, 1])
  const s4c0o = useTransform(scroll, [0.91, 0.94], [0, 1])
  const s4c0y = useTransform(scroll, [0.91, 0.94], [24, 0])

  const _s4p1r = useTransform(scroll, [0.92, 0.95], [0, 1])
  const s4p1 = useTransform(_s4p1r, smoothstep)
  const s4pOp1 = useTransform(scroll, [0.92, 0.95], [0, 1])
  const s4d1 = useTransform(scroll, [0.93, 0.96], [0, 1])
  const s4c1o = useTransform(scroll, [0.93, 0.96], [0, 1])
  const s4c1y = useTransform(scroll, [0.93, 0.96], [24, 0])

  const _s4p2r = useTransform(scroll, [0.94, 0.97], [0, 1])
  const s4p2 = useTransform(_s4p2r, smoothstep)
  const s4pOp2 = useTransform(scroll, [0.94, 0.97], [0, 1])
  const s4d2 = useTransform(scroll, [0.95, 0.98], [0, 1])
  const s4c2o = useTransform(scroll, [0.95, 0.98], [0, 1])
  const s4c2y = useTransform(scroll, [0.95, 0.98], [24, 0])

  const _s4p3r = useTransform(scroll, [0.96, 0.99], [0, 1])
  const s4p3 = useTransform(_s4p3r, smoothstep)
  const s4pOp3 = useTransform(scroll, [0.96, 0.99], [0, 1])
  const s4d3 = useTransform(scroll, [0.97, 1.0], [0, 1])
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
      {/* Cinematic world — single scroll-driven path for all screen sizes */}
      <div
        ref={outerRef}
        className="relative block"
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

          {/* Stage nav — sidebar only on sm+ to avoid overlapping content on narrow screens */}
          <div className="absolute left-9 top-1/2 hidden -translate-y-1/2 flex-col gap-5 sm:flex">
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

          {/* Phase 2 corner badge — appears during the mint / deposit window */}
          <motion.div
            className="pointer-events-none absolute right-4 top-10 z-30 hidden sm:flex items-center gap-1.5"
            style={{ opacity: stage2LabelOp }}
            aria-hidden="true"
          >
            <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.28em] text-zinc-600">
              Phase
            </span>
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-400">
              02
            </span>
            <span className="h-px w-3 bg-zinc-700" />
            <span className="font-mono text-[8px] uppercase tracking-[0.28em] text-zinc-600">
              Mint
            </span>
          </motion.div>

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
                {/* "Zora" appears during freefall; "× ERC-4626" fades in after vault captures Zorb */}
                <span
                  style={{
                    display: 'inline-block',
                    background: 'linear-gradient(170deg, #ffffff 28%, #9da3b3 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Zora
                </span>
                <motion.span
                  style={{
                    display: 'inline-block',
                    opacity: ercSuffixOp,
                    background: 'linear-gradient(170deg, #ffffff 28%, #9da3b3 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  &thinsp;<span style={{ WebkitTextFillColor: 'rgba(160,180,255,0.82)' }}>×</span>
                  &thinsp;ERC-4626
                </motion.span>
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
                {vaultOsPillVisible && (
                  <motion.div
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5"
                    style={{ opacity: vaultOsPillOp }}
                  >
                    <img src="/app-icon.svg" alt="4626" className="h-3.5 w-3.5 rounded-[3px]" loading="lazy" />
                    <span className="text-[8px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      ERC-4626 Vault
                    </span>
                  </motion.div>
                )}
              </motion.div>

              <motion.p
                className="mx-auto mt-7 max-w-sm text-center text-[12px] font-light leading-[1.8] text-zinc-600"
                style={{ opacity: heroBodyOpacity, y: heroBodyY }}
              >
                Deposit your creator coin once.{' '}
                <span className="text-zinc-500">Trade, borrow, and earn yield — without ever selling.</span>
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
              <div
                className="flex w-[256px] flex-col overflow-hidden rounded-xl backdrop-blur-sm"
                style={{
                  border: '1px solid rgba(255,255,255,0.07)',
                  background: 'rgba(6,6,12,0.72)',
                  boxShadow: '0 0 40px -12px rgba(249,115,22,0.16), 0 0 40px -12px rgba(0,82,255,0.16)',
                }}
              >
                {/* Two-column token identity headers — each column owns its token name */}
                <div className="flex border-b border-white/[0.05]">
                  {/* Left header — Zora Creator Coin (the input, orange) */}
                  <motion.div
                    className="flex flex-1 flex-col gap-0.5 border-r border-white/[0.05] px-3 py-2"
                    style={{ opacity: depositedSideOp }}
                  >
                    <div className="flex items-center gap-1.5">
                      {cameoIcons['akita'] ? (
                        <img src={cameoIcons['akita']} alt="akita" className="h-3.5 w-3.5 rounded-full object-cover opacity-80" loading="lazy" />
                      ) : (
                        <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[4px] font-black text-white" style={{ background: '#f97316' }}>AK</span>
                      )}
                      <span className="font-mono text-[10px] font-semibold text-white/80">akita</span>
                    </div>
                    <span className="font-mono text-[6.5px] tracking-[0.18em]" style={{ color: 'rgba(249,115,22,0.50)' }}>zora creator coin</span>
                  </motion.div>

                  {/* Right header — ERC-4626 Vault Share (the output, blue) */}
                  <div className="flex flex-1 flex-col gap-0.5 px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[10px] font-semibold" style={{ color: 'rgba(100,160,255,0.90)' }}>■AKITA</span>
                    </div>
                    <span className="font-mono text-[6.5px] tracking-[0.18em]" style={{ color: 'rgba(100,160,255,0.42)' }}>erc-4626 vault share</span>
                  </div>
                </div>

                {/* Counters — same value, different token contexts */}
                <div className="flex items-stretch">
                  {/* Left — deposited amount (fades when distributions begin) */}
                  <motion.div
                    className="flex flex-1 flex-col gap-0.5 border-r border-white/[0.05] px-3 py-3"
                    style={{ opacity: depositedSideOp }}
                  >
                    <span className="font-mono text-[6.5px] tracking-[0.22em]" style={{ color: 'rgba(249,115,22,0.55)' }}>deposited</span>
                    <span className="font-mono text-[13px] font-bold tabular-nums text-white/90">
                      {depositCount.toLocaleString()}
                    </span>
                  </motion.div>

                  {/* Arrow — fades with deposited side */}
                  <motion.div
                    className="flex items-center justify-center px-2"
                    style={{ opacity: depositedSideOp }}
                  >
                    <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.12)' }}>→</span>
                  </motion.div>

                  {/* Right — distributing (decreases as each orbit channel fills) */}
                  <div className="flex flex-1 flex-col gap-0.5 px-3 py-3">
                    <span className="font-mono text-[6.5px] tracking-[0.22em]" style={{ color: 'rgba(100,160,255,0.55)' }}>distributing</span>
                    <span className="font-mono text-[13px] font-bold tabular-nums" style={{ color: 'rgba(100,160,255,0.92)' }}>
                      {remainingCount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Fill bar — fades with deposited side */}
                <motion.div
                  className="mx-3 mb-3 h-[2px] overflow-hidden rounded-full bg-white/[0.04]"
                  style={{ opacity: depositedSideOp }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      width: depositFillWidth,
                      background: 'linear-gradient(90deg, #f97316 0%, #3b5fff 55%, #60a5fa 100%)',
                    }}
                  />
                </motion.div>

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
            <motion.div
              className="absolute left-1/2 top-[44vh] z-20"
              style={{
                transform: vaultTransform,
                opacity: vaultOpacity,
              }}
            >
              <div className="relative">

                {/* ── Z-X floor platform — visible from start of freefall ───────── *
                 *  The "landing zone". An isometric platform the Zorb falls onto,    *
                 *  giving the vault a grounded 3D presence before the seal closes.   */}
                <motion.div
                  className="pointer-events-none absolute"
                  style={{
                    bottom: -30,
                    left: -32,
                    right: -32,
                    height: 38,
                    opacity: vaultTrayOp,
                  }}
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 172 38"
                    width="100%"
                    height="38"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <linearGradient id={`${uid}-floor-face`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(30,60,160,0.55)" />
                        <stop offset="100%" stopColor="rgba(4,12,40,0.80)" />
                      </linearGradient>
                    </defs>
                    {/* Foreshortened top surface — the Z-X plane */}
                    <rect x="0" y="0" width="172" height="6" fill="rgba(14,32,90,0.70)" />
                    {/* Front lip — brightest edge, closest to viewer */}
                    <line x1="0" y1="6" x2="172" y2="6" stroke="rgba(130,185,255,0.55)" strokeWidth="1.4" />
                    {/* Front face of platform */}
                    <rect x="0" y="6" width="172" height="20" fill={`url(#${uid}-floor-face)`} />
                    {/* Subtle vertical grid lines for depth */}
                    <line x1="43" y1="6" x2="43" y2="26" stroke="rgba(80,130,200,0.10)" strokeWidth="0.8" />
                    <line x1="86" y1="6" x2="86" y2="26" stroke="rgba(80,130,200,0.10)" strokeWidth="0.8" />
                    <line x1="129" y1="6" x2="129" y2="26" stroke="rgba(80,130,200,0.10)" strokeWidth="0.8" />
                    {/* Bottom edge */}
                    <line x1="0" y1="26" x2="172" y2="26" stroke="rgba(50,90,170,0.28)" strokeWidth="1" />
                    {/* Corner perspective tabs */}
                    <line x1="0" y1="6" x2="7" y2="0" stroke="rgba(110,170,255,0.40)" strokeWidth="1" />
                    <line x1="172" y1="6" x2="165" y2="0" stroke="rgba(110,170,255,0.40)" strokeWidth="1" />
                    {/* Shadow cast below platform */}
                    <ellipse cx="86" cy="33" rx="72" ry="4.5" fill="rgba(0,8,40,0.38)" />
                  </svg>
                </motion.div>


                {/* ── X-Z vault seal — snaps to horizontal plane on capture ──────── *
                 *  A flat foreshortened grid lying in depth beneath the Zorb,        *
                 *  making the vault a floor platform rather than a bounding box.     */}
                <motion.div
                  className="pointer-events-none absolute"
                  style={{
                    bottom: -40,
                    left: -66,
                    right: -66,
                    height: 80,
                    opacity: vaultLidOp,
                  }}
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 244 80" width="100%" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id={`${uid}-xz-fill`} x1="0.5" y1="0" x2="0.5" y2="1">
                        <stop offset="0%" stopColor="rgba(80,130,255,0.06)" />
                        <stop offset="100%" stopColor="rgba(20,55,180,0.22)" />
                      </linearGradient>
                    </defs>
                    {/* Perspective trapezoid — X-Z plane viewed from ~12° above */}
                    <polygon points="28,8 216,8 244,72 0,72" fill={`url(#${uid}-xz-fill)`} />
                    {/* Near edge — brightest (closest to viewer) */}
                    <line x1="0" y1="72" x2="244" y2="72" stroke="rgba(160,205,255,0.68)" strokeWidth="1.6" />
                    {/* Far edge — dimmer */}
                    <line x1="28" y1="8" x2="216" y2="8" stroke="rgba(100,148,255,0.30)" strokeWidth="0.9" />
                    {/* Side edges */}
                    <line x1="28" y1="8" x2="0" y2="72" stroke="rgba(130,178,255,0.36)" strokeWidth="0.9" />
                    <line x1="216" y1="8" x2="244" y2="72" stroke="rgba(130,178,255,0.36)" strokeWidth="0.9" />
                    {/* Horizontal grid lines */}
                    <line x1="10" y1="32" x2="234" y2="32" stroke="rgba(80,130,200,0.11)" strokeWidth="0.7" />
                    <line x1="18" y1="52" x2="226" y2="52" stroke="rgba(80,130,200,0.11)" strokeWidth="0.7" />
                    {/* Depth grid lines (slightly angled) */}
                    <line x1="84" y1="8" x2="72" y2="72" stroke="rgba(80,130,200,0.09)" strokeWidth="0.7" />
                    <line x1="122" y1="8" x2="122" y2="72" stroke="rgba(80,130,200,0.09)" strokeWidth="0.7" />
                    <line x1="160" y1="8" x2="172" y2="72" stroke="rgba(80,130,200,0.09)" strokeWidth="0.7" />
                    {/* Corner brackets — foreshortened for X-Z plane */}
                    <polyline points="28,20 28,8 42,8"   stroke="rgba(190,220,255,0.56)" strokeWidth="1.4" fill="none" />
                    <polyline points="202,8 216,8 216,20" stroke="rgba(190,220,255,0.56)" strokeWidth="1.4" fill="none" />
                    <polyline points="0,60 0,72 16,72"   stroke="rgba(190,220,255,0.56)" strokeWidth="1.4" fill="none" />
                    <polyline points="228,72 244,72 244,60" stroke="rgba(190,220,255,0.56)" strokeWidth="1.4" fill="none" />
                    {/* Centre focal crosshair */}
                    <circle cx="122" cy="40" r="2.8" fill="none" stroke="rgba(155,198,255,0.40)" strokeWidth="0.8" />
                    <line x1="114" y1="40" x2="130" y2="40" stroke="rgba(155,198,255,0.28)" strokeWidth="0.7" />
                    <line x1="122" y1="32" x2="122" y2="48" stroke="rgba(155,198,255,0.28)" strokeWidth="0.7" />
                    {/* Ground glow cast below near edge */}
                    <ellipse cx="122" cy="75" rx="100" ry="5.5" fill="rgba(70,120,255,0.16)" />
                  </svg>
                </motion.div>

                {/* Ambient blue glow — elliptical to suggest the horizontal plane */}
                <motion.div
                  className="pointer-events-none absolute"
                  style={{
                    bottom: -50,
                    left: -80,
                    right: -80,
                    height: 80,
                    borderRadius: '50%',
                    opacity: vaultGlow,
                    background: 'radial-gradient(ellipse 100% 60% at 50% 80%, rgba(0,82,255,0.18) 0%, transparent 70%)',
                    boxShadow: '0 14px 60px 20px rgba(0,82,255,0.28)',
                  }}
                  aria-hidden="true"
                />

                {/* ── Coin entry glow ─────────────────────────────────────────────
                 *  Fires when deposit fill hits 100% — the creator coin has locked
                 *  into the vault. Orange-core → deep blue halo: the raw creator
                 *  energy is transmuted into vault share energy.
                 *  Sustains through all of stage 3 to show the vault is "live". */}
                <motion.div
                  className="pointer-events-none absolute"
                  style={{
                    inset: -56,
                    borderRadius: '50%',
                    opacity: coinEntryGlow,
                    background: 'radial-gradient(circle at 50% 52%, rgba(255,110,20,0.13) 0%, rgba(0,82,255,0.20) 44%, transparent 72%)',
                    boxShadow: [
                      '0 0 0 1px rgba(249,115,22,0.18)',
                      '0 0 24px 7px rgba(249,115,22,0.32)',
                      '0 0 60px 20px rgba(0,82,255,0.24)',
                      '0 0 130px 50px rgba(0,82,255,0.10)',
                    ].join(', '),
                  }}
                  aria-hidden="true"
                />

                {/* Platform near-edge flare — vault seal "seals" with a bright rim */}
                <motion.div
                  className="pointer-events-none absolute"
                  style={{
                    bottom: -46,
                    left: -72,
                    right: -72,
                    height: 4,
                    borderRadius: 2,
                    opacity: coinEntryFlare,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(249,115,22,0.60) 25%, rgba(160,180,255,0.90) 50%, rgba(249,115,22,0.60) 75%, transparent 100%)',
                    boxShadow: [
                      '0 0 0 1px rgba(200,220,255,0.55)',
                      '0 0 12px 4px rgba(200,220,255,0.40)',
                      '0 0 36px 12px rgba(0,82,255,0.24)',
                      '0 0 80px 28px rgba(249,115,22,0.14)',
                    ].join(', '),
                  }}
                  aria-hidden="true"
                />

                <ZorbViewer size={108} />
              </div>
            </motion.div>

            {/* Distribution fan chart — same visual language as the deploy section */}
            <motion.div
              className="pointer-events-none absolute inset-x-0 top-[55vh] z-30 px-4 sm:px-10 lg:px-14"
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
                <div className="mt-8 grid w-full grid-cols-3 gap-2 sm:gap-3 lg:gap-5">
                  {SHARE_DISTRIBUTION_ROWS.map((row, i) => {
                    const ops = [node0Op, node1Op, node2Op]
                    const ys = [dist0CardY, dist1CardY, dist2CardY]
                    const glows = [nodeGlow0, nodeGlow1, nodeGlow2]
                    return (
                      <motion.div
                        key={row.title}
                        className="relative flex flex-col overflow-hidden rounded-[14px] p-2.5 sm:rounded-[18px] sm:p-4 lg:p-5"
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
                          {row.amount}{' '}
                          <span style={{ color: 'rgba(100,160,255,0.55)' }}>■AKITA</span>
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

            {/* Share node — ■AKITA shares pill, visible during mint + distribution phases */}
            <motion.div
              className="absolute left-1/2 top-[30vh] z-30 flex flex-col items-center"
              style={{ transform: shareTransform, opacity: shareOpacity }}
            >
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
              {/* Stem to distribution fan */}
              <div
                className="mt-1 w-px"
                style={{ height: 18, background: 'linear-gradient(to bottom, rgba(100,160,255,0.40), rgba(100,160,255,0.06))' }}
                aria-hidden="true"
              />
              <div className="h-1 w-1 rounded-full" style={{ background: 'rgba(100,160,255,0.35)' }} aria-hidden="true" />
            </motion.div>


            {/* Deploy chamber */}
            <motion.section
              className="absolute inset-x-0 top-[50vh] z-10 px-4 sm:px-10 lg:px-14"
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
                    {cameoIcons['akita'] ? (
                      <img src={cameoIcons['akita']} alt="AKITA" className="h-4 w-4 rounded-full object-cover opacity-80" />
                    ) : (
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[5px] font-black text-white" style={{ background: '#f97316' }}>AK</span>
                    )}
                    {depositTokens}&nbsp;
                    <span className="font-medium text-zinc-500">■AKITA</span>
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

                <div className="mt-10 grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:gap-5">
                  {STRATEGY_CARDS.map((card, i) => (
                    <motion.div
                      key={card.label}
                      className="relative flex flex-col overflow-hidden rounded-[14px] p-2.5 sm:rounded-[18px] sm:p-4 lg:p-5"
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
