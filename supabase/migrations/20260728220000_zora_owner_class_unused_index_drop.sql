-- Drop unused secondary indexes on zora_csw_owner_class (0 idx_scan).
-- Code paths select these columns but never filter/order by them in hot paths.
-- Offline exportOutreach may seq-scan ~200k rows (acceptable for batch).
-- Confirmed safe via pg_stat_user_indexes + codebase search 2026-07-28.

DROP INDEX IF EXISTS public.idx_zora_csw_owner_class_ethos_refresh_queue;
DROP INDEX IF EXISTS public.idx_zora_csw_owner_class_outreach_pool;
DROP INDEX IF EXISTS public.idx_zora_csw_owner_class_wallet_class;
DROP INDEX IF EXISTS public.idx_zora_csw_owner_class_mainnet_nonce;
DROP INDEX IF EXISTS public.idx_zora_csw_owner_class_ethos_stale;
DROP INDEX IF EXISTS public.idx_zora_csw_owner_class_zora_handle;
DROP INDEX IF EXISTS public.idx_zora_csw_owner_class_ens_name;
DROP INDEX IF EXISTS public.idx_zora_csw_owner_class_farcaster_fid;
DROP INDEX IF EXISTS public.idx_zora_csw_owner_class_basename;

-- initial_owners GIN: write-only audit array, no query predicates remain.
DROP INDEX IF EXISTS public.idx_zora_csw_owners_initial_owners;

-- Projection leftovers if still present after prior reclaim.
DROP INDEX IF EXISTS public.creator_ethos_projection_volume_idx;
DROP INDEX IF EXISTS public.idx_creator_ethos_projection_market_cap_ethos;
