// SPDX-License-Identifier: MIT
//
// AMOE points-burn ledger publisher — drives an epoch through the full
// project → build → broadcast → confirm pipeline.
//
// SCOPE
// =====
// This module is the orchestrator. It owns:
//   * Selecting the next un-published epoch (claim phase).
//   * Calling `projectAmoeBurnsToLedger` until the epoch is fully
//     projected from L0 → L1.
//   * Calling `buildAmoeLedgerSnapshot` to materialize L1 → L2 (state 1).
//   * Broadcasting `LotteryAmoeRouter.setPointsLedgerRoot(epoch, root)`
//     and updating L2 to state 2.
//   * Polling `waitForTransactionReceipt` and updating L2 to state 3.
//   * Marking the publisher run terminal.
//
// LOCK MODEL
// ==========
// Single-instance via `amoe_publisher_runs` partial unique index on
// `(epoch) WHERE finished_at IS NULL`. Two pods racing for the same
// epoch produce exactly one INSERT — the loser sees a 23505 unique
// violation and skips this epoch this tick.
//
// Stranded runs (pod crashed mid-flight) are reclaimed by
// `reclaimStrandedPublisherRuns`, which marks runs older than
// `STRANDED_RUN_RECLAIM_AGE_MS` as `errored` and clears their finished
// state. The next tick can then re-claim.
//
// SIGNER PRECEDENCE
// =================
// 1. `AMOE_LEDGER_PUBLISHER_PRIVATE_KEY` — direct EOA signer.
// 2. `AMOE_LEDGER_PUBLISHER_PRIVY_WALLET_ID` + ..._OWNER_ADDRESS — Privy
//    Coinbase Smart Wallet (4337 user-op).
// 3. None configured → publisher returns `no_publisher_key_configured`
//    (cron is a no-op for this tick; not an error).
//
// CRITICAL: this module never falls back to `AMOE_RELAY_PRIVATE_KEY`.
// That key signs entry submissions (different on-chain role); using it
// for `setPointsLedgerRoot` would require the relay key to ALSO be the
// on-chain `pointsLedgerPublisher`, which collapses two separate
// authorization domains. Refuse rather than collapse.
//
// EMPTY EPOCHS
// ============
// `LotteryAmoeRouter.setPointsLedgerRoot` reverts on root == bytes32(0)
// (the `ZeroRoot` revert). An empty epoch (no AMOE burns) builds a
// snapshot whose root IS bytes32(0), which we cannot publish on-chain.
// Behaviour: skip the on-chain call, mark the run `finished_no_op`, and
// leave the L2 row in state 1 (so the reader continues to refuse —
// users get the same 503 they would for an in-flight epoch).
//
// Design doc: `docs/security/amoe-pr5b-publisher-design.md`.

import { hostname as osHostname } from 'node:os'

import { getDb } from '../db/postgres.js'
import {
  buildAmoeLedgerSnapshot,
  type BuildAmoeLedgerSnapshotResult,
} from './amoeLedgerSnapshotBuilder.js'
import {
  projectAmoeBurnsToLedger,
  type AmoeBurnContext,
  type AmoeBurnContextLookupArgs,
  type AmoeProjectorDb,
  type ProjectAmoeBurnsToLedgerResult,
} from './amoeLedgerProjector.js'
import { AmoeServerError } from './lotteryAmoeErrors.js'

declare const process: { env: Record<string, string | undefined> }

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/**
 * How long an in-flight publisher run can sit before reclaim treats it
 * as stranded. Sized above the worst-case `waitForTransactionReceipt`
 * (60 s) plus generous slack, and well below any sane cron cadence.
 */
export const STRANDED_RUN_RECLAIM_AGE_MS = 10 * 60 * 1000 // 10 min

/**
 * Hard cap on projector loop iterations within a single phase. Bounds
 * the cron tick's worst-case duration even if a misconfigured
 * `lookupBurnContext` returns null forever (the cursor advances anyway
 * but we still want a tick budget).
 */
export const MAX_PROJECTOR_ITERATIONS = 32

/**
 * How long to wait for the on-chain receipt before we give up on this
 * tick (we leave the L2 row in state 2 and the next tick will re-poll
 * via the confirming branch).
 */
export const RECEIPT_WAIT_TIMEOUT_MS = 60_000

/**
 * Cap on epochs processed per tick. The cron is supposed to be the
 * common case (process the latest closed epoch); a value > 1 only
 * matters during outage backfill. Pin to 1 in production until §14
 * question 2 is resolved.
 */
