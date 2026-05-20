# Zora profiles refresh cron — operator runbook

Keeps `zora_profiles` (and `v_looker_zora_profiles_ethos`) market/volume/holder fields fresh for Looker Studio and Supabase dashboards.

## What runs

| Cron | Path | Schedule | Purpose |
| --- | --- | --- | --- |
| Refresh | `/api/v1/zora-profiles/refresh-cron` | `15 */6 * * *` (every 6h at :15) | Zora explore scan → upsert `zora_profiles`, bounded `getProfile` wallet pass, reconcile `is_in_csw_index`. |

## Enable in production

1. **Apply migration** `supabase/migrations/20260520120000_zora_profiles_refresh_monitoring.sql` (state table + `v_zora_profiles_refresh_freshness` view).
2. **Set Vercel env** on `akita-llc/4626`:
   - `ZORA_PROFILES_REFRESH_ENABLED=1`
   - `ZORA_SERVER_API_KEY` (or `VITE_ZORA_PUBLIC_API_KEY` fallback)
   - `CRON_SECRET` (already used by other crons)
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
3. **Redeploy** production so the cron schedule and env vars load.

## Monitoring

Query as service role or SQL editor:

```sql
SELECT * FROM v_zora_profiles_refresh_freshness;
```

Watch:

- `newest_profile_refresh_at` — should advance after each successful tick
- `stale_over_24h_count` — should stay near 0 once the cron is healthy
- `last_cron_completed_at` — timestamp of last successful cron write

## Manual trigger

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://app.4626.fun/api/v1/zora-profiles/refresh-cron | jq
```

Expected success shape:

```json
{
  "ok": true,
  "tick": "refreshed",
  "scan": { "profilesUpserted": 289, "...": "..." },
  "wallets": { "updated": 12, "...": "..." },
  "cswIndexRowsUpdated": 0
}
```

## Optional tuning

| Env | Default | Notes |
| --- | --- | --- |
| `PROFILE_REFRESH_TARGET_COUNT` | `500` | Max creator coins per tick from explore |
| `PROFILE_REFRESH_PAGE_SIZE` | `50` | Explore page size |
| `PROFILE_REFRESH_INTERVAL_MS` | `250` | Pause between explore pages |
| `PROFILE_REFRESH_LIST_TYPE` | `most_valuable_creators` | Explore list |
| `PROFILE_REFRESH_WALLET_BUDGET` | `75` | Profiles without `wallets_synced_at` per tick |
| `PROFILE_REFRESH_WALLET_CONCURRENCY` | `6` | Parallel `getProfile` calls |

## Looker Studio

After the cron runs, refresh the Looker report (or set **Data freshness** to 1h). The connector reads `v_looker_zora_profiles_ethos`; underlying rows update when `last_refreshed_at` moves.
