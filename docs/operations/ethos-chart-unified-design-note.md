# Important Design Note: Unified Ethos Chart Data Model

As of the 20260620 migration, the recommended approach is:

**Everything should derive from these core interconnected structures:**

1. `creator_ethos_projection` (current truth)
2. The time-series snapshot tables (daily / hourly / 15min)
3. The small set of **materialized views** refreshed together via `refresh_all_ethos_chart_views()`:
   - `mv_ethos_level_distribution`
   - `mv_ethos_by_source`
   - `mv_ethos_by_market_cap_tier`
   - `mv_ethos_by_volume_tier`

**Do not create new independent bucket tables** (e.g. a standalone `by_volume` or `by_age` table).

If you need a new segmentation:
- Either add it to one of the existing materialized views above, or
- Create a new **materialized view** that joins from the projection + snapshots.

This keeps the data model clean, maintainable, and truly interconnected.

The older separate bucket table migrations (market_cap, volume, age) should be considered superseded by the unified materialized view approach.

## Specific Guidance for Explore / Creators Sorting

When users sort the Explore/Creators table by different columns (Market Cap, Ethos Score, Volume, etc.), this should **always** be done by querying `creator_ethos_projection` (or a thin view on top of it) with different `ORDER BY` clauses.

**Do not** create separate tables or materialized views whose only purpose is to support one particular sort order.

The indexes added in `20260621000000_explore_sort_indexes.sql` exist specifically so that multiple sort orders can be served efficiently from the **same interconnected data**.

This is the correct way to keep "market cap sort" and "ethos sort" on the same underlying data without duplication.

## Update (2026-06): Explore Sorting Must Use the Projection (or v_explore_creators)

For any page where the user can change the sort column (especially `/explore/creators`):

- Always query `public.creator_ethos_projection` (or the thin view `public.v_explore_creators` created in 20260622000000).
- Different sort orders = different `ORDER BY` on the **same data**.
- The indexes in 20260621000000 and 20260623000000 exist specifically to make this efficient.

**Never** create separate tables or views whose primary purpose is to support one particular sort order on Explore. That violates the interconnected data requirement.

## Final Rule for Explore Sorting (as of 2026-06)

The Explore/Creators page (and any user-controllable sortable list) **must** source its data from:

- `public.creator_ethos_projection`, or
- `public.v_explore_creators` (the thin view added in 20260622000000)

Different user-selected sort orders (Market Cap desc, Ethos desc, Volume desc, etc.) are implemented purely by changing the `ORDER BY` clause against this single source of rows.

The composite indexes added in 20260621 and 20260623 exist to make these different sort orders fast on the **same data**.

Creating or using separate tables for "market cap sort data" vs "ethos sort data" is now explicitly against the architecture.

## Current Recommended Stack for Explore (as of latest migrations)

- Data source: `public.v_explore_creators` (or `creator_ethos_projection` directly)
- All user-controllable sorts: different `ORDER BY` on the above
- Supporting indexes: see migrations 20260621, 20260623, 20260626, 20260627, 20260628
- Aggregations/distributions: the `mv_ethos_*` materialized views only

This design guarantees that switching the sort column on Explore never requires a different data source.

## For Frontend Developers

When building or modifying any sortable list that includes Ethos data (especially Explore/Creators):

- Prefer querying `public.v_explore_creators`
- All different user sort modes must be implemented as different ORDER BY on this view.
- This is the only supported pattern going forward.

## Latest State (as of 2026-07)

- All sortable Explore lists must use `v_explore_creators` + ORDER BY on the single source.
- 15+ composite indexes have been added specifically for Explore filter + sort combinations on the unified table.
- The admin UI (`/admin/ethos-chart-refresh` or equivalent) now shows both heavily used indexes and potentially unused ones.
- In-app executable `DROP INDEX CONCURRENTLY` is available for candidates (POST /api/admin/ethos/indexes). It double-validates the index is still in `ethos_unused_indexes` before executing. Requires exact name re-typing for confirmation.
- New "Suggested New Indexes (Access Pattern Driven)" + "Recent Expensive Chart Queries (Tagged)" sections surface slow queries from `pg_stat_statements` (via the `ethos_expensive_chart_queries` view + our `supabase-chart:*` application_name tagging) and curated high-value `CREATE INDEX CONCURRENTLY` recommendations for the dominant patterns on the single source.
- Manual SQL fallbacks remain available. All operations stay on the single interconnected source tables/views. New index suggestions are strictly advisory (no auto-CREATE execution from the UI).

The goal remains: one interconnected source of truth for all chart and Explore data, maximum observability, and safe, incremental index hygiene.
