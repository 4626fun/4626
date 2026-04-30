# AMOE §2 PR 5b — Points-Burn Ledger Publisher (cron + on-chain broadcast + handler swap)

**Status:** DRAFT — for review before implementation
**Depends on:** PR 5a (`#445`, merged), Hotfix `#448` (epoch genesis correction, in review)
**Branch:** `feat/amoe-zk-ledger-publisher` (stacked on `feat/amoe-epoch-genesis-fix`)

---

## 1. Scope

PR 5a landed the **read/build-only** half of the AMOE points-burn ledger Source of Truth: schema (L1 + L2), projector (L0 → L1), snapshot builder (L1 → L2), and snapshot reader. None of those pieces touch chain state and none run on a schedule.

PR 5b adds the **active half** that actually closes the loop:

1. A scheduled **publisher cron** that, for each closed-and-eligible epoch, drives `projector → builder → on-chain broadcast → receipt confirmation`.
2. The **on-chain broadcast** call to `LotteryAmoeRouter.setPointsLedgerRoot(epoch, root)` using the dedicated `pointsLedgerPublisher` key.
3. The L2 snapshot **state machine** transitions: `1 (built)` → `2 (broadcast)` → `3 (confirmed)`.
4. **Handler swap** — replace the PR 3 fail-loud stub (`amoeLedgerSnapshotStub`) inside `_amoeSubmitZk.ts` with `AmoeLedgerSnapshotPgReader` so the submit handler finally reads from the published ledger.

**Out of scope:** No contract changes. `setPointsLedgerRoot` already exists (verified in `LotteryAmoeRouter.sol:293`). No allowlist publisher (separate workstream — PR 5a/5b cover the points-burn ledger only; the allowlist publisher mirrors this design and lands later).

---

## 2. Architecture

```
                ┌──────────── publisher_runs ────────────┐
                │ id, epoch, started_at, claimed_by,     │
                │ phase, last_error, finished_at         │
                │ UNIQUE(epoch) WHERE finished_at IS NULL│
                └────────────────────────────────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │ Vercel cron @ */15 * * * *        │
                │ /api/v1/lottery/amoe/publish-cron │
                └─────────────────┬─────────────────┘
                                  │ for each eligible epoch:
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
    ┌───────────────────┐                   ┌───────────────────┐
    │ amoeLedger        │                   │ amoeLedger        │
    │ Projector (5a)    │  ◀── cursor ──▶   │ SnapshotBuilder   │
    │  L0 → L1          │                   │  L1 → L2 (state 1)│
    └───────────────────┘                   └─────────┬─────────┘
                                                      │
                                                      ▼
                                            ┌───────────────────┐
                                            │ amoeLedger        │
                                            │ Publisher (5b)    │
                                            │   broadcast +     │
                                            │   receipt watch   │
                                            └─────────┬─────────┘
                                                      │  state 1 → 2 → 3
                                                      ▼
                                ┌──────────────────────────────────┐
                                │ LotteryAmoeRouter.setPointsLedgerRoot │
                                │   (msg.sender = pointsLedgerPublisher)│
                                └──────────────────────────────────┘
```

---

## 3. Locked invariants

| Invariant | Source | Why |
|---|---|---|
| `epoch_close(E) + AMOE_EPOCH_GRACE_SECONDS <= now` before publishing E | `isAmoeEpochEligibleForPublish` (5a) | Late-arriving rows must land in E's snapshot, not E+1. 60s absorbs server clock skew. |
| Per-epoch lock via `publisher_runs (epoch, finished_at IS NULL)` partial unique | new in 5b | Two cron pods cannot both broadcast for the same epoch. |
| Snapshot state monotonic: `1 → 2 → 3`, never backward | L2 CHECK constraint (5a) | Reader filters `publish_confirmed_at IS NOT NULL` (state 3 only). |
| Re-running the cron after any partial failure converges, never duplicates | idempotent projector + builder pre-flight + state-machine | Required for at-least-once delivery to become exactly-once. |
| Reader unchanged from PR 5a | already shipped | The handler swap is a one-line `new AmoeLedgerSnapshotPgReader()` substitution; the reader contract was deliberately frozen in 5a so 5b doesn't touch it. |
| Publisher signer = `pointsLedgerPublisher` (not the entry relayer key) | `LotteryAmoeRouter:294` | `setPointsLedgerRoot` reverts with `NotPointsLedgerPublisher` for any other sender. The owner must call `setPointsLedgerPublisher` post-deploy as an operational prerequisite (§9). |
| Zero root rejected on-chain | `LotteryAmoeRouter:301` | An empty epoch (no burns) must NOT broadcast — we skip the call and mark the run `finished_no_op`. |

