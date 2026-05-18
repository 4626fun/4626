# KPR Integration Report (Project 4626)

## Scope and References

This integration aligns `kpr/kpr-workflows` with Chainlink KPR SDK/CLI patterns and migration goals from the Phase 0 plan.  
Reference set used during implementation:

- `smartcontractkit` workflow templates (workflow structure and trigger patterns)
- Read Data Feeds building block (`cron` + EVM read pattern)
- KPR TS SDK reference (runtime, handlers, triggers, clients)
- KPR CLI docs and workflow command references

## Current State Inventory

### Existing workflows (stabilized/refactored)

| Workflow | Trigger(s) | Primary capabilities | Writes |
|---|---|---|---|
| `keepr-action-queue` | Cron | HTTP queue orchestration | Indirect via API |
| `vault-keeper` | Cron | EVM reads + decisioning + write fallback | HTTP bridge + native-write prototype |
| `cca-finalization` | Cron | EVM reads + settlement decisioning | HTTP bridge + native-write prototype |
| `payout-integrity` | Cron | EVM integrity checks + alerting + AI advisory | Alert/AI HTTP only |

### New KPR workflows added

| Workflow | Trigger(s) | Purpose |
|---|---|---|
| `ajna-bucket-manager` | Cron + HTTP | KPR-native Ajna rebucket orchestration and deduped queue enqueue |
| `charm-rebalance-manager` | Cron + HTTP | KPR-native Charm rebalance orchestration and deduped queue enqueue |
| `strategy-signal-listener` | EVM log trigger + Cron | Reactive strategy orchestration with periodic backfill |
| `solana-orchestrator` | Cron + HTTP | Solana offchain orchestration via typed HTTP reconcile/checkpoint path |

## Gaps Found (Phase 0) and Resolution

- **Settlement local sim miswire**: fixed by adding `cca-finalization/config.local-simulation.json` and wiring `workflow.yaml` correctly.
- **Hardcoded chain targeting**: replaced with config-driven chain resolution (`chainName` + optional `chainId`) in KPR workflows.
- **Single-vault starvation risk**: added deterministic rotation helper so each run advances through eligible vaults.
- **Cross-workflow duplication**: added shared modules under `kpr/kpr-workflows/_shared` for HTTP, EVM reads, rotation, strategy queue, strategy math, and native-write prototype.
- **Missing KPR-native Ajna/Charm orchestration**: added dedicated KPR SDK workflows with cron + HTTP triggers.
- **Missing reactive strategy execution**: added `strategy-signal-listener` with EVM log trigger and cron backfill.
- **Solana orchestration outside KPR boundary**: added KPR-managed `solana-orchestrator` and typed/idempotent API checkpoint endpoint.
- **CI hardening gap**: added `.github/workflows/kpr-workflows.yml` with layout validation, workflow typecheck, focused API tests, optional simulation job, and secret scanning.

## Target Architecture (Implemented)

```text
CronTrigger -------\
HTTPTrigger --------> KPR Workflows ----------> Decision Layer ----------\
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
   - Added Phase 0 audit output doc for migration planning.
   - Fixed local simulation config wiring for `cca-finalization`.
   - Added generated artifact ignore for temporary workflow build files.
   - Added workflow layout validator and unified typecheck script.

2. **Shared KPR utilities**
   - `kpr/kpr-workflows/_shared/http.ts`: normalized auth/header/body helpers.
   - `kpr/kpr-workflows/_shared/evm.ts`: config-driven EVM client and read wrapper.
   - `kpr/kpr-workflows/_shared/rotation.ts`: deterministic coverage rotation.
   - `kpr/kpr-workflows/_shared/strategyMath.ts`: Ajna/Charm decision math helpers.
   - `kpr/kpr-workflows/_shared/strategyQueue.ts`: typed vault fetch + enqueue helpers.
   - `kpr/kpr-workflows/_shared/nativeWrite.ts`: `runtime.report()` + `writeReport()` fallback-ready prototype.

3. **Ajna/Charm migration to KPR**
   - Added `ajna-bucket-manager` and `charm-rebalance-manager` KPR workflow directories with full target configs, tsconfig, package, and workflow manifests.
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
   - Added GitHub Actions pipeline: `.github/workflows/kpr-workflows.yml`.
   - Added scripts:
     - `kpr/kpr-workflows/scripts/validate-workflow-layout.sh`
     - `kpr/kpr-workflows/scripts/typecheck-workflows.sh`
     - `kpr/kpr-workflows/scripts/simulate-workflows.sh`

## How to Run Workflows

All commands from repo root unless noted.

### 1) Validate and typecheck

```bash
bash kpr/kpr-workflows/scripts/validate-workflow-layout.sh
bash kpr/kpr-workflows/scripts/typecheck-workflows.sh
```

### 2) Simulate locally

```bash
pnpm -C kpr run start -- keepr-action-queue
pnpm -C kpr run start -- vault-keeper
pnpm -C kpr run start -- cca-finalization
pnpm -C kpr run start -- payout-integrity
pnpm -C kpr run start -- ajna-bucket-manager
pnpm -C kpr run start -- charm-rebalance-manager
pnpm -C kpr run start -- strategy-signal-listener
pnpm -C kpr run start -- solana-orchestrator
```

### 3) Deploy and activate

```bash
pnpm -C kpr run start -- <workflow-name>
pnpm -C kpr run start -- <workflow-name>
pnpm -C kpr run start -- <workflow-id>
```

### 4) Update, pause, delete

```bash
pnpm -C kpr run start -- <workflow-id>
pnpm -C kpr run start -- <workflow-id>
pnpm -C kpr run start -- <workflow-id>
```

> Note: after `update`, KPR may assign a new workflow ID depending on deployment mode. Track IDs in ops metadata before downstream validation changes.

## Secrets Management

1. Source-of-truth mapping is in `kpr/kpr-workflows/secrets.yaml`.
2. Local simulation values should only live in local `.env` files (never committed with real secrets).
3. Solana reconcile bridge supports optional:
   - `SOLANA_ORCHESTRATOR_URL`
   - `SOLANA_ORCHESTRATOR_API_KEY`

## Verification Evidence (this implementation)

- Workflow layout validation: passed
- KPR workflow typecheck: passed (all workflow directories)
- Focused frontend API test: `api/__tests__/v1BuildCharmHandlers.test.ts` passed (8/8)

## Next Improvements Backlog

1. Add explicit config schema validation (Zod or equivalent) in each workflow startup path.
2. Add workflow-level unit tests for decision logic and ABI decode helpers.
3. Add HTTP-trigger simulation fixtures and scripted replay in CI (manual trigger paths).
4. Add durable event checkpoint store for strategy log processing (event idempotency keys).
5. Productionize receiver-contract native write path with contract-level ack telemetry.
6. Add KPR deployment inventory manifest (workflow name -> active ID per environment).
