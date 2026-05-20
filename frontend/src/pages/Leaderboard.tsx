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
  /**
   * Full canonical Coinbase Smart Wallet address for this profile, when
   * registered. Server already shortens the `display` label; the full
   * `cswAddress` is sent so the client can show a Basescan link / copy
   * button if we want to surface that later.
   */
  cswAddress: string | null
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
      <div className="relative max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-medium text-zinc-600 mb-2">4626</div>
            <div className="headline text-3xl sm:text-4xl leading-tight">Leaderboard</div>
            <div className="text-sm text-zinc-600 font-light mt-2">
              Ranked by total points. Hover any score to see the invite and agent breakdown.
            </div>
            {subtitle ? <div className="text-[11px] text-zinc-700 mt-2">{subtitle}</div> : null}
          </div>
          {/*
            Right-side actions: keep Share + Invite on one line at all
            screen sizes. `flex-nowrap shrink-0 whitespace-nowrap` defends
            against the parent flex deciding to wrap when the title column
            grows; `self-center` aligns this group against the centerline
            of the title block (which is `items-start` — without this, the
            button group floats to the visual top of that row).
          */}
          <div className="flex flex-nowrap items-center gap-3 shrink-0 self-center whitespace-nowrap">
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
              className="btn-accent btn-compact inline-flex items-center whitespace-nowrap"
            >
              Invite friends
            </Link>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <div className="rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-[12px] text-zinc-200">
            Total points
          </div>
          <div className="text-[11px] text-zinc-700">{busy ? <LoadingText intent="processing" size="sm" labelOverride="Loading..." /> : 'Hover any score for the breakdown'}</div>
        </div>

        {error ? (
          <Alert variant="error" className="mt-6">
            {error}
          </Alert>
        ) : null}

        <div className="mt-6 rounded-xl border border-white/8 bg-vault-card/40 overflow-hidden">
          <Table variant="ruled" compact accessibilityLabel="Leaderboard rankings">
            <TableHeader>
              <TableRow disableHoverIndicator>
                <TableCell title="Rank" width="20%" />
                <TableCell title="User" width="50%" />
                <TableCell title="Points" width="30%" justifyContent="flex-end" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.leaderboard?.length ? (
                data.leaderboard.map((r) => {
                  const isMe = Boolean(data?.me && data.me.signupId === r.signupId)
                  return (
                    <TableRow
                      key={`${r.rank}-${r.signupId}`}
                      className={[
                        isMe ? 'bg-brand-primary/6' : '',
                        r.borderTier >= 1 ? 'bg-brand-primary/[0.035] border-l-2 border-l-[rgb(var(--brand-primary)/0.3)]' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <TableCell>
                        <span className="text-sm text-zinc-300">#{r.rank}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-zinc-200">
                          <div className="flex items-center gap-2 min-w-0">
                            <LeaderboardIdentityCell display={r.display} cswAddress={r.cswAddress} />

                            {isMe ? (
                              <div className="shrink-0 inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-300">
                                You
                              </div>
                            ) : null}
                            {r.borderTier >= 1 ? (
                              <div className="shrink-0 inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-300">
                                Tier {r.borderTier}
                              </div>
                            ) : null}
                          </div>
                          {r.referralCode ? <div className="text-[11px] text-zinc-700">code: {r.referralCode}</div> : null}
                        </div>
                      </TableCell>
                      <TableCell justifyContent="flex-end">
                        <span className="text-sm text-zinc-200 tabular-nums" title={formatPointsTooltip(r)}>
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
          <div className="mt-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/8 text-[11px] font-medium text-brand-300">Your rank</div>
            <Table variant="ruled" compact accessibilityLabel="Your ranking">
              <TableBody>
                <TableRow disableHoverIndicator>
                  <TableCell width="20%">
                    <span className="text-sm text-zinc-300">#{data.me.rank}</span>
                  </TableCell>
                  <TableCell width="50%">
                    <div className="text-sm text-zinc-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <LeaderboardIdentityCell display={data.me.display} cswAddress={data.me.cswAddress} />

                        <div className="shrink-0 inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-300">
                          You
                        </div>
                      </div>
                      {data.me.referralCode ? <div className="text-[11px] text-zinc-700">code: {data.me.referralCode}</div> : null}
                    </div>
                  </TableCell>
                  <TableCell width="30%" justifyContent="flex-end">
                    <span className="text-sm text-zinc-200 tabular-nums" title={formatPointsTooltip(data.me)}>
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
