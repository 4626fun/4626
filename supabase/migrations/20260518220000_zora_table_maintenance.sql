-- Zora indexer table maintenance: targeted indexes + weekly VACUUM ANALYZE.
-- See docs/operations/supabase-zora-db-optimization.md

-- Explore / ethos projection join: lower(zco.csw_address) = creator_address
CREATE INDEX IF NOT EXISTS idx_zora_csw_owners_csw_address_lower
  ON public.zora_csw_owners (lower(csw_address));

-- exportOutreach triple-signal pool (wallet_class + zora + farcaster, order by activity)
CREATE INDEX IF NOT EXISTS idx_zora_csw_owner_class_outreach_pool
  ON public.zora_csw_owner_class (mainnet_nonce DESC NULLS LAST)
  WHERE wallet_class = 'likely_extension_eoa'
    AND zora_handle IS NOT NULL
    AND farcaster_fid IS NOT NULL;

-- VACUUM must run as top-level cron SQL (not inside a PL/pgSQL function).
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'weekly-zora-vacuum-owners' LIMIT 1;
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'weekly-zora-vacuum-owners',
    '30 4 * * 0',
    'VACUUM ANALYZE public.zora_csw_owners'
  );

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'weekly-zora-vacuum-owner-class' LIMIT 1;
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'weekly-zora-vacuum-owner-class',
    '35 4 * * 0',
    'VACUUM ANALYZE public.zora_csw_owner_class'
  );
END;
$$;
