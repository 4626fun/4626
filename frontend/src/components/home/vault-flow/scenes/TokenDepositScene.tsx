import { memo, useId } from 'react'
import { motion, useTransform, type MotionValue } from 'framer-motion'

import type { StoryContent } from '../model/storyContent'

// ── Token particle ────────────────────────────────────────────────────────────

const PARTICLE_OFFSETS = [0, 0.18, 0.36, 0.54, 0.72] as const

type TokenParticleProps = {
  pathId: string
  captureProgress: MotionValue<number>
  phaseOffset: number
  avatarSrc: string | null
  prefersReducedMotion: boolean
}

const TokenParticle = memo(function TokenParticle({
  pathId,
  captureProgress,
  phaseOffset,
  avatarSrc,
  prefersReducedMotion,
}: TokenParticleProps) {
  const adjustedProgress = useTransform(
    captureProgress,
    [phaseOffset, Math.min(phaseOffset + 0.6, 1)],
    [0, 1],
    { clamp: true },
  )
  const offsetDistance = useTransform(adjustedProgress, (v) => `${v * 100}%`)
  const opacity = useTransform(adjustedProgress, [0, 0.08, 0.82, 1], [0, 1, 1, 0])
  const scale = useTransform(adjustedProgress, [0, 0.08, 0.82, 1], [0.5, 1, 0.9, 0.3])

  if (prefersReducedMotion) return null

  return (
    <motion.div
      className="pointer-events-none absolute h-5 w-5"
      style={{
        offsetPath: `url(#${pathId})`,
        offsetDistance,
        opacity,
        scale,
        top: 0,
        left: 0,
      }}
      aria-hidden="true"
    >
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt=""
          className="h-full w-full rounded-full object-cover"
          style={{
            border: '1px solid rgba(249,115,22,0.55)',
            boxShadow: '0 0 8px 3px rgba(249,115,22,0.45)',
          }}
        />
      ) : (
        <div
          className="h-full w-full rounded-full"
          style={{
            background: 'radial-gradient(circle at 38% 35%, rgba(255,200,80,0.95) 0%, rgba(249,115,22,0.85) 60%, rgba(180,60,0,0.75) 100%)',
            border: '1px solid rgba(249,115,22,0.55)',
            boxShadow: '0 0 8px 3px rgba(249,115,22,0.45)',
          }}
        />
      )}
    </motion.div>
  )
})

// ── Vault fill meter ──────────────────────────────────────────────────────────

type VaultFillProps = {
  uid: string
  depositFillPct: MotionValue<number>
  depositComplete: boolean
  prefersReducedMotion: boolean
}

