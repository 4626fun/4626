---
title: Keeper Job Coordination
sidebar_position: 5
---

# Keeper Job Coordination

The keeper job queue is the fallback lane for operational work that must remain live even when the primary path is unavailable or constrained.

## Boundary

- **Queue/API:** `/api/keeper/jobs/*` stores, leases, and finalizes durable jobs.
- **Worker:** `pnpm -C frontend keeper:jobs:worker` claims due jobs and executes allowlisted internal API calls.
- **Privileged execution:** stays behind existing machine-auth endpoints. The worker does not introduce a new wallet/signing authority.

## Database

Apply the migration:

```bash
pnpm -C frontend db:migrate
```

The migration creates `public.keeper_jobs` with deny-all RLS. Server code reaches it through the Postgres service connection, not public REST.

## Required Environment

Set these on the API runtime and worker runtime:

```bash
KEEPR_API_KEY=<shared-machine-secret>
KEEPER_COORDINATION_BASE_URL=https://app.4626.fun
```

Optional worker controls:

```bash
KEEPER_WORKER_ID=keeper-worker-1
KEEPER_WORKER_LIMIT=1
KEEPER_WORKER_LEASE_SECONDS=300
KEEPER_WORKER_RETRY_DELAY_SECONDS=60
```

## API

All endpoints require `Authorization: Bearer <KEEPR_API_KEY>`.

### Enqueue

```bash
curl -X POST "$KEEPER_COORDINATION_BASE_URL/api/keeper/jobs/enqueue" \
  -H "Authorization: Bearer $KEEPR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "internal_api",
    "dedupeKey": "sweep:0xvault",
    "payload": {
      "path": "/api/keeper/sweep",
      "body": { "vaultAddress": "0x0000000000000000000000000000000000000000" }
    }
  }'
```

### Claim

```bash
curl -X POST "$KEEPER_COORDINATION_BASE_URL/api/keeper/jobs/claim" \
  -H "Authorization: Bearer $KEEPR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "workerId": "keeper-worker-1", "limit": 1, "kinds": ["internal_api"] }'
```

### Complete

```bash
curl -X POST "$KEEPER_COORDINATION_BASE_URL/api/keeper/jobs/complete" \
  -H "Authorization: Bearer $KEEPR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "id": 1, "workerId": "keeper-worker-1", "status": "succeeded", "result": { "ok": true } }'
```

### Status

```bash
curl "$KEEPER_COORDINATION_BASE_URL/api/keeper/jobs/status?status=retry&limit=25" \
  -H "Authorization: Bearer $KEEPR_API_KEY"
```

## Worker

Run one external worker tick:

```bash
pnpm -C frontend keeper:jobs:worker
```

Schedule the worker with your preferred runtime cron. The worker only executes `kind: "internal_api"` jobs whose paths start with:

- `/api/keeper/`
- `/api/keepr/actions/`

It also supports `kind: "noop"` for smoke tests. Unsupported kinds or paths fail closed. Retryable internal API failures are marked `retry` with the configured delay.

Smoke-test the full queue and worker loop without triggering keeper mutations:

```bash
curl -X POST "$KEEPER_COORDINATION_BASE_URL/api/keeper/jobs/enqueue" \
  -H "Authorization: Bearer $KEEPR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "kind": "noop", "dedupeKey": "smoke:keeper-worker", "payload": { "reason": "smoke" } }'

pnpm -C frontend keeper:jobs:worker
```

Vercel also runs `/api/keeper/jobs/run` every 5 minutes through `vercel.json`. That cron is gated by `CRON_SECRET` and uses the same job runner as the external worker script.

## Sweep Canary

The first real fallback workflow is a single-strategy CCA sweep canary. Vercel calls `/api/keeper/jobs/enqueue-sweep-canary` every 15 minutes. The endpoint is `CRON_SECRET` gated and is disabled unless a canary strategy is configured.

Required canary env:

```bash
KEEPER_SWEEP_CANARY_CCA_STRATEGY_ADDRESS=0x...
```

Optional mark-settled chaining:

```bash
KEEPER_SWEEP_CANARY_VAULT_ADDRESS=0x...
```

When `KEEPER_SWEEP_CANARY_VAULT_ADDRESS` is set and `/api/keeper/sweep` returns `completed: true` with `completionStage: "completed"`, the runner enqueues a second deduped `internal_api` job for `/api/keeper/mark-settled`. This keeps DB settlement writes behind the existing `mark-settled` invariant gate instead of writing DB state directly from the queue worker.

