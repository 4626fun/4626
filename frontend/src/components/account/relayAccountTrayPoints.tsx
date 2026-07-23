import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { LeaderboardIdentityCell } from '@/features/waitlist/LeaderboardIdentityCell'
import {
  formatLeaderboardDisplayName,
  formatWholeNumber,
  type LeaderboardEntry,
} from '@/features/waitlist/leaderboardUi'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import type { PointsActivityRow } from '@/lib/waitlist/pointsActivity'

export type TrayPointsOverview = {
  points: {
    total: number
    invite: number
    signup: number
    links: number
    tasks: number
    csw: number
    social: number
    checkins: number
    bonus: number
    agent: number
  }
  rank: {
    invite: number | null
    total: number | null
  }
  totalCount: number
}

type PointsTrayTab = 'overview' | 'history' | 'leaderboard'

const POINTS_TRAY_TABS: { id: PointsTrayTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'History' },
  { id: 'leaderboard', label: 'Leaderboard' },
]

type TrayLeaderboardResponse = {
  totalCount: number
  leaderboard: LeaderboardEntry[]
  me: LeaderboardEntry | null
}

function buildTrayPointsOverviewRows(points: TrayPointsOverview['points']) {
  const safe = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  }

  const buckets: Record<string, number> = {
    Invites: safe(points.invite),
    Signup: safe(points.signup),
    Links: safe(points.links),
    CSW: safe(points.csw),
    Social: safe(points.social),
    'Check-ins': safe(points.checkins),
    Tasks: safe(points.tasks),
    Bonus: safe(points.bonus),
    Agent: safe(points.agent),
  }

  const total = safe(points.total)
  const accounted = Object.values(buckets).reduce((sum, value) => sum + value, 0)
  const remainder = total - accounted
  if (remainder > 0) {
    buckets['Check-ins'] = (buckets['Check-ins'] ?? 0) + remainder
  }

  return Object.entries(buckets)
    .map(([label, value]) => ({ label, value }))
    .filter((item) => item.value > 0)
}

