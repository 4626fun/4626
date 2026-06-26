# Zora CSW indexer crons — operator runbook

Companion to [zora-csw-indexer-cron-spec.md](./zora-csw-indexer-cron-spec.md). Covers operating the two Vercel crons that replace the one-shot indexer CLI for steady-state ingestion.

## What the crons do

| Cron | Path | Schedule | Purpose |
| --- | --- | --- | --- |
| Scan | `/api/v1/zora-csw/scan-cron` | `*/15 * * * *` | Polls `eth_getLogs` for `ZoraSmartWalletCreated`, inserts new rows into `zora_csw_owners` (with `current_owners=NULL`), bumps `last_scanned_block`. |
| Enrich | `/api/v1/zora-csw/enrich-cron` | `*/30 * * * *` | Pulls oldest unsynced rows (and >7-day-stale rows once unsynced is drained), reads `ownerAtIndex` via multicall, fills `current_owners`. |

Both handlers always return HTTP 200 except for auth/config errors:

- `401 unauthorized` — bad/missing `Authorization: Bearer <CRON_SECRET>` header
- `503 feature_disabled` — `ZORA_CSW_INDEXER_ENABLED` is not `1`
- `503 supabase_not_configured` — Supabase env vars missing
- `503 base_rpc_url_not_configured` — `BASE_RPC_URL` is empty
- `405 Method not allowed` — request was not GET or POST

## Required environment variables

| Var | Required? | Notes |
| --- | --- | --- |
| `ZORA_CSW_INDEXER_ENABLED` | yes | **NEW**. Master kill-switch; set to `1` to enable both crons. Default off so the PR can ship dark. |
| `CRON_SECRET` | yes | Already in Vercel for the AMOE crons. Same secret. |
| `BASE_RPC_URL` | yes | A paid Base mainnet RPC (Alchemy / QuickNode / etc.). The free `mainnet.base.org` will rate-limit on `eth_getLogs` for >2k-block windows. Add to Vercel project env if not already there. |
| `SUPABASE_URL` | yes | Already in Vercel. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Already in Vercel. Service-role bypasses RLS so the crons can write `zora_csw_owners` and `zora_csw_indexer_state`. |
| `INDEXER_GETLOGS_WINDOW` | optional | Max blocks per scan tick. Default `10000`. Lower if your RPC's `eth_getLogs` cap is tighter. |
| `INDEXER_ENRICH_BUDGET` | optional | Max CSWs enriched per tick. Default `3000`. |
| `INDEXER_RPC_CONCURRENCY` | optional | Parallel multicall fan-out per tick. Default `12`. |

`AMOE_CRON_SECRET` (legacy override of `CRON_SECRET`) is also accepted but not preferred.

## First-time setup

1. **Apply the migration.** `frontend/db/migrations/038_zora_csw_indexer_state.sql` creates the state table, RLS, and the three monitoring views. Run via your usual Supabase migration flow.
2. **Seed `last_scanned_block`** so the first scan tick doesn't try to replay the entire chain. Run the snippet below in the Supabase SQL editor:

   ```sql
   INSERT INTO public.zora_csw_indexer_state (key, value)
   VALUES (
     'last_scanned_block',
     jsonb_build_object('block', (SELECT max(creation_block) FROM public.zora_csw_owners))
   )
   ON CONFLICT (key) DO NOTHING;
   ```

   The handler also auto-bootstraps to `MAX(creation_block)` when the row is missing, so this is belt-and-suspenders. If `zora_csw_owners` is empty the handler returns `tick: 'idle'` with a `note` field telling you to seed manually before flipping the flag.
3. **Verify env vars** in the Vercel project (especially `BASE_RPC_URL` and `ZORA_CSW_INDEXER_ENABLED`).
4. **Flip the feature flag** (`ZORA_CSW_INDEXER_ENABLED=1`) and let the cron schedule pick it up. The next `*/15` window will tick.

## Monitoring views

The migration creates three views over the existing `zora_csw_owners` / `zora_csw_owner_class` / `zora_csw_indexer_state` tables. Read with the service-role client (or `psql` as a Supabase admin):

### `v_zora_csw_indexer_freshness`

One-row dashboard summary:

- `last_scanned_block` — checkpoint from the state row
- `max_known_creation_block` — newest CSW currently in the table
- `unsynced_count` — rows with `current_owners IS NULL`
- `stale_count` — rows synced >7 days ago
- `synced_count`, `total_count`
- `most_recent_sync_at` — timestamp of the latest enrichment

### `v_zora_csw_eoa_owner_breakdown`

Population breakdown by classified-EOA cohort. Useful for the install-flow targeting (Privy vs extension EOA).

### `v_zora_csw_enrichment_throughput`

`(sync_day, rows_synced)` per day, ordered newest first. Eyeball this after flipping the flag to confirm the cron is actually doing work.

### Suggested alerts

- `unsynced_count > 50000` for >24h → enrichment cron is stuck
- `last_scanned_block` falling more than 10k blocks behind chain tip → scan cron is stuck
- `most_recent_sync_at < now() - 1h` → enrichment cron silently failing

## Manual triggering

Both handlers are idempotent and can be poked manually for debugging:

```bash
# Scan cron — wraps eth_getLogs over a single bounded window.
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://app.4626.app/api/v1/zora-csw/scan-cron | jq

# Enrich cron — multicalls ownerAtIndex on up to INDEXER_ENRICH_BUDGET CSWs.
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://app.4626.app/api/v1/zora-csw/enrich-cron | jq
```

Expected shapes:

```jsonc
// scan-cron
{
  "ok": true,
  "tick": "scanned",        // or "idle" | "skipped" | "errored"
  "from_block": "32184392",
  "to_block":   "32184917",
  "new_csws":   17
}

// enrich-cron
{
  "ok": true,
  "tick": "enriched",       // or "idle" | "errored"
  "processed": 3000,
  "succeeded": 2987,
  "failed":    13,
  "updated":   2987,
  "budget":    3000,
  "concurrency": 12
}
```

A `tick: 'errored'` response still returns HTTP 200; observability should surface it via the `error` field rather than HTTP status.

## Killing the crons

Set `ZORA_CSW_INDEXER_ENABLED=0` (or unset it) in Vercel. Both handlers will start returning `503 feature_disabled` immediately. The `vercel.json` cron entries can stay registered — they'll just no-op.

## Source-of-truth notes

- The CLI in `indexer/src/{indexCreations.ts,enrichOwners.ts,runEnrich.ts}` is still the canonical place for full-history backfills (e.g., a one-shot 2 M-row replay). The serverless modules at `frontend/server/_lib/zora-csw/{scanCreations,enrichOwners}.ts` are minimized, copy-pasted helpers — when the on-chain shape changes, update both.
- The state table is generic key/value, so additional cursors (e.g., `last_classified_block`) can live in the same table without schema churn.
