import { memo } from 'react'
import { motion, useTransform, type MotionValue } from 'framer-motion'

export const CAPTURE_PROGRESS_RANGE: [number, number] = [0.08, 0.34]

const CAPTURE_PHASE_WINDOWS: Record<'approach' | 'contact' | 'contain' | 'settle', [number, number]> = {
  approach: [0, 0.30],
  contact: [0.30, 0.62],
  contain: [0.62, 0.84],
  settle: [0.84, 1],
}

const ORB_CAPTURE_PROGRESS_POINTS: [number, number, number, number, number] = [0, 0.35, 0.48, 0.74, 1]
const ORB_CAPTURE_Y_POINTS: [number, number, number, number, number] = [-220, -60, -20, 0, 0]

type VaultCaptureSystemProps = {
  uid: string
  vaultTransform: MotionValue<string>
  vaultOpacity: MotionValue<number>
  captureProgress: MotionValue<number>
  coinEntryGlow: MotionValue<number>
  prefersReducedMotion: boolean
}

const VaultInteriorFill = memo(function VaultInteriorFill({
  uid,
  containP,
}: {
  uid: string
  containP: MotionValue<number>
}) {
  const opacity = useTransform(containP, [0, 0.45, 1], [0, 0.12, 0.18])
  const interiorFillId = `${uid}-vault-interior-fill`
  const interiorBloomId = `${uid}-vault-interior-bloom`

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{ left: -66, right: -66, bottom: -20, height: 310, opacity }}
      data-testid="vault-interior-fill"
      aria-hidden="true"
    >
      <svg viewBox="0 0 244 310" width="100%" height="310" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={interiorFillId} x1="122" y1="28" x2="122" y2="302" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="42%" stopColor="rgba(90,140,255,0.06)" />
            <stop offset="100%" stopColor="rgba(30,60,140,0.12)" />
          </linearGradient>
          <radialGradient id={interiorBloomId} cx="50%" cy="38%" r="60%">
            <stop offset="0%" stopColor="rgba(90,140,255,0.10)" />
            <stop offset="100%" stopColor="rgba(90,140,255,0)" />
          </radialGradient>
        </defs>
        <polygon points="0,28 244,28 244,302 0,302" fill={`url(#${interiorFillId})`} />
        <polygon points="0,28 244,28 244,302 0,302" fill={`url(#${interiorBloomId})`} />
      </svg>
    </motion.div>
  )
})

