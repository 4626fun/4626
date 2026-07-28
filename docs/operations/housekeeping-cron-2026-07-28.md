# Housekeeping cron consolidation (2026-07-28)

**Migration:** `supabase/migrations/20260728200000_housekeeping_cron_consolidation.sql`  
**Project:** `qajpnuvqlcfseghnldkl`

## Why

Live `cron.job` inventory showed:

| Issue | Before |
|---|---|
| Dual TTL on `agent_rate_limits` | Inline job 7d + `cleanup_operational_retention` 14d |
| Unversioned ephemeral SQL | `nightly-ephemeral-cleanup` raw DELETEs |
| Same-minute collision | `legacy-backups` + `operational-retention` at `15 4 * * *` |
| Missing hot-table vacuum | Only Zora tables; not `creator_coins` |
| Sunday I/O pile-up | Vacuums at 04:30 overlapping daily DELETEs |

## After apply (UTC)

| Schedule | Job |
|---|---|
| `0 3 * * *` | `cleanup_expired_rows()` — includes `auth_nonces`, `auth_handoffs` |
| `20 3 * * *` | `cleanup_log_retention()` |
| `40 3 * * *` | `cleanup_operational_retention()` — **agent_rate_limits 7d** |
| `0 4 * * *` | `cleanup_marketing_analytics_retention()` |
| `20 4 * * *` | `cleanup_legacy_backups()` |
| `30 5 * * 0` | `VACUUM ANALYZE zora_csw_owners` |
| `40 5 * * 0` | `VACUUM ANALYZE zora_csw_owner_class` |
| `50 5 * * 0` | `VACUUM ANALYZE creator_coins` (**new**) |

**Removed:** `nightly-ephemeral-cleanup`

## Apply

```bash
# linked project
pnpm -C frontend db:migrate
# or
supabase db push --linked
```

Smoke:

```sql
SELECT public.cleanup_expired_rows();
SELECT public.cleanup_operational_retention();

SELECT jobname, schedule, command, active
FROM cron.job
ORDER BY jobname;
```

Expect **no** `nightly-ephemeral-cleanup`, staggered schedules above, and `weekly-creator-coins-vacuum`.
