import { motion, useReducedMotion } from 'framer-motion'

import { formatWholeNumber } from '@/features/waitlist/leaderboardUi'
import { cn } from '@/lib/shared/utils'

type StatCardProps = {
  label: string
  value: string
  emphasize?: boolean
  loading?: boolean
}

function StatCard({ label, value, emphasize = false, loading = false }: StatCardProps) {
  const reduceMotion = useReducedMotion()
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-3 backdrop-blur-md',
        emphasize
          ? 'bg-[rgb(var(--brand-gold)/0.08)] ring-1 ring-[rgb(var(--brand-gold)/0.22)]'
          : 'bg-white/[0.03] ring-1 ring-white/[0.06]',
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <motion.span
        key={value}
        initial={reduceMotion || loading ? false : { opacity: 0.4, y: 4, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'text-xl font-semibold tabular-nums sm:text-2xl',
          emphasize ? 'text-[rgb(var(--brand-gold))]' : 'text-zinc-50',
          loading && 'opacity-50',
        )}
      >
        {loading ? '—' : value}
      </motion.span>
    </div>
  )
}

export function WaitlistStatsRow({
  points,
  rank,
  referrals,
  loading = false,
  unavailable = false,
}: {
  points: number | null
  rank: number | null
  /** Invite contribution points (existing economy); labeled Invite pts in HQ. */
  referrals: number | null
  loading?: boolean
  unavailable?: boolean
}) {
  if (unavailable && !loading) {
    return (
      <div
        className="rounded-xl bg-white/[0.03] px-4 py-3 text-center text-sm text-zinc-500 ring-1 ring-white/[0.06]"
        data-testid="waitlist-stats-row"
        aria-label="Your waitlist stats"
      >
        Points unavailable right now. Try refreshing.
      </div>
    )
  }

  return (
    <div className="flex w-full gap-2" data-testid="waitlist-stats-row" aria-label="Your waitlist stats">
      <StatCard
        label="Points"
        value={points != null ? formatWholeNumber(points) : '—'}
        emphasize
        loading={loading}
      />
      <StatCard
        label="Rank"
        value={rank != null && rank > 0 ? `#${formatWholeNumber(rank)}` : '—'}
        loading={loading}
      />
      <StatCard
        label="Invite pts"
        value={referrals != null ? formatWholeNumber(referrals) : '—'}
        loading={loading}
      />
    </div>
  )
}