const VaultWireframe = memo(function VaultWireframe({
  uid,
  approachP,
  contactP,
  containP,
  prefersReducedMotion,
}: {
  uid: string
  approachP: MotionValue<number>
  contactP: MotionValue<number>
  containP: MotionValue<number>
  prefersReducedMotion: boolean
}) {
  const postsPath = useTransform(approachP, [0, 0.8], [0, 1])
  const topPath = useTransform(approachP, [0.6, 1], [0, 1])
  const wallOpacity = useTransform(approachP, [0, 0.2, 1], [0, 1, 1])
  const sealOpacity = useTransform(containP, [0, 0.4, 1], [0, 1, 1])
  const reducedScale = useTransform(contactP, [0, 1], [1, 1])
  const animatedScale = useTransform(contactP, [0, 0.5, 1], [1, 0.985, 1])
  const scale = prefersReducedMotion ? reducedScale : animatedScale
  const frontStroke = useTransform(
    contactP,
    [0, 1],
    prefersReducedMotion ? [0.82, 0.9] : [0.82, 1.18],
  )
  const backStroke = useTransform(
    contactP,
    [0, 1],
    prefersReducedMotion ? [0.22, 0.28] : [0.17, 0.4],
  )
  const frontGlowOpacity = useTransform(
    contactP,
    [0, 0.3, 1],
    prefersReducedMotion ? [0.14, 0.24, 0.16] : [0.22, 0.92, 0.35],
  )
  const reducedEdgeFlashOpacity = useTransform(contactP, [0, 1], [0, 0])
  const animatedEdgeFlashOpacity = useTransform(contactP, [0, 0.20, 1], [0, 1.25, 0.45])
  const edgeFlashOpacity = prefersReducedMotion ? reducedEdgeFlashOpacity : animatedEdgeFlashOpacity

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{ left: '50%', top: '44vh', transform: 'translateX(-50%)', scale }}
      data-testid="vault-wireframe"
      aria-hidden="true"
    >
      <div className="relative">
        {/* Floor / seal plate */}
        <motion.div
          className="absolute"
          style={{ bottom: -20, left: -66, right: -66, height: 80, opacity: sealOpacity }}
          data-testid="vault-containment-seal"
        >
          <svg viewBox="0 0 244 80" width="100%" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={`${uid}-floor-fill`} x1="122" y1="8" x2="122" y2="72" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="rgba(60,110,255,0.05)" />
                <stop offset="100%" stopColor="rgba(20,50,180,0.20)" />
              </linearGradient>
            </defs>
            <polygon points="28,8 216,8 244,72 0,72" fill={`url(#${uid}-floor-fill)`} />
            <line x1="0" y1="72" x2="244" y2="72" stroke="rgba(160,205,255,0.62)" strokeWidth="1.5" />
            <line x1="28" y1="8" x2="216" y2="8" stroke="rgba(100,148,255,0.28)" strokeWidth="0.8" />
            <line x1="0" y1="72" x2="28" y2="8" stroke="rgba(120,168,255,0.32)" strokeWidth="0.8" />
            <line x1="244" y1="72" x2="216" y2="8" stroke="rgba(120,168,255,0.32)" strokeWidth="0.8" />
            <polyline points="0,60 0,72 16,72" stroke="rgba(185,218,255,0.55)" strokeWidth="1.3" fill="none" />
            <polyline points="228,72 244,72 244,60" stroke="rgba(185,218,255,0.55)" strokeWidth="1.3" fill="none" />
            <polyline points="28,0 28,8 42,8" stroke="rgba(185,218,255,0.45)" strokeWidth="1.1" fill="none" />
            <polyline points="202,8 216,8 216,0" stroke="rgba(185,218,255,0.45)" strokeWidth="1.1" fill="none" />
            <circle cx="122" cy="40" r="2.4" fill="none" stroke="rgba(140,188,255,0.35)" strokeWidth="0.7" />
            <ellipse cx="122" cy="74" rx="96" ry="5" fill="rgba(60,110,255,0.14)" />
          </svg>
        </motion.div>

        {/* Walls */}
        <motion.div
          className="absolute"
          style={{ left: -66, right: -66, bottom: -20, height: 310, opacity: wallOpacity }}
        >
          <svg viewBox="0 0 244 310" width="100%" height="310" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id={`${uid}-back-post-blur`} x="-80%" y="-20%" width="260%" height="140%">
                <feGaussianBlur stdDeviation="0.6" />
              </filter>
              <filter id={`${uid}-front-glow`} x="-120%" y="-20%" width="340%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Front posts glow */}
            <motion.path d="M 0 302 L 0 28" stroke="rgba(140,200,255,0.18)" strokeWidth="5" strokeLinecap="round" filter={`url(#${uid}-front-glow)`} style={{ pathLength: postsPath, opacity: frontGlowOpacity }} />
            <motion.path d="M 244 302 L 244 28" stroke="rgba(140,200,255,0.18)" strokeWidth="5" strokeLinecap="round" filter={`url(#${uid}-front-glow)`} style={{ pathLength: postsPath, opacity: frontGlowOpacity }} />

            {/* Front posts sharp */}
            <motion.path d="M 0 302 L 0 28" stroke="rgba(172,218,255,0.90)" strokeWidth="1.5" strokeLinecap="round" style={{ pathLength: postsPath, opacity: frontStroke }} />
            <motion.path d="M 244 302 L 244 28" stroke="rgba(172,218,255,0.90)" strokeWidth="1.5" strokeLinecap="round" style={{ pathLength: postsPath, opacity: frontStroke }} />

            {/* Front posts edge flash */}
            <motion.path d="M 0 302 L 0 28" stroke="rgba(255,255,255,1)" strokeWidth="2.2" strokeLinecap="round" style={{ pathLength: postsPath, opacity: edgeFlashOpacity }} />
            <motion.path d="M 244 302 L 244 28" stroke="rgba(255,255,255,1)" strokeWidth="2.2" strokeLinecap="round" style={{ pathLength: postsPath, opacity: edgeFlashOpacity }} />

            {/* Back posts */}
            <motion.path d="M 28 238 L 28 52" stroke="rgba(86,124,210,0.32)" strokeWidth="0.75" strokeLinecap="round" filter={`url(#${uid}-back-post-blur)`} style={{ pathLength: postsPath, opacity: backStroke }} />
            <motion.path d="M 216 238 L 216 52" stroke="rgba(86,124,210,0.32)" strokeWidth="0.75" strokeLinecap="round" filter={`url(#${uid}-back-post-blur)`} style={{ pathLength: postsPath, opacity: backStroke }} />

            {/* Front top edge glow */}
            <motion.path d="M 0 28 L 244 28" stroke="rgba(160,215,255,0.18)" strokeWidth="5" strokeLinecap="round" filter={`url(#${uid}-front-glow)`} style={{ pathLength: topPath, opacity: frontGlowOpacity }} />

            {/* Front top edge sharp */}
            <motion.path d="M 0 28 L 244 28" stroke="rgba(208,234,255,0.92)" strokeWidth="1.5" strokeLinecap="round" style={{ pathLength: topPath, opacity: frontStroke }} />

            {/* Front top edge flash */}
            <motion.path d="M 0 28 L 244 28" stroke="rgba(255,255,255,1)" strokeWidth="2.2" strokeLinecap="round" style={{ pathLength: topPath, opacity: edgeFlashOpacity }} />

            {/* Back top edge */}
            <motion.path d="M 28 52 L 216 52" stroke="rgba(86,124,210,0.30)" strokeWidth="0.7" strokeLinecap="round" style={{ pathLength: topPath, opacity: backStroke }} />

            {/* Depth diagonals */}
            <motion.path d="M 0 28 L 28 52" stroke="rgba(124,164,245,0.42)" strokeWidth="0.85" strokeLinecap="round" style={{ pathLength: topPath, opacity: 0.6 }} />
            <motion.path d="M 244 28 L 216 52" stroke="rgba(124,164,245,0.42)" strokeWidth="0.85" strokeLinecap="round" style={{ pathLength: topPath, opacity: 0.6 }} />

            {/* Corner brackets */}
            <motion.polyline points="0,28 18,28" stroke="rgba(220,244,255,0.88)" strokeWidth="2.0" fill="none" style={{ opacity: topPath }} />
            <motion.polyline points="0,28 0,48" stroke="rgba(220,244,255,0.88)" strokeWidth="2.0" fill="none" style={{ opacity: topPath }} />
            <motion.polyline points="226,28 244,28" stroke="rgba(220,244,255,0.88)" strokeWidth="2.0" fill="none" style={{ opacity: topPath }} />
            <motion.polyline points="244,28 244,48" stroke="rgba(220,244,255,0.88)" strokeWidth="2.0" fill="none" style={{ opacity: topPath }} />
          </svg>
        </motion.div>

        <div className="h-24 w-24" aria-hidden="true" />
      </div>
    </motion.div>
  )
})

