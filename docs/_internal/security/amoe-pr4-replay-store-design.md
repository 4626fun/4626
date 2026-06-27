---
title: AMOE PR 4 — Replay Store + ManagerDeclinedEntry Retry
sidebar_position: 5
---

# AMOE PR 4 — Replay Store + Manager-Declined-Entry Retry

**Status:** design proposal (not yet implemented)
**Branches off:** `main` (after PR 3 merges)
**Target branch name:** `feat/amoe-zk-replay-store`
**Estimated diff size:** ~+450 / −20 LoC + 1 SQL migration
**Depends on:** PR 3 (handler swap) merged
**Unblocks:** §2 step 5

**Related:**
- [`amoe-pr3-handler-swap-plan.md`](./amoe-pr3-handler-swap-plan.md) — handler this plugs into
- [`amoe-points-burn-ledger-sot.md`](./amoe-points-burn-ledger-sot.md) — ledger context
- [`amoe-plonk-migration.md`](./amoe-plonk-migration.md) — overall §2 arc
- `contracts/utilities/lottery/zk/LotteryAmoeRouter.sol` — on-chain replay invariants this mirrors

---

## 1. What this PR does

Introduce an off-chain replay store that mirrors the on-chain
nullifier maps in `LotteryAmoeRouter` and adds two state machines
the on-chain layer cannot express:

1. **In-flight tracking.** Between proof generation and on-chain
   confirmation, the same `(nonce, wallet)` could legitimately be
   submitted twice (UI double-click, retry on flaky network). The
   on-chain mapping rejects the second one with `NonceReplayed` —
   but the user has already paid for two PLONK proofs and the second
   error message is wrong (it should say "submission in flight",
   not "replay attempt").

2. **`ManagerDeclinedEntry` retry.** The router's lines 392\u2013403
   intentionally revert the entire transaction (rolling back the
   nullifier writes) when `manager.processAmoeEntry` returns 0
   (inactive coin / below `minSwapAmount` / lottery paused). The
   user's proof is reusable — but only if someone tracks that the
   proof exists, why it failed, and when conditions become
   favorable again.

Plus a small operational win: the store gives us a single audit
table that joins together "user submitted" + "proof generated" +
"on-chain outcome" + "credits debited" for every AMOE attempt. PR 3
ships without this; debugging a stuck submission today means joining
three different log streams.

## 2. Scope

### In scope

- New table: `amoe_zk_submissions` \u2014 the replay store.
- Submit-handler integration: write before proof generation, update
  through state transitions, dedupe on key collisions.
- New retry endpoint: `POST /api/v1/lottery/amoe/retry-zk` \u2014 lets a
  user (or the relayer cron) re-broadcast a stored proof when a
  `ManagerDeclinedEntry` had blocked it.
- A modest cron (`amoe_retry_cron`, 5 min cadence) that walks
  `manager_declined` rows and retries them up to a bounded retry
  budget.
- Observability: every state transition emits a structured log line
  + a counter increment, surfaced in the existing dashboard.

### Out of scope

- Anything that touches `LotteryAmoeRouter.sol` (already shipped) or
  `CreatorLotteryManager.sol` (forbidden without approval).
- The points-ledger publisher (PR 5) and zkey hosting (PR 6).
- Tearing down the legacy `/submit-amoe` endpoint \u2014 still a future PR.
- Cross-replica coordination for the cron (single Vercel cron worker
  is sufficient at v1 volume; revisit if AMOE volume \u00d7 10).

## 3. State model

