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
  WAITLIST_X_ENGAGEMENT_CAMPAIGN_KEY,
} from '../../../server/_lib/onboarding/waitlistTwitterEngagementServer.js'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'

const STEP_ORDER = ['follow', 'like', 'retweet', 'comment'] as const

type WaitlistXEngagementResponse = {
  campaignKey: string
  progress: Record<(typeof STEP_ORDER)[number], boolean>
  activeStep: (typeof STEP_ORDER)[number] | 'complete'
  verified: boolean
}

function resolveActiveStep(progress: Record<(typeof STEP_ORDER)[number], boolean>) {
  for (const step of STEP_ORDER) {
    if (!progress[step]) return step
  }
  return 'complete' as const
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) return res.status(503).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureWaitlistSchema(db as any)
    const progress = await readWaitlistTwitterEngagementProgressForPrivyUser(db as any, context.privyUserId)
    const activeStep = resolveActiveStep(progress)
    const data: WaitlistXEngagementResponse = {
      campaignKey: WAITLIST_X_ENGAGEMENT_CAMPAIGN_KEY,
      progress,
      activeStep,
      verified: activeStep === 'complete',
    }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistXEngagementResponse>)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    const status = /token|unauthorized|forbidden|privy/i.test(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
