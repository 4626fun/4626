# Ready-to-Use SQL Snippets for Ethos Charts (Unified Approach)

All examples use the interconnected materialized views + core tables.

## Distribution & Breakdowns (use the materialized views)

**Ethos Level Distribution (recommended)**
```sql
SELECT * FROM public.mv_ethos_level_distribution ORDER BY creator_count DESC;
```

**Breakdown by Score Source (recommended)**
```sql
SELECT * FROM public.mv_ethos_by_source ORDER BY creator_count DESC;
```

**Market Cap Tier Breakdown (recommended)**
```sql
SELECT * FROM public.mv_ethos_by_market_cap_tier ORDER BY market_cap_tier;
```

**Volume Tier Breakdown (recommended)**
```sql
SELECT * FROM public.mv_ethos_by_volume_tier ORDER BY volume_tier;
```

## Leaderboards

**Top 100 by Ethos Score**
```sql
SELECT 
  creator_address,
  coin_address,
  ethos_score,
  ethos_level,
  ethos_score_source,
  market_cap_usd,
  twitter_username
FROM public.creator_ethos_projection
ORDER BY ethos_score DESC NULLS LAST
LIMIT 100;
```

## Time Series / Trends (use the snapshot tables)

**Daily Average + Median Ethos Trend**
```sql
SELECT 
  snapshot_date as time,
  AVG(ethos_score) as avg_ethos,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ethos_score) as median_ethos
FROM public.creator_ethos_daily_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '60 days'
GROUP BY 1
ORDER BY 1;
```

**Ethos Percentile Bands**
```sql
SELECT 
  snapshot_date as time,
  PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY ethos_score) as p10,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ethos_score) as p50,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ethos_score) as p90
FROM public.creator_ethos_daily_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1;
```

## Age Cohorts (use the supporting view)

```sql
SELECT * FROM public.v_ethos_by_creator_age ORDER BY age_bucket;
```

## High-Resolution Recent Data

**Last 6 hours at 15-minute resolution**
```sql
SELECT 
  snapshot_time as time,
  AVG(ethos_score) as avg_score
FROM public.creator_ethos_15min_snapshots
WHERE snapshot_time >= NOW() - INTERVAL '6 hours'
GROUP BY 1
ORDER BY 1;
```

## Monitoring Health of the Chart System

```sql
SELECT * FROM public.ethos_chart_system_health;
SELECT * FROM public.ethos_last_refreshes;
```

**Pro Tip**: Always tag your chart queries:

```ts
const db = withChartQuery(rawDb, 'your-chart-name');
```

## Explore-Style Flexible Sorting (use the projection + indexes directly)

**Sort by Market Cap (highest first)**
```sql
SELECT creator_address, market_cap_usd, ethos_score, volume_24h_usd
FROM public.creator_ethos_projection
ORDER BY market_cap_usd DESC NULLS LAST, ethos_score DESC NULLS LAST, creator_address
LIMIT 50;
```

**Sort by Ethos Score (highest first)**
```sql
SELECT creator_address, ethos_score, market_cap_usd, volume_24h_usd
FROM public.creator_ethos_projection
ORDER BY ethos_score DESC NULLS LAST, market_cap_usd DESC NULLS LAST, creator_address
LIMIT 50;
```

These two queries use the same table and benefit from the indexes added for Explore sorting.

## Recommended for Explore/Creators page (use the thin interconnected view)

**Any sort order on the same data**
```sql
SELECT *
FROM public.v_explore_creators
ORDER BY market_cap_usd DESC NULLS LAST, ethos_score DESC NULLS LAST, creator_address
LIMIT 50 OFFSET 0;

-- or

SELECT *
FROM public.v_explore_creators
ORDER BY ethos_score DESC NULLS LAST, market_cap_usd DESC NULLS LAST, creator_address
LIMIT 50 OFFSET 0;
```

This is the correct pattern: one view, many possible `ORDER BY` clauses. No separate data for different sorts.

## Canonical way to power any sortable list on Explore (single source)

```sql
-- Market Cap highest first
SELECT * FROM public.v_explore_creators
ORDER BY market_cap_usd DESC NULLS LAST, ethos_score DESC NULLS LAST, creator_address
LIMIT 50;

-- Ethos highest first (same data, different sort)
SELECT * FROM public.v_explore_creators
ORDER BY ethos_score DESC NULLS LAST, market_cap_usd DESC NULLS LAST, creator_address
LIMIT 50;

-- Volume highest first (still the same underlying rows)
SELECT * FROM public.v_explore_creators
ORDER BY volume_24h_usd DESC NULLS LAST, market_cap_usd DESC NULLS LAST, creator_address
LIMIT 50;
```

This is the required pattern. No separate data sets for different sort columns.
