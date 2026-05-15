# CRE Integration Report (Project 4626)

## Scope and References

This integration aligns `cre/cre-workflows` with Chainlink CRE SDK/CLI patterns and migration goals from the Phase 0 plan.  
Reference set used during implementation:

- `smartcontractkit/cre-templates` (workflow structure and trigger patterns)
- Read Data Feeds building block (`cron` + EVM read pattern)
- CRE TS SDK reference (runtime, handlers, triggers, clients)
- CRE CLI docs and workflow command references

## Current State Inventory

### Existing workflows (stabilized/refactored)

| Workflow | Trigger(s) | Primary capabilities | Writes |
|---|---|---|---|
| `keepr-action-queue` | Cron | HTTP queue orchestration | Indirect via API |
| `vault-keeper` | Cron | EVM reads + decisioning + write fallback | HTTP bridge + native-write prototype |
| `cca-finalization` | Cron | EVM reads + settlement decisioning | HTTP bridge + native-write prototype |
| `payout-integrity` | Cron | EVM integrity checks + alerting + AI advisory | Alert/AI HTTP only |

### New CRE workflows added

| Workflow | Trigger(s) | Purpose |
|---|---|---|
| `ajna-bucket-manager` | Cron + HTTP | CRE-native Ajna rebucket orchestration and deduped queue enqueue |
| `charm-rebalance-manager` | Cron + HTTP | CRE-native Charm rebalance orchestration and deduped queue enqueue |
| `strategy-signal-listener` | EVM log trigger + Cron | Reactive strategy orchestration with periodic backfill |
| `solana-orchestrator` | Cron + HTTP | Solana offchain orchestration via typed HTTP reconcile/checkpoint path |

## Gaps Found (Phase 0) and Resolution

- **Settlement local sim miswire**: fixed by adding `cca-finalization/config.local-simulation.json` and wiring `workflow.yaml` correctly.
- **Hardcoded chain targeting**: replaced with config-driven chain resolution (`chainName` + optional `chainId`) in CRE workflows.
- **Single-vault starvation risk**: added deterministic rotation helper so each run advances through eligible vaults.
- **Cross-workflow duplication**: added shared modules under `cre/cre-workflows/_shared` for HTTP, EVM reads, rotation, strategy queue, strategy math, and native-write prototype.
- **Missing CRE-native Ajna/Charm orchestration**: added dedicated CRE SDK workflows with cron + HTTP triggers.
- **Missing reactive strategy execution**: added `strategy-signal-listener` with EVM log trigger and cron backfill.
- **Solana orchestration outside CRE boundary**: added CRE-managed `solana-orchestrator` and typed/idempotent API checkpoint endpoint.
- **CI hardening gap**: added `.github/workflows/cre-workflows.yml` with layout validation, workflow typecheck, focused API tests, optional simulation job, and secret scanning.

## Target Architecture (Implemented)

```text
CronTrigger -------\
HTTPTrigger --------> CRE Workflows ----------> Decision Layer ----------\
EVMLogTrigger -----/         |                                         |
                            |                                         v
                            +--> EVM Reads (EVMClient)            API Bridge
                                                                         |
                                                    +--------------------+--------------------+
                                                    |                                         |
                                              Base write execution                     Solana offchain service
                                              (bridge/native fallback)                (checkpointed reconcile)
```

## What Changed and Why

1. **Phase 0/1 foundation standardization**
   - Added Phase 0 audit output doc: `docs/plans/2026-03-03-cre-phase0-audit.md`.
   - Fixed local simulation config wiring for `cca-finalization`.
   - Added generated artifact ignore for `.cre_build_tmp.js`.
   - Added workflow layout validator and unified typecheck script.

2. **Shared CRE utilities**
   - `cre/cre-workflows/_shared/http.ts`: normalized auth/header/body helpers.
   - `cre/cre-workflows/_shared/evm.ts`: config-driven EVM client and read wrapper.
   - `cre/cre-workflows/_shared/rotation.ts`: deterministic coverage rotation.
   - `cre/cre-workflows/_shared/strategyMath.ts`: Ajna/Charm decision math helpers.
   - `cre/cre-workflows/_shared/strategyQueue.ts`: typed vault fetch + enqueue helpers.
   - `cre/cre-workflows/_shared/nativeWrite.ts`: `runtime.report()` + `writeReport()` fallback-ready prototype.

