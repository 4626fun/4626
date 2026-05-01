# AMOE Production Flag Rollout Plan

> **Status:** Rev 5 draft, awaiting owner sign-off.
> **Author:** generated 2026-05-01.
> **Scope:** orchestrates the staged enablement of all five `AMOE_*_ENABLED`
> feature flags now that the AMOE migration backlog is fully applied to
> prod (Supabase project `qajpnuvqlcfseghnldkl`, last applied migration
> `20260429_alfaclub_user_preferences`).
>
> This document is the **superset** of [`amoe-pr5b-publisher-runbook.md`](../../security/amoe-pr5b-publisher-runbook.md) — that runbook covers one
> flag (the publisher cron) end-to-end. This plan sequences all five
> flags in dependency order and adds the pre-flight env / on-chain work
> shared across them.

---

## 0.0 v1.10.1 Redeploy Pre-Condition

Pre-condition: v1.10.1 broadcast complete, addresses recorded in
`docs/operations/deployment/releases/v1.10.1-mainnet.md`, AMOE
selector-surface guard green on the new manager.

Do not resume the AMOE rollout from this document while the v1.10.1 redeploy
packet is still pre-broadcast or while the selector-surface guard is unproven.

## 0. Inventory

Five env-var feature flags gate the AMOE pipeline. All default to OFF; the
handlers return `503 amoe_*_disabled` (or skip work silently for crons)
when a flag is unset.

| Flag | Gates | Layer | Default | Source ref |
|---|---|---|---|---|
| `AMOE_ZK_SUBMIT_ENABLED` | `POST /api/v1/lottery/amoe/submit-zk` (the user-facing ZK entry submission) | API handler + cron pre-checks | OFF | [`amoeSubmitZk.ts:439`](../../../frontend/server/_lib/lottery/amoeSubmitZk.ts) |
| `AMOE_BURN_CREDITS_ENABLED` | `POST /api/v1/lottery/amoe/burn-credits` (the burn-then-submit Phase-A debit) | API handler | OFF | [`_amoeBurnCredits.ts:132`](../../../frontend/api/_handlers/v1/lottery/_amoeBurnCredits.ts) |
| `AMOE_LEDGER_PUBLISHER_ENABLED` | The 1-min cron that snapshots the burn ledger and publishes the Merkle root on-chain | Cron handler | OFF | [`amoeLedgerPublisher.ts:762`](../../../frontend/server/_lib/lottery/amoeLedgerPublisher.ts) |
| `AMOE_REFUND_CRON_ENABLED` | The cron that refunds orphaned `amoe_burn_credits_intents` (Phase-A debits with no matching `amoe_zk_submissions` row) | Cron handler | OFF | [`amoeBurnRefund.ts:135`](../../../frontend/server/_lib/lottery/amoeBurnRefund.ts) |
| `AMOE_ZK_SNAPSHOT_READER_ENABLED` | A *reader* dial — when ON, `submit-zk` reads the burn-ledger snapshot during witness build instead of using the legacy stub | Witness construction inside `submit-zk` | OFF | [`_amoeSubmitZk.ts:801`](../../../frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts) |

### Cross-flag dependencies (verified against handler source)

`AMOE_ZK_SUBMIT_ENABLED` is the **master gate**. Three of the five flags
short-circuit with `503 zk_path_disabled` when it is unset (verified at
handler-source level — see citations below):

```text
                              AMOE_ZK_SUBMIT_ENABLED  (master gate)
                                       │
           ┌───────────────────────────┼───────────────────────────┬──────────────────────────┐
           ▼                           ▼                           ▼                          ▼
  POST submit-zk             POST publish-cron           POST burn-refund-cron       POST retry-cron
  (handler)                  (cron, also gated by        (cron, also gated by        (cron, no extra
                              LEDGER_PUBLISHER)           REFUND_CRON)                flag — only ZK_SUBMIT)

                                       AMOE_BURN_CREDITS_ENABLED   (independent)
                                                  │
                                                  ▼
                                         POST burn-credits

                                       AMOE_ZK_SNAPSHOT_READER_ENABLED  (read-only dial inside submit-zk)
```

