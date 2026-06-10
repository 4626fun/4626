# Vercel cron production fixes (DB saturation)

Runbook for the May 2026 production log cluster: `ethos-sync-hot` 504s, `timeout exceeded when trying to connect`, `pool after calling end`, `control_plane_stages` FK violations, and AlfaClub `known_bad_jwt`.

## Preflight

1. Confirm production project is `akita-llc/4626`.
2. Confirm `DATABASE_URL` is using Supabase transaction pooler (6543).
3. Confirm these env keys are set in production:

```bash
CRON_DB_CONNECT_DEADLINE_MS=8000
ETHOS_HOT_SYNC_BUDGET_MS=52000
ETHOS_SYNC_BUDGET_MS=52000
ETHOS_CREATOR_PROJECTION_LIMIT_HOT=2000
ETHOS_CREATOR_PROJECTION_LIMIT=10000
POSTGRES_POOL_MAX=1
POSTGRES_POOL_IDLE_TIMEOUT_MS=1000
POSTGRES_POOL_CONNECT_TIMEOUT_MS=10000
KEEPER_INTERNAL_API_TIMEOUT_MS=52000
```

4. Confirm roll-forward target branch/commit contains the fixes listed below.

## Execute

Deploy the fix set from `fix/vercel-agent-process-stub` into `main` and promote production.

### Code fixes included

| Area | Change |
| ---- | ------ |
| Postgres | `getDbForCron()` 8s deadline; pool generation/rebind after reset |
| Ethos hot | `*/2` cron, fast projection, 52s budget, 503 on pool errors |
| Ethos full | 52s budget, fast projection, 10k projection cap, 503 on pool errors |
| Keeper ethos | Same 52s budget as hot lane; 503 on pool saturation |
| Keeper jobs | `KEEPER_INTERNAL_API_TIMEOUT_MS` aborts child internal_api fetches |
| Keeper jobs | All `keeper_jobs` DB access via `getDbForCron` |
| Control plane | `persisted` only when parent row exists; no stage FK without parent |
| AlfaClub | Privy refresh once per tick when JWT known-bad; token refresh every 10m |
| Cron stagger | Hot on even minutes (skip `:24`/`:54`); full at `:09`/`:24`/`:39`/`:54` — zero overlap |

### AlfaClub JWT path

1. Confirm cron `/api/v1/alfaclub/chat-token-refresh` runs (every 10m after deploy).
2. If `known_bad_jwt` persists, run `pnpm -C frontend exec tsx scripts/alfaclub-restore-tokens.mjs --apply` with valid Privy refresh material (see script help).
3. Bridge tick now triggers `requestImmediatePrivyRefresh` when the cached JWT is still marked bad.

## Verify

After deploy, healthy signals are:

- `ethos-sync-hot` returns 200 or **503** in <15s (not 504 at 60s)
- No `control_plane_stages_operation_id_fkey` on solana reconcile
- No `Cannot use a pool after calling end` on enqueue-ethos-sync

Known-good verification output pattern:

```text
ethos-sync-hot: 200 (or 503) < 15s
control-plane stages: no FK errors
enqueue-ethos-sync: no pool-end errors
```

## Rollback

If behavior regresses after deploy:

1. Roll back to previous production deployment.
2. Keep `POSTGRES_POOL_MAX=1` and DB pooler settings intact unless rollback requires older known-good values.
3. Re-enable reduced-load flags before retry:
   - `ETHOS_HOT_SOCIAL_USERKEY_SEED_LIMIT=0`
   - `ETHOS_PROJECTION_FALLBACK_ENABLED=0`
   - lower `INDEXER_ENRICH_BUDGET` if needed
4. Re-run verification checks before another promotion.

## Optional load relief

- Set `ETHOS_HOT_SOCIAL_USERKEY_SEED_LIMIT=0` temporarily
- Set `ETHOS_PROJECTION_FALLBACK_ENABLED=0` on hot lane
- Lower `INDEXER_ENRICH_BUDGET` if zora enrich cron adds pressure
