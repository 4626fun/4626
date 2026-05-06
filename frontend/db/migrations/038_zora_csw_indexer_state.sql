-- Migration 038: zora_csw_indexer_state + monitoring views
--
-- Why
--   The Zora CSW indexer (`indexer/src/runEnrich.ts` + `indexCreations.ts`)
--   is graduating from a one-shot CLI to a pair of Vercel cron handlers
--   (frontend/api/_handlers/v1/zora-csw/_scanCron.ts and _enrichCron.ts).
--   The scan cron needs a single-row, durable checkpoint of the
--   last-scanned-block on Base mainnet so each tick picks up where the
--   previous one left off. We also want three at-a-glance views for ops:
--   freshness, EOA-owner coverage, and per-day enrichment throughput.
--
-- What this migration does
--   1. Creates `public.zora_csw_indexer_state(key TEXT PK, value JSONB,
--      updated_at TIMESTAMPTZ)` — a tiny key/value table that today
--      stores exactly one row (`last_scanned_block`) but is generic so
--      additional state (e.g., last_enriched_block, classification
--      cursor) can live in the same table without schema churn.
--   2. Enables RLS + FORCE RLS and adds a RESTRICTIVE deny-all policy
--      for `anon` and `authenticated` roles. Pattern matches migration
--      037. `service_role` has BYPASSRLS in Supabase by default, which
--      is how the cron handlers (running with the service-role client)
--      reach the table.
--   3. Creates the three monitoring views from the spec —
--      `v_zora_csw_indexer_freshness`, `v_zora_csw_eoa_owner_breakdown`,
--      `v_zora_csw_enrichment_throughput`.
--
-- Initial seed (run once after deploy, before flipping the feature flag):
--
--   INSERT INTO public.zora_csw_indexer_state (key, value)
--   VALUES (
--     'last_scanned_block',
--     jsonb_build_object('block', (SELECT max(creation_block) FROM public.zora_csw_owners))
--   )
--   ON CONFLICT (key) DO NOTHING;
--
-- Rollback
--   DROP VIEW IF EXISTS public.v_zora_csw_enrichment_throughput;
--   DROP VIEW IF EXISTS public.v_zora_csw_eoa_owner_breakdown;
--   DROP VIEW IF EXISTS public.v_zora_csw_indexer_freshness;
--   DROP TABLE IF EXISTS public.zora_csw_indexer_state;

BEGIN;

CREATE TABLE IF NOT EXISTS public.zora_csw_indexer_state (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.zora_csw_indexer_state IS
  'Single-row key/value checkpoint table for the Zora CSW indexer crons. Today holds key=''last_scanned_block'' with value={"block": <bigint>}. Service-role only.';

ALTER TABLE public.zora_csw_indexer_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zora_csw_indexer_state FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zora_csw_indexer_state_deny_anon ON public.zora_csw_indexer_state;
CREATE POLICY zora_csw_indexer_state_deny_anon
  ON public.zora_csw_indexer_state
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- View 1: Indexer freshness — single-row dashboard tile.
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

-- View 2: Population breakdown by classified-EOA owner.
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

-- View 3: Per-day enrichment throughput.
CREATE OR REPLACE VIEW public.v_zora_csw_enrichment_throughput AS
SELECT
  date_trunc('day', last_owner_sync_at)::date AS sync_day,
  count(*) AS rows_synced
FROM zora_csw_owners
WHERE last_owner_sync_at IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;

COMMIT;