export const MAX_EPOCHS_PER_TICK = 1

/**
 * How far back the cron will scan for unpublished closed epochs when
 * picking the next target. Bounded so a long outage doesn't make a
 * single tick scan unbounded history; ops can re-trigger the cron or
 * advance the horizon if real catch-up is needed beyond this.
 *
 * 14 epochs at the locked AMOE_EPOCH_LENGTH_SECONDS = 86_400 s = 14
 * days. Each tick still only publishes one epoch (MAX_EPOCHS_PER_TICK),
 * so a 14-day backlog drains in 14 ticks at 15-min cadence — about
 * 3.5 hours — with plenty of margin.
 */
export const BACKFILL_LOOKBACK_EPOCHS = 14n

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Db pool shape this module needs. */
export type AmoePublisherDb = {
  sql: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<{ rows: unknown[] }>
}

/**
 * Adapter for the on-chain broadcast. Tests inject a stub; production
 * uses {@link defaultBroadcastSetPointsLedgerRoot} which encodes via
 * viem and submits via the configured signer.
 */
export interface BroadcastSetPointsLedgerRoot {
  (args: {
    lotteryAmoeRouter: `0x${string}`
    epoch: bigint
    rootHex: `0x${string}`
  }): Promise<{ txHash: `0x${string}` }>
}

/**
 * Adapter for receipt confirmation. Tests inject a stub; production
 * uses viem's `waitForTransactionReceipt`. Returns the block number on
 * success, or `null` on timeout (caller leaves the run in state 2 for
 * the next tick to re-poll).
 */
export interface ConfirmTransactionReceipt {
  (args: {
    txHash: `0x${string}`
    timeoutMs: number
  }): Promise<{ blockNumber: bigint } | null>
}

/**
 * Resolve a burn's on-chain identity (wallet + nullifier) at projection
 * time. The projector calls this for every L0 row it considers; we wire
 * it through `amoe_zk_submissions` so the wallet bound to the proof is
 * the same wallet bound to the L1 leaf.
 */
export interface LookupBurnContext {
  (args: AmoeBurnContextLookupArgs): Promise<AmoeBurnContext | null>
}

export interface PublishEpochArgs {
  /** Db pool. */
  db: AmoePublisherDb
  /** Epoch to publish. */
  epoch: bigint
  /** Identity stamped on the publisher_runs row. */
  claimedBy: string
  /** Address of the deployed `LotteryAmoeRouter`. */
  lotteryAmoeRouter: `0x${string}`
  /** Adapter for the on-chain root broadcast. */
  broadcast: BroadcastSetPointsLedgerRoot
  /** Adapter for confirmation polling. */
  confirm: ConfirmTransactionReceipt
  /** Lookup wallet/nullifier for projection. */
  lookupBurnContext: LookupBurnContext
  /** Publisher version (git SHA) stamped on the L2 row. */
  publisherVersion: string
}

/** Outcome of a single epoch's pipeline run. */
export type PublishEpochOutcome =
  | { kind: 'finished'; epoch: bigint; rootHex: `0x${string}`; txHash: `0x${string}` }
  | { kind: 'finished_no_op'; epoch: bigint; reason: 'empty_epoch' }
  | { kind: 'in_flight'; epoch: bigint; phase: PublisherPhase }
  | { kind: 'lost_claim'; epoch: bigint }
  | { kind: 'errored'; epoch: bigint; phase: PublisherPhase; message: string }

export type PublisherPhase =
  | 'projecting'
  | 'building'
  | 'broadcasting'
  | 'confirming'
  | 'finished'
  | 'finished_no_op'
  | 'errored'

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

interface PublisherRunRow {
  id: string
  epoch: bigint
  phase: PublisherPhase
  snapshot_epoch: bigint | null
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  // Postgres SQLSTATE for unique_violation is 23505. Both pg and
  // postgres.js surface it in `.code`; handle both shapes.
  const code = (err as { code?: unknown }).code
  return typeof code === 'string' && code === '23505'
}

/**
 * Try to claim `epoch` for this pod by inserting a fresh in-flight run.
 * Returns the run id on success, or `null` if another pod already
 * holds the partial unique index.
 */
async function tryClaimEpoch(
  db: AmoePublisherDb,
  epoch: bigint,
  claimedBy: string,
): Promise<string | null> {
  try {
    const result = await db.sql`
      INSERT INTO amoe_publisher_runs (epoch, phase, claimed_by)
      VALUES (
        ${epoch.toString()}::bigint,
        'projecting',
        ${claimedBy}
      )
      RETURNING id
    `
    const rows = (result.rows ?? []) as Array<{ id: string }>
    return rows[0]?.id ?? null
  } catch (err) {
    if (isUniqueViolation(err)) return null
    throw err
  }
}

