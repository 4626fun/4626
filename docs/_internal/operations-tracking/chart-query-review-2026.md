# Review of Expensive Queries Likely Powering the 137 Charts

**Date**: 2026-06
**Context**: After schema centralization. Focus = making high-observability workloads cheap.

## Top Expensive Patterns Found in Codebase

### 1. Creator Ethos Projection Refresh (Biggest Offender)
**File**: `frontend/server/_lib/zora/creatorEthosProjection.ts` (the big INSERT ... SELECT with LATERAL)

- Does 6+ LEFT JOINs + a LATERAL CROSS JOIN UNNEST on `zora_csw_owners.current_owners`
- Runs in "full" and "fast" modes on a 15-min cron cadence (alternating)
- This single query is what keeps `creator_ethos_projection` fresh for most charts

**Recommendation**: Already the right architectural pattern (pre-compute). Do **not** try to run similar logic at chart query time. The new migration adds indexes to make reads from the projection table trivial.

### 2. Explore Sorted by Ethos
**File**: `frontend/api/_handlers/zora/_explore.ts`

- Reads from `creator_ethos_projection` (good)
- Frequently sorted/filtered by `ethos_score`

**Recommendation**: The new `idx_creator_ethos_projection_score_desc` index should make the common "top by Ethos" chart very fast.

### 3. Ethos Breakdown / Distribution Charts
- Currently many charts probably do `GROUP BY ethos_level` or `GROUP BY ethos_score_source` live against the projection table.

**Recommendation**: The new `creator_ethos_score_distribution` table + `refresh_creator_ethos_distribution()` function makes these O(1) or near-O(1).

### 4. Direct Hits on Raw Zora Tables from Charts (Risk)
Some older or ad-hoc charts may still do:
- `JOIN` or `unnest` on `zora_csw_owners` at query time
- Filters on `current_owners @> ARRAY[...]`

These are dangerous at 137-chart scale.

**Action**: Audit Supabase Query Performance for any chart queries still touching `zora_csw_owners` directly. Route them through the projection instead.

### 5. Other Potential Chart Sources
- `ethos_userkey_scores` (social + wallet scores)
- `zora_csw_owner_class` (the per-EOA classification)
- Waitlist leaderboards (use OFFSET in some places — not ideal for charts)

## Action Items from This Review

1. **Apply the 20260612 migration** (adds the 4 new indexes + distribution table + refresh function).
2. Update the main refresh job (`creatorMetricsSync.ts` or wherever the projection is refreshed) to also call `SELECT public.refresh_creator_ethos_distribution();` after a successful projection refresh.
3. Add `application_name` tagging to all Supabase chart queries (or at least the top 30).
4. Re-run the Supabase Query Performance advisor after 7 days of the new indexes + distribution table.
5. Create 3-5 "chart-only" materialized views for the most popular time-series or distribution charts if the indexes alone aren't enough.

This combination (projection table + narrow indexes + pre-aggregated distribution table) should make the vast majority of the 137 charts extremely cheap to serve.