When `KEEPER_SWEEP_CANARY_ENFORCE_INVARIANTS` is unset or `true`, also set:

```bash
KEEPER_SWEEP_CANARY_CREATOR_COIN_ADDRESS=0x...
KEEPER_SWEEP_CANARY_SHARE_TOKEN_ADDRESS=0x...
KEEPER_SWEEP_CANARY_GAUGE_CONTROLLER_ADDRESS=0x...
KEEPER_SWEEP_CANARY_PAYOUT_RECIPIENT_MODE=gauge
```

Router mode additionally requires:

```bash
KEEPER_SWEEP_CANARY_PAYOUT_RECIPIENT_MODE=payout_router
KEEPER_SWEEP_CANARY_PAYOUT_ROUTER_ADDRESS=0x...
KEEPER_SWEEP_CANARY_BURN_STREAM_ADDRESS=0x...
```

The enqueued job is:

```json
{
  "kind": "internal_api",
  "dedupeKey": "sweep-canary:<ccaStrategyAddress>",
  "payload": {
    "path": "/api/keeper/sweep",
    "body": {
      "ccaStrategyAddress": "0x...",
      "enforceInvariants": true,
      "invariants": {}
    }
  }
}
```

Keep the canary to one known strategy until retries/failures stay at zero for a full deployment cycle.

## Vault Tend/Report Canary

Vercel also calls `/api/keeper/jobs/enqueue-vault-canary` every 30 minutes. It is disabled unless both envs are set:

```bash
KEEPER_VAULT_CANARY_VAULT_ADDRESS=0x...
KEEPER_VAULT_CANARY_ACTIONS=tend,report
```

Start with either `report` or `tend`, not both, unless you intentionally want both keeper writes active for the same vault. Each action is deduped separately:

```json
{
  "kind": "internal_api",
  "dedupeKey": "vault-report-canary:<vaultAddress>",
  "payload": {
    "path": "/api/keeper/report",
    "body": { "vaultAddress": "0x..." }
  }
}
```

## Active Vault Discovery

The broader replacement path is `/api/keeper/jobs/enqueue-active-vaults`, called by Vercel every 30 minutes. It is disabled by default.

Enable it only after the single-vault canaries are stable:

```bash
KEEPER_ACTIVE_VAULT_ENQUEUE_ENABLED=1
KEEPER_ACTIVE_VAULT_WORKFLOWS=sweep
KEEPER_ACTIVE_VAULT_CHAIN_ID=8453
KEEPER_ACTIVE_VAULT_LIMIT=5
KEEPER_ACTIVE_VAULT_ENFORCE_INVARIANTS=true
KEEPER_ACTIVE_VAULT_PAYOUT_RECIPIENT_MODE=gauge
```

Supported workflows are:

- `sweep` — enqueues `/api/keeper/sweep` for unsettled vaults with `contracts.ccaStrategy`.
- `tend` — enqueues `/api/keeper/tend` for each discovered vault.
- `report` — enqueues `/api/keeper/report` for each discovered vault.
- `payout` — enqueues `/api/keeper/payout-router-harvest` for vaults with `contracts.payoutRouter`.

Discovery reads `keepr_vaults` directly and embeds addresses in the queued payloads. The worker still only executes POST jobs, so it does not need to call `/api/vaults/active` at runtime.

## Keepr Action Queue Processing

Vercel also calls `/api/keeper/jobs/process-keepr-actions` every 5 minutes. This replaces the `keepr-action-queue` loop when enabled:

```bash
KEEPER_PROCESS_KEEPR_ACTIONS_ENABLED=1
KEEPER_PROCESS_KEEPR_ACTIONS_LIMIT=1
KEEPER_PROCESS_KEEPR_ACTIONS_RETRY_DELAY_SECONDS=60
```

It fetches `/api/keepr/actions/pending`, claims one action with `updateStatus: executing`, executes `/api/keepr/actions/execute`, and finalizes with `executed`, `retry`, or `failed`. Trust-zone headers are derived from the action type and the existing `KEEPR_ZONE_KEY_*` env vars.

## Bridge Integrity Monitor

Vercel also calls `/api/keeper/jobs/enqueue-bridge-integrity` every 15 minutes. This replaces the bridge-integrity monitor when enabled:

```bash
KEEPER_BRIDGE_INTEGRITY_ENQUEUE_ENABLED=1
```

It enqueues `/api/keeper/bridge-integrity`, a read-only keeper endpoint that evaluates the existing `/api/deploy/solanaInfraStatus` response and reports `ok`, `warning`, or `critical` findings. It does not mutate bridge contracts.

