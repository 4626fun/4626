# Ethos canonical score cache operations

This runbook covers first-time rollout and steady-state operation of the canonical Ethos score cache pipeline.

## Scope

The pipeline writes and serves Ethos scores via local Postgres/Supabase tables:

- `public.user_ethos_identity_keys`
- `public.ethos_userkey_scores`
- `public.canonical_ethos_scores`
- `public.ethos_score_sync_state`

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

Verify tables exist:

```sql
select to_regclass('public.user_ethos_identity_keys');
select to_regclass('public.ethos_userkey_scores');
select to_regclass('public.canonical_ethos_scores');
select to_regclass('public.ethos_score_sync_state');
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

## 4) Validate first backfill

Coverage checks:

```sql
select count(*) from public.user_ethos_identity_keys;
select count(*) from public.ethos_userkey_scores;
select status, count(*) from public.ethos_userkey_scores group by 1 order by 2 desc;
select count(*) from public.canonical_ethos_scores where score is not null;
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