```
                      submit handler enters
                              \u2502
                              \u25bc
                       \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
                       \u2502  pending  \u2502   row inserted before prove
                       \u2514\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2518
                            \u2502
              prove ok       \u2502    prove fail (witness invalid /
              prove returns  \u2502    snarkjs crash)
                             \u25bc
                       \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
                       \u2502  proven  \u2502
                       \u2514\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2518
                            \u2502
              relay broadcast ok
                             \u25bc
                       \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
                       \u2502  broadcast \u2502
                       \u2514\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2518
                          \u2502      \u2502
              tx mined ok \u2502      \u2502 tx reverted with
              entry settled\u2502      \u2502 ManagerDeclinedEntry
                          \u25bc      \u25bc
                  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510   \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
                  \u2502  settled \u2502   \u2502  manager_declined  \u2502 \u25c4\u2500\u2500\u2510
                  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518   \u2514\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518    \u2502
                                       \u2502                  \u2502
                                       \u25bc                  \u2502 retry cron
                                  retry attempt           \u2502 (bounded)
                                       \u2502\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
                                       \u25bc
                       (back to broadcast)


    Terminal failure paths:
                       \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
                       \u2502  prove_failed  \u2502  permanent (witness invariant broken)
                       \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
                       \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
                       \u2502  abandoned     \u2502  retry budget exhausted
                       \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
                       \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
                       \u2502  rejected_chain\u2502  on-chain revert that is NOT
                       \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518  ManagerDeclinedEntry (e.g. bad proof,
                                              UnknownEpoch). User-actionable
                                              error returned to caller.
```

State invariants:

- `pending`, `proven`, `broadcast`, `manager_declined` are
  transient.
- `settled`, `prove_failed`, `abandoned`, `rejected_chain` are
  terminal.
- Any non-`settled` terminal state means the on-chain nullifiers
  for this submission are NOT marked used \u2014 the user can craft a
  new submission with a fresh nonce.
- `manager_declined` is the only state that is "retryable as-is":
  the same proof + same nullifiers are still usable because the
  router reverted them.

## 4. Schema

```sql
CREATE TABLE amoe_zk_submissions (
  -- Primary identity
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Caller binding
  signup_id                BIGINT       NOT NULL,
  wallet_address           TEXT         NOT NULL,
  creator_coin             TEXT         NOT NULL,
  epoch                    BIGINT       NOT NULL,

  -- Proof commitments (canonical bytes32 hex; NULL until 'proven')
  nonce_commit_hex         TEXT,
  wallet_commit_hex        TEXT,
  points_burn_nullifier_hex TEXT,

  -- The proof + pubInputs blob (kept for retry; NULL pre-prove and post-settle)
  proof_blob               JSONB,        -- { proof: bigint[], pubInputs: bigint[] }
  proof_kept_until         TIMESTAMPTZ,  -- proof_blob is GC'd after this; ~7 days

  -- Points burn binding
  spend_ref_id             TEXT         NOT NULL,
  points_burned            BIGINT       NOT NULL,

  -- State
  state                    TEXT         NOT NULL,    -- enum, see CHECK below
  state_reason             TEXT,                      -- human/structured reason for terminal states

  -- Lifecycle timestamps
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  proven_at                TIMESTAMPTZ,
  broadcast_at             TIMESTAMPTZ,
  settled_at               TIMESTAMPTZ,

  -- On-chain trace (when applicable)
  tx_hash                  TEXT,
  block_number             BIGINT,
  manager_entry_id         BIGINT,

  -- Retry accounting
  retry_count              SMALLINT     NOT NULL DEFAULT 0,
  next_retry_at            TIMESTAMPTZ,
  last_retry_error         TEXT,

  CONSTRAINT amoe_zk_submissions_state_chk CHECK (
    state IN (
      'pending',
      'proven',
      'broadcast',
      'manager_declined',
      'settled',
      'prove_failed',
      'rejected_chain',
      'abandoned'
    )
  ),

  -- A single in-flight or terminal submission per replay key.
  -- Replay key mirrors the router's three on-chain mappings:
  --   nonce_commit       (global)
  --   wallet_commit      (per epoch)
  --   points_burn_null   (global)
  -- We enforce on nonce_commit_hex once it's non-NULL because that
  -- field exists once per proof and is the strictest gate.
  CONSTRAINT amoe_zk_submissions_nonce_unique
    UNIQUE NULLS NOT DISTINCT (nonce_commit_hex)
);

CREATE INDEX amoe_zk_submissions_signup_state_idx
  ON amoe_zk_submissions (signup_id, state, created_at DESC);

CREATE INDEX amoe_zk_submissions_retry_idx
  ON amoe_zk_submissions (next_retry_at)
  WHERE state = 'manager_declined';

CREATE INDEX amoe_zk_submissions_pubnull_idx
  ON amoe_zk_submissions (points_burn_nullifier_hex)
  WHERE points_burn_nullifier_hex IS NOT NULL;

CREATE INDEX amoe_zk_submissions_walletcommit_idx
  ON amoe_zk_submissions (epoch, wallet_commit_hex)
  WHERE wallet_commit_hex IS NOT NULL;
```

