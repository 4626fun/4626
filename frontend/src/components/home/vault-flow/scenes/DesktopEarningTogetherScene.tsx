import { AnimatePresence, motion } from 'framer-motion'

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

export function DesktopEarningTogetherScene({ state, content: _content }: Props) {
  if (!isEarningTogetherVisible(state)) return null

  const loopRunning = isLoopActive(state)
  const reEntryHint = isReEntryHintVisible(state)

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-4 px-3 sm:px-10 lg:px-14"
      style={{ top: 'clamp(62vh, 68vh, 74vh)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Section label */}
      <div className="flex items-center gap-2">
        <span className="h-px w-5 bg-blue-300/25" />
        <span className="font-mono text-[7px] uppercase tracking-[0.30em] text-blue-300/60">
          earning together
        </span>
        <span className="h-px w-5 bg-blue-300/25" />
      </div>

      {/* Loop active indicator — pulsing chip, fires once loopActive milestone is set */}
      {loopRunning && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
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

      {/* Re-entry hint — subtle affordance shown during hold window, not a CTA */}
      <AnimatePresence>
        {reEntryHint && (
          <motion.div
            key="reentry"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
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
      </AnimatePresence>
    </motion.div>
  )
}