const ThresholdPlane = memo(function ThresholdPlane({
  contactP,
  prefersReducedMotion,
}: {
  contactP: MotionValue<number>
  prefersReducedMotion: boolean
}) {
  const opacity = useTransform(
    contactP,
    [0, 0.08, 0.42, 0.78, 1],
    prefersReducedMotion ? [0, 0.16, 0.22, 0.12, 0] : [0, 0.32, 1, 0.55, 0],
  )
  const reducedScaleX = useTransform(contactP, [0, 1], [1, 1])
  const animatedScaleX = useTransform(contactP, [0, 1], [0.86, 1.18])
  const scaleX = prefersReducedMotion ? reducedScaleX : animatedScaleX
  const reducedScaleY = useTransform(contactP, [0, 1], [1, 1])
  const animatedScaleY = useTransform(contactP, [0, 1], [0.92, 1.06])
  const scaleY = prefersReducedMotion ? reducedScaleY : animatedScaleY

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[44vh] z-[22]"
      style={{ x: '-50%', y: 42, opacity, scaleX, scaleY }}
      data-testid="vault-threshold-plane"
      aria-hidden="true"
    >
      <svg viewBox="0 0 180 20" width="180" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="90" cy="10" rx="68" ry="7" stroke="rgba(184,228,255,0.95)" strokeWidth="1.5" fill="rgba(110,170,255,0.16)" />
        <ellipse cx="90" cy="10" rx="48" ry="4.8" stroke="rgba(255,255,255,0.65)" strokeWidth="1.0" fill="none" />
        <ellipse cx="90" cy="10" rx="80" ry="8.6" stroke="rgba(126,192,255,0.38)" strokeWidth="0.9" fill="none" />
      </svg>
    </motion.div>
  )
})

