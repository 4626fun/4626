import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  Heart,
  Loader2,
  Lock,
  MessageCircle,
  Repeat2,
  Sparkles,
  Trophy,
  UserPlus,
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/shared/utils'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import {
  WAITLIST_X_ENGAGEMENT_COMMENT,
  WAITLIST_X_ENGAGEMENT_STEP_POINTS,
  WAITLIST_X_ENGAGEMENT_STEPS,
  buildWaitlistTwitterCommentIntentUrl,
  buildWaitlistTwitterFollowIntentUrl,
  buildWaitlistTwitterLikeIntentUrl,
  buildWaitlistTwitterRetweetIntentUrl,
  emptyWaitlistTwitterEngagementProgress,
  openWaitlistTwitterIntent,
  resolveActiveWaitlistTwitterEngagementStep,
  resolveWaitlistTwitterEngagementStepCopy,
  resolveWaitlistTwitterEngagementTweetId,
  resolveWaitlistTwitterFollowHandle,
  type WaitlistTwitterEngagementProgress,
  type WaitlistTwitterEngagementStepId,
} from '@/features/waitlist/waitlistTwitterEngagement'

type WaitlistTwitterEngagementStepsProps = {
  getAccessToken: (() => Promise<string | null>) | null | undefined
  onProgressVerified?: () => void
}

type WaitlistXEngagementApiResponse = {
  campaignKey: string
  progress: WaitlistTwitterEngagementProgress
  activeStep: WaitlistTwitterEngagementStepId | 'complete'
  verified: boolean
}

const POLL_INTERVAL_MS = 3_000
const X_ENGAGEMENT_BACKOFF_MS = 10_000

let xEngagementInFlight: Promise<WaitlistTwitterEngagementProgress | null> | null = null
let xEngagementRateLimitedUntil = 0

const TOTAL_QUEST_XP = WAITLIST_X_ENGAGEMENT_STEPS.reduce(
  (sum, step) => sum + WAITLIST_X_ENGAGEMENT_STEP_POINTS[step],
  0,
)

type QuestRowState = 'done' | 'active' | 'locked'

function StepIcon(props: { step: WaitlistTwitterEngagementStepId; className?: string }) {
  const { step, className } = props
  if (step === 'follow') return <UserPlus className={className} aria-hidden="true" />
  if (step === 'like') return <Heart className={className} aria-hidden="true" />
  if (step === 'retweet') return <Repeat2 className={className} aria-hidden="true" />
  return <MessageCircle className={className} aria-hidden="true" />
}

async function fetchVerifiedEngagementProgress(
  getAccessToken: (() => Promise<string | null>) | null | undefined,
): Promise<WaitlistTwitterEngagementProgress | null> {
  if (Date.now() < xEngagementRateLimitedUntil) return null
  if (xEngagementInFlight) return xEngagementInFlight

  xEngagementInFlight = (async () => {
    try {
      const token = await getAccessToken?.().catch(() => null)
      if (!token) return null
      const response = await apiFetch('/api/waitlist/x-engagement', {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => null)
      if (response?.status === 429) {
        xEngagementRateLimitedUntil = Date.now() + X_ENGAGEMENT_BACKOFF_MS
        return null
      }
      if (!response?.ok) return null
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistXEngagementApiResponse> | null
      if (!payload?.success || !payload.data?.progress) return null
      return payload.data.progress
    } finally {
      xEngagementInFlight = null
    }
  })()

  return xEngagementInFlight
}

// Animated XP meter — a brand-gradient fill with a slow shimmer sweep. The fill
// width animates whenever a quest is verified, giving a "level up" beat.
function XpMeter({ percent, reduceMotion }: { percent: number; reduceMotion: boolean }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div
        className="relative h-full rounded-full"
        style={{
          background:
            'linear-gradient(90deg, rgb(var(--brand-primary)), rgb(var(--brand-hover)))',
          boxShadow: '0 0 12px 0 rgb(var(--brand-primary) / 0.55)',
        }}
        initial={false}
        animate={{ width: `${percent}%` }}
        transition={
          reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 22 }
        }
      >
        {!reduceMotion && percent > 0 ? (
          <motion.span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent"
            animate={{ x: ['-120%', '320%'] }}
            transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6 }}
          />
        ) : null}
      </motion.div>
    </div>
  )
}

// Compact +N XP reward chip used on each quest row.
function XpReward({ points, state }: { points: number; state: QuestRowState }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
        state === 'done'
          ? 'bg-emerald-400/15 text-emerald-300'
          : state === 'active'
            ? 'bg-[rgb(var(--brand-primary)/0.18)] text-[rgb(var(--brand-primary))]'
            : 'bg-white/[0.04] text-zinc-500',
      )}
    >
      <Sparkles className="size-2.5" aria-hidden="true" />+{points} XP
    </span>
  )
}

