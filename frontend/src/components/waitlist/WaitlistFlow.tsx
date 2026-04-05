import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCrossAppAccounts, useLogin, usePrivy } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { Check, CheckCircle2, Copy, Loader2 } from 'lucide-react'
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi'

import { apiFetch } from '@/lib/apiBase'
import { buildAppEntryUrl } from '@/lib/auth/appEntry'
import { runCanonicalizationPipeline } from '@/lib/auth/canonicalization'
import {
  clearStoredWaitlistReferralCode,
  getMarketingWaitlistEntryUrl,
  getMarketingWaitlistReferralUrl,
  readStoredWaitlistReferralCode,
  storeWaitlistReferralCode,
} from '@/lib/auth/waitlistEntry'
import { resolveBaseAppInviteUrl } from '@/lib/baseAppInvite'
import { getAppBaseUrl } from '@/lib/host'
import { ZORA_PRIVY_APP_ID, usePrivyClientStatus } from '@/lib/privy/client'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import { performZoraCrossAppAuth } from '@/lib/privy/zoraCrossApp'
import {
  type ApiEnvelope,
  type OnboardingBootstrapResponse,
  type OwnerDelegationFlags,
  type PrepareOwnerResponse,
  buildOwnerDelegationError,
  deriveOwnerDelegationFlags,
  sendPreparedOwnerTx as submitPreparedOwnerTx,
} from '@/lib/wallet/onboardingWallet'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { isPrivyRedirectUrlNotAllowedError, sanitizeCrossAppRedirectUrlForAuth } from '@/hooks/siweAuthCrossApp'

import type { Variant } from './waitlistTypes'
import {
  mergeCanonicalWaitlistAccount,
  type WaitlistStep,
  resolveWaitlistStep,
  shouldAutoBootstrapWaitlistSession,
  shouldAutoHandoffApprovedAccount,
  shouldAutoStartWaitlistAuth,
} from './waitlistFlowState'
import {
  isEmailAlreadyLinkedAuthError,
  isRecoveryRequiredAuthError,
  runWaitlistPrivyLogout,
  shouldStopWaitlistAutoAuthRetry,
} from './waitlistAuthState'
import {
  buildWaitlistEmailLoginOptions,
  buildWaitlistRecoveryLoginOptions,
} from './waitlistLoginOptions'
import {
  type WaitlistDoneUi,
  type WaitlistEmailUi,
  canEnterAppFromAccountState,
  deriveWaitlistAuthUi,
  deriveWaitlistDoneUi,
} from './waitlistFlowUi'

type AccountsSummary = {
  privyUserId: string
  email: string | null
  emailVerified: boolean
  appAccessStatus: string | null
  linkedMethods: Record<string, string[]>
  accountSignals: {
    linked: boolean
    canonicalCswAddress: string | null
    creatorCoin: { address: string } | null
    zoraHandle: string | null
    lastResolvedAt: string | null
  }
  score: { points: number; tier: number }
}

type WaitlistBootstrapResponse =
  | {
      requiresPrivyAuth: true
      email: string | null
      waitlistEntryId: number | null
    }
  | ({
      requiresPrivyAuth: false
    } & AccountsSummary)

type ZoraResolveResponse = {
  canonicalCswAddress: string | null
  creatorCoin: { address: string; name: string | null; symbol: string | null; imageUrl: string | null } | null
  zoraHandle: string | null
}

type HandoffCreateResponse = {
  code: string
  expiresAt: string
}

type WaitlistPositionResponse = {
  email: string | null
  signupId: number
  profileCompletedAt: string | null
  referralCode: string | null
  borderTier: number
  points: {
    total: number
    invite: number
    signup: number
    tasks: number
    csw: number
    social: number
    bonus: number
  }
  rank: {
    invite: number | null
    total: number | null
  }
  totalCount: number
  totalAheadInvite: number | null
  percentileInvite: number | null
  referrals: {
    qualifiedCount: number
    pendingCount: number
    pendingCountCapped: number
    pendingCap: number
  }
}

type DashboardLeaderboardRow = {
  rank: number
  signupId: number
  display: string
  referralCode: string | null
  pointsTotal: number
  pointsInvite: number
  pointsAgent: number
  borderTier: number
}

type DashboardLeaderboardResponse = {
  page: number
  limit: number
  pointsType: string
  totalCount: number
  totalPages: number
  hasMore: boolean
  leaderboard: DashboardLeaderboardRow[]
  me: DashboardLeaderboardRow | null
}

const HANDOFF_QUERY_KEY = 'cv_handoff'
const FLOW_TIMEOUT_MS = 20_000

function privyJsonHeaders(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-Privy-Token': token }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(t))
  })
}

function readApiErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const maybeError = (payload as { error?: unknown }).error
    if (typeof maybeError === 'string' && maybeError.trim()) return maybeError
  }
  return fallback
}

function isSessionEmailMismatchError(message: unknown): boolean {
  const text = typeof message === 'string' ? message.toLowerCase() : ''
  return text.includes('email does not match authenticated user') || text.includes('session email mismatch')
}

function isPrivyLoginBootstrapError(error: unknown): boolean {
  const text = typeof error === 'string' ? error : typeof (error as any)?.message === 'string' ? (error as any).message : ''
  const normalized = text.trim().toLowerCase()
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('blocked by cors') ||
    (normalized.includes('access-control-allow-origin') && normalized.includes('privy')) ||
    normalized.includes('email verification is unavailable in this client')
  )
}

function isWalletProviderCollisionError(error: unknown): boolean {
  const text = typeof error === 'string' ? error : typeof (error as any)?.message === 'string' ? (error as any).message : ''
  const normalized = text.trim().toLowerCase()
  if (!normalized) return false
  return (
    normalized.includes('cannot set property ethereum of #<window> which has only a getter') ||
    normalized.includes('cannot redefine property: ethereum') ||
    normalized.includes('wallet proxy not initialized')
  )
}

async function maybeCallMethod(target: any, methodNames: string[], args: unknown[] = []): Promise<boolean> {
  if (!target) return false
  for (const methodName of methodNames) {
    if (typeof target?.[methodName] === 'function') {
      await target[methodName](...args)
      return true
    }
  }
  return false
}

function shortAddress(value: string | null | undefined): string {
  if (!value) return '—'
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`
}

function formatWholeNumber(value: number | null | undefined): string {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(n) ? new Intl.NumberFormat('en-US').format(Math.floor(n)) : '0'
}

function formatRankLabel(value: number | null | undefined): string {
  const n = typeof value === 'number' ? value : Number(value ?? NaN)
  return Number.isFinite(n) && n > 0 ? `#${Math.floor(n)}` : 'Unranked'
}

function formatLeaderboardPointsTooltip(row: DashboardLeaderboardRow): string {
  return `Total ${formatWholeNumber(row.pointsTotal)} • Invite ${formatWholeNumber(row.pointsInvite)} • Agent ${formatWholeNumber(row.pointsAgent)}`
}

const RECOVERY_REQUIRED_MESSAGE = 'This email already has a 4626 account. Use existing account sign-in to continue.'
const SESSION_MISMATCH_MESSAGE = 'Signed in as a different account. Click Continue with email to try again.'

function getAccessStatusMeta(status: string | null | undefined): {
  label: string
  tone: string
  description: string
} {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase()
  if (normalized === 'approved') {
    return {
      label: 'Approved',
      tone: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
      description: 'Admin approval is in. Finish wallet readiness to unlock the app.',
    }
  }
  if (normalized === 'denied') {
    return {
      label: 'Not approved',
      tone: 'border-rose-400/25 bg-rose-500/10 text-rose-200',
      description: 'This account is not approved for app access right now.',
    }
  }
  return {
    label: 'Pending review',
    tone: 'border-amber-400/25 bg-amber-500/10 text-amber-100',
    description: 'Admin approval controls entry into v1. Use the actions below to strengthen your spot.',
  }
}

