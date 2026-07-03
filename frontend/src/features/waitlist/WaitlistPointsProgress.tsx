import { motion, useReducedMotion } from 'framer-motion'
import type { WaitlistProgress } from '@/features/waitlist/waitlistTiers'

type WaitlistPointsProgressProps = {
  progress: WaitlistProgress
  points: number
  className?: string
}

export function WaitlistPointsProgress({ progress, points, className }: WaitlistPointsProgressProps) {
  const reduceMotion = useReducedMotion()

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
          <span className="size-1.5 rounded-full bg-[rgb(var(--brand-primary))]" aria-hidden="true" />
          {progress.currentTier.name}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-white">
            {points.toLocaleString()}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">pts</span>
        </div>
      </div>

      {progress.nextTier ? (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, rgb(var(--brand-primary)), rgb(var(--brand-hover)))',
              }}
              initial={false}
              animate={{ width: `${progress.progressPercent}%` }}
              transition={
                reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 24 }
              }
            />
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            <span className="font-medium tabular-nums text-zinc-300">
              {progress.pointsToNext.toLocaleString()}
            </span>{' '}
            pts to {progress.nextTier.name}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-zinc-500">Top tier reached — you’re at the front.</p>
      )}
    </div>
  )
}