`UNIQUE NULLS NOT DISTINCT` (Postgres 15+) is what gives us "one
in-flight pending row per nonce" while still allowing many
`pending` rows that haven't yet been assigned a nonce_commit. If we
need to support PG <15 the same shape is achievable with a partial
unique index `WHERE nonce_commit_hex IS NOT NULL`.

## 5. Handler integration

The PR 3 handler grows three new touchpoints. Sketch:

```typescript
// step 0: insert pending row (before proof generation)
const submissionId = await replayStore.insertPending({
  signupId, wallet, creatorCoin, epoch, spendRefId, pointsBurned,
})

try {
  const witness = await assembleAmoeWitness({ /* ... */ })

  // step 1: prove
  const { proof, pubInputs } = await proveAmoeEntryPlonk(witness, {
    wasmPath: AMOE_WASM_PATH, zkeyPath: AMOE_ZKEY_PATH,
  })
  await replayStore.markProven(submissionId, {
    proof, pubInputs, /* derived hex commits */,
  })

  // step 2: dedupe-check before relay
  //   The unique constraint on nonce_commit_hex prevents a second
  //   `pending` row hitting `proven`. We additionally check the
  //   *settled* / *broadcast* states so we can return a clean 409
  //   instead of the relay-side revert.
  const conflict = await replayStore.findActiveByNonceCommit(nonceCommitHex)
  if (conflict && conflict.id !== submissionId) {
    await replayStore.markRejectedChain(submissionId, 'duplicate_nonce_in_flight')
    throw new AmoeProofGenerationError('duplicate_nonce_in_flight', \u2026)
  }

  // step 3: broadcast
  await replayStore.markBroadcasting(submissionId)
  const txHash = await relayAmoeEntryTransaction({ /* \u2026 */ })

  // step 4: confirm + classify
  const receipt = await waitForReceipt(txHash, { timeoutMs: 60_000 })
  if (receipt.status === 'success') {
    await replayStore.markSettled(submissionId, { txHash, blockNumber, managerEntryId })
  } else {
    const declined = decodeManagerDeclinedRevert(receipt)
    if (declined) {
      await replayStore.markManagerDeclined(submissionId, {
        txHash, reason: declined.reason, nextRetryAt: now() + 30_min,
      })
      // Return 202 to caller \u2014 retry endpoint / cron will pick it up.
    } else {
      await replayStore.markRejectedChain(submissionId, decodeRevertReason(receipt))
      throw new AmoeProofGenerationError(/* \u2026 */)
    }
  }
} catch (err) {
  if (!isAlreadyTerminal(submissionId)) {
    await replayStore.markProveFailed(submissionId, err)
  }
  throw err
}
```

Important: the `replayStore.markProven` call writes the
`nonce_commit_hex` value, which is the column that has the unique
constraint. A concurrent submit racing the same wallet with the same
nonce would lose this race deterministically and return a clean 409
to the loser.

## 6. Retry endpoint + cron

### 6.1 `POST /api/v1/lottery/amoe/retry-zk`

Request: `{ submissionId: UUID }`. The handler:

1. Looks up the row; rejects unless `state = 'manager_declined'`
   AND the caller's auth context owns `signup_id`.