async function setPhase(
  db: AmoePublisherDb,
  runId: string,
  phase: PublisherPhase,
): Promise<void> {
  await db.sql`
    UPDATE amoe_publisher_runs
    SET phase = ${phase}
    WHERE id = ${runId}::uuid
  `
}

async function markTerminal(
  db: AmoePublisherDb,
  runId: string,
  phase: 'finished' | 'finished_no_op' | 'errored',
  options: {
    snapshotEpoch?: bigint
    lastError?: string
  } = {},
): Promise<void> {
  await db.sql`
    UPDATE amoe_publisher_runs
    SET phase = ${phase},
        finished_at = NOW(),
        snapshot_epoch = COALESCE(
          ${options.snapshotEpoch?.toString() ?? null}::bigint,
          snapshot_epoch
        ),
        last_error = COALESCE(
          ${options.lastError ?? null},
          last_error
        )
    WHERE id = ${runId}::uuid
  `
}

/**
 * Re-find the in-flight run row for an epoch. Used by the broadcast +
 * confirm phases when a previous tick left the L2 row in state 1 / 2
 * but we want to continue from where we left off.
 */
async function findInFlightRun(
  db: AmoePublisherDb,
  epoch: bigint,
): Promise<PublisherRunRow | null> {
  const result = await db.sql`
    SELECT id, epoch, phase, snapshot_epoch
    FROM amoe_publisher_runs
    WHERE epoch = ${epoch.toString()}::bigint
      AND finished_at IS NULL
    LIMIT 1
  `
  const rows = (result.rows ?? []) as Array<{
    id: string
    epoch: number | string | bigint
    phase: PublisherPhase
    snapshot_epoch: number | string | bigint | null
  }>
  if (rows.length === 0) return null
  const r = rows[0]!
  return {
    id: r.id,
    epoch: BigInt(r.epoch as string | number | bigint),
    phase: r.phase,
    snapshot_epoch:
      r.snapshot_epoch === null ? null : BigInt(r.snapshot_epoch as string | number | bigint),
  }
}

// ----------------------------------------------------------------------------
// L2 inspection helpers (read-only against amoe_points_burn_ledger_snapshots)
// ----------------------------------------------------------------------------

interface SnapshotRow {
  epoch: bigint
  rootHex: string
  publishTxHash: string | null
  publishConfirmedAt: Date | string | null
  leafCount: number
}

async function findSnapshot(
  db: AmoePublisherDb,
  epoch: bigint,
): Promise<SnapshotRow | null> {
  const result = await db.sql`
    SELECT epoch, root_hex, publish_tx_hash, publish_confirmed_at, leaf_count
    FROM amoe_points_burn_ledger_snapshots
    WHERE epoch = ${epoch.toString()}::bigint
    LIMIT 1
  `
  const rows = (result.rows ?? []) as Array<{
    epoch: number | string | bigint
    root_hex: string
    publish_tx_hash: string | null
    publish_confirmed_at: Date | string | null
    leaf_count: number | string | bigint
  }>
  if (rows.length === 0) return null
  const r = rows[0]!
  return {
    epoch: BigInt(r.epoch as string | number | bigint),
    rootHex: r.root_hex,
    publishTxHash: r.publish_tx_hash,
    publishConfirmedAt: r.publish_confirmed_at,
    leafCount: Number(r.leaf_count),
  }
}

async function markSnapshotBroadcast(
  db: AmoePublisherDb,
  epoch: bigint,
  txHash: `0x${string}`,
): Promise<void> {
  await db.sql`
    UPDATE amoe_points_burn_ledger_snapshots
    SET publish_tx_hash = ${txHash}
    WHERE epoch = ${epoch.toString()}::bigint
      AND publish_tx_hash IS NULL
  `
}

async function markSnapshotConfirmed(
  db: AmoePublisherDb,
  epoch: bigint,
  blockNumber: bigint,
): Promise<void> {
  await db.sql`
    UPDATE amoe_points_burn_ledger_snapshots
    SET publish_block_number = ${blockNumber.toString()}::bigint,
        publish_confirmed_at = NOW()
    WHERE epoch = ${epoch.toString()}::bigint
      AND publish_tx_hash IS NOT NULL
      AND publish_confirmed_at IS NULL
  `
}

// ----------------------------------------------------------------------------
// Reclaim
// ----------------------------------------------------------------------------

