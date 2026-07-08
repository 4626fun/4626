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
import { APP_ORIGIN, getMarketingBaseUrl } from '@/lib/env/host'
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
import { appendLocalhostPrivyAuthNoteIfNeeded } from '@/lib/privy/localhostPrivyAuthNotice'
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

const SOCIAL_PROOF_AVATAR_SLOTS = 12
/** Per-avatar entrance stagger/duration — kept as named constants (rather than
 * inline magic numbers in the JSX below) so `AVATAR_CONSUME_START_DELAY_MS`
 * can be derived from exactly when the last avatar finishes landing. */
const AVATAR_ENTRANCE_STAGGER_S = 0.045
const AVATAR_ENTRANCE_DURATION_S = 0.32
const AVATAR_ENTRANCE_TOTAL_MS = Math.round(
  (AVATAR_ENTRANCE_DURATION_S + (SOCIAL_PROOF_AVATAR_SLOTS - 1) * AVATAR_ENTRANCE_STAGGER_S) * 1000,
)
/** The stack must finish rendering — every avatar fully landed — before any of
 * them start feeding into the count. This beat needs to be long enough to
 * read as a deliberate pause (not just a continuation of the landing
 * motion) before the stack starts feeding into the count. */
const AVATAR_CONSUME_START_DELAY_MS = AVATAR_ENTRANCE_TOTAL_MS + 320
/** Per-avatar delay between one flying into the count and the next starting.
 * Deliberately kept greater than `AVATAR_CONSUME_EXIT_S` (below) — when more
 * than ~1-2 avatars are simultaneously mid-exit, Framer Motion's
 * `AnimatePresence` (with `mode="popLayout"`) stops removing them from the
 * DOM incrementally and instead defers all the removals to a single batch
 * at the very end, which reads as "nothing happens, then everything vanishes
 * at once" instead of a steady one-by-one consumption — confirmed by
 * instrumenting the previous (too-overlapping) 70ms/350ms pairing.
 */
const AVATAR_CONSUME_STAGGER_MS = 140
/** Exit duration for a single avatar flying into the count. Kept below
 * `AVATAR_CONSUME_STAGGER_MS` — see comment above. */
const AVATAR_CONSUME_EXIT_S = 0.11
/** Span from the first avatar starting its flight into the count to the last
 * one fully disappearing — used only to time the dock choreography below;
 * the count itself is derived directly from consume progress (see
 * `joinedCount` in `WaitlistFlow`), not from this duration. */
const AVATAR_CONSUME_TOTAL_MS = Math.round(
  (SOCIAL_PROOF_AVATAR_SLOTS - 1) * AVATAR_CONSUME_STAGGER_MS + AVATAR_CONSUME_EXIT_S * 1000,
)