## Ajna/Charm Strategy Canaries

Vercel also calls `/api/keeper/jobs/enqueue-strategy-canary` every 30 minutes. This is disabled by default and enqueues existing `keepr_actions` instead of adding new direct strategy writers:

```bash
KEEPER_STRATEGY_CANARY_ENABLED=1
KEEPER_STRATEGY_CANARY_ACTIONS=ajna,charm
KEEPER_STRATEGY_CANARY_VAULT_ADDRESS=0x...
KEEPER_STRATEGY_CANARY_GROUP_ID=<group-id>
```

Ajna:

```bash
KEEPER_STRATEGY_CANARY_AJNA_AUTH_ADDRESS=0x...
KEEPER_STRATEGY_CANARY_AJNA_STRATEGY_ADDRESS=0x...
KEEPER_STRATEGY_CANARY_AJNA_TARGET_BUCKET=1234
```

Charm:

```bash
KEEPER_STRATEGY_CANARY_CHARM_VAULT_ADDRESS=0x...
```

These canaries rely on `/api/keeper/jobs/process-keepr-actions` to execute the action queue. Keep `KEEPER_PROCESS_KEEPR_ACTIONS_LIMIT=1` until each strategy action has run cleanly.

## Strategy Signal Polling Fallback

Vercel also calls `/api/keeper/jobs/enqueue-strategy-signals` every 5 minutes. This is disabled by default and replaces the always-on websocket listener with explicit cron-polled queued actions:

```bash
KEEPER_STRATEGY_SIGNALS_ENABLED=1
KEEPER_STRATEGY_SIGNALS_TARGETS_JSON='[
  {
    "vaultAddress": "0x...",
    "groupId": "...",
    "actionType": "strategy.charm.rebalance",
    "dedupeKey": "strategy-signal:charm:...",
    "action": {
      "charmVaultAddress": "0x...",
      "strategyAddress": "0x..."
    }
  }
]'
```

Only `strategy.ajna.rebucket` and `strategy.charm.rebalance` are accepted. Execution still goes through `keepr_actions` and `/api/keeper/jobs/process-keepr-actions`.

## Solana Reconcile Fallback

Vercel also calls `/api/keeper/jobs/enqueue-solana-reconcile` every 15 minutes. This is disabled by default and enqueues checkpointed calls to `/api/keeper/solana/reconcile`:

```bash
KEEPER_SOLANA_RECONCILE_ENABLED=1
KEEPER_SOLANA_RECONCILE_WORKFLOW=solana-orchestrator
KEEPER_SOLANA_RECONCILE_ACTIONS=relay_entries,settle_fees,winner_relay
```

Supported action labels are:

- `relay_entries`
- `settle_fees`
- `winner_relay`
- `price_monitor`
- `graduation`
- `rebalance`

The reconcile endpoint is idempotent by `workflow + checkpointKey`. If `KEEPER_SOLANA_RECONCILE_CHECKPOINT_PREFIX` is unset, the daily UTC date is used.

Run the owned Solana orchestrator sidecar:

```bash
pnpm -C cre start:solana-orchestrator
```

Required sidecar env:

```bash
SOLANA_ORCHESTRATOR_API_KEY=<shared-secret>
SOLANA_ORCHESTRATOR_PORT=8789
```

By default every action fails closed. Enable globally or per action:

```bash
SOLANA_ORCHESTRATOR_EXECUTE=1
# or:
SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=1
SOLANA_ORCHESTRATOR_SETTLE_FEES_ENABLED=1
SOLANA_ORCHESTRATOR_WINNER_RELAY_ENABLED=1
SOLANA_ORCHESTRATOR_PRICE_MONITOR_ENABLED=1
SOLANA_ORCHESTRATOR_GRADUATION_ENABLED=1
SOLANA_ORCHESTRATOR_REBALANCE_ENABLED=1
```

Monitor stuck jobs:

```bash
curl "$KEEPER_COORDINATION_BASE_URL/api/keeper/jobs/health" \
  -H "Authorization: Bearer $KEEPR_API_KEY"
```

Non-zero `retry`, `failed`, or `expiredClaims` should page the operator once the fallback lane is carrying production work.

## Operating Notes

- Use stable `dedupeKey` values for recurring jobs so repeated enqueues update the active row instead of creating duplicates.
- Keep `KEEPER_WORKER_LIMIT=1` until the target job type is proven idempotent.
- If a worker dies after claiming, the next claim call releases expired leases before claiming new work.
- Treat this as the fallback coordination plane. Do not put raw private keys or broad signing logic into queue payloads.
