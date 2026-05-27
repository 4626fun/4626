import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/utils'

import { LeaderboardIdentityCell } from './LeaderboardIdentityCell'

export type LeaderboardEntry = {
  rank: number
  signupId: number
  display: string
  cswAddress: string | null
  labelHint: string | null
  avatarUrl: string | null
  showZoraBadge: boolean
  showBaseAppBadge: boolean
  walletProvider: string | null
  referralCode: string | null
  pointsTotal: number
  pointsInvite: number
  pointsAgent: number
}

export function formatWholeNumber(value: number | null | undefined): string {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(n) ? new Intl.NumberFormat('en-US').format(Math.floor(n)) : '0'
}

/** Friendlier public label for synthetic waitlist handles. */
export function formatLeaderboardDisplayName(display: string): string {
  const match = /^user#(\d+)$/i.exec(display.trim())
  if (match) return `Member #${match[1]}`
  return display
}

function rankAccent(rank: number): string {
  if (rank === 1) return 'text-amber-300'
  if (rank === 2) return 'text-zinc-200'
  if (rank === 3) return 'text-orange-300/90'
  return 'text-zinc-400'
}

function RankGlyph({ rank, featured = false }: { rank: number; featured?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-semibold tabular-nums',
        rankAccent(rank),
        featured ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg',
      )}
      aria-hidden
    >
      #{rank}
    </span>
  )
}

export function LeaderboardPoints({
  row,
  size = 'md',
}: {
  row: LeaderboardEntry
  size?: 'sm' | 'md' | 'lg'
}) {
  const totalClass =
    size === 'lg' ? 'text-2xl sm:text-3xl' : size === 'sm' ? 'text-sm' : 'text-lg sm:text-xl'

  return (
    <div className="text-right shrink-0">
      <div className={cn('font-semibold tabular-nums text-zinc-50', totalClass)}>
        {formatWholeNumber(row.pointsTotal)}
      </div>
      <div className="mt-0.5 text-[10px] sm:text-[11px] tabular-nums text-zinc-400">
        {formatWholeNumber(row.pointsInvite)} invite · {formatWholeNumber(row.pointsAgent)} agent
      </div>
    </div>
  )
}

type PodiumSlotProps = {
  entry: LeaderboardEntry | undefined
  rank: 1 | 2 | 3
  isMe: boolean
}

function PodiumSlot({ entry, rank, isMe }: PodiumSlotProps) {
  const featured = rank === 1
  const orderClass = rank === 1 ? 'order-2' : rank === 2 ? 'order-1' : 'order-3'

  if (!entry) {
    return <div className={cn('min-h-[120px]', orderClass)} aria-hidden />
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        orderClass,
        featured ? 'pt-0' : 'pt-6 sm:pt-8',
      )}
    >
      <div
        className={cn(
          'w-full rounded-2xl border px-3 py-4 sm:py-5 transition-colors',
          featured
            ? 'border-brand-primary/35 bg-gradient-to-b from-brand-primary/20 to-vault-card/60 shadow-[0_12px_40px_-20px_rgba(59,130,246,0.55)]'
            : 'border-white/10 bg-vault-card/50',
          isMe && 'ring-1 ring-brand-primary/40',
        )}
      >
        <RankGlyph rank={rank} featured={featured} />
        <div className={cn('mt-3 w-full', featured ? 'scale-105' : '')}>
          <LeaderboardIdentityCell
            display={formatLeaderboardDisplayName(entry.display)}
            cswAddress={entry.cswAddress}
            labelHint={entry.labelHint}
            avatarUrl={entry.avatarUrl}
            showZoraBadge={entry.showZoraBadge}
            showBaseAppBadge={entry.showBaseAppBadge}
            walletProvider={entry.walletProvider}
            layout="stacked"
          />
        </div>
        <div className="mt-4 flex justify-center">
          <LeaderboardPoints row={entry} size={featured ? 'lg' : 'md'} />
        </div>
        {isMe ? (
          <div className="mt-3 inline-flex rounded-full border border-brand-primary/30 bg-brand-primary/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-200">
            You
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function LeaderboardPodium({
  entries,
  meSignupId,
}: {
  entries: LeaderboardEntry[]
  meSignupId: number | null | undefined
}) {
  if (entries.length < 3) return null

  const topThree = entries.slice(0, 3)
  const [first, second, third] = topThree

  return (
    <section aria-label="Top three" className="mb-6 sm:mb-8">
      <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
        <PodiumSlot entry={second!} rank={2} isMe={meSignupId === second?.signupId} />
        <PodiumSlot entry={first!} rank={1} isMe={meSignupId === first?.signupId} />
        <PodiumSlot entry={third!} rank={3} isMe={meSignupId === third?.signupId} />
      </div>
    </section>
  )
}

export function LeaderboardListHeader() {
  return (
    <div
      className="grid grid-cols-[2.75rem_1fr_auto] sm:grid-cols-[3.25rem_1fr_auto] gap-3 px-4 py-2.5 border-b border-white/10 bg-black/25 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400"
      aria-hidden
    >
      <span>Rank</span>
      <span>Player</span>
      <span className="text-right">Points</span>
    </div>
  )
}

export function LeaderboardListRow({
  row,
  isMe,
  showReferralCode = false,
}: {
  row: LeaderboardEntry
  isMe: boolean
  showReferralCode?: boolean
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[2.75rem_1fr_auto] sm:grid-cols-[3.25rem_1fr_auto] gap-3 items-center px-4 py-3 border-b border-white/5 last:border-b-0',
        isMe ? 'bg-brand-primary/10' : 'hover:bg-white/[0.03]',
      )}
    >
      <div className="flex items-center justify-center">
        <span className={cn('text-sm font-semibold tabular-nums', rankAccent(row.rank))}>#{row.rank}</span>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <LeaderboardIdentityCell
            display={formatLeaderboardDisplayName(row.display)}
            cswAddress={row.cswAddress}
            labelHint={row.labelHint}
            avatarUrl={row.avatarUrl}
            showZoraBadge={row.showZoraBadge}
            showBaseAppBadge={row.showBaseAppBadge}
            walletProvider={row.walletProvider}
          />
          {isMe ? (
            <span className="shrink-0 rounded-full border border-brand-primary/30 bg-brand-primary/15 px-2 py-0.5 text-[10px] font-semibold text-brand-200">
              You
            </span>
          ) : null}
        </div>
        {showReferralCode && row.referralCode ? (
          <p className="mt-1 pl-8 sm:pl-9 text-[10px] text-zinc-400">
            Referral code <span className="font-mono text-zinc-400">{row.referralCode}</span>
          </p>
        ) : null}
      </div>

      <LeaderboardPoints row={row} size="sm" />
    </div>
  )
}

export function LeaderboardSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-white/5" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-[2.75rem_1fr_auto] gap-3 px-4 py-3 animate-pulse"
        >
          <div className="h-4 w-8 rounded bg-white/10 mx-auto" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-white/10" />
            <div className="h-3 w-20 rounded bg-white/5" />
          </div>
          <div className="h-6 w-12 rounded bg-white/10 ml-auto" />
        </div>
      ))}
    </div>
  )
}

export function LeaderboardEmptyState({ message }: { message: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm text-zinc-400">{message}</p>
    </div>
  )
}