Behavior under each flag (cited):

- **`ZK_SUBMIT`** is checked at the top of every ZK-path handler:
  - [`_amoeSubmitZk.ts`](../../../frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts) — user-facing submit endpoint
  - [`_amoePublishCron.ts:116`](../../../frontend/api/_handlers/v1/lottery/_amoePublishCron.ts) — `if (!isAmoeZkSubmitEnabled()) return 503`
  - [`_amoeBurnRefundCron.ts:97`](../../../frontend/api/_handlers/v1/lottery/_amoeBurnRefundCron.ts) — `if (!isAmoeZkSubmitEnabled()) return 503`
  - [`_amoeRetryCron.ts:71`](../../../frontend/api/_handlers/v1/lottery/_amoeRetryCron.ts) — same
  - **Implication:** flipping `BURN_CREDITS=1` without `ZK_SUBMIT=1` would create stuck-funds, because the refund cron returns 503 and never refunds orphans.
- **`BURN_CREDITS`** is independent — only checked inside [`_amoeBurnCredits.ts:162`](../../../frontend/api/_handlers/v1/lottery/_amoeBurnCredits.ts). It is the only flag that does NOT require `ZK_SUBMIT` to be ON, but it is also the only flag that creates stuck funds when other flags are off — so it must come AFTER `ZK_SUBMIT` in this rollout.
- **`LEDGER_PUBLISHER`** is the second gate inside [`_amoePublishCron.ts:120`](../../../frontend/api/_handlers/v1/lottery/_amoePublishCron.ts). Reverts on-chain as `NotPointsLedgerPublisher` until the on-chain allowlist call (§2.3) is made.
- **`REFUND_CRON`** is the second gate inside [`_amoeBurnRefundCron.ts:101`](../../../frontend/api/_handlers/v1/lottery/_amoeBurnRefundCron.ts). Only effective when `ZK_SUBMIT` is also on.
- **`SNAPSHOT_READER`** is a read-only dial inside [`_amoeSubmitZk.ts:801`](../../../frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts) — it changes how the witness is built but does not gate the endpoint.

### Cron schedule (from [`frontend/vercel.json`](../../../frontend/vercel.json))

| Cron | Path | Schedule |
|---|---|---|
| Retry | `/api/v1/lottery/amoe/retry-cron` | `*/5 * * * *` (every 5 min) |
| Publish | `/api/v1/lottery/amoe/publish-cron` | `*/15 * * * *` (every 15 min) |
| Burn-refund | `/api/v1/lottery/amoe/burn-refund-cron` | `*/15 * * * *` (every 15 min) |

All soak windows below assume the 15-min cadence (4 ticks/hour for the
publisher and refund crons).

### Why `ZK_SUBMIT` must lead the rollout

A naive plan might enable `BURN_CREDITS` first "as a steel thread" and
let the refund cron clear orphans. That doesn't work: with `ZK_SUBMIT=0`,
the refund cron returns `503 zk_path_disabled` and never runs the
refund logic, so any debit becomes a stuck-funds incident. The correct
order is to flip `ZK_SUBMIT` first (along with `REFUND_CRON` so the
safety net is live), THEN `BURN_CREDITS`, THEN the on-chain publisher.

> A prior draft of this plan inverted phases 2 and 3 — that draft was
> wrong and would have caused stuck funds. This is now corrected;
> phasing matches the handler-source gating shown above.

---

## 1. Hard rules (do not violate)

