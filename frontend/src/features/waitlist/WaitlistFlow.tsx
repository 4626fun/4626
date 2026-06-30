import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InputOTP, type InputOTPStatus } from '@/components/ui/InputOTP'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { cn } from '@/lib/shared/utils'
import { siteAssets } from '@/config/site'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { APP_ORIGIN } from '@/lib/env/host'
import { bridgePrivySession } from '@/features/waitlist/waitlistHandoff'
import { runWaitlistPrivyLogout } from '@/features/waitlist/waitlistAuthState'
import { WaitlistTwitterLinkPanel } from '@/features/waitlist/WaitlistTwitterLinkPanel'
import { WaitlistTwitterEngagementSteps } from '@/features/waitlist/WaitlistTwitterEngagementSteps'
import { WaitlistWalletConnectPanel } from '@/features/waitlist/WaitlistWalletConnectPanel'
import { WaitlistZoraConnectPanel } from '@/features/waitlist/WaitlistZoraConnectPanel'
import {
  clearWaitlistOnboardingStepFlags,
  readWaitlistWalletSkipped,
  readWaitlistXPhaseDone,
  readWaitlistZoraSkipped,
  writeWaitlistWalletSkipped,
  writeWaitlistXPhaseDone,
  writeWaitlistZoraSkipped,
} from '@/features/waitlist/waitlistStorage'
import { performZoraCrossAppAuth, isUserRejectedCrossAppAuthError } from '@/lib/privy/zoraCrossApp'
import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
import { computeProgress } from '@/features/waitlist/waitlistTiers'
import { readPrivyAccessTokenWithRetries } from '@/lib/privy/accessToken'
import { linkAndSyncPrivyProvider, syncAccountsProviderLink } from '@/lib/privy/providerLink'
import { usePrivyOAuthReturnBackendSync } from '@/lib/privy/usePrivyOAuthReturnBackendSync'
import { useSafeCrossApp, useSafeLogin, useSafeLoginWithEmail, useSafePrivy, useSafePrivyAccessToken } from '@/lib/privy/safeHooks'
import { computeAcceptedFromAppAccessStatus } from '@/app/accessShared'
import { useAccountMe } from '@/hooks/useAccountMe'
import { fetchAccountTrayPoints } from '@/lib/waitlist/accountTrayPoints'

type WaitlistBootstrapResponse = {
  requiresPrivyAuth: boolean
}

type AuthMeResponse = {
  address: string
} | null

const OTP_RESEND_DELAY_MS = 30_000
const OTP_SUCCESS_HOLD_MS = 320
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const AUTH_SESSION_READ_BACKOFF_MS = 8_000

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

let authSessionReadInFlight: Promise<string | null> | null = null
let authSessionReadBackoffUntil = 0

function readAuthSessionRetryAfterMs(response: Response): number {
  const raw = response.headers.get('retry-after')
  if (!raw) return AUTH_SESSION_READ_BACKOFF_MS
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1_000)
  const at = Date.parse(raw)
  if (Number.isFinite(at)) return Math.max(1_000, at - Date.now())
  return AUTH_SESSION_READ_BACKOFF_MS
}

async function readAuthSessionAddress(): Promise<string | null> {
  if (Date.now() < authSessionReadBackoffUntil) return null
  if (authSessionReadInFlight) return authSessionReadInFlight

  authSessionReadInFlight = (async () => {
    try {
      const response = await apiFetch('/api/auth/me', {
        headers: { Accept: 'application/json' },
      }).catch(() => null)
      if (!response) return null
      if (response.status === 429) {
        authSessionReadBackoffUntil = Date.now() + readAuthSessionRetryAfterMs(response)
        return null
      }
      if (!response.ok) return null
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<AuthMeResponse> | null
      if (!payload?.success) return null
      const address =
        payload.data && typeof payload.data.address === 'string' ? payload.data.address.trim() : ''
      return address || null
    } finally {
      authSessionReadInFlight = null
    }
  })()

  return authSessionReadInFlight
}

async function bootstrapWaitlist(privyAccessToken: string): Promise<WaitlistBootstrapResponse> {
  const token = privyAccessToken.trim()
  if (!token) {
    throw new Error('Missing Privy auth token.')
  }
  const response = await apiFetch('/api/waitlist/bootstrap', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  })

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistBootstrapResponse> | null
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error || 'Could not finish waitlist signup.')
  }
  return payload.data
}

type SignupStep = 'email' | 'code'

const WAITLIST_PANEL_STYLE = {
  background: 'linear-gradient(165deg, rgb(var(--vault-card)), rgb(var(--vault-card-raised)))',
  boxShadow:
    '0 18px 45px -24px rgba(0, 0, 0, 0.65), 0 0 0 1px rgb(var(--brand-primary) / 0.1), 0 0 28px 4px rgb(var(--brand-primary) / 0.16), 0 0 52px 14px rgb(var(--brand-primary) / 0.1), 0 0 84px 28px rgb(var(--brand-primary) / 0.05)',
} as const

