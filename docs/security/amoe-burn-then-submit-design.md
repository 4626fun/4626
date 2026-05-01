# AMOE PR 6 (proposed) — Burn-then-Submit Split

**Status:** DRAFT — design only, no code changes.
**Author:** [@wenakita](https://github.com/wenakita)
**Depends on:** #451 merged (PR 5b on `main`), `AMOE_ZK_SNAPSHOT_READER_ENABLED=0` deployed.
**Unblocks:** flipping `AMOE_ZK_SNAPSHOT_READER_ENABLED=1` (i.e. retiring the stub for AMOE points-burn proofs).

---

## 1. Why this PR exists

PR 5b wired `AmoeLedgerSnapshotPgReader` into `_amoeSubmitZk.ts` so the points-burn half of the witness reads from the **confirmed** L2 snapshot instead of the fail-loud stub. Codex review caught — and we confirmed in the #451 hotfix — that the existing handler ordering makes the reader path impossible:

```
1. insertPending           (writes amoe_zk_submissions row)
2. orchestrate(...)        ← reader.readSnapshotForBurn(signupId, spendRefId)
3. markProven / relay / markSettled
4. consumeAmoeCreditsForEntry  ← creates the L1 burn row in `points`
                                   → projector tick → L1 → publisher → L2 snapshot
```

At step 2 there is **no L1 burn row** for `(signup_id, spend_ref_id)` yet — the row is only created at step 4. Even if it existed, the reader returns `epoch = currentEpoch` while:

- the orchestrator's epoch invariant compares against `computeAmoeEpoch(now) = currentEpoch`, and
- the publisher only confirms `currentEpoch - 1` (per [amoe-points-burn-ledger-sot.md §347](./amoe-points-burn-ledger-sot.md): "Max snapshot age accepted by submit: current_epoch - 1").

So the reader is wired but dormant behind `AMOE_ZK_SNAPSHOT_READER_ENABLED` (default OFF). This PR makes the reader path **actually usable**.

---

## 2. Locked invariants (do not change)

These are inherited from PR 3 / 5a / 5b and MUST hold across the split:

| Invariant | Source |
|---|---|
| Linear odds: `$1 = 4 PPM`, capped at `$10K = 40_000 PPM`, absolute cap `15% = 150_000 PPM` | `LotteryAmoeRouter.sol` |
| AMOE points range: `100 .. 1_000_000` | `lotteryAmoe.ts:1308-1311` |
| `pointsBurnedAsUSD = points * 10_000` | `amoeWitness.ts` |
| 8 public inputs in the PLONK verifier | circuit |
| `points (signup_id, source, source_id)` partial unique index → ON CONFLICT DO NOTHING | `034`-era schema |
| `AMOE_EPOCH_GENESIS_SECONDS = 1_777_507_200n`, `LENGTH = 86_400n` | `amoeWitness.ts` |
| Reader filters `publish_confirmed_at IS NOT NULL` (state 3 only) | `amoeLedgerSnapshotReader.ts` |
| `setPointsLedgerRoot` reverts for any sender ≠ `pointsLedgerPublisher` | `LotteryAmoeRouter:294` |
| Submit accepts snapshots aged `current_epoch - 1` only | [SoT §347](./amoe-points-burn-ledger-sot.md) |
| Never modify `CreatorLotteryManager.sol` without explicit approval | project rule |

---

## 3. The split — two endpoints, two phases

### 3.1 Phase A — `POST /api/v1/lottery/amoe/burn-credits`

**New endpoint.** Synchronous.

Input (subset of today's submit-zk body):

```ts
{
  wallet: `0x${string}`        // EIP-191 message-bound
  message: string              // signed envelope (re-used)
  signature: `0x${string}`
  pointsBurned: number         // 100..1_000_000
  spendRefId: string           // client-supplied idempotency key
  twitterHandle: string        // for nullifier domain
}
```

Behavior:

1. All of today's pre-flight in `_amoeSubmitZk.ts` lines 1–589 except `insertPending` and orchestration:
   - `guard` / rate limit / IP / durable rate limit
   - `resolveAmoeWallet` → profileId
   - EIP-191 message parse + `verifyAmoeWalletSignature`
   - `consumeAmoeNonceForSubmitMock`-equivalent — but see §3.5 on nonce handling
   - `getAmoeCreditSnapshot` pre-flight balance gate
2. **Burn**: `consumeAmoeCreditsForEntry({ wallet, requiredCredits: pointsBurned, refId: spendRefId })` — writes the L1 row in `points` with `source='amoe_entry_spend'`, `source_id=spendRefId`, `amount=-pointsBurned`. Idempotent on `(signup_id, source, source_id)` partial unique.
3. Returns:

```ts
{
  success: true,
  data: {
    spendRefId,                  // echoed
    burnedAt: <ISO timestamp>,
    burnEpoch: <currentEpoch>,   // the epoch the L1 row was written in
    eligibleSubmitAfter: <currentEpoch + 1 boundary as unix seconds>,
    creditsRemaining,
    creditsPerEntry,
    entriesAvailable
  }
}
```

The client now polls / waits until `currentEpoch >= burnEpoch + 1` AND the publisher has confirmed snapshot for `burnEpoch` (state 3). Then it calls phase B.

> **Observability.** The client SHOULD surface a deterministic ETA: `eligibleSubmitAfter` is just `(burnEpoch + 1) * AMOE_EPOCH_LENGTH_SECONDS + AMOE_EPOCH_GENESIS_SECONDS`. UI can show "your entry can be submitted at HH:MM UTC". After that timestamp, publisher confirmation typically lands within one cron tick (`MAX_EPOCHS_PER_TICK=1`, daily run). UX in §6.

### 3.2 Phase B — `POST /api/v1/lottery/amoe/submit-zk` (existing, modified)

Same body as today **except** the handler:

1. Skips `consumeAmoeCreditsForEntry` (already done in phase A).
2. Adds a pre-flight burn-row + snapshot-existence check via `AmoeLedgerSnapshotPgReader.readSnapshotForBurn({ signupId, spendRefId })`. Three outcomes:
   - **404 / 409** `amoe_burn_not_found` — no row in `amoe_points_burn_ledger` (i.e. no phase A call, or wrong `spendRefId`). Client should call phase A first.
   - **425 Too Early** `amoe_snapshot_not_yet_confirmed` — burn row exists but `epoch == currentEpoch` (still inside the epoch the burn happened) OR L2 snapshot not yet at state 3. Retry after the boundary.
   - **OK** — reader returns the confirmed L2 ctx; orchestrate runs unchanged with the **real** reader.
3. `markProven` / `relay` / `markSettled` flow unchanged.
4. **No `consumeAmoeCreditsForEntry` at the end.**

### 3.3 Net effect on ordering

```
Phase A (immediate):
  validate → burn (L1 row written)

Background (cron):
  projector → publisher → L2 snapshot confirmed (state 3) at epoch boundary

Phase B (after epoch + 1):
  validate → snapshot reader (state 3 hit) → orchestrate → relay → mark settled
```

The reader's `(signup_id, spend_ref_id)` lookup now always finds a row, and the `epoch == currentEpoch - 1` invariant always holds (because phase B is gated on `currentEpoch > burnEpoch`).

---

## 4. Data model changes

### 4.1 No new tables

`amoe_zk_submissions`, `amoe_points_burn_ledger`, `amoe_publisher_runs`, `amoe_points_burn_ledger_snapshots` all stay as-is.

### 4.2 New column: `amoe_zk_submissions.burn_completed_at` (nullable timestamptz)

**Optional.** Lets phase B short-circuit the reader call when the row's `burn_completed_at IS NOT NULL` and we've already confirmed it's `currentEpoch - 1` or older. Useful for retry storms; not strictly required for correctness.

If we add it, it ships in a new migration `frontend/db/migrations/035_amoe_zk_submissions_burn_completed_at.sql` + supabase mirror.

**Recommendation:** ship without; rely on the reader. Adds no new failure mode and keeps the change surface tight.

### 4.3 Idempotency key story

`spendRefId` is the join key across both phases — same role it has today. Phase A's `points (signup_id, source, source_id)` partial unique index dedupes a retried phase A call. Phase B's `amoe_zk_submissions (signup_id, spend_ref_id)` partial unique (introduced in PR 5a) dedupes a retried phase B call. No new dedupe machinery.

---

## 5. Failure modes & retries

| Scenario | Today | After split |
|---|---|---|
| User burns then closes browser | credits debited at end of submit; no orphan burn | credits debited in phase A; **orphan burn** if user never calls phase B |
| Phase A succeeds, phase B fails permanently | n/a | refund path — see §5.1 |
| Phase A succeeds, phase B called with wrong `spendRefId` | n/a | 404 `amoe_burn_not_found` (clear error) |
| Phase B called too early | n/a | 425 `amoe_snapshot_not_yet_confirmed` (clear error, retry) |
| Phase A retried with same `spendRefId` | n/a | idempotent — `points` ON CONFLICT DO NOTHING |
| Phase B retried with same `spendRefId` after success | already-settled response | already-settled response (unchanged) |
| Network partition mid phase A | partial burn possible? no — atomic `INSERT ... WHERE credits >= ...` | identical |
| Publisher cron stalled when client tries phase B | n/a (no reader) | 425 retry; ops monitoring SQL probes alert (per runbook §monitoring) |

### 5.1 Orphan burns — refund / expire

The new failure mode is: **phase A succeeded, phase B never called or never succeeded**. Three options, ranked:

**Option 1 (chosen — shipped in PR 6c): "burns expire after N epochs and refund automatically".**

- A new lightweight cron `_amoeBurnRefundCron.ts` walks `points` rows directly with `source='amoe_entry_spend' AND amount<0` that:
  - have NO matching `amoe_zk_submissions` row in state `settled`, AND
  - have NO existing `amoe_entry_refund` row (so re-running the cron is a no-op), AND
  - HAVE a matching row in `amoe_burn_credits_intents` (the phase-A scope guard — see below), AND
  - are older than `REFUND_AGE_EPOCHS` (default 7 epochs ≈ 7 days; tunable via `AMOE_REFUND_AGE_EPOCHS`).
- For each match, the cron INSERTs a compensating `+pointsBurned` row in `points` with `source='amoe_entry_refund'` and `source_id=spendRefId`. Idempotency is provided by the existing `points_unique_source_full` UNIQUE index — `ON CONFLICT DO NOTHING` makes a second-pass a no-op.
- Refund rows do NOT enter the on-chain ledger root — the L0 → L1 projector (`amoeLedgerProjector.ts:316-317`) filters `amount < 0`, so positive refunds cannot retroactively forge a Merkle leaf.
- Migration `035_amoe_entry_refund_source.sql` (mirrored to `supabase/migrations/20260430190000_amoe_entry_refund_source.sql`) adds (a) an `amoe_entry_refund` arm to the `points_amoe_eligible_balance` view's CASE so the compensation actually restores the user's eligible balance, and (b) the `amoe_burn_credits_intents` table described below.
- Implementation chose to scan `points` (L0) directly rather than `amoe_points_burn_ledger` (L1) so the cron remains correct even when the publisher cron is paused, mis-deployed, or behind. We did NOT add an `expired_at` column on L1 — the TTL is computed at query time from `points.created_at`, which is simpler and avoids a destructive migration.

#### 5.1.1 Phase-A scope guard — `amoe_burn_credits_intents`

A naive orphan-detection query that just looks for `source='amoe_entry_spend' AND amount<0` rows lacking a settled `amoe_zk_submissions` row will incorrectly classify legitimate **legacy** debits as orphans. The legacy `POST /api/v1/lottery/amoe/submit` handler (`frontend/api/_handlers/v1/lottery/_amoeSubmit.ts`) calls `consumeAmoeCreditsForEntry` after a successful relay, so it writes the same `source='amoe_entry_spend'` rows but never writes `amoe_zk_submissions` rows (it relays directly, skipping the phase-B ZK submission path). Without an additional scope guard, when ops set `AMOE_REFUND_CRON_ENABLED=1` every successful legacy entry older than `REFUND_AGE_EPOCHS` would be "refunded" — effectively granting users free / duplicated AMOE credits. (Codex caught this on PR #461's first commit; see review comment for the failure-mode walkthrough.)

Fix: explicit forward-marker table.

```sql
CREATE TABLE IF NOT EXISTS public.amoe_burn_credits_intents (
  signup_id     BIGINT      NOT NULL,
  spend_ref_id  TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (signup_id, spend_ref_id)
);
```

- The intent row is written **atomically with the debit** inside `consumeAmoeCreditsForEntry` (lib helper). The debit's CTE has a sibling `intent_ins AS (INSERT INTO amoe_burn_credits_intents ... SELECT signup_id, spend_ref_id FROM ins ON CONFLICT DO NOTHING)` clause. Postgres single-statement transactional atomicity guarantees both rows commit or neither does — there is no window where a debit can land without its marker. See §5.1.2 for the Codex follow-up that drove this design.
- The legacy `_amoeSubmit.ts` handler does NOT write into this table. By construction, then, the table membership is exactly the set of phase-A burns eligible for orphan-refund.
- The idempotent-retry path in `consumeAmoeCreditsForEntry` (existing-row case) opportunistically backfills the intent row via a sibling `intent_backfill` CTE so any debits that landed before this hotfix shipped get marked on retry. The backfill is non-fatal on failure — the helper still returns the original `burnedAt`/`burnEpoch`, and a subsequent retry will try again.
- The refund cron's `findOrphanBurns` query gains a fourth predicate — `EXISTS (SELECT 1 FROM amoe_burn_credits_intents i WHERE i.signup_id = p.signup_id AND i.spend_ref_id = p.source_id)` — which scopes the cron strictly to phase-A burns and excludes legacy debits.

Alternatives considered (rejected):
- New source value (`amoe_entry_spend_zk`): too invasive — would require updating the projector, the eligibility view, the ledger reader, and the witness builder.
- Structural pattern-matching on `spendRefId` format: brittle; depends on legacy clients never adopting the new format.
- Time-gating by hardcoded deploy timestamp: brittle; depends on a wall-clock cutoff that nobody can verify after the fact.

The forward marker is the explicit, auditable contract: the cron only refunds rows that the burn-credits handler said "yes, this is mine".

#### 5.1.2 Atomic intent write — Codex P1 follow-up

The **first** version of the phase-A scope guard (PR #464 commit `db67c53`) wrote the intent marker as a separate `INSERT INTO amoe_burn_credits_intents` statement issued by the burn-credits handler **after** `consumeAmoeCreditsForEntry` returned. Codex flagged this as P1 ([review on #464](https://github.com/wenakita/4626/pull/464)):

> The new phase-A marker write runs as a separate query after `consumeAmoeCreditsForEntry` has already committed the points debit, so any transient DB failure on this INSERT can return a 500 while leaving a successful burn without an `amoe_burn_credits_intents` row. In that state, the refund cron’s new EXISTS guard will permanently skip that burn, so users can lose credits unless they happen to retry with the same `spendRefId`. This should be atomic with the debit (or otherwise guaranteed) to avoid creating unrecoverable unmarked burns.

The failure mode is real: the debit succeeds, the handler is killed by a transient pool error before the second statement, the user sees a 500 and may not retry (or may retry with a different `spendRefId`), and the original debit is now permanently invisible to the refund cron — even though it has no settled `amoe_zk_submissions` row. The user has burned points for nothing and the safety net is silent.

**Fix.** Move the intent insert into the same single SQL statement as the debit, sharing a CTE chain. Postgres single-statement transactions are atomic — either both rows are visible to subsequent transactions, or neither is. The structural invariant becomes:

```
WITH current AS (
  SELECT credits FROM points_amoe_eligible_balance WHERE signup_id = $1
),
ins AS (
  INSERT INTO points (...) SELECT ... FROM current WHERE current.credits >= $required
  ON CONFLICT DO NOTHING RETURNING id, created_at
),
intent_ins AS (
  INSERT INTO amoe_burn_credits_intents (signup_id, spend_ref_id)
  SELECT $1, $spendRefId FROM ins   -- only fires when ins inserted
  ON CONFLICT DO NOTHING RETURNING signup_id
)
SELECT ... ;
```

Key properties:

- `intent_ins` reads `FROM ins`, so it only fires when the debit row was actually inserted — no spurious markers on the insufficient-credits short-circuit.
- `ON CONFLICT DO NOTHING` on the intents PK makes concurrent retries with the same `spendRefId` collapse to a no-op.
- The handler in `_amoeBurnCredits.ts` no longer touches the intent table directly. It does not import `getDb` and does not issue any post-debit DB write for the intent. (A code comment at the relevant section pins this so a future refactor doesn't accidentally re-introduce the race.)

Idempotent-retry path (existing debit row, e.g. retry against the same `spendRefId`) similarly uses a CTE — `existing` selects the prior row and `intent_backfill` opportunistically writes the marker via the same `ON CONFLICT DO NOTHING` insert. This handles two cases: (a) debits committed during the brief window before this hotfix shipped on `main` (`525cb0f`), and (b) any pathological case where a prior call's CTE committed but a follow-up application-layer step failed.

The lib-layer change is paired with a lib-layer SQL canary in `frontend/server/_lib/__tests__/amoeBurnCreditsAtomicIntent.test.ts` that:

- Locates `consumeAmoeCreditsForEntry` in source
- Asserts the function body contains an `intent_ins AS (...)` CTE that INSERTs into `amoe_burn_credits_intents` and SELECTs `FROM ins`
- Asserts every `INSERT INTO amoe_burn_credits_intents` in the function body lives inside an `intent_ins` or `intent_backfill` CTE (no standalone post-debit INSERT)
- Asserts the handler does NOT import `getDb` and does NOT contain `INSERT INTO amoe_burn_credits_intents` at all

This structural canary is the long-term lock-in. It fails the build if anyone refactors the helper into a two-statement layout, regardless of whether they get the migrations / cron / handler / tests right elsewhere.

**Option 2: "explicit refund endpoint".**

Client-driven `POST /api/v1/lottery/amoe/burn-credits/refund { spendRefId }`. Same atomicity properties. Simpler to ship; worse UX (browser-closed users never recover). NOT shipped — option 1 covers this case automatically.

**Option 3: "no refunds — burns are sunk cost".**

Cleanest infra; harshest UX. Rejected.

**Decision (resolved):** option 1 (auto-refund cron, 7 epochs, default off via `AMOE_REFUND_CRON_ENABLED`). Ops opts in by setting the flag once the publisher cron is healthy on prod.

---

## 6. UX implications (frontend coordination)

The frontend needs to be aware of the split. Two flows:

### 6.1 "Stable mode" (recommended)

- Phase A on click → spinner with "Locking your entry for tomorrow's draw…"
- Stash `{ spendRefId, burnEpoch, eligibleSubmitAfter }` in localStorage / DB.
- On a daily cron OR on user revisit after `eligibleSubmitAfter`, the frontend (or a server-side worker) calls phase B silently.
- User sees: success notification when proof lands.

### 6.2 "Hold the connection" mode (NOT recommended)

- Phase A + 24h SSE wait + phase B in one session.
- Brittle (mobile sleep, network changes); high server cost; not how anyone designs daily-cadence systems.

We MUST coordinate with the frontend team before merging this PR. The web2 UX work is not in this PR's scope, but the API contract here forces their hand.

---

## 7. Code changes (file-by-file)

### 7.1 New: `frontend/api/_handlers/v1/lottery/_amoeBurnCredits.ts`

Extracted from the top half of `_amoeSubmitZk.ts`:

- Imports: `guard`, `checkRateLimit`, `resolveAmoeWallet`, `verifyAmoeWalletSignature`, `getAmoeCreditSnapshot`, `consumeAmoeCreditsForEntry`, helpers.
- Exports: `default async function handler(req, res)`.
- Body validation identical to today's `spendRefId` + `pointsBurned` + signature path.
- No `insertPending`, no orchestrate, no relay, no `markSettled`.

Routing in `_routes.v1.ts`:

```ts
'lottery/amoe/burn-credits': () => import('./v1/lottery/_amoeBurnCredits.js'),
```

### 7.2 Modified: `frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts`

- **Remove** the `consumeAmoeCreditsForEntry` block at the end (lines ~770-790).
- **Add** a pre-flight `readSnapshotForBurn` call BEFORE `insertPending`:

```ts
const reader = new AmoeLedgerSnapshotPgReader(db)
let snapshotCtx
try {
  snapshotCtx = await reader.readSnapshotForBurn({ signupId, spendRefId })
} catch (e) {
  if (isAmoeLedgerSnapshotUnavailable(e)) {
    return res.status(425).json({
      success: false,
      error: 'amoe_snapshot_not_yet_confirmed',
      hint: 'phase A burn not yet confirmed at epoch N-1; retry after the next epoch boundary',
    })
  }
  if (isAmoeBurnRowMissing(e)) {
    return res.status(409).json({
      success: false,
      error: 'amoe_burn_not_found',
      hint: 'call POST /api/v1/lottery/amoe/burn-credits first',
    })
  }
  throw e
}
```

(The reader's existing impl already throws `amoe_ledger_snapshot_unavailable` for both cases; we add a new typed code `amoe_burn_row_missing` to disambiguate by checking `amoe_points_burn_ledger` separately, OR fold both into 425. Simpler: fold both into 425 and let the client retry-with-backoff. Decide in implementation review.)

- **Remove** the `AMOE_ZK_SNAPSHOT_READER_ENABLED` env gate added in #451 — the reader is now mandatory.
- **Remove** `getAmoeCreditSnapshot` pre-flight (already done in phase A).
- Pass `ledgerSnapshotReader` to orchestrate unconditionally.

### 7.3 Modified: `frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts`

Add a typed error for "burn row exists but snapshot not yet confirmed" vs "burn row does not exist". Today both throw `amoe_ledger_snapshot_unavailable`. Two new errors:

```ts
export class AmoeBurnRowMissingError extends Error {
  override readonly name = 'AmoeBurnRowMissingError'
}
export class AmoeSnapshotNotYetConfirmedError extends Error {
  override readonly name = 'AmoeSnapshotNotYetConfirmedError'
}
```

Reader queries `amoe_points_burn_ledger` first; if no row → `AmoeBurnRowMissingError`. If row exists but L2 lookup misses `publish_confirmed_at IS NOT NULL` → `AmoeSnapshotNotYetConfirmedError`. Existing `AmoeLedgerSnapshotUnavailableError` retained for backward compat (unioned).

### 7.4 New: `frontend/server/_lib/lottery/amoeBurnCredits.ts`

Thin wrapper around `consumeAmoeCreditsForEntry` that ALSO returns `burnEpoch` (computed from `now_seconds`). Keeps the handler dumb.

### 7.5 Optional: `frontend/api/_handlers/v1/lottery/_amoeBurnRefundCron.ts`

If we ship option 1 from §5.1. New cron at the same cadence as `_amoePublishCron`. Walks expired-but-unsettled burns and writes refund rows.

### 7.6 NOT touched

- `CreatorLotteryManager.sol` (project rule).
- `LotteryAmoeRouter.sol` (no on-chain changes).
- Circuit / verifier (no public-input changes).
- `amoeSubmitZk.ts` orchestrator (it already accepts an injected reader; that's the seam).

---

## 8. Tests

### 8.1 New unit tests

- `_amoeBurnCredits.handler.test.ts` (~12 tests): feature flag, auth, rate limit, body validation, signature verify, idempotent retry (same `spendRefId` → 200), insufficient credits → 402, returns `eligibleSubmitAfter` correctly.
- `amoeBurnCredits.test.ts` (~6 tests): `burnEpoch` computation, refId normalization, double-burn idempotence at the data layer.
- `amoeBurnRefundCron.handler.test.ts` (~8 tests, only if shipping refund cron): expired-and-unsettled walks, refund row dedupes via partial unique, no-refund for settled submissions.

### 8.2 Modified

- `lotteryAmoeSubmitZk.handler.test.ts`: drop `consumeAmoeCreditsForEntryMock` from happy path, replace with mock reader returning a confirmed snapshot. Add 425 / 409 cases. Drop the `AMOE_ZK_SNAPSHOT_READER_ENABLED` env gate test. Estimated +4 / -2 tests.
- `amoeSubmitZk.test.ts`: orchestrator-level tests unchanged (the reader injection seam is unchanged).

### 8.3 Integration (still vitest, no real RPC)

- `amoeBurnThenSubmit.integration.test.ts`: full round-trip — phase A burn → fake projector tick → fake publisher tick → phase B submit. Asserts the join works end-to-end with the real reader against a stub `db.sql`.

### 8.4 Manual on staging

- Burn at `T0`, wait `T0 + epoch_length`, confirm publisher cron logs, submit at `T0 + epoch_length + 5min`, confirm `amoe_zk_submissions.state == 'settled'`.
- Burn-and-abandon: confirm refund cron credits back at `T0 + REFUND_AGE_EPOCHS * epoch_length` (if option 1).

---

## 9. Migration / rollout plan

1. Land design (this doc) → review approval.
2. Land code as **two PRs**:
   - **PR 6a**: `_amoeBurnCredits.ts` + reader error split + tests. No changes to `_amoeSubmitZk.ts`. Ships dormant — endpoint live, nobody calls it. Frontend can start integrating.
   - **PR 6b**: modify `_amoeSubmitZk.ts` to require the reader; remove `AMOE_ZK_SNAPSHOT_READER_ENABLED` flag; require frontend to be on the new flow first. Behind a new env flag `AMOE_BURN_THEN_SUBMIT_REQUIRED=1` for staged rollout.
3. **PR 6c (shipped)**: refund cron (option 1 from §5.1) — default off via `AMOE_REFUND_CRON_ENABLED`.
4. Ops flips `AMOE_BURN_THEN_SUBMIT_REQUIRED=1` on staging, runs end-to-end, then prod.
5. Once stable, delete `amoeLedgerSnapshotStub.ts` (this is the explicit retirement criterion from PR 5b's §73 design table).

---

## 10. Open questions for review

1. **Refund policy** — option 1 (auto-refund cron, 7 epochs) vs option 2 (explicit refund endpoint) vs option 3 (no refund). **Resolved: option 1, shipped in PR 6c.**
2. **Frontend coordination** — who owns the web2-side state machine for the 24h gap? Web team or wallet team?
3. **Single-PR vs split PR (6a/6b)** — the split lets us decouple endpoint deployment from the breaking change. Recommend the split.
4. **Migration 035 (`burn_completed_at`)** — ship or skip? §4.2 recommends skip.
5. **425 vs 409 for missing burn** — the reader can disambiguate; client probably doesn't need to. Recommend 425 unified, with a `hint` field.

---

## 11. Out of scope

- Any contract change. `setPointsLedgerRoot` / `submitAmoeEntryZK` stay as-is.
- Allowlist publisher (separate PR — PR 5c).
- zkey hosting (PR 6 in the original numbering — this is now "PR 6 split", a re-numbering may be in order).
- Changes to the publisher cron itself.
- Changes to the projector iteration math.

---

## 12. References

- [PR 5b publisher design](./amoe-pr5b-publisher-design.md)
- [Points-burn ledger SoT](./amoe-points-burn-ledger-sot.md) (esp. §347 epoch staleness rule)
- [PR 5b operational runbook](./amoe-pr5b-publisher-runbook.md)
- [`amoeLedgerSnapshotReader.ts`](../../frontend/server/_lib/lottery/amoeLedgerSnapshotReader.ts) — the seam this PR makes mandatory.
- [`#451`](https://github.com/wenakita/4626/pull/451) — env gate that this PR retires.
