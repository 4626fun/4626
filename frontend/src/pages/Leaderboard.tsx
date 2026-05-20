import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@coinbase/cds-web/tables'
import { Alert } from '@/components/ui/Alert'
import { LoadingText } from '@/components/ui/LoadingState'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { getCanonicalMarketingWaitlistPath, getMarketingWaitlistReferralUrl } from '@/lib/auth/waitlistEntry'
import { getMarketingBaseUrl } from '@/lib/env/host'
import { META, PageMeta } from '@/components/seo/PageMeta'
import { ShareVaultButton } from '@/components/share/ShareVaultButton'
import { LeaderboardIdentityCell } from '@/features/waitlist/LeaderboardIdentityCell'

type LeaderboardRow = {
  rank: number
  signupId: number
  display: string
  cswAddress: string | null
  labelHint: string | null
  avatarUrl: string | null
  showZoraBadge: boolean
  showBaseAppBadge: boolean
  referralCode: string | null
  pointsTotal: number
  pointsInvite: number
  pointsAgent: number
  borderTier: number
}

type LeaderboardResponse = {
  page: number
  limit: number
  pointsType: 'total' | 'invite' | 'agent'
  totalCount: number
  totalPages: number
  hasMore: boolean
  leaderboard: LeaderboardRow[]
  me: LeaderboardRow | null
}

function formatWholeNumber(value: number | null | undefined): string {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(n) ? new Intl.NumberFormat('en-US').format(Math.floor(n)) : '0'
}

function formatPointsTooltip(row: LeaderboardRow): string {
  return `Total ${formatWholeNumber(row.pointsTotal)} • Invite ${formatWholeNumber(row.pointsInvite)} • Agent ${formatWholeNumber(row.pointsAgent)}`
}

function rankTone(rank: number): string {
  if (rank === 1) return 'text-amber-300'
  if (rank === 2) return 'text-slate-200'
  if (rank === 3) return 'text-orange-300'
  return 'text-zinc-400'
}