function QuestRow(props: {
  step: WaitlistTwitterEngagementStepId
  state: QuestRowState
  index: number
  awaitingVerification: boolean
  reduceMotion: boolean
  onOpen: (step: WaitlistTwitterEngagementStepId) => void
}) {
  const { step, state, index, awaitingVerification, reduceMotion, onOpen } = props
  const copy = resolveWaitlistTwitterEngagementStepCopy(step)
  const points = WAITLIST_X_ENGAGEMENT_STEP_POINTS[step]
  const isComment = step === 'comment'

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut', delay: reduceMotion ? 0 : index * 0.04 }}
      className={cn(
        'relative overflow-hidden rounded-xl border px-3 py-2.5 transition-colors',
        state === 'active'
          ? 'border-[rgb(var(--brand-primary)/0.45)] bg-[rgb(var(--brand-primary)/0.06)] shadow-[0_0_0_1px_rgb(var(--brand-primary)/0.18),0_12px_30px_-16px_rgb(var(--brand-primary)/0.7)]'
          : state === 'done'
            ? 'border-emerald-400/15 bg-emerald-400/[0.04]'
            : 'border-white/[0.05] bg-white/[0.015]',
      )}
    >
      {/* Animated edge glow on the active quest only. */}
      {state === 'active' && !reduceMotion ? (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{ boxShadow: 'inset 0 0 22px 0 rgb(var(--brand-primary) / 0.18)' }}
          animate={{ opacity: [0.35, 0.85, 0.35] }}
          transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
        />
      ) : null}

      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full',
            state === 'done'
              ? 'bg-emerald-400/20 text-emerald-300'
              : state === 'active'
                ? 'bg-[rgb(var(--brand-primary)/0.2)] text-[rgb(var(--brand-primary))]'
                : 'bg-white/[0.04] text-zinc-600',
          )}
        >
          {state === 'done' ? (
            <Check className="size-4" aria-hidden="true" />
          ) : state === 'locked' ? (
            <Lock className="size-3.5" aria-hidden="true" />
          ) : (
            <StepIcon step={step} className="size-4" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-sm font-semibold',
              state === 'locked' ? 'text-zinc-500' : 'text-white',
            )}
          >
            {copy.title}
          </span>
          {state === 'active' ? (
            <span className="mt-0.5 block text-[11px] leading-snug text-zinc-400">
              {copy.description} We verify each step automatically through X.
            </span>
          ) : (
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-600">
              {state === 'done' ? 'Cleared' : 'Locked'}
            </span>
          )}
        </span>

        <XpReward points={points} state={state} />
      </div>

      {state === 'active' ? (
        <div className="relative mt-3 space-y-3">
          {isComment ? (
            <div className="rounded-lg border border-white/[0.06] bg-[rgb(var(--vault-bg)/0.55)] px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Pre-filled comment
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">
                {WAITLIST_X_ENGAGEMENT_COMMENT}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => onOpen(step)}
            >
              {copy.actionLabel}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
            {awaitingVerification ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Verifying on X…
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </motion.li>
  )
}

export function WaitlistTwitterEngagementSteps(props: WaitlistTwitterEngagementStepsProps) {
  const { getAccessToken, onProgressVerified } = props
  const followHandle = resolveWaitlistTwitterFollowHandle()
  const tweetId = resolveWaitlistTwitterEngagementTweetId()
  const reduceMotion = useReducedMotion() ?? false

  const [progress, setProgress] = useState<WaitlistTwitterEngagementProgress>(
    emptyWaitlistTwitterEngagementProgress(),
  )
  const [awaitingVerification, setAwaitingVerification] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const lastCompleteRef = useRef(false)

  const getAccessTokenRef = useRef(getAccessToken)
  const accessTokenReady = typeof getAccessToken === 'function'
  useEffect(() => {
    getAccessTokenRef.current = getAccessToken
  }, [getAccessToken])

  const applyProgressUpdate = useCallback(
    (next: WaitlistTwitterEngagementProgress) => {
      setProgress(next)
      setSyncError(null)
      const active = resolveActiveWaitlistTwitterEngagementStep(next)
      if (active === 'complete' && !lastCompleteRef.current) {
        lastCompleteRef.current = true
        onProgressVerified?.()
      }
      if (active === 'complete') {
        setAwaitingVerification(false)
      }
    },
    [onProgressVerified],
  )

  const applyProgressUpdateRef = useRef(applyProgressUpdate)
  useEffect(() => {
    applyProgressUpdateRef.current = applyProgressUpdate
  }, [applyProgressUpdate])

  const refreshProgress = useCallback(async () => {
    const next = await fetchVerifiedEngagementProgress(getAccessTokenRef.current)
    if (!next) return
    applyProgressUpdateRef.current(next)
  }, [])

  useEffect(() => {
    if (!accessTokenReady) return
    let cancelled = false
    void (async () => {
      const next = await fetchVerifiedEngagementProgress(getAccessTokenRef.current)
      if (!next || cancelled) return
      applyProgressUpdateRef.current(next)
    })()
    return () => {
      cancelled = true
    }
  }, [accessTokenReady])

  useEffect(() => {
    if (!awaitingVerification) return
    const timer = window.setInterval(() => {
      void refreshProgress()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [awaitingVerification, refreshProgress])

  const activeStep = useMemo(() => resolveActiveWaitlistTwitterEngagementStep(progress), [progress])

  const completedCount = useMemo(
    () => WAITLIST_X_ENGAGEMENT_STEPS.filter((step) => progress[step]).length,
    [progress],
  )
  const totalSteps = WAITLIST_X_ENGAGEMENT_STEPS.length
  const earnedXp = useMemo(
    () =>
      WAITLIST_X_ENGAGEMENT_STEPS.reduce(
        (sum, step) => sum + (progress[step] ? WAITLIST_X_ENGAGEMENT_STEP_POINTS[step] : 0),
        0,
      ),
    [progress],
  )
  const xpPercent = TOTAL_QUEST_XP > 0 ? Math.round((earnedXp / TOTAL_QUEST_XP) * 100) : 0
  const allComplete = activeStep === 'complete'

  const openStepIntent = useCallback(
    (step: WaitlistTwitterEngagementStepId) => {
      if (step === 'follow') {
        openWaitlistTwitterIntent(buildWaitlistTwitterFollowIntentUrl(followHandle))
        return
      }
      if (step === 'like') {
        openWaitlistTwitterIntent(buildWaitlistTwitterLikeIntentUrl(tweetId))
        return
      }
      if (step === 'retweet') {
        openWaitlistTwitterIntent(buildWaitlistTwitterRetweetIntentUrl(tweetId))
        return
      }
      openWaitlistTwitterIntent(buildWaitlistTwitterCommentIntentUrl(tweetId, WAITLIST_X_ENGAGEMENT_COMMENT))
    },
    [followHandle, tweetId],
  )

  const handleOpenStep = useCallback(
    (step: WaitlistTwitterEngagementStepId) => {
      setSyncError(null)
      setAwaitingVerification(true)
      openStepIntent(step)
      void refreshProgress()
    },
    [openStepIntent, refreshProgress],
  )

  return (
    <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-left">
      {/* Faint grid texture for the "mission board" feel. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-wire-grid opacity-[0.04]"
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
            <Sparkles className="size-3.5 text-[rgb(var(--brand-primary))]" aria-hidden="true" />
            X Quests
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold tabular-nums text-zinc-200">
            <span className="text-[rgb(var(--brand-primary))]">{earnedXp}</span>
            <span className="text-zinc-500">/ {TOTAL_QUEST_XP} XP</span>
          </span>
        </div>

        <div className="mt-3">
          <XpMeter percent={xpPercent} reduceMotion={reduceMotion} />
          <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            {completedCount} / {totalSteps} quests cleared
          </p>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {allComplete ? (
            <motion.div
              key="quest-complete"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative mt-4 flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3.5"
              style={{
                background:
                  'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(16,185,129,0.02))',
                boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.18)',
              }}
            >
              {!reduceMotion ? (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)',
                  }}
                  initial={{ x: '-120%' }}
                  animate={{ x: '120%' }}
                  transition={{ duration: 1.1, ease: 'easeOut', delay: 0.15 }}
                />
              ) : null}
              <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                <Trophy className="size-5" aria-hidden="true" />
              </span>
              <span className="relative min-w-0">
                <span className="block text-sm font-bold text-emerald-100">All quests cleared</span>
                <span className="block text-[11px] text-emerald-300/80">
                  +{TOTAL_QUEST_XP} XP earned · verified on X
                </span>
              </span>
            </motion.div>
          ) : (
            <motion.ul
              key="quest-list"
              initial={false}
              className="mt-4 space-y-2"
            >
              {WAITLIST_X_ENGAGEMENT_STEPS.map((step, index) => {
                const state: QuestRowState = progress[step]
                  ? 'done'
                  : step === activeStep
                    ? 'active'
                    : 'locked'
                return (
                  <QuestRow
                    key={step}
                    step={step}
                    state={state}
                    index={index}
                    awaitingVerification={awaitingVerification && state === 'active'}
                    reduceMotion={reduceMotion}
                    onOpen={handleOpenStep}
                  />
                )
              })}
            </motion.ul>
          )}
        </AnimatePresence>

        {syncError ? (
          <p className="mt-3 text-[11px] leading-relaxed text-rose-300">{syncError}</p>
        ) : null}
      </div>
    </div>
  )
}
