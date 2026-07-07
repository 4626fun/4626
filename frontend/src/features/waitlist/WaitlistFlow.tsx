import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
import { runWaitlistPrivyLogout } from '@/features/waitlist/waitlistAuthState'
import {
  establishWaitlistSessionAfterPrivyAuth,
  readAuthSessionAddress,
} from '@/features/waitlist/waitlistPrivySession'
import {
  resolveWaitlistJoinedSessionAddress,
  shouldClearOrphanWaitlistServerSession,
} from '@/features/waitlist/resolveWaitlistJoinedSession'
import { shouldAutoSubmitOtpCode } from '@/features/waitlist/waitlistFlowState'
import { WaitlistReturningWalletSignIn } from '@/features/waitlist/WaitlistReturningWalletSignIn'
import { shouldShowWaitlistEmailSignup } from '@/features/waitlist/waitlistSignupVisibility'
import { WaitlistTwitterLinkPanel, XLogo } from '@/features/waitlist/WaitlistTwitterLinkPanel'
import { WaitlistTwitterEngagementSteps } from '@/features/waitlist/WaitlistTwitterEngagementSteps'
import { WaitlistWalletConnectPanel } from '@/features/waitlist/WaitlistWalletConnectPanel'
import { WaitlistZoraConnectPanel, ZoraLogo } from '@/features/waitlist/WaitlistZoraConnectPanel'
import { WaitlistPostJoinShell } from '@/features/waitlist/WaitlistPostJoinShell'
import {
  WaitlistLinkedAccountsCard,
  useWaitlistLinkedWalletRow,
  type WaitlistLinkedAccountRow,
} from '@/features/waitlist/WaitlistLinkedAccountsCard'
import { PROVIDER_POINTS } from '@/features/waitlist/waitlistTiers'
import {
  clearWaitlistOnboardingStepFlags,
  readWaitlistWalletSkipped,
  readWaitlistXPhaseDone,
  readWaitlistZoraSkipped,
  writeWaitlistWalletSkipped,
  writeWaitlistXPhaseDone,
  writeWaitlistZoraSkipped,
} from '@/features/waitlist/waitlistStorage'
import { performZoraCrossAppAuth, isRecoverableCrossAppAuthError, isUserRejectedCrossAppAuthError } from '@/lib/privy/zoraCrossApp'
import { findZoraCrossAppSubject } from '@/lib/privy/zoraCrossAppAccounts'
import { findLinkedTwitterHandle } from '@/lib/privy/linkedAccounts'
import { hasZoraReadOnlySignals, resolveZoraReadOnlySignals } from '@/lib/zora/zoraReadOnlyResolve'
import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
import { assertPrivySessionMarkerCookie, isLocalDevPrivySessionMarkerMode } from '@/lib/privy/loopbackSessionMarkerShim'
import { useWaitlistZoraOAuthReturnRecovery } from '@/lib/privy/useWaitlistZoraOAuthReturnRecovery'
import { WaitlistWelcomeGreeting } from '@/features/waitlist/WaitlistWelcomeGreeting'
import { sanitizeWaitlistZoraHandle } from '@/features/waitlist/waitlistWelcomeIdentity'
import {
  linkAndSyncPrivyProvider,
  syncAccountsProviderLink,
  syncProviderUnlink,
  unlinkAndSyncPrivyProvider,
} from '@/lib/privy/providerLink'
import { usePrivyOAuthReturnBackendSync } from '@/lib/privy/usePrivyOAuthReturnBackendSync'
import { useSafeCrossApp, useSafeLogin, useSafeLoginWithEmail, useSafePrivy, useSafePrivyAccessToken } from '@/lib/privy/safeHooks'
import { computeAcceptedFromAppAccessStatus } from '@/app/accessShared'
import { useAccountMe } from '@/hooks/useAccountMe'

const OTP_RESEND_DELAY_MS = 30_000
const OTP_SUCCESS_HOLD_MS = 320
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const noop = () => {}

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

type SignupStep = 'email' | 'code'

type WaitlistFlowProps = {
  sectionId?: string
  walletSignInPending?: boolean
  walletSessionAddress?: string | null
  walletSignInError?: string | null
  onRequestWalletSignIn?: () => void
  onCancelWalletSignIn?: () => void
  onClearWalletSignInError?: () => void
  onClearWalletSession?: () => void
}

