# Vercel cron production fixes (DB saturation)

Runbook for the May 2026 production log cluster: `ethos-sync-hot` 504s, `timeout exceeded when trying to connect`, `pool after calling end`, `control_plane_stages` FK violations, and AlfaClub `known_bad_jwt`.

## Code fixes (branch `fix/vercel-agent-process-stub` → `main`)

| Area | Change |
| ---- | ------ |
| Postgres | `getDbForCron()` 8s deadline; pool generation/rebind after reset |
| Ethos hot | `*/2` cron, fast projection, 52s budget, 503 on pool errors |
| Ethos full | 52s budget, fast projection, 10k projection cap |
| Keeper jobs | All `keeper_jobs` DB access via `getDbForCron` |
| Control plane | `persisted` only when parent row exists; no stage FK without parent |
| AlfaClub | Privy refresh once per tick when JWT known-bad; token refresh every 10m |
| Cron stagger | Offset minute-heavy jobs so they do not all hit `:00` |

## Required Vercel production env

```bash
CRON_DB_CONNECT_DEADLINE_MS=8000
ETHOS_HOT_SYNC_BUDGET_MS=52000
ETHOS_SYNC_BUDGET_MS=52000
ETHOS_CREATOR_PROJECTION_LIMIT_HOT=2000
ETHOS_CREATOR_PROJECTION_LIMIT=10000
POSTGRES_POOL_MAX=1
POSTGRES_POOL_IDLE_TIMEOUT_MS=1000
POSTGRES_POOL_CONNECT_TIMEOUT_MS=10000
```

Keep `DATABASE_URL` on Supabase **transaction** pooler (port 6543) for serverless, not session mode, unless you have raised `pool_size`.

## AlfaClub JWT

1. Confirm cron `/api/v1/alfaclub/chat-token-refresh` runs (every 10m after deploy).
2. If `known_bad_jwt` persists, run `pnpm -C frontend exec tsx scripts/alfaclub-restore-tokens.mjs --apply` with valid Privy refresh material (see script help).
3. Bridge tick now triggers `requestImmediatePrivyRefresh` when the cached JWT is still marked bad.

## Deploy

Merge `fix/vercel-agent-process-stub` into `main` and promote production on project `akita-llc/4626`.

After deploy, healthy signals:

- `ethos-sync-hot` returns 200 or **503** in &lt;15s (not 504 at 60s)
- No `control_plane_stages_operation_id_fkey` on solana reconcile
- No `Cannot use a pool after calling end` on enqueue-ethos-sync

## Optional load relief

- Set `ETHOS_HOT_SOCIAL_USERKEY_SEED_LIMIT=0` temporarily
- Set `ETHOS_PROJECTION_FALLBACK_ENABLED=0` on hot lane
- Lower `INDEXER_ENRICH_BUDGET` if zora enrich cron adds pressure
