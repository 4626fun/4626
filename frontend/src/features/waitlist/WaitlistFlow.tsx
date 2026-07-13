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
import { useQuery } from '@tanstack/react-query'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'
import { ArrowLeft, ArrowRight, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InputOTP, type InputOTPStatus } from '@/components/ui/InputOTP'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { cn } from '@/lib/shared/utils'
import { siteAssets } from '@/config/site'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { readWaitlistAlfaClubReturnPath } from '@/lib/auth/waitlistEntry'
import { getMarketingBaseUrl } from '@/lib/env/host'
import { runWaitlistPrivyLogout } from '@/features/waitlist/waitlistAuthState'
import {
  createAlfaClubAuthHandoffTarget,
  createAppAuthHandoffTarget,
} from '@/features/waitlist/waitlistHandoff'
import {
  establishWaitlistSessionAfterPrivyAuth,
  readAuthSessionAddress,
} from '@/features/waitlist/waitlistPrivySession'
import {
  resolveWaitlistJoinedSessionAddress,
  shouldClearOrphanWaitlistServerSession,
} from '@/features/waitlist/resolveWaitlistJoinedSession'
import {
  getWaitlistOtpSubmitHelperText,
  getWaitlistOtpSubmitLabel,
  resolveWaitlistAppAccepted,
  resolveWaitlistOtpInputStatus,
  resolveWaitlistOtpSubmitPhase,
  shouldAutoSubmitOtpCode,
} from '@/features/waitlist/waitlistFlowState'
import { WaitlistReturningWalletSignIn } from '@/features/waitlist/WaitlistReturningWalletSignIn'
import { shouldShowWaitlistEmailSignup } from '@/features/waitlist/waitlistSignupVisibility'
import { WaitlistTwitterLinkPanel } from '@/features/waitlist/WaitlistTwitterLinkPanel'
import { WaitlistTwitterEngagementSteps } from '@/features/waitlist/WaitlistTwitterEngagementSteps'
import { WaitlistWalletConnectPanel } from '@/features/waitlist/WaitlistWalletConnectPanel'
import { WaitlistZoraConnectPanel } from '@/features/waitlist/WaitlistZoraConnectPanel'
import { WaitlistAccountTray } from '@/features/waitlist/WaitlistAccountTray'
import { WaitlistPrivyIdentitiesPanel } from '@/features/waitlist/WaitlistPrivyIdentitiesPanel'
import { PROVIDER_POINTS } from '@/features/waitlist/waitlistTiers'
import {
  clearWaitlistOnboardingStepFlags,
  readWaitlistJoinedAvatarsRevealed,
  readWaitlistWalletSkipped,
  readWaitlistXPhaseDone,
  readWaitlistZoraSkipped,
  writeWaitlistJoinedAvatarsRevealed,
  writeWaitlistWalletSkipped,
  writeWaitlistXPhaseDone,
  writeWaitlistZoraSkipped,
} from '@/features/waitlist/waitlistStorage'
import { performZoraCrossAppAuth, isRecoverableCrossAppAuthError, isUserRejectedCrossAppAuthError } from '@/lib/privy/zoraCrossApp'
import { findLinkedTwitterSubject } from '@/lib/privy/linkedAccounts'
import { hasZoraReadOnlySignals, resolveZoraReadOnlySignals } from '@/lib/zora/zoraReadOnlyResolve'
import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
import { appendLocalhostPrivyAuthNoteIfNeeded } from '@/lib/privy/localhostPrivyAuthNotice'
import { useWaitlistZoraOAuthReturnRecovery } from '@/lib/privy/useWaitlistZoraOAuthReturnRecovery'
import { WaitlistWelcomeGreeting } from '@/features/waitlist/WaitlistWelcomeGreeting'
import {
  linkAndSyncPrivyProvider,
  syncAccountsProviderLink,
  unlinkAndSyncPrivyProvider,
} from '@/lib/privy/providerLink'
import { usePrivyOAuthReturnBackendSync } from '@/lib/privy/usePrivyOAuthReturnBackendSync'
import {
  createLivePrivyClientView,
  useSafeCrossApp,
  useSafeLogin,
  useSafeLoginWithEmail,
  useSafePrivy,
  useSafePrivyAccessToken,
} from '@/lib/privy/safeHooks'
import { useAccountMe } from '@/hooks/useAccountMe'
import { fetchWaitlistMe, getWaitlistMeSessionQueryKey } from '@/lib/waitlist/waitlistMeQuery'

const OTP_RESEND_DELAY_MS = 30_000
const OTP_SUCCESS_HOLD_MS = 320
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WAITLIST_OAUTH_RETURN_SYNC_PROVIDERS = ['twitter'] as const
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

// A single soft ambient glow (border ring + one diffuse halo) reads calmer
// and more premium than stacking several concentric glow radii.
const WAITLIST_PANEL_STYLE = {
  background: 'linear-gradient(165deg, rgb(var(--vault-card)), rgb(var(--vault-card-raised)))',
  boxShadow:
    '0 18px 45px -24px rgba(0, 0, 0, 0.65), 0 0 0 1px rgb(var(--brand-primary) / 0.14), 0 0 44px 2px rgb(var(--brand-primary) / 0.14)',
} as const