// Overlapping avatar stack. Uses real member PFPs (linked, with hover names)
// when present, and fills remaining slots with brand gradient placeholders so
// the social-proof row still looks populated when only a subset has avatars.
// Each dot fades/slides in left-to-right on mount. When `consumeIntoCount` is
// set (the pre-join view only — see `renderSocialProof`), the stack then
// eats itself from the right (the end closest to the count text) inward:
// each avatar slides right and shrinks away as if flying into the number,
// and — because the row is `justify-center` and every remaining avatar plus
// the count text carries `layout` — the rest of the stack and the count
// smoothly re-centre after every avatar that disappears, rather than
// snapping. Skipped for `prefers-reduced-motion` (all avatars removed
// immediately) and for the always-visible post-join row, whose avatars stay
// put since they're real, clickable member links.
//
// `consumedCount` is a controlled prop (owned by `WaitlistFlow`, not this
// component) specifically so the count text next to this stack can be
// derived from the exact same number — see `joinedCount` in `WaitlistFlow`.
// That's what guarantees the two are causally tied together (the count only
// ever moves because an avatar was consumed) instead of merely running on
// two separately-timed clocks that happen to overlap.
function JoinedAvatars({
  avatars,
  consumeIntoCount = false,
  consumedCount = 0,
}: {
  avatars: WaitlistAvatar[]
  consumeIntoCount?: boolean
  consumedCount?: number
}) {
  const reduceMotion = useReducedMotion()
  const slots: (WaitlistAvatar | null)[] = Array.from({ length: SOCIAL_PROOF_AVATAR_SLOTS }, (_, index) =>
    avatars[index] ?? null,
  )

  const visibleSlots = consumeIntoCount
    ? slots.slice(0, Math.max(0, SOCIAL_PROOF_AVATAR_SLOTS - consumedCount))
    : slots

  return (
    <div className="flex -space-x-2.5">
      {/* `popLayout`: takes an exiting avatar out of flow immediately (it keeps
          animating out visually via `exit`, just no longer occupies space), so
          the surviving avatars + count text start re-centering in the same
          instant it starts flying away, instead of waiting for it to finish
          and then snapping to their new spots. */}
      <AnimatePresence mode="popLayout">
        {visibleSlots.map((avatar, index) => (
          <motion.span
            key={`${avatar?.src ?? 'placeholder'}-${index}`}
            layout="position"
            initial={reduceMotion ? false : { opacity: 0, x: -10 }}
            animate={{
              opacity: 1,
              x: 0,
              transition: {
                duration: AVATAR_ENTRANCE_DURATION_S,
                delay: reduceMotion ? 0 : index * AVATAR_ENTRANCE_STAGGER_S,
                ease: [0.22, 1, 0.36, 1],
              },
            }}
            // Two-phase "pulled in and swallowed" exit: stays fully visible while
            // accelerating right for the first half (an ease-IN — the opposite
            // curve from the entrance — so it reads as being pulled toward the
            // number rather than drifting away), then rapidly closes the rest of
            // the distance, shrinks further, and only disappears right at the
            // end — instead of fading evenly the whole way, which read as
            // "sliding away" rather than "flying into" the count.
            exit={{
              opacity: [1, 1, 0],
              x: [0, 14, 46],
              scale: [1, 0.82, 0.2],
              transition: {
                duration: reduceMotion ? 0 : AVATAR_CONSUME_EXIT_S,
                times: [0, 0.55, 1],
                ease: [0.55, 0.055, 0.675, 0.19],
              },
            }}
            transition={{ layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
          >
            <AvatarDot avatar={avatar} index={index} />
          </motion.span>
        ))}
      </AnimatePresence>
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
// to the public leaderboard.
function WaitlistAlreadyJoinedSlot({
  dockPhase,
  joinedLabel,
}: {
  dockPhase: AlreadyJoinedDockPhase
  joinedLabel: number
}) {
  if (dockPhase === 'docked') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
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
    )
  }

  return (
    <AnimatePresence mode="wait">
      {dockPhase === 'docking' ? (
        <motion.span
          key="landed-pill"
          layoutId={ALREADY_JOINED_DOCK_LAYOUT_ID}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          // Matches the source badge's `text-[11px]` exactly (see `renderSocialProof`)
          // — a font-size mismatch between the two `layoutId`-linked elements makes
          // Framer's shared-layout FLIP visibly squish/stretch the text as it
          // interpolates box size, which read as a glitch during the hand-off.
          className="text-[11px] font-medium text-zinc-400"
        >
          <AnimatedCount value={joinedLabel} className="font-semibold text-zinc-200" /> already joined
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

// Renders a number as individually-animated digits so each place value rolls
// vertically like an odometer when it changes, instead of the whole string
// just popping to its new value. Falls back to a plain static string under
// reduced motion.
function AnimatedCount({ value, className }: { value: number; className?: string }) {
  const reduceMotion = useReducedMotion()
  const formatted = value.toLocaleString()

  if (reduceMotion) {
    return <span className={className}>{formatted}</span>
  }

  return (
    <span className={cn('inline-flex', className)}>
      {formatted.split('').map((char, index) =>
        /\d/.test(char) ? (
          <span key={index} className="relative inline-block h-[1em] w-[0.62em] overflow-hidden align-top">
            <AnimatePresence initial={false}>
              <motion.span
                key={char}
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: '0%', opacity: 1 }}
                exit={{ y: '-100%', opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 flex items-center justify-center tabular-nums"
              >
                {char}
              </motion.span>
            </AnimatePresence>
          </span>
        ) : (
          <span key={index}>{char}</span>
        ),
      )}
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
      // StrictMode-safe: allow the re-invoked effect to restart the probe;
      // otherwise a cancelled first run leaves sessionProbeComplete false forever.
      sessionProbeStartedRef.current = false
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
      const message = unlinkError instanceof Error ? unlinkError.message : 'Could not disconnect X.'
      setTwitterError(appendLocalhostPrivyAuthNoteIfNeeded(message))
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
      const message = linkError instanceof Error ? linkError.message : 'Could not connect wallet.'
      setWalletError(appendLocalhostPrivyAuthNoteIfNeeded(message))
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
      const message = unlinkError instanceof Error ? unlinkError.message : 'Could not disconnect wallet.'
      setWalletError(appendLocalhostPrivyAuthNoteIfNeeded(message))
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

  // First-time link errors (provider not yet linked, so there's no row to attach
  // the message to) vs. edit/unlink errors (provider is linked — its row above
  // owns the message instead, see `linkedAccountRows`).
  const unlinkedProviderError =
    (!twitterLinked && twitterError) ||
    (!externalEoaLinked && walletError) ||
    (!zoraLinked && zoraError) ||
    null

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
        error: twitterError,
      })
    }
    if (externalEoaLinked) {
      rows.push({
        ...walletLinkedRowBase,
        onEdit: () => void handleEditWallet(),
        editBusy: walletBusy,
        error: walletError,
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
        error: zoraError,
      })
    }
    return rows
  }, [
    externalEoaLinked,
    handleEditTwitter,
    handleEditWallet,
    handleEditZora,
    twitterBusy,
    twitterError,
    twitterHandle,
    twitterLinked,
    walletBusy,
    walletError,
    walletLinkedRowBase,
    zoraBusy,
    zoraError,
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
  const reduceMotionForDock = useReducedMotion()

  // Owns the avatar-consume progress (0..SOCIAL_PROOF_AVATAR_SLOTS) and passes
  // it down to `JoinedAvatars` as a controlled prop — see that component's
  // comment for why. Lazy initializer (not an effect) covers the reduced-
  // motion "all consumed" case so it's correct on the very first render
  // without a synchronous `setState` inside an effect body.
  const [avatarConsumedCount, setAvatarConsumedCount] = useState(() =>
    reduceMotionForDock ? SOCIAL_PROOF_AVATAR_SLOTS : 0,
  )
  // No "already started" ref guard — see the matching comment on the dock
  // choreography effect below; StrictMode's dev-only double-invoke is
  // handled by plain dependencies + cleanup, not a ref latch.
  useEffect(() => {
    if (joinedSessionAddress || reduceMotionForDock) return
    const timers: number[] = []
    for (let i = 0; i < SOCIAL_PROOF_AVATAR_SLOTS; i += 1) {
      timers.push(
        window.setTimeout(
          () => setAvatarConsumedCount((count) => count + 1),
          AVATAR_CONSUME_START_DELAY_MS + i * AVATAR_CONSUME_STAGGER_MS,
        ),
      )
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [joinedSessionAddress, reduceMotionForDock])

  // Derived directly from `avatarConsumedCount` — not a separately-timed
  // animation — so the number can only ever move because an avatar was just
  // consumed, landing on `listCount` exactly when the last one disappears.
  // Once joined, `avatarConsumedCount` may be left at whatever it reached
  // before the join happened (this state outlives the pre-join view's
  // unmount, since it lives up here), so the post-join, non-dockable render
  // always shows the plain final `listCount` instead of a stale ratio.
  const joinedCount =
    listCount == null
      ? 0
      : joinedSessionAddress
        ? listCount
        : Math.round((listCount * avatarConsumedCount) / SOCIAL_PROOF_AVATAR_SLOTS)

  // One-time choreography, pre-join only: avatars render, then feed into the
  // count as it climbs (see above), then after a beat the "N already joined"
  // pill flies down and docks into the "Already joined?" divider below it
  // (see `ALREADY_JOINED_DOCK_LAYOUT_ID` and `WaitlistAlreadyJoinedSlot`),
  // which then becomes the interactive "hover to see the leaderboard"
  // control. Skipped once already joined (that view keeps the plain,
  // permanently-visible count + "See leaderboard" link).
  const [alreadyJoinedDockPhase, setAlreadyJoinedDockPhase] = useState<AlreadyJoinedDockPhase>('shown')
  // No "already started" ref guard — see the matching comment in
  // `JoinedAvatars`. React 18 StrictMode's dev-only mount→cleanup→remount
  // would set a ref latch on the first (discarded) run, clear its timers,
  // then see the latch already set on the second (surviving) run and skip
  // scheduling entirely, so the dock animation would silently never start.
  // Plain dependencies + proper cleanup self-correct for that double-invoke.
  useEffect(() => {
    if (joinedSessionAddress) return
    if (listCount == null || listCount <= 0) return
    if (reduceMotionForDock) {
      setAlreadyJoinedDockPhase('docked')
      return
    }
    // Timed to start once the avatar stack has finished feeding itself into
    // the count (see `AVATAR_CONSUME_START_DELAY_MS` + `AVATAR_CONSUME_TOTAL_MS`
    // above), plus a short beat to let the final number sit on its own before
    // it docks down into "Already joined?". `DOCKING_TRANSITION_MS` mirrors
    // the docking pill's own `transition.duration` in `WaitlistAlreadyJoinedSlot`.
    const countSettledAtMs = AVATAR_CONSUME_START_DELAY_MS + AVATAR_CONSUME_TOTAL_MS
    const dockStartDelayMs = countSettledAtMs + 350
    const DOCKING_TRANSITION_MS = 550
    const dockTimer = window.setTimeout(() => setAlreadyJoinedDockPhase('docking'), dockStartDelayMs)
    const dockedTimer = window.setTimeout(
      () => setAlreadyJoinedDockPhase('docked'),
      dockStartDelayMs + DOCKING_TRANSITION_MS,
    )
    return () => {
      window.clearTimeout(dockTimer)
      window.clearTimeout(dockedTimer)
    }
  }, [joinedSessionAddress, listCount, reduceMotionForDock])

  const renderSocialProof = (dockable: boolean) => {
    const hideCountBadge = dockable && alreadyJoinedDockPhase !== 'shown'
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-1">
          <JoinedAvatars
            avatars={memberAvatars}
            consumeIntoCount={dockable}
            consumedCount={dockable ? avatarConsumedCount : 0}
          />
          <AnimatePresence>
            {!hideCountBadge && listCount != null && listCount > 0 ? (
              <motion.p
                key="count-badge"
                layout
                layoutId={dockable ? ALREADY_JOINED_DOCK_LAYOUT_ID : undefined}
                // When this hands off to the docked pill (`WaitlistAlreadyJoinedSlot`)
                // via the shared `layoutId`, Framer already crossfades/morphs it
                // into that target — a separate manual `exit` here would fight
                // that hand-off (two competing animations on the same element).
                // Only the always-static, non-dockable render (post-join) needs
                // its own fade-out, and even there it only fires if `listCount`
                // itself disappears.
                exit={dockable ? undefined : { opacity: 0, y: 6, scale: 0.94 }}
                transition={{ duration: dockable ? 0.5 : 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="text-[11px] text-zinc-400"
              >
                <AnimatedCount value={joinedCount} className="font-semibold text-zinc-200" />{' '}
                already joined
              </motion.p>
            ) : null}
          </AnimatePresence>
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
      status: externalEoaLinked
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
              state below renders the same mark (glowing) as its own success indicator, so
              keeping this one too would show the logo twice on one screen. */}
          {!(joinedSessionAddress && appAccepted) ? (
            <div className="flex justify-center">
              <motion.a
                href={getMarketingBaseUrl()}
                aria-label="Back to 4626.fun"
                title="Back to 4626.fun"
                whileHover={reduceMotion ? undefined : { opacity: 0.8 }}
                whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                className="flex size-12 items-center justify-center overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-primary)/0.5)] sm:size-[52px]"
              >
                <img
                  src={siteAssets.logo}
                  alt="4626"
                  width={52}
                  height={52}
                  draggable={false}
                  className="size-full scale-[1.316] select-none object-contain"
                />
              </motion.a>
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

                {/* Earn points — optional identity links, each worth waitlist points.
                    Lives in the same BeamCard treatment as the email/code step above,
                    so the whole flow reads as one consistent "card per stage" language
                    instead of a loose stack of differently-styled pieces. */}
                <motion.div layout="position" transition={stepTransition} className="mt-5">
                  <BeamCard className="p-5 sm:p-6">
                    <WaitlistLinkedAccountsCard
                      rows={linkedAccountRows}
                      totalPoints={totalPoints}
                      showTotal={showPointsBadge}
                      progress={
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
                      }
                    />

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
                  </BeamCard>
                </motion.div>

                {/* Once a provider is linked its row (above) owns the error message —
                    only show this generic caption for first-time link failures, before
                    the row (and its edit action) exist to attach the message to. */}
                {unlinkedProviderError ? (
                  <p className="mt-4 text-center text-[11px] leading-relaxed text-rose-300/90">
                    {unlinkedProviderError}
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
                <BeamCard className="p-5 sm:p-6" accent={codeStatus === 'success' ? 'success' : 'default'}>
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
                        </MagneticButton>
                        <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                          {!privy.ready ? 'Preparing secure session…' : 'We’ll send a 6-digit code to your email.'}
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
                              <DrawnCheck className="size-4" />
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
    </section>
  )
}
