import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  Lock,
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/shared/utils'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import {
  WAITLIST_X_ENGAGEMENT_COMMENT,
  WAITLIST_X_ENGAGEMENT_DEFAULT_STEPS,
  WAITLIST_X_ENGAGEMENT_STEP_POINTS,
  buildWaitlistTwitterCommentIntentUrl,
  buildWaitlistTwitterFollowIntentUrl,
  buildWaitlistTwitterLikeIntentUrl,
  buildWaitlistTwitterRetweetIntentUrl,
  emptyWaitlistTwitterEngagementProgress,
  openWaitlistTwitterIntent,
  resolveActiveWaitlistTwitterEngagementStep,
  resolveWaitlistTwitterEngagementStepCopy,
  resolveWaitlistTwitterFollowHandle,
  totalWaitlistTwitterEngagementXp,
  type WaitlistTwitterEngagementProgress,
  type WaitlistTwitterEngagementStepId,
} from '@/features/waitlist/waitlistTwitterEngagement'

type WaitlistTwitterEngagementStepsProps = {
  getAccessToken: (() => Promise<string | null>) | null | undefined
  onProgressVerified?: () => void
  onSkip?: () => void
}

type WaitlistXEngagementApiResponse = {
  campaignKey: string
  campaignTweetUrl: string | null
  campaignTweetId: string | null
  steps: WaitlistTwitterEngagementStepId[]
  progress: WaitlistTwitterEngagementProgress
  activeStep: WaitlistTwitterEngagementStepId | 'complete'
  verified: boolean
}

type WaitlistXEngagementState = {
  steps: WaitlistTwitterEngagementStepId[]
  campaignTweetId: string | null
  progress: WaitlistTwitterEngagementProgress
}

const POLL_INTERVAL_MS = 3_000
const X_ENGAGEMENT_BACKOFF_MS = 10_000

let xEngagementInFlight: Promise<WaitlistXEngagementState | null> | null = null
let xEngagementRateLimitedUntil = 0

type QuestRowState = 'done' | 'active' | 'locked'

function QuestRow(props: {
  step: WaitlistTwitterEngagementStepId
  state: QuestRowState
  index: number
  confirming: boolean
  reduceMotion: boolean
  onOpen: (step: WaitlistTwitterEngagementStepId) => void
  onConfirm: (step: WaitlistTwitterEngagementStepId) => void
}) {
  const { step, state, index, confirming, reduceMotion, onOpen, onConfirm } = props
  const copy = resolveWaitlistTwitterEngagementStepCopy(step)
  const points = WAITLIST_X_ENGAGEMENT_STEP_POINTS[step]

  if (state === 'active') {
    return (
      <motion.li
        layout={!reduceMotion}
        initial={reduceMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut', delay: reduceMotion ? 0 : index * 0.03 }}
        className="py-1"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-white">{copy.title}</span>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-emerald-300/80">
            +{points} XP
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="min-h-[38px] flex-1"
            onClick={() => onOpen(step)}
          >
            {copy.actionLabel}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
          <button
            type="button"
            className="shrink-0 text-[11px] font-medium text-zinc-400 transition hover:text-white disabled:opacity-50"
            disabled={confirming}
            onClick={() => onConfirm(step)}
          >
            {confirming ? 'Checking…' : 'Verify'}
          </button>
        </div>
      </motion.li>
    )
  }

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut', delay: reduceMotion ? 0 : index * 0.03 }}
      className={cn(
        'flex items-center justify-between gap-3 py-2',
        state === 'locked' && 'opacity-45',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'flex size-5 shrink-0 items-center justify-center',
            state === 'done' ? 'text-emerald-300' : 'text-zinc-600',
          )}
        >
          {state === 'done' ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Lock className="size-3" aria-hidden="true" />
          )}
        </span>
        <span
          className={cn(
            'truncate text-sm font-medium',
            state === 'done' ? 'text-zinc-300' : 'text-zinc-500',
          )}
        >
          {copy.title}
        </span>
      </div>
      <span
        className={cn(
          'shrink-0 text-[11px] font-medium tabular-nums',
          state === 'done' ? 'text-emerald-300/80' : 'text-zinc-600',
        )}
      >
        {state === 'done' ? `+${points} XP` : `+${points} XP`}
      </span>
    </motion.li>
  )
}