---

## 4. The cron loop — `/api/v1/lottery/amoe/publish-cron`

**Schedule:** `*/15 * * * *` (every 15 minutes). Justification: snapshots close once per UTC day, so 15m granularity is plenty; avoids contention with the 5-minute retry cron and the 1-minute chat-bridge cron.

**Auth:** `Authorization: Bearer $CRON_SECRET` with constant-time compare. Reuse `readCronSecret()` and `isAuthorizedCron()` from `_amoeRetryCron.ts` (extract to a shared `cronAuth.ts` helper if not already shared).

**Feature flags:**

- `AMOE_ZK_SUBMIT_ENABLED` must be `1` (mirror retry cron) — skip the run with 503 otherwise.
- `AMOE_LEDGER_PUBLISHER_ENABLED` (new) must be `1` — independent kill switch so we can stop publishing without disabling submit.

**Tick procedure (idempotent end-to-end):**

```
1. Auth + feature-flag gate (return 503 if any fail).
2. Compute eligible epoch set:
     candidate_epochs = { E in [last_published+1, currentAmoeEpoch - 1]
                          | isAmoeEpochEligibleForPublish(E, now) }
   Cap at MAX_EPOCHS_PER_TICK = 3 to bound a single Vercel function's
   wall-clock budget. Newly-discovered backfill epochs land in subsequent
   ticks.
3. reclaimStrandedPublisherRuns()
     UPDATE publisher_runs
        SET claimed_by = NULL, claimed_at = NULL, last_error = 'reclaimed'
      WHERE finished_at IS NULL
        AND claimed_at < NOW() - INTERVAL '15 minutes'
4. For each candidate epoch E (oldest first):
     a. claimPublisherRun(E)
          INSERT INTO publisher_runs (epoch, claimed_by, claimed_at, phase)
          VALUES (E, $cron_id, NOW(), 'projecting')
          ON CONFLICT (epoch) WHERE finished_at IS NULL
            DO UPDATE SET claimed_by = ..., claimed_at = ...
            WHERE publisher_runs.claimed_at < NOW() - INTERVAL '15 minutes'
          RETURNING xmax = 0  -- true iff we got the row
        If we did NOT get the row, another pod owns this epoch — skip.
     b. Run pipeline phases in order, updating publisher_runs.phase
        between each so a crash leaves a breadcrumb:
          - phase='projecting'  → loop projector with afterId cursor
          - phase='building'    → buildAmoeLedgerSnapshot
          - phase='broadcasting'→ relayLedgerRootTransaction (state 1→2)
          - phase='confirming'  → wait for receipt (state 2→3)
          - phase='finished'    → finishPublisherRun(E)
     c. On any thrown error: writeRunError(E, err.message.slice(0,200))
        and continue to next epoch. The next tick will retry from the
        last known phase.
5. Return JSON { ok, picked: [...], reclaimedCount, skippedNoOp,
                 errors: [{ epoch, phase, message }] }.
```

---

## 5. Phase 1 — Projecting (loop with cursor)

PR 5a shipped a cursor-aware projector (`afterId` + `lastScannedId`, fixed in `ae50018` after Codex review). The cron drives it like this:

```ts
let afterId: bigint | undefined = undefined
let convergedRuns = 0
const MAX_PROJECTOR_ITERATIONS = 32  // = 32 * 1000 = 32k burns/epoch

for (let i = 0; i < MAX_PROJECTOR_ITERATIONS; i++) {
  const r = await projectAmoeBurnsToLedger({
    db, epoch: E, publisherRunId: claim.id,
    lookupBurnContext, afterId,
    batchSize: 1000,
  })
  if (r.scanned === 0) break               // no candidate rows left
  if (r.lastScannedId !== null && afterId === r.lastScannedId) {
    // Cursor didn't advance → all remaining rows are permanently
    // skipped. Move on so we don't infinite-loop.
    if (++convergedRuns >= 2) break
  } else {
    convergedRuns = 0
  }
  afterId = r.lastScannedId ?? afterId
}
```

The `convergedRuns` guard plus `MAX_PROJECTOR_ITERATIONS` cap together prevent a runaway projector. If we hit the cap (i.e. > 32k burns in one epoch), the cron writes `last_error = 'projector_iteration_cap'` and bails — operator alerts on this; AMOE per-epoch volumes are nowhere near this in v1.

