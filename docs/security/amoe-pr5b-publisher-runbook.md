# AMOE Points-Burn Ledger Publisher — Operational Runbook

This runbook is the operational counterpart to [`amoe-pr5b-publisher-design.md`](./amoe-pr5b-publisher-design.md). It describes what operations does, in what order, and what NEVER to do when rolling out, monitoring, or recovering the AMOE points-burn ledger publisher cron (`/api/v1/lottery/amoe/publish-cron`).

This document is intentionally narrow. For protocol-level context (why the projector exists, how the snapshot reader is wired into the ZK submit handler) see the design doc. For witness/proof internals see [`amoe-points-burn-ledger-sot.md`](./amoe-points-burn-ledger-sot.md).

---

## Hard rules

1. **Never flip `AMOE_LEDGER_PUBLISHER_ENABLED=1` before the on-chain allowlist call has landed.** Without `LotteryAmoeRouter.setPointsLedgerPublisher(<EOA>)`, every broadcast reverts with `NotPointsLedgerPublisher`. The cron will keep eating credits until it's flipped back off.
2. **Never reuse `AMOE_RELAY_PRIVATE_KEY` as the publisher key.** The relay key signs user-flow transactions; mixing it with the publisher role widens the blast radius and breaks role attribution. Use `AMOE_LEDGER_PUBLISHER_PRIVATE_KEY` (or the Privy CSW variant).
3. **Never manually write to `amoe_publisher_runs` to "fix" a stuck epoch.** The lifecycle is monotonic and the partial-unique index on `(epoch) WHERE finished_at IS NULL` is the only correctness gate. The supported recovery is: mark the in-flight row `errored` + set `finished_at = NOW()`, then let the next cron tick re-claim. Never roll a phase backwards.
4. **Never "rebroadcast" an epoch's root by hand.** The router has a one-shot guard (`PointsLedgerEpochAlreadyPublished`) — a duplicate call will revert and waste gas, and the audit trail will look like an unauthorized publisher attempt. If a confirmed snapshot exists for the epoch, the work is done.
5. **Never modify migration `034_amoe_publisher_runs.sql` or the Supabase mirror once they have shipped to a database.** Any schema change ships as a new forward-only migration.

---

## Pre-flight (one-time, in order)

### Step 0 — Confirm prerequisites already merged

PR 5a (#445), the genesis-fix hotfix (#448), PR 5b cron (#450), and the PR 5b → main lift (#451) must all be on `main` before this runbook can be executed. PR #451 is what ports the cron + the migration files into `main`; without it, Step 1's migration paths do not exist on `origin/main`.

Verify each PR's merge commit landed on `main` (do NOT rely on `main`'s tip message — a later unrelated commit can mask a missing prereq):

```bash
for PR in 445 448 450 451; do
  echo "=== PR #$PR ==="
  gh pr view "$PR" --repo wenakita/4626 \
    --json number,state,mergedAt,mergeCommit,baseRefName \
    --jq '{number, state, baseRefName, mergedAt, mergeCommit: .mergeCommit.oid}'
done
```

For each PR, confirm:

- `state == "MERGED"`
- `baseRefName == "main"` (PR #450 merged into `feat/amoe-epoch-genesis-fix`, not `main` directly — it lands on `main` transitively via #451; that is fine, but #451 itself MUST show `baseRefName == "main"`)
- `mergeCommit.oid` is reachable from `main`:

```bash
for SHA in <oid_445> <oid_448> <oid_451>; do
  git fetch origin main >/dev/null 2>&1
  git merge-base --is-ancestor "$SHA" origin/main \
    && echo "$SHA: ON main" \
    || echo "$SHA: NOT on main — STOP"
done
```

If any SHA reports `NOT on main`, do NOT proceed — the runbook's migration and code references will not resolve.

The `AMOE_SIGNUP_SALT` env var must already be provisioned (PR 5a prerequisite). If not, the projector can never run.

### Step 1 — Apply the migration

> **Prerequisite:** PR #451 must be merged to `main` first — the migration files referenced below are introduced by that PR. Re-run Step 0 if unsure.

Run [`frontend/db/migrations/034_amoe_publisher_runs.sql`](../../frontend/db/migrations/034_amoe_publisher_runs.sql) on **both** databases:

- Vercel-Postgres (the hot path the cron reads/writes).
- Supabase mirror (`supabase/migrations/20260429020000_amoe_publisher_runs.sql`) — must apply identical content.

Verify after apply:

```sql
\d amoe_publisher_runs
SELECT indexname FROM pg_indexes
  WHERE tablename = 'amoe_publisher_runs';
-- Must include: amoe_publisher_runs_inflight_epoch (UNIQUE, partial)
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'amoe_zk_submissions'
  AND column_name = 'twitter_credit_nullifier_hex';
-- Must return one row.
```

If the partial-unique index is missing, the lock semantics are silently broken and two pods can publish the same epoch. STOP here and re-run the migration.

### Step 2 — Provision Vercel env vars

All vars are project-scoped (Production environment). Set them BEFORE flipping the enable flag.

| Variable | Required | Notes |
|---|---|---|
| `AMOE_LEDGER_PUBLISHER_PRIVATE_KEY` | one-of | Direct EOA signer. 0x-prefixed hex. **NEVER** the relay key. |
| `AMOE_LEDGER_PUBLISHER_PRIVY_WALLET_ID` | one-of | Privy CSW wallet ID. Used together with `_OWNER_ADDRESS`. |
| `AMOE_LEDGER_PUBLISHER_OWNER_ADDRESS` | with Privy | EOA owner of the CSW. |
| `AMOE_LEDGER_PUBLISHER_SMART_WALLET` | with Privy | Smart-wallet address (the on-chain caller). |
| `AMOE_LEDGER_PUBLISHER_BUNDLER_URL` | with Privy | ERC-4337 bundler endpoint. |
| `AMOE_LEDGER_PUBLISHER_BASE_RPC` | optional | Falls back to `BASE_RPC_URL`. |
| `AMOE_LEDGER_PUBLISHER_POD_ID` | optional | Override for the `claimed_by` field; otherwise generated from Vercel deployment id. |
| `AMOE_LEDGER_PUBLISHER_ENABLED` | YES (last) | Set to `1` to start the cron. **DO THIS LAST.** |
| `AMOE_ZK_SUBMIT_ENABLED` | YES | Already required by PR 4. |
| `CRON_SECRET` | YES | Already required by PR 4 retry cron. |
| `AMOE_SIGNUP_SALT` | YES | Already required by PR 5a. |

Provide either the direct-key option OR the Privy-CSW option. If neither is set, the cron handler returns `200 { skipped: 'no_publisher_key_configured' }` every tick — safe but useless.

### Step 3 — On-chain allowlist call (governance/owner)

On Base mainnet, the deployer/owner of `LotteryAmoeRouter` calls:

```solidity
router.setPointsLedgerPublisher(<EOA derived from AMOE_LEDGER_PUBLISHER_PRIVATE_KEY>);
// OR, when using Privy CSW:
router.setPointsLedgerPublisher(<AMOE_LEDGER_PUBLISHER_SMART_WALLET>);
```

The address MUST match the signer that the publisher will use. If they diverge, every `setPointsLedgerRoot` call reverts with `NotPointsLedgerPublisher`.

Verification:

```bash
cast call $LOTTERY_AMOE_ROUTER "pointsLedgerPublisher()(address)" --rpc-url $BASE_RPC_URL
# Must echo the configured signer address.
```

### Step 4 — Soak test on staging (recommended, not strictly required)

If a staging deploy is available with the same env wired:

1. Wait for an epoch boundary (`AMOE_EPOCH_LENGTH_SECONDS = 86_400`).
2. Confirm the next 15-minute tick produces exactly one row in `amoe_publisher_runs` with `phase = 'finished'` (or `'finished_no_op'` if the staging epoch was empty).
3. Re-trigger by hand a second time — second tick must show no new in-flight row (`pickNextEpochToPublish` returns `null`) and the response body should include `tick: 'nothing_to_publish'`.

### Step 5 — Production enable

Only after Steps 1–3 are green:

```
AMOE_LEDGER_PUBLISHER_ENABLED = 1
```

Re-deploy. The cron runs at `*/15 * * * *`. Monitor §Monitoring below for the first three ticks.

---

## Monitoring

### Per-tick observability

Every cron invocation logs (search Vercel logs by route `lottery/amoe/publish-cron`):

| `tick` value | Meaning | Healthy? |
|---|---|---|
| `nothing_to_publish` | Every closed epoch in the 14-epoch lookback already has a confirmed snapshot or `finished_no_op` terminal run. | ✅ Steady-state. |
| `finished` | Epoch was published; on-chain root confirmed. | ✅ Each closed non-empty epoch should produce exactly one of these. |
| `finished_no_op` | Closed epoch had zero AMOE burns; no on-chain write. | ✅ Expected for low-activity days. |
| `errored` | Run aborted; lock released; next tick will re-claim. | ⚠️  One-off is fine; repeated → page on-call. |
| `lost_claim` | Another pod won the race for this epoch. | ✅ Expected at most occasionally. |
| `pre_genesis` | `nowSec < AMOE_EPOCH_GENESIS_SECONDS`. | ✅ Will only ever appear in pre-launch test envs. |
| `disabled` | `AMOE_LEDGER_PUBLISHER_ENABLED != 1`. | ✅ Intentional kill-switch. |

### SQL probes

Run these against Vercel-Postgres (read-only is fine):

```sql
-- 1. Latest run per epoch (last 7 epochs).
SELECT epoch, phase, claimed_by, started_at, finished_at, last_error
FROM amoe_publisher_runs
WHERE epoch >= (SELECT MAX(epoch) FROM amoe_publisher_runs) - 7
ORDER BY epoch DESC, started_at DESC;

-- 2. Any in-flight runs (should be 0 or 1, never 2+).
SELECT epoch, claimed_by, claimed_at
FROM amoe_publisher_runs
WHERE finished_at IS NULL;

-- 3. Any stale claims (>10 min old, in-flight) — these get reclaimed
--    automatically on the NEXT tick, but persistent presence is a bug.
SELECT epoch, claimed_by, claimed_at, NOW() - claimed_at AS age
FROM amoe_publisher_runs
WHERE finished_at IS NULL
  AND claimed_at < NOW() - INTERVAL '10 minutes';

-- 4. Backlog: closed epochs in horizon with neither a confirmed snapshot
--    nor a finished_no_op terminal run. Steady state = 0.
WITH horizon AS (
  SELECT generate_series(
    GREATEST(0, ((extract(epoch from now())::bigint - 1_777_507_200) / 86_400) - 14),
    ((extract(epoch from now())::bigint - 1_777_507_200) / 86_400) - 1
  )::bigint AS epoch
),
done_snap AS (
  SELECT epoch FROM amoe_points_burn_ledger_snapshots
  WHERE publish_confirmed_at IS NOT NULL
),
done_noop AS (
  SELECT epoch FROM amoe_publisher_runs
  WHERE phase = 'finished_no_op' AND finished_at IS NOT NULL
)
SELECT h.epoch FROM horizon h
LEFT JOIN done_snap ds USING (epoch)
LEFT JOIN done_noop dn USING (epoch)
WHERE ds.epoch IS NULL AND dn.epoch IS NULL
ORDER BY h.epoch;
```

### On-chain probes

```bash
# Latest published epoch (per the router).
cast call $LOTTERY_AMOE_ROUTER "latestPublishedPointsLedgerEpoch()(uint64)" \
  --rpc-url $BASE_RPC_URL

# Root for a specific epoch (zero = unpublished).
cast call $LOTTERY_AMOE_ROUTER "pointsLedgerRootOf(uint64)(bytes32)" $EPOCH \
  --rpc-url $BASE_RPC_URL
```

The latest published epoch should advance by 1 per day in steady state, lagging the current epoch by exactly 1 (the cron always targets `currentEpoch - 1`).

### Alerts to wire

Page on-call when **any** of the following hold for >30 minutes:

1. `amoe_publisher_runs` has a row with `phase = 'errored'` and no later `finished` row for the same epoch.
2. The backlog query returns a non-empty result at the same epoch across three consecutive checks.
3. Any in-flight row's age exceeds 30 minutes (3× the stranded reclaim threshold).
4. `latestPublishedPointsLedgerEpoch()` falls behind `currentEpoch - 2` for more than one epoch length.

---

## Recovery procedures

### A. "Cron is producing repeated `errored` ticks for the same epoch"

Most common cause: env mis-provisioning (missing `BASE_RPC_URL`, RPC throttling, or the on-chain allowlist call hasn't landed). Recovery:

1. Pull the most recent `last_error` for that epoch:
   ```sql
   SELECT last_error FROM amoe_publisher_runs
   WHERE epoch = $E ORDER BY started_at DESC LIMIT 1;
   ```
2. If the message contains `NotPointsLedgerPublisher` → **the on-chain allowlist call is missing or wrong**. Re-run Step 3 of Pre-flight.
3. If the message contains `no_publisher_key_configured` → env not deployed. Re-run Step 2.
4. If the message contains `projector_cap_exceeded` → unusual burn volume; bump `MAX_PROJECTOR_ITERATIONS` in a fast-follow PR. Re-projection on the next tick is idempotent — no manual data fix needed.
5. If the message contains `timed_out_waiting_for_receipt` → RPC slow or tx evicted. The next tick will resume from `confirming` and re-poll for the receipt (or rebroadcast if needed). No action.

After unblocking, the next 15-minute tick will re-claim and resume from the recorded `phase`. If you cannot wait 15 minutes, you may invoke the cron URL by hand with the configured `CRON_SECRET`.

### B. "An in-flight row is stuck for >10 minutes but the next tick isn't reclaiming it"

The reclaim pass is the FIRST thing the cron does each tick. If it isn't picking up the row:

1. Confirm the row's `finished_at IS NULL` and `claimed_at < NOW() - INTERVAL '10 minutes'`.
2. Confirm the cron is actually running (Vercel cron logs).
3. Confirm `AMOE_LEDGER_PUBLISHER_ENABLED = 1`.

If all three are green and the row still persists, manually free it:

```sql
UPDATE amoe_publisher_runs
SET phase = 'errored',
    last_error = 'manual_reclaim:' || $REASON,
    finished_at = NOW()
WHERE id = $RUN_ID
  AND finished_at IS NULL;
```

This is the ONLY supported manual write to this table. The next tick will publish the epoch.

### C. "Two rows for the same epoch are both `phase != 'finished'` and both `finished_at IS NULL`"

This MUST be impossible — the partial-unique index `amoe_publisher_runs_inflight_epoch` rules it out. If you see it, the index is missing:

```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'amoe_publisher_runs'
  AND indexname = 'amoe_publisher_runs_inflight_epoch';
```

If the index is gone, **stop the cron** (`AMOE_LEDGER_PUBLISHER_ENABLED = 0`), recreate the index from migration 034, manually `errored` all but one of the duplicate rows, then re-enable.

### D. "Submit handler is 5xxing with `amoe_ledger_snapshot_unavailable`"

The submit handler reads from the snapshot reader; an `unavailable` error means the user's epoch hasn't been published yet (or was an empty epoch and no snapshot row exists).

- If the epoch is `currentEpoch` (still in progress) → expected. The user must wait for the epoch boundary plus one cron tick.
- If the epoch is `currentEpoch - 1` and ≥30 minutes have passed since the boundary → run the backlog query (§Monitoring SQL probes #4); if the epoch is in the backlog, treat as scenario (A).
- If the epoch had zero burns (`finished_no_op`), the snapshot row is intentionally absent. The submit attempt for that epoch is moot — there is nothing to prove against.

### E. Kill-switch

```
AMOE_LEDGER_PUBLISHER_ENABLED = 0
```

Re-deploy. Subsequent ticks return `200 { skipped: 'disabled' }` immediately. Already-finished snapshots remain on chain (idempotency); in-flight rows remain in-flight until reclaimed or manually `errored`.

The kill switch is safe to flip at any time. It does NOT roll back published roots — those are immutable by design (router enforces `EpochAlreadyPublished`).

---

## Re-review triggers

A re-review of the publisher's operating parameters is required when ANY of the following occur:

- A single epoch produces enough rows to hit `MAX_PROJECTOR_ITERATIONS = 32` × `batchSize = 500` = 16,000 burn rows. The cron will fail-closed (correct), but the constants need tuning.
- An epoch's `confirming` phase routinely exceeds `RECEIPT_WAIT_TIMEOUT_MS = 60s` due to chain congestion. The constant or the rebroadcast policy may need to change.
- The chosen signer address changes (key rotation, Privy CSW migration). The on-chain allowlist call MUST be re-run before the new signer's first tick.
- Migration 034 needs a forward-compatible amendment (adding a column for new observability, etc.).

---

## What this runbook does NOT cover

- The allowlist Merkle publisher. As of PR 5b only the **points-burn ledger** half of the witness is read from the production snapshot; the allowlist branch still uses `amoeLedgerSnapshotStub.ts`. A follow-up PR will retire the stub. Until then, the allowlist tree is single-leaf and operationally trivial.
- The witness/proof pipeline. See [`amoe-points-burn-ledger-sot.md`](./amoe-points-burn-ledger-sot.md) §3–§6.
- zkey hosting. Tracked separately under PR 6.

---

## Sibling cron — orphan-burn refund (PR 6c)

A second cron, `_amoeBurnRefundCron.ts`, ships alongside the publisher in PR 6c. It is unrelated to ledger publication — included here only so on-call has a single reference for both AMOE crons.

**Path:** `GET /api/v1/lottery/amoe/burn-refund-cron`
**Schedule:** `*/15 * * * *` (same cadence as the publisher).
**Purpose:** writes a compensating `+pointsBurned` row for any phase-A debit that has been orphaned (no `amoe_zk_submissions.state='settled'` for the same `spend_ref_id`) for more than `REFUND_AGE_EPOCHS` (default 7).

**Phase-A scope guard.** A debit only qualifies as an orphan if it has a matching row in `amoe_burn_credits_intents`. This guard prevents the cron from refunding legacy `POST /api/v1/lottery/amoe/submit` debits, which write the same `source='amoe_entry_spend'` rows but never write `amoe_zk_submissions` and so would otherwise be misclassified as orphans. See [`amoe-burn-then-submit-design.md`](./amoe-burn-then-submit-design.md) §5.1.1 for the full rationale.

**Atomic intent write.** The `amoe_burn_credits_intents` row is written inside the same single SQL statement as the debit, via a sibling `intent_ins` CTE in `consumeAmoeCreditsForEntry` that selects FROM the debit's `ins` CTE. Postgres single-statement transactional atomicity guarantees both rows commit together or neither does, so a transient DB failure cannot leave a debit without a marker (which would otherwise be permanently skipped by the `EXISTS` guard above and result in silent credit loss). The idempotent-retry path carries a parallel `intent_backfill` CTE so any pre-hotfix debit gets its marker written on the next retry. See [`amoe-burn-then-submit-design.md`](./amoe-burn-then-submit-design.md) §5.1.2 for the full Codex follow-up rationale and the structural canary that pins the invariant.

### Feature flags & tunables

| Env var | Default | Purpose |
|---|---|---|
| `AMOE_ZK_SUBMIT_ENABLED` | unset | Top-level enable for the ZK path. Missing → 503 `zk_path_disabled`. |
| `AMOE_REFUND_CRON_ENABLED` | unset | Per-cron enable. Missing → 503 `refund_cron_disabled`. |
| `AMOE_REFUND_AGE_EPOCHS` | `7` | Refund TTL in epochs (1 epoch = 86,400 s). |
| `AMOE_REFUND_MAX_PER_TICK` | `50` | Cap on refunds emitted per tick — backlog drains across ticks. |
| `CRON_SECRET` | (req'd) | Same secret used by the publisher cron. |

### Per-tick response shape

```json
{
  "ok": true,
  "tick": "refunded" | "no_orphans",
  "scannedCount": <int>,
  "refundedCount": <int>,
  "ageSec": <int>,
  "limit": <int>,
  "errors": [{"pointsId": "<id>", "message": "<truncated>"}]   // optional, only when present
}
```

* `tick: 'no_orphans'` — no work this round. Healthy steady state.
* `tick: 'refunded'` — one or more compensations written. Always informational; idempotent.
* `tick: 'errored'` (HTTP 500) — the entire tick threw before scanning. Investigate; the next tick will retry.
* Per-row errors flow through `errors` and DO NOT abort the tick.

### Production enable sequence

1. Confirm migration `035_amoe_entry_refund_source.sql` is applied: `points_amoe_eligible_balance` view's CASE includes `WHEN source = 'amoe_entry_refund' THEN amount`, AND `amoe_burn_credits_intents` table exists with primary key `(signup_id, spend_ref_id)`.
   ```sql
   -- Quick verification:
   SELECT to_regclass('public.amoe_burn_credits_intents');  -- expected: 'amoe_burn_credits_intents' (not NULL)
   ```
2. Set `AMOE_REFUND_CRON_ENABLED=1` in Vercel → Production env.
3. Re-deploy.
4. Watch the next 4 ticks (= 1 hour) in Vercel Logs:
   * Most should be `tick: 'no_orphans'` if the publisher cron and frontend phase-B flow are healthy.
   * Any `tick: 'refunded'` with a non-zero `refundedCount` is informational, not a fault.
   * Any `tick: 'errored'` page on-call.

### SQL probes (operator)

```sql
-- Recent refunds emitted by this cron.
SELECT signup_id, source_id AS spend_ref_id, amount, created_at
FROM points
WHERE source = 'amoe_entry_refund'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;

-- Orphan candidates the next tick would refund (count only).
-- Predicate (4) is the phase-A scope guard — see §5.1.1 of the design doc.
SELECT COUNT(*)
FROM points p
WHERE p.source = 'amoe_entry_spend'
  AND p.amount < 0
  AND p.created_at < NOW() - (INTERVAL '1 second' * 86400 * 7)
  AND NOT EXISTS (
    SELECT 1 FROM amoe_zk_submissions s
    WHERE s.signup_id = p.signup_id AND s.spend_ref_id = p.source_id AND s.state = 'settled'
  )
  AND NOT EXISTS (
    SELECT 1 FROM points r
    WHERE r.signup_id = p.signup_id AND r.source = 'amoe_entry_refund' AND r.source_id = p.source_id
  )
  AND EXISTS (
    SELECT 1 FROM amoe_burn_credits_intents i
    WHERE i.signup_id = p.signup_id AND i.spend_ref_id = p.source_id
  );

-- Legacy /submit debits that the cron will NEVER refund (sanity check).
-- This is the set the P1 fix protects — should grow as users use the
-- legacy submit handler, but should NEVER appear in `amoe_entry_refund`.
SELECT COUNT(*)
FROM points p
WHERE p.source = 'amoe_entry_spend'
  AND p.amount < 0
  AND NOT EXISTS (
    SELECT 1 FROM amoe_burn_credits_intents i
    WHERE i.signup_id = p.signup_id AND i.spend_ref_id = p.source_id
  );

-- Sanity: refund-source rows MUST never appear in the L1 ledger.
SELECT COUNT(*) FROM amoe_points_burn_ledger
WHERE source_points_id IN (
  SELECT id FROM points WHERE source = 'amoe_entry_refund'
);  -- expected: 0
```

The last probe enforces the security invariant: refund rows have `amount > 0` and the projector filters `amount < 0`, so any non-zero count indicates a projector regression and should page immediately.

### Kill switch

Unset `AMOE_REFUND_CRON_ENABLED` (or set to anything other than `'1'`) and re-deploy. Subsequent ticks return `503 { error: 'refund_cron_disabled' }`. Already-emitted refund rows remain in `points` (idempotency).

---

## Change log

| Date | Change |
|---|---|
| 2026-04-30 | Initial runbook, shipping with PR 5b (#450) follow-up. |
| 2026-04-30 | Added orphan-burn refund cron (PR 6c) section. |
| 2026-04-30 | PR 6c P1 fix — documented `amoe_burn_credits_intents` phase-A scope guard. |
| 2026-04-30 | PR 6c P1 v2 — documented atomic intent insert (Codex follow-up on #464); intent row now written inside debit CTE, eliminating post-debit race window. |
