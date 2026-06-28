import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Heart, Loader2, MessageCircle, Repeat2, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import {
  WAITLIST_X_ENGAGEMENT_COMMENT,
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
  waitlistTwitterEngagementStepIndex,
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
  const token = await getAccessToken?.().catch(() => null)
  if (!token) return null
  const response = await apiFetch('/api/waitlist/x-engagement', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => null)
  if (!response?.ok) return null
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistXEngagementApiResponse> | null
  if (!payload?.success || !payload.data?.progress) return null
  return payload.data.progress
}

export function WaitlistTwitterEngagementSteps(props: WaitlistTwitterEngagementStepsProps) {
  const { getAccessToken, onProgressVerified } = props
  const followHandle = resolveWaitlistTwitterFollowHandle()
  const tweetId = resolveWaitlistTwitterEngagementTweetId()

  const [progress, setProgress] = useState<WaitlistTwitterEngagementProgress>(
    emptyWaitlistTwitterEngagementProgress(),
  )
  const [awaitingVerification, setAwaitingVerification] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const lastCompleteRef = useRef(false)

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

  const refreshProgress = useCallback(async () => {
    const next = await fetchVerifiedEngagementProgress(getAccessToken)
    if (!next) return
    applyProgressUpdate(next)
  }, [applyProgressUpdate, getAccessToken])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next = await fetchVerifiedEngagementProgress(getAccessToken)
      if (!next || cancelled) return
      applyProgressUpdate(next)
    })()
    return () => {
      cancelled = true
    }
  }, [applyProgressUpdate, getAccessToken])

  useEffect(() => {
    if (!awaitingVerification) return
    const timer = window.setInterval(() => {
      void refreshProgress()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [awaitingVerification, refreshProgress])

  const activeStep = useMemo(() => resolveActiveWaitlistTwitterEngagementStep(progress), [progress])

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

  if (activeStep === 'complete') {
    return (
      <div
        className="mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 text-left"
        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.02))' }}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
          <Check className="size-3.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 text-[12px] leading-relaxed text-emerald-100/90">
          Thanks — X verified all {WAITLIST_X_ENGAGEMENT_STEPS.length} steps.
        </span>
      </div>
    )
  }

  const stepNumber = waitlistTwitterEngagementStepIndex(activeStep) + 1
  const copy = resolveWaitlistTwitterEngagementStepCopy(activeStep)

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Step {stepNumber} of {WAITLIST_X_ENGAGEMENT_STEPS.length}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-600">
          {WAITLIST_X_ENGAGEMENT_STEPS.map((step) => (
            <span
              key={step}
              className={
                progress[step]
                  ? 'size-1.5 rounded-full bg-emerald-400/80'
                  : step === activeStep
                    ? 'size-1.5 rounded-full bg-[rgb(var(--brand-primary))]'
                    : 'size-1.5 rounded-full bg-zinc-700'
              }
              aria-hidden="true"
            />
          ))}
        </span>
      </div>

      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300">
          <StepIcon step={activeStep} className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-white">{copy.title}</p>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            {copy.description} We verify each step automatically through X.
          </p>
        </div>
      </div>

      {activeStep === 'comment' ? (
        <div className="rounded-xl border border-white/[0.06] bg-[rgb(var(--vault-bg)/0.55)] px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Pre-filled comment</p>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">{WAITLIST_X_ENGAGEMENT_COMMENT}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => handleOpenStep(activeStep)}
        >
          {copy.actionLabel}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
        {awaitingVerification ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Waiting for X to confirm…
          </span>
        ) : null}
      </div>

      {syncError ? (
        <p className="text-[11px] leading-relaxed text-rose-300">{syncError}</p>
      ) : null}
    </div>
  )
}
