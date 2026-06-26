---
title: CRE Keeper Rollout (80/20)
status: historical
doc_template: runbook
---

# CRE Keeper Rollout (80/20)

This runbook defines the repo-native rollout for external attestations (for example AWS + CRE) without replacing the existing 4626 keeper and contract guardrails.

## Scope

- **Phase 1:** Solana NAV attestation -> `SolanaStrategy.updateRemoteNav(...)`
- **Phase 2:** Strategy health feed -> keeper `tend/report` gating
- **Phase 3:** Creator oracle secondary validation -> optional `CreatorOracle.updateCreatorPrice(...)`

All paths stay inside authenticated keeper APIs and `keeper_jobs` execution.

## New API surfaces

- `POST /api/keeper/cre-solana-nav-ingest`
- `POST /api/keeper/cre-solana-nav-update`
- `POST /api/keeper/cre-strategy-health-ingest`
- `POST /api/keeper/cre-oracle-validate-update`

All require `Authorization: Bearer ${KPR_API_KEY}`.

## Data model

Migration: `supabase/migrations/20260611100000_keeper_cre_attestation_schema.sql`

- `public.keeper_cre_attestations`: canonical ingest/decision/execution audit trail
- `public.keeper_cre_strategy_health`: latest strategy-health signal per `(vault,strategy)`

Both tables are RLS-enabled with restrictive deny-all policies.

## Environment controls

### Global

- `CRE_KILL_SWITCH=1` disables all CRE write paths.

### Solana NAV lane

- `CRE_SOLANA_NAV_SHADOW_ONLY` (default `true`)
- `CRE_SOLANA_NAV_WRITE_ENABLED` (default `false`)
- `CRE_SOLANA_NAV_STRATEGY_ALLOWLIST` (optional comma list)

### Strategy health gate

- `CRE_STRATEGY_HEALTH_GATE_ENABLED`
- `CRE_STRATEGY_HEALTH_REQUIRE_SIGNAL`
- `CRE_STRATEGY_HEALTH_MAX_AGE_MS`
- `CRE_STRATEGY_HEALTH_MIN_CONFIDENCE_BPS`

### Creator oracle validator lane

- `CRE_ORACLE_SHADOW_ONLY` (default `true`)
- `CRE_ORACLE_VALIDATOR_WRITE_ENABLED` (default `false`)
- `CRE_ORACLE_ALLOWLIST` (optional comma list)
- `CRE_ORACLE_MAX_DIVERGENCE_BPS`

## Rollout procedure

### Step 1: Shadow mode only

1. Keep all write toggles off:
   - `CRE_SOLANA_NAV_WRITE_ENABLED=0`
   - `CRE_ORACLE_VALIDATOR_WRITE_ENABLED=0`
2. Keep `CRE_SOLANA_NAV_SHADOW_ONLY=1`, `CRE_ORACLE_SHADOW_ONLY=1`.
3. Send attestation payloads to ingest endpoints.
4. Verify DB rows in `keeper_cre_attestations` show `shadow_only` / `queued` decisions as expected.
5. Optional smoke run:
   - `pnpm -C frontend exec tsx scripts/ops/cre-canary-smoke.ts`

### Step 2: Solana NAV canary write

1. Set `CRE_SOLANA_NAV_WRITE_ENABLED=1`.
2. Keep strict `CRE_SOLANA_NAV_STRATEGY_ALLOWLIST` with one canary strategy.
3. Submit canary attestations and verify:
   - `keeper_cre_attestations.status='executed'`
   - tx hash present
   - onchain `remoteNav` update matches payload.
4. On any anomaly, set `CRE_KILL_SWITCH=1` immediately.

### Step 3: Strategy health gate canary

1. Enable `CRE_STRATEGY_HEALTH_GATE_ENABLED=1`.
2. Publish `healthy` signals for canary vault strategies.
3. Confirm keeper `tend/report` proceeds when healthy and is skipped with explicit reasons when degraded/stale.

### Step 4: Oracle validator canary

1. Keep `CRE_ORACLE_SHADOW_ONLY=1` initially and monitor divergence.
2. If stable, set:
   - `CRE_ORACLE_VALIDATOR_WRITE_ENABLED=1`
   - `CRE_ORACLE_SHADOW_ONLY=0`
   - strict `CRE_ORACLE_ALLOWLIST` for one oracle.
3. Confirm tx path and contract-level deviation guard behavior.

## Failure handling

- **Immediate stop:** set `CRE_KILL_SWITCH=1`.
- **Solana NAV write issues:** disable `CRE_SOLANA_NAV_WRITE_ENABLED`; continue ingest in shadow mode.
- **Strategy gate false positives:** disable `CRE_STRATEGY_HEALTH_GATE_ENABLED`.
- **Oracle write issues:** disable `CRE_ORACLE_VALIDATOR_WRITE_ENABLED` and return to monitor mode.

## Expected observability

- Handler logs include structured reason codes for skipped/rejected/executed decisions.
- `keeper_cre_attestations` tracks:
  - payload,
  - decision state,
  - execution job linkage,
  - tx hash or failure code.

## Notes

- This rollout intentionally does **not** replace canonical vault/PPS accounting.
- Contract-level guards remain authoritative:
  - `SolanaStrategy` report replay + delta caps,
  - `CreatorOracle` staleness/deviation and updater authorization.