3. **Ajna/Charm migration to CRE**
   - Added `ajna-bucket-manager` and `charm-rebalance-manager` CRE workflow directories with full target configs, tsconfig, package, and workflow manifests.
   - Preserved guardrails via threshold checks, dedupe keys, and deterministic action payloads.

4. **Reactive strategy orchestration**
   - Added `strategy-signal-listener` with:
     - EVM log-trigger path (reactive mode)
     - Cron backfill path (missed-event recovery)

5. **Solana orchestration boundary**
  - Added `solana-orchestrator` workflow (cron + HTTP) that posts idempotent checkpoints to:
    - `frontend/api/_handlers/keeper/_solanaReconcile.ts`
   - Added route registration in `frontend/api/_handlers/_routes.ts`.

6. **Native write-path prototype**
   - `vault-keeper` and `cca-finalization` now attempt native report-write first (when enabled/configured), then fall back to existing HTTP bridge.

7. **CI + ops readiness**
   - Added GitHub Actions pipeline: `.github/workflows/cre-workflows.yml`.
   - Added scripts:
     - `cre/cre-workflows/scripts/validate-workflow-layout.sh`
     - `cre/cre-workflows/scripts/typecheck-workflows.sh`
     - `cre/cre-workflows/scripts/simulate-workflows.sh`

## How to Run Workflows

All commands from repo root unless noted.

### 1) Validate and typecheck

```bash
bash cre/cre-workflows/scripts/validate-workflow-layout.sh
bash cre/cre-workflows/scripts/typecheck-workflows.sh
```

### 2) Simulate locally

```bash
cd cre/cre-workflows
cre workflow simulate keepr-action-queue --target local-simulation
cre workflow simulate vault-keeper --target local-simulation
cre workflow simulate cca-finalization --target local-simulation
cre workflow simulate payout-integrity --target local-simulation
cre workflow simulate ajna-bucket-manager --target local-simulation
cre workflow simulate charm-rebalance-manager --target local-simulation
cre workflow simulate strategy-signal-listener --target local-simulation
cre workflow simulate solana-orchestrator --target local-simulation
```

### 3) Deploy and activate

```bash
cd cre/cre-workflows
cre workflow deploy <workflow-name> --target staging-settings
cre workflow deploy <workflow-name> --target production-settings
cre workflow activate <workflow-id>
```

### 4) Update, pause, delete

```bash
cre workflow update <workflow-id> --workflow-file <path/to/workflow.yaml> --target <target-name>
cre workflow pause <workflow-id>
cre workflow delete <workflow-id>
```

> Note: after `update`, CRE may assign a new workflow ID depending on deployment mode. Track IDs in ops metadata before downstream validation changes.

## Secrets Management

1. Source-of-truth mapping is in `cre/cre-workflows/secrets.yaml`.
2. Configure secrets via CRE CLI:

```bash
cre secrets set KPR_API_KEY
cre secrets set KPR_API_BASE_URL
cre secrets set KPR_PRIVATE_KEY
```

3. Local simulation values should only live in local `.env` files (never committed with real secrets).
4. Solana reconcile bridge supports optional:
   - `SOLANA_ORCHESTRATOR_URL`
   - `SOLANA_ORCHESTRATOR_API_KEY`

## Verification Evidence (this implementation)

- Workflow layout validation: passed
- CRE workflow typecheck: passed (all workflow directories)
- Focused frontend API test: `api/__tests__/v1BuildCharmHandlers.test.ts` passed (8/8)

## Next Improvements Backlog

1. Add explicit config schema validation (Zod or equivalent) in each workflow startup path.
2. Add workflow-level unit tests for decision logic and ABI decode helpers.
3. Add HTTP-trigger simulation fixtures and scripted replay in CI (manual trigger paths).
4. Add durable event checkpoint store for strategy log processing (event idempotency keys).
5. Productionize receiver-contract native write path with contract-level ack telemetry.
6. Add CRE deployment inventory manifest (workflow name -> active ID per environment).
