// SPDX-License-Identifier: MIT
//
// AMOE points-burn ledger publisher cron — `GET /api/v1/lottery/amoe/publish-cron`.
//
// Scheduled every 15 minutes by `frontend/vercel.json:crons`. Each tick:
//   1. Reclaim stranded publisher_runs (mark as `errored` so the lock
//      releases for the next tick).
//   2. Compute the latest CLOSED epoch (current epoch - 1).
//   3. If that epoch already has a confirmed L2 snapshot, no-op.
//   4. Otherwise, drive the epoch through the publish pipeline:
//      project (L0 → L1) → build (L1 → L2 state 1) → broadcast (state 2)
//      → confirm (state 3).
//
// LOCKING — single-instance gate
// ==============================
// Two Vercel pods can fire the cron at the same minute. The
// `amoe_publisher_runs` table's partial unique index on `(epoch) WHERE
// finished_at IS NULL` ensures only ONE pod claims an epoch at a time;
// the loser sees a 23505 unique-violation, surfaces `lost_claim`, and
// no-ops for that tick. Stranded claims (pod crashed) are reclaimed
// after `STRANDED_RUN_RECLAIM_AGE_MS = 10 min`.
//
// AUTH — same shape as `_amoeRetryCron.ts` (Vercel cron-secret)
// =============================================================
// `Authorization: Bearer <CRON_SECRET>` header. Spurious GETs from
// public discovery probes return 401. Invocations missing the secret
// fail closed.
//
// FEATURE FLAGS
// =============
// `AMOE_ZK_SUBMIT_ENABLED=1` — top-level enable for the ZK path.
// `AMOE_LEDGER_PUBLISHER_ENABLED=1` — enable for THIS cron specifically.
// Either flag missing → 503 (so observability catches mis-deployments).
//
// SIGNER UNAVAILABLE — defaults to no-op
// ======================================
// If no publisher signer key is configured, the broadcast step throws
// `no_publisher_key_configured`. We catch that here and return 200
// with `tick: 'no_publisher_key_configured'` so the schedule keeps
// ticking (the alternative — 503 — would page on every healthcheck).
//
// Design doc: `docs/security/amoe-pr5b-publisher-design.md` §4.

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  computeAmoeEpoch,
  isAmoeZkSubmitEnabled,
  readLotteryAmoeRouterAddress,
} from '../../../../server/_lib/lottery/amoeSubmitZk.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import {
  defaultBroadcastSetPointsLedgerRoot,
  defaultConfirmTransactionReceipt,
  defaultLookupBurnContext,
  isAmoeLedgerPublisherEnabled,
  pickNextEpochToPublish,
  publishEpoch,
  readPublisherClaimedBy,
  reclaimStrandedPublisherRuns,
  requirePublisherDb,
  type AmoePublisherDb,
  type BroadcastSetPointsLedgerRoot,
  type ConfirmTransactionReceipt,
  type LookupBurnContext,
  type PublishEpochOutcome,
} from '../../../../server/_lib/lottery/amoeLedgerPublisher.js'

declare const process: { env: Record<string, string | undefined> }

/**
 * Test seam — inject the four collaborators so the integration test can
 * drive the cron without snarkjs / RPC.
 */
export interface AmoePublishCronHandlerHooks {
  db?: AmoePublisherDb
  broadcast?: BroadcastSetPointsLedgerRoot
  confirm?: ConfirmTransactionReceipt
  lookupBurnContext?: LookupBurnContext
  /** Override the publisher version (production reads from process.env). */
  publisherVersion?: string
  /** Override the now-source for epoch computation. */
  nowSec?: bigint
}

let __testHooks: AmoePublishCronHandlerHooks = {}

export function __setAmoePublishCronHandlerHooksForTest(
  hooks: AmoePublishCronHandlerHooks,
): void {
  __testHooks = { ...hooks }
}

export function __resetAmoePublishCronHandlerHooksForTest(): void {
  __testHooks = {}
}

/**
 * Read the publisher version stamped on each L2 row. Operators wire
 * this via the build-time env var — the deployment pipeline injects the
 * git SHA. Falls back to a sentinel string so missing env doesn't crash
 * the cron.
 */