async function fetchTrayLeaderboard(limit: number): Promise<TrayLeaderboardResponse> {
  const res = await apiFetch(
    `${API_ENDPOINTS.waitlist.leaderboard}?pointsType=total&page=1&limit=${limit}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
  )
  const json = (await res.json().catch(() => null)) as ApiEnvelope<TrayLeaderboardResponse> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error || 'Leaderboard request failed')
  }
  return json.data
}

export function RelayTrayPointsModule(props: {
  pointsTotal: number
  position: TrayPointsOverview | null
  pointsLoading: boolean
  activity: PointsActivityRow[]
  activityLoading: boolean
  activityError?: boolean
  activityAuthRequired?: boolean
  leaderboardEligible: boolean
  hasAccountProfile: boolean
  signupId: number
}) {
  const [pointsTab, setPointsTab] = useState<PointsTrayTab>('overview')
  const totalRank = props.position?.rank.total ?? null
  const inviteRank = props.position?.rank.invite ?? null
  const totalCount = props.position?.totalCount ?? 0
  const breakdownRows = props.position ? buildTrayPointsOverviewRows(props.position.points) : []
  const canonicalTotal = props.position?.points.total ?? props.pointsTotal
  const activityRows = props.activity.filter((row) => row.waitlistPoints > 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-2 pb-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Points</div>
      {props.pointsLoading ? (
        <div className="mt-2 text-[11px] text-zinc-500">Loading points…</div>
      ) : (
        <>
          <div className="mt-2 text-[30px] font-semibold leading-none tracking-tight text-white tabular-nums">
            {canonicalTotal.toLocaleString()}
          </div>

          <div className="mt-3 flex items-center gap-2 border-b border-white/8 pb-1">
            {POINTS_TRAY_TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPointsTab(id)}
                className={`rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
                  pointsTab === id
                    ? 'bg-white/[0.08] text-white'
                    : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {pointsTab === 'overview' ? (
            <div className="mt-3 space-y-3">
              {props.position ? (
                <div>
                  <div className="pb-2 text-[10px] uppercase tracking-[0.12em] text-zinc-500">Category breakdown</div>
                  {breakdownRows.length === 0 ? (
                    <div className="text-[11px] text-zinc-400">No point awards yet.</div>
                  ) : (
                    <div className="divide-y divide-white/6">
                      {breakdownRows.map((item) => (
                        <div key={item.label} className="flex items-center justify-between py-2.5">
                          <span className="text-[12px] text-zinc-300">{item.label}</span>
                          <span className="text-[12px] tabular-nums text-zinc-200">
                            {item.value.toLocaleString()}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[12px] font-medium text-zinc-200">Total</span>
                        <span className="text-[12px] font-medium tabular-nums text-white">
                          {canonicalTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-zinc-400">
                  {!props.hasAccountProfile
                    ? 'Verify your email on the waitlist to create your 4626 profile and earn points.'
                    : !props.leaderboardEligible
                      ? 'Complete email verification to appear on the leaderboard and see rank.'
                      : 'Point breakdown is not available yet.'}
                </div>
              )}
            </div>
          ) : pointsTab === 'history' ? (
            <div className="mt-3 flex min-h-0 flex-1 flex-col">
              <div className="pb-2 text-[10px] uppercase tracking-[0.12em] text-zinc-500">What you earned</div>
              {props.activityLoading ? (
                <div className="text-[11px] text-zinc-500">Loading point history…</div>
              ) : props.activityAuthRequired ? (
                <div className="text-[11px] text-zinc-400">
                  Sign in with email (Privy) to load point history, then reopen the tray.
                </div>
              ) : props.activityError ? (
                <div className="text-[11px] text-zinc-400">Could not load history. Try again in a moment.</div>
              ) : activityRows.length === 0 ? (
                <div className="text-[11px] text-zinc-400">
                  No point awards yet. Link accounts, invite friends, complete tasks, or check in on social to earn
                  points.
                </div>
              ) : (
                <div className="min-h-0 flex-1 divide-y divide-white/6">
                  {activityRows.map((row) => (
                    <RelayTrayPointsHistoryRow key={row.id} row={row} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <RelayTrayPointsLeaderboardPanel
              signupId={props.signupId}
              totalRank={totalRank}
              inviteRank={inviteRank}
              totalCount={totalCount}
              leaderboardEligible={props.leaderboardEligible}
              hasAccountProfile={props.hasAccountProfile}
              active={pointsTab === 'leaderboard'}
            />
          )}
        </>
      )}
    </div>
  )
}

function RelayTrayPointsLeaderboardPanel(props: {
  signupId: number
  totalRank: number | null
  inviteRank: number | null
  totalCount: number
  leaderboardEligible: boolean
  hasAccountProfile: boolean
  active: boolean
}) {
  const leaderboardQuery = useQuery({
    queryKey: ['account-tray-leaderboard', props.signupId],
    enabled: props.active,
    staleTime: 30_000,
    queryFn: () => fetchTrayLeaderboard(20),
  })

  const rows = leaderboardQuery.data?.leaderboard ?? []
  const meInList = rows.some((row) => row.signupId === props.signupId)
  const meRow = leaderboardQuery.data?.me ?? null

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col">
      {props.leaderboardEligible && (props.totalRank || props.inviteRank) ? (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Total rank</div>
            <div className="mt-1 text-[18px] font-semibold tabular-nums text-zinc-100">
              {props.totalRank ? `#${props.totalRank.toLocaleString()}` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Invite rank</div>
            <div className="mt-1 text-[18px] font-semibold tabular-nums text-zinc-100">
              {props.inviteRank ? `#${props.inviteRank.toLocaleString()}` : '—'}
            </div>
          </div>
        </div>
      ) : null}

      {props.totalCount > 0 ? (
        <div className="mb-2 text-[10px] text-zinc-500">
          {props.totalCount.toLocaleString()} profiles on the leaderboard
        </div>
      ) : null}

      {leaderboardQuery.isLoading ? (
        <div className="text-[11px] text-zinc-500">Loading leaderboard…</div>
      ) : leaderboardQuery.isError ? (
        <div className="text-[11px] text-zinc-400">Could not load leaderboard. Try again in a moment.</div>
      ) : !props.hasAccountProfile ? (
        <div className="text-[11px] text-zinc-400">
          Verify your email on the waitlist to create your 4626 profile and appear on the leaderboard.
        </div>
      ) : !props.leaderboardEligible ? (
        <div className="text-[11px] text-zinc-400">
          Complete email verification to appear on the leaderboard and see rank.
        </div>
      ) : rows.length === 0 ? (
        <div className="text-[11px] text-zinc-400">No leaderboard entries yet.</div>
      ) : (
        <div className="min-h-0 flex-1 divide-y divide-white/6">
          {rows.map((row) => (
            <RelayTrayPointsLeaderboardRow
              key={row.signupId}
              row={row}
              isMe={row.signupId === props.signupId}
            />
          ))}
          {meRow && !meInList ? (
            <>
              <div className="py-2 text-center text-[10px] uppercase tracking-[0.12em] text-zinc-600">Your rank</div>
              <RelayTrayPointsLeaderboardRow row={meRow} isMe />
            </>
          ) : null}
        </div>
      )}

      <Link
        to="/leaderboard"
        className="mt-3 inline-flex text-[12px] font-medium text-brand-200 hover:text-brand-100"
      >
        View full leaderboard
      </Link>
    </div>
  )
}

function RelayTrayPointsLeaderboardRow(props: { row: LeaderboardEntry; isMe: boolean }) {
  const { row, isMe } = props
  return (
    <div className={`py-2 ${isMe ? 'bg-brand-primary/10 -mx-1 px-1 rounded-md' : ''}`}>
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2">
        <span className="text-[11px] font-semibold tabular-nums text-zinc-400">#{row.rank}</span>
        <div className="min-w-0 flex items-center gap-1.5">
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
            <span className="shrink-0 rounded-full border border-brand-primary/30 bg-brand-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-200">
              You
            </span>
          ) : null}
        </div>
        <span className="shrink-0 text-[12px] font-medium tabular-nums text-zinc-200">
          {formatWholeNumber(row.pointsTotal)}
        </span>
      </div>
    </div>
  )
}

function RelayTrayPointsHistoryRow(props: { row: PointsActivityRow }) {
  const { row } = props
  const signedPoints =
    row.waitlistPoints > 0 ? `+${row.waitlistPoints}` : String(row.waitlistPoints)
  const showRawAward = row.amount !== row.waitlistPoints

  return (
    <div className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-[12px] font-medium leading-snug text-zinc-100">{row.label}</span>
        <span
          className={`shrink-0 text-[12px] font-medium tabular-nums ${
            row.waitlistPoints >= 0 ? 'text-emerald-300/90' : 'text-red-300/90'
          }`}
        >
          {signedPoints}
        </span>
      </div>
      {showRawAward ? (
        <div className="mt-0.5 text-[10px] text-zinc-500">
          Ledger {row.amount > 0 ? `+${row.amount}` : row.amount} → {row.waitlistPoints} points counted
        </div>
      ) : null}
      {row.createdAt ? (
        <div className="mt-0.5 text-[10px] text-zinc-500">
          {formatPointsActivityWhen(Date.parse(row.createdAt))}
        </div>
      ) : null}
    </div>
  )
}

function formatPointsActivityWhen(timestampMs: number): string {
  const deltaMs = Date.now() - timestampMs
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return 'Just now'
  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 14) return `${days}d ago`
  return new Date(timestampMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