/**
 * Mark in-flight runs whose `claimed_at` is older than the reclaim age
 * as `errored`. Called at the top of every cron tick before claiming
 * new epochs, so a crashed pod's claim can't permanently stall an
 * epoch.
 *
 * Returns the number of rows reclaimed.
 */
export async function reclaimStrandedPublisherRuns(
  db: AmoePublisherDb,
  options: { reclaimAgeMs?: number } = {},
): Promise<number> {
  const ageSec = Math.floor((options.reclaimAgeMs ?? STRANDED_RUN_RECLAIM_AGE_MS) / 1000)
  const result = await db.sql`
    UPDATE amoe_publisher_runs
    SET phase = 'errored',
        finished_at = NOW(),
        last_error = 'reclaim_stranded'
    WHERE finished_at IS NULL
      AND claimed_at < NOW() - make_interval(secs => ${ageSec})
    RETURNING id
  `
  return (result.rows ?? []).length
}

// ----------------------------------------------------------------------------
// Public: pickNextEpochToPublish (backfill-aware target selection)
// ----------------------------------------------------------------------------

/**
 * Pick the OLDEST unpublished closed epoch within the lookback horizon,
 * or null if every epoch in [latestClosedEpoch - lookback + 1, latestClosedEpoch]
 * already has a confirmed snapshot or a finished_no_op terminal run.
 *
 * Backfill correctness: without this, the cron would always target only
 * `currentEpoch - 1`. If a tick was disabled or errored on an older
 * closed epoch, that epoch would be skipped permanently once time
 * advanced — leaving real submissions without a published root and
 * breaking proof/root consistency. With this, missed epochs get
 * retried until they confirm or fall outside the bounded horizon.
 *
 * Returns the oldest epoch needing publish; the caller still publishes
 * only one per tick (MAX_EPOCHS_PER_TICK), so a backlog drains across
 * successive ticks.
 */
export async function pickNextEpochToPublish(
  db: AmoePublisherDb,
  args: {
    latestClosedEpoch: bigint
    lookbackEpochs?: bigint
  },
): Promise<bigint | null> {
  const lookback = args.lookbackEpochs ?? BACKFILL_LOOKBACK_EPOCHS
  if (args.latestClosedEpoch < 0n) return null
  const horizonStart =
    args.latestClosedEpoch - lookback + 1n < 0n
      ? 0n
      : args.latestClosedEpoch - lookback + 1n

  // Confirmed snapshots — these epochs are DONE.
  const confirmedRes = await db.sql`
    SELECT epoch
    FROM amoe_points_burn_ledger_snapshots
    WHERE epoch >= ${horizonStart.toString()}::bigint
      AND epoch <= ${args.latestClosedEpoch.toString()}::bigint
      AND publish_confirmed_at IS NOT NULL
  `
  // finished_no_op terminal runs — these epochs were intentionally skipped
  // (empty epoch). The publisher's idempotency check would re-no-op them
  // every tick if we treated them as unpublished, so exclude them too.
  const noOpRes = await db.sql`
    SELECT epoch
    FROM amoe_publisher_runs
    WHERE epoch >= ${horizonStart.toString()}::bigint
      AND epoch <= ${args.latestClosedEpoch.toString()}::bigint
      AND phase = 'finished_no_op'
      AND finished_at IS NOT NULL
  `
  const handled = new Set<string>()
  for (const r of (confirmedRes.rows ?? []) as Array<{ epoch: number | string | bigint }>) {
    handled.add(BigInt(r.epoch as string | number | bigint).toString())
  }
  for (const r of (noOpRes.rows ?? []) as Array<{ epoch: number | string | bigint }>) {
    handled.add(BigInt(r.epoch as string | number | bigint).toString())
  }

  // Walk from oldest to newest within the horizon and return the first
  // unhandled. Cheap because lookback is bounded (<= 14 by default).
  for (let e = horizonStart; e <= args.latestClosedEpoch; e += 1n) {
    if (!handled.has(e.toString())) {
      return e
    }
  }
  return null
}

// ----------------------------------------------------------------------------
// Public: publishEpoch
// ----------------------------------------------------------------------------

/**
 * Run the full publish pipeline for a single epoch. Idempotent: if the
 * epoch's L2 row is already at state 2 (broadcast) or state 3
 * (confirmed), the function picks up where the previous tick left off
 * instead of re-projecting / re-building / re-broadcasting.
 *
 * Returns a {@link PublishEpochOutcome} describing what was done. The
 * caller (cron handler) translates outcomes to log lines / metrics.
 */