export function Leaderboard() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const inFlightRef = useRef(false)

  const fetchLeaderboard = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      if (!opts?.silent) {
        setBusy(true)
        setError(null)
      }
      try {
        const pageSize = 100
        let page = 1
        let merged: LeaderboardResponse | null = null

        while (true) {
          const res = await apiFetch(
            `${API_ENDPOINTS.waitlist.leaderboard}?pointsType=total&page=${page}&limit=${pageSize}`,
            {
              method: 'GET',
              headers: { Accept: 'application/json' },
            },
          )
          const json = (await res.json().catch(() => null)) as ApiEnvelope<LeaderboardResponse> | null
          if (!res.ok || !json) throw new Error('Leaderboard request failed')
          if (!json.success || !json.data) throw new Error(json.error || 'Leaderboard request failed')

          if (!merged) {
            merged = { ...json.data, leaderboard: [...json.data.leaderboard] }
          } else {
            merged = {
              ...json.data,
              leaderboard: [...merged.leaderboard, ...json.data.leaderboard],
            }
          }

          if (!json.data.hasMore) break
          page += 1
        }

        setData(merged)
        if (!opts?.silent) setError(null)
      } catch (e: any) {
        if (!opts?.silent) {
          setError(e?.message ? String(e.message) : 'Leaderboard request failed')
          setData(null)
        }
      } finally {
        if (!opts?.silent) setBusy(false)
        inFlightRef.current = false
      }
    },
    [],
  )

  useEffect(() => {
    void fetchLeaderboard()
  }, [fetchLeaderboard])

  useEffect(() => {
    const handleFocus = () => {
      void fetchLeaderboard({ silent: true })
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchLeaderboard({ silent: true })
      }
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchLeaderboard({ silent: true })
      }
    }, 30_000)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(interval)
    }
  }, [fetchLeaderboard])

  const subtitle = useMemo(() => {
    if (!data) return null
    const ranked = data.totalCount.toLocaleString()
    const shown = data.leaderboard.length.toLocaleString()
    return `Showing ${shown} of ${ranked} on the waitlist`
  }, [data])

  const meInTop = useMemo(() => {
    if (!data?.me) return false
    return data.leaderboard.some((row) => row.signupId === data.me?.signupId)
  }, [data])

  const myRankShare = useMemo(() => {
    if (!data?.me) return null
    // Use the referral URL when available so each share doubles as a referral;
    // fall back to the plain /leaderboard URL otherwise.
    const url = data.me.referralCode
      ? getMarketingWaitlistReferralUrl(data.me.referralCode)
      : `${getMarketingBaseUrl()}/leaderboard`
    const points = formatWholeNumber(data.me.pointsTotal)
    const text = `Ranked #${data.me.rank} on 4626 with ${points} points. Join me:`
    return { url, text }
  }, [data])

  return (
    <section className="relative overflow-hidden bg-vault-bg text-white min-h-[calc(100vh-0px)]">
      <PageMeta title={META.leaderboard.title} description={META.leaderboard.description} canonicalPath="/leaderboard" />
      <div className="relative max-w-5xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
        <div className="rounded-2xl border border-white/10 bg-vault-card/55 px-4 sm:px-7 py-4 sm:py-6">
          <div className="flex flex-col gap-5 sm:gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">4626</div>
                <h1 className="headline text-2xl sm:text-4xl leading-tight">Leaderboard</h1>
                <p className="text-[13px] sm:text-sm text-zinc-400 mt-2 max-w-xl">
                  Ranked by total points. Hover a score to view invite and agent point breakdowns.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {myRankShare ? (
                  <ShareVaultButton
                    url={myRankShare.url}
                    text={myRankShare.text}
                    label={`Share rank #${data?.me?.rank ?? ''}`}
                    showLabel
                  />
                ) : null}
                <Link
                  to={getCanonicalMarketingWaitlistPath()}
                  className="btn-accent btn-compact inline-flex items-center whitespace-nowrap text-xs sm:text-sm"
                >
                  Invite friends
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-brand-primary/25 bg-brand-primary/10 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[11px] sm:text-[12px] text-zinc-100">
                Total points
              </div>
              {subtitle ? (
                <div className="rounded-full border border-white/10 bg-black/20 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[11px] sm:text-[12px] text-zinc-300">
                  {subtitle}
                </div>
              ) : null}
              <div className="text-[10px] sm:text-[11px] text-zinc-500 sm:ml-auto">
                {busy ? <LoadingText intent="processing" size="sm" labelOverride="Loading..." /> : 'Hover any score for breakdown'}
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <Alert variant="error" className="mt-6">
            {error}
          </Alert>
        ) : null}

        <div className="mt-4 sm:mt-5 rounded-2xl border border-white/10 bg-vault-card/45 overflow-hidden">
          <Table variant="ruled" compact accessibilityLabel="Leaderboard rankings">
            <TableHeader>
              <TableRow disableHoverIndicator>
                <TableCell title="Rank" width="18%" />
                <TableCell title="User" width="54%" />
                <TableCell title="Points" width="28%" justifyContent="flex-end" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.leaderboard?.length ? (
                data.leaderboard.map((r) => {
                  const isMe = Boolean(data?.me && data.me.signupId === r.signupId)
                  return (
                    <TableRow
                      key={`${r.rank}-${r.signupId}`}
                      className={
                        isMe
                          ? 'bg-brand-primary/10 hover:bg-brand-primary/15'
                          : 'hover:bg-white/[0.03]'
                      }
                    >
                      <TableCell>
                        <span className={`text-[13px] sm:text-sm font-semibold tabular-nums ${rankTone(r.rank)}`}>#{r.rank}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-[13px] sm:text-sm text-zinc-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <LeaderboardIdentityCell
                              display={r.display}
                              cswAddress={r.cswAddress}
                              labelHint={r.labelHint}
                              avatarUrl={r.avatarUrl}
                              showZoraBadge={r.showZoraBadge}
                              showBaseAppBadge={r.showBaseAppBadge}
                            />

                            {isMe ? (
                              <div className="shrink-0 inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/15 px-2 py-0.5 text-[10px] font-semibold text-brand-200">
                                You
                              </div>
                            ) : null}
                          </div>
                          {r.referralCode ? (
                            <div className="mt-1 text-[10px] sm:text-[11px] uppercase tracking-[0.08em] text-zinc-500">
                              code: {r.referralCode}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell justifyContent="flex-end">
                        <span
                          className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[12px] sm:text-sm font-semibold text-zinc-100 tabular-nums"
                          title={formatPointsTooltip(r)}
                        >
                          {formatWholeNumber(r.pointsTotal)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow disableHoverIndicator>
                  <TableCell colSpan={3}>
                    <span className="text-sm text-zinc-600">No ranked waitlist members yet.</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {data?.me && !meInTop ? (
          <div className="mt-4 rounded-2xl border border-brand-primary/30 bg-brand-primary/8 overflow-hidden">
            <div className="px-4 py-2 border-b border-white/8 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-200">
              Your rank
            </div>
            <Table variant="ruled" compact accessibilityLabel="Your ranking">
              <TableBody>
                <TableRow disableHoverIndicator>
                  <TableCell width="20%">
                    <span className={`text-[13px] sm:text-sm font-semibold tabular-nums ${rankTone(data.me.rank)}`}>#{data.me.rank}</span>
                  </TableCell>
                  <TableCell width="50%">
                    <div className="text-[13px] sm:text-sm text-zinc-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <LeaderboardIdentityCell
                          display={data.me.display}
                          cswAddress={data.me.cswAddress}
                          labelHint={data.me.labelHint}
                          avatarUrl={data.me.avatarUrl}
                          showZoraBadge={data.me.showZoraBadge}
                          showBaseAppBadge={data.me.showBaseAppBadge}
                        />

                        <div className="shrink-0 inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/15 px-2 py-0.5 text-[10px] font-semibold text-brand-200">
                          You
                        </div>
                      </div>
                      {data.me.referralCode ? (
                        <div className="mt-1 text-[10px] sm:text-[11px] uppercase tracking-[0.08em] text-zinc-500">
                          code: {data.me.referralCode}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell width="30%" justifyContent="flex-end">
                    <span
                      className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[12px] sm:text-sm font-semibold text-zinc-100 tabular-nums"
                      title={formatPointsTooltip(data.me)}
                    >
                      {formatWholeNumber(data.me.pointsTotal)}
                    </span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>
    </section>
  )
}
