import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import {
  formatLeaderboardDisplayName,
  formatWholeNumber,
  type LeaderboardEntry,
} from '@/features/waitlist/leaderboardUi'
import { LeaderboardIdentityCell } from '@/features/waitlist/LeaderboardIdentityCell'
import { cn } from '@/lib/shared/utils'

function MiniRow({
  row,
  isMe,
}: {
  row: LeaderboardEntry
  isMe: boolean
}) {
  const goldRank = row.rank >= 1 && row.rank <= 3
  return (
    <div
      className={cn(
        'grid grid-cols-[2.25rem_1fr_auto] items-center gap-2 px-3 py-2',
        isMe && 'rounded-lg bg-[rgb(var(--brand-gold)/0.08)] ring-1 ring-[rgb(var(--brand-gold)/0.2)]',
      )}
    >
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          goldRank ? 'text-[rgb(var(--brand-gold))]' : 'text-zinc-500',
        )}
      >
        #{row.rank}
      </span>
      <div className="flex min-w-0 items-center gap-1.5">
        <LeaderboardIdentityCell
          display={formatLeaderboardDisplayName(row.display)}
          cswAddress={row.cswAddress}
          eoaAddress={row.eoaAddress}
          labelHint={row.labelHint}
          avatarUrl={row.avatarUrl}
          showZoraBadge={row.showZoraBadge}
          showBaseAppBadge={row.showBaseAppBadge}
          walletProvider={row.walletProvider}
        />
        {isMe ? (
          <span className="shrink-0 rounded-full border border-[rgb(var(--brand-gold)/0.35)] bg-[rgb(var(--brand-gold)/0.12)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[rgb(var(--brand-gold))]">
            you
          </span>
        ) : null}
      </div>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          goldRank ? 'text-[rgb(var(--brand-gold))]' : 'text-zinc-200',
        )}
      >
        {formatWholeNumber(row.pointsTotal)}
      </span>
    </div>
  )
}

export function WaitlistMiniLeaderboard({
  topRows,
  me,
  meOutsideTop,
  loading = false,
}: {
  topRows: LeaderboardEntry[]
  me: LeaderboardEntry | null
  meOutsideTop: boolean
  loading?: boolean
}) {
  return (
    <div data-testid="waitlist-mini-leaderboard" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Leaderboard
        </h2>
        <Link
          to="/leaderboard"
          className="group inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 transition hover:text-white"
        >
          Full board
          <ArrowRight className="size-3 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] backdrop-blur-md">
        {loading && topRows.length === 0 ? (
          <div className="space-y-2 px-3 py-4" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-md bg-white/[0.06]" />
            ))}
          </div>
        ) : topRows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-zinc-500">No rankings yet.</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {topRows.map((row) => (
              <MiniRow key={row.signupId} row={row} isMe={me?.signupId === row.signupId} />
            ))}
            {meOutsideTop && me ? (
              <>
                <div className="px-3 py-1.5 text-center text-xs tracking-[0.2em] text-zinc-600">···</div>
                <MiniRow row={me} isMe />
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
