# Supabase Chart Optimization Plan (for 137+ Charts)

**Goal**: Make the database efficient when powering a large number of analytical charts (leaderboards, trends, distributions, Ethos breakdowns, explore sorts, etc.) without destroying the primary transactional workload.

## Current State (as of 2026)

- `creator_ethos_projection` is already a good materialized projection table.
- Refresh logic lives in `creatorEthosProjection.ts` (full + fast modes, alternating via cron slots).
- Heavy lifting happens in one very wide query with:
  - Many LEFT JOINs to `ethos_userkey_scores`, `canonical_ethos_scores`, `zora_csw_owner_class`
  - A LATERAL + CROSS JOIN UNNEST on `zora_csw_owners.current_owners` (the most expensive part)
- Charts and explore endpoints read mostly from `creator_ethos_projection` (good).
- Raw `zora_csw_owners` is still hit directly in some paths (risky for high chart volume).

## Identified Expensive Patterns for Charts

1. **Ethos Leaderboard / Explore sorted by ethos_score** — hits the projection but the refresh itself is expensive.
2. **Owner-class breakdown charts** — requires the LATERAL unnest logic.
3. **Time-series / trend charts** on Ethos (if built on raw `ethos_userkey_scores` or `zora_csw_owner_class`).
4. **Multi-signal comparison charts** (social vs wallet vs owner_class).
5. **Any chart doing `JOIN` or `unnest` on `zora_csw_owners.current_owners` at query time**.

## Recommended Architecture

### Tier 1: Protect the Projection Table (Do This First)

- Treat `creator_ethos_projection` as the **single source of truth** for almost all Ethos-related charts.
- Add a set of narrow, chart-optimized indexes (see migration below).
- Never do the expensive LATERAL unnest in a user-facing chart query — always pre-compute into the projection.

### Tier 2: Additional Chart-Friendly Structures (Proposed)

1. **`creator_ethos_daily_snapshots`** (materialized time-series)
   - Pre-aggregated daily min/max/avg/p95 ethos scores per creator or per segment.
   - Refreshed by a cheap pg_cron job after the main projection refresh.

2. **`creator_ethos_score_distribution`** (small static-ish table)
   - Pre-computed histogram buckets for "how many creators in each Ethos level".
   - Extremely cheap to query for distribution charts.

3. **Narrow covering indexes** on `creator_ethos_projection` for the most common chart sort/filter combinations:
   - `(ethos_score DESC, creator_address)`
   - `(ethos_score_source, ethos_score DESC)`
   - `(market_cap_usd DESC, ethos_score DESC)` for "top market cap with good Ethos"

### Tier 3: Query Discipline for Charts

- All chart queries should be **read-only** and go through the transaction pooler (6543).
- Add `application_name = 'supabase-chart:<chart-id>'` so you can filter them easily in `pg_stat_statements`.
- Use keyset pagination everywhere (never OFFSET on large result sets).
- Cache the results of the top 20-30 most popular charts in Redis or even in the projection table itself with a `cached_for_chart` jsonb column if needed.

## Proposed Next Migration (202606xx)

Create a new migration that adds:

```sql
-- Chart-optimized indexes on the projection
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_score_desc
  ON public.creator_ethos_projection (ethos_score DESC NULLS LAST, creator_address);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_source_score
  ON public.creator_ethos_projection (ethos_score_source, ethos_score DESC NULLS LAST);

-- Small distribution table + refresh function
CREATE TABLE IF NOT EXISTS public.creator_ethos_score_distribution (
  level text PRIMARY KEY,
  creator_count bigint,
  last_refreshed_at timestamptz
);

-- Function to refresh the distribution (cheap, runs after projection refresh)
CREATE OR REPLACE FUNCTION public.refresh_creator_ethos_distribution()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.creator_ethos_score_distribution (level, creator_count, last_refreshed_at)
  SELECT ethos_level, COUNT(*), NOW()
  FROM public.creator_ethos_projection
  WHERE ethos_level IS NOT NULL
  GROUP BY ethos_level
  ON CONFLICT (level) DO UPDATE SET
    creator_count = EXCLUDED.creator_count,
    last_refreshed_at = NOW();
END;
$$;
```

Then wire a cheap `pg_cron` job or call it from the existing `creatorMetricsSync` after the projection refresh.

## Monitoring for Chart Load

- In Supabase → Database → Query Performance, filter by `application_name` containing `chart`.
- Watch `pg_stat_statements` for anything hitting `zora_csw_owners` from chart paths.
- Set alerts on:
  - High `seq_tup_read` on `creator_ethos_projection`
  - Increasing mean time on the projection refresh function

## Rollout Order

1. Add the new indexes + distribution table (low risk).
2. Update the most expensive 10-15 charts to read only from the new structures.
3. Add `application_name` tagging to all chart queries.
4. Measure before/after in the 137 charts.
5. Only then consider more aggressive denormalization.

This approach keeps the expensive projection refresh as a single controlled background job while making the 137 chart queries trivial point lookups or small index scans.
