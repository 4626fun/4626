# Zora CSW indexer: keep-fresh cron + monitoring spec

Status: **implemented** · Author: computer · Date: 2026-05-05 · Implemented: 2026-05-06 in PR `feat(zora-csw): indexer crons for scan + enrich` (see `feat/zora-csw-indexer-crons` branch).
Related: `indexer/README.md`, `indexer/src/runEnrich.ts`, [zora-payout-recipient-design.md](./zora-payout-recipient-design.md)

## Problem

The Zora CSW indexer (`@4626/zora-csw-indexer`) is a one-shot Node service today. It was run on April 20-22 to seed `public.zora_csw_owners`, then stopped:

- 1,530,423 distinct Zora CSWs indexed via `ZoraSmartWalletCreated` events
- 168,264 (11%) have `current_owners` populated by the enrichment pass
- 1,362,159 (89%) have `current_owners IS NULL` — never enriched
- No new Zora CSWs picked up since April 22 (event-scan stopped)

For the [Zora `setPayoutRecipient` flow](./zora-payout-recipient-design.md) we need the owner data fresh: the launch UI reads `zora_csw_owners.current_owners` to identify which user EOA can sign the payout-recipient update. Stale data → users we could otherwise serve get the "deferred" hand-off copy unnecessarily.

## Design

Two scheduled jobs, both hosted as Vercel cron handlers in the existing 4626 frontend project (where every other cron lives, per `vercel.json`). They invoke the same logic that already exists in `indexer/src/`, but as serverless functions rather than long-running Node processes.

### Job A: scan new creations (every 15 minutes)

`POST /api/v1/zora-csw/scan-cron` — wraps `indexer/src/indexCreations.ts`.

- Reads the last-scanned block from a new `zora_csw_indexer_state(key, value)` row (or reuse an existing key/value config table — check the repo).
- Calls `eth_getLogs` for `ZoraSmartWalletCreated` from `lastScannedBlock` to current tip.
- Upserts rows into `zora_csw_owners`. New rows have `current_owners IS NULL`.
- Updates the state row with the new high-water-mark block.
- Vercel function timeout: 60s should be plenty for 15-minute windows on Base (~3000 blocks at 2s/block, well under typical RPC `getLogs` caps).

### Job B: enrich oldest-unsynced (every 30 minutes)

`POST /api/v1/zora-csw/enrich-cron` — wraps `indexer/src/runEnrich.ts` with a fixed budget per run.

- Pulls up to N rows where `current_owners IS NULL` (or `last_owner_sync_at < now() - 7 days` for refresh), ordered by `creation_block ASC` (oldest unsynced first to drain the backlog).
- Calls `enrichCswOwners` per address with the existing concurrency.
- Batched upsert via the same UPDATE_BATCH_SIZE pattern.
- Suggested per-run budget: `ENRICH_TARGET_COUNT=3000`, `ENRICH_CONCURRENCY=12`. At 30-minute cadence and ~12 reads/sec effective, that's ~6000 rows/hr backlog drain. Backlog of 1.36M empties in ~10 days — fine since we have no immediate user-facing dependency.
- If you want it faster, run the local one-shot tonight (already discussed) and let the cron handle ongoing maintenance only.

### State table

```sql
-- Migration: 03X_zora_csw_indexer_state.sql
CREATE TABLE IF NOT EXISTS public.zora_csw_indexer_state (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS lockdown — service-role only (matches the rest of the indexer's hygiene)
ALTER TABLE public.zora_csw_indexer_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zora_csw_indexer_state FORCE ROW LEVEL SECURITY;

CREATE POLICY zora_csw_indexer_state_deny_anon
  ON public.zora_csw_indexer_state
  AS RESTRICTIVE FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);
```

Initial seeding: `INSERT INTO zora_csw_indexer_state (key, value) VALUES ('last_scanned_block', '{"block": <bootstrap_block>}');` where `bootstrap_block` is the highest `creation_block` already in `zora_csw_owners`.

### vercel.json registration

```json
{
  "path": "/api/v1/zora-csw/scan-cron",
  "schedule": "*/15 * * * *"
},
{
  "path": "/api/v1/zora-csw/enrich-cron",
  "schedule": "*/30 * * * *"
}
```

### Auth model

These crons should accept only Vercel's `x-vercel-cron-secret` header (the standard pattern already used by the other crons in this project — copy the auth check from one of them, e.g. `_amoePublishCron.ts`).

### Required env

```
BASE_RPC_URL=                  # paid endpoint, mandatory
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=     # already exists in Vercel for other handlers
INDEXER_RPC_CONCURRENCY=12     # optional override
INDEXER_ENRICH_BUDGET=3000     # optional override
INDEXER_GETLOGS_WINDOW=10000   # optional override
```

