# Operator Guide: Ethos Chart Data Refresh

## Quick Commands

```bash
# Refresh everything (distribution + daily + hourly snapshots)
pnpm ops:trigger-ethos-refresh

# Refresh only specific parts
pnpm ops:trigger-ethos-refresh --distribution
pnpm ops:trigger-ethos-refresh --daily
pnpm ops:trigger-ethos-refresh --hourly

# Full refresh + prune (use carefully)
pnpm ops:refresh-ethos-charts
```

## When to Run Manually

- After deploying the new migrations for the first time
- If you notice charts are showing stale data
- During investigations of Ethos score accuracy
- Before important presentations or reports

## Scheduled Jobs (via pg_cron)

These run automatically once the 20260614 migration is applied:

- `hourly-ethos-snapshot` – every hour
- `daily-ethos-snapshot` – every day at 00:15 UTC
- `daily-ethos-distribution-refresh` – every day at 00:45 UTC
- `daily-ethos-hourly-prune` – daily at 04:45 UTC (keeps last 7 days of hourly data)
- `weekly-ethos-snapshot-prune` – every Sunday at 03:30 UTC (keeps last 90 days of daily data)

## Monitoring

Check job status in Supabase SQL editor:

```sql
SELECT * FROM cron.job WHERE jobname LIKE '%ethos%';
SELECT jobid, status, start_time, end_time 
FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE '%ethos%')
ORDER BY start_time DESC 
LIMIT 20;
```

## Useful Verification Queries

```sql
-- Latest distribution
SELECT * FROM creator_ethos_score_distribution ORDER BY creator_count DESC;

-- How much daily snapshot data we have
SELECT MIN(snapshot_date), MAX(snapshot_date), COUNT(*) 
FROM creator_ethos_daily_snapshots;

-- How much hourly snapshot data we have
SELECT MIN(snapshot_hour), MAX(snapshot_hour), COUNT(*) 
FROM creator_ethos_hourly_snapshots;
```

## Admin UI

There is now a simple admin page at `/admin/ethos-chart-refresh` (protected by normal admin auth).

It allows triggering:
- Full refresh (everything)
- Individual layers (distribution, daily, hourly, 15min, unified views)

This is the recommended way for operators to force a refresh without using the CLI.

## Admin UI Health Dashboard

The page at `/admin/ethos-chart-refresh` now also displays live data from:

- `ethos_chart_system_health` (table sizes + last refresh)
- `ethos_last_refreshes` (when each background job last ran)

This gives operators a quick view of whether the 15min / hourly / daily snapshots and the unified materialized views are staying fresh.

Refresh the health data with the button in the header (or after triggering a manual refresh).

## Index Usage Visibility

The admin health page now also shows the top indexes being used on the Ethos chart tables (from the `ethos_index_usage` view).

This is very helpful when you have many composite indexes — you can see which ones are actually getting traffic from the 137+ charts vs which ones might be candidates for cleanup later.
