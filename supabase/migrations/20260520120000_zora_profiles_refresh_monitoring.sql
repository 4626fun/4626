-- Zora profiles refresh cron: ops state + freshness view for Looker / Supabase dashboard.
--
-- The refresh cron upserts explore metrics into zora_profiles and records the last
-- successful tick in zora_profiles_refresh_state (key = last_tick).

BEGIN;

CREATE TABLE IF NOT EXISTS public.zora_profiles_refresh_state (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.zora_profiles_refresh_state IS
  'Service-role key/value checkpoint for /api/v1/zora-profiles/refresh-cron. Holds key=last_tick with scan/wallet stats.';

ALTER TABLE public.zora_profiles_refresh_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zora_profiles_refresh_state_deny_public ON public.zora_profiles_refresh_state;
CREATE POLICY zora_profiles_refresh_state_deny_public
  ON public.zora_profiles_refresh_state
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE VIEW public.v_zora_profiles_refresh_freshness AS
SELECT
  (SELECT count(*)::bigint FROM public.zora_profiles) AS total_profiles,
  (SELECT max(last_refreshed_at) FROM public.zora_profiles) AS newest_profile_refresh_at,
  (SELECT min(last_refreshed_at) FROM public.zora_profiles) AS oldest_profile_refresh_at,
  (SELECT count(*)::bigint
     FROM public.zora_profiles
    WHERE last_refreshed_at IS NULL
       OR last_refreshed_at < now() - interval '24 hours') AS stale_over_24h_count,
  (SELECT count(*)::bigint
     FROM public.zora_profiles
    WHERE wallets_synced_at IS NULL) AS wallets_unsynced_count,
  (SELECT (value->>'completed_at')::timestamptz
     FROM public.zora_profiles_refresh_state
    WHERE key = 'last_tick') AS last_cron_completed_at,
  (SELECT updated_at
     FROM public.zora_profiles_refresh_state
    WHERE key = 'last_tick') AS last_cron_state_updated_at,
  (SELECT value->'scan'->>'profilesUpserted'
     FROM public.zora_profiles_refresh_state
    WHERE key = 'last_tick') AS last_tick_profiles_upserted,
  (SELECT value->'wallets'->>'updated'
     FROM public.zora_profiles_refresh_state
    WHERE key = 'last_tick') AS last_tick_wallets_updated;

COMMENT ON VIEW public.v_zora_profiles_refresh_freshness IS
  'One-row ops summary for zora_profiles cache freshness (Looker + Supabase table editor).';

COMMIT;