const VaultFill = memo(function VaultFill({
  uid,
  depositFillPct,
  depositComplete,
  prefersReducedMotion,
}: VaultFillProps) {
  const VAULT_H = 160
  const fillY = useTransform(
    depositFillPct,
    [0, 1],
    [VAULT_H, 0],
  )
  const fillHeight = useTransform(depositFillPct, [0, 1], [0, VAULT_H])

  const glowColor = depositComplete
    ? 'rgba(34,197,94,0.95)'
    : 'rgba(100,160,255,0.45)'
  const glowShadow = depositComplete
    ? '0 0 0 1.5px rgba(34,197,94,0.9), 0 0 24px 6px rgba(34,197,94,0.35)'
    : '0 0 0 1px rgba(100,160,255,0.25)'

  return (
    <div
      className="relative"
      style={{
        width: 120,
        height: VAULT_H,
        borderRadius: 14,
        border: `1.5px solid ${glowColor}`,
        boxShadow: glowShadow,
        background: 'rgba(6,8,22,0.92)',
        overflow: 'hidden',
        transition: prefersReducedMotion
          ? 'none'
          : 'border-color 0.7s ease, box-shadow 0.7s ease',
      }}
      data-testid="token-deposit-vault"
    >
      {/* Fill liquid */}
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: fillHeight,
          background: depositComplete
            ? 'linear-gradient(to top, rgba(34,197,94,0.45) 0%, rgba(34,197,94,0.12) 100%)'
            : 'linear-gradient(to top, rgba(60,100,255,0.55) 0%, rgba(60,100,255,0.12) 100%)',
          transition: prefersReducedMotion ? 'none' : 'background 0.7s ease',
        }}
        aria-hidden="true"
      />

      {/* Shimmering fill surface line */}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute left-0 right-0 h-px"
          style={{
            top: fillY,
            background: depositComplete
              ? 'rgba(34,197,94,0.9)'
              : 'rgba(120,170,255,0.7)',
            boxShadow: depositComplete
              ? '0 0 4px 2px rgba(34,197,94,0.5)'
              : '0 0 4px 2px rgba(120,170,255,0.4)',
            transition: 'background 0.7s ease, box-shadow 0.7s ease',
          }}
          aria-hidden="true"
        />
      )}

      {/* Completion pulse overlay */}
      {depositComplete && !prefersReducedMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[12px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.55, 0] }}
          transition={{ duration: 1.4, times: [0, 0.3, 1], ease: 'easeOut' }}
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(34,197,94,0.45) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Grid lines — depth cue */}
      <svg
        className="pointer-events-none absolute inset-0"
        width="120"
        height={VAULT_H}
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${uid}-vault-fill-grad`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="rgba(100,160,255,0.08)" />
            <stop offset="100%" stopColor="rgba(100,160,255,0.02)" />
          </linearGradient>
        </defs>
        <line x1="40" y1="0" x2="40" y2={VAULT_H} stroke="rgba(100,160,255,0.07)" strokeWidth="0.75" />
        <line x1="80" y1="0" x2="80" y2={VAULT_H} stroke="rgba(100,160,255,0.07)" strokeWidth="0.75" />
        <line x1="0" y1="53" x2="120" y2="53" stroke="rgba(100,160,255,0.07)" strokeWidth="0.75" />
        <line x1="0" y1="106" x2="120" y2="106" stroke="rgba(100,160,255,0.07)" strokeWidth="0.75" />
        {/* Corner brackets */}
        <polyline points="0,8 0,0 8,0" stroke="rgba(200,220,255,0.55)" strokeWidth="1.2" fill="none" />
        <polyline points="112,0 120,0 120,8" stroke="rgba(200,220,255,0.55)" strokeWidth="1.2" fill="none" />
        <polyline points="0,152 0,160 8,160" stroke="rgba(200,220,255,0.55)" strokeWidth="1.2" fill="none" />
        <polyline points="112,160 120,160 120,152" stroke="rgba(200,220,255,0.55)" strokeWidth="1.2" fill="none" />
      </svg>
    </div>
  )
})

// ── Deposited counter ─────────────────────────────────────────────────────────

type DepositedCounterProps = {
  depositFillPct: MotionValue<number>
  depositComplete: boolean
  totalAmount: number
}

const DepositedCounter = memo(function DepositedCounter({
  depositFillPct,
  depositComplete,
  totalAmount,
}: DepositedCounterProps) {
  const displayValue = useTransform(depositFillPct, (v) =>
    Math.round(v * totalAmount).toLocaleString(),
  )

  return (
    <div className="flex flex-col items-center gap-0.5" data-testid="deposited-counter">
      <span
        className="font-mono text-[8px] uppercase tracking-[0.24em]"
        style={{ color: 'rgba(255,255,255,0.35)' }}
      >
        Deposited
      </span>
      <motion.span
        className="font-mono font-black leading-none tracking-tight"
        style={{
          fontSize: 'clamp(0.85rem, 2.8vw, 1.1rem)',
          color: depositComplete ? 'rgba(34,197,94,0.95)' : 'rgba(255,255,255,0.92)',
          transition: 'color 0.5s ease',
        }}
      >
        {displayValue}
      </motion.span>
    </div>
  )
})

// ── Share token reveal ────────────────────────────────────────────────────────

type ShareRevealProps = {
  content: StoryContent
  depositComplete: boolean
  displayShareAmount: string
  prefersReducedMotion: boolean
}

const ShareReveal = memo(function ShareReveal({
  content,
  depositComplete,
  displayShareAmount,
  prefersReducedMotion,
}: ShareRevealProps) {
  return (
    <motion.div
      className="flex flex-col gap-3"
      initial={false}
      animate={{
        opacity: depositComplete ? 1 : 0,
        x: depositComplete ? 0 : prefersReducedMotion ? 0 : 18,
      }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
      data-testid="share-token-reveal"
      aria-label="Minted share tokens"
    >
      {/* Share token badge + amount */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full"
            style={{ border: '1px solid rgba(100,160,255,0.45)' }}
          >
            <img
              src={content.shareTokenBadgeSrc}
              alt="AKITA share token"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </span>
          <span
            className="font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: 'rgba(100,160,255,0.75)' }}
          >
            {content.shareTokenSymbol} minted
          </span>
        </div>
        <div
          className="font-mono font-black leading-none tracking-tight"
          style={{
            fontSize: 'clamp(1rem, 3.2vw, 1.3rem)',
            color: 'rgba(120,175,255,1)',
          }}
        >
          {displayShareAmount}
        </div>
        <span
          className="font-mono text-[7px] uppercase tracking-[0.14em]"
          style={{ color: 'rgba(34,197,94,0.75)' }}
        >
          vault shares live ✓
        </span>
      </div>

      {/* Routing note */}
      <div
        className="rounded-xl p-2.5"
        style={{
          background: 'rgba(100,160,255,0.05)',
          border: '1px solid rgba(100,160,255,0.12)',
        }}
      >
        <p
          className="mb-1.5 font-mono text-[7px] uppercase tracking-[0.18em]"
          style={{ color: 'rgba(100,160,255,0.55)' }}
        >
          Initial deposit routing
        </p>
        <p
          className="mb-2 font-mono text-[7px] leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          Normally goes to depositor. For this initial deposit, shares are deployed to:
        </p>
        <div className="flex flex-col gap-1.5">
          {content.distribution.map((dest) => (
            <div key={dest.title} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {dest.icon ? (
                  <img
                    src={dest.icon}
                    alt={dest.title}
                    className="h-3 w-3 opacity-70"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="h-3 w-3 rounded-sm"
                    style={{ background: 'rgba(100,160,255,0.25)' }}
                  />
                )}
                <span
                  className="font-mono text-[7px] tracking-[0.10em]"
                  style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  {dest.title}
                </span>
              </div>
              <span
                className="font-mono text-[7px] font-bold"
                style={{ color: 'rgba(100,160,255,0.75)' }}
              >
                {dest.percent}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
})

// ── Main scene ────────────────────────────────────────────────────────────────

type Props = {
  uid: string
  content: StoryContent
  cameoIcons: Record<string, string>
  captureProgress: MotionValue<number>
  depositFillPct: MotionValue<number>
  depositComplete: boolean
  displayDepositTokens: string
  displayShareAmount: string
  beatProgress: number
  prefersReducedMotion: boolean
  sceneOpacity: MotionValue<number>
}

const TOTAL_DEPOSIT = 50_000_000

export const TokenDepositScene = memo(function TokenDepositScene({
  uid,
  content,
  cameoIcons,
  captureProgress,
  depositFillPct,
  depositComplete,
  displayShareAmount,
  prefersReducedMotion,
  sceneOpacity,
}: Props) {
  const particlePathId = `${uid}-token-flow-path`
  const avatarSrc = cameoIcons['akita'] ?? null

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[20vh] z-30 w-full max-w-2xl -translate-x-1/2 px-4"
      style={{ opacity: sceneOpacity }}
      data-testid="token-deposit-scene"
    >
      {/* Hidden SVG path used for CSS motion-path particles */}
      <svg
        className="pointer-events-none absolute left-0 top-0 overflow-visible"
        width="0"
        height="0"
        aria-hidden="true"
      >
        <defs>
          {/* Cubic bezier from left source node to vault mouth — coordinates are
              relative to the scene container; tuned for ~580px wide container */}
          <path
            id={particlePathId}
            d="M 110,88 C 180,40 290,35 340,88"
          />
        </defs>
      </svg>

      {/* Three-column layout */}
      <div className="flex items-center justify-center gap-4 sm:gap-8">

        {/* ── Left: $AKITA source node */}
        <div className="flex flex-col items-center gap-2.5" data-testid="deposit-source-node">
          {/* Avatar */}
          <div
            className="relative flex h-12 w-12 items-center justify-center rounded-full sm:h-14 sm:w-14"
            style={{
              border: '1.5px solid rgba(249,115,22,0.40)',
              background: 'rgba(249,115,22,0.07)',
              boxShadow: '0 0 18px 5px rgba(249,115,22,0.14)',
            }}
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="AKITA token"
                className="h-full w-full rounded-full object-cover"
                loading="lazy"
              />
            ) : (
              <span
                className="font-mono text-[10px] font-black"
                style={{ color: '#f97316' }}
              >
                AK
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span
              className="font-mono text-[8px] font-bold tracking-[0.16em]"
              style={{ color: 'rgba(249,115,22,0.85)' }}
            >
              {content.creatorTokenSymbol}
            </span>
            <span
              className="font-mono text-[7px] tracking-[0.12em]"
              style={{ color: 'rgba(255,255,255,0.32)' }}
            >
              {content.creatorName}
            </span>
            <span
              className="font-mono text-[8px] font-black leading-none tracking-tight"
              style={{ color: 'rgba(249,115,22,0.70)' }}
            >
              50,000,000
            </span>
          </div>
        </div>

        {/* ── Token particles (absolutely positioned over the SVG path) */}
        <div className="relative" style={{ width: 0, height: 0 }}>
          {PARTICLE_OFFSETS.map((offset) => (
            <TokenParticle
              key={offset}
              pathId={`#${particlePathId}`}
              captureProgress={captureProgress}
              phaseOffset={offset}
              avatarSrc={avatarSrc}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </div>

        {/* ── Center: Vault */}
        <div className="flex flex-col items-center gap-2">
          <VaultFill
            uid={uid}
            depositFillPct={depositFillPct}
            depositComplete={depositComplete}
            prefersReducedMotion={prefersReducedMotion}
          />
          <DepositedCounter
            depositFillPct={depositFillPct}
            depositComplete={depositComplete}
            totalAmount={TOTAL_DEPOSIT}
          />
          {depositComplete && (
            <span
              className="font-mono text-[7px] uppercase tracking-[0.22em]"
              style={{ color: 'rgba(34,197,94,0.80)' }}
              data-testid="vault-complete-label"
            >
              vault sealed ✓
            </span>
          )}
        </div>

        {/* ── Right: Share tokens (hidden until deposit complete) */}
        <div className="hidden min-w-[160px] sm:flex sm:flex-col">
          <ShareReveal
            content={content}
            depositComplete={depositComplete}
            displayShareAmount={displayShareAmount}
            prefersReducedMotion={prefersReducedMotion}
          />
        </div>
      </div>

      {/* Mobile: share token reveal below (stacked) */}
      <div className="mt-5 flex flex-col items-center sm:hidden">
        <ShareReveal
          content={content}
          depositComplete={depositComplete}
          displayShareAmount={displayShareAmount}
          prefersReducedMotion={prefersReducedMotion}
        />
      </div>
    </motion.div>
  )
})
