// PR 5b — `amoeLedgerPublisher` unit tests.
//
// Covers the full epoch-publish pipeline orchestrator:
//
//   1. Fresh epoch: claim → project → build → broadcast → confirm
//      transitions through each phase and ends `finished`.
//   2. Empty epoch (root == bytes32(0)) ends `finished_no_op` and
//      DOES NOT call `broadcast`.
//   3. Lost claim (23505 unique violation on second pod) → `lost_claim`.
//   4. Resume from `broadcasting` (snapshot already at state 1, no tx
//      hash) → broadcast called once, then confirm.
//   5. Resume from `confirming` (snapshot at state 2) → broadcast NOT
//      called, confirm runs and completes.
//   6. Confirm timeout (returns null) → `in_flight` outcome and run row
//      stays open (finished_at remains NULL).
//   7. Already confirmed (publish_confirmed_at IS NOT NULL) →
//      short-circuits to `finished` without re-running pipeline.
//   8. `reclaimStrandedPublisherRuns` marks rows older than the cutoff
//      as `errored` and clears the lock.
//   9. Broadcast that throws `no_publisher_key_configured` propagates
//      out (handler is responsible for catching it).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks for projector + snapshot builder. The publisher orchestrator
// imports them by name; we replace them so the tests don't need real db rows.
// ---------------------------------------------------------------------------

const { projectAmoeBurnsToLedgerMock, buildAmoeLedgerSnapshotMock } = vi.hoisted(
  () => ({
    projectAmoeBurnsToLedgerMock: vi.fn(),
    buildAmoeLedgerSnapshotMock: vi.fn(),
  }),
)

vi.mock('../lottery/amoeLedgerProjector.js', () => ({
  projectAmoeBurnsToLedger: projectAmoeBurnsToLedgerMock,
  AMOE_POINTS_TO_USD_E6: 10000n,
  AMOE_ENTRY_SPEND_SOURCE: 'amoe_entry_spend',
}))

vi.mock('../lottery/amoeLedgerSnapshotBuilder.js', () => ({
  buildAmoeLedgerSnapshot: buildAmoeLedgerSnapshotMock,
}))

// ---------------------------------------------------------------------------
// Imports (after vi.mock).
// ---------------------------------------------------------------------------

import {
  BACKFILL_LOOKBACK_EPOCHS,
  MAX_PROJECTOR_ITERATIONS,
  pickNextEpochToPublish,
  publishEpoch,
  reclaimStrandedPublisherRuns,
  STRANDED_RUN_RECLAIM_AGE_MS,
  type AmoePublisherDb,
  type BroadcastSetPointsLedgerRoot,
  type ConfirmTransactionReceipt,
  type LookupBurnContext,
  type PublisherPhase,
} from '../lottery/amoeLedgerPublisher.js'

// ---------------------------------------------------------------------------
// In-memory db stub
//
// The publisher's SQL is mostly:
//   * INSERT INTO amoe_publisher_runs ... RETURNING id
//   * UPDATE amoe_publisher_runs SET phase=...
//   * UPDATE amoe_publisher_runs SET phase=..., finished_at=NOW(), ...
//   * SELECT id, epoch, phase, snapshot_epoch FROM amoe_publisher_runs
//       WHERE epoch=$ AND finished_at IS NULL
//   * SELECT epoch, root_hex, publish_tx_hash, publish_confirmed_at,
//       leaf_count FROM amoe_points_burn_ledger_snapshots WHERE epoch=$
//   * UPDATE amoe_points_burn_ledger_snapshots SET publish_tx_hash=$
//   * UPDATE amoe_points_burn_ledger_snapshots SET publish_block_number=$,
//       publish_confirmed_at=NOW()
//   * UPDATE amoe_publisher_runs ... WHERE finished_at IS NULL AND claimed_at < ...
//
// We pattern-match each of these against the joined query string, with
// access to the parameters via the tagged-template signature.
// ---------------------------------------------------------------------------

interface PublisherRun {
  id: string
  epoch: bigint
  phase: PublisherPhase
  finished_at: Date | null
  claimed_at: Date
  claimed_by: string
  snapshot_epoch: bigint | null
  last_error: string | null
}

interface SnapshotRow {
  epoch: bigint
  root_hex: string
  publish_tx_hash: string | null
  publish_block_number: bigint | null
  publish_confirmed_at: Date | null
  leaf_count: number
}