async function fetchEngagementState(
  getAccessToken: (() => Promise<string | null>) | null | undefined,
): Promise<WaitlistXEngagementState | null> {
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
      const steps =
        payload.data.steps.length > 0 ? payload.data.steps : [...WAITLIST_X_ENGAGEMENT_DEFAULT_STEPS]
      return {
        steps,
        campaignTweetId: payload.data.campaignTweetId,
        progress: payload.data.progress,
      }
    } finally {
      xEngagementInFlight = null
    }
  })()

  return xEngagementInFlight
}

type VerifyResult =
  | { ok: true; progress: WaitlistTwitterEngagementProgress }
  | { ok: false; error: string; progress?: WaitlistTwitterEngagementProgress }

// Map a server verification reason to a short, user-facing message.
function messageForReason(reason: string | undefined): string {
  switch (reason) {
    case 'out_of_order':
      return 'Finish the earlier steps first.'
    case 'not_found':
      return "We couldn't find that on X yet. Give it a few seconds, then verify again."
    case 'not_linked':
      return 'Link your X account first, then verify.'
    case 'rate_limited':
      return 'X is rate-limiting checks right now. Try again in a moment.'
    case 'lookup_unavailable':
    case 'credentials_unavailable':
      return "Automatic X checking isn't available right now — we'll auto-verify once X reports it."
    case 'network_error':
      return "We couldn't reach X to verify. Try again."
    default:
      return 'Could not verify that step. Try again.'
  }
}

// User-driven "Verify on X" check. The push webhook remains authoritative; this
// asks the server to confirm the step against the live X API and award it. The
// server enforces sequential, idempotent awards, so this can never double-count.
async function verifyEngagementStep(
  getAccessToken: (() => Promise<string | null>) | null | undefined,
  step: WaitlistTwitterEngagementStepId,
): Promise<VerifyResult> {
  const token = await getAccessToken?.().catch(() => null)
  if (!token) return { ok: false, error: 'Sign in again to verify this step.' }
  const response = await apiFetch('/api/waitlist/x-engagement', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ step }),
  }).catch(() => null)
  if (!response) return { ok: false, error: 'Could not reach the server. Try again.' }
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistXEngagementApiResponse> | null
  if (response.ok && payload?.success && payload.data?.progress) {
    return { ok: true, progress: payload.data.progress }
  }
  return {
    ok: false,
    error: messageForReason(payload?.reason),
    progress: payload?.data?.progress,
  }
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

