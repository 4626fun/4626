import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

import { LoadingInline } from '@/components/ui/LoadingState'
import { cn } from '@/lib/shared/utils'

import { LeaderboardIdentityCell } from './LeaderboardIdentityCell'
import {
  formatLeaderboardDisplayName,
  formatWholeNumber,
  type LeaderboardEntry,
} from './leaderboardUi'
import { useWaitlistLeaderboardPreview } from './useWaitlistLeaderboard'

const PREVIEW_LIMIT = 12

type WaitlistLeaderboardPanelProps = {
  layout: 'rail' | 'mobile'
  className?: string
}

export function WaitlistLeaderboardPanel(props: WaitlistLeaderboardPanelProps) {
  const { layout, className = '' } = props
  const query = useWaitlistLeaderboardPreview(PREVIEW_LIMIT)
  const meSignupId = query.data?.me?.signupId ?? null
  const rows = query.data?.leaderboard ?? []
  const meInList = meSignupId != null && rows.some((row) => row.signupId === meSignupId)
  const meRow = query.data?.me ?? null

  const body = (
    <WaitlistLeaderboardPanelBody
      layout={layout}
      loading={query.isLoading}
      error={query.isError}
      rows={rows}
      meRow={meRow}
      meInList={meInList}
      totalCount={query.data?.totalCount ?? 0}
      onRetry={() => void query.refetch()}
    />
  )

  if (layout === 'rail') {
    return (
      <aside
        aria-label="Waitlist leaderboard"
        className={cn(
          'hidden lg:flex lg:min-h-0 lg:flex-col lg:sticky lg:top-6 lg:max-h-[calc(100vh-2rem)]',
          className,
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          {body}
        </div>
      </aside>
    )
  }

  return (
    <details
      className={cn(
        'group lg:hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]',
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Leaderboard</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {query.data
              ? `${query.data.totalCount.toLocaleString()} on waitlist`
              : 'Top waitlist earners'}
          </p>
        </div>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-white/[0.06] px-1 pb-2">{body}</div>
    </details>
  )
}

function WaitlistLeaderboardPanelBody(props: {
  layout: 'rail' | 'mobile'
  loading: boolean
  error: boolean
  rows: LeaderboardEntry[]
  meRow: LeaderboardEntry | null
  meInList: boolean
  totalCount: number
  onRetry: () => void
}) {
  const { layout, loading, error, rows, meRow, meInList, totalCount, onRetry } = props
  const isRail = layout === 'rail'

  return (
    <>
      {isRail ? (
        <header className="shrink-0 border-b border-white/[0.06] px-4 py-3.5">
          <h2 className="text-sm font-medium text-zinc-200">Leaderboard</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {totalCount > 0 ? `${totalCount.toLocaleString()} on waitlist` : 'Top waitlist earners'}
          </p>
        </header>
      ) : null}

      {meRow && !meInList ? (
        <div
          className={cn(
            'shrink-0 border-b border-brand-primary/20 bg-brand-primary/10',
            isRail ? 'px-3 py-2.5' : 'mx-2 mt-2 rounded-xl px-3 py-2.5',
          )}
        >
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-200">Your rank</p>
          <LeaderboardCompactRow row={meRow} isMe />
        </div>
      ) : null}

      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-contain',
          isRail ? 'px-1 py-1' : 'max-h-[min(50vh,420px)] px-1 py-1',
        )}
      >
        {loading ? (
          <div className="px-3 py-6">
            <LoadingInline labelOverride="Loading leaderboard…" />
          </div>
        ) : error ? (
          <div className="space-y-2 px-3 py-4 text-xs text-zinc-400">
            <p>Could not load leaderboard.</p>
            <button
              type="button"
              onClick={onRetry}
              className="text-brand-200 underline underline-offset-2 hover:text-brand-100"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-zinc-500">No ranked members yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {rows.map((row) => (
              <li key={row.signupId}>
                <LeaderboardCompactRow row={row} isMe={meRow?.signupId === row.signupId} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer
        className={cn(
          'shrink-0 border-t border-white/[0.06] px-4 py-2.5',
          isRail ? '' : 'mx-0',
        )}
      >
        <Link
          to="/leaderboard"
          className="text-[11px] font-medium text-brand-200 transition-colors hover:text-brand-100"
        >
          View full leaderboard →
        </Link>
      </footer>
    </>
  )
}

function LeaderboardCompactRow(props: { row: LeaderboardEntry; isMe: boolean }) {
  const { row, isMe } = props
  return (
    <div
      className={cn(
        'grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-2',
        isMe ? 'rounded-lg bg-brand-primary/10' : 'hover:bg-white/[0.03]',
      )}
    >
      <span className="text-center text-xs font-semibold tabular-nums text-zinc-400">#{row.rank}</span>
      <LeaderboardIdentityCell
        display={formatLeaderboardDisplayName(row.display)}
        cswAddress={row.cswAddress}
        labelHint={row.labelHint}
        avatarUrl={row.avatarUrl}
        showZoraBadge={row.showZoraBadge}
        showBaseAppBadge={row.showBaseAppBadge}
        walletProvider={row.walletProvider}
      />
      <span className="text-right text-xs font-semibold tabular-nums text-zinc-100">
        {formatWholeNumber(row.pointsTotal)}
      </span>
    </div>
  )
}
