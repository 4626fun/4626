# Ethos canonical score cache operations

This runbook covers first-time rollout and steady-state operation of the canonical Ethos score cache pipeline.

## Scope

The pipeline writes and serves Ethos scores via local Postgres/Supabase tables:

- `public.user_ethos_identity_keys`
- `public.ethos_userkey_scores`
- `public.canonical_ethos_scores`
- `public.ethos_score_sync_state`
- `public.creator_ethos_projection` (precomputed creator-score sort surface)

User-facing request paths read local projections and do not need live Ethos API calls when canonical reads are enabled.

## 1) Preflight

Required server env vars:

- `ETHOS_API_KEY` (recommended for stable quota)
- `ETHOS_CLIENT_NAME` (or `X_ETHOS_CLIENT`)
- `CRON_SECRET` (for Vercel cron auth)

Feature flags:

- `ETHOS_CANONICAL_SCORE_SYNC_ENABLED=1`
- `ETHOS_CANONICAL_SCORE_READS_ENABLED=0` for dark launch

Optional sync tuning:

- `ETHOS_SCORE_IDENTITY_SEED_LIMIT` (default `1000`)
- `ETHOS_SCORE_SYNC_LIMIT` (default `1000`)
- `ETHOS_SCORE_UPDATES_PAGE_LIMIT` (default `500`, max `1000`)
- `ETHOS_SCORE_UPDATES_MAX_PAGES` (default `5`)

## 2) Apply migration

Deploy migration:

- `frontend/db/migrations/040_ethos_canonical_score_cache.sql`
- `frontend/db/migrations/044_schedule_zora_owner_ethos_projection.sql`
- `frontend/db/migrations/047_creator_ethos_projection.sql`

Verify tables exist:

```sql
select to_regclass('public.user_ethos_identity_keys');
select to_regclass('public.ethos_userkey_scores');
select to_regclass('public.canonical_ethos_scores');
select to_regclass('public.ethos_score_sync_state');
select to_regclass('public.creator_ethos_projection');
```

## 3) Dark launch sync

Cron route:

- `GET/POST /api/v1/chat/ethos-sync`

The route is scheduled in `frontend/vercel.json`:

- `*/15 * * * *`

Manual trigger (ops):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://app.4626.fun/api/v1/chat/ethos-sync"
```

Expected response sections:

- `seeded`
- `synced`
- `rollupAfterSync`
- `updates`
- `creatorProjection`

## 4) Validate first backfill

Coverage checks:

```sql
select count(*) from public.user_ethos_identity_keys;
select count(*) from public.ethos_userkey_scores;
select status, count(*) from public.ethos_userkey_scores group by 1 order by 2 desc;
select count(*) from public.canonical_ethos_scores where score is not null;
select count(*) from public.creator_ethos_projection where ethos_score is not null;
```

Quality checks:

```sql
select
  count(*) filter (where score >= 1200) as gte_1200,
  count(*) filter (where score >= 1600) as gte_1600
from public.canonical_ethos_scores;
```

Staleness checks:

```sql
select status, min(fetched_at), max(fetched_at)
from public.ethos_userkey_scores
group by 1;
```

## 5) Enable read cutover

After backfill parity is acceptable:

- set `ETHOS_CANONICAL_SCORE_READS_ENABLED=1`

Read paths using projection mode:

- `/api/v1/chat/search`
- chat presence/availability Ethos values populated from canonical cache path

## 6) Rollback

If projection results drift or sync fails:

- set `ETHOS_CANONICAL_SCORE_READS_ENABLED=0` (immediate read fallback)
- keep sync enabled while investigating, or disable with:
  - `ETHOS_CANONICAL_SCORE_SYNC_ENABLED=0`

This returns reads to legacy request-time Ethos behavior without schema rollback.

## 7) Explore creators Ethos coverage

Explore (`/explore/creators`) lists **creator coins**, not raw `zora_csw_owner_class` rows. Scores reach the UI through:

1. `refreshCreatorEthosProjection` → `public.creator_ethos_projection` (cron: `/api/v1/chat/ethos-sync`, `/api/v1/chat/ethos-sync-hot`)
2. `GET /api/zora/explore` merges projection + live resolver (`resolveCreatorEthosByAddress`) per page
3. `GET /api/zora/metrics?scope=creators` → `ethosScoredCreators` counts projection rows with `ethos_score IS NOT NULL`

**Ops checks**

```sql
SELECT COUNT(*) FILTER (WHERE ethos_score IS NOT NULL) AS scored
FROM public.creator_ethos_projection;
```

Compare to `ethosScoredCreators` on `/api/zora/metrics?scope=creators`.

**Env (production `akita-llc/4626`)**

- `ETHOS_CREATOR_PROJECTION_LIMIT` — full reconcile refresh size (recommend `50000`)
- `ETHOS_CREATOR_PROJECTION_LIMIT_HOT` — hot lane refresh size (default `2000`)
- `ETHOS_CREATOR_PROJECTION_FULL_EVERY_N` — how often main sync uses `mode: full` (default `4` slots ≈ hourly)
- `ETHOS_CREATOR_PROJECTION_MODE` — optional force `full` or `fast` on all lanes

Volume/mcap sorts attach `ethosScore` from projection when the creator is in `creator_coins` and has been refreshed; Ethos sort reads projection directly.

### Paid on-demand refresh ($0.10 USDC)

Authenticated users can pay **$0.10 USDC** on Base to re-fetch Ethos for one creator and upsert `creator_ethos_projection`:

- `GET /api/creator/ethos/refresh-config?creatorAddress=0x…` — price, treasury, cooldown
- `POST /api/creator/ethos/refresh` — body `{ creatorAddress, paymentTxHash }`

Orders are stored in `creator_ethos_refresh_orders` (migration `048` / `20260520130000`). Default cooldown: `ETHOS_PAID_REFRESH_COOLDOWN_MINUTES=5`.

## 8) Zora owner projection automation

`044_schedule_zora_owner_ethos_projection.sql` adds:

- `public.run_zora_owner_ethos_projection(p_limit integer default 20000)`
- `public.v_zora_owner_ethos_sync_health` (single-row health snapshot)
- a best-effort `pg_cron` schedule named `zora_owner_ethos_projection_5m`

Run manually if needed:

```sql
select * from public.run_zora_owner_ethos_projection(20000);
select * from public.v_zora_owner_ethos_sync_health;
```

If `pg_cron` is unavailable in the target environment, the migration keeps going
and emits a NOTICE; schedule this function from your existing ops cron lane.