`SUPABASE_SERVICE_ROLE_KEY` is presumably already in Vercel since other handlers use the service-role client. `BASE_RPC_URL` may need to be added (or reuse an existing alias if the project already has one for vault-related RPC).

## Monitoring

Three metrics worth tracking. Implement as views on top of the existing tables — no new collection infrastructure needed:

```sql
-- View 1: Indexer freshness
CREATE OR REPLACE VIEW public.v_zora_csw_indexer_freshness AS
SELECT
  (SELECT (value->>'block')::bigint FROM zora_csw_indexer_state
     WHERE key = 'last_scanned_block') AS last_scanned_block,
  (SELECT max(creation_block) FROM zora_csw_owners) AS max_known_creation_block,
  (SELECT count(*) FROM zora_csw_owners
     WHERE current_owners IS NULL) AS unsynced_count,
  (SELECT count(*) FROM zora_csw_owners
     WHERE current_owners IS NOT NULL
       AND last_owner_sync_at < now() - interval '7 days') AS stale_count,
  (SELECT count(*) FROM zora_csw_owners
     WHERE current_owners IS NOT NULL) AS synced_count,
  (SELECT count(*) FROM zora_csw_owners) AS total_count,
  (SELECT max(last_owner_sync_at) FROM zora_csw_owners) AS most_recent_sync_at;

-- View 2: Population breakdown (matches the analysis we ran tonight)
CREATE OR REPLACE VIEW public.v_zora_csw_eoa_owner_breakdown AS
WITH csw AS (
  SELECT csw_address, lower(unnest(current_owners)) AS owner_lc
  FROM zora_csw_owners
  WHERE current_owners IS NOT NULL AND array_length(current_owners,1) > 0
),
cls AS (
  SELECT lower(eoa) AS eoa_lc, wallet_class FROM zora_csw_owner_class
),
joined AS (
  SELECT csw.csw_address, cls.wallet_class
  FROM csw LEFT JOIN cls ON cls.eoa_lc = csw.owner_lc
),
per_csw AS (
  SELECT
    csw_address,
    bool_or(wallet_class IS NOT NULL) AS has_classified_eoa,
    bool_or(wallet_class = 'likely_extension_eoa') AS has_extension_eoa,
    bool_or(wallet_class = 'likely_privy_embedded') AS has_privy_embedded
  FROM joined GROUP BY csw_address
)
SELECT
  count(*) AS analyzed_csws,
  count(*) FILTER (WHERE has_classified_eoa) AS with_eoa_owner,
  count(*) FILTER (WHERE has_privy_embedded) AS with_privy_embedded,
  count(*) FILTER (WHERE has_extension_eoa) AS with_extension_eoa,
  count(*) FILTER (WHERE NOT has_classified_eoa) AS without_classified_eoa
FROM per_csw;

-- View 3: Per-day enrichment throughput
CREATE OR REPLACE VIEW public.v_zora_csw_enrichment_throughput AS
SELECT
  date_trunc('day', last_owner_sync_at)::date AS sync_day,
  count(*) AS rows_synced
FROM zora_csw_owners
WHERE last_owner_sync_at IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;
```

These views can be polled from any internal dashboard or Slack bot. Useful alerts:

- `unsynced_count > 50_000` for >24h → enrichment cron is stuck
- `last_scanned_block` falling more than 10k blocks behind chain tip → scan cron is stuck
- `most_recent_sync_at < now() - 1h` → enrichment cron silently failing

(No code in this spec for the alerting itself — call it out if you want a follow-up to wire the alerts into Slack via the existing Discord/Slack webhooks the repo already uses for other ops alerts.)

## Implementation plan

### v1 (this spec)

1. New migration `03X_zora_csw_indexer_state.sql` — state table + the three views.
2. New handler `/api/v1/zora-csw/scan-cron.ts` — port `indexer/src/indexCreations.ts` to a Vercel handler.
3. New handler `/api/v1/zora-csw/enrich-cron.ts` — port `indexer/src/runEnrich.ts` budget-bounded.
4. Add cron entries to `vercel.json`.
5. Verify env vars in Vercel project settings; add `BASE_RPC_URL` if missing.

Estimated work: 2-3 hours including tests.

### What's not in v1

- Backfill of the 1.36M unsynced rows. **Run that locally tonight** (per the earlier plan): `cd indexer && ENRICH_TARGET_COUNT=2000000 ENRICH_CONCURRENCY=24 ENRICH_MODE=oldest-unsynced pnpm tsx src/runEnrich.ts`. Cron picks up steady state from there.
- Slack/Discord alerting on the three views. Easy follow-up.
- Ad-hoc backfill endpoint for "we need this CSW's owners *right now*" — read-through caching on the lookup path is a better answer.
- Classification refresh (the `zora_csw_owner_class` table). Separate cron, separate spec; needed when we want to keep the Privy-vs-extension split fresh.
