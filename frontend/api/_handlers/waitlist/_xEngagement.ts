import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  getDb,
  handleOptions,
  setCors,
  setNoStore,
} from '@4626/server-core'

import { verifyPrivyForAccounts } from '../../../server/_lib/identity/accountsIdentity.js'
import {
  readWaitlistTwitterEngagementProgressForPrivyUser,
  verifyAndAwardWaitlistTwitterEngagementStep,
  WAITLIST_X_ENGAGEMENT_CAMPAIGN_KEY,
  type WaitlistTwitterEngagementProgress,
  type WaitlistTwitterEngagementStepId,
  type WaitlistTwitterEngagementVerifyOutcome,
} from '../../../server/_lib/onboarding/waitlistTwitterEngagementServer.js'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'

// Active quest steps. Temporarily follow-only (POST rejects other steps as
// invalid). Keep in sync with WAITLIST_X_ENGAGEMENT_STEPS (client) and
// WAITLIST_X_ENGAGEMENT_STEP_ORDER (server) when re-enabling like/retweet/comment.
const STEP_ORDER = ['follow'] as const

type WaitlistXEngagementResponse = {
  campaignKey: string
  progress: WaitlistTwitterEngagementProgress
  activeStep: WaitlistTwitterEngagementStepId | 'complete'
  verified: boolean
}

function resolveActiveStep(progress: WaitlistTwitterEngagementProgress) {
  for (const step of STEP_ORDER) {
    if (!progress[step]) return step
  }
  return 'complete' as const
}

function buildResponse(progress: WaitlistTwitterEngagementProgress): WaitlistXEngagementResponse {
  const activeStep = resolveActiveStep(progress)
  return {
    campaignKey: WAITLIST_X_ENGAGEMENT_CAMPAIGN_KEY,
    progress,
    activeStep,
    verified: activeStep === 'complete',
  }
}

function parseStep(value: unknown): WaitlistTwitterEngagementStepId | null {
  return STEP_ORDER.includes(value as (typeof STEP_ORDER)[number])
    ? (value as WaitlistTwitterEngagementStepId)
    : null
}

type FailureOutcome = Extract<WaitlistTwitterEngagementVerifyOutcome, { ok: false }>

/** Map a verification failure reason to an HTTP status + stable error code. */
function statusForFailure(reason: FailureOutcome['reason']): { status: number; error: string } {
  switch (reason) {
    case 'out_of_order':
      return { status: 409, error: 'complete_previous_steps_first' }
    case 'not_found':
      // We could reach X, but the engagement was not found for this user.
      return { status: 422, error: 'engagement_not_found' }
    case 'not_linked':
      return { status: 412, error: 'x_account_not_linked' }
    case 'rate_limited':
      return { status: 429, error: 'x_rate_limited' }
    case 'credentials_unavailable':
    case 'lookup_unavailable':
      return { status: 503, error: 'x_verification_unavailable' }
    case 'network_error':
      return { status: 502, error: 'x_verification_failed' }
    default: {
      const exhaustive: never = reason
      return exhaustive
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) return res.status(503).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureWaitlistSchema(db as any)

    if (req.method === 'POST') {
      const body = (req.body ?? {}) as Record<string, unknown>
      const step = parseStep(body.step)
      if (!step) {
        return res.status(400).json({ success: false, error: 'invalid_step' } satisfies ApiEnvelope<never>)
      }
      const result = await verifyAndAwardWaitlistTwitterEngagementStep({
        db: db as any,
        privyUserId: context.privyUserId,
        step,
      })
      if (!result.ok) {
        const { status, error } = statusForFailure(result.reason)
        return res.status(status).json({
          success: false,
          error,
          reason: result.reason,
          data: buildResponse(result.progress),
        } satisfies ApiEnvelope<WaitlistXEngagementResponse>)
      }
      return res
        .status(200)
        .json({ success: true, data: buildResponse(result.progress) } satisfies ApiEnvelope<WaitlistXEngagementResponse>)
    }

    const progress = await readWaitlistTwitterEngagementProgressForPrivyUser(db as any, context.privyUserId)
    return res
      .status(200)
      .json({ success: true, data: buildResponse(progress) } satisfies ApiEnvelope<WaitlistXEngagementResponse>)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    const status = /token|unauthorized|forbidden|privy/i.test(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
