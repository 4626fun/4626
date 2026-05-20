# Vercel cron production fixes (DB saturation)

Runbook for the May 2026 production log cluster: `ethos-sync` 504s, `timeout exceeded when trying to connect`, `pool after calling end`, `control_plane_stages` FK violations, and AlfaClub `known_bad_jwt`.

## Code fixes

| Area | Change |
| ---- | ------ |
| Postgres | `getDbForCron()` 8s deadline; pool generation/rebind after reset |
| Ethos sync | **Once daily** (`15 4 * * *` UTC) via `/api/v1/chat/ethos-sync` only; hot + keeper duplicate crons removed |
| Ethos full | 52s budget, 10k projection cap, 503 on pool saturation |
| Keeper jobs | `KEEPER_INTERNAL_API_TIMEOUT_MS` aborts child internal_api fetches |
| Keeper jobs | All `keeper_jobs` DB access via `getDbForCron` |
| Control plane | `persisted` only when parent row exists; no stage FK without parent |
| AlfaClub | Privy refresh once per tick when JWT known-bad; token refresh every 10m |

Paid on-demand refresh (`POST /api/creator/ethos/refresh`) remains for creators who need a score newer than the daily batch.

## Required Vercel production env

```bash
CRON_DB_CONNECT_DEADLINE_MS=8000
ETHOS_SYNC_BUDGET_MS=52000
ETHOS_CREATOR_PROJECTION_LIMIT=10000
ETHOS_CREATOR_PROJECTION_FULL_EVERY_N=1
ETHOS_CANONICAL_SCORE_HOT_SYNC_ENABLED=0
ETHOS_SCORE_PROJECTION_STALE_ALERT_HOURS=30
POSTGRES_POOL_MAX=1
POSTGRES_POOL_IDLE_TIMEOUT_MS=1000
POSTGRES_POOL_CONNECT_TIMEOUT_MS=10000
KEEPER_INTERNAL_API_TIMEOUT_MS=52000
KEEPER_ETHOS_SYNC_ENQUEUE_ENABLED=0
```

Keep `DATABASE_URL` on Supabase **transaction** pooler (port 6543) for serverless, not session mode, unless you have raised `pool_size`.

## AlfaClub JWT

1. Confirm cron `/api/v1/alfaclub/chat-token-refresh` runs (every 10m after deploy).
2. If `known_bad_jwt` persists, run `pnpm -C frontend exec tsx scripts/alfaclub-restore-tokens.mjs --apply` with valid Privy refresh material (see script help).
3. Bridge tick now triggers `requestImmediatePrivyRefresh` when the cached JWT is still marked bad.

## Deploy

Merge to `main` and promote production on project `akita-llc/4626`.

After deploy, healthy signals:

- `ethos-sync` completes once per day with 200 or **503** in &lt;60s (not 504 at 60s)
- No `ethos-sync-hot` or `enqueue-ethos-sync` cron entries in `vercel.json`
- No `control_plane_stages_operation_id_fkey` on solana reconcile

## Optional load relief

- Lower `INDEXER_ENRICH_BUDGET` if zora enrich cron adds pressure
