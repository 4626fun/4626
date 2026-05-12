// SPDX-License-Identifier: MIT
//
// AMOE ZK retry handler — `POST /api/v1/lottery/amoe/retry-zk`.
//
// Re-broadcasts a stored proof for a submission whose first broadcast
// hit `ManagerDeclinedEntry`. The router rolled back the nullifier
// writes when that revert fired, so the same proof + same nullifiers
// are still usable.
//
// Authentication: caller must own the `signup_id` on the row. The
// server-side credit account is the same one that funded the original
// pending row, so we don't need to re-collect (or re-debit) credits
// here — the original `_amoeSubmitZk` debits at `markSettled` time.
//
// Design doc: `docs/security/amoe-pr4-replay-store-design.md` §6.

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'

import { checkDurableRateLimit } from '../../../../server/_lib/infra/durableRateLimit.js'

import {
  classifyAmoeError,
  AmoeAuthorityError,
  AmoeBadRequestError,
  AmoeServerError,
} from '../../../../server/_lib/lottery/lotteryAmoeErrors.js'
import { resolveAmoeWallet } from '../../../../server/_lib/lottery/amoeWalletResolver.js'
import {
  computeAmoeEpoch,
  isAmoeZkSubmitEnabled,
  readLotteryAmoeRouterAddress,
} from '../../../../server/_lib/lottery/amoeSubmitZk.js'
import {
  retrySubmissionById,
  type RetrySubmissionRelay,
} from '../../../../server/_lib/lottery/amoeReplayRetry.js'
import { createAmoeRelay } from '../../../../server/_lib/lottery/amoeRelay.js'

type RetryZkBody = {
  submissionId?: string
}

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Test seam — pluggable relay for the integration tests.
 */
export interface AmoeRetryZkHandlerHooks {
  relay?: RetrySubmissionRelay
}

let __testHooks: AmoeRetryZkHandlerHooks = {}

export function __setAmoeRetryZkHandlerHooksForTest(hooks: AmoeRetryZkHandlerHooks): void {
  __testHooks = { ...hooks }
}

export function __resetAmoeRetryZkHandlerHooksForTest(): void {
  __testHooks = {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  if (!isAmoeZkSubmitEnabled()) {
    return res.status(503).json({ success: false, error: 'zk_path_disabled' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/amoe/retry-zk', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-lottery-amoe-retry-zk', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.lotteryWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const ip = getClientIp(req as any)
  const rl = await checkDurableRateLimit(rateLimitKey('amoe', 'retry-zk', ip), {
    windowMs: 60_000,
    maxRequests: 10,
  })
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  res.setHeader('X-RateLimit-Reset', String(rl.resetAt))
  if (!rl.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limited' })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 1024 })) ?? {}
  const b = body as RetryZkBody
  const submissionId = typeof b.submissionId === 'string' ? b.submissionId.trim() : ''

  if (!UUID_RE.test(submissionId)) {
    return res.status(400).json({ success: false, error: 'invalid_submission_id' })
  }

  try {
    const lotteryAmoeRouter = readLotteryAmoeRouterAddress()
    if (!lotteryAmoeRouter) {
      return res.status(503).json({ success: false, error: 'Lottery manager not configured' })
    }

    // Resolve caller wallet + signup_id so the retry can verify ownership.
    const walletAuthority = await resolveAmoeWallet({
      requestedWallet: null,
      authAddress: g.auth?.address ?? null,
    })
    if (!walletAuthority.ok) {
      throw new AmoeAuthorityError(walletAuthority.error)
    }
    const callerSignupId = walletAuthority.value.profileId
    if (
      typeof callerSignupId !== 'number' ||
      !Number.isFinite(callerSignupId) ||
      !Number.isSafeInteger(callerSignupId) ||
      callerSignupId <= 0
    ) {
      throw new AmoeAuthorityError('amoe_profile_unresolved')
    }

    const relay = __testHooks.relay ?? createAmoeRelay()
    if (!relay) {
      return res.status(503).json({
        success: false,
        error: 'amoe_retry_relay_missing',
      })
    }

    const result = await retrySubmissionById({
      submissionId,
      callerSignupId: BigInt(callerSignupId),
      currentEpoch: computeAmoeEpoch(BigInt(Math.floor(Date.now() / 1000))),
      lotteryAmoeRouter,
      relay,
    })

    if (result.kind === 'settled') {
      return res.status(200).json({
        success: true,
        data: {
          submissionId,
          txHash: result.txHash,
          state: 'settled',
        },
      })
    }
    if (result.kind === 'manager_declined_again') {
      return res.status(202).json({
        success: false,
        error: 'submission_manager_declined',
        data: {
          submissionId,
          state: 'manager_declined',
          retryCount: result.retryCount,
        },
      })
    }
    if (result.kind === 'abandoned_epoch_rolled') {
      return res.status(410).json({
        success: false,
        error: 'submission_epoch_rolled',
        data: { submissionId },
      })
    }
    if (result.kind === 'abandoned_budget_exhausted') {
      return res.status(410).json({
        success: false,
        error: 'submission_abandoned',
        data: { submissionId },
      })
    }
    // Should never happen, but handle defensively.
    throw new AmoeServerError('amoe_retry_unexpected_outcome')
  } catch (error: unknown) {
    if (error instanceof AmoeBadRequestError && error.message === 'submission_not_retryable') {
      return res.status(409).json({
        success: false,
        error: 'submission_not_retryable',
      })
    }
    if (error instanceof AmoeBadRequestError && error.message === 'submission_not_found') {
      return res.status(404).json({
        success: false,
        error: 'submission_not_found',
      })
    }
    const { status, message: errMessage } = classifyAmoeError(error)
    return res.status(status).json({
      success: false,
      error: errMessage,
    })
  }
}
