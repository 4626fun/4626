import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'

import { apiFetch } from '@/lib/apiBase'
import {
  getCanonicalMarketingWaitlistPath,
  WAITLIST_REFERRAL_CLICK_SESSION_KEY,
  WAITLIST_REFERRAL_CODE_STORAGE_KEY,
} from '@/lib/auth/waitlistEntry'

type DashboardPointsType = 'invite' | 'total' | 'agent'

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
  pointsType: DashboardPointsType
  totalCount: number
  totalPages: number
  hasMore: boolean
  leaderboard: LeaderboardRow[]
  me: LeaderboardRow | null
}

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

function formatWholeNumber(value: number | null | undefined): string {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(n) ? new Intl.NumberFormat('en-US').format(Math.floor(n)) : '0'
}

function getPointsValue(pointsType: DashboardPointsType, row: LeaderboardRow): number {
  if (pointsType === 'invite') return row.pointsInvite
  if (pointsType === 'agent') return row.pointsAgent
  return row.pointsTotal
}

function buildReferralClickSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `wl-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

export function PublicWaitlistOverview(props: {
  referralCode: string | null
  onContinueWithEmail: () => void
  primaryButtonClassName: string
}) {
  const { referralCode, onContinueWithEmail, primaryButtonClassName } = props
  const [pointsType, setPointsType] = useState<DashboardPointsType>('invite')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null)
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
        const response = await apiFetch(`/api/waitlist/leaderboard?pointsType=${encodeURIComponent(pointsType)}&page=1&limit=5`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        const payload = (await response.json().catch(() => null)) as ApiEnvelope<LeaderboardResponse> | null
        if (!response.ok || !payload?.success || !payload.data) {
          throw new Error(payload?.error || 'Failed to load leaderboard preview.')
        }
        setLeaderboard(payload.data)
        if (!opts?.silent) setError(null)
      } catch (previewError: any) {
        if (!opts?.silent) {
          setError(typeof previewError?.message === 'string' ? previewError.message : 'Failed to load leaderboard preview.')
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
  }, [fetchLeaderboard])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void fetchLeaderboard({ silent: true })
      }
    }
    const intervalId = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [fetchLeaderboard])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (referralCode) {
        window.sessionStorage.setItem(WAITLIST_REFERRAL_CODE_STORAGE_KEY, referralCode)
      } else {
        window.sessionStorage.removeItem(WAITLIST_REFERRAL_CODE_STORAGE_KEY)
      }
    } catch {
      // ignore
    }
  }, [referralCode])

  useEffect(() => {
    if (!referralCode || typeof window === 'undefined') return

    let sessionId = ''
    try {
      sessionId = String(window.sessionStorage.getItem(WAITLIST_REFERRAL_CLICK_SESSION_KEY) ?? '').trim()
      if (!sessionId) {
        sessionId = buildReferralClickSessionId()
        window.sessionStorage.setItem(WAITLIST_REFERRAL_CLICK_SESSION_KEY, sessionId)
      }
    } catch {
      sessionId = buildReferralClickSessionId()
    }

    void apiFetch('/api/referrals/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        referralCode,
        sessionId,
        landingUrl: window.location.href,
      }),
    }).catch(() => null)
  }, [referralCode])

  const rows = leaderboard?.leaderboard ?? []
  const title = pointsType === 'invite' ? 'Invite leaderboard' : pointsType === 'agent' ? 'Agent leaderboard' : 'Total points leaderboard'
  const subtitle = useMemo(() => {
    if (referralCode) {
      return `Invited by ${referralCode}. Verify your email here and the referral will carry into your account setup.`
    }
    return 'Verify your email first. Your own referral link unlocks as soon as the waitlist account is ready.'
  }, [referralCode])

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5">
        <div className="space-y-4">
          <div className="space-y-2">
            {referralCode ? (
              <div className="inline-flex items-center rounded-full border border-brand-primary/25 bg-brand-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-brand-primary">
                Invite: {referralCode}
              </div>
            ) : null}
            <h3 className="text-xl font-semibold tracking-tight text-white">Quiet sign-in, live waitlist context</h3>
            <p className="text-sm text-zinc-300 sm:text-[15px]">{subtitle}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">What comes back</div>
              <div className="mt-2 text-sm font-medium text-white">Leaderboard and invite link</div>
              <p className="mt-1 text-xs text-zinc-500">
                Verify email once, then you can track rank and share a clean invite URL from the same surface.
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">What stays quiet</div>
              <div className="mt-2 text-sm font-medium text-white">Wallet auth until click</div>
              <p className="mt-1 text-xs text-zinc-500">
                The heavy Privy and wallet stack still stays dormant until you intentionally begin sign-in.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={onContinueWithEmail} className={primaryButtonClassName}>
              Continue with email
              <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              to="/leaderboard"
              className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.05]"
            >
              Open leaderboard
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">{title}</div>
            <div className="mt-1 text-sm text-zinc-300">Live public snapshot from the waitlist board.</div>
          </div>
          {busy ? (
            <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {(['invite', 'total', 'agent'] as const).map((nextPointsType) => (
            <button
              key={nextPointsType}
              type="button"
              disabled={busy}
              onClick={() => setPointsType(nextPointsType)}
              className={`rounded-full border px-3 py-1 text-[11px] ${
                pointsType === nextPointsType
                  ? 'border-brand-primary/30 bg-brand-primary/10 text-zinc-100'
                  : 'border-white/8 bg-white/[0.03] text-zinc-500'
              }`}
            >
              {nextPointsType === 'invite' ? 'Invites' : nextPointsType === 'agent' ? 'Agent' : 'Total'}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
          {rows.length > 0 ? (
            <div>
              {rows.map((row) => (
                <div
                  key={`${row.rank}-${row.signupId}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/6 px-4 py-3 last:border-b-0"
                >
                  <div className="text-sm font-medium text-zinc-400">#{row.rank}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">{row.display}</div>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                      {row.referralCode ? <span>{row.referralCode}</span> : null}
                      {row.borderTier >= 1 ? <span>Tier {row.borderTier}</span> : null}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-zinc-100">
                    {formatWholeNumber(getPointsValue(pointsType, row))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-sm text-zinc-500">
              {error ? error : 'No ranked accounts yet.'}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
          <span>{leaderboard ? `${leaderboard.totalCount.toLocaleString()} ranked accounts live right now` : 'Waitlist board updates continuously.'}</span>
          <Link to={getCanonicalMarketingWaitlistPath()} className="text-brand-primary hover:text-brand-300 transition-colors">
            Waitlist entry
          </Link>
        </div>
      </div>
    </div>
  )
}
