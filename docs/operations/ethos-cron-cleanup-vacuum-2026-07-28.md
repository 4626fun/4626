# Ethos cron cleanup + ethos_userkey_scores bloat — 2026-07-28

## Applied live

Migration: `20260728230000_cleanup_orphaned_ethos_crons_autovacuum.sql`

### Orphaned cron jobs unscheduled

High-frequency Ethos snapshot tables were dropped in `20260713010000`, but
these jobs may have remained scheduled and erroring:

- `hourly-ethos-snapshot`
- `daily-ethos-hourly-prune`
- `15min-ethos-snapshot`
- `daily-ethos-15min-prune`
- `daily-ethos-distribution-refresh`
- `daily-ethos-market-cap-buckets` / `volume-buckets` / `age-buckets`
- `daily-ethos-unified-chart-views` / `unified-views`

### Kept / ensured present

- `daily-ethos-snapshot` → `snapshot_creator_ethos_daily()` @ 00:15 UTC
- `weekly-ethos-snapshot-prune` → `prune_ethos_daily_snapshots(90)` @ Sun 05:30 UTC

### ethos_userkey_scores

| Metric | Value |
|---|---|
| Live rows | ~515 |
| Heap before reclaim | ~109 MB |
| Dead tuples | ~25 |

Cause: large unmapped prune (~631k rows) left extreme bloat. Autovacuum
scale_factor tightened to **0.02** (matches other hot tables).

**VACUUM FULL** must be run outside a migration transaction:

```sql
VACUUM (FULL, ANALYZE) public.ethos_userkey_scores;
```

Exclusive lock is acceptable: table is a small score cache (~500 rows).

## Follow-ups (not in this migration)

1. Confirm VACUUM FULL reclaimed ~110 MB to OS.
2. Optional: lowercase-normalize `zora_csw_owners.csw_address` (~99 MB functional index).
3. Product decision: prune zero-volume `creator_coins` rows.