export function WaitlistTwitterEngagementSteps(props: WaitlistTwitterEngagementStepsProps) {
  const { getAccessToken, onProgressVerified, onSkip } = props
  const followHandle = resolveWaitlistTwitterFollowHandle()
  const reduceMotion = useReducedMotion() ?? false

  const [questSteps, setQuestSteps] = useState<WaitlistTwitterEngagementStepId[]>([
    ...WAITLIST_X_ENGAGEMENT_DEFAULT_STEPS,
  ])
  const [campaignTweetId, setCampaignTweetId] = useState<string | null>(null)
  const [progress, setProgress] = useState<WaitlistTwitterEngagementProgress>(
    emptyWaitlistTwitterEngagementProgress(),
  )
  const [awaitingVerification, setAwaitingVerification] = useState(false)
  const [confirmingStep, setConfirmingStep] = useState<WaitlistTwitterEngagementStepId | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const lastCompleteRef = useRef(false)

  const getAccessTokenRef = useRef(getAccessToken)
  const accessTokenReady = typeof getAccessToken === 'function'
  useEffect(() => {
    getAccessTokenRef.current = getAccessToken
  }, [getAccessToken])

  const applyProgressUpdate = useCallback(
    (next: WaitlistTwitterEngagementProgress, steps?: WaitlistTwitterEngagementStepId[]) => {
      if (steps) setQuestSteps(steps)
      setProgress(next)
      setSyncError(null)
      const activeSteps = steps ?? questSteps
      const active = resolveActiveWaitlistTwitterEngagementStep(next, activeSteps)
      if (active === 'complete' && !lastCompleteRef.current) {
        lastCompleteRef.current = true
        onProgressVerified?.()
      }
      if (active === 'complete') {
        setAwaitingVerification(false)
      }
    },
    [onProgressVerified, questSteps],
  )

  const applyEngagementState = useCallback(
    (state: WaitlistXEngagementState) => {
      setCampaignTweetId(state.campaignTweetId)
      applyProgressUpdate(state.progress, state.steps)
    },
    [applyProgressUpdate],
  )

  const applyEngagementStateRef = useRef(applyEngagementState)
  useEffect(() => {
    applyEngagementStateRef.current = applyEngagementState
  }, [applyEngagementState])

  const refreshProgress = useCallback(async () => {
    const next = await fetchEngagementState(getAccessTokenRef.current)
    if (!next) return
    applyEngagementStateRef.current(next)
  }, [])

  useEffect(() => {
    if (!accessTokenReady) return
    let cancelled = false
    void (async () => {
      const next = await fetchEngagementState(getAccessTokenRef.current)
      if (!next || cancelled) return
      applyEngagementStateRef.current(next)
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

  const activeStep = useMemo(
    () => resolveActiveWaitlistTwitterEngagementStep(progress, questSteps),
    [progress, questSteps],
  )

  const totalQuestXp = useMemo(() => totalWaitlistTwitterEngagementXp(questSteps), [questSteps])

  const completedCount = useMemo(
    () => questSteps.filter((step) => progress[step]).length,
    [progress, questSteps],
  )
  const totalSteps = questSteps.length
  const earnedXp = useMemo(
    () =>
      questSteps.reduce(
        (sum, step) => sum + (progress[step] ? WAITLIST_X_ENGAGEMENT_STEP_POINTS[step] : 0),
        0,
      ),
    [progress, questSteps],
  )
  const xpPercent = totalQuestXp > 0 ? Math.round((earnedXp / totalQuestXp) * 100) : 0
  const allComplete = activeStep === 'complete'

  const openStepIntent = useCallback(
    (step: WaitlistTwitterEngagementStepId) => {
      if (step === 'follow') {
        openWaitlistTwitterIntent(buildWaitlistTwitterFollowIntentUrl(followHandle))
        return
      }
      if (!campaignTweetId) {
        setSyncError('Campaign post is not live yet. Follow @4626fun for now — repost and comment unlock soon.')
        return
      }
      if (step === 'like') {
        openWaitlistTwitterIntent(buildWaitlistTwitterLikeIntentUrl(campaignTweetId))
        return
      }
      if (step === 'retweet') {
        openWaitlistTwitterIntent(buildWaitlistTwitterRetweetIntentUrl(campaignTweetId))
        return
      }
      openWaitlistTwitterIntent(buildWaitlistTwitterCommentIntentUrl(campaignTweetId, WAITLIST_X_ENGAGEMENT_COMMENT))
    },
    [campaignTweetId, followHandle],
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

  const handleConfirmStep = useCallback(
    (step: WaitlistTwitterEngagementStepId) => {
      setSyncError(null)
      setConfirmingStep(step)
      void (async () => {
        const result = await verifyEngagementStep(getAccessTokenRef.current, step)
        if (result.ok) {
          applyProgressUpdate(result.progress, questSteps)
        } else {
          // Keep the UI in sync if the server returned current progress
          // (e.g. the webhook already advanced a step), then surface the reason.
          if (result.progress) applyProgressUpdate(result.progress, questSteps)
          setSyncError(result.error)
        }
        setConfirmingStep((current) => (current === step ? null : current))
      })()
    },
    [applyProgressUpdate, questSteps],
  )

  return (
    <div className="relative mt-3 text-left">
      <div className="relative space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            X Quests
          </span>
          <span className="text-[11px] font-medium tabular-nums text-emerald-300/80">
            {allComplete ? (
              <>+{totalQuestXp} XP</>
            ) : (
              <>
                <span className="text-[rgb(var(--brand-primary))]">{earnedXp}</span>
                <span className="text-zinc-500"> / {totalQuestXp} XP</span>
              </>
            )}
          </span>
        </div>

        <div>
          <XpMeter percent={xpPercent} reduceMotion={reduceMotion} />
          <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            {completedCount} / {totalSteps} quests cleared
          </p>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {allComplete ? (
            <motion.p
              key="quest-complete"
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="text-[13px] font-semibold text-emerald-100"
            >
              All quests cleared
            </motion.p>
          ) : (
            <motion.ul
              key="quest-list"
              initial={false}
              className="mt-4 space-y-2"
            >
              {questSteps.map((step, index) => {
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
                    confirming={confirmingStep === step}
                    reduceMotion={reduceMotion}
                    onOpen={handleOpenStep}
                    onConfirm={handleConfirmStep}
                  />
                )
              })}
            </motion.ul>
          )}
        </AnimatePresence>

        {syncError ? (
          <p className="text-[11px] leading-relaxed text-rose-300">{syncError}</p>
        ) : null}

        {!allComplete && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            disabled={confirmingStep != null}
            className="block w-full pt-1 text-center text-[11px] font-medium tracking-wide text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
          >
            Skip for now
          </button>
        ) : null}
      </div>
    </div>
  )
}