const WAITLIST_PANEL_SUCCESS_STYLE: CSSProperties = {
  background: WAITLIST_PANEL_STYLE.background,
  boxShadow:
    '0 18px 45px -24px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(52, 211, 153, 0.26), 0 0 44px 2px rgba(52, 211, 153, 0.18)',
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
      className={cn('relative rounded-2xl transition-shadow duration-500 ease-out', className)}
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

// Tracks whether a step index just advanced (+1) or retreated (-1) so the
// wizard transition can slide in the matching spatial direction instead of a
// generic fade. Uses React's documented "adjust state during rendering"
// pattern (https://react.dev/learn/you-might-not-need-an-effect) rather than
// an effect, so the direction is available for the very render that changes
// it — no one-render lag, and no cascading-render lint violation.
function useStepDirection(stepIndex: number | null): number {
  const [previous, setPrevious] = useState(stepIndex)
  const [direction, setDirection] = useState(0)
  if (stepIndex !== previous) {
    if (previous != null && stepIndex != null) {
      setDirection(stepIndex > previous ? 1 : -1)
    }
    setPrevious(stepIndex)
  }
  return direction
}

type LinkingStepStatus = 'upcoming' | 'current' | 'done' | 'skipped'

type LinkingProgressStep = {
  key: string
  label: string
  status: LinkingStepStatus
}

// Small step tracker for the post-join "earn points" wizard (X → Wallet →
// Zora). Without it, one optional panel silently replaces the last with no
// sense of how many steps remain — this gives an at-a-glance read on
// progress. Purely decorative dots backed by a single accessible progress
// summary for screen readers. `compact` drops the text labels and tightens
// sizing so it can sit inline as part of the "Your points" card header
// instead of taking its own full row.
function WaitlistLinkingProgress({
  steps,
  compact = false,
}: {
  steps: LinkingProgressStep[]
  compact?: boolean
}) {
  const currentIndex = steps.findIndex((step) => step.status === 'current')
  const activeIndex = currentIndex >= 0 ? currentIndex : steps.length
  const currentLabel = currentIndex >= 0 ? steps[currentIndex]?.label : 'Done'
  const stepNumber = Math.min(activeIndex + 1, steps.length)

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuenow={stepNumber}
      aria-valuetext={`Step ${stepNumber} of ${steps.length}: ${currentLabel}`}
      className={cn('flex items-center justify-center', compact ? 'gap-0' : 'mb-4')}
    >
      {steps.map((step, index) => (
        <div key={step.key} className="flex items-center" aria-hidden="true">
          <div className={cn('flex flex-col items-center', compact ? 'gap-0' : 'gap-1.5')}>
            <span
              className={cn(
                'flex items-center justify-center rounded-full border transition-colors duration-300',
                compact ? 'size-3.5' : 'size-5',
                step.status === 'done' && 'border-transparent bg-[rgb(var(--brand-primary))] text-white',
                step.status === 'current' &&
                  'border-[rgb(var(--brand-primary))] bg-[rgb(var(--brand-primary)/0.16)]',
                step.status === 'skipped' && 'border-dashed border-zinc-600',
                step.status === 'upcoming' && 'border-zinc-700',
              )}
            >
              {step.status === 'done' ? (
                <Check className={compact ? 'size-2' : 'size-3'} aria-hidden="true" />
              ) : (
                <span
                  className={cn(
                    'rounded-full',
                    compact ? 'size-1' : 'size-1.5',
                    step.status === 'current' && 'animate-pulse bg-[rgb(var(--brand-primary))]',
                    step.status === 'skipped' && 'bg-zinc-600',
                    step.status === 'upcoming' && 'bg-zinc-700',
                  )}
                />
              )}
            </span>
            {compact ? null : (
              <span
                className={cn(
                  'text-[9px] font-medium uppercase tracking-[0.1em] transition-colors duration-300',
                  step.status === 'current' ? 'text-zinc-300' : 'text-zinc-600',
                )}
              >
                {step.label}
              </span>
            )}
          </div>
          {index < steps.length - 1 ? (
            <span
              className={cn(
                'h-px transition-colors duration-300',
                compact ? 'w-3' : 'mb-4 w-5',
                step.status === 'done' || step.status === 'skipped'
                  ? 'bg-[rgb(var(--brand-primary)/0.4)]'
                  : 'bg-white/10',
              )}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}

/** Upper bound on how many real member avatars we ever display in the
 * social-proof stack — a safety cap, not a padding target. Slots are never
 * backfilled with placeholder discs: the visible avatar count is always
 * `min(realAvatars.length, this)`, so every dot shown is a real photo. */
const MAX_SOCIAL_PROOF_AVATARS = 12
/** Shared entrance stagger/duration for the avatar stack — used both
 * pre-join (avatars appear, then swap to the count) and post-join (avatars
 * appear next to the count, permanently). */
const AVATAR_STAGGER_S = 0.05
const AVATAR_DURATION_S = 0.32
function avatarEntranceTotalMs(count: number): number {
  if (count <= 0) return 0
  return Math.round((AVATAR_DURATION_S + Math.max(0, count - 1) * AVATAR_STAGGER_S) * 1000)
}
/** Plain fade+scale transition for the pre-join avatars → count crossfade. */
const SOCIAL_PROOF_CROSSFADE_TRANSITION = { duration: 0.3, ease: [0.22, 1, 0.36, 1] } as const
/** Shared spring for the "N already joined" pill's shared-`layoutId` flight
 * down into the "Already joined?" divider — a spring (vs. a fixed duration)
 * settles more naturally when the two ends have different box sizes. */
const DOCK_FLIP_TRANSITION = { type: 'spring', stiffness: 300, damping: 32, mass: 0.8 } as const

// Which reveal choreography the avatar stack plays on mount:
// - 'animate': stagger-fade in.
// - 'static': no entrance — used post-join once the stagger has already
//   played once this session (see `joinedAvatarsRevealed` in `WaitlistFlow`),
//   so revisiting the joined view doesn't replay it.
type AvatarRevealVariant = 'animate' | 'static'

// Overlapping avatar stack of real member PFPs only — slot count always
// matches `avatars.length` (capped at `MAX_SOCIAL_PROOF_AVATARS`), so there
// are never blank/placeholder discs mixed in with real photos. A plain
// stagger-fade entrance, no per-avatar exit choreography — see
// `AvatarRevealVariant` above for the two variants this supports.
function JoinedAvatars({
  avatars,
  variant = 'animate',
}: {
  avatars: WaitlistAvatar[]
  variant?: AvatarRevealVariant
}) {
  const reduceMotion = useReducedMotion()
  const capped = avatars.slice(0, MAX_SOCIAL_PROOF_AVATARS)
  const animate = variant === 'animate' && !reduceMotion

  return (
    <div className="flex shrink-0 items-center -space-x-2.5">
      {capped.map((avatar, index) => (
        <motion.span
          key={avatar.src}
          initial={animate ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: AVATAR_DURATION_S,
            delay: animate ? index * AVATAR_STAGGER_S : 0,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <AvatarDot avatar={avatar} index={index} />
        </motion.span>
      ))}
    </div>
  )
}

// Shared Framer Motion `layoutId` for the "N already joined" pill's one-time
// flight from the avatar row down into the "Already joined?" divider. Both
// ends just need to mount a `motion` element with this id — Framer computes
// the position/size interpolation between them automatically.
const ALREADY_JOINED_DOCK_LAYOUT_ID = 'waitlist-already-joined-dock'

type AlreadyJoinedDockPhase = 'shown' | 'docking' | 'docked'

// Lives inside the "Already joined?" divider (see `WaitlistReturningWalletSignIn`'s
// `labelSlot`) and plays the landing half of the dock animation: an invisible
// spacer (keeps the divider's width stable) until the pill above is ready to
// land, then the landed pill itself, then a crossfade into the real
// "Already joined?" control — which, on hover, reveals it doubles as a link
// to the public leaderboard. All three states share one `AnimatePresence` in
// `popLayout` mode so the pill→link hand-off reads as a single soft dissolve
// (old fading out while the new one is already in place) instead of a hard
// unmount-then-fade-in.
function WaitlistAlreadyJoinedSlot({
  dockPhase,
  joinedLabel,
}: {
  dockPhase: AlreadyJoinedDockPhase
  joinedLabel: number
}) {
  return (
    <AnimatePresence mode="popLayout">
      {dockPhase === 'docked' ? (
        <motion.div
          key="docked"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            to="/leaderboard"
            className="group/aj relative inline-flex min-w-[92px] items-center justify-center text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 transition hover:text-zinc-300"
          >
            <span className="inline-flex items-center transition-opacity duration-150 group-hover/aj:opacity-0">
              Already joined?
            </span>
            <span className="pointer-events-none absolute inset-0 inline-flex items-center justify-center gap-1 whitespace-nowrap normal-case tracking-normal opacity-0 transition-opacity duration-150 group-hover/aj:opacity-100">
              See who&apos;s joined
              <ArrowRight className="size-3 transition group-hover/aj:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        </motion.div>
      ) : dockPhase === 'docking' ? (
        <motion.span
          key="landed-pill"
          layoutId={ALREADY_JOINED_DOCK_LAYOUT_ID}
          transition={DOCK_FLIP_TRANSITION}
          // A quiet fade-out (vs. an instant unmount) so the swap into the
          // real "Already joined?" link reads as one continuous dissolve.
          exit={{ opacity: 0, transition: { duration: 0.22, ease: 'easeOut' } }}
          // Matches the source badge's `text-[11px]` exactly (see `renderSocialProof`)
          // — a font-size mismatch between the two `layoutId`-linked elements makes
          // Framer's shared-layout FLIP visibly squish/stretch the text as it
          // interpolates box size, which read as a glitch during the hand-off.
          className="inline-flex items-baseline whitespace-nowrap text-[11px] font-medium leading-none text-zinc-400"
        >
          <SocialProofJoinedLabel count={joinedLabel} />
        </motion.span>
      ) : (
        // Invisible placeholder — keeps the divider's width/height stable so
        // nothing jumps around before the pill above is ready to land here.
        <span key="spacer" aria-hidden="true" className="text-[10px] font-medium uppercase tracking-[0.14em] text-transparent">
          Already joined?
        </span>
      )}
    </AnimatePresence>
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

// Subtle cursor-follow tilt for the primary CTA — a light "magnetic" feel
// without being gimmicky. No-op (renders children directly) under reduced
// motion or on touch devices, where there's no persistent cursor to track.
function MagneticButton({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  const pointerX = useMotionValue(0.5)
  const pointerY = useMotionValue(0.5)
  const springConfig = { stiffness: 300, damping: 22, mass: 0.6 }
  const rotateX = useSpring(useTransform(pointerY, [0, 1], [5, -5]), springConfig)
  const rotateY = useSpring(useTransform(pointerX, [0, 1], [-5, 5]), springConfig)

  if (reduceMotion) return <>{children}</>

  return (
    <motion.div
      style={{ rotateX, rotateY, transformPerspective: 500 }}
      onPointerMove={(event) => {
        if (event.pointerType !== 'mouse') return
        const rect = event.currentTarget.getBoundingClientRect()
        pointerX.set((event.clientX - rect.left) / rect.width)
        pointerY.set((event.clientY - rect.top) / rect.height)
      }}
      onPointerLeave={() => {
        pointerX.set(0.5)
        pointerY.set(0.5)
      }}
    >
      {children}
    </motion.div>
  )
}

// A checkmark that draws itself on (stroke animates in) rather than just
// fading/scaling — reads as a more deliberate "confirmed" moment.
function DrawnCheck({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <motion.path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: [0.65, 0, 0.35, 1] }}
      />
    </svg>
  )
}

function SocialProofJoinedLabel({ count }: { count: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="inline-block tabular-nums leading-none font-semibold text-zinc-200">
        {count.toLocaleString()}
      </span>
      <span>already joined</span>
    </span>
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


export function WaitlistFlow(props: WaitlistFlowProps) {
  const sectionId = props.sectionId ?? 'waitlist-page'
  const onRequestWalletSignIn = props.onRequestWalletSignIn ?? noop
  const onCancelWalletSignIn = props.onCancelWalletSignIn ?? noop
  const onClearWalletSignInError = props.onClearWalletSignInError ?? noop
  const onClearWalletSession = props.onClearWalletSession ?? noop
  const walletSignInPending = props.walletSignInPending === true
  const privy = useSafePrivy()
  const privyRef = useRef(privy)
  const { sendCode, loginWithCode } = useSafeLoginWithEmail()
  const { login } = useSafeLogin()
  const getPrivyAccessToken = useSafePrivyAccessToken()
  const loginRef = useRef(login)

  useEffect(() => {
    privyRef.current = privy
    loginRef.current = login
  })

  const [step, setStep] = useState<SignupStep>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeStatus, setCodeStatus] = useState<InputOTPStatus>('default')
  const [emailBusy, setEmailBusy] = useState(false)
  const [codeBusy, setCodeBusy] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [continueBusy, setContinueBusy] = useState(false)
  const [localSessionAddress, setLocalSessionAddress] = useState<string | null>(null)
  const [serverSessionAddress, setServerSessionAddress] = useState<string | null>(null)
  const [sessionProbeComplete, setSessionProbeComplete] = useState(false)
  // Latch Privy ready for UI: Base App WebViews flap `ready` and would otherwise
  // disable the CTA / swap helper copy every few hundred ms.
  const [privyReadyLatched, setPrivyReadyLatched] = useState(() => privy.ready === true)
  const orphanSessionCleanupRef = useRef(false)
  const sessionProbeStartedRef = useRef(false)

  useEffect(() => {
    if (privy.ready === true) setPrivyReadyLatched(true)
  }, [privy.ready])
  const [error, setError] = useState<string | null>(null)
  const [listCount, setListCount] = useState<number | null>(null)
  const [memberAvatars, setMemberAvatars] = useState<WaitlistAvatar[]>([])
  const lastNonEmptyWaitlistStatsRef = useRef<{ signedUpCount: number | null; avatars: WaitlistAvatar[] }>({
    signedUpCount: null,
    avatars: [],
  })
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
  const alfaClubReturnPath = useMemo(
    () =>
      typeof window === 'undefined'
        ? null
        : readWaitlistAlfaClubReturnPath(window.location.search),
    [],
  )

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
    console.info('[waitlist-join] gate', {
      sessionProbeComplete,
      privyReady: privy.ready === true,
      privyAuthenticated: privy.authenticated === true,
      walletSignInPending,
      hasLocalSession: Boolean(localSessionAddress?.trim()),
      hasServerSession: Boolean(serverSessionAddress?.trim()),
      joined: Boolean(joinedSessionAddress),
    })
  }, [
    joinedSessionAddress,
    localSessionAddress,
    privy.authenticated,
    privy.ready,
    serverSessionAddress,
    sessionProbeComplete,
    walletSignInPending,
  ])

  useEffect(() => {
    if (!props.walletSignInError) return
    setError(props.walletSignInError)
    onClearWalletSignInError()
  }, [onClearWalletSignInError, props.walletSignInError])

  // Probe the 4626 session cookie on mount — do not wait for Privy `ready`.
  // Base App WebViews often flap Privy ready for several seconds; gating the
  // probe on that signal left the UI in signup limbo (or bouncing) while a
  // valid cookie already existed.
  useEffect(() => {
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
      // StrictMode-safe: allow the re-invoked effect to restart the probe;
      // otherwise a cancelled first run leaves sessionProbeComplete false forever.
      sessionProbeStartedRef.current = false
    }
  }, [])

  const signupInProgress = step === 'code' || emailBusy || codeBusy || signupInFlightRef.current
  // Base App Privy auth flaps can last several seconds; keep orphan cleanup
  // slower than those flaps so a brief unauthenticated window does not wipe
  // a still-valid server cookie and bounce the user back to signup.
  const ORPHAN_SESSION_CLEANUP_DELAY_MS = 8_000

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
      if (!json?.success) return

      const signedUpCount =
        typeof json.data?.signedUpCount === 'number' && Number.isFinite(json.data.signedUpCount)
          ? Math.max(0, Math.floor(json.data.signedUpCount))
          : null
      const avatars = Array.isArray(json.data?.avatars)
        ? json.data.avatars.filter(
            (avatar): avatar is WaitlistAvatar =>
              Boolean(avatar) && typeof avatar.src === 'string' && avatar.src.length > 0,
          )
        : []
      const looksLikeFailOpenEmpty = signedUpCount === 0 && avatars.length === 0

      if (looksLikeFailOpenEmpty) {
        const previous = lastNonEmptyWaitlistStatsRef.current
        if ((previous.signedUpCount ?? 0) > 0 || previous.avatars.length > 0) {
          // Public stats intentionally fail-open with `0/[]` on transient backend
          // issues. Keep the last non-empty snapshot so social proof doesn't flicker
          // back to placeholders between successful polls.
          if ((previous.signedUpCount ?? 0) > 0) {
            setListCount((current) => current ?? previous.signedUpCount)
          }
          if (previous.avatars.length > 0) {
            setMemberAvatars((current) => (current.length > 0 ? current : previous.avatars))
          }
          return
        }
      }

      if (signedUpCount != null) {
        setListCount(signedUpCount)
        if (signedUpCount > 0) {
          lastNonEmptyWaitlistStatsRef.current.signedUpCount = signedUpCount
        }
      }
      if (avatars.length > 0) {
        setMemberAvatars(avatars)
        lastNonEmptyWaitlistStatsRef.current.avatars = avatars
      }
    } catch {
      // fail open — placeholders still render
    }
  }, [])

  // Social proof — initial fetch plus periodic refresh while the tab is visible.
  // Hidden-tab polling was a major contributor to repeated expensive avatar queries.
  useEffect(() => {
    const runFetch = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void fetchWaitlistStats()
    }
    const timeoutId = window.setTimeout(runFetch, 0)
    const intervalId = window.setInterval(runFetch, 60_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') runFetch()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchWaitlistStats])

  // Auto-focus the email field on intentional CTA arrival.
  useEffect(() => {
    if (!joinIntent || !privyReadyLatched || joinedSessionAddress || step !== 'email') return
    emailInputRef.current?.focus()
  }, [joinIntent, privyReadyLatched, joinedSessionAddress, step])

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
  // and confirm the HttpOnly session. Embedded EOA provisioning is server-owned
  // inside `/api/auth/privy` — do not call client createWallet here (localhost
  // iframe create clears the OTP session).
  //
  // Must use a live Privy view: `usePrivy()` returns a fresh object per render,
  // and establishWaitlistSessionAfterPrivyAuth may re-read token/auth state.
  const finishJoinAfterPrivyAuth = useCallback(async () => {
    const confirmedSessionAddress = await establishWaitlistSessionAfterPrivyAuth({
      privy: createLivePrivyClientView(privyRef),
      missingTokenMessage:
        'Could not verify your email session. Please try again. If the issue persists, try an incognito/private window or temporarily disable browser wallet extensions.',
    })
    setLocalSessionAddress(confirmedSessionAddress)
    setServerSessionAddress(confirmedSessionAddress)
    void fetchWaitlistStats()
  }, [fetchWaitlistStats])

  const handleAlfaClubContinue = useCallback(async () => {
    if (!alfaClubReturnPath || continueBusy) return
    setContinueBusy(true)
    setError(null)
    try {
      const target = await createAlfaClubAuthHandoffTarget({
        returnPath: alfaClubReturnPath,
      })
      if (!target) {
        throw new Error('Could not securely return to AlfaClub. Please try again.')
      }
      window.location.replace(target)
    } catch (continueError) {
      setError(
        continueError instanceof Error
          ? continueError.message
          : 'Could not securely return to AlfaClub. Please try again.',
      )
      setContinueBusy(false)
    }
  }, [alfaClubReturnPath, continueBusy])

  const handleAppContinue = useCallback(async () => {
    if (continueBusy) return
    setContinueBusy(true)
    setError(null)
    try {
      const privyToken = getPrivyAccessToken ? await getPrivyAccessToken() : null
      const target = await createAppAuthHandoffTarget({ privyToken })
      if (!target) {
        throw new Error('Your secure session needs to be refreshed. Sign out, verify your email, then try again.')
      }
      window.location.replace(target)
    } catch (continueError) {
      setError(
        continueError instanceof Error
          ? continueError.message
          : 'Could not securely enter the app. Please try again.',
      )
      setContinueBusy(false)
    }
  }, [continueBusy, getPrivyAccessToken])

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
  const otpSubmitPhase = resolveWaitlistOtpSubmitPhase({ codeStatus, codeBusy })
  const otpSubmitLabel = getWaitlistOtpSubmitLabel(otpSubmitPhase)
  const otpSubmitHelperText = getWaitlistOtpSubmitHelperText(otpSubmitPhase)
  const otpInputStatus = resolveWaitlistOtpInputStatus({ codeStatus, codeBusy })
  const canResend = resendAvailableAt == null || resendAvailableAt <= nowMs
  const resendSeconds =
    resendAvailableAt != null && resendAvailableAt > nowMs ? Math.ceil((resendAvailableAt - nowMs) / 1_000) : 0

  const { me: accountMe, loading: accountMeLoading, refresh: refreshAccountMe } = useAccountMe({
    enabled: Boolean(joinedSessionAddress),
  })
  const waitlistMeQuery = useQuery({
    queryKey: getWaitlistMeSessionQueryKey(joinedSessionAddress),
    enabled: Boolean(joinedSessionAddress),
    queryFn: fetchWaitlistMe,
    staleTime: 15_000,
    retry: 1,
  })
  const [twitterBusy, setTwitterBusy] = useState(false)
  const [twitterError, setTwitterError] = useState<string | null>(null)
  const [walletBusy, setWalletBusy] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [zoraBusy, setZoraBusy] = useState(false)
  const [zoraError, setZoraError] = useState<string | null>(null)
  const { loginWithCrossAppAccount, linkCrossAppAccount } = useSafeCrossApp()

  const twitterLinked = (accountMe?.linkedMethods?.twitter ?? []).length > 0
  const canonicalCswLower = accountMe?.accountSignals?.canonicalCswAddress?.trim().toLowerCase() ?? null
  const linkedExternalCandidates = (accountMe?.linkedMethods?.external_eoa ?? [])
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
  // Base App / Coinbase Smart Wallet can land in linkedMethods.external_eoa when
  // Privy omits smart-wallet metadata; never treat the canonical CSW as an EOA.
  const linkedEoaAddress =
    linkedExternalCandidates.find((address) => address.toLowerCase() !== canonicalCswLower) ?? null
  const externalEoaLinked = Boolean(linkedEoaAddress)
  const walletIdentityLinked = externalEoaLinked || Boolean(canonicalCswLower)
  const zoraLinked =
    (accountMe?.linkedMethods?.zora_cross_app ?? []).length > 0 ||
    Boolean(accountMe?.accountSignals?.linked)

  const returningViaWallet = useMemo(() => {
    const wallet = props.walletSessionAddress?.trim().toLowerCase()
    const joined = joinedSessionAddress?.trim().toLowerCase()
    return Boolean(wallet && joined && wallet === joined)
  }, [joinedSessionAddress, props.walletSessionAddress])

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
      const twitterSubject = findLinkedTwitterSubject(privy.user)
      if (!twitterSubject) {
        setTwitterError('Could not resolve your linked X account. Sign out, sign in again, then retry.')
        return
      }
      await unlinkAndSyncPrivyProvider({
        privy,
        provider: 'twitter',
        getAccessToken: getPrivyAccessToken,
        value: twitterSubject,
      })
      setXPhaseDone(false)
      writeWaitlistXPhaseDone(false)
      refreshAccountMe()
    } catch (unlinkError) {
      const message = unlinkError instanceof Error ? unlinkError.message : 'Could not disconnect X.'
      setTwitterError(appendLocalhostPrivyAuthNoteIfNeeded(message))
    } finally {
      setTwitterBusy(false)
    }
  }, [getPrivyAccessToken, privy, refreshAccountMe, twitterBusy, twitterLinked])

  const handleLinkWallet = useCallback(async () => {
    if (walletBusy || walletIdentityLinked) return
    setWalletBusy(true)
    setWalletError(null)
    try {
      if (privyRef.current.ready !== true || privyRef.current.authenticated !== true) {
        throw new Error('Your email session expired. Sign in with email OTP again, then reconnect your wallet.')
      }
      const data = await linkAndSyncPrivyProvider({
        privy: privyRef.current,
        provider: 'external_eoa',
        login: loginRef.current ?? null,
        getAccessToken: getPrivyAccessToken,
      })
      if (data) {
        refreshAccountMe()
      }
    } catch (linkError) {
      const message = linkError instanceof Error ? linkError.message : 'Could not connect wallet.'
      setWalletError(appendLocalhostPrivyAuthNoteIfNeeded(message))
    } finally {
      setWalletBusy(false)
    }
  }, [
    getPrivyAccessToken,
    refreshAccountMe,
    walletBusy,
    walletIdentityLinked,
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
      const message = unlinkError instanceof Error ? unlinkError.message : 'Could not disconnect wallet.'
      setWalletError(appendLocalhostPrivyAuthNoteIfNeeded(message))
    } finally {
      setWalletBusy(false)
    }
  }, [externalEoaLinked, getPrivyAccessToken, linkedEoaAddress, privy, refreshAccountMe, walletBusy])

  // First-time link errors (provider not yet linked, so there's no row to attach
  // the message to) vs. edit/unlink errors (X row / wallet roles section).
  // Zora/creator already surfaces under PRIMARY IDENTITY — no separate Identities row.
  const unlinkedProviderError =
    (!twitterLinked && twitterError) ||
    (!externalEoaLinked && walletError) ||
    (!zoraLinked && zoraError) ||
    null

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
    providers: WAITLIST_OAUTH_RETURN_SYNC_PROVIDERS,
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

  useWaitlistZoraOAuthReturnRecovery({
    enabled: Boolean(joinedSessionAddress),
    privyReady: privy.ready,
    privyAuthenticated: privy.authenticated,
    privyUser: privy.user,
    zoraLinked,
    getAccessToken: getPrivyAccessToken,
    onRecovered: refreshAccountMe,
  })

  const appAccepted = resolveWaitlistAppAccepted({
    sessionAppAccessStatus: waitlistMeQuery.data?.appAccessStatus,
    accountAppAccessStatus: accountMe?.appAccessStatus,
  })
  const showEmailSignupForm = shouldShowWaitlistEmailSignup({
    joinedSessionAddress,
    walletSignInPending,
    walletSessionAddress: props.walletSessionAddress ?? null,
  })
  const reduceMotionForDock = useReducedMotion()
  const socialProofAvatarCount = Math.min(memberAvatars.length, MAX_SOCIAL_PROOF_AVATARS)
  const [joinedAvatarsRevealed, setJoinedAvatarsRevealed] = useState(
    () => readWaitlistJoinedAvatarsRevealed(),
  )

  // Plain final count — no incremental ramping. `listCount` comes from a
  // single stats fetch, not a live ticker, so there's nothing to animate
  // toward; the "arriving" feel comes from the avatars → count crossfade
  // below, not from the number itself climbing.
  const joinedCount = listCount ?? 0

  // One-time choreography, pre-join only: avatars show first, then (after a
  // beat) crossfade to the "N already joined" count, then (after another
  // beat) that count flies down and docks into the "Already joined?" divider
  // below it (see `ALREADY_JOINED_DOCK_LAYOUT_ID` and
  // `WaitlistAlreadyJoinedSlot`), which then becomes the interactive "hover
  // to see the leaderboard" control. Skipped once already joined (that view
  // keeps avatars + count permanently side by side instead).
  const [showAvatarStack, setShowAvatarStack] = useState(true)
  const [alreadyJoinedDockPhase, setAlreadyJoinedDockPhase] = useState<AlreadyJoinedDockPhase>('shown')
  useEffect(() => {
    if (joinedSessionAddress) return
    if (listCount == null || listCount <= 0) return

    if (reduceMotionForDock) {
      setShowAvatarStack(false)
      setAlreadyJoinedDockPhase('docked')
      return
    }

    setShowAvatarStack(socialProofAvatarCount > 0)
    const countRevealDelayMs =
      socialProofAvatarCount > 0 ? avatarEntranceTotalMs(socialProofAvatarCount) + 900 : 0
    const dockStartDelayMs = countRevealDelayMs + 900
    const DOCKING_TRANSITION_MS = 650

    const revealTimer = window.setTimeout(() => setShowAvatarStack(false), countRevealDelayMs)
    const dockTimer = window.setTimeout(() => setAlreadyJoinedDockPhase('docking'), dockStartDelayMs)
    const dockedTimer = window.setTimeout(
      () => setAlreadyJoinedDockPhase('docked'),
      dockStartDelayMs + DOCKING_TRANSITION_MS,
    )
    return () => {
      window.clearTimeout(revealTimer)
      window.clearTimeout(dockTimer)
      window.clearTimeout(dockedTimer)
    }
  }, [joinedSessionAddress, listCount, reduceMotionForDock, socialProofAvatarCount])

  // One-time post-join entrance: persist so remount/reload in the same
  // session shows avatars at rest instead of replaying the stagger-in.
  useEffect(() => {
    if (!joinedSessionAddress || joinedAvatarsRevealed || reduceMotionForDock) return
    if (socialProofAvatarCount <= 0) return

    const timer = window.setTimeout(() => {
      setJoinedAvatarsRevealed(true)
      writeWaitlistJoinedAvatarsRevealed(true)
    }, avatarEntranceTotalMs(socialProofAvatarCount))

    return () => window.clearTimeout(timer)
  }, [joinedSessionAddress, joinedAvatarsRevealed, reduceMotionForDock, socialProofAvatarCount])

  const renderSocialProof = (dockable: boolean) => {
    const avatarVariant: AvatarRevealVariant = !dockable && joinedAvatarsRevealed ? 'static' : 'animate'
    const showCountBadge =
      (!dockable || alreadyJoinedDockPhase === 'shown') && listCount != null && listCount > 0
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="mx-auto inline-flex items-center">
          {dockable ? (
            // Pre-join: avatars show first, then crossfade to the count (see
            // the `showAvatarStack`/`alreadyJoinedDockPhase` effect above) —
            // one simple fade+scale swap, not a per-avatar countdown.
            <AnimatePresence mode="wait">
              {showAvatarStack && socialProofAvatarCount > 0 ? (
                <motion.div
                  key="avatars"
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={SOCIAL_PROOF_CROSSFADE_TRANSITION}
                >
                  <JoinedAvatars avatars={memberAvatars} variant={avatarVariant} />
                </motion.div>
              ) : showCountBadge ? (
                <motion.p
                  key="count-badge"
                  layoutId={ALREADY_JOINED_DOCK_LAYOUT_ID}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={SOCIAL_PROOF_CROSSFADE_TRANSITION}
                  className="inline-flex shrink-0 items-baseline whitespace-nowrap text-[11px] font-medium leading-none text-zinc-400"
                >
                  <SocialProofJoinedLabel count={joinedCount} />
                </motion.p>
              ) : null}
            </AnimatePresence>
          ) : (
            // Post-join: avatars + count sit permanently side by side.
            <>
              {socialProofAvatarCount > 0 ? (
                <JoinedAvatars avatars={memberAvatars} variant={avatarVariant} />
              ) : null}
              {socialProofAvatarCount > 0 && showCountBadge ? (
                <span aria-hidden="true" className="w-2 shrink-0" />
              ) : null}
              {showCountBadge ? (
                <p className="inline-flex shrink-0 items-baseline whitespace-nowrap text-[11px] font-medium leading-none text-zinc-400">
                  <SocialProofJoinedLabel count={joinedCount} />
                </p>
              ) : null}
            </>
          )}
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
  }

  const showXLinkPanel = !xPhaseDone && !twitterLinked
  const showXEngagement = twitterLinked && !xPhaseDone
  const showWalletStep = xPhaseDone && !walletIdentityLinked && !walletSkipped
  const walletPhaseDone = walletIdentityLinked || walletSkipped
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
  const showWalletSkippedReminder = walletSkipped && !walletIdentityLinked
  const showZoraSkippedReminder = zoraSkipped && !zoraLinked

  // The step tracker is only useful while the wizard is actively guiding the
  // user (a panel is showing) or reminding them about something skipped. Once
  // every step is linked, the "Your points" list above already shows the same
  // three accounts with real identities — the abstract X/Wallet/Zora dots
  // would just be a redundant, all-checked row cluttering the finished state.
  const linkingWizardInProgress =
    activeStepKey !== null || xSkippedWithoutLink || showWalletSkippedReminder || showZoraSkippedReminder

  // Signup (email -> code) and the post-join linking wizard (X -> wallet ->
  // Zora) each get their own forward/backward slide direction, so "Edit"
  // (back to email) or reopening a skipped step ("Link now") visibly reverses
  // instead of using the same generic forward animation both ways.
  const signupStepIndex = step === 'email' ? 0 : 1
  const signupDirection = useStepDirection(signupStepIndex)
  const linkingStepIndex =
    activeStepKey === 'x-link' || activeStepKey === 'x-engagement'
      ? 0
      : activeStepKey === 'wallet'
        ? 1
        : activeStepKey === 'zora'
          ? 2
          : 3
  const linkingDirection = useStepDirection(linkingStepIndex)
  const linkingSteps: LinkingProgressStep[] = [
    {
      key: 'x',
      label: 'X',
      status: twitterLinked
        ? 'done'
        : activeStepKey === 'x-link' || activeStepKey === 'x-engagement'
          ? 'current'
          : xSkippedWithoutLink
            ? 'skipped'
            : 'upcoming',
    },
    {
      key: 'wallet',
      label: 'Wallet',
      status: walletIdentityLinked
        ? 'done'
        : activeStepKey === 'wallet'
          ? 'current'
          : showWalletSkippedReminder
            ? 'skipped'
            : 'upcoming',
    },
    {
      key: 'zora',
      label: 'Zora',
      status: zoraLinked
        ? 'done'
        : activeStepKey === 'zora'
          ? 'current'
          : showZoraSkippedReminder
            ? 'skipped'
            : 'upcoming',
    },
  ]

  // Spring physics (rather than a fixed-duration ease curve) so step swaps
  // feel like they have real weight/momentum instead of a mechanical slide.
  const stepTransition = reduceMotion
    ? { duration: 0.2 }
    : { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.9 }
  // Directional (not just fade) — the entering step slides in from the side it
  // conceptually arrives from, and the exiting step slides out the other way,
  // so sequential steps read as spatial forward/backward progression.
  const stepVariants = {
    initial: (dir: number) =>
      reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir < 0 ? -18 : 18, scale: 0.99 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: (dir: number) =>
      reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir < 0 ? 18 : -18, scale: 0.99 },
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
          {/* Persistent brand mark — shown across every step of the flow (signup, code) as
              a clickable escape hatch back to 4626.fun. Hidden once approved: the success
              state below renders the same mark as its own indicator, so keeping this one
              too would show the logo twice on one screen. */}
          {!(joinedSessionAddress && appAccepted) ? (
            <div className="flex justify-center">
              <a
                href={getMarketingBaseUrl()}
                aria-label="Back to 4626.fun"
                title="Back to 4626.fun"
                className="brand-mark-3d flex size-12 items-center justify-center overflow-hidden rounded-2xl sm:size-[52px]"
              >
                <img
                  src={siteAssets.logo}
                  alt="4626"
                  width={52}
                  height={52}
                  draggable={false}
                  className="size-full scale-[1.316] select-none object-contain"
                />
              </a>
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
                  // Same brand mark as the pre-join header — no ambient glow.
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="relative flex items-center justify-center"
                  >
                    <span className="brand-mark-3d flex size-14 items-center justify-center overflow-hidden rounded-2xl">
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

                {appAccepted ? (
                  <div className="w-full pt-2">
                    <MagneticButton>
                      {alfaClubReturnPath ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="lg"
                          className="btn-3d group/btn relative w-full overflow-hidden !rounded-full !min-h-[52px] !text-[15px] !font-bold !tracking-wide"
                          disabled={continueBusy}
                          onClick={() => void handleAlfaClubContinue()}
                        >
                          <ButtonSheen />
                          <span className="relative z-10 inline-flex items-center gap-2.5">
                            {continueBusy ? 'Returning to AlfaClub…' : 'Return to AlfaClub'}
                            <ArrowRight
                              className="size-[18px] transition-transform duration-200 ease-out group-hover/btn:translate-x-0.5"
                              aria-hidden="true"
                            />
                          </span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          size="lg"
                          className="btn-3d group/btn relative w-full overflow-hidden !rounded-full !min-h-[52px] !text-[15px] !font-bold !tracking-wide"
                          disabled={continueBusy}
                          onClick={() => void handleAppContinue()}
                        >
                          <ButtonSheen />
                          <span className="relative z-10 inline-flex items-center gap-2.5">
                            {continueBusy ? 'Entering app…' : 'Enter app'}
                            <ArrowRight
                              className="size-[18px] transition-transform duration-200 ease-out group-hover/btn:translate-x-0.5"
                              aria-hidden="true"
                            />
                          </span>
                        </Button>
                      )}
                    </MagneticButton>
                  </div>
                ) : null}
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
                <span className="mx-auto inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.08em] text-zinc-500">
                  <span
                    className="size-1 rounded-full bg-[rgb(var(--brand-primary))]"
                    aria-hidden="true"
                  />
                  early access
                </span>
                <h1 className="headline text-3xl leading-[1.02] tracking-[-0.03em] sm:text-4xl">
                  Join the waitlist
                </h1>
                {!showEmailSignupForm || walletSignInPending ? (
                  <p className="mx-auto max-w-xs text-sm leading-relaxed text-zinc-400">
                    {walletSignInPending
                      ? 'Sign in with your linked wallet to continue.'
                      : 'Restoring your waitlist session…'}
                  </p>
                ) : null}
              </div>

              {showEmailSignupForm ? (
                <BeamCard className="p-5 sm:p-6" accent={otpSubmitPhase === 'verified' ? 'success' : 'default'}>
                  <AnimatePresence mode="wait" initial={false} custom={signupDirection}>
                    {step === 'email' ? (
                      <motion.form
                        key="email"
                        custom={signupDirection}
                        className="space-y-4"
                        onSubmit={handleEmailFormSubmit}
                        variants={stepVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={stepTransition}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <label
                              htmlFor="waitlist-email"
                              className="block text-xs font-medium tracking-wide text-zinc-400"
                            >
                              Email address
                            </label>
                            <a
                              href="https://privy.io"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] tracking-wide text-zinc-600 transition hover:text-zinc-400"
                            >
                              Secured by
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
                          </div>
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
                              disabled={emailBusy || !privyReadyLatched}
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
                                  <DrawnCheck className="size-4" />
                                </motion.span>
                              ) : null}
                            </AnimatePresence>
                          </div>
                        </div>
                        <MagneticButton>
                          <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="btn-3d group/btn relative w-full overflow-hidden !rounded-full !min-h-[52px] text-[15px] font-semibold"
                            disabled={emailBusy || !privyReadyLatched || !isValidEmail(email)}
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
                        </MagneticButton>
                        <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                          {!privyReadyLatched ? 'Preparing secure session…' : 'We’ll send a 6-digit code to your email.'}
                        </p>
                      </motion.form>
                    ) : (
                      <motion.form
                        key="code"
                        custom={signupDirection}
                        className="space-y-3"
                        onSubmit={handleCodeFormSubmit}
                        variants={stepVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={stepTransition}
                        aria-busy={codeBusy}
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
                          status={otpInputStatus}
                          disabled={codeBusy || codeStatus === 'success'}
                        />
                        <Button
                          type="submit"
                          variant="primary"
                          size="lg"
                          className="btn-3d group/btn relative w-full overflow-hidden !rounded-full !min-h-[52px] text-[15px] font-semibold"
                          disabled={codeBusy || code.replace(/\s+/g, '').length < 6 || codeStatus === 'success'}
                          aria-live="polite"
                        >
                          <ButtonSheen />
                          <AnimatePresence mode="wait" initial={false}>
                            {otpSubmitPhase === 'setting_up' || otpSubmitPhase === 'verifying' ? (
                              <motion.span
                                key={otpSubmitPhase}
                                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                                transition={{ duration: 0.16, ease: 'easeOut' }}
                                className="relative z-10 inline-flex items-center gap-2"
                              >
                                <PixelWaveLoader name="wave-lr" size={14} color="rgba(255,255,255,0.9)" />
                                {otpSubmitLabel}
                              </motion.span>
                            ) : otpSubmitPhase === 'verified' ? (
                              <motion.span
                                key={otpSubmitPhase}
                                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                                transition={{ duration: 0.16, ease: 'easeOut' }}
                                className="relative z-10 inline-flex items-center gap-2"
                              >
                                <DrawnCheck className="size-4" />
                                {otpSubmitLabel}
                              </motion.span>
                            ) : (
                              <motion.span
                                key={otpSubmitPhase}
                                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                                transition={{ duration: 0.16, ease: 'easeOut' }}
                                className="relative z-10 inline-flex items-center gap-2"
                              >
                                {otpSubmitLabel}
                                <ArrowRight className="size-4" aria-hidden="true" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </Button>
                        <AnimatePresence initial={false}>
                          {otpSubmitHelperText ? (
                            <motion.p
                              key="otp-setup-helper"
                              variants={reminderVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={stepTransition}
                              className="overflow-hidden text-center text-[11px] leading-relaxed text-zinc-500"
                              aria-live="polite"
                            >
                              {otpSubmitHelperText}
                            </motion.p>
                          ) : null}
                        </AnimatePresence>
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

              <div className="text-center">{renderSocialProof(true)}</div>

              {(showEmailSignupForm && step === 'email') || walletSignInPending ? (
                <WaitlistReturningWalletSignIn
                  busy={walletSignInPending}
                  onSignIn={handleSignInWithLinkedWallet}
                  onCancel={onCancelWalletSignIn}
                  labelSlot={
                    <WaitlistAlreadyJoinedSlot
                      dockPhase={alreadyJoinedDockPhase}
                      joinedLabel={joinedCount}
                    />
                  }
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

          {joinedSessionAddress ? renderSocialProof(false) : null}
        </motion.div>
      </div>

      {/* Mounted on the section (not inside framer-motion transforms) so
          `position: fixed` pins to the viewport top-right like VaultNavBar. */}
      {joinedSessionAddress ? (
        <WaitlistAccountTray
          accountMe={accountMe}
          accountMeLoading={accountMeLoading}
          joinedSessionAddress={joinedSessionAddress}
          externalEoaAddress={linkedEoaAddress}
          getPrivyAccessToken={getPrivyAccessToken}
          onRequestConnectWallet={() => void handleLinkWallet()}
          onRequestDisconnectMainWallet={() => void handleEditWallet()}
          disconnectingMainWallet={walletBusy}
          onSignOut={handleSignOut}
          signOutBusy={signOutBusy}
          signOutDisabled={isBusy || twitterBusy || walletBusy || zoraBusy}
          identitiesPanel={
            <>
              <WaitlistPrivyIdentitiesPanel
                accountMe={accountMe}
                onEditTwitter={() => void handleEditTwitter()}
                twitterEditBusy={twitterBusy}
                twitterError={twitterError}
              />

              <AnimatePresence initial={false}>
                {linkingWizardInProgress ? (
                  <motion.div
                    key="linking-progress"
                    variants={reminderVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={stepTransition}
                    className="pt-2"
                  >
                    <WaitlistLinkingProgress steps={linkingSteps} compact />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence mode="wait" initial={false} custom={linkingDirection}>
                {activeStepKey === 'x-link' ? (
                  <motion.div
                    key="x-link"
                    custom={linkingDirection}
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={stepTransition}
                    className="mt-3"
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
                    custom={linkingDirection}
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={stepTransition}
                    className="mt-3"
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
                    custom={linkingDirection}
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={stepTransition}
                    className="mt-3"
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
                    custom={linkingDirection}
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={stepTransition}
                    className="mt-3"
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

              {unlinkedProviderError ? (
                <p className="mt-3 text-center text-[11px] leading-relaxed text-rose-300/90">
                  {unlinkedProviderError}
                </p>
              ) : null}
            </>
          }
        />
      ) : null}
    </section>
  )
}
