---
title: Explore Metrics Operations
sidebar_position: 9
---

# Explore metrics operations

Runbook for the **indexed Explore** pipeline (Supabase + Vercel crons). Pairs with the user-facing [Explore analytics](/users/explore-analytics) page.

## Architecture

```text
Zora explore API / on-chain factory scan
        ↓
creatorMetricsSync (frontend/server/_lib/zora/creatorMetricsSync.ts)
        ↓
Supabase: creator_coins, creator_metrics_sync_state, creator_metrics_daily_snapshots
        ↓
GET /api/zora/metrics  →  Explore hero dashboard
GET /api/zora/explore  →  list tables + sparkline hydrate
```

**Dual backfill tracks** (run explore-first for hero + Ethos sort):

1. **Explore backfill** — `runCreatorMetricsExploreBackfill` / `GET /api/sync-creator-metrics?mode=explore`  
   Sets `exploreBackfillComplete` and refreshes `creator_ethos_projection` for newly indexed creators.

2. **On-chain scan** — default / `--fast` mode  
   Sets `backfillComplete`; required for `exact: true` hero totals.

```bash
# From repo root — explore paging backfill
pnpm -C frontend exec tsx scripts/run-creator-metrics-backfill.ts --explore-backfill
```

## Production env (Vercel `akita-llc/4626`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase pooler (transaction mode, port 6543) |
| `ZORA_SERVER_API_KEY` | Zora explore paging for sync |
| `CREATOR_METRICS_ARCHIVE_RPC_URL` | Optional dedicated Base RPC for heavy on-chain scan |
| `ZORA_PROFILES_REFRESH_ENABLED=1` | Enables 6h `zora_profiles` cron |
| `CREATOR_METRICS_SPARKLINE_PRECOMPUTE_ENABLED` | Optional hot-path sparkline precompute |

Cron pool: use `getDbForCron()` on all metrics crons (see [Vercel cron production fixes](/operations/vercel-cron-production-fixes)).

## Health checks

```sql
-- Sync state
SELECT * FROM creator_metrics_sync_state LIMIT 5;

-- Freshness (profiles mirror for Looker)
SELECT * FROM v_zora_profiles_refresh_freshness;

-- Row scale
SELECT relname, n_live_tup FROM pg_stat_user_tables
  WHERE relname IN ('creator_coins', 'creators', 'creator_metrics_daily_snapshots');
```

**API smoke:**

```bash
curl -sS 'https://app.4626.fun/api/zora/metrics?scope=creators' | jq '.data.exact, .data.syncStatus, .data.totals.creatorsTotal'
```

Expect `exact: false` until on-chain backfill completes; `syncStatus` should not stay `error` in steady state.

## Looker Studio (internal ops dashboard)

Ramses-style **operator analytics** without Dune:

1. Deploy connector: `indexer/scripts/lookerStudioConnector/README.md` in the repo (Apps Script + Deployment ID).
2. Wire widgets: [Looker Studio widget recipe](/operations/looker-studio-widget-recipe).

Default view: `v_looker_zora_profiles_ethos`.

## Sparkline backfill (optional catch-up)

```bash
pnpm -C frontend exec tsx scripts/backfill-explore-sparklines.ts
```

Uses subgraph-first resolution (`exploreSparklineHydrate.ts`).

## Integrator token manifest

Regenerate `frontend/public/data/explore-assets-manifest.json` from indexed coins:

```bash
DATABASE_URL='...' pnpm -C frontend exec tsx scripts/export-explore-assets-manifest.ts --limit=500
```

Commit the JSON when token rows should ship to partners.

## Failure modes

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Hero shows `—` / unavailable | DB not configured or metrics 500 | Check `DATABASE_URL`, Vercel logs `[zora/metrics]` |
| Stuck **Partial index** | `backfillComplete` false | Run on-chain backfill; check `syncError` in API |
| Explore Ethos sort sparse | Projection not refreshed | Run ethos sync cron or `ethos-creator-wallet-backfill.ts` |
| Charts empty on detail | No subgraph + no Zora swaps | Expected for illiquid coins; not a hero-totals bug |

## Related

- [Dune analytics runbook](/operations/dune-analytics-runbook) — public verification layer
- [Ethos canonical score cache](/operations/ethos-canonical-score-cache)
- [Supabase Zora DB optimization](/operations/supabase-zora-db-optimization)