**`lookupBurnContext` source:**

```sql
SELECT zk_sub.wallet_address, zk_sub.twitter_credit_nullifier_hex
FROM amoe_zk_submissions AS zk_sub
WHERE zk_sub.signup_id = $1
  AND zk_sub.spend_ref_id = $2
  AND zk_sub.nullifier_hex IS NOT NULL
LIMIT 1
```

A burn whose entry submission has not yet been written (or was rolled back) returns null and is permanently skipped — counted in `skippedMissingContext` for observability.

---

## 6. Phase 2 — Building

Single call:

```ts
const built = await buildAmoeLedgerSnapshot({ db, epoch: E, publisherRunId })
```

Edge cases the builder already handles (PR 5a):

- **`amoe_ledger_snapshot_already_built`** → cron treats this as success and advances to the broadcast phase. It means a previous tick crashed after building but before broadcasting; we just re-read the existing L2 row.
- **`amoe_ledger_snapshot_too_many_leaves`** → write `last_error`, bail. Operator alert.
- **Empty epoch (zero burns)** → builder returns `leafCount=0`. Cron skips the broadcast entirely (zero-root would revert on-chain), writes `phase='finished_no_op'`, finishes the run. Future entries for E will find no snapshot and 5xx with `amoe_ledger_snapshot_unavailable` — which is the **correct** behavior, because there's nothing to prove against and no one should be entering a closed empty epoch anyway.

---

## 7. Phase 3 — Broadcasting (state 1 → 2)

### 7.1 Transaction shape

```ts
const callData = encodeFunctionData({
  abi: LOTTERY_AMOE_ROUTER_ABI,
  functionName: 'setPointsLedgerRoot',
  args: [BigInt(epoch), rootHex as `0x${string}`],
})
const txHash = await relay({ to: lotteryAmoeRouter, callData })
```

`setPointsLedgerRoot` is a tiny tx (≤ 50k gas; just storage write + event). No ERC-4337 user-op needed — direct EOA send is simpler and cheaper.

### 7.2 Signer key

The `pointsLedgerPublisher` key is **distinct** from the entry-relayer keys. Three env-var options, in priority order:

1. **`AMOE_LEDGER_PUBLISHER_PRIVATE_KEY`** — direct hex pk for an EOA. Simplest. Used for staging + initial production.
2. **`AMOE_LEDGER_PUBLISHER_PRIVY_WALLET_ID`** + **`AMOE_LEDGER_PUBLISHER_OWNER_ADDRESS`** — Privy-managed signer, mirrors the Privy path in `_amoeSubmitZk.ts:295`. Used once the production key rotates into Privy custody.
3. *(none)* → cron returns 200 with `tick: 'no_publisher_key_configured'` so the schedule keeps ticking and an actionable metric is emitted (mirror retry-cron fallback at line 130).

We do **NOT** fall back to `AMOE_RELAY_PRIVATE_KEY` — that key is the entry relayer and the contract guards `setPointsLedgerRoot` against any address other than `pointsLedgerPublisher`. A misconfiguration that picked the wrong key would hit `NotPointsLedgerPublisher` reverts in production; better to fail at config-read time.

### 7.3 Persistence

```sql
UPDATE amoe_points_burn_ledger_snapshots
   SET publish_tx_hash = $1
 WHERE epoch = $2
   AND publish_tx_hash IS NULL  -- guard against double-broadcast races
```

If the UPDATE's row count is 0, another pod broadcast first — we read the existing tx_hash and proceed to confirmation phase.

---

## 8. Phase 4 — Confirming (state 2 → 3)

Bounded poll using viem's `waitForTransactionReceipt`:

```ts
const receipt = await publicClient.waitForTransactionReceipt({
  hash: txHash,
  confirmations: 1,
  timeout: 60_000,  // 60s — Base block time is 2s
})
if (receipt.status !== 'success') {
  // The tx reverted on-chain. Possible causes:
  //   * EpochAlreadyPublished → another pod won the race, treat as success
  //     and read the on-chain root for cross-check.
  //   * NotPointsLedgerPublisher → key misconfigured, alert.
  //   * ZeroRoot → builder bug; we already filter this in §6.
  // Decode the revert reason and write to last_error.
  throw new Error(`broadcast_reverted:${decoded}`)
}
```

On success:

```sql
UPDATE amoe_points_burn_ledger_snapshots
   SET publish_block_number = $1,
       publish_confirmed_at = NOW()
 WHERE epoch = $2
```

This is the state 2 → 3 transition. The reader (`AmoeLedgerSnapshotPgReader`) filters `publish_confirmed_at IS NOT NULL` so submit handlers immediately become eligible.

**On timeout:** leave the snapshot at state 2. The next tick's `confirming` phase will re-poll the same tx_hash. If the tx was actually mined, viem returns the receipt; if it was dropped from the mempool, we transition back to broadcasting with a fresh tx (the `publish_tx_hash IS NULL` guard in §7.3 needs adjusting for re-broadcast — handled with a separate `tx_dropped_at` column or by treating mempool-drop as a recoverable error and clearing `publish_tx_hash` first).

---

## 9. Schema additions (one new table)

```sql
-- frontend/db/migrations/034_amoe_publisher_runs.sql
-- supabase/migrations/<ts>_amoe_publisher_runs.sql  (byte-identical)

CREATE TABLE IF NOT EXISTS amoe_publisher_runs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  epoch         bigint      NOT NULL,
  phase         text        NOT NULL DEFAULT 'projecting'
                            CHECK (phase IN (
                              'projecting','building','broadcasting',
                              'confirming','finished','finished_no_op',
                              'errored'
                            )),
  claimed_by    text,
  claimed_at    timestamptz,
  started_at    timestamptz NOT NULL DEFAULT NOW(),
  finished_at   timestamptz,
  last_error    text,
  CHECK (
    -- finished runs have a non-null finished_at; non-finished have null.
    (phase IN ('finished','finished_no_op','errored'))
      = (finished_at IS NOT NULL)
  )
);

-- Single in-flight run per epoch: blocks two pods from claiming the
-- same epoch simultaneously. Finished runs (any outcome) drop out of
-- this index, so we keep a full history.
CREATE UNIQUE INDEX amoe_publisher_runs_inflight_epoch
  ON amoe_publisher_runs (epoch)
  WHERE finished_at IS NULL;

-- Lookup by epoch for observability dashboards.
CREATE INDEX amoe_publisher_runs_epoch_started
  ON amoe_publisher_runs (epoch, started_at DESC);
```

---

## 10. Handler swap

```diff
 // frontend/server/_lib/lottery/amoeSubmitZk.ts
-import { buildAmoeLedgerSnapshotStub } from './amoeLedgerSnapshotStub.js'
+import { AmoeLedgerSnapshotPgReader } from './amoeLedgerSnapshotReader.js'

 // ... inside orchestrate ...
-const trees = buildAmoeLedgerSnapshotStub({ ... })
+const reader = new AmoeLedgerSnapshotPgReader({ db })
+const ledgerCtx = await reader.readSnapshotForBurn({ signupId, spendRefId })
+// allowlist branch unchanged — still uses single-leaf stub until the
+// allowlist publisher (separate PR) lands.
+const trees = {
+  allowlistSnapshot, allowlistLeafIndex,
+  pointsLedgerSnapshot: ledgerCtx.pointsLedgerSnapshot,
+  pointsLedgerLeafIndex: ledgerCtx.pointsLedgerLeafIndex,
+}
```

The stub module (`amoeLedgerSnapshotStub.ts`) STAYS in the tree — it still serves the allowlist branch. Only the points-ledger half of the trees object switches to the production reader. A follow-up PR will retire the stub once the allowlist publisher is wired.

**Failure mode:** if the reader throws `amoe_ledger_snapshot_unavailable` (epoch not yet published or builder produced a no-op for an empty epoch), the submit handler 5xxs. That's correct: an entry whose epoch has not been settled cannot be proven.

---

## 11. Operational prerequisites

Before PR 5b's cron can do anything useful in production:

1. **Owner calls `setPointsLedgerPublisher`** on the deployed `LotteryAmoeRouter`, supplying the EOA address derived from `AMOE_LEDGER_PUBLISHER_PRIVATE_KEY` (or the Privy owner). Without this, every broadcast reverts with `NotPointsLedgerPublisher`.
2. **Env vars provisioned** in Vercel:
   - `AMOE_LEDGER_PUBLISHER_PRIVATE_KEY` (or Privy variant)
   - `AMOE_LEDGER_PUBLISHER_ENABLED=1`
   - `CRON_SECRET` (already exists)
3. **Migration `034_amoe_publisher_runs.sql`** applied (Supabase + Vercel-Postgres mirror).
4. **`AMOE_SIGNUP_SALT`** set (already a PR 5a prerequisite for the projector to run).