These are inherited from [`amoe-pr5b-publisher-runbook.md` §Hard rules](../../security/amoe-pr5b-publisher-runbook.md#hard-rules) plus rollout-specific
additions:

1. **Migrations first.** Never flip ANY `AMOE_*_ENABLED` flag while the
   AMOE migration backlog is unapplied. *Status: ✅ all 9 applied
   2026-04-30 / 2026-05-01.*
2. **`ZK_SUBMIT` must lead.** `AMOE_ZK_SUBMIT_ENABLED=1` is the master
   gate (see §0 Cross-flag dependencies). Flipping `BURN_CREDITS=1`
   while `ZK_SUBMIT=0` creates stuck-funds because the refund cron
   returns 503 and never refunds orphans.
3. **Publisher on-chain allowlist before publisher flag.** Never flip
   `AMOE_LEDGER_PUBLISHER_ENABLED=1` before
   `LotteryAmoeRouter.setPointsLedgerPublisher(<EOA>)` has landed
   on-chain. The cron will eat credits on every tick until disabled.
4. **One flag per deploy** (with one explicit exception). Each flag
   flip is a separate Vercel env change + redeploy. The exception is
   Phase 1, which intentionally pairs `ZK_SUBMIT_ENABLED=1` with
   `REFUND_CRON_ENABLED=1` in the same deploy so the safety-net cron
   becomes live the moment `ZK_SUBMIT` is on. This is documented in
   the phase itself with explicit reasoning.
5. **Owner-driven.** Flag flips are NOT to be made by an automation
   agent. The agent's role here is producing this plan, the SQL probes,
   and the post-flip verification scripts. A human owner runs the
   flips.
6. **Roll back to OFF on any anomaly.** Every step's exit criteria
   include a rollback statement. There is never a forward-only step in
   this rollout.

---

## 2. Pre-flight (one-time, in order)

### 2.1 Migration backlog

✅ Done. Verified:

```sql
-- Should return 9 rows; latest is alfaclub.
SELECT version FROM supabase_migrations.schema_migrations
WHERE version >= '20260423025327'
ORDER BY version;

-- Should return 5 — the AMOE tables.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'amoe_%';
```

### 2.2 Vercel env vars (NOT yet provisioned)

All Production-scope. Set BEFORE flipping any enable flag.

| Var | Required for | Notes |
|---|---|---|
| `LOTTERY_AMOE_ROUTER` | `ZK_SUBMIT`, `LEDGER_PUBLISHER` | Base mainnet address of the `LotteryAmoeRouter`. From the latest deployment manifest. |
| `BASE_RPC_URL` | `LEDGER_PUBLISHER` | Mainnet RPC. Should already be set for other crons; double-check. |
| `AMOE_LEDGER_PUBLISHER_PRIVATE_KEY` | `LEDGER_PUBLISHER` | EOA private key signing the `submitPointsBurnRoot` calls. **Must NOT be a re-used relayer key — see [`amoe-relay-key-scope.md`](../../security/amoe-relay-key-scope.md).** |
| `AMOE_LEDGER_PUBLISHER_SMART_WALLET` | `LEDGER_PUBLISHER` (Privy CSW path only) | Smart-wallet address; only set if using Privy CSW instead of the raw EOA. |
| `AMOE_PUBLISHER_PUBLISHER_RUN_TTL_MS` | `LEDGER_PUBLISHER` | Default 60_000. Single-instance lock TTL. |
| `AMOE_BURN_CREDITS_RATE_LIMIT_*` | `BURN_CREDITS` | Existing rate-limit knobs; verify defaults are sane. |

Verify with:

```bash
cd frontend
vercel env ls production | grep -E "^ (AMOE_|LOTTERY_AMOE_|BASE_RPC_URL)"
```

Expected output before this rollout: empty for `AMOE_*` and
`LOTTERY_AMOE_*`. After step 2.2 completion: each row above is
`Encrypted, Production`.

### 2.3 On-chain allowlist call

```solidity
// As governance/owner of LotteryAmoeRouter:
router.setPointsLedgerPublisher(<EOA derived from AMOE_LEDGER_PUBLISHER_PRIVATE_KEY>);
// OR if using Privy CSW:
router.setPointsLedgerPublisher(<AMOE_LEDGER_PUBLISHER_SMART_WALLET>);
```

Verify:

```bash
export LOTTERY_AMOE_ROUTER="0x..." # from 2.2
cast call $LOTTERY_AMOE_ROUTER "pointsLedgerPublisher()(address)" \
  --rpc-url $BASE_RPC_URL
# Must echo the configured signer address.
```

### 2.4 Smoke-check — flags OFF, schema present

Run in production after 2.1 / 2.2 / 2.3, BEFORE any flag flip:

```bash
# All five handlers should respond 503 with the expected disabled-arm body.
curl -s -X POST https://<PROD>/api/v1/lottery/amoe/submit-zk      | jq .   # 503 amoe_zk_submit_disabled
curl -s -X POST https://<PROD>/api/v1/lottery/amoe/burn-credits   | jq .   # 503 amoe_burn_credits_disabled
curl -s -X POST https://<PROD>/api/v1/lottery/amoe/publish-cron   | jq .   # cron-auth gate first; if authed, returns disabled body
curl -s -X POST https://<PROD>/api/v1/lottery/amoe/burn-refund-cron | jq . # same
```

If any returns 200, **STOP** — schema or middleware is misconfigured.

---

## 3. Phased rollout

Each phase is one Vercel env change + redeploy. After each, run the
phase's exit-criteria probes and wait the soak window before continuing.

### Phase 0 — Reader dial on staging only (no production effect)

> **Purpose:** exercise the snapshot-reader code path against real
> historical submissions in staging without touching prod write paths.

- **Set** `AMOE_ZK_SNAPSHOT_READER_ENABLED=1` in Vercel **Preview**
  environment only.
- Replay 1-2 known-good idempotent submissions through staging.
- **Exit criteria:**
  - `submit-zk` logs show `snapshot_reader=enabled`.
  - Replays return the same proof bytes as before (deterministic).
- **Soak:** 24h or until ≥10 successful staging replays.
- **Rollback:** unset the var.

This phase has zero production impact. Ship in parallel with phase 1
preparation.

### Phase 1 — `AMOE_ZK_SUBMIT_ENABLED=1` + `AMOE_REFUND_CRON_ENABLED=1` (master gate ON, refund cron ON, submissions accepted)

> **Purpose:** flip the master gate so the user-facing
> `POST /api/v1/lottery/amoe/submit-zk` accepts proofs, AND make the
> refund cron live in the same deploy so the safety net is online
> before phase 2 introduces any debits.
>
> **Why two flags here (the documented exception to hard rule #4):**
> the refund cron is double-gated by `ZK_SUBMIT` AND `REFUND_CRON`;
> with only `ZK_SUBMIT=1`, the cron returns `503 zk_path_disabled` →
> `503 refund_cron_disabled`, leaving no safety net. With only
> `REFUND_CRON=1`, the cron returns the first 503 and never runs. The
> two must move together. There is no production traffic into
> `submit-zk` until Phase 2 enables `BURN_CREDITS`, so there is also
> no orphan-creation risk during Phase 1's soak — the refund cron is
> idle by design.

- **Pre-flight:**
  - All §2.1 / §2.2 / §2.3 / §2.4 gates closed (migrations applied,
    env vars provisioned, on-chain allowlist call landed, smoke check
    returns 5x 503).
- **Set** `AMOE_ZK_SUBMIT_ENABLED=1` in Vercel Production.
- **Set** `AMOE_REFUND_CRON_ENABLED=1` in Vercel Production. **Same deploy.**
- **Exit criteria:**
  - `submit-zk` returns 200 for any seed proofs you replay through it,
    OR a clean 4xx for invalid input. No 5xx.
  - `burn-refund-cron` ticks every 15 min (per `vercel.json`,
    `*/15 * * * *`), logging `intents_scanned == 0` (no debits exist
    yet — Phase 2 hasn't started).
  - `retry-cron` ticks every 5 min, logging `attempted == 0` for the
    same reason.
  - `publish-cron` ticks every 15 min and returns
    `503 publisher_disabled` (the second gate is still off).
  - SQL probes:
    ```sql
    -- No burn-credits intents should exist yet (BURN_CREDITS still off).
    SELECT count(*) FROM amoe_burn_credits_intents;          -- expect 0
    -- No zk submissions yet (no clients calling submit-zk in prod).
    SELECT count(*) FROM amoe_zk_submissions;                -- expect 0
    -- No phase-A burns yet.
    SELECT count(*) FROM amoe_points_burn_ledger
    WHERE source_arm = 'phase_a_burn';                       -- expect 0
    ```
- **Soak:** 4 hours (16 refund-cron ticks, 16 publish-cron ticks,
  48 retry-cron ticks). Goal: verify all three crons fire on schedule
  with the expected 200 / 503 mix and no 5xx.
- **Rollback:** unset both flags. No data is created in this phase to
  clean up.

### Phase 2 — `AMOE_BURN_CREDITS_ENABLED=1` (Phase-A debits enabled)

> **Purpose:** users can call `POST /api/v1/lottery/amoe/burn-credits`
> to debit AMOE points and write an `amoe_burn_credits_intents` row,
> then follow up with `submit-zk` (already on from Phase 1). Orphan
> intents — debits where the user never finishes `submit-zk` — get
> refunded by the cron.

- **Pre-flight:**
  - Phase 1 has been live and clean for ≥4h.
  - Confirm `amoe_burn_credits_intents` and `amoe_points_burn_ledger`
    tables exist (they do — applied in 2.1).
  - Confirm rate-limits are set (2.2).
- **Set** `AMOE_BURN_CREDITS_ENABLED=1` in Vercel Production.
- **Exit criteria:**
  - `burn-credits` returns 200 for valid eligibility-checked requests.
  - For users who complete the burn-then-submit flow, `amoe_zk_submissions`
    rows appear and intents get marked `submitted_at IS NOT NULL` (the
    refund cron's orphan guard).
  - For users who abandon mid-flow, the refund cron picks up orphans
    on its next 15-min tick after the configured age threshold (env
    `AMOE_BURN_REFUND_AGE_SEC`, default 900s).
  - SQL probes:
    ```sql
    -- Recent intents.
    SELECT count(*) FROM amoe_burn_credits_intents
    WHERE created_at > now() - interval '1 hour';
    -- Recent refunds.
    SELECT count(*) FROM amoe_burn_credits_intents
    WHERE refunded_at > now() - interval '1 hour';
    -- New zk submissions.
    SELECT count(*) FROM amoe_zk_submissions
    WHERE created_at > now() - interval '1 hour';
    -- Phase-A burns appearing in the ledger.
    SELECT count(*) FROM amoe_points_burn_ledger
    WHERE source_arm = 'phase_a_burn'
      AND ts > now() - interval '1 hour';
    -- Stuck intents (older than the age threshold + 30 min, neither
    -- refunded nor matched). Must be 0 once the soak is past the
    -- age threshold + one cron tick.
    SELECT count(*) FROM amoe_burn_credits_intents i
    WHERE i.created_at < now() - interval '30 minutes' - interval '15 minutes'
      AND i.refunded_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM amoe_zk_submissions s WHERE s.intent_id = i.id
      );
    ```
- **Soak:** 6 hours (24 refund-cron ticks). Watch end-to-end
  burn → submit cycles complete and watch at least one orphan get
  refunded by the cron (you may need to manually create one in staging
  first if production traffic doesn't naturally produce one).
- **Rollback:** unset `AMOE_BURN_CREDITS_ENABLED`. The handler stops
  accepting new debits. Any in-flight intents continue to be processed:
  matched ones complete via `submit-zk`, orphans get refunded by the
  cron (still on from Phase 1). The Phase-A burns already in the
  ledger remain — they are immutable history.

### Phase 3 — `AMOE_LEDGER_PUBLISHER_ENABLED=1` (on-chain root publishing)

> **Purpose:** the publisher cron (every 15 min) snapshots
> `amoe_points_burn_ledger` per epoch, builds a Merkle root, and
> submits it via `LotteryAmoeRouter.submitPointsBurnRoot(epoch, root)`.
>
> **This is the only phase with on-chain side effects.**

- **Pre-flight:**
  - Phase 2 has been live and clean for ≥6h, with at least 10
    successful `submit-zk` calls in production.
  - Re-verify on-chain allowlist (2.3) — the address echoed by
    `pointsLedgerPublisher()` MUST match the EOA derived from
    `AMOE_LEDGER_PUBLISHER_PRIVATE_KEY` (or the configured smart
    wallet). If it doesn't match, **STOP** and fix before flipping.
  - Verify EOA / smart-wallet has gas balance on Base mainnet.
- **Set** `AMOE_LEDGER_PUBLISHER_ENABLED=1` in Vercel Production.
- **Exit criteria:** see [`amoe-pr5b-publisher-runbook.md` §Per-tick
  observability](../../security/amoe-pr5b-publisher-runbook.md#per-tick-observability) — the cron (running at `*/15 * * * *`, so 4 ticks/hour) should
  produce a mix of `finished`, `finished_no_op`, and `disabled` log
  lines with NO `failed` lines.
  - SQL probes:
    ```sql
    -- Recent publisher runs.
    SELECT epoch, status, on_chain_tx_hash, created_at
    FROM amoe_publisher_runs
    ORDER BY created_at DESC LIMIT 20;
    ```
  - On-chain probe (verify the latest published epoch advances):
    ```bash
    cast call $LOTTERY_AMOE_ROUTER \
      "latestPublishedEpoch()(uint64)" --rpc-url $BASE_RPC_URL
    ```
- **Soak:** 24 hours.
- **Rollback:** unset `AMOE_LEDGER_PUBLISHER_ENABLED`. Any in-flight
  tick will complete (the cron does not honor mid-tick cancellation),
  but no new ticks fire. **Do NOT** revoke the on-chain allowlist on
  rollback — that would require another on-chain call to re-enable.

### Phase 4 — `AMOE_ZK_SNAPSHOT_READER_ENABLED=1` in production

> **Purpose:** flip the reader dial in production so `submit-zk` reads
> the burn-ledger snapshot during witness build instead of the stub.

- **Pre-flight:** Phase 3 has been live and clean for ≥24h. Phase 0
  on staging has been clean for ≥7 days.
- **Set** `AMOE_ZK_SNAPSHOT_READER_ENABLED=1` in Vercel Production.
- **Exit criteria:**
  - `submit-zk` logs `snapshot_reader=enabled` for non-burn-then-submit
    calls.
  - Latency of `submit-zk` does not regress measurably (< 5% increase
    over phase-2 baseline).
- **Soak:** 48 hours.
- **Rollback:** unset.

---

## 4. Monitoring

Cross-cutting probes to add to the on-call dashboard. Each phase's exit
criteria use a subset of these.

### 4.1 Liveness probes (per-flag)

| Flag | Probe | Healthy |
|---|---|---|
| `BURN_CREDITS` | `POST /api/v1/lottery/amoe/burn-credits` 200 rate over 1h | > 0 if there's traffic, else `idle`. |
| `ZK_SUBMIT` | `POST /api/v1/lottery/amoe/submit-zk` 200 rate over 1h | matches above; ratio `submit/burn` should approach 1.0 once both are stable. |
| `LEDGER_PUBLISHER` | `amoe_publisher_runs.status` last 1h (4 ticks at `*/15`) | mostly `finished_no_op` + `finished`; zero `failed`. |
| `REFUND_CRON` | refund cron success rate over 1h (4 ticks at `*/15`) | `intents_scanned` matches DB state; zero `errors`. |
| `SNAPSHOT_READER` | reader-enabled log-line ratio in `submit-zk` | > 0 once enabled. |

### 4.2 Invariant probes (run every 15 min while flags are flipping)

```sql
-- Every burn-credits intent must eventually be refunded OR matched
-- by a submission within the deadline window. Stuck intents (older
-- than 24h, neither refunded nor submitted) are a P0.
SELECT count(*) FROM amoe_burn_credits_intents i
WHERE i.created_at < now() - interval '24 hours'
  AND i.refunded_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM amoe_zk_submissions s
    WHERE s.intent_id = i.id
  );
-- Expected: 0.

-- Publisher runs should never have NULL on_chain_tx_hash AND
-- status='finished' simultaneously.
SELECT count(*) FROM amoe_publisher_runs
WHERE status = 'finished' AND on_chain_tx_hash IS NULL;
-- Expected: 0.

-- The on-chain latest epoch must equal or exceed the latest
-- finished publisher run.
-- (Run this manually with cast against the router after each phase 4 deploy.)
```

### 4.3 Kill-switch playbook

If ANY invariant probe trips:

1. Immediately unset the most recently flipped flag in Vercel.
2. Trigger a redeploy (Vercel does this automatically on env change).
3. Re-run the smoke check from §2.4.
4. Confirm the trip clears within one cron tick (1 min for publisher,
   1 min for refund cron).
5. File a Linear ticket with the SQL output that tripped the probe.

---

## 5. Day-of checklist

Print this and check off as you go.

```text
[ ] §0.0  v1.10.1 broadcast complete + addresses recorded + guard green
[ ] §2.1  Migrations applied (verify SQL)               — already done
[ ] §2.2  Vercel env vars provisioned                   — owner action
[ ] §2.3  On-chain allowlist call landed                — governance action
[ ] §2.4  Smoke check (5x 503 responses)                — owner verifies
[ ] §3.0  Phase 0 — staging SNAPSHOT_READER              — 24h soak
[ ] §3.1  Phase 1 — ZK_SUBMIT + REFUND_CRON              — 4h soak
[ ] §3.2  Phase 2 — BURN_CREDITS                         — 6h soak
[ ] §3.3  Phase 3 — LEDGER_PUBLISHER                     — 24h soak
[ ] §3.4  Phase 4 — SNAPSHOT_READER (prod)               — 48h soak
[ ] §4    Monitoring probes wired into dashboard         — ops action
```

Total wall-clock from phase 1 to phase 4 complete: ~3.5 days minimum
(4h + 6h + 24h + 48h soaks).

---

## 6. Out of scope

- Spec changes, contract changes, additional schema migrations.
- Decommissioning the legacy `amoeLedgerSnapshotStub.ts` (the
  allowlist branch still uses it; tracked in
  [`amoe-pr5b-publisher-runbook.md` §Known follow-ups](../../security/amoe-pr5b-publisher-runbook.md#known-follow-ups)).
- Front-end UX changes for the new Phase-A flow (the burn-then-submit
  client work is tracked separately).

---

## 7. Change log

| Date | Change |
|---|---|
| 2026-05-01 | Initial draft after the AMOE migration backlog was applied to prod. Sequenced all five flags with cross-flag dependency map, per-phase exit criteria, and SQL probes. |
| 2026-05-01 (rev 2) | Corrected after PR-#477 review (codex + cubic). (1) Re-verified handler-source gating: `ZK_SUBMIT` is the master gate on three of four cron handlers (`publish`, `burn-refund`, `retry`), so it MUST lead the rollout — original draft inverted phases 2 and 3 and would have caused stuck-funds. (2) Cron cadences corrected to `*/15` (publish + burn-refund) and `*/5` (retry) to match `frontend/vercel.json`; soak-window tick counts fixed (was off by 15x). (3) Added the `retry-cron` to the inventory; previously omitted. (4) "One flag per deploy" rule kept, with Phase 1's `ZK_SUBMIT + REFUND_CRON` pairing called out as the documented exception (with reasoning) instead of being an unflagged contradiction. |
| 2026-05-01 (rev 5) | Added the v1.10.1 redeploy pre-condition: broadcast complete, addresses recorded in `releases/v1.10.1-mainnet.md`, and AMOE selector-surface guard green on the new manager before this rollout resumes. |