// A recent member in the social-proof avatar stack. `label` is the hover name
// (Zora handle / basename / short address); `href` links to their profile.
type WaitlistAvatar = {
  src: string
  label: string | null
  href: string | null
}

// Card shell — static brand-tinted ring (no rotating beam; keeps focus on content).
function BeamCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative rounded-2xl', className)} style={WAITLIST_PANEL_STYLE}>
      {children}
    </div>
  )
}

// The circular image/gradient disc shared by interactive and placeholder dots.
function AvatarDisc({ src, index, onError }: { src: string | null; index: number; onError: () => void }) {
  const showImage = Boolean(src)
  return (
    <span
      className="relative block size-6 overflow-hidden rounded-full ring-2 ring-[rgb(var(--vault-bg))]"
      style={
        showImage
          ? undefined
          : {
              background: 'linear-gradient(135deg, rgb(var(--brand-hover)), rgb(var(--brand-primary)))',
              opacity: 1 - index * 0.13,
            }
      }
    >
      {showImage ? (
        <img
          src={src as string}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={onError}
        />
      ) : null}
    </span>
  )
}

// A single avatar in the social-proof stack. Real members with a resolved
// identity become a link to their profile with a hover tooltip showing their
// name; placeholders (and failed images) fall back to a brand gradient disc.
function AvatarDot({ avatar, index }: { avatar: WaitlistAvatar | null; index: number }) {
  const [failed, setFailed] = useState(false)
  const src = avatar && !failed ? avatar.src : null
  const label = avatar?.label ?? null
  const href = avatar?.href ?? null
  const disc = <AvatarDisc src={src} index={index} onError={() => setFailed(true)} />

  // Non-interactive: placeholder, or a real image with no public identity.
  if (!href && !label) {
    return (
      <span className="relative block" aria-hidden="true">
        {disc}
      </span>
    )
  }

  const tooltip = label ? (
    <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-white/10 bg-[rgb(var(--vault-card-raised))] px-2 py-1 text-[10px] font-medium text-zinc-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100">
      {label}
    </span>
  ) : null

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label ?? 'Member profile'}
        title={label ?? undefined}
        className="group/avatar relative block rounded-full transition-transform duration-150 hover:z-10 hover:-translate-y-0.5 focus-visible:z-10 focus-visible:-translate-y-0.5 focus-visible:outline-none"
      >
        {disc}
        {tooltip}
      </a>
    )
  }

  return (
    <span className="group/avatar relative block" title={label ?? undefined}>
      {disc}
      {tooltip}
    </span>
  )
}

// Overlapping avatar stack. Uses real member PFPs (linked, with hover names)
// when present, otherwise four brand gradient placeholders (preserves the look
// when stats have no avatars).
function JoinedAvatars({ avatars }: { avatars: WaitlistAvatar[] }) {
  const slots: (WaitlistAvatar | null)[] =
    avatars.length > 0 ? avatars.slice(0, 4) : [null, null, null, null]
  return (
    <div className="flex -space-x-2">
      {slots.map((avatar, index) => (
        <AvatarDot key={avatar?.src ?? `placeholder-${index}`} avatar={avatar} index={index} />
      ))}
    </div>
  )
}

// One-time light sweep across a primary button on hover. Hidden for reduced motion.
function ButtonSheen() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover/btn:translate-x-full motion-reduce:hidden"
    />
  )
}

// Eased count-up for the social-proof number. Reduced motion / disabled paths
// return the target directly (no animation, no synchronous setState in effect).
function useCountUp(target: number | null, enabled: boolean): number {
  const reduceMotion = useReducedMotion()
  const animate = enabled && !reduceMotion && target != null
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (!animate || target == null) return
    let raf = 0
    const start = performance.now()
    const duration = 900
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(target * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, target])
  return animate ? display : (target ?? 0)
}

