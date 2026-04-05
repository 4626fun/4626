import { motion } from 'framer-motion'

import type { StoryContent } from '../model/storyContent'
import type { StoryState } from '../model/storyClock'
import {
  isEarningTogetherVisible,
  isLoopActive,
  isReEntryHintVisible,
} from '../model/storySelectors'

type Props = {
  state: StoryState
  content: StoryContent
}

export function DesktopEarningTogetherScene({ state, content }: Props) {
  if (!isEarningTogetherVisible(state)) return null

  const loopRunning = isLoopActive(state)
  const reEntryHint = isReEntryHintVisible(state)

  const beatCopy = content.copy?.earningTogether ?? {
    title: 'The vault runs.',
    subtitle: 'entry point, not ending',
    summary: 'Creator earns. Participants earn. Value keeps flowing.',
  }

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-4 px-3 sm:px-10 lg:px-14"
      style={{ top: 'clamp(60vh, 67vh, 73vh)' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      aria-label="earning together scene"
    >
      {/* Ambient line — "stable system in motion" tone */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-px w-40 -translate-x-1/2"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(100,160,255,0.18), transparent)' }}
        animate={{ opacity: [0.2, 0.55, 0.2] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Section label */}
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="h-px w-5 bg-blue-300/25" />
        <span className="font-mono text-[7px] uppercase tracking-[0.30em] text-blue-300/60">
          {beatCopy.subtitle}
        </span>
        <span className="h-px w-5 bg-blue-300/25" />
      </div>

      {/* Core semantic message */}
      <div className="max-w-[560px] text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/[0.78] sm:text-[12px]">
          {beatCopy.title}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-zinc-400 sm:text-[13px]">
          {beatCopy.summary}
        </p>
      </div>

      {/* Loop active indicator */}
      {loopRunning && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/[0.06] px-4 py-1.5"
        >
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-blue-400/60"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="font-mono text-[8px] uppercase tracking-[0.28em] text-blue-300/70">
            loop active
          </span>
        </motion.div>
      )}

      {/* Re-entry hint: signal, not CTA */}
      {reEntryHint && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-1.5"
          aria-hidden="true"
        >
          <motion.div
            className="h-px w-8"
            style={{ background: 'rgba(100,160,255,0.25)' }}
            animate={{ scaleX: [0.6, 1, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span
            className="font-mono text-[8px] uppercase tracking-[0.28em]"
            style={{ color: 'rgba(100,160,255,0.35)' }}
          >
            deposit open
          </span>
        </motion.div>
      )}
    </motion.div>
  )
}
