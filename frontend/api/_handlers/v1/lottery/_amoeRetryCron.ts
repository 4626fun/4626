// SPDX-License-Identifier: MIT
//
// AMOE replay-store retry cron \u2014 `GET /api/v1/lottery/amoe/retry-cron`.
//
// Scheduled every 5 minutes by `frontend/vercel.json:crons`. Walks
// `manager_declined` rows whose `next_retry_at <= NOW()` and attempts
// to re-broadcast each via `retrySubmissionByIdAsCron`. Bounded to
// `AMOE_MAX_RETRIES` per row (default 8); rows that exceed transition
// to `abandoned`.
//
// Vercel cron requests carry a bearer-token signature in the
// `Authorization: Bearer <CRON_SECRET>` header. We validate that here
// before doing any work; spurious GETs return 401.
//
// Design doc: `docs/security/amoe-pr4-replay-store-design.md` \u00a76.2.

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  computeAmoeEpoch,
  isAmoeZkSubmitEnabled,
  readLotteryAmoeRouterAddress,
} from '../../../../server/_lib/lottery/amoeSubmitZk.js'
import {
  pickRetriesForCron,
  reclaimStrandedRetries,
  gcExpiredProofBlobs,
  type AmoeSubmissionRow,
} from '../../../../server/_lib/lottery/amoeReplayStore.js'
import {
  retrySubmissionByIdAsCron,
  type RetrySubmissionRelay,
  type RetrySubmissionOutcome,
} from '../../../../server/_lib/lottery/amoeReplayRetry.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'

declare const process: { env: Record<string, string | undefined> }

/**
 * Test seam \u2014 inject a relay so the integration test can drive the
 * cron without snarkjs / RPC.
 */
export interface AmoeRetryCronHandlerHooks {
  relay?: RetrySubmissionRelay
  /** Override the row picker (tests use this to bypass the DB). */
  pickRows?: (limit: number) => Promise<AmoeSubmissionRow[]>
  /** Override `retrySubmissionByIdAsCron` for tests. */
  retryOne?: (
    id: string,
    params: Parameters<typeof retrySubmissionByIdAsCron>[1],
  ) => Promise<RetrySubmissionOutcome>
}

let __testHooks: AmoeRetryCronHandlerHooks = {}

export function __setAmoeRetryCronHandlerHooksForTest(hooks: AmoeRetryCronHandlerHooks): void {
  __testHooks = { ...hooks }
}

export function __resetAmoeRetryCronHandlerHooksForTest(): void {
  __testHooks = {}
}

const CRON_BATCH_SIZE = 50

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!isAmoeZkSubmitEnabled()) {
    // Mirror submit handler: 503 (not 200/no-op) so cron observability
    // catches the case where the flag was disabled but the schedule
    // wasn't.
    return res.status(503).json({ ok: false, error: 'zk_path_disabled' })
  }

  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  const lotteryAmoeRouter = readLotteryAmoeRouterAddress()
  if (!lotteryAmoeRouter) {
    return res.status(503).json({ ok: false, error: 'Lottery manager not configured' })
  }

  const relay = __testHooks.relay
  if (!relay) {
    // Production callers must supply a relay. We don't bake a default
    // in here because the relay path depends on viem + bundler env that
    // is wired in the submit handler. PR 5 will hoist this into a
    // shared module; for now, the cron is gated by the test hook in
    // CI and a thin production wrapper that supplies the same relay.
    //
    // To avoid breaking the cron schedule before the production
    // wrapper lands, we no-op (200 OK with `relay_unavailable`) so the
    // schedule keeps ticking and we get an actionable metric.
    return res.status(200).json({
      ok: true,
      tick: 'no_relay_configured',
      pickedCount: 0,
      reclaimedCount: 0,
      gcCount: 0,
    })
  }

  const pickRows = __testHooks.pickRows ?? pickRetriesForCron
  const retryOne = __testHooks.retryOne ?? retrySubmissionByIdAsCron

  // Reclaim stranded rows from prior cron crashes BEFORE picking new ones,
  // so a single tick has the chance to recover-then-process.
  const reclaimedCount = await reclaimStrandedRetries().catch((e) => {
    console.warn('[amoe-retry-cron] reclaim failed', e)
    return 0
  })

  const rows = await pickRows(CRON_BATCH_SIZE)

  const currentEpoch = computeAmoeEpoch(BigInt(Math.floor(Date.now() / 1000)))

  const outcomes: Array<{ id: string; outcome: string; error?: string }> = []
  for (const row of rows) {
    try {
      const outcome = await retryOne(row.id, {
        lotteryAmoeRouter,
        relay,
        currentEpoch,
      })
      outcomes.push({ id: row.id, outcome: outcome.kind })
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 200) : 'unknown_error'
      outcomes.push({ id: row.id, outcome: 'error', error: message })
      console.warn('[amoe-retry-cron] retry failed', { id: row.id, message })
    }
  }

  // GC expired proof blobs at the end of the tick. Doing this last
  // means a successful retry's blob (which `markSettled` already
  // nulled) doesn't fight with this query.
  const gcCount = await gcExpiredProofBlobs().catch((e) => {
    console.warn('[amoe-retry-cron] gc failed', e)
    return 0
  })

  return res.status(200).json({
    ok: true,
    tick: 'processed',
    pickedCount: rows.length,
    reclaimedCount,
    gcCount,
    outcomes,
  })
}