function readPublisherVersion(): string {
  const sha = String(
    process.env.AMOE_LEDGER_PUBLISHER_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? '',
  ).trim()
  return sha.length > 0 ? sha.slice(0, 64) : 'unknown'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!isAmoeZkSubmitEnabled()) {
    return res.status(503).json({ ok: false, error: 'zk_path_disabled' })
  }

  if (!isAmoeLedgerPublisherEnabled()) {
    return res.status(503).json({ ok: false, error: 'publisher_disabled' })
  }

  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  const lotteryAmoeRouter = readLotteryAmoeRouterAddress()
  if (!lotteryAmoeRouter) {
    return res
      .status(503)
      .json({ ok: false, error: 'lottery_amoe_router_not_configured' })
  }

  // Resolve collaborators (test hooks override).
  const db = __testHooks.db ?? (await requirePublisherDb())
  const broadcast = __testHooks.broadcast ?? defaultBroadcastSetPointsLedgerRoot
  const confirm = __testHooks.confirm ?? defaultConfirmTransactionReceipt
  const lookupBurnContext: LookupBurnContext =
    __testHooks.lookupBurnContext ?? ((args) => defaultLookupBurnContext(db, args))
  const publisherVersion = __testHooks.publisherVersion ?? readPublisherVersion()
  const claimedBy = readPublisherClaimedBy()

  // Reclaim stranded runs from prior cron crashes BEFORE picking new
  // ones, so a single tick has the chance to recover-then-publish.
  const reclaimedCount = await reclaimStrandedPublisherRuns(db).catch((e) => {
    console.warn('[amoe-publish-cron] reclaim failed', e)
    return 0
  })

  // Pick the OLDEST unpublished closed epoch within the bounded
  // backfill horizon. The cron NEVER works on the in-progress epoch
  // (its burns are still arriving), so the latest candidate is always
  // `currentEpoch - 1`. If older closed epochs were missed (cron
  // disabled, prior errors, or partial outage), they get retried here
  // — oldest first — until they confirm or fall outside the horizon.
  // We still publish at most one epoch per tick (MAX_EPOCHS_PER_TICK),
  // so a backlog drains across successive ticks.
  const nowSec = __testHooks.nowSec ?? BigInt(Math.floor(Date.now() / 1000))
  const currentEpoch = computeAmoeEpoch(nowSec)
  if (currentEpoch <= 0n) {
    return res.status(200).json({
      ok: true,
      tick: 'pre_genesis',
      reclaimedCount,
    })
  }
  const latestClosedEpoch = currentEpoch - 1n
  const targetEpoch = await pickNextEpochToPublish(db, {
    latestClosedEpoch,
  })
  if (targetEpoch === null) {
    // Every epoch in the horizon is already published or no-op'd.
    return res.status(200).json({
      ok: true,
      tick: 'nothing_to_publish',
      latestClosedEpoch: latestClosedEpoch.toString(),
      reclaimedCount,
    })
  }

  let outcome: PublishEpochOutcome | null = null
  let error: string | null = null
  try {
    outcome = await publishEpoch({
      db,
      epoch: targetEpoch,
      claimedBy,
      lotteryAmoeRouter,
      broadcast,
      confirm,
      lookupBurnContext,
      publisherVersion,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    if (/no_publisher_key_configured/.test(msg)) {
      // Surface as a 200 no-op rather than 503 — the cron isn't
      // failing, it's just unconfigured. This matches the legacy
      // retry cron's no_relay_configured handling.
      return res.status(200).json({
        ok: true,
        tick: 'no_publisher_key_configured',
        epoch: targetEpoch.toString(),
        reclaimedCount,
      })
    }
    error = msg.slice(0, 500)
    console.warn('[amoe-publish-cron] publishEpoch failed', {
      epoch: targetEpoch.toString(),
      error,
    })
  }

  return res.status(200).json({
    ok: error === null,
    tick: error === null ? (outcome?.kind ?? 'unknown') : 'errored',
    epoch: targetEpoch.toString(),
    reclaimedCount,
    outcome:
      outcome === null
        ? null
        : {
            kind: outcome.kind,
            ...(outcome.kind === 'finished' && {
              rootHex: outcome.rootHex,
              txHash: outcome.txHash,
            }),
            ...(outcome.kind === 'finished_no_op' && { reason: outcome.reason }),
            ...(outcome.kind === 'in_flight' && { phase: outcome.phase }),
            ...(outcome.kind === 'errored' && {
              phase: outcome.phase,
              message: outcome.message,
            }),
          },
    ...(error !== null && { error }),
  })
}
