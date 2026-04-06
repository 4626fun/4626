import { motion } from 'framer-motion'

import type { StoryContent } from '../model/storyContent'
import type { StoryState } from '../model/storyClock'
import { isDeployStrategiesVisible } from '../model/storySelectors'

type Props = {
  state: StoryState
  content: StoryContent
}

export function DesktopDeployStrategiesScene({ state, content }: Props) {
  if (!isDeployStrategiesVisible(state)) return null

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
        <div className="mb-4 hidden items-center justify-center gap-2 sm:flex">
          <span className="h-px w-5 bg-blue-300/25" />
          <span className="font-mono text-[7px] uppercase tracking-[0.30em] text-blue-300/60">
            deploy strategies
          </span>
          <span className="h-px w-5 bg-blue-300/25" />
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {content.strategies.map((strategy) => (
            <motion.div
              key={strategy.label}
              className="rounded-[14px] border border-white/10 bg-white/[0.03] p-3"
              initial={{ y: 4, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex items-center gap-1.5">
                {strategy.icon ? (
                  <img
                    src={strategy.icon}
                    alt={strategy.iconAlt}
                    className={strategy.iconClassName}
                    loading="lazy"
                  />
                ) : null}
                <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-500">
                  {strategy.label}
                </p>
              </div>
              <p className="mt-1 font-mono text-lg font-black text-white/90">{strategy.percent}</p>
              {strategy.apy !== '—' ? (
                <p className="mt-0.5 font-mono text-[9px] text-blue-400/70">{strategy.apy} apy</p>
              ) : null}
              <p className="mt-1 text-[11px] text-zinc-400">{strategy.purposeCopy}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mx-auto mt-4 h-1 max-w-[240px] overflow-hidden rounded-full bg-white/10"
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="h-full rounded-full bg-blue-300/70"
            style={{ width: `${Math.max(8, state.beatProgress * 100)}%` }}
          />
        </motion.div>
      </div>
    </motion.div>
  )
}
