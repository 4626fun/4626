import { memo } from 'react'
import { motion, type MotionValue } from 'framer-motion'

import type { StoryContent } from '../model/storyContent'

type Props = {
  content: StoryContent
  cameoIcons: Record<string, string>
  beatProgress: number
  prefersReducedMotion: boolean
  opacity: MotionValue<number>
  y: MotionValue<number>
}

export const CreatorIntroScene = memo(function CreatorIntroScene({
  content,
  cameoIcons,
  prefersReducedMotion,
  opacity,
  y,
}: Props) {
  const avatarSrc = cameoIcons['akita'] ?? null

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[22vh] z-30 flex -translate-x-1/2 flex-col items-center gap-5 px-6 text-center"
      style={{ opacity, y }}
      data-testid="creator-intro-scene"
      aria-label="Creator introduction"
    >
      {/* Creator identity */}
      <div className="flex flex-col items-center gap-3">
        {/* Avatar */}
        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            border: '1.5px solid rgba(249,115,22,0.35)',
            background: 'rgba(249,115,22,0.06)',
            boxShadow: '0 0 24px 6px rgba(249,115,22,0.12)',
          }}
        >
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={`${content.creatorName} avatar`}
              className="h-full w-full rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <span
              className="font-mono text-[11px] font-black"
              style={{ color: '#f97316' }}
            >
              AK
            </span>
          )}
          {/* Active / online dot */}
          <span
            className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full"
            style={{
              background: 'rgba(34,197,94,1)',
              border: '2px solid rgba(0,0,0,0.85)',
              boxShadow: '0 0 6px 2px rgba(34,197,94,0.55)',
            }}
            aria-hidden="true"
          />
        </div>

        {/* ENS name */}
        <div className="flex flex-col items-center gap-1">
          <span
            className="font-mono text-[11px] uppercase tracking-[0.22em]"
            style={{ color: 'rgba(249,115,22,0.55)' }}
          >
            creator
          </span>
          <h2
            className="font-mono text-[clamp(1.1rem,4vw,1.6rem)] font-black leading-none tracking-tight"
            style={{
              background: 'linear-gradient(170deg, #ffffff 28%, rgba(249,115,22,0.85) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {content.creatorName}
          </h2>
          <span
            className="font-mono text-[9px] uppercase tracking-[0.28em]"
            style={{ color: 'rgba(255,255,255,0.28)' }}
          >
            Base Name · verified
          </span>
        </div>
      </div>

      {/* Token identity chip */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-2"
        style={{
          background: 'rgba(249,115,22,0.06)',
          border: '1px solid rgba(249,115,22,0.18)',
        }}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt="AKITA token"
            className="h-4 w-4 rounded-full object-cover opacity-80"
            loading="lazy"
          />
        ) : (
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[4px] font-black text-white"
            style={{ background: '#f97316' }}
          >
            AK
          </span>
        )}
        <span
          className="font-mono text-[10px] font-semibold tracking-[0.18em]"
          style={{ color: 'rgba(249,115,22,0.88)' }}
        >
          {content.creatorTokenSymbol}
        </span>
        <span
          className="font-mono text-[9px] tracking-[0.12em]"
          style={{ color: 'rgba(255,255,255,0.30)' }}
        >
          Zora Creator Coin
        </span>
      </div>

      {/* Action statement */}
      <div className="flex flex-col items-center gap-2">
        <p
          className="max-w-xs font-mono text-[clamp(0.65rem,2.2vw,0.85rem)] leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          Depositing{' '}
          <span style={{ color: 'rgba(249,115,22,0.90)', fontWeight: 700 }}>
            50,000,000 {content.creatorTokenSymbol}
          </span>{' '}
          into an ERC-4626 vault
        </p>
        {!prefersReducedMotion && (
          <motion.div
            className="flex items-center gap-1.5"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <span
              className="h-px w-6"
              style={{ background: 'rgba(249,115,22,0.35)' }}
            />
            <span
              className="font-mono text-[8px] uppercase tracking-[0.28em]"
              style={{ color: 'rgba(249,115,22,0.45)' }}
            >
              scroll to watch
            </span>
            <span
              className="h-px w-6"
              style={{ background: 'rgba(249,115,22,0.35)' }}
            />
          </motion.div>
        )}
      </div>
    </motion.div>
  )
})
