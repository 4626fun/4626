---
title: Keeper Job Coordination
sidebar_position: 5
---

# Keeper Job Coordination

The keeper job queue is the CRE-independent fallback lane for operational work that must remain live even when the Chainlink CRE path is unavailable or constrained.

## Boundary

- **Queue/API:** `/api/keeper/jobs/*` stores, leases, and finalizes durable jobs.
- **Worker:** `pnpm -C frontend keeper:jobs:worker` claims due jobs and executes allowlisted internal API calls.
- **Privileged execution:** stays behind existing machine-auth endpoints. The worker does not introduce a new wallet/signing authority.
- **CRE:** can still run in parallel, but production liveness does not depend on CRE being responsive.

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
      "path": "/api/cre/keeper/sweep",
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

- `/api/cre/keeper/`
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
