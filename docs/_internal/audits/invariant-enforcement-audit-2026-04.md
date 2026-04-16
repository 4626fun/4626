# Invariant Enforcement Audit — 2026-04

Follow-up to `docs/audits/creatorvault-business-logic-core-structure-audit.md`
§5 "Deployment Invariant Checklist". Purpose of this report: confirm each of
the five mandatory invariants that gate `settledAt` has an automated check
on the actual runtime path, not just policy text.

## Summary

Invariants 1–4 were already enforced by `/api/cre/keeper/sweep` as onchain
reads with strict string comparison against operator-supplied expected
values. Invariant 5 ("`settledAt` is written only when completion stage is
`completed`") had a real mechanism gap: the DB writer
`/api/cre/keeper/mark-settled` accepted `settledAt` and `settlementStage`
independently. This report documents the full coverage map and the patch
that closed invariant 5 at the endpoint level.

## Runtime path

```
CRE workflow (cca-finalization) ─▶ /api/cre/keeper/sweep
                                      │
                                      │  returns {completionStage, completed, invariantViolations}
                                      ▼
                                  caller decides whether to call:
                                      │
                                      ▼
                               /api/cre/keeper/mark-settled
                                      │
                                      │  UPDATE keepr_vaults SET settled_at = …
                                      ▼
                                     DB
```

- `/sweep` is the canonical completion state machine. It performs the
  onchain writes (sweepCurrency, migrate, optional hook setTaxConfig, best-
  effort sweepUnsoldTokens), reads the post-write state, and runs the §5.1
  onchain invariant checks.
- `/mark-settled` is a thin DB writer. It does not read chain state.
- The CRE workflow orchestrates the pair: it calls `/sweep` first and only
  sends `settledAt` + `settlementStage='completed'` to `/mark-settled` when
  `/sweep` reports `completed`.

## Invariant coverage

| # | §5.1 invariant | Mechanism | Status |
|---|---|---|---|
| 1 | `CCAStrategy.feeRecipient == tradeFeeCollector` | `/sweep` onchain read → `strategy_fee_recipient_mismatch` violation | ✅ enforced |
| 1 | `CreatorShareOFT.gaugeController == tradeFeeCollector` | `/sweep` onchain read → `trade_fee_collector_mismatch` | ✅ enforced |
| 2 | `CreatorCoin.payoutRecipient == expected lane` | `/sweep` onchain read → `external_revenue_recipient_mismatch` (and `missing_expected_external_revenue_recipient`) | ✅ enforced |
| 2 | `PayoutRouter.burnStream == expected` (router mode) | `/sweep` onchain read → `router_burn_stream_mismatch`, plus `missing_expected_payout_router` / `missing_expected_burn_stream` guards | ✅ enforced |
| 3 | `creatorShareBps > 0 ⇒ creatorTreasury != 0x0` | `/sweep` onchain read of gauge → `creator_treasury_missing` | ✅ enforced |
| 4 | sweep + migrate + hook config status → completion stage | `/sweep` lifecycle flags + hook mode state machine | ✅ enforced (`awaiting_migration_block`, `awaiting_owner_hook_config`, `invariant_failed`, `completed`) |
| 5 | `settledAt` only when stage = completed | `/mark-settled` endpoint-side pairing gate (this commit) | ✅ enforced |

## Flag configuration

- `DEPLOY_ENFORCE_PHASE2_INVARIANTS`:
  - `frontend/api/_handlers/deploy/session/_continue.ts` — `isTruthyEnv(..., true)`, default-on.
  - `frontend/api/_handlers/deploy/session/_status.ts` — same default-on.
- `KEEPER_ENFORCE_COMPLETION_INVARIANTS`:
  - `frontend/api/_handlers/cre/keeper/_sweep.ts` — `process.env.KEEPER_ENFORCE_COMPLETION_INVARIANTS !== 'false'`, default-on semantics (only an explicit `"false"` disables).

Both flags align with the audit's operational policy: default-on in
production, any override is an explicit "do-not-settle-yet" signal.

## The gap and the fix (invariant 5)

### Before

`/api/cre/keeper/mark-settled` validated:

- `vaultAddress` format
- `settlementStage` regex (`/^[a-z0-9_:-]{2,64}$/i`)
- at least one of `graduatedAt`, `settledAt`, `settlementStage` present

It did **not** validate:

- that `settledAt` is only written when `settlementStage === 'completed'`
- that `settledAt` is a valid ISO-8601 timestamp
- that `settledAt` is not in the future

A caller holding `KEEPR_API_KEY` (or a future CRE workflow version with a
bug) could therefore POST `{ settledAt: '2099-01-01', settlementStage:
'in_progress' }` and write `settled_at` without the `/sweep` state machine
passing. Invariants 1–4 would still be onchain-true (they don't depend on
this endpoint), but the `settled_at` timestamp itself — which is what the
public "fully live" surface reads — would be wrong.

### After (commit closing this gap)

`/mark-settled` now rejects any request where `settledAt` is present and:

- `settlementStage` is not the literal string `"completed"` (case-
  insensitive), or
- `settledAt` is not a parseable ISO-8601 timestamp, or
- `settledAt` is more than 5 minutes in the future (keeps minor clock
  skew tolerance between CRE workflow nodes and the server).

The CRE workflow's existing call pattern already satisfies this gate — no
workflow change was needed. Verified with a dedicated test suite
`api/__tests__/creKeeperMarkSettled.test.ts`:

- accepts `graduatedAt`-only
- accepts `settlementStage`-only (pending states)
- accepts `settledAt` + `settlementStage="completed"`
- accepts `settledAt` with up-to-5-min clock skew
- rejects `settledAt` without any stage
- rejects `settledAt` with a non-`completed` stage
- rejects `settledAt` with a malformed timestamp
- rejects `settledAt` far in the future

## Residual notes

- Invariants 1–4 fail **closed** in `/sweep` (`completionStage =
  'invariant_failed'` causes `completed=false` and an operational alert).
  This means the CRE workflow will never call `/mark-settled` with
  `settledAt` for an invariant-violating vault. The invariant-5 gate on the
  DB writer is a defense-in-depth: it stops the write from another caller
  even if the CRE workflow were bypassed.
- `cre/actions/cca-finalization.action.ts` is declared non-canonical (see
  commit `6df0e83e` header edit). It does not call `/mark-settled`. It
  should not be used to drive settlement state.
- The five invariants are tracked as independent violation codes in
  `/sweep` response (`invariantViolations: Array<{code, message, expected,
  actual}>`). Operators should alert on any non-empty violations list.
