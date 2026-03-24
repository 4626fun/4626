import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { apiFetch } from '@/lib/apiBase'
import { getPrivyCapableWaitlistEntryUrl } from '@/lib/auth/waitlistEntry'
import { PageMeta } from '@/components/seo/PageMeta'
import { JoinWaitlistCta } from '@/components/waitlist/JoinWaitlistCta'

type PointsType = 'invite' | 'total' | 'agent'

type LeaderboardRow = {
  rank: number
  signupId: number
  display: string
  referralCode: string | null
  pointsTotal: number
  pointsInvite: number
  pointsAgent: number
  borderTier: number
}

type LeaderboardResponse = {
  page: number
  limit: number
  pointsType: PointsType
  totalCount: number
  totalPages: number
  hasMore: boolean
  leaderboard: LeaderboardRow[]
  me: LeaderboardRow | null
}

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

export function Leaderboard() {
  const [pointsType, setPointsType] = useState<PointsType>('total')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const inFlightRef = useRef(false)

  const title = pointsType === 'invite' ? 'Invite points' : pointsType === 'agent' ? 'Agent points' : 'Total points'

  const fetchLeaderboard = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      if (!opts?.silent) {
        setBusy(true)
        setError(null)
      }
      try {
        const res = await apiFetch(`/api/waitlist/leaderboard?pointsType=${encodeURIComponent(pointsType)}&page=1&limit=50`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        const json = (await res.json().catch(() => null)) as ApiEnvelope<LeaderboardResponse> | null
        if (!res.ok || !json) throw new Error('Leaderboard request failed')
        if (!json.success || !json.data) throw new Error(json.error || 'Leaderboard request failed')
        setData(json.data)
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
    [pointsType],
  )

  useEffect(() => {
    void fetchLeaderboard()
  }, [fetchLeaderboard, pointsType])

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
    return `Showing ${shown} of ${ranked} ranked creators`
  }, [data])

  const meInTop = useMemo(() => {
    if (!data?.me) return false
    return data.leaderboard.some((row) => row.signupId === data.me?.signupId)
  }, [data])

  return (
    <section className="relative overflow-hidden bg-vault-bg text-white min-h-[calc(100vh-0px)]">
      <PageMeta title="Leaderboard" description="See the top creators and contributors on 4626 ranked by invite, agent, and total points." canonicalPath="/leaderboard" />
      <div className="relative max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-medium text-zinc-600 mb-2">4626</div>
            <div className="headline text-3xl sm:text-4xl leading-tight">Leaderboard</div>
            <div className="text-sm text-zinc-600 font-light mt-2">
              Points-based. Earn points by joining, inviting, social actions, Lens/Grove identity sync, and ERC-8004 agent reputation/feedback.
            </div>
            {subtitle ? <div className="text-[11px] text-zinc-700 mt-2">{subtitle}</div> : null}
          </div>
          <JoinWaitlistCta
            className="btn-accent btn-compact h-fit inline-flex items-center"
            showArrow={false}
            onPrivyDisabled={() => window.location.assign(getPrivyCapableWaitlistEntryUrl('needs-session'))}
          >
            Invite friends
          </JoinWaitlistCta>
        </div>

        <div className="mt-8 flex items-center gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-[12px] border ${
              pointsType === 'invite' ? 'border-brand-primary/30 bg-brand-primary/10 text-zinc-200' : 'border-white/8 bg-vault-card/40 text-zinc-600'
            }`}
            onClick={() => setPointsType('invite')}
            disabled={busy}
          >
            Invite points
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-[12px] border ${
              pointsType === 'total' ? 'border-brand-primary/30 bg-brand-primary/10 text-zinc-200' : 'border-white/8 bg-vault-card/40 text-zinc-600'
            }`}
            onClick={() => setPointsType('total')}
            disabled={busy}
          >
            Total points
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-[12px] border ${
              pointsType === 'agent' ? 'border-brand-primary/30 bg-brand-primary/10 text-zinc-200' : 'border-white/8 bg-vault-card/40 text-zinc-600'
            }`}
            onClick={() => setPointsType('agent')}
            disabled={busy}
          >
            Agent points
          </button>
          <div className="text-[11px] text-zinc-700 ml-2">{busy ? 'Loading…' : title}</div>
        </div>

        {error ? (
          <Alert variant="error" className="mt-6">
            {error}
          </Alert>
        ) : null}

        <div className="mt-6 rounded-xl border border-white/8 bg-vault-card/40 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/8 text-[10px] font-medium text-zinc-700">
            <div className="col-span-2">Rank</div>
            <div className="col-span-6">User</div>
            <div className="col-span-4 text-right">Points</div>
          </div>
          {data?.leaderboard?.length ? (
            <div>
              {data.leaderboard.map((r) => {
                const isMe = Boolean(data?.me && data.me.signupId === r.signupId)
                return (
                <div
                  key={`${r.rank}-${r.signupId}`}
                  className={[
                    'grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5',
                    isMe ? 'bg-brand-primary/6' : null,
                    r.borderTier >= 1 ? 'bg-brand-primary/[0.035] border-l-2 border-l-[#0052FF]/30' : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="col-span-2 text-sm text-zinc-300">#{r.rank}</div>
                  <div className="col-span-6 text-sm text-zinc-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="font-mono truncate">{r.display}</div>
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
                  <div className="col-span-4 text-right text-sm text-zinc-200 tabular-nums">
                    {pointsType === 'invite' ? r.pointsInvite : pointsType === 'agent' ? r.pointsAgent : r.pointsTotal}
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            <div className="px-4 py-6 text-sm text-zinc-600">No ranked creators yet.</div>
          )}
        </div>

        {data?.me && !meInTop ? (
          <div className="mt-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/8 text-[11px] font-medium text-brand-300">Your rank</div>
            <div className="grid grid-cols-12 gap-2 px-4 py-3">
              <div className="col-span-2 text-sm text-zinc-300">#{data.me.rank}</div>
              <div className="col-span-6 text-sm text-zinc-200">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="font-mono truncate">{data.me.display}</div>
                  <div className="shrink-0 inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-300">
                    You
                  </div>
                </div>
                {data.me.referralCode ? <div className="text-[11px] text-zinc-700">code: {data.me.referralCode}</div> : null}
              </div>
              <div className="col-span-4 text-right text-sm text-zinc-200 tabular-nums">
                {pointsType === 'invite' ? data.me.pointsInvite : pointsType === 'agent' ? data.me.pointsAgent : data.me.pointsTotal}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