const EntryRipple = memo(function EntryRipple({
  contactP,
  prefersReducedMotion,
}: {
  contactP: MotionValue<number>
  prefersReducedMotion: boolean
}) {
  const scale = useTransform(contactP, [0, 1], [0.12, 2.0])
  const opacity = useTransform(contactP, [0, 0.10, 0.58, 1], [0, 0.95, 0.45, 0])
  const secondaryScale = useTransform(contactP, [0, 1], [0.2, 1.65])
  const secondaryOpacity = useTransform(contactP, [0, 0.38, 0.86, 1], [0, 0, 0.5, 0])
  if (prefersReducedMotion) return null

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[44vh] z-[23]"
      style={{ x: '-50%', y: 42, scale, opacity }}
      data-testid="vault-entry-ripple"
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 36" width="200" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="100" cy="18" rx="74" ry="10.5" stroke="rgba(148,210,255,0.95)" strokeWidth="1.4" fill="none" />
        <motion.ellipse
          cx="100"
          cy="18"
          rx="60"
          ry="8"
          stroke="rgba(110,184,255,0.70)"
          strokeWidth="1.0"
          fill="none"
          style={{ scale: secondaryScale, opacity: secondaryOpacity }}
        />
      </svg>
    </motion.div>
  )
})

const EnergyTransferGlow = memo(function EnergyTransferGlow({
  captureProgress,
  contactP,
  coinEntryGlow,
  prefersReducedMotion,
}: {
  captureProgress: MotionValue<number>
  contactP: MotionValue<number>
  coinEntryGlow: MotionValue<number>
  prefersReducedMotion: boolean
}) {
  const orbY = useTransform(captureProgress, ORB_CAPTURE_PROGRESS_POINTS, ORB_CAPTURE_Y_POINTS)
  const orbOuterGlowY = useTransform(orbY, (value: number) => value + 25)
  const orbOuterGlow = useTransform(
    captureProgress,
    [0, 0.4, 0.65, 1],
    prefersReducedMotion ? [0.62, 0.72, 0.32, 0.1] : [1.05, 1.42, 0.55, 0.14],
  )
  const vaultInnerGlowBase = useTransform(captureProgress, [0.35, 0.5, 0.8, 1], [0, 0.9, 0.55, 0.25])
  const reducedEdgeFlash = useTransform(contactP, [0, 1], [0, 0])
  const animatedEdgeFlash = useTransform(contactP, [0, 0.16, 1], [0, 1.4, 0.42])
  const edgeFlash = prefersReducedMotion ? reducedEdgeFlash : animatedEdgeFlash
  const vaultInnerGlow = useTransform([vaultInnerGlowBase, coinEntryGlow], ([base, mint]) =>
    Math.max(base as number, (mint as number) * 0.55),
  )

  return (
    <>
      {/* Orb outer glow */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[44vh] z-[24]"
        style={{
          x: '-50%',
          y: orbOuterGlowY,
          opacity: orbOuterGlow,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'transparent',
          boxShadow: prefersReducedMotion
            ? '0 0 20px 8px rgba(0,82,255,0.36)'
            : [
                '0 0 36px 14px rgba(0,82,255,0.75)',
                '0 0 82px 34px rgba(0,82,255,0.38)',
                '0 0 156px 62px rgba(0,82,255,0.16)',
              ].join(', '),
        }}
        data-testid="vault-energy-transfer"
        aria-hidden="true"
      />
      {/* Vault inner glow */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[44vh] z-[19]"
        style={{
          x: '-50%',
          y: -36,
          opacity: vaultInnerGlow,
          width: 220,
          height: 220,
          borderRadius: 20,
          background:
            'radial-gradient(circle at 50% 42%, rgba(90,140,255,0.22) 0%, rgba(90,140,255,0.08) 42%, transparent 72%)',
          filter: 'blur(18px)',
        }}
        aria-hidden="true"
      />
      {/* Contact flash along top/front edge */}
      {!prefersReducedMotion ? (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-[44vh] z-[25]"
          style={{
            x: '-50%',
            y: -94,
            opacity: edgeFlash,
            width: 244,
            height: 14,
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 50%, rgba(255,255,255,0) 100%)',
            filter: 'blur(3.5px)',
          }}
          data-testid="vault-contact-flash"
          aria-hidden="true"
        />
      ) : null}
    </>
  )
})

const Orb = memo(function Orb({
  captureProgress,
  contactP,
  prefersReducedMotion,
}: {
  captureProgress: MotionValue<number>
  contactP: MotionValue<number>
  prefersReducedMotion: boolean
}) {
  const y = useTransform(captureProgress, ORB_CAPTURE_PROGRESS_POINTS, ORB_CAPTURE_Y_POINTS)
  const reducedScaleX = useTransform(contactP, [0, 1], [1, 1])
  const animatedScaleX = useTransform(contactP, [0, 0.5, 1], [1, 1.08, 1])
  const scaleX = prefersReducedMotion ? reducedScaleX : animatedScaleX
  const reducedScaleY = useTransform(contactP, [0, 1], [1, 1])
  const animatedScaleY = useTransform(contactP, [0, 0.5, 1], [1, 0.9, 1])
  const scaleY = prefersReducedMotion ? reducedScaleY : animatedScaleY
  const coreOpacity = useTransform(captureProgress, [0, 0.74, 1], [1, 0.95, 0.8])
  const reducedHighlightX = useTransform(captureProgress, [0, 1], [0, 0])
  const animatedHighlightX = useTransform(captureProgress, [0, 0.35], [-6, 4])
  const highlightX = prefersReducedMotion ? reducedHighlightX : animatedHighlightX

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[44vh] z-[26]"
      style={{
        x: '-50%',
        y,
        scaleX,
        scaleY,
        width: 210,
        height: 232,
        maskImage: 'linear-gradient(to bottom, black 72%, transparent 97%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 72%, transparent 97%)',
      }}
      data-testid="vault-orb"
      aria-hidden="true"
    >
      <motion.div
        className="absolute"
        style={{
          left: 0,
          top: 2,
          width: 210,
          height: 210,
          borderRadius: '50%',
          opacity: coreOpacity,
          background: [
            'radial-gradient(circle at 50% 50%, rgba(6,14,46,0.94) 0%, rgba(3,7,28,0.98) 100%)',
            'radial-gradient(circle at 33% 25%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.06) 20%, transparent 38%)',
            'radial-gradient(circle at 42% 38%, rgba(160,210,255,0.11) 0%, transparent 52%)',
            'radial-gradient(circle at 50% 74%, rgba(0,0,20,0.55) 0%, transparent 56%)',
            'radial-gradient(circle at 50% 50%, transparent 56%, rgba(0,8,38,0.22) 80%, rgba(0,4,22,0.34) 100%)',
          ].join(', '),
          boxShadow: [
            'inset 0 0 0 0.5px rgba(140,190,255,0.18)',
            'inset 0 0 48px 8px rgba(18,55,200,0.07)',
            'inset 0 -28px 44px -20px rgba(0,0,48,0.18)',
          ].join(', '),
        }}
      />
      {/* Rim ring */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 2,
          width: 210,
          height: 210,
          borderRadius: '50%',
          border: '1px solid rgba(160,205,255,0.14)',
        }}
      />
      {/* Specular drift */}
      <motion.div
        className="absolute"
        style={{
          left: 0,
          top: 12,
          width: 120,
          height: 68,
          borderRadius: '50%',
          x: highlightX,
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.10) 0%, transparent 72%)',
          filter: 'blur(8px)',
        }}
      />
      {/* Breathing pulse */}
      {!prefersReducedMotion ? (
        <motion.div
          className="absolute"
          style={{
            left: 18,
            top: 20,
            width: 174,
            height: 174,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 48%, rgba(60,120,255,0.09) 0%, transparent 68%)',
          }}
          animate={{ opacity: [0.4, 0.85, 0.4] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}
    </motion.div>
  )
})

