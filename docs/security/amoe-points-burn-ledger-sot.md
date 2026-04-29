---
title: AMOE Points-Burn Ledger Source of Truth
sidebar_position: 4
---

# AMOE Points-Burn Ledger — Source-of-Truth Design

**Status:** design proposal (not yet implemented)
**Authors:** AMOE on-call
**Targets:** PR 5 (`feat/amoe-zk-ledger-publisher`) + PR 3 stub
**Blocks/unblocks:** unblocks the PR 5 cron, simplifies the PR 3
snapshot stub, defines the on-chain `pointsLedgerRoot` published by the
relayer.

**Related:**
- [`amoe-pr3-handler-swap-plan.md`](./amoe-pr3-handler-swap-plan.md) — handler swap (consumes this design's stub-shape)
- [`amoe-plonk-migration.md`](./amoe-plonk-migration.md) — overall §2 arc
- [`amoe-points-source-audit.md`](./amoe-points-source-audit.md) — what counts as AMOE-eligible
- [`amoe-signup-salt-provisioning.md`](../operations/deployment/amoe-signup-salt-provisioning.md) — sibling secret, same custody posture

---

## 1. Why this design exists

The PLONK circuit needs a `pointsLedgerRoot` it can prove inclusion
into. That root is a Merkle root over leaves of the form:

```
Poseidon5(signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch, walletAddrCommit)
```

Today the AMOE submit handler debits points by inserting a row into
the unified `points` table with `source = 'amoe_entry_spend'` (see
`consumeAmoeCreditsForEntry` in `lotteryAmoe.ts`). That table is the
operational ledger of every points event in the system — but it is not
the ledger the circuit verifies against. Three problems with using
`points` directly as the proof source:

1. **Wrong identity column.** `points.signup_id` is a Postgres `bigint`
   (`profiles.id`). The circuit consumes a 254-bit field element
   `signupIdHash` derived via salt. The two are not interchangeable.
2. **Wrong commitment shape.** A Merkle proof needs a fixed-depth tree
   indexed by leaf position. The `points` table is unordered and grows
   every social-action event, not just AMOE burns.
3. **Wrong publication cadence.** The on-chain root must change at
   discrete epochs the relayer signs and publishes. The `points` table
   is mutated in real time on every user action.

This document defines the materialized layer that sits between
`points` and the published root.

## 2. Identity model (CORRECTION to PR 3 plan)

The PR 3 plan and salt-provisioning runbook both said `signupIdHash`
hashes a "UUID `profiles.id`". After auditing the schema:

> `profiles.id` is a Postgres `bigint`, not a UUID.
> `points.signup_id` references it as `bigint`.

The hashing therefore becomes:

```
signupIdHash := canonicalizeAmoeBytes32ToField(
  'signupIdHash',
  keccak256(
    bigintToBe32Bytes(profiles.id) ‖ AMOE_SIGNUP_SALT
  )
)
```

Where `bigintToBe32Bytes` is big-endian, zero-padded to 32 bytes (so
`profiles.id = 5` and `profiles.id = 5_000_000` produce different
hashes, with no ambiguity from leading zeros). The tombstone chase
already exists in `resolveOrCreateProfileForWallet` (lines 352–419 of
`lotteryAmoe.ts`) — the publisher reuses that exact resolver so the
same profile a debit was attributed to is the same profile the proof
binds to.

**Action item:** update the salt runbook §1 and PR 3 plan §8.1 to
reflect bigint, not UUID. (Tracked in §10 of this doc.)

## 3. Layered architecture

```
┌─────────────────────────────────────────────────────────┐
│  L0 — operational ledger                                 │
│  table: points                                           │
│  source-of-truth for: every points event in the system   │
│  AMOE-relevant rows: source = 'amoe_entry_spend'         │
│  mutated by: consumeAmoeCreditsForEntry (sync)          │
│  invariant: append-only; one row per (signup_id,         │
│             source, source_id) triple                    │
└─────────────────────────────────────────────────────────┘
                          │
                          │  every N seconds (publisher cron)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  L1 — derived AMOE burn ledger                           │
│  table: amoe_points_burn_ledger                          │
│  source-of-truth for: what the circuit will verify       │
│  one row per AMOE burn, projected from L0               │
│  contains: leaf inputs + computed leaf hash + epoch      │
│  mutated by: ledger_publisher_cron only (job)           │
│  invariant: derived deterministically from L0; never     │
│             hand-edited                                  │
└─────────────────────────────────────────────────────────┘
                          │
                          │  end of epoch
                          ▼
┌─────────────────────────────────────────────────────────┐
│  L2 — Merkle snapshot                                    │
│  table: amoe_points_burn_ledger_snapshots               │
│  source-of-truth for: the published root + paths         │
│  one row per epoch, frozen at epoch close                │
│  contains: epoch, root, leaf_count, sparse-tree blob     │
│  mutated by: ledger_publisher_cron only                  │
│  invariant: immutable after publish_tx_hash is set       │
└─────────────────────────────────────────────────────────┘
                          │
                          │  publish on-chain
                          ▼
┌─────────────────────────────────────────────────────────┐
│  L3 — on-chain root                                      │
│  contract: CreatorLotteryManager (or sibling registry)  │
│  source-of-truth for: what the verifier checks against   │
│  contains: epoch ↦ root mapping                          │
│  mutated by: relayer.publishLedgerRoot(epoch, root)      │
│  invariant: epoch monotonic; root never overwritten      │
└─────────────────────────────────────────────────────────┘
```

L0 already exists. L1, L2, L3 are introduced by PR 5 and consumed by
PR 3 (via the snapshot stub) + the on-chain verifier.

## 4. Schema — L1 derived burn ledger

```sql
CREATE TABLE amoe_points_burn_ledger (
  -- Identity (deterministic from L0)
  signup_id              BIGINT      NOT NULL,
  spend_ref_id           TEXT        NOT NULL,
  points_burned          BIGINT      NOT NULL CHECK (points_burned BETWEEN 100 AND 1000000),

  -- Epoch assignment (set by publisher at projection time)
  epoch                  BIGINT      NOT NULL,

  -- Wallet binding (the wallet the user submitted from at debit time)
  wallet_address         TEXT        NOT NULL,
  twitter_credit_nullifier_hex TEXT  NOT NULL,  -- bytes32 hex, the value used for walletAddrCommit

  -- Witness-derived field elements (computed at projection time, pinned)
  signup_id_hash_hex     TEXT        NOT NULL,  -- bytes32 hex, the canonical field element
  spend_ref_id_hash_hex  TEXT        NOT NULL,  -- bytes32 hex
  points_burned_as_usd   NUMERIC(78,0) NOT NULL,  -- = points_burned * 10000
  wallet_addr_commit_hex TEXT        NOT NULL,  -- bytes32 hex, Poseidon2(wallet, twitterCreditNullifier)

  -- Leaf hash (the Poseidon5 of the five field elements above)
  leaf_hash_hex          TEXT        NOT NULL,  -- bytes32 hex

  -- Provenance
  source_points_id       BIGINT      NOT NULL,  -- FK to points.id (the L0 row this projects)
  projected_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  publisher_run_id       UUID        NOT NULL,  -- which cron run produced this row

  PRIMARY KEY (signup_id, spend_ref_id, epoch),
  UNIQUE (source_points_id),                     -- one L0 row → at most one L1 row
  UNIQUE (leaf_hash_hex)                          -- defensive: leaf collisions = bug
);

CREATE INDEX amoe_points_burn_ledger_epoch_idx
  ON amoe_points_burn_ledger (epoch, signup_id);

-- Index used by the witness assembler to find a leaf's position within
-- its epoch (= leaf index in the Merkle tree).
CREATE INDEX amoe_points_burn_ledger_epoch_position_idx
  ON amoe_points_burn_ledger (epoch, projected_at, signup_id, spend_ref_id);
```

### 4.1 Why projected, not computed-on-read

We materialize the field-element hashes (signup_id_hash_hex, etc.) at
projection time rather than computing them on every proof. Three
reasons:

1. **Fairness across salt provisioning.** The salt is loaded once at
   handler boot and used to project. Reading it on every proof would
   mean a salt-rotation event (which we explicitly forbid — see the
   provisioning runbook §5) would silently corrupt historical proofs.
   Pinning the projection makes the salt's effect on a given epoch
   forensically explicit.
2. **Determinism vs. drift.** Poseidon implementation drift between
   the publisher and the prover would silently produce different
   leaves. Materializing the leaf hash means the prover and publisher
   agree by construction (the prover uses the same hex value).
3. **Audit.** Every leaf in the published root is a row in this table
   with a `source_points_id` FK back to the operational ledger. An
   auditor can trace any on-chain lottery payout back to a specific
   `points` row.

### 4.2 Epoch assignment policy

A burn row is assigned to an epoch at projection time by:

```
epoch = floor((points.created_at - AMOE_EPOCH_GENESIS) / AMOE_EPOCH_LENGTH)
```

`AMOE_EPOCH_GENESIS` is a one-time constant pinned at AMOE launch.
`AMOE_EPOCH_LENGTH` is `86400` seconds (one UTC day) for v1.

A burn is **eligible for inclusion** in the snapshot for epoch `E`
only when the publisher run begins after `epoch_close(E)`, defined as
`AMOE_EPOCH_GENESIS + (E + 1) * AMOE_EPOCH_LENGTH + AMOE_EPOCH_GRACE`.
The grace window (60 seconds) absorbs clock skew between the API
servers, the publisher, and the database.

This means a user who burns in the last 60 seconds of an epoch lands
in epoch `E+1`'s snapshot, not `E`'s. Acceptable: AMOE entries are
batched-resolved daily at most.

## 5. Schema — L2 Merkle snapshot

```sql
CREATE TABLE amoe_points_burn_ledger_snapshots (
  epoch                  BIGINT      PRIMARY KEY,

  -- Tree summary
  leaf_count             BIGINT      NOT NULL,
  root_hex               TEXT        NOT NULL,         -- bytes32 hex of the Merkle root
  tree_depth             SMALLINT    NOT NULL DEFAULT 20,

  -- Sparse-tree storage (compatible with amoeMerkleTree.ts)
  -- Encoded as JSONB: { "nodes": [[level, index, value_hex], ...], "leaves": [[index, value_hex], ...] }
  -- Only materialized levels for non-zero subtrees are stored.
  tree_blob              JSONB       NOT NULL,

  -- Publication state machine
  built_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  publish_tx_hash        TEXT,                          -- NULL until on-chain confirm
  publish_block_number   BIGINT,
  publish_confirmed_at   TIMESTAMPTZ,

  -- Audit
  publisher_run_id       UUID        NOT NULL,
  publisher_version      TEXT        NOT NULL,         -- git SHA of publisher at build time

  CHECK (leaf_count >= 0),
  CHECK (
    -- Once published, the snapshot is frozen.
    (publish_tx_hash IS NULL AND publish_block_number IS NULL AND publish_confirmed_at IS NULL)
    OR
    (publish_tx_hash IS NOT NULL AND publish_block_number IS NOT NULL AND publish_confirmed_at IS NOT NULL)
  )
);

CREATE INDEX amoe_points_burn_ledger_snapshots_pending_idx
  ON amoe_points_burn_ledger_snapshots (epoch)
  WHERE publish_tx_hash IS NULL;
```

A snapshot has three states:

| `publish_tx_hash` | `publish_confirmed_at` | State |
|---|---|---|
| NULL | NULL | **built, not yet published** |
| NOT NULL | NULL | **publish broadcast, not yet confirmed** |
| NOT NULL | NOT NULL | **confirmed and frozen** |

The PR 3 snapshot stub returns rows in state 3 only. PR 5's publisher
is the only writer that can transition NULL→NULL→NULL or fill the
publish columns; nothing else may touch them.

## 6. Publisher cron — operational shape

```
ledger_publisher_cron:
  cadence: hourly (poll for newly-eligible epochs)
  isolation: SERIALIZABLE on the publisher_runs row-lock
  steps:
    1. acquire publisher_runs lock or exit
    2. determine eligible epochs:
       - any epoch E where epoch_close(E) < now()
       - and no row in amoe_points_burn_ledger_snapshots(E) yet
    3. for each eligible epoch:
       a. project from points → amoe_points_burn_ledger
          (one transaction per source_points_id; idempotent via UNIQUE)
       b. build Merkle tree using amoeMerkleTree.ts (DEPTH=20, sparse)
       c. INSERT into amoe_points_burn_ledger_snapshots (state 1)
       d. broadcast publishLedgerRoot(epoch, root) via the AMOE relayer
       e. UPDATE snapshot: publish_tx_hash, publish_block_number (state 2)
       f. wait for confirmation
       g. UPDATE snapshot: publish_confirmed_at (state 3)
    4. release lock
```

Failure modes and recovery:

| Failure point | Recovery |
|---|---|
| 3a (projection) | Idempotent — re-run picks up where it left off via `UNIQUE(source_points_id)`. |
| 3b (build) | Pure function over L1; re-run rebuilds identical tree. |
| 3c (insert) | Conflict on `epoch` PK → next run sees state 1 and resumes from 3d. |
| 3d (broadcast) | Network/relay fail → state 1 retained → next run retries. |
| 3e–3g (confirm) | If broadcast lands but confirmation polling crashes, next run re-reads `publish_tx_hash` and continues polling. **Never** re-broadcasts. |

The "never re-broadcast" rule is critical: the on-chain contract must
reject a duplicate `publishLedgerRoot(E, root)` for the same `E`, but
the publisher should not depend on that — it asserts state 2's tx_hash
is still pending and resumes polling.

## 7. PR 3 stub contract

The PR 3 handler swap reads from this layer, not from L0 directly. The
stub it ships with is a fixture-backed implementation of the same
interface:

```typescript
interface AmoeLedgerSnapshotReader {
  /**
   * Return the current confirmed snapshot for the given user and
   * spend-ref. Throws AmoeProofGenerationError('ledger_snapshot_unavailable')
   * if the user's burn has not yet been projected/published.
   */
  readSnapshotForBurn(args: {
    signupId: number
    spendRefId: string
  }): Promise<{
    epoch: bigint
    snapshot: AmoeLedgerSnapshot         // shape from amoeWitness.ts
    leafIndex: number
    rootHex: `0x${string}`
  }>
}
```

PR 3 ships `amoeLedgerSnapshotStub.ts` which reads from a JSON fixture
on disk and pretends every burn is in epoch 1. PR 5 ships
`amoeLedgerSnapshotPg.ts` which queries L1 + L2. The handler depends
only on the interface.

## 8. Staleness / publishing SLO

Open question deferred from PR 3 plan §9. Proposal:

| Constraint | Value | Rationale |
|---|---|---|
| Max snapshot age accepted by submit | `current_epoch - 1` (yesterday) | A user cannot prove against today's not-yet-closed epoch; one epoch back is the freshest provable state. |
| Min snapshot age accepted by submit | `current_epoch - 7` | Beyond a week, treat as `ledger_snapshot_stale`. Users with that old a debit have other recovery paths. |
| Publish latency SLO | epoch_close + 30 min p95 | Cron runs hourly; first run after close should publish. |
| Confirmation SLO | broadcast + 5 min p95 | Base typically confirms in seconds; 5 min covers congestion. |

These thresholds get baked into `AmoeLedgerSnapshotReader` as enums
and surfaced in monitoring (PR 5 also ships dashboards for these
SLOs).

## 9. What changes downstream

**For PR 3:**

- Stub interface is locked (§7). Real impl drops in at PR 5 with no
  handler change.
- The PR 3 plan §8.1 needs a small textual fix: "Supabase UUID" →
  "`profiles.id` (bigint)". The hash logic is the same shape, just
  bigintToBe32Bytes instead of UTF-8 string serialization.
- The salt runbook §1 needs the same fix.

**For PR 4 (replay store + retry):**

- Replay store uses `pointsBurnNullifier` as the dedupe key, which is
  already deterministic from the (signup_id, spend_ref_id, points,
  epoch, wallet_addr_commit) tuple — so PR 4 just needs to read this
  table to get the canonical nullifier value.

**For PR 5 (publisher):**

- This doc IS the spec. PR 5 ships the cron + the PG snapshot reader
  + the on-chain `publishLedgerRoot` setter on the relayer (NOT the
  manager — keep §1.1 of the project rules: don't touch
  CreatorLotteryManager.sol without approval; the publisher writes
  to a sibling registry contract or to the existing relayer).

**For PR 6 (zkey hosting):**

- Independent. No shape change.

## 10. Action items

- [x] Update `amoe-pr3-handler-swap-plan.md` §8.1: bigint, not UUID. *(done 2026-04-29)*
- [x] Update `amoe-signup-salt-provisioning.md` §1: bigint, not UUID;
      hashing uses `bigintToBe32Bytes`. *(done 2026-04-29)*
- [x] **L3 contract location — RESOLVED.** No new contract needed. The
      existing `LotteryAmoeRouter.sol`
      (`contracts/utilities/lottery/zk/LotteryAmoeRouter.sol`) already
      ships:
      - `pointsLedgerPublisher` allowlist (settable by owner via
        `setPointsLedgerPublisher`)
      - `setPointsLedgerRoot(uint64 epoch, bytes32 root)` with the
        `EpochAlreadyPublished` revert (matches §5 immutability)
      - `pointsLedgerRootOf[epoch]` storage + `PointsLedgerRootSet`
        event

      PR 5's relayer call target is `LotteryAmoeRouter.setPointsLedgerRoot`.
      `CreatorLotteryManager.sol` is not touched. The sibling-contract
      approach was already implemented at L3.
- [x] **Epoch length — RESOLVED.** 86400s (1 UTC day). This is already
      locked into the circuit: `amoeWitness.ts:102` documents "Epoch is
      the daily counter" and `amoe_eligibility.circom` line 157 binds
      it to `Num2Bits(64)`. The daily cadence also matches the existing
      `amoe_twitter_daily` and `amoe_checkin` rhythms in the points
      ledger. Changing this post-launch would require a circuit
      regeneration, so it is not a v1 decision — it is a constant.
- [ ] Provision `AMOE_EPOCH_GENESIS` constant before PR 5 ships.
      Proposal: pin to the first UTC midnight after PR #426 (the
      witness module) merges to main. Lock value in
      `server/_lib/lottery/amoeWitness.ts` as a named export so the
      publisher and prover share one constant.

## 11. Out of scope (explicitly)

- Cross-epoch ledger compression / pruning. The L1 table grows
  linearly with burn count; at 1k burns/day for 5 years that's ~1.8M
  rows, well within Postgres comfort. Revisit if AMOE volume spikes.
- Cross-chain replication. AMOE is Base-only in v1.
- Multiple roots per epoch (e.g. for partial-snapshot publishes). v1
  is one root per epoch, monotonic.

---

**Last updated:** 2026-04-29
**Reviewers needed:** AMOE on-call, on-chain owner (for L3 contract
choice), security counsel (for non-rotation claim consistency with
the salt runbook).