export async function publishEpoch(
  args: PublishEpochArgs,
): Promise<PublishEpochOutcome> {
  const { db, epoch, claimedBy } = args

  // ------------------------------------------------------------------
  // Step 0: short-circuit if the snapshot is already confirmed.
  // ------------------------------------------------------------------
  const existingSnapshot = await findSnapshot(db, epoch)
  if (existingSnapshot && existingSnapshot.publishConfirmedAt !== null) {
    // Nothing to do — another pod (or a previous tick) already finished
    // this epoch. Find any in-flight run we may have inherited (from a
    // crash mid-confirm) and mark it terminal so the lock releases.
    const inherited = await findInFlightRun(db, epoch)
    if (inherited) {
      await markTerminal(db, inherited.id, 'finished', { snapshotEpoch: epoch })
    }
    return {
      kind: 'finished',
      epoch,
      rootHex: existingSnapshot.rootHex as `0x${string}`,
      txHash: (existingSnapshot.publishTxHash ?? '0x0') as `0x${string}`,
    }
  }

  // ------------------------------------------------------------------
  // Step 1: claim the epoch (or re-attach to an existing in-flight run).
  // ------------------------------------------------------------------
  let runId: string
  let resumePhase: PublisherPhase = 'projecting'

  const inherited = await findInFlightRun(db, epoch)
  if (inherited) {
    // Same pod (or a crash-recovered run) is resuming. We do NOT try to
    // re-claim — the partial unique index is already held. Continue
    // from the recorded phase.
    runId = inherited.id
    resumePhase = inherited.phase
  } else {
    const claimed = await tryClaimEpoch(db, epoch, claimedBy)
    if (claimed === null) {
      // Another pod won the race this tick. Skip; we'll see them next time.
      return { kind: 'lost_claim', epoch }
    }
    runId = claimed
  }

  try {
    // ----------------------------------------------------------------
    // Phase 1: projecting (L0 → L1) — only if not already past it.
    // ----------------------------------------------------------------
    if (resumePhase === 'projecting') {
      await setPhase(db, runId, 'projecting')
      let afterId: bigint | undefined
      let iterations = 0
      let projectorDrained = false
      let lastProjectScanned = 0
      while (iterations < MAX_PROJECTOR_ITERATIONS) {
        iterations += 1
        const projectArgs: Parameters<typeof projectAmoeBurnsToLedger>[0] = {
          db: db as AmoeProjectorDb,
          epoch,
          publisherRunId: runId,
          lookupBurnContext: args.lookupBurnContext,
          batchSize: 500,
        }
        if (afterId !== undefined) projectArgs.afterId = afterId
        const projectResult: ProjectAmoeBurnsToLedgerResult =
          await projectAmoeBurnsToLedger(projectArgs)
        lastProjectScanned = projectResult.scanned
        if (
          projectResult.scanned === 0 ||
          projectResult.lastScannedId === null
        ) {
          projectorDrained = true
          break
        }
        afterId = projectResult.lastScannedId
        // If everything in this batch was already-present, the cursor
        // moved forward and we either advance into permanently-skipped
        // territory or the next iteration sees scanned === 0.
        if (
          projectResult.projected === 0 &&
          projectResult.skippedMissingContext === 0 &&
          projectResult.alreadyPresent === projectResult.scanned
        ) {
          // No new work this batch; the next-iteration anti-join will
          // be empty when we've caught up.
          continue
        }
      }
      // CORRECTNESS: if we hit the iteration cap with the last batch
      // still returning rows, more burns remain unprojected. Falling
      // through to build/broadcast would publish a root computed from
      // a partial L1 — corrupting epoch completeness and breaking
      // proof/root consistency for any user whose burn was in the
      // dropped tail. Error the run; the next tick will re-claim and
      // resume from `projecting`. (Re-entry is safe: the projector's
      // anti-join on `amoe_points_burn_ledger.source_points_id` and
      // its `afterId` cursor make re-projection idempotent.)
      if (!projectorDrained && lastProjectScanned > 0) {
        const errMsg =
          `projector_cap_exceeded epoch=${epoch.toString()} ` +
          `iterations=${iterations.toString()} ` +
          `lastBatchScanned=${lastProjectScanned.toString()}`
        await markTerminal(db, runId, 'errored', { lastError: errMsg })
        return {
          kind: 'errored',
          epoch,
          phase: 'projecting',
          message: errMsg,
        }
      }
      resumePhase = 'building'
      await setPhase(db, runId, 'building')
    }

    // ----------------------------------------------------------------
    // Phase 2: building (L1 → L2 state 1) — only if no L2 row yet.
    // ----------------------------------------------------------------
    let snapshot: BuildAmoeLedgerSnapshotResult | null = null
    let snapshotRoot: `0x${string}` | null = null

    const snapshotAfterProject = await findSnapshot(db, epoch)
    if (snapshotAfterProject) {
      // Already built (this tick's resume, or a previous tick's build
      // crashed before we updated the run row). Use the existing root.
      snapshotRoot = snapshotAfterProject.rootHex as `0x${string}`
    } else {
      if (resumePhase === 'building') {
        await setPhase(db, runId, 'building')
        snapshot = await buildAmoeLedgerSnapshot({
          db,
          epoch,
          publisherRunId: runId,
          publisherVersion: args.publisherVersion,
        })
        snapshotRoot = snapshot.rootHex as `0x${string}`
      }
    }
    if (snapshotRoot === null) {
      // We resumed past 'building' but there is no L2 row. This is an
      // inconsistent state; surface as errored so the next tick can
      // start fresh.
      throw new Error('amoe_publisher_invalid_state_no_snapshot')
    }

    // ----------------------------------------------------------------
    // Empty-epoch handling.
    // ----------------------------------------------------------------
    const ZERO_ROOT_HEX =
      ('0x' + '00'.repeat(32)) as `0x${string}`
    if (snapshotRoot.toLowerCase() === ZERO_ROOT_HEX) {
      await markTerminal(db, runId, 'finished_no_op', {
        snapshotEpoch: epoch,
        lastError: 'empty_epoch',
      })
      return { kind: 'finished_no_op', epoch, reason: 'empty_epoch' }
    }

    // ----------------------------------------------------------------
    // Phase 3: broadcasting (L2 state 1 → state 2) — only if no tx yet.
    // ----------------------------------------------------------------
    const liveSnapshot = await findSnapshot(db, epoch)
    if (!liveSnapshot) {
      throw new Error('amoe_publisher_invalid_state_post_build')
    }
    let txHash: `0x${string}`
    if (liveSnapshot.publishTxHash === null) {
      await setPhase(db, runId, 'broadcasting')
      const broadcastResult = await args.broadcast({
        lotteryAmoeRouter: args.lotteryAmoeRouter,
        epoch,
        rootHex: snapshotRoot,
      })
      txHash = broadcastResult.txHash
      await markSnapshotBroadcast(db, epoch, txHash)
    } else {
      txHash = liveSnapshot.publishTxHash as `0x${string}`
    }

    // ----------------------------------------------------------------
    // Phase 4: confirming (L2 state 2 → state 3).
    // ----------------------------------------------------------------
    await setPhase(db, runId, 'confirming')
    const receipt = await args.confirm({
      txHash,
      timeoutMs: RECEIPT_WAIT_TIMEOUT_MS,
    })
    if (receipt === null) {
      // Timed out this tick — leave the run in 'confirming', the next
      // tick will re-poll. We do NOT mark finished_at; the partial
      // unique index keeps the lock held.
      return { kind: 'in_flight', epoch, phase: 'confirming' }
    }
    await markSnapshotConfirmed(db, epoch, receipt.blockNumber)
    await markTerminal(db, runId, 'finished', { snapshotEpoch: epoch })
    return { kind: 'finished', epoch, rootHex: snapshotRoot, txHash }
  } catch (err) {
    const message =
      err instanceof Error ? err.message.slice(0, 500) : 'unknown_error'
    // Best-effort: mark the run errored so the lock releases. Swallow
    // any secondary error — we want to surface the original failure.
    try {
      await markTerminal(db, runId, 'errored', { lastError: message })
    } catch (markErr) {
      console.warn('[amoe-publisher] failed to mark run errored', markErr)
    }
    if (err instanceof AmoeServerError) throw err
    throw err instanceof Error ? err : new Error(message)
  }
}