function useWaitlistAttemptState() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [recoveryRequired, setRecoveryRequired] = useState(false)
  const attemptInFlightRef = useRef(false)

  const clearFeedback = useCallback(() => {
    setError(null)
    setNotice(null)
  }, [])

  const beginAttempt = useCallback((): boolean => {
    if (busy || attemptInFlightRef.current) return false
    attemptInFlightRef.current = true
    setBusy(true)
    clearFeedback()
    setRecoveryRequired(false)
    return true
  }, [busy, clearFeedback])

  const endAttempt = useCallback(() => {
    attemptInFlightRef.current = false
    setBusy(false)
  }, [])

  return {
    busy,
    setBusy,
    error,
    setError,
    notice,
    setNotice,
    recoveryRequired,
    setRecoveryRequired,
    attemptInFlightRef,
    clearFeedback,
    beginAttempt,
    endAttempt,
  }
}

function CoinbaseLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#0052FF" />
      <path
        d="M12 4.8C8.03 4.8 4.8 8.03 4.8 12S8.03 19.2 12 19.2 19.2 15.97 19.2 12 15.97 4.8 12 4.8Zm0 9.9c-1.48 0-2.7-1.22-2.7-2.7S10.52 9.3 12 9.3s2.7 1.22 2.7 2.7-1.22 2.7-2.7 2.7Z"
        fill="white"
      />
    </svg>
  )
}

function ZoraLogo({ className }: { className?: string }) {
  return (
    <img
      src="/protocols/zora.svg"
      alt="Zora"
      aria-hidden="true"
      className={className}
      style={{ borderRadius: '50%' }}
    />
  )
}

