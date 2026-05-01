// SPDX-License-Identifier: MIT
//
// AMOE orphan-burn refund cron — `GET /api/v1/lottery/amoe/burn-refund-cron`.
//
// Scheduled every 15 minutes by `frontend/vercel.json:crons` (same
// cadence as the publisher cron). Each tick:
//   1. Walks `points` for AMOE phase-A debits older than
//      `REFUND_AGE_EPOCHS` epochs (default 7) that have no matching
//      settled `amoe_zk_submissions` row and no existing
//      `amoe_entry_refund` row.
//   2. For each orphan, INSERTs a compensating positive
//      `amoe_entry_refund` row keyed off the original `spend_ref_id`.
//      Idempotency is provided by the existing
//      `points_unique_source_full` UNIQUE index — a re-run of the cron
//      against the same orphan is a no-op.
//   3. Returns a `{ scannedCount, refundedCount, errors }` summary.
//
// AUTH — same shape as the publisher cron
// =======================================
// `Authorization: Bearer <CRON_SECRET>` via `isAuthorizedCron`. Spurious
// public probes return 401. The cron is idempotent so even if an
// attacker forced a tick they couldn't double-refund.
//
// FEATURE FLAGS
// =============
// `AMOE_ZK_SUBMIT_ENABLED=1` — top-level enable for the ZK path.
// `AMOE_REFUND_CRON_ENABLED=1` — enable for THIS cron specifically.
// Either flag missing → 503 (so observability flags mis-deployments
// rather than silently no-op'ing).
//
// PER-TICK BOUND
// ==============
// `AMOE_REFUND_MAX_PER_TICK` (default 50) caps the number of refunds
// any single tick can emit. A backlog drains over multiple ticks; we
// never hold the function open for minutes processing a flood.
//
// ON-CHAIN INTERACTION — none
// ===========================
// Refund rows have `amount > 0`. The L0 → L1 projector at
// `amoeLedgerProjector.ts:316-317` filters `amount < 0`, so refund
// rows CANNOT enter the on-chain ledger root by construction. This
// cron requires no signer key, no RPC, and no router contract — it's
// pure DB compensation.
//
// Design doc: `docs/security/amoe-burn-then-submit-design.md` §5.1
// (option 1) and §7.5.

import type { VercelRequest, VercelResponse } from '@vercel/node'

import { isAmoeZkSubmitEnabled } from '../../../../server/_lib/lottery/amoeSubmitZk.js'
import {
  isAmoeBurnRefundCronEnabled,
  readMaxRefundsPerTick,
  readRefundAgeSec,
  requireBurnRefundDb,
  runBurnRefundTick,
  type AmoeBurnRefundDb,
  type RefundTickResult,
} from '../../../../server/_lib/lottery/amoeBurnRefund.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'

declare const process: { env: Record<string, string | undefined> }

/**
 * Test seam — inject the db and the runner so handler tests can drive
 * the cron without touching the real Postgres pool. `runTick` lets a
 * test stub the entire compose-and-iterate behaviour without
 * reconstructing the helper's internal SQL.
 */
export interface AmoeBurnRefundCronHandlerHooks {
  db?: AmoeBurnRefundDb
  runTick?: (
    db: AmoeBurnRefundDb,
    args: { ageSec: number; limit: number },
  ) => Promise<RefundTickResult>
  ageSec?: number
  limit?: number
}

let __testHooks: AmoeBurnRefundCronHandlerHooks = {}

export function __setAmoeBurnRefundCronHandlerHooksForTest(
  hooks: AmoeBurnRefundCronHandlerHooks,
): void {
  __testHooks = { ...hooks }
}

export function __resetAmoeBurnRefundCronHandlerHooksForTest(): void {
  __testHooks = {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!isAmoeZkSubmitEnabled()) {
    return res.status(503).json({ ok: false, error: 'zk_path_disabled' })
  }

  if (!isAmoeBurnRefundCronEnabled()) {
    return res.status(503).json({ ok: false, error: 'refund_cron_disabled' })
  }

  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  const db = __testHooks.db ?? (await requireBurnRefundDb())
  const ageSec = __testHooks.ageSec ?? readRefundAgeSec()
  const limit = __testHooks.limit ?? readMaxRefundsPerTick()
  const runTick = __testHooks.runTick ?? runBurnRefundTick

  let result: RefundTickResult
  try {
    result = await runTick(db, { ageSec, limit })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.warn('[amoe-burn-refund-cron] tick failed', { error: message })
    return res.status(500).json({
      ok: false,
      tick: 'errored',
      error: message.slice(0, 500),
    })
  }

  // Structured log for ops dashboards. Quiet when nothing happened so
  // the log stream isn't dominated by no-op ticks.
  if (result.scannedCount > 0 || result.errors.length > 0) {
    console.info('[amoe-burn-refund-cron] tick', {
      scannedCount: result.scannedCount,
      refundedCount: result.refundedCount,
      errorCount: result.errors.length,
    })
  }

  return res.status(200).json({
    ok: result.errors.length === 0,
    tick: result.scannedCount === 0 ? 'no_orphans' : 'refunded',
    scannedCount: result.scannedCount,
    refundedCount: result.refundedCount,
    ageSec,
    limit,
    ...(result.errors.length > 0 && { errors: result.errors }),
  })
}
