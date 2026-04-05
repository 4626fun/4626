import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'

import {
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
} from './vault-flow/model/storySelectors'
import { DesktopDistributionHandoffScene } from './vault-flow/scenes/DesktopDistributionHandoffScene'
import { DesktopDeployStrategiesScene } from './vault-flow/scenes/DesktopDeployStrategiesScene'
import { DesktopEarningTogetherScene } from './vault-flow/scenes/DesktopEarningTogetherScene'
import { CreatorIntroScene } from './vault-flow/scenes/CreatorIntroScene'
import { TokenDepositScene } from './vault-flow/scenes/TokenDepositScene'
import { CAPTURE_PROGRESS_RANGE, VaultCaptureSystem } from './vault-flow/VaultCaptureSystem'

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


// Precomputed star-field: 42 hand-placed white dots over a 900×600 tile.
// Used as a background-image so it repeats seamlessly and costs zero JS.
const STAR_FIELD_BG = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><circle cx="42" cy="38" r="0.9" fill="white" opacity="0.7"/><circle cx="247" cy="89" r="0.55" fill="white" opacity="0.5"/><circle cx="612" cy="23" r="1.0" fill="white" opacity="0.72"/><circle cx="754" cy="156" r="0.65" fill="white" opacity="0.62"/><circle cx="125" cy="234" r="0.45" fill="white" opacity="0.45"/><circle cx="389" cy="178" r="0.75" fill="white" opacity="0.65"/><circle cx="528" cy="312" r="0.55" fill="white" opacity="0.5"/><circle cx="837" cy="89" r="0.85" fill="white" opacity="0.68"/><circle cx="193" cy="456" r="0.65" fill="white" opacity="0.55"/><circle cx="671" cy="398" r="0.45" fill="white" opacity="0.45"/><circle cx="76" cy="523" r="0.95" fill="white" opacity="0.7"/><circle cx="445" cy="512" r="0.55" fill="white" opacity="0.52"/><circle cx="823" cy="445" r="0.75" fill="white" opacity="0.62"/><circle cx="301" cy="67" r="0.65" fill="white" opacity="0.6"/><circle cx="567" cy="478" r="0.85" fill="white" opacity="0.68"/><circle cx="148" cy="389" r="0.45" fill="white" opacity="0.45"/><circle cx="712" cy="234" r="0.75" fill="white" opacity="0.65"/><circle cx="234" cy="545" r="0.55" fill="white" opacity="0.5"/><circle cx="489" cy="145" r="0.65" fill="white" opacity="0.58"/><circle cx="867" cy="512" r="0.85" fill="white" opacity="0.7"/><circle cx="356" cy="423" r="0.45" fill="white" opacity="0.45"/><circle cx="623" cy="567" r="0.75" fill="white" opacity="0.65"/><circle cx="89" cy="178" r="0.55" fill="white" opacity="0.52"/><circle cx="478" cy="289" r="0.85" fill="white" opacity="0.7"/><circle cx="756" cy="345" r="0.65" fill="white" opacity="0.6"/><circle cx="167" cy="312" r="0.45" fill="white" opacity="0.45"/><circle cx="534" cy="56" r="0.75" fill="white" opacity="0.67"/><circle cx="812" cy="178" r="0.55" fill="white" opacity="0.52"/><circle cx="289" cy="423" r="0.85" fill="white" opacity="0.7"/><circle cx="645" cy="123" r="0.65" fill="white" opacity="0.62"/><circle cx="23" cy="267" r="0.45" fill="white" opacity="0.45"/><circle cx="412" cy="534" r="0.75" fill="white" opacity="0.65"/><circle cx="778" cy="267" r="0.55" fill="white" opacity="0.52"/><circle cx="134" cy="89" r="0.85" fill="white" opacity="0.7"/><circle cx="567" cy="389" r="0.65" fill="white" opacity="0.6"/><circle cx="345" cy="234" r="0.45" fill="white" opacity="0.45"/><circle cx="689" cy="478" r="0.75" fill="white" opacity="0.65"/><circle cx="201" cy="156" r="0.55" fill="white" opacity="0.52"/><circle cx="456" cy="367" r="0.85" fill="white" opacity="0.7"/><circle cx="823" cy="323" r="0.65" fill="white" opacity="0.62"/><circle cx="59" cy="467" r="0.55" fill="white" opacity="0.5"/><circle cx="720" cy="545" r="0.8" fill="white" opacity="0.65"/></svg>')}")`

