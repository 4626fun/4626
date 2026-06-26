# Ethos Chart System Overview (2026) — Unified & Interconnected

**Core Principle**: All chart data derives from a small number of tightly connected core tables and materialized views. No fragmented independent bucket tables.

## Core Philosophy

- `creator_ethos_projection` is the single source of truth for current state.
- Time-series snapshots (`daily`, `hourly`, `15min`) provide history at different resolutions.
- All segmentations (by score source, market cap, volume, creator age, etc.) are provided through **materialized views** that are refreshed together from the projection.
- This keeps everything interconnected and easy to maintain.

## Current Core Structures

### Primary Tables
- `creator_ethos_projection` — Live current Ethos state for every creator
- `creator_ethos_daily_snapshots` — Historical daily grain (90d)
- `creator_ethos_hourly_snapshots` — Historical hourly grain (7d)
- `creator_ethos_15min_snapshots` — High-resolution recent grain (48h)

### Interconnected Materialized Views (refreshed together)
- `mv_ethos_level_distribution`
- `mv_ethos_by_source`
- `mv_ethos_by_market_cap_tier`
- `mv_ethos_by_volume_tier`

These views are all refreshed atomically via `refresh_all_ethos_chart_views()` after every projection update.

### Supporting Views
- `v_ethos_by_creator_age` — Age cohort view computed from snapshots + projection

### Monitoring
- `ethos_chart_system_health`
- `ethos_last_refreshes`

## How to Add a New Chart Dimension

1. Add the dimension to `creator_ethos_projection` if needed (or compute it in a view).
2. Create a new **materialized view** that aggregates from the projection (not a new independent table).
3. Add the refresh of that view inside `refresh_all_ethos_chart_views()`.
4. Add a cron if needed.
5. Document the view in the SQL snippets library.

This ensures everything remains interconnected.

## Anti-Pattern to Avoid
- Do **not** create separate standalone tables like `creator_ethos_by_volume_bucket`, `by_age_bucket`, etc. as independent entities.
- All derived data should come from the projection + snapshots through views.

## Refresh Architecture
All expensive work lives in the projection refresh job. After it succeeds, `refresh_all_ethos_chart_views()` + the time-series snapshots are called automatically.

This design makes the 137+ charts cheap to query while keeping the data model clean and maintainable.

## Important: Explore Sorting vs Aggregated Charts

- **Sortable lists** (Explore/Creators page, leaderboards where users change sort order): Query `creator_ethos_projection` directly (or a thin view) with flexible `ORDER BY`. The dedicated sort indexes exist for this.

- **Aggregated / dashboard-style charts** (distributions, averages by tier, trends): Use the materialized views (`mv_ethos_*`) + time-series snapshots.

This separation keeps the data model unified while still allowing fast specialized reads.

### Canonical Table for Sortable Lists (Explore, Leaderboards, etc.)

Use:
- `creator_ethos_projection` (raw)
- or `v_explore_creators` (thin view created in 20260622000000)

All sorting (by market cap, ethos, volume, combinations, etc.) happens via `ORDER BY` on this single source + the composite indexes added for Explore.

The materialized views are **only** for aggregated dashboard charts, not for the main sortable lists.

### Rule for User-Sortable Pages (Explore, Leaderboards, etc.)

Use **only**:
- `creator_ethos_projection`
- or the thin view `v_explore_creators`

All different sort modes the user can select must operate on this same set of rows via `ORDER BY`.

The old separate bucket tables have been deprecated (see 20260624 migration).
