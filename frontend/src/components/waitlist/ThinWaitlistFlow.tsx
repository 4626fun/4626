import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCrossAppAccounts, useLogin, usePrivy } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi'

import { apiFetch } from '@/lib/apiBase'
import { buildAppEntryUrl } from '@/lib/auth/appEntry'
import { runCanonicalizationPipeline } from '@/lib/auth/canonicalization'
import { resolveBaseAppInviteUrl } from '@/lib/baseAppInvite'
import { getAppBaseUrl } from '@/lib/host'
import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
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
import { isRecoveryRequiredAuthError, runWaitlistPrivyLogout, shouldStopWaitlistAutoAuthRetry } from './waitlistAuthState'
import {
  buildWaitlistEmailLoginOptions,
  buildWaitlistRecoveryLoginOptions,
} from './waitlistLoginOptions'
import {
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

type WaitlistStep = 'auth' | 'wallet' | 'done'

const HANDOFF_QUERY_KEY = 'cv_handoff'
const GET_ACCESS_TOKEN_TIMEOUT_MS = 20_000
const WAITLIST_STICKY_OPEN_KEY = 'cv:waitlist:sticky_open'

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

function useSafePrivy() {
  try {
    return usePrivy() as any
  } catch {
    return {
      authenticated: false,
      ready: false,
      getAccessToken: async () => null,
    } as any
  }
}

function useSafeLogin() {
  try {
    return useLogin({}) as any
  } catch {
    return {
      login: async () => {},
    } as any
  }
}

function useSafeCrossApp() {
  try {
    return useCrossAppAccounts() as any
  } catch {
    return {
      loginWithCrossAppAccount: null,
      linkCrossAppAccount: null,
    } as any
  }
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

export function resolveWaitlistStep(params: {
  account: Pick<AccountsSummary, 'emailVerified' | 'accountSignals'>
  ownerDelegationVerified: boolean | null
}): WaitlistStep {
  const { account, ownerDelegationVerified } = params
  if (!account.emailVerified) return 'auth'
  if (account.accountSignals.canonicalCswAddress && ownerDelegationVerified === true) return 'done'
  return 'wallet'
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

export function ThinWaitlistFlow(props: { variant?: Variant; sectionId?: string }) {
  const variant = props.variant ?? 'embedded'
  const sectionId = props.sectionId ?? 'waitlist'

  const privy = useSafePrivy()
  const { login } = useSafeLogin()
  const { loginWithCrossAppAccount, linkCrossAppAccount } = useSafeCrossApp()
  const { data: walletClient } = useWalletClient()
  const { chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()

  const privyAuthed = Boolean(privy?.authenticated)
  const getAccessToken = useMemo(
    () =>
      typeof privy?.getAccessToken === 'function'
        ? (privy.getAccessToken as () => Promise<string | null>)
        : async () => null,
    [privy],
  )

  const [step, setStep] = useState<WaitlistStep>('auth')

  const [busy, setBusy] = useState(false)
  const [enterAppBusy, setEnterAppBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [recoveryRequired, setRecoveryRequired] = useState(false)
  const [ownerDelegationFlags, setOwnerDelegationFlags] = useState<OwnerDelegationFlags | null>(null)
  const [ownerDelegationVerified, setOwnerDelegationVerified] = useState<boolean | null>(null)
  const [embeddedEoaAddress, setEmbeddedEoaAddress] = useState<string | null>(null)

  const [account, setAccount] = useState<AccountsSummary | null>(null)
  const authAttemptInFlightRef = useRef(false)
  const authAutoAttemptedRef = useRef(false)
  const authBootstrapAutoAttemptedRef = useRef(false)
  const privyLogoutRef = useRef<null | (() => Promise<void>)>(null)

  const isPage = variant === 'page'

  const wrapClass = isPage ? 'mx-auto w-full max-w-lg' : 'w-full'
  const innerClass = isPage
    ? 'card rounded-2xl border border-white/10 bg-black/50 p-6 sm:p-8 space-y-6'
    : 'space-y-6'
  const enterAppUrl = useMemo(() => buildAppEntryUrl(getAppBaseUrl()), [])

  useEffect(() => {
    if (typeof privy?.logout === 'function') {
      privyLogoutRef.current = async () => {
        await privy.logout().catch(() => null)
      }
      return
    }
    privyLogoutRef.current = null
  }, [privy])

  const runBootstrap = useCallback(async (): Promise<AccountsSummary | null> => {
    const token = await getAccessToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    let nextOwnerDelegationVerified: boolean | null = null
    if (token) {
      headers['X-Privy-Token'] = token
      const canonicalization = await runCanonicalizationPipeline({
        privyToken: token,
      })
      if (canonicalization.onboardingBootstrapped && canonicalization.onboarding) {
        setOwnerDelegationFlags(null)
        setOwnerDelegationVerified(canonicalization.onboarding.privyIsOwner)
        setEmbeddedEoaAddress(canonicalization.onboarding.privyEmbeddedEoaAddress)
        nextOwnerDelegationVerified = canonicalization.onboarding.privyIsOwner
      } else {
        const flags = deriveOwnerDelegationFlags(canonicalization.flags)
        setOwnerDelegationFlags(flags)
        setOwnerDelegationVerified(null)
        setEmbeddedEoaAddress(null)
      }
    }
    const response = await apiFetch('/api/waitlist/bootstrap', {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    })
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
      return null
    }

    const nextAccount = payload.data
    setAccount(nextAccount)
    setRecoveryRequired(false)
    if (!nextAccount.emailVerified) {
      setStep('auth')
      setError('Verify your email with 4626 to finish creating this account.')
      return nextAccount
    }
    setStep(resolveWaitlistStep({ account: nextAccount, ownerDelegationVerified: nextOwnerDelegationVerified }))
    return nextAccount
  }, [getAccessToken])

  const onContinueAuth = useCallback(async () => {
    if (busy || authAttemptInFlightRef.current) return
    authAttemptInFlightRef.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    setRecoveryRequired(false)
    try {
      if (privyAuthed) {
        const linked = await maybeCallMethod(privy, ['linkEmail', 'linkEmailAccount'])
        if (!linked) throw new Error('Email verification is unavailable in this client. Sign out and retry with email.')
        await runBootstrap()
      } else {
        await login(buildWaitlistEmailLoginOptions() as any)
      }
      authAttemptInFlightRef.current = false
      setBusy(false)
    } catch (authError: any) {
      const isRecoveryRequired = isRecoveryRequiredAuthError(authError)
      if (isRecoveryRequired) {
        authAutoAttemptedRef.current = true
        void runWaitlistPrivyLogout({ logout: privyLogoutRef.current })
        setRecoveryRequired(true)
      }
      setError(
        isRecoveryRequired
          ? 'Recovery required: this email is already linked to another account. Sign in with your original verified email to recover, then continue.'
          : typeof authError?.message === 'string'
            ? authError.message
            : 'Failed to start sign-in.',
      )
      authAttemptInFlightRef.current = false
      setBusy(false)
    }
  }, [busy, login, privy, privyAuthed, runBootstrap])

  const onContinueWithBase = useCallback(async () => {
    if (busy || authAttemptInFlightRef.current) return
    authAttemptInFlightRef.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    setRecoveryRequired(false)
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
      authAttemptInFlightRef.current = false
      setBusy(false)
    } catch (authError: any) {
      setError(typeof authError?.message === 'string' ? authError.message : 'Failed to link your Base Smart Wallet.')
      authAttemptInFlightRef.current = false
      setBusy(false)
    }
  }, [busy, privy, privyAuthed, runBootstrap])

  const onContinueWithZora = useCallback(async () => {
    if (busy || authAttemptInFlightRef.current) return
    authAttemptInFlightRef.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    setRecoveryRequired(false)
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
        GET_ACCESS_TOKEN_TIMEOUT_MS,
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
      authAttemptInFlightRef.current = false
      setBusy(false)
    } catch (authError: any) {
      setError(typeof authError?.message === 'string' ? authError.message : 'Failed to link your Zora Smart Wallet.')
      authAttemptInFlightRef.current = false
      setBusy(false)
    }
  }, [busy, getAccessToken, linkCrossAppAccount, loginWithCrossAppAccount, privyAuthed, resolveZora, runBootstrap])

  const onCreateInBaseApp = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(WAITLIST_STICKY_OPEN_KEY, '1')
    } catch {
      // ignore
    }
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
        authHeaders: async () => ({
          'Content-Type': 'application/json',
          'X-Privy-Token': token,
        }),
      })
    },
    [chainId, getAccessToken, switchChainAsync, walletClient],
  )

  const onEnable4626Signing = useCallback(async () => {
    if (!account?.accountSignals?.canonicalCswAddress) return
    setBusy(true)
    setError(null)
    setNotice(null)
    setOwnerDelegationFlags(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Missing Privy auth token. Sign in and retry.')

      const preflightRes = await apiFetch('/api/onboarding/bootstrap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Privy-Token': token,
        },
        body: JSON.stringify({}),
      })
      const preflightPayload = (await preflightRes.json().catch(() => null)) as ApiEnvelope<OnboardingBootstrapResponse> | null
      if (!preflightRes.ok || !preflightPayload?.success) {
        throw buildOwnerDelegationError(preflightPayload, 'Signer preflight failed.')
      }
      setEmbeddedEoaAddress(preflightPayload.data?.privyEmbeddedEoaAddress ?? null)
      if (preflightPayload.data?.privyIsOwner) {
        setOwnerDelegationVerified(true)
        setNotice('4626 signing is already enabled on your canonical CSW.')
        await runBootstrap()
        return
      }

      const prepareRes = await apiFetch('/api/wallet/prepare-add-privy-owner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Privy-Token': token,
        },
        body: JSON.stringify({}),
      })
      const preparePayload = (await prepareRes.json().catch(() => null)) as ApiEnvelope<PrepareOwnerResponse> | null
      if (!prepareRes.ok || !preparePayload?.success || !preparePayload.data) {
        throw buildOwnerDelegationError(preparePayload, 'Failed to prepare owner install.')
      }
      if (preparePayload.data.alreadyOwner) {
        setOwnerDelegationVerified(true)
        setNotice('4626 signing is already enabled on your canonical CSW.')
        await runBootstrap()
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
  }, [account?.accountSignals?.canonicalCswAddress, getAccessToken, runBootstrap, sendPreparedOwnerTx])

  const onRecoverAccount = useCallback(async () => {
    if (busy || authAttemptInFlightRef.current) return
    authAttemptInFlightRef.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    setRecoveryRequired(false)
    try {
      await runWaitlistPrivyLogout({ logout: privyLogoutRef.current })
      await login(buildWaitlistRecoveryLoginOptions() as any)
    } catch (recoverError: any) {
      setError(typeof recoverError?.message === 'string' ? recoverError.message : 'Failed to start account recovery sign-in.')
      setRecoveryRequired(true)
    } finally {
      authAttemptInFlightRef.current = false
      setBusy(false)
    }
  }, [busy, login])

  const resolveZora = useCallback(async (token: string): Promise<ZoraResolveResponse | null> => {
    const response = await apiFetch('/api/zora/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Privy-Token': token },
      body: JSON.stringify({}),
    })
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<ZoraResolveResponse> | null
    if (!response.ok || !payload?.success || !payload.data) return null
    return payload.data
  }, [])
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
    if (step !== 'auth' || !privyAuthed) {
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
        if (isSessionMismatch || isRecoveryRequired) {
          void runWaitlistPrivyLogout({ logout: privyLogoutRef.current })
        }
        if (!cancelled) {
          if (isRecoveryRequired) setRecoveryRequired(true)
          setError(
            isSessionMismatch
              ? 'Signed in as a different account. Click Continue to sign in again.'
              : isRecoveryRequired
                ? 'Recovery required: this email is already linked to another account. Sign in with your original verified email to recover, then continue.'
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
  }, [privyAuthed, runBootstrap, step])

  useEffect(() => {
    if (step !== 'auth') {
      authAttemptInFlightRef.current = false
      authAutoAttemptedRef.current = false
      authBootstrapAutoAttemptedRef.current = false
      setRecoveryRequired(false)
    }
  }, [step])

  useEffect(() => {
    if (step !== 'wallet' || !privyAuthed || typeof window === 'undefined' || typeof document === 'undefined') return
    const refresh = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return
      void runBootstrap()
    }
    const onFocus = () => refresh()
    const onVisibilityChange = () => refresh()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [privyAuthed, runBootstrap, step])

  const authUi = deriveWaitlistAuthUi()
  const canonicalCswAddress = account?.accountSignals?.canonicalCswAddress ?? null
  const walletSelectionNeeded = !canonicalCswAddress
  const ownerInstallNeeded = Boolean(canonicalCswAddress && ownerDelegationVerified === false)
  const canEnterApp = canEnterAppFromAccountState({
    appAccessStatus: account?.appAccessStatus ?? null,
    tier: account?.score?.tier ?? 0,
  })
  const doneUi = deriveWaitlistDoneUi(canEnterApp)

  const indicatorSteps = [
    {
      label: 'Sign in',
      status: (step === 'auth' ? 'active' : step === 'wallet' || step === 'done' ? 'complete' : 'pending') as
        | 'pending'
        | 'active'
        | 'complete',
    },
    {
      label: 'Wallet',
      status: (step === 'wallet' ? 'active' : step === 'done' ? 'complete' : 'pending') as 'pending' | 'active' | 'complete',
    },
    {
      label: 'Done',
      status: (step === 'done' ? 'active' : 'pending') as 'pending' | 'active' | 'complete',
    },
  ]

  return (
    <section id={sectionId} className={wrapClass}>
      <div className={innerClass}>
        {/* Step progress indicator */}
        <StepIndicator steps={indicatorSteps} />

        {step === 'auth' ? (
          <motion.div
            key="step-auth"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-5"
          >
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight text-white">{authUi.title}</h2>
              <p className="text-sm text-zinc-400">{authUi.subtitle}</p>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void onContinueAuth()}
              className="btn-accent btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {authUi.busyLabel}
                </>
              ) : (
                authUi.ctaLabel
              )}
            </button>

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
        ) : null}

        {/* Wallet setup step */}
        {step === 'wallet' ? (
          <motion.div
            key="step-wallet"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-5"
          >
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight text-white">Set up your smart wallet</h2>
              <p className="text-sm text-zinc-400">
                {walletSelectionNeeded
                  ? 'Your verified email created the account and your Privy signer. Next, choose the Coinbase Smart Wallet that 4626 should use.'
                  : 'Your canonical Coinbase Smart Wallet is connected. Finish setup by enabling 4626 signing on that wallet.'}
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <div
                className={`rounded-xl border p-4 space-y-2 ${
                  walletSelectionNeeded
                    ? 'border-brand-primary/35 bg-brand-primary/10'
                    : 'border-emerald-500/25 bg-emerald-500/10'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Phase 1</span>
                  <span
                    className={`text-[10px] font-medium uppercase tracking-[0.18em] ${
                      walletSelectionNeeded ? 'text-brand-primary' : 'text-emerald-300'
                    }`}
                  >
                    {walletSelectionNeeded ? 'Active' : 'Complete'}
                  </span>
                </div>
                <div className="text-sm font-medium text-white">Choose your CSW path</div>
                <p className="text-xs text-zinc-400">
                  Pick the Coinbase Smart Wallet you want 4626 to use, or create one in Base app.
                </p>
              </div>

              <div
                className={`rounded-xl border p-4 space-y-2 ${
                  ownerDelegationVerified
                    ? 'border-emerald-500/25 bg-emerald-500/10'
                    : walletSelectionNeeded
                      ? 'border-white/10 bg-black/30'
                      : 'border-brand-primary/35 bg-brand-primary/10'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Phase 2</span>
                  <span
                    className={`text-[10px] font-medium uppercase tracking-[0.18em] ${
                      ownerDelegationVerified
                        ? 'text-emerald-300'
                        : walletSelectionNeeded
                          ? 'text-zinc-500'
                          : 'text-brand-primary'
                    }`}
                  >
                    {ownerDelegationVerified ? 'Complete' : walletSelectionNeeded ? 'Pending' : 'Active'}
                  </span>
                </div>
                <div className="text-sm font-medium text-white">Enable 4626 signing</div>
                <p className="text-xs text-zinc-400">
                  Install the Privy embedded signer as an owner so 4626 can act through that wallet.
                </p>
              </div>
            </motion.div>

            {notice ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                {notice}
              </div>
            ) : null}

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

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: 0.04, ease: [0.4, 0, 0.2, 1] }}
                  className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2"
                >
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
                </motion.div>

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
              </>
            ) : null}

            {!walletSelectionNeeded ? (
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
                      <div>Privy embedded wallet provisioning is still settling. Retry signer setup in a moment.</div>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">Enable 4626 signing</div>
                    <span className={`text-[10px] font-medium uppercase tracking-[0.18em] ${ownerDelegationVerified ? 'text-emerald-300' : 'text-brand-primary'}`}>
                      {ownerDelegationVerified ? 'Complete' : 'Required'}
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
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runBootstrap()}
                    className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 rounded py-1"
                  >
                    Refresh wallet status
                  </button>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </div>
            ) : null}
          </motion.div>
        ) : null}

        {/* Done step */}
        {step === 'done' ? (
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
                {account?.accountSignals?.canonicalCswAddress ? (
                  <p className="text-xs text-zinc-500">
                    Canonical CSW <span className="font-mono text-zinc-300">{shortAddress(account.accountSignals.canonicalCswAddress)}</span>
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
        ) : null}
      </div>
    </section>
  )
}
