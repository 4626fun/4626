import { motion } from 'framer-motion'

import type { StoryContent } from '../model/storyContent'
import type { StoryState } from '../model/storyClock'
import {
  getAllocationRepresentation,
  isDistributionVisible,
  isHandoffActive,
  isSealReady,
} from '../model/storySelectors'

type Props = {
  state: StoryState
  content: StoryContent
}

function stepOpacity(active: boolean): number {
  return active ? 1 : 0.24
}

export function DesktopDistributionHandoffScene({ state, content }: Props) {
  if (!isDistributionVisible(state)) return null

  const representation = getAllocationRepresentation(state)
  const handoffActive = isHandoffActive(state)
  const sealReady = isSealReady(state)

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 z-20 px-3 sm:px-10 lg:px-14"
      style={{ top: 'clamp(42vh, 47vh, 52vh)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="mx-auto max-w-3xl">
        <div
          aria-label="distribution summary"
          className="mb-4 flex items-center justify-center gap-2"
        >
          <span className="h-px w-5 bg-blue-300/25" />
          <span className="font-mono text-[7px] uppercase tracking-[0.30em] text-blue-300/60">
            live routing · distribution handoff
          </span>
          <span className="h-px w-5 bg-blue-300/25" />
        </div>

        <div className="mx-auto mb-5 grid max-w-xl grid-cols-4 gap-2">
          <div
            className="rounded-md border border-white/10 px-2 py-1 text-center font-mono text-[8px] uppercase tracking-[0.2em]"
            style={{ opacity: stepOpacity(representation === 'cards') }}
          >
            cards
          </div>
          <div
            className="rounded-md border border-white/10 px-2 py-1 text-center font-mono text-[8px] uppercase tracking-[0.2em]"
            style={{ opacity: stepOpacity(representation === 'payloads') }}
          >
            payloads
          </div>
          <div
            className="rounded-md border border-white/10 px-2 py-1 text-center font-mono text-[8px] uppercase tracking-[0.2em]"
            style={{ opacity: stepOpacity(representation === 'receivingSegments') }}
          >
            receiving
          </div>
          <div
            className="rounded-md border border-white/10 px-2 py-1 text-center font-mono text-[8px] uppercase tracking-[0.2em]"
            style={{ opacity: stepOpacity(representation === 'unifiedFace') }}
          >
            unified
          </div>
        </div>

        <div
          aria-label="distribution checkpoint progress"
          role="progressbar"
          className="mx-auto mb-4 h-1 max-w-[240px] overflow-hidden rounded-full bg-white/10"
          style={{ opacity: handoffActive ? 1 : 0.35 }}
        >
          <div
            className="h-full rounded-full bg-blue-300/70"
            style={{ width: `${Math.max(8, state.beatProgress * 100)}%` }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {content.distribution.map((row) => (
            <motion.div
              key={row.title}
              className="rounded-[14px] border border-white/10 bg-white/[0.03] p-3"
              animate={{
                opacity:
                  representation === 'cards' || representation === 'payloads' ? 1 : 0.45,
                y: handoffActive ? -4 : 0,
              }}
              transition={{ duration: 0.25 }}
            >
              <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-500">
                {row.title}
              </p>
              <p className="mt-1 font-mono text-lg font-black text-white/90">{row.percent}</p>
              <p className="mt-1 text-[11px] text-zinc-400">{row.purposeCopy}</p>
            </motion.div>
          ))}
        </div>

        {sealReady ? (
          <div className="mt-3 text-center font-mono text-[8px] uppercase tracking-[0.24em] text-blue-300/65">
            unified vault face ready
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}

