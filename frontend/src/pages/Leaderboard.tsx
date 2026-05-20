import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { LoadingText } from '@/components/ui/LoadingState'
import { META, PageMeta } from '@/components/seo/PageMeta'
import { ShareVaultButton } from '@/components/share/ShareVaultButton'
import { LeaderboardIdentityCell } from '@/features/waitlist/LeaderboardIdentityCell'
import {
  formatLeaderboardDisplayName,
  formatWholeNumber,
  LeaderboardEmptyState,
  LeaderboardListHeader,
  LeaderboardListRow,
  LeaderboardPodium,
  LeaderboardPoints,
  LeaderboardSkeleton,
  type LeaderboardEntry,
} from '@/features/waitlist/leaderboardUi'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { getCanonicalMarketingWaitlistPath, getMarketingWaitlistReferralUrl } from '@/lib/auth/waitlistEntry'
import { getMarketingBaseUrl } from '@/lib/env/host'
import { cn } from '@/lib/shared/utils'

type LeaderboardResponse = {
  page: number
  limit: number
  pointsType: 'total' | 'invite' | 'agent'
  totalCount: number
  totalPages: number
  hasMore: boolean
  leaderboard: LeaderboardEntry[]
  me: LeaderboardEntry | null
}

export function Leaderboard() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const inFlightRef = useRef(false)

  const fetchLeaderboard = useCallback(async (opts?: { silent?: boolean }) => {
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
  }, [])

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

  const meSignupId = data?.me?.signupId

  const meInList = useMemo(() => {
    if (!data?.me) return false
    return data.leaderboard.some((row) => row.signupId === data.me?.signupId)
  }, [data])

  const listRows = useMemo(() => {
    if (!data?.leaderboard.length) return []
    return data.leaderboard.length >= 3 ? data.leaderboard.slice(3) : data.leaderboard
  }, [data])

  const myRankShare = useMemo(() => {
    if (!data?.me) return null
    const url = data.me.referralCode
      ? getMarketingWaitlistReferralUrl(data.me.referralCode)
      : `${getMarketingBaseUrl()}/leaderboard`
    const points = formatWholeNumber(data.me.pointsTotal)
    const text = `Ranked #${data.me.rank} on 4626 with ${points} points. Join me:`
    return { url, text }
  }, [data])

  const statsLine = useMemo(() => {
    if (!data) return null
    return `${data.leaderboard.length.toLocaleString()} ranked · ${data.totalCount.toLocaleString()} on waitlist`
  }, [data])

  return (
    <section className="relative min-h-[calc(100vh-0px)] overflow-hidden bg-vault-bg text-white">
      <PageMeta title={META.leaderboard.title} description={META.leaderboard.description} canonicalPath="/leaderboard" />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-brand-primary/10 to-transparent" aria-hidden />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-8 sm:mb-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Waitlist</p>
          <h1 className="headline mt-2 text-3xl sm:text-4xl leading-tight">Leaderboard</h1>
          <p className="mt-2 max-w-lg text-sm text-zinc-400">
            Total waitlist points — invite and agent contributions are shown on every row.
          </p>
          {statsLine ? (
            <p className="mt-3 text-xs text-zinc-500">
              {statsLine}
              {busy ? (
                <span className="ml-2 inline-flex align-middle">
                  <LoadingText intent="processing" size="sm" labelOverride="Updating…" />
                </span>
              ) : null}
            </p>
          ) : null}
        </header>

        {data?.me ? (
          <section
            aria-label="Your ranking"
            className="mb-6 sm:mb-8 rounded-2xl border border-brand-primary/30 bg-gradient-to-r from-brand-primary/15 via-brand-primary/8 to-transparent px-4 sm:px-5 py-4"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="shrink-0 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-200">Rank</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">#{data.me.rank}</div>
                </div>
                <div className="min-w-0 flex-1 border-l border-white/10 pl-4">
                  <LeaderboardIdentityCell
                    display={formatLeaderboardDisplayName(data.me.display)}
                    cswAddress={data.me.cswAddress}
                    labelHint={data.me.labelHint}
                    avatarUrl={data.me.avatarUrl}
                    showZoraBadge={data.me.showZoraBadge}
                    showBaseAppBadge={data.me.showBaseAppBadge}
                  />
                  {data.me.referralCode ? (
                    <p className="mt-1.5 text-[11px] text-zinc-500">
                      Referral code <span className="font-mono text-zinc-300">{data.me.referralCode}</span>
                    </p>
                  ) : null}
                </div>
                <LeaderboardPoints row={data.me} />
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {myRankShare ? (
                  <ShareVaultButton
                    url={myRankShare.url}
                    text={myRankShare.text}
                    label={`Share #${data.me.rank}`}
                    showLabel
                  />
                ) : null}
                <Button variant="primary" size="sm" className="btn-compact whitespace-nowrap text-xs sm:text-sm" asChild>
                  <Link to={getCanonicalMarketingWaitlistPath()}>Invite friends</Link>
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <div className="mb-6 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" className="btn-compact whitespace-nowrap text-xs sm:text-sm" asChild>
              <Link to={getCanonicalMarketingWaitlistPath()}>Join waitlist</Link>
            </Button>
          </div>
        )}

        {error ? (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        ) : null}

        {busy && !data ? (
          <div className="glass-card overflow-hidden">
            <LeaderboardListHeader />
            <LeaderboardSkeleton />
          </div>
        ) : null}

        {!busy || data ? (
          <>
            {data && data.leaderboard.length >= 3 ? (
              <LeaderboardPodium entries={data.leaderboard} meSignupId={meSignupId} />
            ) : null}

            <div className="glass-card overflow-hidden">
              <LeaderboardListHeader />
              {data?.leaderboard.length ? (
                <div>
                  {listRows.map((row) => (
                    <LeaderboardListRow
                      key={`${row.rank}-${row.signupId}`}
                      row={row}
                      isMe={meSignupId === row.signupId}
                      showReferralCode={meSignupId === row.signupId}
                    />
                  ))}
                </div>
              ) : !busy ? (
                <LeaderboardEmptyState message="No ranked waitlist members yet." />
              ) : null}
            </div>

            {data?.me && !meInList ? (
              <section
                aria-label="Your rank below the current list"
                className={cn(
                  'mt-4 rounded-2xl border border-brand-primary/25 bg-brand-primary/8 overflow-hidden',
                )}
              >
                <div className="border-b border-white/8 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-200">
                  Your rank
                </div>
                <LeaderboardListRow row={data.me} isMe showReferralCode />
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
