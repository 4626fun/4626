# Supabase Native + Grafana Chart Recommendations for 4626 Ethos

## Recommended Supabase Built-in Charts (Database → Charts)

Create these directly in Supabase for quick value:

1. **Ethos Level Distribution** (Pie/Bar)
   - Query: `SELECT level, creator_count FROM creator_ethos_score_distribution ORDER BY creator_count DESC;`

2. **Top 50 Creators by Ethos Score**
   - Query from `creator_ethos_projection` ordered by `ethos_score DESC`

3. **Daily Avg Ethos Score Trend**
   - Use `creator_ethos_daily_snapshots` aggregated by `snapshot_date`

4. **Creators by Ethos Score Source** (stacked bar)
   - Breakdown of `ethos_score_source` in the projection table.

## How to Use the Grafana Template

1. Import `supabase-ethos-charts-template.json` into Grafana.
2. Connect it to your Supabase Postgres data source (use the transaction pooler connection string).
3. The dashboard includes:
   - Distribution pie chart (uses the fast distribution table)
   - Leaderboard table
   - Time series trends (uses the daily snapshots)

## Tagging Your Chart Queries

Use the new helpers in production chart code:

```ts
import { withChartContext } from '../_lib/db/postgres.js';

const chartDb = withChartContext(db, 'ethos-leaderboard-top50');
const rows = await chartDb.sql`SELECT ... FROM creator_ethos_projection ...`;
```

This sets `application_name = 'supabase-chart:ethos-leaderboard-top50'` so you can easily filter in:
- Supabase Query Performance
- `pg_stat_statements`
- Logs

## Maintenance

After deploying the new migrations:
- Run `SELECT public.snapshot_creator_ethos_daily();` once manually.
- The projection refresh will now keep the distribution fresh automatically.
- Set up a daily pg_cron for `prune_ethos_daily_snapshots(90)` if you want to control snapshot table size.

This setup should make the majority of your 137 charts extremely low-cost to serve.