const DivePortal = memo(function DivePortal({
  settleP,
  prefersReducedMotion,
}: {
  settleP: MotionValue<number>
  prefersReducedMotion: boolean
}) {
  const opacity = useTransform(
    settleP,
    [0, 0.5, 1],
    prefersReducedMotion ? [0, 0.18, 0.28] : [0, 0.45, 0.9],
  )
  const scale = useTransform(
    settleP,
    [0, 1],
    prefersReducedMotion ? [1, 1.15] : [1, 1.8],
  )

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[44vh] z-[21]"
      style={{
        x: '-50%',
        y: -62,
        opacity,
        scale,
        width: 180,
        height: 180,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 50%, rgba(120,160,255,0.28) 0%, transparent 70%)',
        filter: 'blur(20px)',
      }}
      aria-hidden="true"
    />
  )
})

export const VaultCaptureSystem = memo(function VaultCaptureSystem({
  uid,
  vaultTransform,
  vaultOpacity,
  captureProgress,
  coinEntryGlow,
  prefersReducedMotion,
}: VaultCaptureSystemProps) {
  const approachP = useTransform(captureProgress, CAPTURE_PHASE_WINDOWS.approach, [0, 1], { clamp: true })
  const contactP = useTransform(captureProgress, CAPTURE_PHASE_WINDOWS.contact, [0, 1], { clamp: true })
  const containP = useTransform(captureProgress, CAPTURE_PHASE_WINDOWS.contain, [0, 1], { clamp: true })
  const settleP = useTransform(captureProgress, CAPTURE_PHASE_WINDOWS.settle, [0, 1], { clamp: true })

  return (
    <motion.div
      className="absolute left-1/2 top-[44vh] z-20"
      style={{ transform: vaultTransform, opacity: vaultOpacity }}
      aria-hidden="true"
    >
      <div className="relative">
        <VaultInteriorFill uid={uid} containP={containP} />
        <DivePortal settleP={settleP} prefersReducedMotion={prefersReducedMotion} />
        <VaultWireframe
          uid={uid}
          approachP={approachP}
          contactP={contactP}
          containP={containP}
          prefersReducedMotion={prefersReducedMotion}
        />
        <ThresholdPlane contactP={contactP} prefersReducedMotion={prefersReducedMotion} />
        <EntryRipple contactP={contactP} prefersReducedMotion={prefersReducedMotion} />
        <EnergyTransferGlow
          captureProgress={captureProgress}
          contactP={contactP}
          coinEntryGlow={coinEntryGlow}
          prefersReducedMotion={prefersReducedMotion}
        />
        <Orb
          captureProgress={captureProgress}
          contactP={contactP}
          prefersReducedMotion={prefersReducedMotion}
        />
        <div className="h-24 w-24" aria-hidden="true" />
      </div>
    </motion.div>
  )
})