const smoothstep = (t: number) => t * t * (3 - 2 * t)
const stripShareTokenSymbol = (value: string) => value.replace(SHARE_TOKEN_SYMBOL, '').trim()




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

    const f = hardStopFired.current
    // Checkpoint 1: vault capture locked — wireframe + containment read as sealed by 0.32
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

  // CreatorIntroScene — fades in during creatorEstablishes (0.00–0.14), then exits.
  const creatorIntroOpacity = useTransform(scroll, [0, 0.04, 0.10, 0.14], [0, 1, 1, 0])
  const creatorIntroY = useTransform(scroll, [0, 0.06, 0.14], [18, 0, -10])

  // TokenDepositScene — covers valueFlowsIn + participantDeposits (0.14–0.42).
  const depositSceneOpacity = useTransform(scroll, [0.12, 0.16, 0.38, 0.42], [0, 1, 1, 0])

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
  // Capture progress — shared constant keeps vault timing in sync across modules.
  const captureProgress = useTransform(scroll, CAPTURE_PROGRESS_RANGE, [0, 1], { clamp: true })

  // Coin entry glow — fires when deposit fill completes, sustains through all distributions,
  // fades as the dive begins. Passed into VaultCaptureSystem to sustain vault inner glow post-mint.
  const _coinEntryGlowBase = useTransform(scroll, [0.50, 0.54, 0.74, 0.78], [0, 1, 1, 0])
  const coinEntryGlow = useTransform(_coinEntryGlowBase, v => prefersReducedMotion ? 0 : v)
  // Entry radial bloom: peaks as vault rushes through camera, fully faded before deploy content reads
  const vaultEntry = useTransform(scroll, [0.77, 0.81, 0.85], [0, 1, 0])

  // Distribution path progress — used for remainingMinted counter in the deposit card.
  const _d0Raw = useTransform(scroll, [0.53, 0.60], [0, 1])
  const orbitTrav0 = useTransform(_d0Raw, smoothstep)

  const _d1Raw = useTransform(scroll, [0.60, 0.66], [0, 1])
  const orbitTrav1 = useTransform(_d1Raw, smoothstep)

  const _d2Raw = useTransform(scroll, [0.66, 0.71], [0, 1])
  const orbitTrav2 = useTransform(_d2Raw, smoothstep)

  // Phase 2 corner badge — visible during mint / deposit phase only
  const stage2LabelOp = useTransform(scroll, [0.32, 0.38, 0.52, 0.58], [0, 1, 1, 0])
  // Deposit fill — drives the counter and fill animation in TokenDepositScene
  const depositFillPct = useTransform(scroll, [0.34, 0.46], [0, 1])

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

  // Cube interior POV — very faint depth overlay during the vault-rush
  const cubeOp = useTransform(scroll, [0.80, 0.87, 1.0], [0, 0.18, 0.15])

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

            {/* ── Beat: creatorEstablishes (0.00–0.14) ─────────────────────────
                Creator intro — akita.base.eth establishes identity before tokens
                start flowing. Unmounts once valueFlowsIn begins.               */}
            {isBeat(desktopStoryState, 'creatorEstablishes') && (
              <CreatorIntroScene
                content={STORY_CONTENT}
                cameoIcons={cameoIcons}
                beatProgress={desktopStoryState.beatProgress}
                prefersReducedMotion={prefersReducedMotion}
                opacity={creatorIntroOpacity}
                y={creatorIntroY}
              />
            )}

            {/* ── Beats: valueFlowsIn + participantDeposits (0.14–0.42) ────────
                Three-column literal deposit story: source node → vault fill → share
                reveal. Replaces the abstract HeroBlock + VaultCaptureSystem for
                these beats. Mounts when creatorEstablishes ends and unmounts once
                distributionMeaningful begins.                                    */}
            {(isBeat(desktopStoryState, 'valueFlowsIn') ||
              isBeat(desktopStoryState, 'participantDeposits')) && (
              <TokenDepositScene
                uid={uid}
                content={STORY_CONTENT}
                cameoIcons={cameoIcons}
                captureProgress={captureProgress}
                depositFillPct={depositFillPct}
                depositComplete={depositComplete}
                displayDepositTokens={displayDepositTokens}
                displayShareAmount={displayShareAmount}
                beatProgress={desktopStoryState.beatProgress}
                prefersReducedMotion={prefersReducedMotion}
                sceneOpacity={depositSceneOpacity}
              />
            )}

            {/* ── Vault sphere (cinematic) ──────────────────────────────────────
                VaultCaptureSystem owns the 3-D vault Zorb and the dive camera move.
                It's active during 0.08–0.78 but its internal opacity MotionValues
                handle the right moments. During the deposit beats (0.14–0.42) the
                Zorb is still composited but its opacity is intentionally low — the
                TokenDepositScene's flat vault diagram is the legible element.    */}
            <VaultCaptureSystem
              uid={uid}
              vaultTransform={vaultTransform}
              vaultOpacity={vaultOpacity}
              captureProgress={captureProgress}
              coinEntryGlow={coinEntryGlow}
              prefersReducedMotion={prefersReducedMotion}
            />


            {/* Distribution handoff — semantic scene, always active */}
            <DesktopDistributionHandoffScene
              state={desktopStoryState}
              content={STORY_CONTENT}
              uid={uid}
              orbitTrav0={orbitTrav0}
              orbitTrav1={orbitTrav1}
              orbitTrav2={orbitTrav2}
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

          {/* Cube interior POV — very faint perspective depth cue, you're inside the vault */}
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