const WAITLIST_PANEL_STYLE = {
  background: 'linear-gradient(165deg, rgb(var(--vault-card)), rgb(var(--vault-card-raised)))',
  boxShadow:
    '0 18px 45px -24px rgba(0, 0, 0, 0.65), 0 0 0 1px rgb(var(--brand-primary) / 0.1), 0 0 28px 4px rgb(var(--brand-primary) / 0.16), 0 0 52px 14px rgb(var(--brand-primary) / 0.1), 0 0 84px 28px rgb(var(--brand-primary) / 0.05)',
} as const

const WAITLIST_PANEL_SUCCESS_STYLE: CSSProperties = {
  background: WAITLIST_PANEL_STYLE.background,
  boxShadow:
    '0 18px 45px -24px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(52, 211, 153, 0.22), 0 0 28px 4px rgba(52, 211, 153, 0.2), 0 0 52px 14px rgba(52, 211, 153, 0.1), 0 0 84px 28px rgba(52, 211, 153, 0.05)',
}

type BeamCardAccent = 'default' | 'success'

// A recent member in the social-proof avatar stack. `label` is the hover name
// (Zora handle / basename / short address); `href` links to their profile.
type WaitlistAvatar = {
  src: string
  label: string | null
  href: string | null
}

// Card shell — static brand-tinted ring (no rotating beam; keeps focus on content).
function BeamCard({
  children,
  className,
  accent = 'default',
}: {
  children: ReactNode
  className?: string
  accent?: BeamCardAccent
}) {
  return (
    <div
      className={cn('relative rounded-2xl', className)}
      style={accent === 'success' ? WAITLIST_PANEL_SUCCESS_STYLE : WAITLIST_PANEL_STYLE}
    >
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

// A previously-skipped step, surfaced as a slim reminder rather than a dead
// end — lets the user go back and link it later for the points.
function SkippedStepReminder({
  label,
  points,
  onLinkNow,
}: {
  label: string
  points: number
  onLinkNow: () => void
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
      <span className="text-zinc-500">
        {label} skipped ·{' '}
        <span className="font-medium text-zinc-400">+{points} pts available</span>
      </span>
      <button
        type="button"
        onClick={onLinkNow}
        className="shrink-0 font-medium text-zinc-300 transition hover:text-white"
      >
        Link now
      </button>
    </div>
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

export function WaitlistFlow(props: WaitlistFlowProps) {
  const sectionId = props.sectionId ?? 'waitlist-page'
  const onRequestWalletSignIn = props.onRequestWalletSignIn ?? noop
  const onCancelWalletSignIn = props.onCancelWalletSignIn ?? noop
  const onClearWalletSignInError = props.onClearWalletSignInError ?? noop
  const onClearWalletSession = props.onClearWalletSession ?? noop
  const walletSignInPending = props.walletSignInPending === true
  const privy = useSafePrivy()
  const { sendCode, loginWithCode } = useSafeLoginWithEmail()
  const { login } = useSafeLogin()
  const getPrivyAccessToken = useSafePrivyAccessToken()
  const loginRef = useRef(login)

  useEffect(() => {
    loginRef.current = login
  })

  const [step, setStep] = useState<SignupStep>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeStatus, setCodeStatus] = useState<InputOTPStatus>('default')
  const [emailBusy, setEmailBusy] = useState(false)
  const [codeBusy, setCodeBusy] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [localSessionAddress, setLocalSessionAddress] = useState<string | null>(null)
  const [serverSessionAddress, setServerSessionAddress] = useState<string | null>(null)
  const [sessionProbeComplete, setSessionProbeComplete] = useState(false)
  const orphanSessionCleanupRef = useRef(false)
  const sessionProbeStartedRef = useRef(false)
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

  const joinedSessionAddress = useMemo(
    () =>
      resolveWaitlistJoinedSessionAddress({
        sessionProbeComplete,
        privyReady: privy.ready === true,
        privyAuthenticated: privy.authenticated === true,
        walletSignInPending,
        serverSessionAddress,
        localSessionAddress,
        walletSessionAddress: props.walletSessionAddress ?? null,
      }),
    [
      sessionProbeComplete,
      privy.ready,
      privy.authenticated,
      walletSignInPending,
      serverSessionAddress,
      localSessionAddress,
      props.walletSessionAddress,
    ],
  )

  useEffect(() => {
    if (!props.walletSignInError) return
    setError(props.walletSignInError)
    onClearWalletSignInError()
  }, [onClearWalletSignInError, props.walletSignInError])

  useEffect(() => {
    if (!privy.ready) return
    if (sessionProbeStartedRef.current) return
    sessionProbeStartedRef.current = true
    let cancelled = false
    void (async () => {
      const address = await readAuthSessionAddress()
      if (cancelled) return
      setServerSessionAddress(address)
      setSessionProbeComplete(true)
    })()
    return () => {
      cancelled = true
    }
  }, [privy.ready])

  const signupInProgress = step === 'code' || emailBusy || codeBusy || signupInFlightRef.current
  const ORPHAN_SESSION_CLEANUP_DELAY_MS = 2_000

  useEffect(() => {
    const shouldClear = shouldClearOrphanWaitlistServerSession({
      sessionProbeComplete,
      privyReady: privy.ready === true,
      privyAuthenticated: privy.authenticated === true,
      walletSignInPending,
      signupInProgress,
      serverSessionAddress,
      walletSessionAddress: props.walletSessionAddress ?? null,
      localSessionAddress,
    })

    if (!shouldClear) {
      return
    }
    if (orphanSessionCleanupRef.current) return

    let cancelled = false
    const timer = globalThis.setTimeout(() => {
      if (cancelled) return
      const stillShouldClear = shouldClearOrphanWaitlistServerSession({
        sessionProbeComplete,
        privyReady: privy.ready === true,
        privyAuthenticated: privy.authenticated === true,
        walletSignInPending,
        signupInProgress: step === 'code' || emailBusy || codeBusy,
        serverSessionAddress,
        walletSessionAddress: props.walletSessionAddress ?? null,
        localSessionAddress,
      })
      if (!stillShouldClear || orphanSessionCleanupRef.current) return
      orphanSessionCleanupRef.current = true

      void runWaitlistPrivyLogout({ logout: null, shouldLogout: false }).finally(() => {
        if (cancelled) return
        setServerSessionAddress(null)
      })
    }, ORPHAN_SESSION_CLEANUP_DELAY_MS)

    return () => {
      cancelled = true
      globalThis.clearTimeout(timer)
    }
  }, [
    sessionProbeComplete,
    privy.ready,
    privy.authenticated,
    serverSessionAddress,
    walletSignInPending,
    signupInProgress,
    step,
    emailBusy,
    codeBusy,
    localSessionAddress,
    props.walletSessionAddress,
  ])

  const fetchWaitlistStats = useCallback(async () => {
    try {
      const res = await apiFetch('/api/waitlist/stats', { headers: { Accept: 'application/json' } })
      if (!res?.ok) return
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
  }, [])

  // Social proof — initial fetch plus periodic refresh (legacy flow polled every 30s).
  useEffect(() => {
    const runFetch = () => {
      void fetchWaitlistStats()
    }
    const timeoutId = window.setTimeout(runFetch, 0)
    const intervalId = window.setInterval(runFetch, 30_000)
    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [fetchWaitlistStats])

  // Auto-focus the email field on intentional CTA arrival.
  useEffect(() => {
    if (!joinIntent || !privy.ready || joinedSessionAddress || step !== 'email') return
    emailInputRef.current?.focus()
  }, [joinIntent, privy.ready, joinedSessionAddress, step])

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
    const confirmedSessionAddress = await establishWaitlistSessionAfterPrivyAuth({
      privy,
      missingTokenMessage:
        'Could not verify your email session. Please try again. If the issue persists, try an incognito/private window or temporarily disable browser wallet extensions.',
    })
    setLocalSessionAddress(confirmedSessionAddress)
    setServerSessionAddress(confirmedSessionAddress)
    void fetchWaitlistStats()
  }, [privy, fetchWaitlistStats])

  const handleSignInWithLinkedWallet = useCallback(() => {
    if (signupInFlightRef.current || walletSignInPending) return
    setError(null)
    onRequestWalletSignIn()
  }, [onRequestWalletSignIn, walletSignInPending])

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
      // Deliberately leave autoSubmittedCodeRef pointing at this (failed) code — see
      // shouldAutoSubmitOtpCode's docstring for why clearing it here caused a retry loop.
      // The user can still retry the same code via the "Verify & join" button, which
      // calls handleVerifyCode directly and doesn't consult this guard.
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
    if (
      shouldAutoSubmitOtpCode({
        step,
        normalizedCode: normalized,
        codeBusy,
        lastAttemptedCode: autoSubmittedCodeRef.current,
      })
    ) {
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
      orphanSessionCleanupRef.current = false
      setServerSessionAddress(null)
      setLocalSessionAddress(null)
      onClearWalletSession()
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
  }, [onClearWalletSession, privy.getAccessToken, privy.logout, signOutBusy])

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

  const { me: accountMe, loading: accountMeLoading, refresh: refreshAccountMe } = useAccountMe({
    enabled: Boolean(joinedSessionAddress),
  })
  const [twitterBusy, setTwitterBusy] = useState(false)
  const [twitterError, setTwitterError] = useState<string | null>(null)
  const [walletBusy, setWalletBusy] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [zoraBusy, setZoraBusy] = useState(false)
  const [zoraError, setZoraError] = useState<string | null>(null)
  const { loginWithCrossAppAccount, linkCrossAppAccount, unlinkCrossAppAccount } = useSafeCrossApp()

  const twitterLinked = (accountMe?.linkedMethods?.twitter ?? []).length > 0
  const externalEoaLinked = (accountMe?.linkedMethods?.external_eoa ?? []).length > 0
  const linkedEoaAddress = accountMe?.linkedMethods?.external_eoa?.[0] ?? null
  const zoraLinked =
    (accountMe?.linkedMethods?.zora_cross_app ?? []).length > 0 ||
    Boolean(accountMe?.accountSignals?.linked)

  const returningViaWallet = useMemo(() => {
    const wallet = props.walletSessionAddress?.trim().toLowerCase()
    const joined = joinedSessionAddress?.trim().toLowerCase()
    return Boolean(wallet && joined && wallet === joined)
  }, [joinedSessionAddress, props.walletSessionAddress])

  const walletLinkedRowBase = useWaitlistLinkedWalletRow(linkedEoaAddress, PROVIDER_POINTS.external_eoa ?? 0)

  useEffect(() => {
    if (!props.walletSessionAddress) return
    if (!privy.ready || privy.authenticated !== true) return
    refreshAccountMe()
  }, [privy.authenticated, privy.ready, props.walletSessionAddress, refreshAccountMe])

  useEffect(() => {
    const wallet = props.walletSessionAddress?.trim()
    if (!wallet) return
    setLocalSessionAddress(wallet)
    setServerSessionAddress((current) => current ?? wallet)
  }, [props.walletSessionAddress])

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

  // "Go back" affordances — reopen a previously skipped step so the user can
  // still link it later instead of it being a permanent dead end.
  const handleUndoSkipX = useCallback(() => {
    setTwitterError(null)
    setXPhaseDone(false)
    writeWaitlistXPhaseDone(false)
  }, [])

  const handleUndoSkipWallet = useCallback(() => {
    setWalletError(null)
    setWalletSkipped(false)
    writeWaitlistWalletSkipped(false)
  }, [])

  const handleUndoSkipZora = useCallback(() => {
    setZoraError(null)
    setZoraSkipped(false)
    writeWaitlistZoraSkipped(false)
  }, [])

  const handleLinkTwitter = useCallback(async () => {
    if (twitterBusy || twitterLinked) return
    setTwitterBusy(true)
    setTwitterError(null)
    try {
      if (privy.authenticated !== true) {
        if (returningViaWallet && loginRef.current) {
          loginRef.current({ loginMethods: ['twitter'] })
          return
        }
        setTwitterError('Sign in before linking an account.')
        return
      }
      const data = await linkAndSyncPrivyProvider({
        privy,
        provider: 'twitter',
        login: loginRef.current ?? null,
        getAccessToken: getPrivyAccessToken,
      })
      if (data) {
        refreshAccountMe()
      }
    } catch (linkError) {
      setTwitterError(linkError instanceof Error ? linkError.message : 'Could not connect Twitter.')
    } finally {
      setTwitterBusy(false)
    }
  }, [
    getPrivyAccessToken,
    privy,
    refreshAccountMe,
    returningViaWallet,
    twitterBusy,
    twitterLinked,
  ])

  const handleEngagementProgressVerified = useCallback(() => {
    markXPhaseDone()
  }, [markXPhaseDone])

  // Edit = unlink then re-open the connect panel for that provider, so users
  // can go back and link a different X or wallet account.
  const handleEditTwitter = useCallback(async () => {
    if (twitterBusy || !twitterLinked) return
    setTwitterBusy(true)
    setTwitterError(null)
    try {
      await unlinkAndSyncPrivyProvider({
        privy,
        provider: 'twitter',
        getAccessToken: getPrivyAccessToken,
        value: accountMe?.linkedMethods?.twitter?.[0] ?? null,
      })
      setXPhaseDone(false)
      writeWaitlistXPhaseDone(false)
      refreshAccountMe()
    } catch (unlinkError) {
      setTwitterError(unlinkError instanceof Error ? unlinkError.message : 'Could not disconnect X.')
    } finally {
      setTwitterBusy(false)
    }
  }, [accountMe, getPrivyAccessToken, privy, refreshAccountMe, twitterBusy, twitterLinked])

  const handleLinkWallet = useCallback(async () => {
    if (walletBusy || externalEoaLinked) return
    setWalletBusy(true)
    setWalletError(null)
    try {
      const data = await linkAndSyncPrivyProvider({
        privy,
        provider: 'external_eoa',
        login: loginRef.current ?? null,
        getAccessToken: getPrivyAccessToken,
      })
      if (data) {
        refreshAccountMe()
      }
    } catch (linkError) {
      setWalletError(linkError instanceof Error ? linkError.message : 'Could not connect wallet.')
    } finally {
      setWalletBusy(false)
    }
  }, [
    externalEoaLinked,
    getPrivyAccessToken,
    privy,
    refreshAccountMe,
    walletBusy,
  ])

  const handleEditWallet = useCallback(async () => {
    if (walletBusy || !externalEoaLinked) return
    setWalletBusy(true)
    setWalletError(null)
    try {
      await unlinkAndSyncPrivyProvider({
        privy,
        provider: 'external_eoa',
        getAccessToken: getPrivyAccessToken,
        value: linkedEoaAddress,
      })
      setWalletSkipped(false)
      writeWaitlistWalletSkipped(false)
      refreshAccountMe()
    } catch (unlinkError) {
      setWalletError(unlinkError instanceof Error ? unlinkError.message : 'Could not disconnect wallet.')
    } finally {
      setWalletBusy(false)
    }
  }, [externalEoaLinked, getPrivyAccessToken, linkedEoaAddress, privy, refreshAccountMe, walletBusy])

  // Zora is a Privy cross-app account, not a standard OAuth provider, so its
  // unlink call is `unlinkCrossAppAccount({ subject })` (found from
  // `privy.user.linkedAccounts`) instead of the `unlinkX()` pattern the other
  // providers use.
  const handleEditZora = useCallback(async () => {
    if (zoraBusy || !zoraLinked) return
    setZoraBusy(true)
    setZoraError(null)
    try {
      const subject = findZoraCrossAppSubject(privy.user)
      if (subject && typeof unlinkCrossAppAccount === 'function') {
        await unlinkCrossAppAccount({ subject })
      }
      await syncProviderUnlink({ provider: 'zora_cross_app', getAccessToken: getPrivyAccessToken })
      setZoraSkipped(false)
      writeWaitlistZoraSkipped(false)
      refreshAccountMe()
    } catch (unlinkError) {
      setZoraError(unlinkError instanceof Error ? unlinkError.message : 'Could not disconnect Zora.')
    } finally {
      setZoraBusy(false)
    }
  }, [getPrivyAccessToken, privy.user, refreshAccountMe, unlinkCrossAppAccount, zoraBusy, zoraLinked])

  const twitterHandle = useMemo(() => findLinkedTwitterHandle(privy.user), [privy.user])
  const zoraHandleForRow = sanitizeWaitlistZoraHandle(accountMe?.accountSignals?.zoraHandle)

  // Already-connected identities, shown together as one summary list instead
  // of three separately-styled "linked" rows. All three support "Edit"
  // (unlink + re-open the connect step).
  const linkedAccountRows = useMemo<WaitlistLinkedAccountRow[]>(() => {
    const rows: WaitlistLinkedAccountRow[] = []
    if (twitterLinked) {
      rows.push({
        key: 'twitter',
        icon: <XLogo className="size-[18px] text-white" />,
        identity: twitterHandle ? `@${twitterHandle}` : 'X account',
        points: PROVIDER_POINTS.twitter ?? 0,
        onEdit: () => void handleEditTwitter(),
        editBusy: twitterBusy,
      })
    }
    if (externalEoaLinked) {
      rows.push({
        ...walletLinkedRowBase,
        onEdit: () => void handleEditWallet(),
        editBusy: walletBusy,
      })
    }
    if (zoraLinked) {
      rows.push({
        key: 'zora',
        icon: <ZoraLogo className="size-[18px] rounded-full object-cover" />,
        identity: zoraHandleForRow ? `@${zoraHandleForRow}` : 'Zora account',
        points: PROVIDER_POINTS.zora_cross_app ?? 0,
        onEdit: () => void handleEditZora(),
        editBusy: zoraBusy,
      })
    }
    return rows
  }, [
    externalEoaLinked,
    handleEditTwitter,
    handleEditWallet,
    handleEditZora,
    twitterBusy,
    twitterHandle,
    twitterLinked,
    walletBusy,
    walletLinkedRowBase,
    zoraBusy,
    zoraHandleForRow,
    zoraLinked,
  ])

  const handleLinkZora = useCallback(async () => {
    if (zoraBusy || zoraLinked) return
    setZoraBusy(true)
    setZoraError(null)
    let crossAppAuthCompleted = false
    let fallbackMessage: string | null = null
    try {
      try {
        await performZoraCrossAppAuth({
          privyAuthed: Boolean(privy.authenticated),
          appId: ZORA_PRIVY_APP_ID,
          linkCrossAppAccount,
          loginWithCrossAppAccount,
          getAccessToken: getPrivyAccessToken,
        })
        crossAppAuthCompleted = true
      } catch (linkError) {
        if (isUserRejectedCrossAppAuthError(linkError)) {
          return
        }
        if (isRecoverableCrossAppAuthError(linkError)) {
          fallbackMessage =
            'Zora OAuth did not finish in this browser. Checking read-only Zora signals instead. If this keeps happening, sign out, verify email again, then retry.'
        } else {
          throw linkError
        }
      }

      if (crossAppAuthCompleted) {
        await syncAccountsProviderLink({
          provider: 'zora_cross_app',
          getAccessToken: getPrivyAccessToken,
        }).catch(() => null)
      } else if (getPrivyAccessToken) {
        const resolvedSignals = await resolveZoraReadOnlySignals({
          getAccessToken: getPrivyAccessToken,
        })
        if (!hasZoraReadOnlySignals(resolvedSignals)) {
          setZoraError(
            fallbackMessage ??
              'Could not connect Zora yet. Sign out, verify email again, then retry — or open your Zora profile once and retry.',
          )
          return
        }
      } else {
        setZoraError(
          fallbackMessage ??
            'Could not verify your session for Zora linking. Sign out, verify email again, then retry.',
        )
        return
      }

      refreshAccountMe()
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
  }, [refreshAccountMe])

  usePrivyOAuthReturnBackendSync({
    enabled: Boolean(joinedSessionAddress),
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

  useEffect(() => {
    if (!privy.authenticated || !isLocalDevPrivySessionMarkerMode()) return
    assertPrivySessionMarkerCookie()
  }, [privy.authenticated])

  useWaitlistZoraOAuthReturnRecovery({
    enabled: Boolean(joinedSessionAddress),
    privyReady: privy.ready,
    privyAuthenticated: privy.authenticated,
    privyUser: privy.user,
    zoraLinked,
    getAccessToken: getPrivyAccessToken,
    onRecovered: refreshAccountMe,
  })

  const appAccepted = computeAcceptedFromAppAccessStatus(accountMe?.appAccessStatus ?? null)
  const totalPoints = accountMe?.score?.points ?? 0
  const showPointsBadge = Boolean(joinedSessionAddress) && !accountMeLoading && accountMe?.score != null
  const showEmailSignupForm = shouldShowWaitlistEmailSignup({
    joinedSessionAddress,
    walletSignInPending,
    walletSessionAddress: props.walletSessionAddress ?? null,
  })
  const joinedCount = useCountUp(listCount, !joinedSessionAddress)

  const socialProof = (
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
      {joinedSessionAddress && !appAccepted ? (
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
  )

  const showXLinkPanel = !xPhaseDone && !twitterLinked
  const showXEngagement = twitterLinked && !xPhaseDone
  const showWalletStep = xPhaseDone && !externalEoaLinked && !walletSkipped
  const walletPhaseDone = externalEoaLinked || walletSkipped
  const showZoraStep = xPhaseDone && walletPhaseDone && !zoraLinked && !zoraSkipped

  // The connect steps are mutually exclusive (one "current step" at a time) —
  // track that as a single key so the transition between them can cross-fade
  // instead of the next panel abruptly replacing the previous one.
  const activeStepKey = showXLinkPanel
    ? 'x-link'
    : showXEngagement
      ? 'x-engagement'
      : showWalletStep
        ? 'wallet'
        : showZoraStep
          ? 'zora'
          : null

  // A step that was skipped rather than linked isn't a dead end — surface a
  // small "go back" reminder so the user can reopen it later for points.
  const xSkippedWithoutLink = xPhaseDone && !twitterLinked
  const showWalletSkippedReminder = walletSkipped && !externalEoaLinked
  const showZoraSkippedReminder = zoraSkipped && !zoraLinked
  const stepTransition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }
  const stepVariants = {
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.99 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 },
  }
  const reminderVariants = {
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 },
    animate: { opacity: 1, height: 'auto', y: 0 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 },
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
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full space-y-5 sm:space-y-6"
        >
          {/* Persistent brand mark — shown across every step of the flow (signup, code) so
              users always see where they are. Hidden once approved: the success state below
              renders the same mark (glowing) as its own success indicator, so keeping this one
              too would show the logo twice on one screen. */}
          {!(joinedSessionAddress && appAccepted) ? (
            <div className="flex justify-center">
              <div className="flex size-12 items-center justify-center overflow-hidden sm:size-[52px]">
                <img
                  src={siteAssets.logo}
                  alt="4626"
                  width={52}
                  height={52}
                  draggable={false}
                  className="size-full scale-[1.316] select-none object-contain"
                />
              </div>
            </div>
          ) : null}

          <AnimatePresence mode="wait" initial={false}>
            {joinedSessionAddress ? (
              <motion.div
                key="waitlist-joined"
                layout
                variants={phaseVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-6 sm:space-y-7"
              >
            <div className="text-center">
              <div className="flex flex-col items-center gap-3">
                {appAccepted ? (
                  // Keep approval state clean/professional: no repeating pulse loop.
                  // Use a subtle static emerald ring + soft ambient shadow.
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="relative flex items-center justify-center"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        boxShadow:
                          '0 0 0 1px rgba(52,211,153,0.2), 0 0 28px -10px rgba(52,211,153,0.5)',
                      }}
                    />
                    <span className="relative flex size-14 items-center justify-center overflow-hidden rounded-2xl border border-emerald-300/20 bg-black/20 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.55)]">
                      <img
                        src={siteAssets.logo}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        className="size-full scale-[1.316] select-none object-contain"
                      />
                    </span>
                  </motion.div>
                ) : null}

                <div className="space-y-1">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.h1
                      key={appAccepted ? 'approved' : 'listed'}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="headline text-2xl leading-tight tracking-[-0.03em] sm:text-3xl"
                    >
                      {appAccepted ? "You're approved" : "You're on the list"}
                    </motion.h1>
                  </AnimatePresence>
                  {/* Rendered below the headline (not as its own row above it) so the
                      identity avatar doesn't stack as a third competing circular shape
                      directly under the big checkmark. Points now live only in the
                      "Your points" summary below — no need to repeat the total here. */}
                  <WaitlistWelcomeGreeting
                    accountMe={accountMe}
                    accountMeLoading={accountMeLoading}
                    walletReturnAddress={
                      returningViaWallet
                        ? (props.walletSessionAddress ??
                          accountMe?.linkedMethods?.external_eoa?.[0] ??
                          null)
                        : null
                    }
                    returningViaWallet={returningViaWallet}
                  />
                  {appAccepted ? null : (
                    <p className="text-sm leading-relaxed text-zinc-400">
                      We'll notify you when your spot opens.
                    </p>
                  )}
                </div>
                </div>

                <WaitlistPostJoinShell enabled={Boolean(joinedSessionAddress)} />

                {/* Earn points — optional identity links, each worth waitlist points. */}
                <motion.div layout="position" transition={stepTransition} className="mt-5">
                  <WaitlistLinkedAccountsCard
                    rows={linkedAccountRows}
                    totalPoints={totalPoints}
                    showTotal={showPointsBadge}
                  />

                  <AnimatePresence mode="wait" initial={false}>
                    {activeStepKey === 'x-link' ? (
                      <motion.div
                        key="x-link"
                        variants={stepVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={stepTransition}
                      >
                        <WaitlistTwitterLinkPanel
                          busy={twitterBusy}
                          onConnect={() => {
                            setTwitterError(null)
                            void handleLinkTwitter()
                          }}
                          onSkip={handleSkipXPhase}
                        />
                      </motion.div>
                    ) : activeStepKey === 'x-engagement' ? (
                      <motion.div
                        key="x-engagement"
                        variants={stepVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={stepTransition}
                      >
                        <WaitlistTwitterEngagementSteps
                          getAccessToken={getPrivyAccessToken}
                          onProgressVerified={handleEngagementProgressVerified}
                          onSkip={handleSkipXPhase}
                        />
                      </motion.div>
                    ) : activeStepKey === 'wallet' ? (
                      <motion.div
                        key="wallet"
                        variants={stepVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={stepTransition}
                      >
                        <WaitlistWalletConnectPanel
                          busy={walletBusy}
                          onConnect={() => {
                            setWalletError(null)
                            void handleLinkWallet()
                          }}
                          onSkip={handleSkipWallet}
                        />
                      </motion.div>
                    ) : activeStepKey === 'zora' ? (
                      <motion.div
                        key="zora"
                        variants={stepVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={stepTransition}
                      >
                        <WaitlistZoraConnectPanel
                          busy={zoraBusy}
                          onConnect={() => {
                            setZoraError(null)
                            void handleLinkZora()
                          }}
                          onSkip={handleSkipZora}
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {/* Skipped steps aren't dead ends — let the user go back and link later. */}
                  <AnimatePresence initial={false}>
                    {xSkippedWithoutLink ? (
                      <motion.div
                        key="reminder-x"
                        variants={reminderVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={stepTransition}
                      >
                        <SkippedStepReminder
                          label="X"
                          points={PROVIDER_POINTS.twitter ?? 0}
                          onLinkNow={handleUndoSkipX}
                        />
                      </motion.div>
                    ) : null}
                    {showWalletSkippedReminder ? (
                      <motion.div
                        key="reminder-wallet"
                        variants={reminderVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={stepTransition}
                      >
                        <SkippedStepReminder
                          label="Wallet"
                          points={PROVIDER_POINTS.external_eoa ?? 0}
                          onLinkNow={handleUndoSkipWallet}
                        />
                      </motion.div>
                    ) : null}
                    {showZoraSkippedReminder ? (
                      <motion.div
                        key="reminder-zora"
                        variants={reminderVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={stepTransition}
                      >
                        <SkippedStepReminder
                          label="Zora"
                          points={PROVIDER_POINTS.zora_cross_app ?? 0}
                          onLinkNow={handleUndoSkipZora}
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>

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
                      className="btn-3d group/btn relative w-full overflow-hidden !rounded-full !min-h-[56px] !text-base !font-bold !tracking-wide"
                      asChild
                    >
                      <a href={`${APP_ORIGIN}/swap?restorePrivy=1`}>
                        <ButtonSheen />
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
            </div>
              </motion.div>
            ) : (
              <motion.div
                key="waitlist-signup"
                layout
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
                  {walletSignInPending
                    ? 'Sign in with your linked wallet to continue.'
                    : showEmailSignupForm
                      ? 'Claim your spot and start earning points.'
                      : 'Restoring your waitlist session…'}
                </p>
              </div>

              {showEmailSignupForm ? (
                <BeamCard className="p-5 sm:p-6" accent={codeStatus === 'success' ? 'success' : 'default'}>
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
                        transition={stepTransition}
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
                        transition={stepTransition}
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
                          className="btn-3d group/btn relative w-full overflow-hidden !rounded-full !min-h-[52px] text-[15px] font-semibold"
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
              ) : !walletSignInPending ? (
                <BeamCard className="p-6 text-center sm:p-8">
                  <div className="flex flex-col items-center gap-3">
                    <PixelWaveLoader name="wave-lr" size={18} color="rgba(255,255,255,0.85)" />
                    <p className="text-sm text-zinc-400">Restoring your waitlist session…</p>
                  </div>
                </BeamCard>
              ) : null}

              <div className="text-center">{socialProof}</div>

              {(showEmailSignupForm && step === 'email') || walletSignInPending ? (
                <WaitlistReturningWalletSignIn
                  busy={walletSignInPending}
                  onSignIn={handleSignInWithLinkedWallet}
                  onCancel={onCancelWalletSignIn}
                />
              ) : null}
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

          {joinedSessionAddress ? socialProof : null}

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