export function WaitlistFlow(props: { sectionId?: string }) {
  const sectionId = props.sectionId ?? 'waitlist-page'
  const privy = useSafePrivy()
  const { sendCode, loginWithCode } = useSafeLoginWithEmail()
  const { login } = useSafeLogin()
  const getPrivyAccessToken = useSafePrivyAccessToken()

  const [step, setStep] = useState<SignupStep>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeStatus, setCodeStatus] = useState<InputOTPStatus>('default')
  const [emailBusy, setEmailBusy] = useState(false)
  const [codeBusy, setCodeBusy] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [sessionAddress, setSessionAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [listCount, setListCount] = useState<number | null>(null)
  const [memberAvatars, setMemberAvatars] = useState<WaitlistAvatar[]>([])
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [xPhaseDone, setXPhaseDone] = useState(() => readWaitlistXPhaseDone())
  const [walletSkipped, setWalletSkipped] = useState(() => readWaitlistWalletSkipped())
  const [zoraSkipped, setZoraSkipped] = useState(() => readWaitlistZoraSkipped())
  const signupInFlightRef = useRef(false)
  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const codeInputRef = useRef<HTMLInputElement | null>(null)
  const autoSubmittedCodeRef = useRef<string | null>(null)
  const reduceMotion = useReducedMotion()

  // Intentional entry from the marketing "Join waitlist" CTA (`/waitlist?join=1`).
  // Used only to auto-focus the inline email field. The email/OTP entry renders
  // inside the card, so there is no modal to auto-open (preserves UX-002: a
  // passive arrival just shows the card).
  const joinIntent = useMemo(() => {
    if (typeof window === 'undefined') return false
    try {
      return new URLSearchParams(window.location.search).get('join') === '1'
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (!privy.ready) return
    let cancelled = false
    void (async () => {
      const address = await readAuthSessionAddress()
      if (cancelled) return
      setSessionAddress(address)
    })()
    return () => {
      cancelled = true
    }
  }, [privy.ready])

  // Lightweight social proof — avatars always render (placeholders when empty).
  // Refetch when auth state changes so signed-in views still get stats if the
  // initial mount fetch raced or failed.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch('/api/waitlist/stats', { headers: { Accept: 'application/json' } })
        if (!res?.ok || cancelled) return
        const json = (await res.json().catch(() => null)) as ApiEnvelope<{
          signedUpCount?: number
          avatars?: WaitlistAvatar[]
        }> | null
        if (json?.success && typeof json.data?.signedUpCount === 'number' && json.data.signedUpCount > 0) {
          setListCount(json.data.signedUpCount)
        }
        if (json?.success && Array.isArray(json.data?.avatars)) {
          setMemberAvatars(
            json.data.avatars.filter(
              (avatar): avatar is WaitlistAvatar =>
                Boolean(avatar) && typeof avatar.src === 'string' && avatar.src.length > 0,
            ),
          )
        }
      } catch {
        // fail open — placeholders still render
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionAddress])

  // Auto-focus the email field on intentional CTA arrival.
  useEffect(() => {
    if (!joinIntent || !privy.ready || sessionAddress || step !== 'email') return
    emailInputRef.current?.focus()
  }, [joinIntent, privy.ready, sessionAddress, step])

  // Focus the code field as soon as we advance to the OTP step.
  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus()
  }, [step])

  // Tick the resend countdown while it is pending.
  useEffect(() => {
    if (resendAvailableAt == null || resendAvailableAt <= Date.now()) return
    const timer = globalThis.setInterval(() => setNowMs(Date.now()), 1_000)
    return () => globalThis.clearInterval(timer)
  }, [resendAvailableAt])

  // Shared post-authentication tail: once Privy is authenticated (after
  // `loginWithCode`), bridge it into a 4626 session, bootstrap the waitlist row,
  // and confirm the HttpOnly session. Identical to the prior modal path — only
  // the trigger changed (inline OTP instead of a popup).
  const finishJoinAfterPrivyAuth = useCallback(async () => {
    let bridged = false
    try {
      const privyToken = await readPrivyAccessTokenWithRetries({
        read: privy.getAccessToken?.bind(privy) ?? null,
      })
      if (!privyToken) {
        // Most common cause: the `privy-session` marker cookie is blocked as a
        // third-party cookie (see loopbackSessionMarkerShim.ts), or a wallet
        // extension destabilized embedded-wallet init.
        console.warn('[waitlist] getAccessToken returned empty after OTP', {
          origin: typeof window !== 'undefined' ? window.location.origin : 'ssr',
          hostname: typeof window !== 'undefined' ? window.location.hostname : 'ssr',
          hasMarkerCookie:
            typeof document !== 'undefined' ? document.cookie.includes('privy-session') : false,
          authenticated: privy.authenticated,
          ready: privy.ready,
          hasGetAccessToken: typeof privy.getAccessToken === 'function',
        })
        throw new Error(
          'Could not verify your email session. Please try again. If the issue persists, try an incognito/private window or temporarily disable browser wallet extensions.',
        )
      }

      bridged = await bridgePrivySession(privyToken)
      if (!bridged) {
        throw new Error('Could not create your app session. Please try again.')
      }

      let bootstrap = await bootstrapWaitlist(privyToken)
      if (bootstrap.requiresPrivyAuth) {
        const retryToken = await readPrivyAccessTokenWithRetries({
          read: privy.getAccessToken?.bind(privy) ?? null,
          attempts: 4,
          retryDelayMs: 200,
        })
        if (retryToken) {
          bootstrap = await bootstrapWaitlist(retryToken)
        }
      }
      if (bootstrap.requiresPrivyAuth) {
        throw new Error('Could not verify waitlist signup. Please try again.')
      }

      const confirmedSessionAddress = await readAuthSessionAddress()
      if (!confirmedSessionAddress) {
        throw new Error('Sign-in finished but session is still syncing. Please try once more.')
      }
      setSessionAddress(confirmedSessionAddress)
    } catch (joinError) {
      // R4: if the Privy->4626 bridge succeeded but a later step failed, clear
      // the stale HttpOnly session so a retry does not inherit a session for an
      // incomplete account.
      if (bridged) {
        await runWaitlistPrivyLogout({
          logout: privy.logout ?? null,
          readToken: privy.getAccessToken ?? null,
        }).catch(() => {})
      }
      throw joinError
    }
  }, [privy])

  // Step 1 — send the 6-digit OTP to the entered email (inline, no modal).
  const handleSendCode = useCallback(
    async (resend = false) => {
      if (signupInFlightRef.current) return
      const normalizedEmail = email.trim()
      if (!isValidEmail(normalizedEmail)) {
        setError('Enter a valid email address.')
        return
      }
      signupInFlightRef.current = true
      setError(null)
      setEmailBusy(true)
      try {
        await sendCode({ email: normalizedEmail })
        setStep('code')
        setCode('')
        setResendAvailableAt(Date.now() + OTP_RESEND_DELAY_MS)
      } catch (sendError) {
        setError(
          sendError instanceof Error
            ? sendError.message
            : `Could not ${resend ? 'resend' : 'send'} the verification code. Please try again.`,
        )
      } finally {
        signupInFlightRef.current = false
        setEmailBusy(false)
      }
    },
    [email, sendCode],
  )

  // Step 2 — verify the OTP, flash green on success, then bridge + bootstrap.
  const handleVerifyCode = useCallback(async () => {
    if (signupInFlightRef.current) return
    const normalizedCode = code.replace(/\s+/g, '')
    if (normalizedCode.length < 6) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    signupInFlightRef.current = true
    setError(null)
    setCodeStatus('default')
    setCodeBusy(true)
    let otpAccepted = false
    try {
      await loginWithCode({ code: normalizedCode })
      otpAccepted = true
      setCodeStatus('success')
      if (!reduceMotion) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, OTP_SUCCESS_HOLD_MS)
        })
      }
      await finishJoinAfterPrivyAuth()
    } catch (verifyError) {
      setCodeStatus(otpAccepted ? 'default' : 'error')
      if (!otpAccepted) autoSubmittedCodeRef.current = null
      setError(verifyError instanceof Error ? verifyError.message : 'Could not verify the code. Please try again.')
    } finally {
      signupInFlightRef.current = false
      setCodeBusy(false)
    }
  }, [code, loginWithCode, finishJoinAfterPrivyAuth, reduceMotion])

  // Auto-submit once all 6 digits are present (one verify per distinct code).
  // Resets when leaving the code step or when the user edits a digit.
  useEffect(() => {
    if (step !== 'code') {
      autoSubmittedCodeRef.current = null
      return
    }
    const normalized = code.replace(/\s+/g, '')
    if (normalized.length === 6 && !codeBusy && autoSubmittedCodeRef.current !== normalized) {
      autoSubmittedCodeRef.current = normalized
      void handleVerifyCode()
    }
  }, [code, step, codeBusy, handleVerifyCode])

  const handleEditEmail = useCallback(() => {
    setStep('email')
    setCode('')
    setCodeStatus('default')
    setError(null)
  }, [])

  const handleSignOut = useCallback(async () => {
    if (signOutBusy) return
    setSignOutBusy(true)
    setError(null)
    try {
      await runWaitlistPrivyLogout({
        logout: privy.logout ?? null,
        readToken: privy.getAccessToken ?? null,
      })
      clearWaitlistOnboardingStepFlags()
      setSessionAddress(null)
      setStep('email')
      setEmail('')
      setCode('')
      setCodeStatus('default')
      setXPhaseDone(false)
      setWalletSkipped(false)
      setZoraSkipped(false)
    } finally {
      setSignOutBusy(false)
    }
  }, [privy.getAccessToken, privy.logout, signOutBusy])

  const handleEmailFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void handleSendCode(false)
  }

  const handleCodeFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void handleVerifyCode()
  }

  const isBusy = emailBusy || codeBusy || signOutBusy
  const canResend = resendAvailableAt == null || resendAvailableAt <= nowMs
  const resendSeconds =
    resendAvailableAt != null && resendAvailableAt > nowMs ? Math.ceil((resendAvailableAt - nowMs) / 1_000) : 0

  const { me: accountMe, refresh: refreshAccountMe } = useAccountMe()
  const [pointsTotal, setPointsTotal] = useState<number | null>(null)
  const [pointsRefreshKey, setPointsRefreshKey] = useState(0)
  const [twitterBusy, setTwitterBusy] = useState(false)
  const [twitterError, setTwitterError] = useState<string | null>(null)
  const [walletBusy, setWalletBusy] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [zoraBusy, setZoraBusy] = useState(false)
  const [zoraError, setZoraError] = useState<string | null>(null)
  const { loginWithCrossAppAccount, linkCrossAppAccount } = useSafeCrossApp()

  const twitterLinked = (accountMe?.linkedMethods?.twitter ?? []).length > 0
  const externalEoaLinked = (accountMe?.linkedMethods?.external_eoa ?? []).length > 0
  const linkedEoaAddress = accountMe?.linkedMethods?.external_eoa?.[0] ?? null
  const zoraLinked =
    (accountMe?.linkedMethods?.zora_cross_app ?? []).length > 0 ||
    Boolean(accountMe?.accountSignals?.linked)

  const markXPhaseDone = useCallback(() => {
    setXPhaseDone(true)
    writeWaitlistXPhaseDone(true)
  }, [])

  const handleSkipXPhase = useCallback(() => {
    setTwitterError(null)
    markXPhaseDone()
  }, [markXPhaseDone])

  const handleSkipWallet = useCallback(() => {
    setWalletError(null)
    setWalletSkipped(true)
    writeWaitlistWalletSkipped(true)
  }, [])

  const handleSkipZora = useCallback(() => {
    setZoraError(null)
    setZoraSkipped(true)
    writeWaitlistZoraSkipped(true)
  }, [])

  const handleLinkTwitter = useCallback(async () => {
    if (twitterBusy || twitterLinked) return
    setTwitterBusy(true)
    setTwitterError(null)
    try {
      const data = await linkAndSyncPrivyProvider({
        privy,
        provider: 'twitter',
        login: login ?? null,
        getAccessToken: getPrivyAccessToken,
      })
      if (data) {
        refreshAccountMe()
        setPointsRefreshKey((key) => key + 1)
      }
    } catch (linkError) {
      setTwitterError(linkError instanceof Error ? linkError.message : 'Could not connect Twitter.')
    } finally {
      setTwitterBusy(false)
    }
  }, [getPrivyAccessToken, login, privy, refreshAccountMe, twitterBusy, twitterLinked])

  const handleEngagementProgressVerified = useCallback(() => {
    setPointsRefreshKey((key) => key + 1)
    markXPhaseDone()
  }, [markXPhaseDone])

  const handleLinkWallet = useCallback(async () => {
    if (walletBusy || externalEoaLinked) return
    setWalletBusy(true)
    setWalletError(null)
    try {
      const data = await linkAndSyncPrivyProvider({
        privy,
        provider: 'external_eoa',
        login: login ?? null,
        getAccessToken: getPrivyAccessToken,
      })
      if (data) {
        refreshAccountMe()
        setPointsRefreshKey((key) => key + 1)
      }
    } catch (linkError) {
      setWalletError(linkError instanceof Error ? linkError.message : 'Could not connect wallet.')
    } finally {
      setWalletBusy(false)
    }
  }, [
    externalEoaLinked,
    getPrivyAccessToken,
    login,
    privy,
    refreshAccountMe,
    walletBusy,
  ])

  const handleLinkZora = useCallback(async () => {
    if (zoraBusy || zoraLinked) return
    setZoraBusy(true)
    setZoraError(null)
    try {
      await performZoraCrossAppAuth({
        privyAuthed: Boolean(privy.authenticated),
        appId: ZORA_PRIVY_APP_ID,
        linkCrossAppAccount,
        loginWithCrossAppAccount,
      })
      await syncAccountsProviderLink({
        provider: 'zora_cross_app',
        getAccessToken: getPrivyAccessToken,
      }).catch(() => null)
      refreshAccountMe()
      setPointsRefreshKey((key) => key + 1)
    } catch (linkError) {
      if (!isUserRejectedCrossAppAuthError(linkError)) {
        setZoraError(linkError instanceof Error ? linkError.message : 'Could not connect Zora.')
      }
    } finally {
      setZoraBusy(false)
    }
  }, [
    getPrivyAccessToken,
    linkCrossAppAccount,
    loginWithCrossAppAccount,
    privy.authenticated,
    refreshAccountMe,
    zoraBusy,
    zoraLinked,
  ])

  const handleOAuthTwitterSynced = useCallback(() => {
    refreshAccountMe()
    setPointsRefreshKey((key) => key + 1)
  }, [refreshAccountMe])

  usePrivyOAuthReturnBackendSync({
    providers: ['twitter'],
    privyReady: privy.ready,
    privyAuthenticated: privy.authenticated,
    privyUser: privy.user,
    linkedMethods: accountMe?.linkedMethods,
    getAccessToken: getPrivyAccessToken,
    onSynced: handleOAuthTwitterSynced,
    onError: (syncError, provider) => {
      if (provider !== 'twitter') return
      setTwitterError(syncError instanceof Error ? syncError.message : 'Could not sync Twitter link.')
    },
  })

  // Real waitlist points come from the scored snapshot (`/api/accounts/me/points`).
  // `/api/accounts/me` does not populate `score`, so reading `accountMe.score`
  // always returned 0 — fetch the snapshot directly once the session exists.
  useEffect(() => {
    if (!sessionAddress) return
    let cancelled = false
    void (async () => {
      try {
        const token = await getPrivyAccessToken?.()
        if (!token || cancelled) return
        const snapshot = await fetchAccountTrayPoints(40, token)
        if (!cancelled) setPointsTotal(snapshot.points.total)
      } catch {
        // auth-required or transient — keep any prior value
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionAddress, getPrivyAccessToken, pointsRefreshKey])

  const appAccepted = computeAcceptedFromAppAccessStatus(accountMe?.appAccessStatus ?? null)
  const points = pointsTotal ?? accountMe?.score?.points ?? 0
  const progress = computeProgress(points)
  const joinedCount = useCountUp(listCount, !sessionAddress)
  const showXLinkPanel = !xPhaseDone && !twitterLinked
  const showXConnectedRow = twitterLinked
  const showXEngagement = twitterLinked && !xPhaseDone
  const showWalletStep = xPhaseDone && !externalEoaLinked && !walletSkipped
  const walletPhaseDone = externalEoaLinked || walletSkipped
  const showZoraStep = xPhaseDone && walletPhaseDone && !zoraLinked && !zoraSkipped
  const stepVariants = {
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 },
    animate: { opacity: 1, x: 0 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 },
  }
  const phaseVariants = {
    initial: reduceMotion
      ? { opacity: 0 }
      : { opacity: 0, y: 20, scale: 0.97, filter: 'blur(6px)' },
    animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
    exit: reduceMotion
      ? { opacity: 0 }
      : { opacity: 0, y: -14, scale: 0.98, filter: 'blur(4px)' },
  }

  return (
    <section
      id={sectionId}
      className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden"
    >
      {/* Ambient background — faint wire grid + bottom fade */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-wire-grid opacity-[0.035]" />
        <div
          className="absolute inset-x-0 bottom-0 h-32"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgb(var(--vault-bg) / 0.9))',
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-md px-4 py-10 sm:px-6 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full space-y-6 sm:space-y-7"
        >
          <AnimatePresence mode="wait" initial={false}>
            {sessionAddress ? (
              <motion.div
                key="waitlist-joined"
                variants={phaseVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-6 sm:space-y-7"
              >
            <BeamCard className="p-6 text-center sm:p-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative flex items-center justify-center">
                    {appAccepted && !reduceMotion ? (
                      <motion.span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full"
                        initial={{ boxShadow: '0 0 0 0 rgb(var(--brand-primary) / 0.5)' }}
                        animate={{
                          boxShadow: [
                            '0 0 0 0 rgb(var(--brand-primary) / 0.45)',
                            '0 0 0 16px rgb(var(--brand-primary) / 0)',
                          ],
                        }}
                        transition={{ duration: 2.1, ease: 'easeOut', repeat: Infinity }}
                      />
                    ) : null}
                    {appAccepted ? (
                      <motion.span
                        initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                        className="relative flex size-14 items-center justify-center rounded-full"
                        style={{
                          background:
                            'linear-gradient(160deg, rgb(var(--brand-hover)), rgb(var(--brand-primary)))',
                          boxShadow:
                            'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 4px rgba(0,0,0,0.25), 0 10px 24px -8px rgb(var(--brand-primary) / 0.7)',
                        }}
                      >
                        <Check className="size-7 text-white" aria-hidden="true" />
                      </motion.span>
                    ) : (
                      <motion.img
                        src={siteAssets.logo}
                        alt=""
                        aria-hidden="true"
                        width={48}
                        height={48}
                        draggable={false}
                        initial={reduceMotion ? false : { scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                        className="size-12 select-none object-contain"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <h1 className="headline text-2xl leading-tight tracking-[-0.03em] sm:text-3xl">
                      {appAccepted ? "You're approved" : "You're on the list"}
                    </h1>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      {appAccepted
                        ? 'Open the app to continue.'
                        : "We'll notify you when your spot opens."}
                    </p>
                  </div>
                </div>

                {/* Points — always shown; the score is the heart of the waitlist. */}
                <div className="mt-7 rounded-2xl bg-white/[0.03] px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                      <span
                        className="size-1.5 rounded-full bg-[rgb(var(--brand-primary))]"
                        aria-hidden="true"
                      />
                      {progress.currentTier.name}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-white">
                        {points.toLocaleString()}
                      </span>
                      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">pts</span>
                    </div>
                  </div>
                  {progress.nextTier ? (
                    <div className="mt-4">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background:
                              'linear-gradient(90deg, rgb(var(--brand-primary)), rgb(var(--brand-hover)))',
                          }}
                          initial={false}
                          animate={{ width: `${progress.progressPercent}%` }}
                          transition={
                            reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 24 }
                          }
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-zinc-500">
                        <span className="font-medium tabular-nums text-zinc-300">
                          {progress.pointsToNext.toLocaleString()}
                        </span>{' '}
                        pts to {progress.nextTier.name}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-zinc-500">Top tier reached — you’re at the front.</p>
                  )}
                </div>

                {/* Earn points — optional identity links, each worth waitlist points. */}
                <div className="mt-7">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Earn points
                    </span>
                    <span className="h-px flex-1 bg-white/[0.06]" aria-hidden="true" />
                  </div>

                  {showXLinkPanel ? (
                    <WaitlistTwitterLinkPanel
                      linked={false}
                      busy={twitterBusy}
                      onConnect={() => {
                        setTwitterError(null)
                        void handleLinkTwitter()
                      }}
                      onSkip={handleSkipXPhase}
                    />
                  ) : null}

                  {showXConnectedRow ? (
                    <WaitlistTwitterLinkPanel
                      linked
                      busy={false}
                      onConnect={() => undefined}
                    />
                  ) : null}

                  {showXEngagement ? (
                    <WaitlistTwitterEngagementSteps
                      getAccessToken={getPrivyAccessToken}
                      onProgressVerified={handleEngagementProgressVerified}
                      onSkip={handleSkipXPhase}
                    />
                  ) : null}

                  {showWalletStep ? (
                    <WaitlistWalletConnectPanel
                      linked={false}
                      busy={walletBusy}
                      onConnect={() => {
                        setWalletError(null)
                        void handleLinkWallet()
                      }}
                      onSkip={handleSkipWallet}
                    />
                  ) : null}

                  {externalEoaLinked ? (
                    <WaitlistWalletConnectPanel
                      linked
                      linkedAddress={linkedEoaAddress}
                      busy={false}
                      onConnect={() => undefined}
                      onSkip={() => undefined}
                    />
                  ) : null}

                  {showZoraStep ? (
                    <WaitlistZoraConnectPanel
                      linked={false}
                      busy={zoraBusy}
                      onConnect={() => {
                        setZoraError(null)
                        void handleLinkZora()
                      }}
                      onSkip={handleSkipZora}
                    />
                  ) : null}

                  {zoraLinked ? (
                    <WaitlistZoraConnectPanel
                      linked
                      busy={false}
                      onConnect={() => undefined}
                      onSkip={() => undefined}
                    />
                  ) : null}
                </div>

                {twitterError || walletError || zoraError ? (
                  <p className="mt-4 text-center text-[11px] leading-relaxed text-rose-300/90">
                    {twitterError ?? walletError ?? zoraError}
                  </p>
                ) : null}

                <div className="mt-6 flex flex-col items-stretch gap-3">
                  {appAccepted ? (
                    <Button
                      variant="primary"
                      size="lg"
                      className="btn-game-cta group/btn relative w-full !rounded-full !min-h-[56px] !text-base !font-bold !tracking-wide"
                      asChild
                    >
                      <a href={`${APP_ORIGIN}/swap?restorePrivy=1`}>
                        <span className="relative z-10 inline-flex items-center gap-2.5">
                          Enter app
                          <ArrowRight
                            className="size-[18px] transition-transform duration-200 ease-out group-hover/btn:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                      </a>
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    className="text-xs tracking-wide text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
                    onClick={() => void handleSignOut()}
                    disabled={isBusy || twitterBusy || walletBusy || zoraBusy}
                  >
                    Sign out
                  </button>
                </div>
            </BeamCard>
              </motion.div>
            ) : (
              <motion.div
                key="waitlist-signup"
                variants={phaseVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-6 sm:space-y-7"
              >
            <>
              <div className="space-y-3 text-center">
                <span className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                  <span
                    className="size-1.5 rounded-full bg-[rgb(var(--brand-primary))]"
                    aria-hidden="true"
                  />
                  Early access
                </span>
                <h1 className="headline text-3xl leading-[1.02] tracking-[-0.03em] sm:text-4xl">
                  Join the waitlist
                </h1>
                <p className="mx-auto max-w-xs text-sm leading-relaxed text-zinc-400">
                  Claim your spot and start earning points.
                </p>
              </div>

              <BeamCard className="p-5 sm:p-6">
                <AnimatePresence mode="wait" initial={false}>
                  {step === 'email' ? (
                    <motion.form
                      key="email"
                      className="space-y-4"
                      onSubmit={handleEmailFormSubmit}
                      variants={stepVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                      <div className="space-y-2">
                        <label
                          htmlFor="waitlist-email"
                          className="block text-xs font-medium tracking-wide text-zinc-400"
                        >
                          Email address
                        </label>
                        <div className="relative">
                          <input
                            ref={emailInputRef}
                            id="waitlist-email"
                            type="email"
                            autoComplete="email"
                            inputMode="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            enterKeyHint="go"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="name@example.com"
                            disabled={emailBusy || !privy.ready}
                            className="block h-12 w-full rounded-xl border border-white/10 bg-[rgb(var(--vault-bg))] px-4 pr-10 text-[15px] text-white outline-none transition placeholder:text-zinc-600 focus:border-[rgb(var(--brand-primary)/0.7)] focus:shadow-[0_0_0_3px_rgb(var(--brand-primary)/0.14)] disabled:opacity-60"
                          />
                          <AnimatePresence>
                            {isValidEmail(email) && !emailBusy ? (
                              <motion.span
                                key="email-ok"
                                initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={reduceMotion ? undefined : { scale: 0.5, opacity: 0 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-emerald-400"
                                aria-hidden="true"
                              >
                                <Check className="size-4" />
                              </motion.span>
                            ) : null}
                          </AnimatePresence>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="btn-3d group/btn relative w-full overflow-hidden !rounded-full !min-h-[52px] text-[15px] font-semibold"
                        disabled={emailBusy || !privy.ready || !isValidEmail(email)}
                      >
                        <ButtonSheen />
                        {emailBusy ? (
                          <span className="relative z-10 inline-flex items-center gap-2">
                            <PixelWaveLoader name="wave-lr" size={14} color="rgba(255,255,255,0.9)" />
                            Sending code…
                          </span>
                        ) : (
                          <span className="relative z-10 inline-flex items-center gap-2">
                            Join with email
                            <ArrowRight className="size-4" aria-hidden="true" />
                          </span>
                        )}
                      </Button>
                      <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                        {!privy.ready ? 'Preparing secure session…' : 'We’ll send a 6-digit code to your email.'}
                      </p>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="code"
                      className="space-y-3"
                      onSubmit={handleCodeFormSubmit}
                      variants={stepVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                        <span className="truncate">
                          Code sent to <span className="font-mono text-zinc-300">{email.trim()}</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleEditEmail}
                          disabled={isBusy}
                          className="inline-flex shrink-0 items-center gap-1 tracking-wide text-zinc-400 transition hover:text-zinc-200 disabled:opacity-50"
                        >
                          <ArrowLeft className="size-3" aria-hidden="true" />
                          Edit
                        </button>
                      </div>
                      <label htmlFor="waitlist-code" className="sr-only">
                        Email verification code
                      </label>
                      <InputOTP
                        ref={codeInputRef}
                        id="waitlist-code"
                        value={code}
                        onChange={(next) => {
                          setCode(next)
                          if (codeStatus === 'error') setCodeStatus('default')
                        }}
                        status={codeStatus}
                        disabled={codeBusy || codeStatus === 'success'}
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className={cn(
                          'btn-3d group/btn relative w-full overflow-hidden !rounded-full !min-h-[52px] text-[15px] font-semibold',
                          codeStatus === 'success' &&
                            '!bg-emerald-500 !shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_0_0_rgb(4,120,87),0_6px_9px_-3px_rgba(0,0,0,0.38)]',
                        )}
                        disabled={codeBusy || code.replace(/\s+/g, '').length < 6 || codeStatus === 'success'}
                      >
                        <ButtonSheen />
                        {codeStatus === 'success' ? (
                          <span className="relative z-10 inline-flex items-center gap-2">
                            <Check className="size-4" aria-hidden="true" />
                            Verified
                          </span>
                        ) : codeBusy ? (
                          <span className="relative z-10 inline-flex items-center gap-2">
                            <PixelWaveLoader name="wave-lr" size={14} color="rgba(255,255,255,0.9)" />
                            Verifying…
                          </span>
                        ) : (
                          <span className="relative z-10 inline-flex items-center gap-2">
                            Verify &amp; join
                            <ArrowRight className="size-4" aria-hidden="true" />
                          </span>
                        )}
                      </Button>
                      <button
                        type="button"
                        onClick={() => void handleSendCode(true)}
                        disabled={emailBusy || !canResend}
                        className="block w-full text-center text-[11px] tracking-wide text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
                      >
                        {canResend ? 'Resend code' : `Resend in ${resendSeconds}s`}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </BeamCard>
            </>
              </motion.div>
            )}
          </AnimatePresence>

          {error ? (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3"
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-rose-200">{error}</p>
            </div>
          ) : null}

          {/* Persistent social proof — PFP stack stays present across the whole
              flow (sign-up, on-list, approved). Count appears when stats load. */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-2.5">
              <JoinedAvatars avatars={memberAvatars} />
              {listCount != null && listCount > 0 ? (
                <p className="text-[11px] text-zinc-400">
                  <span className="font-semibold tabular-nums text-zinc-200">
                    {joinedCount.toLocaleString()}
                  </span>{' '}
                  already joined
                </p>
              ) : null}
            </div>
            {sessionAddress && !appAccepted ? (
              <Link
                to="/leaderboard"
                className="group inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 transition hover:text-white"
              >
                See leaderboard
                <ArrowRight
                  className="size-3 transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            ) : null}
          </div>

          <p className="flex items-center justify-center gap-1.5 text-center text-[10px] tracking-wide text-zinc-600">
            <span className="text-zinc-500">Powered by</span>
            <a
              href="https://privy.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-zinc-400 transition hover:text-zinc-200"
            >
              <img
                src="/brands/privy-symbol-white.svg"
                alt=""
                aria-hidden="true"
                width={9}
                height={12}
                className="h-3 w-auto opacity-70"
                loading="lazy"
                decoding="async"
              />
              Privy
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