Items 1–3 are tracked in a runbook companion doc shipped with PR 5b: `docs/security/amoe-pr5b-publisher-runbook.md`.

---

## 12. Test plan

### 12.1 Unit (vitest)

| Suite | Tests |
|---|---|
| `amoeLedgerPublisher.test.ts` | claim-the-row, lost-race-skip, projecting-phase-cursor-loop, building-phase-already-built passthrough, broadcasting-phase-success, broadcasting-phase-revert-decode, confirming-phase-success, confirming-phase-timeout-retry, empty-epoch-no-op, full-pipeline-round-trip with fake relay |
| `_amoePublishCron.handler.test.ts` | auth, feature-flag gate, no-publisher-key fallback, no-eligible-epochs no-op, multi-epoch tick with one error mid-batch, reclaim of stranded run |
| `amoeSubmitZk.handler-swap.test.ts` | `orchestrateAmoeSubmitZk` end-to-end with `AmoeLedgerSnapshotPgReader` instead of stub; reads a confirmed snapshot and produces a valid witness; 5xxs cleanly when reader throws unavailable |

### 12.2 Integration (still vitest, no real RPC)

A single `amoe-publisher-roundtrip.integration.test.ts`:

1. Seed 5 burns into points + amoe_zk_submissions for epoch 0 (timestamps inside the window).
2. Project → build → broadcast (with a fake relay that returns a synthetic txHash) → confirm (with a fake `waitForTransactionReceipt` that returns success) → run swap.
3. Run `orchestrateAmoeSubmitZk` for one of the 5 burns; assert the witness uses `pointsLedgerLeafIndex` matching the L1 row's locked-order position and `pointsLedgerSnapshot.root` matches the L2 confirmed root.
4. Verify `amoe_publisher_runs` ends in `phase='finished'`.

This is the single test that proves the full SoT loop works end-to-end without a live chain.

---

## 13. Rollout

1. Land PR 5b with `AMOE_LEDGER_PUBLISHER_ENABLED=0` in Vercel envs. Cron runs but immediately bails 503. Migration applied.
2. Owner calls `setPointsLedgerPublisher(<EOA>)` on Base mainnet.
3. Provision `AMOE_LEDGER_PUBLISHER_PRIVATE_KEY` and flip `AMOE_LEDGER_PUBLISHER_ENABLED=1`.
4. Watch the next 4 ticks (1h) for `phase='finished'` rows on the first eligible epoch. Spot-check `pointsLedgerRootOf[E]` on Etherscan matches the L2 `points_ledger_tree_root_hex`.
5. Flip `AMOE_ZK_SUBMIT_ENABLED=1`. Real entries start producing real proofs that verify against real published roots.

Each step is independently reversible — the kill switches are explicit.

---

## 14. Open questions for review

1. **Cron cadence** — `*/15 * * * *` matches my analysis but might be overkill once we know the publish takes < 30s. Acceptable to start at 15m and tighten later?
2. **`MAX_EPOCHS_PER_TICK = 3`** — chosen to bound Vercel function wall-clock. Backfill of an outage longer than ~3h would require either a one-shot ops script or a higher cap. Accept as-is and add the script if/when needed?
3. **Empty-epoch handling** — current proposal: `phase='finished_no_op'`, no on-chain call, reader 5xxs subsequent submits for that epoch. Alternative: broadcast a sentinel non-zero root (e.g. `keccak256("amoe_empty_epoch")`) so reads succeed-but-no-leaves. The first is simpler and matches the contract's zero-root rejection; the second avoids a class of 5xx errors. Going with simpler unless review pushes back.
4. **Re-broadcast on timeout** — §8 sketches treating mempool-drop as a recoverable error. Worth a separate column `tx_attempts JSONB` for full audit history, or is `last_error` plus the on-chain event log sufficient?

---

## 15. References

- PR 5a (#445) merged commit `bc63e13`
- Hotfix #448 (epoch genesis fix), commit `c8c193f`
- `docs/security/amoe-points-burn-ledger-sot.md` — overall design
- `docs/security/amoe-pr3-handler-swap-plan.md` — the stub being replaced
- `docs/security/amoe-pr4-replay-store-design.md` — the existing `FOR UPDATE SKIP LOCKED` pattern this design mirrors
- `contracts/utilities/lottery/zk/LotteryAmoeRouter.sol:293` — `setPointsLedgerRoot`