function WalletPathCard(props: {
  eyebrow: string
  title: string
  body: string
  bestFor: string
  icon: ReactNode
  emphasized?: boolean
  busy?: boolean
  busyLabel: string
  label: string
  onClick: () => void
}) {
  const { eyebrow, title, body, bestFor, icon, emphasized = false, busy = false, busyLabel, label, onClick } = props

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      className={`flex h-full flex-col rounded-2xl border p-4 sm:p-5 ${
        emphasized
          ? 'border-brand-primary/35 bg-[linear-gradient(180deg,rgba(91,168,255,0.12)_0%,rgba(91,168,255,0.04)_100%)] shadow-[0_0_0_1px_rgba(91,168,255,0.08)]'
          : 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</span>
            {emphasized ? (
              <span className="rounded-full border border-brand-primary/25 bg-brand-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-brand-primary">
                Recommended
              </span>
            ) : null}
          </div>
          <div className="text-sm font-semibold text-white sm:text-[15px]">{title}</div>
          <p className="text-xs leading-relaxed text-zinc-400 sm:text-[13px]">{body}</p>
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
            emphasized
              ? 'border-brand-primary/25 bg-brand-primary/15 shadow-[0_8px_30px_rgba(91,168,255,0.12)]'
              : 'border-white/10 bg-white/[0.04]'
          }`}
        >
          {icon}
        </div>
      </div>

      <div
        className={`mt-4 rounded-xl border px-3 py-2 text-[11px] sm:text-xs ${
          emphasized ? 'border-brand-primary/20 bg-brand-primary/8 text-brand-primary/90' : 'border-white/8 bg-black/20 text-zinc-400'
        }`}
      >
        <span className="font-medium uppercase tracking-[0.14em] text-[10px]">Best for</span>{' '}
        <span>{bestFor}</span>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-medium transition disabled:opacity-50 ${
          emphasized
            ? 'border border-brand-primary/30 bg-brand-primary/15 text-white hover:bg-brand-primary/20'
            : 'border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]'
        }`}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            {busyLabel}
          </>
        ) : (
          label
        )}
      </button>
    </motion.div>
  )
}

function WaitlistAuthStep(props: {
  hideAuthShell: boolean
  useCompactModalAuthStart: boolean
  authUi: WaitlistEmailUi
  shouldAutoStartAuth: boolean
  busy: boolean
  privyClientStatus: 'disabled' | 'loading' | 'ready'
  error: string | null
  recoveryRequired: boolean
  onContinueAuth: () => void | Promise<void>
  onRecoverAccount: () => void | Promise<void>
}) {
  const {
    hideAuthShell,
    useCompactModalAuthStart,
    authUi,
    shouldAutoStartAuth,
    busy,
    privyClientStatus,
    error,
    recoveryRequired,
    onContinueAuth,
    onRecoverAccount,
  } = props

  const privyReady = privyClientStatus === 'ready'
  const buttonsDisabled = busy || !privyReady

  const signingInIndicator = (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
      <div className="inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
        Opening secure sign-in…
      </div>
    </div>
  )

  return (
    <motion.div
      key="step-auth"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-5"
    >
      {hideAuthShell || useCompactModalAuthStart ? (
        signingInIndicator
      ) : (
        <>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-white">{authUi.title}</h2>
            <p className="text-sm text-zinc-400">{authUi.subtitle}</p>
          </div>

          {shouldAutoStartAuth ? (
            <div className="space-y-3">
              {signingInIndicator}
              <button
                type="button"
                disabled={buttonsDisabled}
                onClick={() => void onContinueAuth()}
                className="btn-secondary btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {authUi.ctaLabel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={buttonsDisabled}
              onClick={() => void onContinueAuth()}
              className="btn-accent btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {authUi.busyLabel}
                </>
              ) : !privyReady ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin opacity-60" />
                  Loading sign-in…
                </>
              ) : (
                authUi.ctaLabel
              )}
            </button>
          )}
          {!recoveryRequired ? (
            <div className="mt-2 text-center">
              <button
                type="button"
                disabled={buttonsDisabled}
                onClick={() => void onRecoverAccount()}
                className="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition hover:text-zinc-200 disabled:opacity-60"
              >
                {!privyReady ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin opacity-60" />
                    Loading…
                  </>
                ) : (
                  'Already joined? Recover sign-in'
                )}
              </button>
            </div>
          ) : null}
        </>
      )}

      {error ? (
        <div className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <div>{error}</div>
          {recoveryRequired ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRecoverAccount()}
              className="inline-flex items-center rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-60"
            >
              Recover account sign-in
            </button>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  )
}

function MiniStat({ label, value, description }: { label: string; value: ReactNode; description?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
      {description ? <div className="mt-1 text-xs text-zinc-500">{description}</div> : null}
    </div>
  )
}

function WaitlistWalletStep(props: {
  accessStatusMeta: ReturnType<typeof getAccessStatusMeta>
  dashboardSubtitle: string
  totalPoints: number
  totalRank: number | null
  inviteRank: number | null
  qualifiedReferrals: number
  pendingReferrals: number
  walletSelectionNeeded: boolean
  ownerInstallNeeded: boolean
  notice: string | null
  dashboardError: string | null
  waitlistPosition: WaitlistPositionResponse | null
  personalReferralCode: string | null
  personalReferralLink: string | null
  copiedReferralLink: boolean
  leaderboardRows: DashboardLeaderboardRow[]
  leaderboardMe: DashboardLeaderboardRow | null
  leaderboardMeInTop: boolean
  dashboardBusy: boolean
  busy: boolean
  ownerDelegationVerified: boolean | null
  canonicalCswAddress: string | null
  embeddedEoaAddress: string | null
  ownerDelegationFlags: OwnerDelegationFlags | null
  error: string | null
  onCopyReferralLink: () => void | Promise<void>
  onContinueWithBase: () => void | Promise<void>
  onContinueWithZora: () => void | Promise<void>
  onCreateInBaseApp: () => void
  onEnable4626Signing: () => void | Promise<void>
  onRefreshStatus: () => void
}) {
  const {
    accessStatusMeta,
    dashboardSubtitle,
    totalPoints,
    totalRank,
    inviteRank,
    qualifiedReferrals,
    pendingReferrals,
    walletSelectionNeeded,
    ownerInstallNeeded,
    notice,
    dashboardError,
    waitlistPosition,
    personalReferralCode,
    personalReferralLink,
    copiedReferralLink,
    leaderboardRows,
    leaderboardMe,
    leaderboardMeInTop,
    dashboardBusy,
    busy,
    ownerDelegationVerified,
    canonicalCswAddress,
    embeddedEoaAddress,
    ownerDelegationFlags,
    error,
    onCopyReferralLink,
    onContinueWithBase,
    onContinueWithZora,
    onCreateInBaseApp,
    onEnable4626Signing,
    onRefreshStatus,
  } = props

  return (
    <motion.div
      key="step-wallet"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-5"
    >
      <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(91,168,255,0.12)_0%,rgba(7,10,18,0.86)_100%)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${accessStatusMeta.tone}`}>
              {accessStatusMeta.label}
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight text-white">Climb the waitlist</h2>
              <p className="max-w-xl text-sm text-zinc-300">{dashboardSubtitle}</p>
            </div>
            <p className="text-xs text-zinc-500">{accessStatusMeta.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Total points</div>
              <div className="mt-2 text-2xl font-semibold text-white">{formatWholeNumber(totalPoints)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Total rank</div>
              <div className="mt-2 text-2xl font-semibold text-white">{formatRankLabel(totalRank)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Invite rank</div>
          <div className="mt-2 text-xl font-semibold text-white">{formatRankLabel(inviteRank)}</div>
          <div className="mt-1 text-xs text-zinc-500">Leaderboard position by referral momentum.</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Qualified referrals</div>
          <div className="mt-2 text-xl font-semibold text-white">{formatWholeNumber(qualifiedReferrals)}</div>
          <div className="mt-1 text-xs text-zinc-500">Friends who fully linked into the system.</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Pending referrals</div>
          <div className="mt-2 text-xl font-semibold text-white">{formatWholeNumber(pendingReferrals)}</div>
          <div className="mt-1 text-xs text-zinc-500">Signed up but not fully qualified yet.</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Wallet readiness</div>
          <div className="mt-2 text-sm font-semibold text-white">
            {walletSelectionNeeded ? 'CSW not linked' : ownerInstallNeeded ? 'Signer install pending' : 'Ready'}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {walletSelectionNeeded
              ? 'Connect the wallet you want 4626 to recognize.'
              : ownerInstallNeeded
                ? 'One owner-install transaction is still left.'
                : 'Your canonical wallet path is set.'}
          </div>
        </div>
      </div>

      {notice ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      {dashboardError ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {dashboardError}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Points breakdown</div>
              <div className="mt-1 text-sm text-zinc-300">The mix that determines how far up the queue you show up.</div>
            </div>
            <Link to="/accounts" className="text-xs text-brand-primary hover:text-brand-300 transition-colors">
              Manage account
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat label="Signup" value={formatWholeNumber(waitlistPosition?.points.signup ?? 0)} />
            <MiniStat label="Invites" value={formatWholeNumber(waitlistPosition?.points.invite ?? 0)} />
            <MiniStat label="Social" value={formatWholeNumber(waitlistPosition?.points.social ?? 0)} />
            <MiniStat label="Wallet / CSW" value={formatWholeNumber(waitlistPosition?.points.csw ?? 0)} />
          </div>

          <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/8 p-4">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-brand-primary">Priority move</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {walletSelectionNeeded ? 'Link the CSW you want 4626 to recognize.' : 'Finish 4626 signing on your canonical CSW.'}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-300">
              {walletSelectionNeeded
                ? 'This is the clearest wallet signal you can give the system while admin approval is pending.'
                : ownerInstallNeeded
                  ? 'Installing the embedded signer proves 4626 can actually act through your canonical wallet once you are approved.'
                  : 'Your wallet setup already puts you in the strongest readiness bucket.'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Referral link</div>
                <div className="mt-1 text-sm text-zinc-300">Share one clean invite URL instead of sending people back through messy query strings.</div>
              </div>
              {personalReferralCode ? (
                <div className="rounded-full border border-brand-primary/25 bg-brand-primary/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-brand-primary">
                  {personalReferralCode}
                </div>
              ) : null}
            </div>

            {personalReferralLink ? (
              <>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="truncate font-mono text-sm text-zinc-100">{personalReferralLink}</div>
                  <p className="mt-2 text-xs text-zinc-500">
                    New signups land on the waitlist signup flow first, then unlock their ranking and referral view after verification.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStat label="Qualified" value={formatWholeNumber(qualifiedReferrals)} description="Friends fully linked and counted." />
                  <MiniStat label="Pending" value={formatWholeNumber(pendingReferrals)} description="People who still need to finish setup." />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void onCopyReferralLink()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.05] sm:flex-1"
                  >
                    {copiedReferralLink ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                    {copiedReferralLink ? 'Copied' : 'Copy invite link'}
                  </button>
                  <a
                    href={personalReferralLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.05] sm:flex-1"
                  >
                    Open invite route
                  </a>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-sm text-zinc-500">
                Your invite code will appear here as soon as the waitlist profile finishes syncing.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Waitlist leaderboard</div>
                <div className="mt-1 text-sm text-zinc-300">Ranked by total points after verified signup.</div>
              </div>
              <Link to="/leaderboard" className="text-xs text-brand-primary hover:text-brand-300 transition-colors">
                Full board
              </Link>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              {dashboardBusy && leaderboardRows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-500">Loading leaderboard…</div>
              ) : leaderboardRows.length > 0 ? (
                <div>
                  {leaderboardRows.map((row) => {
                    const isMe = Boolean(leaderboardMe && leaderboardMe.signupId === row.signupId)
                    return (
                      <div
                        key={`${row.rank}-${row.signupId}`}
                        className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/6 px-4 py-3 last:border-b-0 ${
                          isMe ? 'bg-brand-primary/6' : ''
                        }`}
                      >
                        <div className="text-sm font-medium text-zinc-400">#{row.rank}</div>
                        <div className="min-w-0">
                          <div className="truncate text-sm text-white">{row.display}</div>
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                            {row.referralCode ? <span>{row.referralCode}</span> : null}
                            {row.borderTier >= 1 ? <span>Tier {row.borderTier}</span> : null}
                            {isMe ? <span className="text-brand-primary">You</span> : null}
                          </div>
                        </div>
                        <div className="text-sm font-semibold tabular-nums text-zinc-100" title={formatLeaderboardPointsTooltip(row)}>
                          {formatWholeNumber(row.pointsTotal)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="px-4 py-6 text-sm text-zinc-500">No ranked accounts yet.</div>
              )}
            </div>

            {!leaderboardMeInTop && leaderboardMe ? (
              <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-brand-primary">Your standing</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">{leaderboardMe.display}</div>
                    <div className="text-xs text-zinc-500">{formatRankLabel(leaderboardMe.rank)}</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-zinc-100" title={formatLeaderboardPointsTooltip(leaderboardMe)}>
                    {formatWholeNumber(leaderboardMe.pointsTotal)}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Wallet actions</div>
            <div className="mt-1 text-sm text-zinc-300">
              Optional while you wait for approval, but these actions move your account closer to app-readiness.
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onRefreshStatus}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Refresh status
          </button>
        </div>

        {walletSelectionNeeded ? (
          <>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <WalletPathCard
                eyebrow="Existing CSW"
                title="Link Base Smart Wallet"
                body="Use your existing Coinbase Smart Wallet from Base app and keep that wallet as the canonical CSW for 4626."
                bestFor="You already use Base app and want to keep that smart wallet."
                icon={<CoinbaseLogo className="h-6 w-6" />}
                busy={busy}
                busyLabel="Linking Base wallet..."
                label="Link Base Smart Wallet"
                onClick={() => void onContinueWithBase()}
              />
              <WalletPathCard
                eyebrow="Existing CSW"
                title="Link Zora Smart Wallet"
                body="Choose this when your canonical Coinbase Smart Wallet is already attached to your Zora account."
                bestFor="Your Zora account already resolves to the CSW you want 4626 to use."
                icon={<ZoraLogo className="h-6 w-6 rounded-full" />}
                busy={busy}
                busyLabel="Linking Zora wallet..."
                label="Link Zora Smart Wallet"
                onClick={() => void onContinueWithZora()}
              />
              <div className="lg:col-span-2">
                <WalletPathCard
                  eyebrow="New Base wallet"
                  title="Create new wallet in Base app"
                  body="Start a new Coinbase Smart Wallet in Base app with the 4626 referral flow, then come back here and continue setup."
                  bestFor="You do not have a CSW yet, or you want a fresh Base-native setup."
                  icon={<CoinbaseLogo className="h-6 w-6" />}
                  emphasized
                  busy={busy}
                  busyLabel="Opening Base app..."
                  label="Create new wallet in Base app"
                  onClick={onCreateInBaseApp}
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Quick guide</p>
              <div className="space-y-2 text-xs text-zinc-400">
                <div>
                  Pick <span className="text-zinc-200">Link Base Smart Wallet</span> when you already use Base app and want that CSW to stay canonical.
                </div>
                <div>
                  Pick <span className="text-zinc-200">Link Zora Smart Wallet</span> when Zora already resolves to the wallet you want 4626 to use.
                </div>
                <div>
                  Pick <span className="text-zinc-200">Create new wallet in Base app</span> when you do not have a CSW yet or want a fresh Base-native setup.
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CoinbaseLogo className="h-4 w-4 shrink-0" />
                <span className="text-zinc-500">Canonical CSW</span>
                <span className="font-mono text-zinc-200">{shortAddress(canonicalCswAddress)}</span>
              </div>
              {embeddedEoaAddress ? (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Privy embedded EOA</span>
                  <span className="font-mono text-zinc-200">{shortAddress(embeddedEoaAddress)}</span>
                </div>
              ) : null}
              <div className={`text-xs ${ownerDelegationVerified ? 'text-emerald-300' : 'text-amber-200'}`}>
                {ownerDelegationVerified
                  ? '4626 signing is enabled on this wallet.'
                  : '4626 signing is not enabled yet. One owner-install transaction is still required.'}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Enable 4626 signing</div>
                <span className={`text-[10px] font-medium uppercase tracking-[0.18em] ${ownerDelegationVerified ? 'text-emerald-300' : 'text-brand-primary'}`}>
                  {ownerDelegationVerified ? 'Complete' : 'Recommended'}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                This adds your Privy embedded signer as an owner on the canonical CSW. You will sign one transaction with the wallet that currently owns it.
              </p>
              <p className="text-xs text-zinc-500">
                If the current owner wallet is not connected in this browser yet, reconnect it first and then retry.
              </p>
              <button
                type="button"
                disabled={busy || !ownerInstallNeeded}
                onClick={() => void onEnable4626Signing()}
                className="btn-secondary btn-no-icon inline-flex"
              >
                {busy ? 'Preparing…' : ownerDelegationVerified ? '4626 signing enabled' : 'Enable 4626 signing'}
              </button>
            </div>
          </div>
        )}

        {ownerDelegationFlags ? (
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 text-xs text-amber-100 space-y-1">
            {ownerDelegationFlags.needsBaseAppSetup ? (
              <div>
                Finish Coinbase Smart Wallet setup in Base app, then return here and retry.
                {ownerDelegationFlags.baseAppUrl ? (
                  <>
                    {' '}
                    <a
                      href={ownerDelegationFlags.baseAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      Open Base app
                    </a>
                    .
                  </>
                ) : null}
              </div>
            ) : null}
            {ownerDelegationFlags.needsEmbeddedWallet ? (
              <div>Privy embedded wallet provisioning is still settling. Retry in a moment.</div>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          to="/accounts"
          className="btn-accent btn-no-icon inline-flex w-full items-center justify-center rounded-xl py-3 text-sm font-medium sm:flex-1"
        >
          Go to accounts
        </Link>
        <Link
          to="/leaderboard"
          className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.04] sm:flex-1"
        >
          Open full leaderboard
        </Link>
      </div>
    </motion.div>
  )
}

function WaitlistDoneStep(props: {
  doneUi: WaitlistDoneUi
  accountCanonicalCswAddress: string | null
  canEnterApp: boolean
  enterAppBusy: boolean
  onEnterApp: () => void | Promise<void>
}) {
  const { doneUi, accountCanonicalCswAddress, canEnterApp, enterAppBusy, onEnterApp } = props
  return (
    <motion.div
      key="step-done"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-5"
    >
      <div className="flex flex-col items-center text-center space-y-3 pt-2">
        <motion.div
          className="relative"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.05 }}
        >
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(0,52,204,0.35) 0%, rgba(91,168,255,0.18) 100%)',
              border: '1px solid rgba(91,168,255,0.28)',
            }}
          >
            <CheckCircle2 className="h-5 w-5 text-[#7DBCFF]" />
          </div>
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={{ border: '1px solid rgba(91,168,255,0.35)' }}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
          />
        </motion.div>

        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-white">{doneUi.title}</h2>
          <p className="text-sm text-zinc-400 max-w-xs mx-auto">{doneUi.subtitle}</p>
          {accountCanonicalCswAddress ? (
            <p className="text-xs text-zinc-500">
              Canonical CSW <span className="font-mono text-zinc-300">{shortAddress(accountCanonicalCswAddress)}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {canEnterApp ? (
          <button
            type="button"
            onClick={() => void onEnterApp()}
            disabled={enterAppBusy}
            className="btn-accent btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {enterAppBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Entering App…
              </>
            ) : (
              doneUi.primaryLabel
            )}
          </button>
        ) : (
          <Link
            to="/accounts"
            className="btn-accent btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center"
          >
            {doneUi.primaryLabel}
          </Link>
        )}

        {doneUi.secondaryLabel ? (
          <Link
            to="/accounts"
            className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 rounded py-1 inline-block"
          >
            {doneUi.secondaryLabel}
          </Link>
        ) : null}
      </div>
    </motion.div>
  )
}

export function WaitlistFlow(props: {
  variant?: Variant
  sectionId?: string
  autoStartAuth?: boolean
  suppressAuthShell?: boolean
}) {
  const variant = props.variant ?? 'embedded'
  const sectionId = props.sectionId ?? 'waitlist'

  const privy = usePrivy()
  const privyClientStatus = usePrivyClientStatus()
  const { login } = useLogin({})
  const { loginWithCrossAppAccount, linkCrossAppAccount } = useCrossAppAccounts()
  const { data: walletClient } = useWalletClient()
  const { chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()

  const privyAuthed = privy.authenticated
  const shouldDestroyPrivySession = privyAuthed && privyClientStatus === 'ready'
  const { getAccessToken } = privy
  const { ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()

  const [step, setStep] = useState<WaitlistStep>('auth')

  const {
    busy,
    setBusy,
    error,
    setError,
    notice,
    setNotice,
    recoveryRequired,
    setRecoveryRequired,
    attemptInFlightRef: authAttemptInFlightRef,
    clearFeedback,
    beginAttempt: beginAuthAttempt,
    endAttempt: endAuthAttempt,
  } = useWaitlistAttemptState()
  const [enterAppBusy, setEnterAppBusy] = useState(false)
  const [ownerDelegationFlags, setOwnerDelegationFlags] = useState<OwnerDelegationFlags | null>(null)
  const [ownerDelegationVerified, setOwnerDelegationVerified] = useState<boolean | null>(null)
  const [embeddedEoaAddress, setEmbeddedEoaAddress] = useState<string | null>(null)

  const [account, setAccount] = useState<AccountsSummary | null>(null)
  const [dashboardBusy, setDashboardBusy] = useState(false)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [waitlistPosition, setWaitlistPosition] = useState<WaitlistPositionResponse | null>(null)
  const [leaderboard, setLeaderboard] = useState<DashboardLeaderboardResponse | null>(null)
  const [copiedReferralLink, setCopiedReferralLink] = useState(false)
  const authAutoAttemptedRef = useRef(false)
  const authBootstrapAutoAttemptedRef = useRef(false)
  const recoveryAutoRetryRef = useRef(false)
  const appHandoffAutoAttemptedRef = useRef(false)
  const dashboardRequestSeqRef = useRef(0)
  const privyLogoutRef = useRef<null | (() => Promise<void>)>(null)

  const isPage = variant === 'page'

  const wrapClass = isPage ? 'mx-auto w-full max-w-4xl' : 'w-full'
  const innerClass = isPage
    ? 'card rounded-2xl border border-white/10 bg-black/50 p-6 sm:p-8 space-y-6'
    : 'space-y-6'
  const activeReferralCode = useMemo(() => readStoredWaitlistReferralCode(), [])
  const enterAppUrl = useMemo(() => buildAppEntryUrl(getAppBaseUrl()), [])
  const redirectToCanonicalWaitlist = useCallback(() => {
    if (typeof window === 'undefined') return false
    const target = getMarketingWaitlistEntryUrl()
    const current = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
    if (target === current) return false
    window.location.assign(target)
    return true
  }, [])

  useEffect(() => {
    privyLogoutRef.current = async () => {
      if (!shouldDestroyPrivySession) return
      await privy.logout().catch(() => null)
    }
  }, [privy, shouldDestroyPrivySession])

  useEffect(() => {
    if (!activeReferralCode) return
    storeWaitlistReferralCode(activeReferralCode)
  }, [activeReferralCode])

  useEffect(() => {
    if (!copiedReferralLink || typeof window === 'undefined') return
    const timeoutId = window.setTimeout(() => setCopiedReferralLink(false), 1600)
    return () => window.clearTimeout(timeoutId)
  }, [copiedReferralLink])

  const resetResolvedAccountState = useCallback(() => {
    setAccount(null)
    setOwnerDelegationFlags(null)
    setOwnerDelegationVerified(null)
    setEmbeddedEoaAddress(null)
    setWaitlistPosition(null)
    setLeaderboard(null)
  }, [])

  const attemptRecoveryAutoRetry = useCallback(async (): Promise<boolean> => {
    if (recoveryAutoRetryRef.current) return false
    recoveryAutoRetryRef.current = true
    authAutoAttemptedRef.current = true
    resetResolvedAccountState()
    await runWaitlistPrivyLogout({ logout: privyLogoutRef.current, shouldLogout: shouldDestroyPrivySession })
    await login(buildWaitlistRecoveryLoginOptions() as any)
    return true
  }, [login, resetResolvedAccountState, shouldDestroyPrivySession])

  const runBootstrap = useCallback(async (): Promise<AccountsSummary | null> => {
    let bootstrappedCanonicalWallet: OnboardingBootstrapResponse | null = null
    const readPrivyToken = async () =>
      withTimeout(
        getAccessToken(),
        FLOW_TIMEOUT_MS,
        'Sign-in token',
      ).catch(() => null)
    let token = await readPrivyToken()
    if (!token && privyAuthed) {
      await new Promise<void>((resolve) => setTimeout(resolve, 250))
      token = await readPrivyToken()
    }
    if (!token && privyAuthed) {
      await new Promise<void>((resolve) => setTimeout(resolve, 500))
      token = await readPrivyToken()
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) {
      headers['X-Privy-Token'] = token
      try {
        let canonicalization = await withTimeout(
          runCanonicalizationPipeline({
            privyToken: token,
          }),
          FLOW_TIMEOUT_MS,
          'Account sync',
        )
        if (!canonicalization.onboardingBootstrapped && canonicalization.flags.needsEmbeddedWallet) {
          const provisionedWallet = await withTimeout(
            ensureEmbeddedWallet(),
            FLOW_TIMEOUT_MS,
            'Embedded wallet provisioning',
          )
          setEmbeddedEoaAddress(provisionedWallet.address)
          canonicalization = await withTimeout(
            runCanonicalizationPipeline({
              privyToken: token,
            }),
            FLOW_TIMEOUT_MS,
            'Account sync',
          )
        }
        if (canonicalization.onboardingBootstrapped && canonicalization.onboarding) {
          bootstrappedCanonicalWallet = canonicalization.onboarding
          setOwnerDelegationFlags(null)
          setOwnerDelegationVerified(canonicalization.onboarding.privyIsOwner)
          setEmbeddedEoaAddress(canonicalization.onboarding.privyEmbeddedEoaAddress)
        } else {
          const flags = deriveOwnerDelegationFlags(canonicalization.flags)
          setOwnerDelegationFlags(flags)
          setOwnerDelegationVerified(null)
          setEmbeddedEoaAddress(null)
        }
      } catch (canonicalizationError: unknown) {
        if (isRecoveryRequiredAuthError(canonicalizationError)) throw canonicalizationError
        // Waitlist login should not fail on non-recovery canonicalization hiccups.
        // We still continue bootstrap so returning users can re-enter their account.
      }
    }
    const response = await withTimeout(
      apiFetch('/api/waitlist/bootstrap', {
        method: 'POST',
        headers,
        body: JSON.stringify(activeReferralCode ? { referralCode: activeReferralCode } : {}),
      }),
      FLOW_TIMEOUT_MS,
      'Waitlist bootstrap',
    )
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistBootstrapResponse> | null
    if (!response.ok || !payload?.success || !payload.data) {
      const err = new Error(readApiErrorMessage(payload, 'Failed to bootstrap waitlist state.')) as Error & {
        status?: number
        code?: string
        recoveryRequired?: boolean
      }
      err.status = response.status
      const code = typeof (payload as any)?.code === 'string' ? String((payload as any).code).trim() : ''
      if (code) err.code = code
      const recoveryRequired =
        response.status === 409 ||
        Boolean((payload as any)?.recoveryRequired) ||
        code.toUpperCase().includes('RECOVERY_REQUIRED')
      if (recoveryRequired) err.recoveryRequired = true
      throw err
    }

    if (payload.data.requiresPrivyAuth) {
      setStep('auth')
      if (privyAuthed) {
        throw new Error('Sign-in session is still finalizing. Tap Continue once more.')
      }
      return null
    }

    const nextAccount = mergeCanonicalWaitlistAccount(payload.data, bootstrappedCanonicalWallet)
    setAccount(nextAccount)
    setRecoveryRequired(false)
    recoveryAutoRetryRef.current = false
    if (activeReferralCode) clearStoredWaitlistReferralCode()
    if (!nextAccount.emailVerified) {
      setStep('auth')
      setError('Verify your email with 4626 to finish creating this account.')
      return nextAccount
    }
    setStep(resolveWaitlistStep({ account: nextAccount }))
    return nextAccount
  }, [activeReferralCode, ensureEmbeddedWallet, getAccessToken, privyAuthed, setError, setRecoveryRequired])

  const loadDashboard = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!privyAuthed || !account?.email) {
        setWaitlistPosition(null)
        setLeaderboard(null)
        if (!opts?.silent) setDashboardBusy(false)
        return
      }

      const requestSeq = ++dashboardRequestSeqRef.current
      if (!opts?.silent) {
        setDashboardBusy(true)
        setDashboardError(null)
      }

      try {
        const token = await getAccessToken().catch(() => null)
        if (token) {
          await apiFetch('/api/auth/privy', {
            method: 'POST',
            withCredentials: true,
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          }).catch(() => null)
        }

        const [positionResult, leaderboardResult] = await Promise.allSettled([
          apiFetch(`/api/waitlist/position?email=${encodeURIComponent(account.email)}`, {
            method: 'GET',
            withCredentials: true,
            headers: { Accept: 'application/json' },
          }),
          apiFetch(`/api/waitlist/leaderboard?pointsType=total&page=1&limit=6`, {
            method: 'GET',
            withCredentials: true,
            headers: { Accept: 'application/json' },
          }),
        ])

        if (dashboardRequestSeqRef.current !== requestSeq) return

        let nextError: string | null = null

        if (positionResult.status === 'fulfilled') {
          const payload = (await positionResult.value.json().catch(() => null)) as ApiEnvelope<WaitlistPositionResponse | null> | null
          if (positionResult.value.ok && payload?.success) {
            setWaitlistPosition(payload.data ?? null)
          } else {
            nextError = readApiErrorMessage(payload, 'Failed to load your waitlist status.')
            setWaitlistPosition(null)
          }
        } else {
          nextError = positionResult.reason instanceof Error ? positionResult.reason.message : 'Failed to load your waitlist status.'
          setWaitlistPosition(null)
        }

        if (leaderboardResult.status === 'fulfilled') {
          const payload = (await leaderboardResult.value.json().catch(() => null)) as ApiEnvelope<DashboardLeaderboardResponse> | null
          if (leaderboardResult.value.ok && payload?.success && payload.data) {
            setLeaderboard(payload.data)
          } else if (!nextError) {
            nextError = readApiErrorMessage(payload, 'Failed to load the leaderboard.')
          }
        } else if (!nextError) {
          nextError = leaderboardResult.reason instanceof Error ? leaderboardResult.reason.message : 'Failed to load the leaderboard.'
        }

        if (nextError && !opts?.silent) setDashboardError(nextError)
        if (!nextError) setDashboardError(null)
      } catch (dashboardLoadError: any) {
        if (dashboardRequestSeqRef.current !== requestSeq) return
        setDashboardError(
          typeof dashboardLoadError?.message === 'string' ? dashboardLoadError.message : 'Failed to load waitlist insights.',
        )
      } finally {
        if (dashboardRequestSeqRef.current === requestSeq && !opts?.silent) {
          setDashboardBusy(false)
        }
      }
    },
    [account?.email, getAccessToken, privyAuthed],
  )

  const onContinueAuth = useCallback(async () => {
    if (!beginAuthAttempt()) return
    recoveryAutoRetryRef.current = false
    try {
      if (!privyAuthed && privyClientStatus === 'disabled' && redirectToCanonicalWaitlist()) {
        return
      }
      if (!privyAuthed && privyClientStatus === 'loading') {
        setError('Sign-in service is still loading. Please wait a moment and try again.')
        return
      }
      if (privyAuthed) {
        try {
          const linked = await maybeCallMethod(privy, ['linkEmail', 'linkEmailAccount'])
          if (!linked) throw new Error('Email verification is unavailable in this client. Sign out and retry with email.')
        } catch (linkEmailError: unknown) {
          // Privy can throw this when email is already linked; continue by bootstrapping current account state.
          if (!isEmailAlreadyLinkedAuthError(linkEmailError)) throw linkEmailError
        }
        await runBootstrap()
      } else {
        await runWaitlistPrivyLogout({ logout: null })
        try {
          await login(buildWaitlistEmailLoginOptions() as any)
        } catch (loginError: unknown) {
          if (!isWalletProviderCollisionError(loginError)) throw loginError
          await runBootstrap()
        }
      }
    } catch (authError: any) {
      const isRecoveryRequired = isRecoveryRequiredAuthError(authError)
      if (isRecoveryRequired) {
        setRecoveryRequired(true)
        try {
          const startedRecovery = await attemptRecoveryAutoRetry()
          if (startedRecovery) {
            setError(null)
            return
          }
        } catch (recoveryError: any) {
          setError(
            typeof recoveryError?.message === 'string' && recoveryError.message.trim()
              ? recoveryError.message
              : RECOVERY_REQUIRED_MESSAGE,
          )
          return
        }
      }
      setError(
        isRecoveryRequired
          ? RECOVERY_REQUIRED_MESSAGE
          : !privyAuthed && isPrivyLoginBootstrapError(authError) && redirectToCanonicalWaitlist()
            ? 'Redirecting back to the waitlist sign-in flow…'
            : typeof authError?.message === 'string'
            ? authError.message
            : 'Failed to start sign-in.',
      )
    } finally {
      endAuthAttempt()
    }
  }, [
    beginAuthAttempt,
    endAuthAttempt,
    login,
    privy,
    privyAuthed,
    privyClientStatus,
    redirectToCanonicalWaitlist,
    attemptRecoveryAutoRetry,
    runBootstrap,
    setError,
    setRecoveryRequired,
  ])

  const onContinueWithBase = useCallback(async () => {
    if (!beginAuthAttempt()) return
    try {
      if (!privyAuthed) throw new Error('Verify your email first, then continue with wallet setup.')
      const linked = await maybeCallMethod(privy, ['linkWallet'])
      if (!linked) throw new Error('Base wallet linking is unavailable in this environment.')
      const nextAccount = await runBootstrap()
      if (!nextAccount?.accountSignals?.canonicalCswAddress) {
        throw new Error(
          'We could not confirm a Coinbase Smart Wallet from that Base connection. If you need a new one, create one in Base app and then come back.',
        )
      }
    } catch (authError: any) {
      setError(typeof authError?.message === 'string' ? authError.message : 'Failed to link your Base Smart Wallet.')
    } finally {
      endAuthAttempt()
    }
  }, [beginAuthAttempt, endAuthAttempt, privy, privyAuthed, runBootstrap, setError])

  const resolveZora = useCallback(async (token: string): Promise<ZoraResolveResponse | null> => {
    const response = await apiFetch('/api/zora/resolve', {
      method: 'POST',
      headers: privyJsonHeaders(token),
      body: JSON.stringify({}),
    })
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<ZoraResolveResponse> | null
    if (!response.ok || !payload?.success || !payload.data) return null
    return payload.data
  }, [])

  const onContinueWithZora = useCallback(async () => {
    if (!beginAuthAttempt()) return
    try {
      if (!privyAuthed) throw new Error('Verify your email first, then continue with wallet setup.')
      await performZoraCrossAppAuth({
        privyAuthed,
        appId: ZORA_PRIVY_APP_ID,
        linkCrossAppAccount,
        loginWithCrossAppAccount,
        sanitizeRedirect: sanitizeCrossAppRedirectUrlForAuth,
        isRedirectUrlNotAllowedError: isPrivyRedirectUrlNotAllowedError,
      })
      const token = await withTimeout(
        getAccessToken(),
        FLOW_TIMEOUT_MS,
        'Sign-in token',
      ).catch(() => null)
      if (!token) throw new Error('Missing auth token after linking your Zora wallet.')
      const data = await resolveZora(token)
      if (!data?.canonicalCswAddress) {
        throw new Error('We could not find a Coinbase Smart Wallet on that Zora account. Choose Base app if you need to create a new one.')
      }
      const nextAccount = await runBootstrap()
      if (!nextAccount?.accountSignals?.canonicalCswAddress) {
        throw new Error('Your Zora wallet linked, but the canonical Coinbase Smart Wallet is still unavailable. Retry in a moment.')
      }
    } catch (authError: any) {
      setError(typeof authError?.message === 'string' ? authError.message : 'Failed to link your Zora Smart Wallet.')
    } finally {
      endAuthAttempt()
    }
  }, [
    beginAuthAttempt,
    endAuthAttempt,
    getAccessToken,
    linkCrossAppAccount,
    loginWithCrossAppAccount,
    privyAuthed,
    resolveZora,
    runBootstrap,
    setError,
  ])

  const onCreateInBaseApp = useCallback(() => {
    if (typeof window === 'undefined') return
    window.location.assign(ownerDelegationFlags?.baseAppUrl ?? resolveBaseAppInviteUrl())
  }, [ownerDelegationFlags?.baseAppUrl])

  const sendPreparedOwnerTx = useCallback(
    async (txRequest: { chainId: 8453; to: `0x${string}`; data: `0x${string}`; value: '0x0' }) => {
      const token = await getAccessToken()
      if (!token) throw new Error('Missing Privy auth token. Sign in and retry.')
      await submitPreparedOwnerTx({
        txRequest,
        walletClient,
        chainId,
        switchChainAsync,
        authHeaders: async () => privyJsonHeaders(token),
      })
    },
    [chainId, getAccessToken, switchChainAsync, walletClient],
  )

  const onEnable4626Signing = useCallback(async () => {
    if (!account?.accountSignals?.canonicalCswAddress) return
    setBusy(true)
    clearFeedback()
    setOwnerDelegationFlags(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Missing Privy auth token. Sign in and retry.')

      const fetchOnboardingBootstrap = () =>
        apiFetch('/api/onboarding/bootstrap', {
          method: 'POST',
          headers: privyJsonHeaders(token),
          body: JSON.stringify({}),
        })

      const markSigningAlreadyEnabled = async () => {
        setOwnerDelegationVerified(true)
        setNotice('4626 signing is already enabled on your canonical CSW.')
        await runBootstrap()
      }

      let preflightRes = await fetchOnboardingBootstrap()
      let preflightPayload = (await preflightRes.json().catch(() => null)) as ApiEnvelope<OnboardingBootstrapResponse> | null
      if ((!preflightRes.ok || !preflightPayload?.success) && (preflightPayload as any)?.needsEmbeddedWallet === true) {
        const provisionedWallet = await withTimeout(
          ensureEmbeddedWallet(),
          FLOW_TIMEOUT_MS,
          'Embedded wallet provisioning',
        )
        setEmbeddedEoaAddress(provisionedWallet.address)
        preflightRes = await fetchOnboardingBootstrap()
        preflightPayload = (await preflightRes.json().catch(() => null)) as ApiEnvelope<OnboardingBootstrapResponse> | null
      }
      if (!preflightRes.ok || !preflightPayload?.success) {
        throw buildOwnerDelegationError(preflightPayload, 'Signer preflight failed.')
      }
      setEmbeddedEoaAddress(preflightPayload.data?.privyEmbeddedEoaAddress ?? null)
      if (preflightPayload.data?.privyIsOwner) {
        await markSigningAlreadyEnabled()
        return
      }

      const prepareRes = await apiFetch('/api/wallet/prepare-add-privy-owner', {
        method: 'POST',
        headers: privyJsonHeaders(token),
        body: JSON.stringify({}),
      })
      const preparePayload = (await prepareRes.json().catch(() => null)) as ApiEnvelope<PrepareOwnerResponse> | null
      if (!prepareRes.ok || !preparePayload?.success || !preparePayload.data) {
        throw buildOwnerDelegationError(preparePayload, 'Failed to prepare owner install.')
      }
      if (preparePayload.data.alreadyOwner) {
        await markSigningAlreadyEnabled()
        return
      }

      await sendPreparedOwnerTx(preparePayload.data.txRequest)
      setOwnerDelegationVerified(true)
      setNotice('4626 signing is enabled on your canonical CSW.')
      await runBootstrap()
    } catch (ownerError: any) {
      const flags = {
        ...(ownerError?.needsEmbeddedWallet === true ? { needsEmbeddedWallet: true } : null),
        ...(ownerError?.needsBaseAppSetup === true ? { needsBaseAppSetup: true } : null),
        ...(typeof ownerError?.baseAppUrl === 'string' && ownerError.baseAppUrl.trim()
          ? { baseAppUrl: ownerError.baseAppUrl.trim() }
          : null),
      }
      setOwnerDelegationFlags(Object.keys(flags).length > 0 ? flags : null)
      setError(typeof ownerError?.message === 'string' ? ownerError.message : 'Failed to enable 4626 signing.')
    } finally {
      setBusy(false)
    }
  }, [account?.accountSignals?.canonicalCswAddress, clearFeedback, ensureEmbeddedWallet, getAccessToken, runBootstrap, sendPreparedOwnerTx, setBusy, setError, setNotice])

  const onRecoverAccount = useCallback(async () => {
    if (!beginAuthAttempt()) return
    resetResolvedAccountState()
    try {
      if (privyClientStatus === 'disabled' && redirectToCanonicalWaitlist()) {
        return
      }
      if (privyClientStatus === 'loading') {
        setError('Sign-in service is still loading. Please wait a moment and try again.')
        return
      }
      await runWaitlistPrivyLogout({ logout: privyLogoutRef.current, shouldLogout: shouldDestroyPrivySession })
      try {
        await login(buildWaitlistRecoveryLoginOptions() as any)
      } catch (loginError: unknown) {
        if (!isWalletProviderCollisionError(loginError)) throw loginError
        await runBootstrap()
      }
    } catch (recoverError: any) {
      if (isPrivyLoginBootstrapError(recoverError) && redirectToCanonicalWaitlist()) {
        setError('Redirecting back to the waitlist sign-in flow…')
        return
      }
      setError(typeof recoverError?.message === 'string' ? recoverError.message : 'Failed to start account recovery sign-in.')
      setRecoveryRequired(true)
    } finally {
      endAuthAttempt()
    }
  }, [
    beginAuthAttempt,
    endAuthAttempt,
    login,
    privyClientStatus,
    redirectToCanonicalWaitlist,
    resetResolvedAccountState,
    runBootstrap,
    setError,
    setRecoveryRequired,
    shouldDestroyPrivySession,
  ])

  const onEnterApp = useCallback(async () => {
    if (enterAppBusy) return
    setEnterAppBusy(true)
    try {
      let target = enterAppUrl
      let privyToken: string | null = null

      if (privyAuthed) {
        privyToken = await getAccessToken().catch(() => null)
        if (privyToken) {
          await apiFetch('/api/auth/privy', {
            method: 'POST',
            withCredentials: true,
            headers: {
              Authorization: `Bearer ${privyToken}`,
              Accept: 'application/json',
            },
          }).catch(() => null)
        }
      }

      if (target.startsWith('http') && typeof window !== 'undefined') {
        try {
          const parsed = new URL(target)
          if (parsed.origin !== window.location.origin) {
            const handoffRes = await apiFetch('/api/auth/handoff/create', {
              method: 'POST',
              withCredentials: true,
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ privyToken }),
            }).catch(() => null)
            const handoffJson = handoffRes
              ? ((await handoffRes.json().catch(() => null)) as ApiEnvelope<HandoffCreateResponse> | null)
              : null
            const handoffCode =
              handoffRes?.ok && handoffJson?.success && typeof handoffJson?.data?.code === 'string'
                ? handoffJson.data.code.trim()
                : ''
            if (handoffCode) {
              parsed.searchParams.set(HANDOFF_QUERY_KEY, handoffCode)
              target = parsed.toString()
            }
          }
        } catch {
          // Keep original target if URL parsing fails.
        }
        window.location.href = target
        return
      }

      window.location.assign(target)
    } finally {
      setEnterAppBusy(false)
    }
  }, [enterAppBusy, enterAppUrl, getAccessToken, privyAuthed])

  useEffect(() => {
    if (
      !shouldAutoBootstrapWaitlistSession({
        step,
        privyAuthed,
      })
    ) {
      authBootstrapAutoAttemptedRef.current = false
      return
    }
    if (authBootstrapAutoAttemptedRef.current) return

    authBootstrapAutoAttemptedRef.current = true
    let cancelled = false
    authAttemptInFlightRef.current = false
    authAutoAttemptedRef.current = false
    ;(async () => {
      try {
        setBusy(true)
        setError(null)
        await runBootstrap()
      } catch (bootstrapError: any) {
        const message =
          typeof bootstrapError?.message === 'string' ? bootstrapError.message : 'Failed to load account state.'
        const isSessionMismatch = isSessionEmailMismatchError(message)
        const isRecoveryRequired = isRecoveryRequiredAuthError(bootstrapError)
        if (
          shouldStopWaitlistAutoAuthRetry({
            isSessionMismatch,
            isRecoveryRequired,
          })
        ) {
          authAutoAttemptedRef.current = true
        }
        if (isSessionMismatch) {
          resetResolvedAccountState()
          await runWaitlistPrivyLogout({ logout: privyLogoutRef.current, shouldLogout: shouldDestroyPrivySession })
        }
        if (isRecoveryRequired) {
          if (!cancelled) setRecoveryRequired(true)
          try {
            const startedRecovery = await attemptRecoveryAutoRetry()
            if (startedRecovery) {
              if (!cancelled) setError(null)
              return
            }
          } catch (recoveryError: any) {
            if (!cancelled) {
              setError(
                typeof recoveryError?.message === 'string' && recoveryError.message.trim()
                  ? recoveryError.message
                  : RECOVERY_REQUIRED_MESSAGE,
              )
            }
            return
          }
        }
        if (!cancelled) {
          setError(
            isSessionMismatch
              ? SESSION_MISMATCH_MESSAGE
              : isRecoveryRequired
                ? RECOVERY_REQUIRED_MESSAGE
                : message,
          )
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    authAttemptInFlightRef,
    attemptRecoveryAutoRetry,
    privyAuthed,
    resetResolvedAccountState,
    runBootstrap,
    setBusy,
    setError,
    setRecoveryRequired,
    shouldDestroyPrivySession,
    step,
  ])

  useEffect(() => {
    if (step !== 'auth') {
      authAttemptInFlightRef.current = false
      authAutoAttemptedRef.current = false
      authBootstrapAutoAttemptedRef.current = false
      recoveryAutoRetryRef.current = false
      setRecoveryRequired(false)
    }
  }, [authAttemptInFlightRef, setRecoveryRequired, step])

  useEffect(() => {
    if (step !== 'wallet' || !privyAuthed || typeof window === 'undefined' || typeof document === 'undefined') return
    const refresh = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return
      void runBootstrap()
      void loadDashboard({ silent: true })
    }
    const interval = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [loadDashboard, privyAuthed, runBootstrap, step])

  useEffect(() => {
    if (step !== 'wallet' || !privyAuthed) return
    void loadDashboard()
  }, [loadDashboard, privyAuthed, step])

  const authUi = deriveWaitlistAuthUi()
  const shouldAutoStartAuth = shouldAutoStartWaitlistAuth({
    autoStartRequested: props.autoStartAuth === true,
    step,
    privyAuthed,
    privyClientStatus,
    recoveryRequired,
    error,
  })
  const useCompactModalAuthStart = variant === 'modal' && props.autoStartAuth === true && step === 'auth' && !error && !recoveryRequired
  const hideAuthShell = props.suppressAuthShell === true && step === 'auth' && !error && !recoveryRequired
  const canonicalCswAddress = account?.accountSignals?.canonicalCswAddress ?? null
  const walletSelectionNeeded = !canonicalCswAddress
  const ownerInstallNeeded = Boolean(canonicalCswAddress && ownerDelegationVerified === false)
  const canEnterApp = canEnterAppFromAccountState({
    appAccessStatus: account?.appAccessStatus ?? null,
  })
  const doneUi = deriveWaitlistDoneUi(canEnterApp)
  const accessStatusMeta = getAccessStatusMeta(account?.appAccessStatus)
  const leaderboardRows = leaderboard?.leaderboard ?? []
  const leaderboardMe = leaderboard?.me ?? null
  const leaderboardMeInTop = Boolean(leaderboardMe && leaderboardRows.some((row) => row.signupId === leaderboardMe.signupId))
  const totalPoints = waitlistPosition?.points.total ?? account?.score.points ?? 0
  const totalRank = waitlistPosition?.rank.total ?? leaderboardMe?.rank ?? null
  const inviteRank = waitlistPosition?.rank.invite ?? null
  const qualifiedReferrals = waitlistPosition?.referrals.qualifiedCount ?? 0
  const pendingReferrals = waitlistPosition?.referrals.pendingCountCapped ?? waitlistPosition?.referrals.pendingCount ?? 0
  const personalReferralCode = waitlistPosition?.referralCode ?? null
  const personalReferralLink = useMemo(
    () => (personalReferralCode ? getMarketingWaitlistReferralUrl(personalReferralCode) : null),
    [personalReferralCode],
  )
  const dashboardSubtitle = ownerInstallNeeded
    ? 'You are still on the waitlist. Finish 4626 signing on your canonical CSW and keep building points while admin review is pending.'
    : walletSelectionNeeded
      ? 'Your email is verified. Track your rank, build points, and optionally connect the wallet you want 4626 to recognize.'
      : 'Your wallet is linked. Keep climbing the leaderboard while you wait for admin approval.'

  const onCopyReferralLink = useCallback(async () => {
    if (!personalReferralLink || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return
    await navigator.clipboard.writeText(personalReferralLink)
    setCopiedReferralLink(true)
  }, [personalReferralLink])

  const onRefreshStatus = useCallback(() => {
    void runBootstrap()
    void loadDashboard({ silent: true })
  }, [loadDashboard, runBootstrap])

  useEffect(() => {
    if (!shouldAutoStartAuth) return
    if (busy || authAttemptInFlightRef.current || authAutoAttemptedRef.current) return
    authAutoAttemptedRef.current = true
    void onContinueAuth()
  }, [authAttemptInFlightRef, busy, onContinueAuth, shouldAutoStartAuth])

  const shouldAutoHandoff = shouldAutoHandoffApprovedAccount({
    variant,
    step,
    canEnterApp,
    enterAppBusy,
  })
  useEffect(() => {
    if (!shouldAutoHandoff) {
      appHandoffAutoAttemptedRef.current = false
      return
    }
    if (appHandoffAutoAttemptedRef.current) return
    appHandoffAutoAttemptedRef.current = true
    void onEnterApp()
  }, [onEnterApp, shouldAutoHandoff])

  function stepStatus(active: WaitlistStep, complete?: WaitlistStep | WaitlistStep[]): 'pending' | 'active' | 'complete' {
    if (step === active) return 'active'
    const completes = complete ? (Array.isArray(complete) ? complete : [complete]) : []
    return completes.includes(step) ? 'complete' : 'pending'
  }

  const indicatorSteps = [
    { label: 'Sign in', status: stepStatus('auth', ['wallet', 'done']) },
    { label: 'Waitlist', status: stepStatus('wallet', 'done') },
    { label: 'App', status: stepStatus('done') },
  ]

  return (
    <section id={sectionId} className={wrapClass}>
      <div className={innerClass}>
        {!useCompactModalAuthStart && !hideAuthShell ? <StepIndicator steps={indicatorSteps} /> : null}

        {step === 'auth' ? (
          <WaitlistAuthStep
            hideAuthShell={hideAuthShell}
            useCompactModalAuthStart={useCompactModalAuthStart}
            authUi={authUi}
            shouldAutoStartAuth={shouldAutoStartAuth}
            busy={busy}
            privyClientStatus={privyClientStatus}
            error={error}
            recoveryRequired={recoveryRequired}
            onContinueAuth={onContinueAuth}
            onRecoverAccount={onRecoverAccount}
          />
        ) : null}

        {step === 'wallet' ? (
          <WaitlistWalletStep
            accessStatusMeta={accessStatusMeta}
            dashboardSubtitle={dashboardSubtitle}
            totalPoints={totalPoints}
            totalRank={totalRank}
            inviteRank={inviteRank}
            qualifiedReferrals={qualifiedReferrals}
            pendingReferrals={pendingReferrals}
            walletSelectionNeeded={walletSelectionNeeded}
            ownerInstallNeeded={ownerInstallNeeded}
            notice={notice}
            dashboardError={dashboardError}
            waitlistPosition={waitlistPosition}
            personalReferralCode={personalReferralCode}
            personalReferralLink={personalReferralLink}
            copiedReferralLink={copiedReferralLink}
            leaderboardRows={leaderboardRows}
            leaderboardMe={leaderboardMe}
            leaderboardMeInTop={leaderboardMeInTop}
            dashboardBusy={dashboardBusy}
            busy={busy}
            ownerDelegationVerified={ownerDelegationVerified}
            canonicalCswAddress={canonicalCswAddress}
            embeddedEoaAddress={embeddedEoaAddress}
            ownerDelegationFlags={ownerDelegationFlags}
            error={error}
            onCopyReferralLink={onCopyReferralLink}
            onContinueWithBase={onContinueWithBase}
            onContinueWithZora={onContinueWithZora}
            onCreateInBaseApp={onCreateInBaseApp}
            onEnable4626Signing={onEnable4626Signing}
            onRefreshStatus={onRefreshStatus}
          />
        ) : null}

        {step === 'done' ? (
          <WaitlistDoneStep
            doneUi={doneUi}
            accountCanonicalCswAddress={account?.accountSignals?.canonicalCswAddress ?? null}
            canEnterApp={canEnterApp}
            enterAppBusy={enterAppBusy}
            onEnterApp={onEnterApp}
          />
        ) : null}
      </div>
    </section>
  )
}