// ----------------------------------------------------------------------------
// Production wrappers (signer + viem)
// ----------------------------------------------------------------------------

/**
 * Read the publisher EOA private key. Returns `null` if unset or
 * malformed.
 */
export function readAmoeLedgerPublisherPrivateKey(): `0x${string}` | null {
  const raw = String(process.env.AMOE_LEDGER_PUBLISHER_PRIVATE_KEY ?? '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(raw)) return null
  return raw as `0x${string}`
}

export function readAmoeLedgerPublisherPrivyWalletId(): string | null {
  const raw = String(process.env.AMOE_LEDGER_PUBLISHER_PRIVY_WALLET_ID ?? '').trim()
  return raw.length > 0 ? raw : null
}

export function readAmoeLedgerPublisherOwnerAddress(): `0x${string}` | null {
  const raw = String(process.env.AMOE_LEDGER_PUBLISHER_OWNER_ADDRESS ?? '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw as `0x${string}`
}

export function readAmoeLedgerPublisherSmartWallet(): `0x${string}` | null {
  const raw = String(
    process.env.AMOE_LEDGER_PUBLISHER_SMART_WALLET ?? '',
  ).trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw as `0x${string}`
}

export function readAmoeLedgerPublisherBundlerUrl(): string | null {
  const raw = String(process.env.AMOE_LEDGER_PUBLISHER_BUNDLER_URL ?? '').trim()
  return /^https?:\/\//i.test(raw) ? raw : null
}

export function readBaseRpcUrlForPublisher(): string {
  const raw = String(
    process.env.AMOE_LEDGER_PUBLISHER_BASE_RPC ?? process.env.BASE_RPC_URL ?? '',
  ).trim()
  return raw.length > 0 ? raw : 'https://mainnet.base.org'
}

/** Whether the publisher cron is enabled. Defaults to false. */
export function isAmoeLedgerPublisherEnabled(): boolean {
  return String(process.env.AMOE_LEDGER_PUBLISHER_ENABLED ?? '').trim() === '1'
}

/** Pod identifier stamped on `claimed_by`. */
export function readPublisherClaimedBy(): string {
  const explicit = String(process.env.AMOE_LEDGER_PUBLISHER_POD_ID ?? '').trim()
  if (explicit.length > 0) return explicit.slice(0, 200)
  // Fall back to hostname (Vercel sets `VERCEL_REGION`-derived names);
  // truncate to fit the audit column cleanly.
  try {
    return `vercel-${osHostname()}`.slice(0, 200)
  } catch {
    return 'vercel-unknown'
  }
}

/**
 * The bytes32-encoded selector for `setPointsLedgerRoot(uint64,bytes32)`.
 * Wrapped in a tiny ABI fragment for `encodeFunctionData` consumption.
 *
 * Deliberately scoped to this module — the publisher is the only
 * code-path that should ever call this function. The router enforces
 * `msg.sender == pointsLedgerPublisher` so encoding from elsewhere
 * would just revert.
 */
const SET_POINTS_LEDGER_ROOT_ABI = [
  {
    type: 'function',
    name: 'setPointsLedgerRoot',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'epoch', type: 'uint64' },
      { name: 'root', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

/**
 * Default broadcaster — encodes the calldata and submits via the
 * configured signer (EOA or Privy CSW). Refuses to fall back to the
 * relay key (different on-chain role).
 *
 * @throws Error('no_publisher_key_configured') when no signer is set;
 *         the cron handler catches this and returns a 200 no-op.
 */
export async function defaultBroadcastSetPointsLedgerRoot(args: {
  lotteryAmoeRouter: `0x${string}`
  epoch: bigint
  rootHex: `0x${string}`
}): Promise<{ txHash: `0x${string}` }> {
  const [{ createPublicClient, createWalletClient, encodeFunctionData, getAddress, http }, { base }, { privateKeyToAccount }] =
    await Promise.all([
      import('viem'),
      import('viem/chains'),
      import('viem/accounts'),
    ])

  const callData = encodeFunctionData({
    abi: SET_POINTS_LEDGER_ROOT_ABI,
    functionName: 'setPointsLedgerRoot',
    args: [args.epoch, args.rootHex],
  })

  const publicClient = createPublicClient({
    chain: base,
    transport: http(readBaseRpcUrlForPublisher(), { timeout: 30_000 }),
  })

  // Priority 2: Privy CSW.
  const smartWallet = readAmoeLedgerPublisherSmartWallet()
  const bundlerUrl = readAmoeLedgerPublisherBundlerUrl()
  const privyWalletId = readAmoeLedgerPublisherPrivyWalletId()
  const expectedOwnerAddress = readAmoeLedgerPublisherOwnerAddress()
  if (smartWallet && bundlerUrl && privyWalletId && expectedOwnerAddress) {
    const {
      resolvePrivyCoinbaseSmartWalletOwnerContext,
      sendPrivyCoinbaseSmartWalletUserOperation,
    } = await import('../wallet/privyCoinbaseSmartWallet.js')
    const ownerContext = await resolvePrivyCoinbaseSmartWalletOwnerContext({
      publicClient,
      walletId: privyWalletId,
      smartWallet,
      expectedOwnerAddress,
      maxScan: 512,
    })
    const userOpResult = await sendPrivyCoinbaseSmartWalletUserOperation({
      publicClient,
      bundlerUrl,
      walletId: privyWalletId,
      smartWallet,
      ownerAddress: ownerContext.ownerAddress,
      ownerIndex: ownerContext.ownerIndex,
      calls: [{ to: args.lotteryAmoeRouter, value: 0n, data: callData }],
      simulate: false,
    })
    return { txHash: userOpResult.txHash }
  }

  // Priority 1: direct EOA. We deliberately check this AFTER Privy
  // so an operator who configured both can make the CSW path the
  // explicit default. (The locked invariant is: never fall back to
  // AMOE_RELAY_PRIVATE_KEY — both branches here use the dedicated
  // publisher key.)
  const directPk = readAmoeLedgerPublisherPrivateKey()
  if (directPk) {
    const wallet = createWalletClient({
      account: privateKeyToAccount(directPk),
      chain: base,
      transport: http(readBaseRpcUrlForPublisher(), { timeout: 30_000 }),
    })
    // `getAddress` is imported to avoid a viem tree-shaking surprise;
    // referencing it keeps the import live for downstream typecheck.
    void getAddress
    const hash = await wallet.sendTransaction({
      chain: base,
      to: args.lotteryAmoeRouter,
      data: callData,
      value: 0n,
    })
    return { txHash: hash }
  }

  throw new Error('no_publisher_key_configured')
}

/**
 * Default receipt confirmer — wraps viem's `waitForTransactionReceipt`,
 * returns null on timeout (publisher leaves the run in 'confirming'
 * for the next tick to re-poll).
 */
export async function defaultConfirmTransactionReceipt(args: {
  txHash: `0x${string}`
  timeoutMs: number
}): Promise<{ blockNumber: bigint } | null> {
  const [{ createPublicClient, http }, { base }] = await Promise.all([
    import('viem'),
    import('viem/chains'),
  ])
  const publicClient = createPublicClient({
    chain: base,
    transport: http(readBaseRpcUrlForPublisher(), { timeout: 30_000 }),
  })
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: args.txHash,
      confirmations: 1,
      timeout: args.timeoutMs,
    })
    if (receipt.status !== 'success') {
      throw new Error(
        `amoe_publisher_tx_reverted ${args.txHash} status=${receipt.status}`,
      )
    }
    return { blockNumber: BigInt(receipt.blockNumber) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // viem throws a `WaitForTransactionReceiptTimeoutError` on timeout;
    // we map all timeout-shaped errors to null (in-flight). All other
    // errors propagate so the caller marks the run errored.
    if (/timed?\s*out|timeout|Timed out/i.test(msg)) return null
    throw err
  }
}

/**
 * Default `lookupBurnContext` — joins against `amoe_zk_submissions` to
 * resolve `(wallet_address, twitter_credit_nullifier_hex)` for a given
 * `(signupId, spendRefId)`. Returns `null` when no matching submission
 * exists (the projector skips that L0 row).
 *
 * The submission MUST have `nullifier_hex IS NOT NULL` — that is, the
 * proof has been generated. Burns whose proof never made it to the
 * submission table are orphaned and will be skipped permanently; this
 * is intentional — they have no on-chain identity to bind to.
 */
export async function defaultLookupBurnContext(
  db: AmoePublisherDb,
  args: AmoeBurnContextLookupArgs,
): Promise<AmoeBurnContext | null> {
  const result = await db.sql`
    SELECT wallet_address, twitter_credit_nullifier_hex
    FROM amoe_zk_submissions
    WHERE signup_id = ${args.signupId.toString()}::bigint
      AND spend_ref_id = ${args.spendRefId}
      AND twitter_credit_nullifier_hex IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 1
  `
  const rows = (result.rows ?? []) as Array<{
    wallet_address: string
    twitter_credit_nullifier_hex: string
  }>
  if (rows.length === 0) return null
  const r = rows[0]!
  return {
    walletAddress: r.wallet_address,
    twitterCreditNullifierHex: r.twitter_credit_nullifier_hex,
  }
}

// ----------------------------------------------------------------------------
// Db acquisition (matches replayStore convention)
// ----------------------------------------------------------------------------

export async function requirePublisherDb(): Promise<AmoePublisherDb> {
  const db = await getDb()
  if (!db) {
    throw new AmoeServerError('amoe_db_unavailable')
  }
  return db as unknown as AmoePublisherDb
}