2. Re-checks pre-flight conditions (manager active, coin active,
   epoch still equal to the row's epoch). If the epoch has rolled,
   the proof is no longer valid for that epoch \u2014 transition to
   `abandoned` with `state_reason = 'epoch_rolled'`.
3. Re-broadcasts using the stored `proof_blob`. **Same nullifiers**
   (router's mappings are still empty for this submission because
   the prior tx reverted).
4. Same confirm + classify as the main handler. On
   `ManagerDeclinedEntry` again, increment `retry_count` and
   schedule `next_retry_at`.

### 6.2 `amoe_retry_cron`

Cadence: every 5 minutes.

```
SELECT id
FROM amoe_zk_submissions
WHERE state = 'manager_declined'
  AND next_retry_at <= NOW()
  AND retry_count < AMOE_MAX_RETRIES   -- 8
ORDER BY next_retry_at
LIMIT 50
FOR UPDATE SKIP LOCKED;
```

Each picked-up row gets the same retry path as §6.1. After
`AMOE_MAX_RETRIES`, transition to `abandoned`. Default backoff is
exponential with jitter: `30m * 2^(retry_count) + uniform(0, 5m)`,
capped at 24h.

The cron is **idempotent and lock-free** at the DB level via
`FOR UPDATE SKIP LOCKED` \u2014 multiple cron replicas can run safely.

### 6.3 Why a manual endpoint AND a cron

- The cron handles the steady-state recovery (lottery paused, then
  resumed; coin temporarily inactive, then activated).
- The manual endpoint is for impatient users who see "submission
  pending" in the UI and want to nudge a retry. Both call the same
  internal `retrySubmission(id)` function.

## 7. Garbage collection of `proof_blob`

The proof + pubInputs blob is ~5 KB per row. Storing it forever is
fine at v1 volume but unnecessary. Policy:

- `settled` and `prove_failed` rows: clear `proof_blob` on transition
  (no use case for it).
- `rejected_chain` and `abandoned` rows: clear `proof_blob` after 7
  days (`proof_kept_until`). The 7-day window gives operators time
  to forensically inspect a failure case.
- `manager_declined` rows: keep `proof_blob` until terminal state.
  This is the only state where the blob is functionally required.

A nightly GC job nulls out `proof_blob` where
`proof_kept_until < NOW()`. The row itself is kept indefinitely
for audit (it joins back to the points ledger via `spend_ref_id`).

## 8. Error vocabulary additions

These slot into the existing `AmoeProofGenerationErrorCode` union:

| Code | HTTP | Meaning |
|---|---|---|
| `submission_in_flight` | 409 | The same `nonce_commit` is already pending/proven/broadcast. |
| `submission_already_settled` | 409 | The same `nonce_commit` already has a `settled` row. |
| `submission_manager_declined` | 202 | First broadcast hit `ManagerDeclinedEntry`. Caller should poll status or call retry-zk. |
| `submission_abandoned` | 410 | Retry budget exhausted. Caller must build a fresh submission with a new nonce. |
| `submission_epoch_rolled` | 410 | Submission stayed pending past its epoch boundary; proof no longer valid against this epoch. |

## 9. Test plan

### Unit (replay-store helpers)

- Insert pending; markProven; markBroadcasting; markSettled
  round-trip.
- Concurrent insertPending with same nonce \u2014 only one wins (PG
  unique-constraint test).
- markManagerDeclined sets `retry_count = 0`, `next_retry_at`
  60+ minutes out.
- 8 consecutive markManagerDeclined transitions to `abandoned`.
- proof_blob GC: `settled` rows cleared immediately, `manager_declined`
  rows preserved.

### Handler integration

- Submit \u2192 settle: state walks pending \u2192 proven \u2192 broadcast \u2192 settled.
- Submit \u2192 prove crash: state walks pending \u2192 prove_failed.
- Submit \u2192 ManagerDeclinedEntry: state walks pending \u2192 proven \u2192
  broadcast \u2192 manager_declined; retries via cron.
- Double-submit same nonce: second call returns 409 with
  `submission_in_flight` (clean error message, no on-chain attempt).

### Retry semantics

- Manual retry on `manager_declined`: re-broadcasts same proof.
- Manual retry on terminal state: returns 410 / 409 appropriate.
- Cron retry respects `next_retry_at` (no early retries).
- Cron retry skips rows other workers have locked.

### Negative

- Auth mismatch on retry endpoint (caller != owner of signup_id):
  401.
- Submission for unknown epoch: rejected at the existing handler
  guard, never reaches the replay store.

Target: ~30 new tests. Total suite goes from PR 3's ~180 to ~210.

## 10. Operational shape

### Metrics

- `amoe.zk.submissions.created` (counter) by `wallet_state`
  (new/repeat).
- `amoe.zk.submissions.state_transitions{from,to}` (counter).
- `amoe.zk.submissions.proof_duration` (histogram).
- `amoe.zk.submissions.broadcast_duration` (histogram).
- `amoe.zk.retries.cron_picks` (counter).
- `amoe.zk.retries.exhausted` (counter \u2014 alert when this fires).
- `amoe.zk.submissions.in_state{manager_declined}` (gauge \u2014 alert
  if it grows monotonically without retries clearing it).

### Alerts

- `manager_declined > 50 rows` for >15 minutes \u2014 likely the
  manager is paused / coin de-activated; page on-call.
- Any `prove_failed` outside CI: page on-call (witness invariant
  broken implies a regression in PR 3 or PR 2).
- `retries.exhausted` > 0 in any 1h window \u2014 on-call investigates;
  these are users who lost an entry's worth of credits without
  settling and may need a manual top-up.

### Dashboards

- "AMOE ZK funnel" \u2014 sankey from `pending` through terminals.
- "AMOE ZK retry pipeline" \u2014 row count by `manager_declined`
  retry-count bucket.

## 11. Migration / rollout

- No on-chain change \u2014 ships behind no flag.
- DB migration is additive (new table); safe to deploy ahead of
  code.
- Code is gated by the same `AMOE_ZK_SUBMIT_ENABLED` flag from PR 3;
  flipping that flag turns on the replay store too.
- Backfill: not needed. PR 3's stub will have created zero rows
  (it's flag-off in production), so the table starts clean at
  cutover.

## 12. Not to be touched

- `LotteryAmoeRouter.sol` \u2014 already correct, no change needed.
- `CreatorLotteryManager.sol` \u2014 forbidden without approval.
- The legacy `/submit-amoe` endpoint \u2014 still in service.
- Submodule `lib/liquidity-launcher` \u2014 unrelated drift.

## 13. Open questions (deferable to PR review)

1. **Idempotency key from caller.** Should the submit endpoint
   accept an optional `idempotencyKey` header so a retried HTTP call
   from the same client returns the existing submission's status
   instead of trying to create a new pending row? The
   `nonce_commit_hex` unique constraint already gives us most of
   this, but the constraint only kicks in at `proven`, not
   `pending`. Worth adding only if we see UI double-tap volume in
   staging. Default this PR: skip.

2. **Cross-replica cron.** v1 ships a single Vercel cron worker.
   `FOR UPDATE SKIP LOCKED` makes multi-replica safe whenever we
   need it; revisit at >100 retries/min sustained.

3. **Refund / top-up policy for `abandoned` rows.** A user whose
   submission abandons after credits were debited has lost real
   value. Options: (a) auto-refund credits on `abandoned`
   transition, (b) credit-event audit table queue for ops review,
   (c) do nothing (rely on out-of-band support). Default this PR:
   (b) \u2014 enqueue an audit row, ops decides per case. Codify in a
   later PR once we have real volume data.

---

**Last updated:** 2026-04-29
**Reviewers needed:** AMOE on-call, infra (DB migration approval),
on-chain owner (confirm PR 4 makes no on-chain change \u2014 spoiler:
it doesn't).