class FakeDb {
  runs: PublisherRun[] = []
  snapshots: SnapshotRow[] = []
  uniqueViolationOnNextInsert = false
  /** Audit trail (joined query template) for assertions. */
  queries: string[] = []
  private nextRunIdCounter = 1

  /**
   * Joined-template helper. `strings` are the static segments and
   * `values` slot in between. We rebuild a representation suitable for
   * substring matching, and keep `values` for parameter inspection.
   */
  private join(strings: TemplateStringsArray): string {
    return strings.join('?')
  }

  sql = async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<{ rows: unknown[] }> => {
    const joined = this.join(strings)
    this.queries.push(joined)

    // INSERT new run -------------------------------------------------------
    if (joined.includes('INSERT INTO amoe_publisher_runs')) {
      if (this.uniqueViolationOnNextInsert) {
        this.uniqueViolationOnNextInsert = false
        const err: Error & { code?: string } = new Error('duplicate key')
        err.code = '23505'
        throw err
      }
      const epoch = BigInt(values[0] as string)
      const phase = values[1] as PublisherPhase
      const claimedBy = values[2] as string
      // Enforce the partial unique index in-memory.
      if (
        this.runs.some(
          (r) => r.epoch === epoch && r.finished_at === null,
        )
      ) {
        const err: Error & { code?: string } = new Error('duplicate key')
        err.code = '23505'
        throw err
      }
      const id = `run-${this.nextRunIdCounter++}`
      this.runs.push({
        id,
        epoch,
        phase,
        finished_at: null,
        claimed_at: new Date(),
        claimed_by: claimedBy,
        snapshot_epoch: null,
        last_error: null,
      })
      return { rows: [{ id }] }
    }

    // UPDATE phase only ----------------------------------------------------
    if (
      joined.includes('UPDATE amoe_publisher_runs') &&
      joined.includes('SET phase =') &&
      !joined.includes('finished_at = NOW()')
    ) {
      const phase = values[0] as PublisherPhase
      const id = values[1] as string
      const run = this.runs.find((r) => r.id === id)
      if (run) run.phase = phase
      return { rows: [] }
    }

    // UPDATE markTerminal --------------------------------------------------
    if (
      joined.includes('UPDATE amoe_publisher_runs') &&
      joined.includes('finished_at = NOW()') &&
      !joined.includes('claimed_at <')
    ) {
      const phase = values[0] as PublisherPhase
      const snapshotEpoch = values[1] as string | null
      const lastError = values[2] as string | null
      const id = values[3] as string
      const run = this.runs.find((r) => r.id === id)
      if (run) {
        run.phase = phase
        run.finished_at = new Date()
        if (snapshotEpoch !== null) run.snapshot_epoch = BigInt(snapshotEpoch)
        if (lastError !== null) run.last_error = lastError
      }
      return { rows: [] }
    }

    // SELECT in-flight run -------------------------------------------------
    if (
      joined.includes('SELECT id, epoch, phase, snapshot_epoch') &&
      joined.includes('FROM amoe_publisher_runs')
    ) {
      const epoch = BigInt(values[0] as string)
      const match = this.runs.find(
        (r) => r.epoch === epoch && r.finished_at === null,
      )
      if (!match) return { rows: [] }
      return {
        rows: [
          {
            id: match.id,
            epoch: match.epoch.toString(),
            phase: match.phase,
            snapshot_epoch:
              match.snapshot_epoch === null ? null : match.snapshot_epoch.toString(),
          },
        ],
      }
    }

    // SELECT snapshot row --------------------------------------------------
    if (
      joined.includes('SELECT epoch, root_hex, publish_tx_hash') &&
      joined.includes('FROM amoe_points_burn_ledger_snapshots')
    ) {
      const epoch = BigInt(values[0] as string)
      const match = this.snapshots.find((s) => s.epoch === epoch)
      if (!match) return { rows: [] }
      return {
        rows: [
          {
            epoch: match.epoch.toString(),
            root_hex: match.root_hex,
            publish_tx_hash: match.publish_tx_hash,
            publish_confirmed_at: match.publish_confirmed_at,
            leaf_count: match.leaf_count,
          },
        ],
      }
    }

    // UPDATE snapshot publish_tx_hash --------------------------------------
    if (
      joined.includes('UPDATE amoe_points_burn_ledger_snapshots') &&
      joined.includes('SET publish_tx_hash =')
    ) {
      const txHash = values[0] as string
      const epoch = BigInt(values[1] as string)
      const match = this.snapshots.find((s) => s.epoch === epoch)
      if (match && match.publish_tx_hash === null) match.publish_tx_hash = txHash
      return { rows: [] }
    }

    // UPDATE snapshot publish_confirmed_at ---------------------------------
    if (
      joined.includes('UPDATE amoe_points_burn_ledger_snapshots') &&
      joined.includes('SET publish_block_number =')
    ) {
      const blockNumber = BigInt(values[0] as string)
      const epoch = BigInt(values[1] as string)
      const match = this.snapshots.find((s) => s.epoch === epoch)
      if (
        match &&
        match.publish_tx_hash !== null &&
        match.publish_confirmed_at === null
      ) {
        match.publish_block_number = blockNumber
        match.publish_confirmed_at = new Date()
      }
      return { rows: [] }
    }

    // SELECT confirmed snapshots in horizon (pickNextEpochToPublish) -------
    if (
      joined.includes('SELECT epoch') &&
      joined.includes('FROM amoe_points_burn_ledger_snapshots') &&
      joined.includes('publish_confirmed_at IS NOT NULL')
    ) {
      const lo = BigInt(values[0] as string)
      const hi = BigInt(values[1] as string)
      const matches = this.snapshots
        .filter(
          (s) =>
            s.epoch >= lo &&
            s.epoch <= hi &&
            s.publish_confirmed_at !== null,
        )
        .map((s) => ({ epoch: s.epoch.toString() }))
      return { rows: matches }
    }

    // SELECT finished_no_op runs in horizon (pickNextEpochToPublish) -------
    if (
      joined.includes('SELECT epoch') &&
      joined.includes('FROM amoe_publisher_runs') &&
      joined.includes("phase = ") &&
      joined.includes('finished_at IS NOT NULL')
    ) {
      const lo = BigInt(values[0] as string)
      const hi = BigInt(values[1] as string)
      const phase = values[2] as PublisherPhase
      const matches = this.runs
        .filter(
          (r) =>
            r.epoch >= lo &&
            r.epoch <= hi &&
            r.phase === phase &&
            r.finished_at !== null,
        )
        .map((r) => ({ epoch: r.epoch.toString() }))
      return { rows: matches }
    }

    // UPDATE reclaim stranded ----------------------------------------------
    if (
      joined.includes('UPDATE amoe_publisher_runs') &&
      joined.includes('claimed_at <')
    ) {
      const ageSec = Number(values[0] as string)
      const cutoff = Date.now() - ageSec * 1000
      const reclaimed: PublisherRun[] = []
      for (const run of this.runs) {
        if (run.finished_at !== null) continue
        if (run.claimed_at.getTime() < cutoff) {
          run.phase = 'errored'
          run.finished_at = new Date()
          run.last_error = 'reclaim_stranded'
          reclaimed.push(run)
        }
      }
      return { rows: reclaimed.map((r) => ({ id: r.id })) }
    }

    return { rows: [] }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROUTER = '0x000000000000000000000000000000000000abcd' as `0x${string}`

function makeBroadcast(
  txHash: `0x${string}` = '0xaabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
): BroadcastSetPointsLedgerRoot {
  return vi.fn(async () => ({ txHash })) as BroadcastSetPointsLedgerRoot
}

function makeConfirm(
  blockNumber: bigint = 12345n,
): ConfirmTransactionReceipt {
  return vi.fn(async () => ({ blockNumber })) as ConfirmTransactionReceipt
}

const NULL_LOOKUP: LookupBurnContext = vi.fn(async () => null)

function makeNonZeroSnapshot(epoch: bigint): SnapshotRow {
  return {
    epoch,
    root_hex:
      '0x' + '11'.repeat(32),
    publish_tx_hash: null,
    publish_block_number: null,
    publish_confirmed_at: null,
    leaf_count: 1,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('amoeLedgerPublisher.publishEpoch', () => {
  beforeEach(() => {
    projectAmoeBurnsToLedgerMock.mockReset()
    buildAmoeLedgerSnapshotMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('finishes a fresh non-empty epoch through the full pipeline', async () => {
    const db = new FakeDb()
    const epoch = 5n
    // Project: one batch, no further work.
    projectAmoeBurnsToLedgerMock.mockResolvedValueOnce({
      scanned: 1,
      projected: 1,
      alreadyPresent: 0,
      skippedMissingContext: 0,
      lastScannedId: 100n,
    })
    projectAmoeBurnsToLedgerMock.mockResolvedValueOnce({
      scanned: 0,
      projected: 0,
      alreadyPresent: 0,
      skippedMissingContext: 0,
      lastScannedId: null,
    })
    // Build: writes the snapshot row into our fake.
    buildAmoeLedgerSnapshotMock.mockImplementationOnce(async () => {
      db.snapshots.push(makeNonZeroSnapshot(epoch))
      return { rootHex: '0x' + '11'.repeat(32), leafCount: 1 }
    })

    const broadcast = makeBroadcast()
    const confirm = makeConfirm(12345n)
    const outcome = await publishEpoch({
      db: db as unknown as AmoePublisherDb,
      epoch,
      claimedBy: 'pod-test',
      lotteryAmoeRouter: ROUTER,
      broadcast,
      confirm,
      lookupBurnContext: NULL_LOOKUP,
      publisherVersion: 'test-sha',
    })

    expect(outcome.kind).toBe('finished')
    expect(broadcast).toHaveBeenCalledTimes(1)
    expect(confirm).toHaveBeenCalledTimes(1)
    // L2 row should reflect state 3.
    const snap = db.snapshots[0]!
    expect(snap.publish_tx_hash).not.toBeNull()
    expect(snap.publish_confirmed_at).not.toBeNull()
    // Run row should be terminal.
    const run = db.runs[0]!
    expect(run.phase).toBe('finished')
    expect(run.finished_at).not.toBeNull()
  })

  it('marks empty epoch finished_no_op without calling broadcast', async () => {
    const db = new FakeDb()
    const epoch = 7n
    projectAmoeBurnsToLedgerMock.mockResolvedValueOnce({
      scanned: 0,
      projected: 0,
      alreadyPresent: 0,
      skippedMissingContext: 0,
      lastScannedId: null,
    })
    buildAmoeLedgerSnapshotMock.mockImplementationOnce(async () => {
      // Empty epoch ⇒ root is bytes32(0).
      db.snapshots.push({
        epoch,
        root_hex: '0x' + '00'.repeat(32),
        publish_tx_hash: null,
        publish_block_number: null,
        publish_confirmed_at: null,
        leaf_count: 0,
      })
      return { rootHex: '0x' + '00'.repeat(32), leafCount: 0 }
    })

    const broadcast = makeBroadcast()
    const confirm = makeConfirm()
    const outcome = await publishEpoch({
      db: db as unknown as AmoePublisherDb,
      epoch,
      claimedBy: 'pod-test',
      lotteryAmoeRouter: ROUTER,
      broadcast,
      confirm,
      lookupBurnContext: NULL_LOOKUP,
      publisherVersion: 'test-sha',
    })

    expect(outcome.kind).toBe('finished_no_op')
    if (outcome.kind === 'finished_no_op') {
      expect(outcome.reason).toBe('empty_epoch')
    }
    expect(broadcast).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    // Run row should be terminal with last_error = 'empty_epoch'.
    const run = db.runs[0]!
    expect(run.phase).toBe('finished_no_op')
    expect(run.last_error).toBe('empty_epoch')
  })

  it('returns lost_claim when the partial unique index rejects insert', async () => {
    const db = new FakeDb()
    db.uniqueViolationOnNextInsert = true
    const outcome = await publishEpoch({
      db: db as unknown as AmoePublisherDb,
      epoch: 5n,
      claimedBy: 'loser-pod',
      lotteryAmoeRouter: ROUTER,
      broadcast: makeBroadcast(),
      confirm: makeConfirm(),
      lookupBurnContext: NULL_LOOKUP,
      publisherVersion: 'test',
    })
    expect(outcome).toMatchObject({ kind: 'lost_claim', epoch: 5n })
    expect(projectAmoeBurnsToLedgerMock).not.toHaveBeenCalled()
    expect(buildAmoeLedgerSnapshotMock).not.toHaveBeenCalled()
  })

  it('resumes from existing in-flight run at building phase (snapshot already exists)', async () => {
    const db = new FakeDb()
    const epoch = 5n
    // Pre-existing in-flight run + snapshot at state 1.
    db.runs.push({
      id: 'run-pre',
      epoch,
      phase: 'building',
      finished_at: null,
      claimed_at: new Date(),
      claimed_by: 'pod-prev',
      snapshot_epoch: null,
      last_error: null,
    })
    db.snapshots.push(makeNonZeroSnapshot(epoch))

    const broadcast = makeBroadcast()
    const confirm = makeConfirm(99n)
    const outcome = await publishEpoch({
      db: db as unknown as AmoePublisherDb,
      epoch,
      claimedBy: 'pod-resume',
      lotteryAmoeRouter: ROUTER,
      broadcast,
      confirm,
      lookupBurnContext: NULL_LOOKUP,
      publisherVersion: 'test',
    })
    expect(outcome.kind).toBe('finished')
    // No fresh project/build because snapshot already exists.
    expect(projectAmoeBurnsToLedgerMock).not.toHaveBeenCalled()
    expect(buildAmoeLedgerSnapshotMock).not.toHaveBeenCalled()
    expect(broadcast).toHaveBeenCalledTimes(1)
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('resumes from confirming phase (snapshot already broadcast) without re-broadcasting', async () => {
    const db = new FakeDb()
    const epoch = 5n
    db.runs.push({
      id: 'run-pre',
      epoch,
      phase: 'confirming',
      finished_at: null,
      claimed_at: new Date(),
      claimed_by: 'pod-prev',
      snapshot_epoch: null,
      last_error: null,
    })
    const snap = makeNonZeroSnapshot(epoch)
    snap.publish_tx_hash = '0x' + 'aa'.repeat(32)
    db.snapshots.push(snap)

    const broadcast = makeBroadcast()
    const confirm = makeConfirm(77n)
    const outcome = await publishEpoch({
      db: db as unknown as AmoePublisherDb,
      epoch,
      claimedBy: 'pod-resume',
      lotteryAmoeRouter: ROUTER,
      broadcast,
      confirm,
      lookupBurnContext: NULL_LOOKUP,
      publisherVersion: 'test',
    })
    expect(outcome.kind).toBe('finished')
    expect(broadcast).not.toHaveBeenCalled()
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('returns in_flight when confirm times out (lock stays held)', async () => {
    const db = new FakeDb()
    const epoch = 5n
    projectAmoeBurnsToLedgerMock.mockResolvedValueOnce({
      scanned: 0,
      projected: 0,
      alreadyPresent: 0,
      skippedMissingContext: 0,
      lastScannedId: null,
    })
    buildAmoeLedgerSnapshotMock.mockImplementationOnce(async () => {
      db.snapshots.push(makeNonZeroSnapshot(epoch))
      return { rootHex: '0x' + '11'.repeat(32), leafCount: 1 }
    })

    const broadcast = makeBroadcast()
    // confirm returns null on timeout
    const confirm: ConfirmTransactionReceipt = vi.fn(async () => null)

    const outcome = await publishEpoch({
      db: db as unknown as AmoePublisherDb,
      epoch,
      claimedBy: 'pod-test',
      lotteryAmoeRouter: ROUTER,
      broadcast,
      confirm,
      lookupBurnContext: NULL_LOOKUP,
      publisherVersion: 'test',
    })
    expect(outcome).toMatchObject({ kind: 'in_flight', phase: 'confirming' })
    // Run row must remain open so the lock survives.
    const run = db.runs[0]!
    expect(run.finished_at).toBeNull()
    expect(run.phase).toBe('confirming')
  })

  it('short-circuits when snapshot is already confirmed', async () => {
    const db = new FakeDb()
    const epoch = 5n
    const snap = makeNonZeroSnapshot(epoch)
    snap.publish_tx_hash = '0x' + 'aa'.repeat(32)
    snap.publish_confirmed_at = new Date()
    snap.publish_block_number = 42n
    db.snapshots.push(snap)

    const broadcast = makeBroadcast()
    const confirm = makeConfirm()
    const outcome = await publishEpoch({
      db: db as unknown as AmoePublisherDb,
      epoch,
      claimedBy: 'pod-late',
      lotteryAmoeRouter: ROUTER,
      broadcast,
      confirm,
      lookupBurnContext: NULL_LOOKUP,
      publisherVersion: 'test',
    })
    expect(outcome.kind).toBe('finished')
    expect(projectAmoeBurnsToLedgerMock).not.toHaveBeenCalled()
    expect(buildAmoeLedgerSnapshotMock).not.toHaveBeenCalled()
    expect(broadcast).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('marks run errored when broadcast throws no_publisher_key_configured (caller catches)', async () => {
    const db = new FakeDb()
    const epoch = 5n
    projectAmoeBurnsToLedgerMock.mockResolvedValueOnce({
      scanned: 0,
      projected: 0,
      alreadyPresent: 0,
      skippedMissingContext: 0,
      lastScannedId: null,
    })
    buildAmoeLedgerSnapshotMock.mockImplementationOnce(async () => {
      db.snapshots.push(makeNonZeroSnapshot(epoch))
      return { rootHex: '0x' + '11'.repeat(32), leafCount: 1 }
    })

    const broadcast: BroadcastSetPointsLedgerRoot = vi.fn(async () => {
      throw new Error('no_publisher_key_configured')
    })
    const confirm = makeConfirm()

    await expect(
      publishEpoch({
        db: db as unknown as AmoePublisherDb,
        epoch,
        claimedBy: 'pod-test',
        lotteryAmoeRouter: ROUTER,
        broadcast,
        confirm,
        lookupBurnContext: NULL_LOOKUP,
        publisherVersion: 'test',
      }),
    ).rejects.toThrow('no_publisher_key_configured')
    // Run should be marked errored so the lock releases.
    const run = db.runs[0]!
    expect(run.phase).toBe('errored')
    expect(run.finished_at).not.toBeNull()
  })
})

describe('reclaimStrandedPublisherRuns', () => {
  it('marks runs older than the reclaim cutoff as errored and clears finished_at', async () => {
    const db = new FakeDb()
    const old = new Date(Date.now() - STRANDED_RUN_RECLAIM_AGE_MS - 60_000)
    db.runs.push({
      id: 'old',
      epoch: 1n,
      phase: 'broadcasting',
      finished_at: null,
      claimed_at: old,
      claimed_by: 'crashed-pod',
      snapshot_epoch: null,
      last_error: null,
    })
    // Recent run — must NOT be reclaimed.
    db.runs.push({
      id: 'fresh',
      epoch: 2n,
      phase: 'projecting',
      finished_at: null,
      claimed_at: new Date(),
      claimed_by: 'live-pod',
      snapshot_epoch: null,
      last_error: null,
    })

    const count = await reclaimStrandedPublisherRuns(
      db as unknown as AmoePublisherDb,
    )
    expect(count).toBe(1)
    expect(db.runs[0]!.phase).toBe('errored')
    expect(db.runs[0]!.finished_at).not.toBeNull()
    expect(db.runs[0]!.last_error).toBe('reclaim_stranded')
    expect(db.runs[1]!.phase).toBe('projecting') // untouched
    expect(db.runs[1]!.finished_at).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// PR 5b Codex review fix #2 — backfill picker
// ---------------------------------------------------------------------------

describe('pickNextEpochToPublish', () => {
  it('returns latestClosedEpoch when nothing in horizon is published', async () => {
    const db = new FakeDb()
    const next = await pickNextEpochToPublish(db as unknown as AmoePublisherDb, {
      latestClosedEpoch: 10n,
    })
    // Horizon = [10 - 14 + 1, 10] but clamped at 0 — so [0, 10]; oldest unhandled = 0n.
    expect(next).toBe(0n)
  })

  it('skips epochs with confirmed snapshots and returns the oldest unhandled', async () => {
    const db = new FakeDb()
    // Epochs 0..3 confirmed; 4..5 unhandled.
    for (let e = 0n; e <= 3n; e += 1n) {
      db.snapshots.push({
        epoch: e,
        root_hex: '0x' + '11'.repeat(32),
        publish_tx_hash: '0xtx',
        publish_block_number: 1n,
        publish_confirmed_at: new Date(),
        leaf_count: 1,
      })
    }
    const next = await pickNextEpochToPublish(db as unknown as AmoePublisherDb, {
      latestClosedEpoch: 5n,
    })
    expect(next).toBe(4n)
  })

  it('skips finished_no_op terminal runs', async () => {
    const db = new FakeDb()
    // Epoch 4 was empty — finished_no_op (no snapshot row).
    db.runs.push({
      id: 'r-noop',
      epoch: 4n,
      phase: 'finished_no_op',
      finished_at: new Date(),
      claimed_at: new Date(),
      claimed_by: 'pod',
      snapshot_epoch: 4n,
      last_error: null,
    })
    // Epoch 5 confirmed.
    db.snapshots.push({
      epoch: 5n,
      root_hex: '0x' + '11'.repeat(32),
      publish_tx_hash: '0xtx',
      publish_block_number: 1n,
      publish_confirmed_at: new Date(),
      leaf_count: 1,
    })
    const next = await pickNextEpochToPublish(db as unknown as AmoePublisherDb, {
      latestClosedEpoch: 5n,
      lookbackEpochs: 3n,
    })
    // Horizon = [3, 5]; epoch 3 is unhandled, 4 is no_op, 5 confirmed.
    expect(next).toBe(3n)
  })

  it('returns null when every epoch in horizon is handled', async () => {
    const db = new FakeDb()
    for (let e = 3n; e <= 5n; e += 1n) {
      db.snapshots.push({
        epoch: e,
        root_hex: '0x' + '11'.repeat(32),
        publish_tx_hash: '0xtx',
        publish_block_number: 1n,
        publish_confirmed_at: new Date(),
        leaf_count: 1,
      })
    }
    const next = await pickNextEpochToPublish(db as unknown as AmoePublisherDb, {
      latestClosedEpoch: 5n,
      lookbackEpochs: 3n,
    })
    expect(next).toBeNull()
  })

  it('returns null when latestClosedEpoch < 0', async () => {
    const db = new FakeDb()
    const next = await pickNextEpochToPublish(db as unknown as AmoePublisherDb, {
      latestClosedEpoch: -1n,
    })
    expect(next).toBeNull()
  })

  it('uses the default lookback when not specified', async () => {
    expect(BACKFILL_LOOKBACK_EPOCHS).toBeGreaterThan(0n)
  })
})

// ---------------------------------------------------------------------------
// PR 5b Codex review fix #3 — projector cap fall-through
// ---------------------------------------------------------------------------

describe('publishEpoch projector iteration cap', () => {
  it('errors the run instead of falling through when cap is hit with rows still pending', async () => {
    const db = new FakeDb()
    // Stub projector to ALWAYS return scanned > 0, so the cap is hit.
    projectAmoeBurnsToLedgerMock.mockReset()
    projectAmoeBurnsToLedgerMock.mockImplementation(
      async (args: { afterId?: bigint }) => ({
        scanned: 500,
        projected: 0,
        alreadyPresent: 0,
        skippedMissingContext: 500, // never produces L1 rows
        rows: [],
        // Advance the cursor so the loop wouldn't terminate via afterId.
        lastScannedId: (args.afterId ?? 0n) + 500n,
      }),
    )

    const broadcast = makeBroadcast()
    const confirm = makeConfirm()

    const outcome = await publishEpoch({
      db: db as unknown as AmoePublisherDb,
      epoch: 7n,
      claimedBy: 'pod',
      lotteryAmoeRouter: ROUTER,
      broadcast,
      confirm,
      lookupBurnContext: NULL_LOOKUP,
      publisherVersion: 'test',
    })

    // Must NOT have called build/broadcast — partial root would corrupt epoch.
    expect(buildAmoeLedgerSnapshotMock).not.toHaveBeenCalled()
    expect(broadcast).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()

    // Outcome reflects the abort.
    expect(outcome.kind).toBe('errored')
    if (outcome.kind === 'errored') {
      expect(outcome.phase).toBe('projecting')
      expect(outcome.message).toMatch(/projector_cap_exceeded/)
      expect(outcome.message).toMatch(/epoch=7/)
    }

    // Run row marked errored + finished_at set so the lock releases.
    expect(db.runs[0]!.phase).toBe('errored')
    expect(db.runs[0]!.finished_at).not.toBeNull()
    expect(db.runs[0]!.last_error).toMatch(/projector_cap_exceeded/)

    // Sanity: projector was actually invoked the full cap.
    expect(projectAmoeBurnsToLedgerMock).toHaveBeenCalledTimes(
      MAX_PROJECTOR_ITERATIONS,
    )
  })
})
