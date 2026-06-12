-- Unused-index prune, 2026-07-13 round. Verified against pg_stat_user_indexes scan counts
-- over the full stats window AND code cross-reference before dropping (~245 MB total).
--
-- public.zora_csw_owners.idx_zora_csw_owners_base_owner (137 MB, 2 scans):
--   base_owner is only ever SELECTed as a payload column; the one predicate consumer
--   (reconcileCswIndexFlag) compares lower(base_owner), which a raw-cased btree cannot
--   serve. The 1.5M-row hot path goes through idx_zora_csw_owners_csw_address_lower
--   (2.2B scans). Every indexer upsert was paying to maintain this for nothing.
DROP INDEX IF EXISTS public.idx_zora_csw_owners_base_owner;

-- public.creators.creators_last_seen_idx (37 MB, 36 scans):
--   last_seen_at is write-only bookkeeping on creators; no production query orders or
--   filters creators by it. 37 MB for 166K rows was mostly upsert churn bloat anyway.
DROP INDEX IF EXISTS public.creators_last_seen_idx;

-- public.ethos_userkey_scores (490K rows, 687K+ upserts):
--   score_idx (32 MB, 4 scans) and status_fetched_idx (27 MB, 1 scan) are dead;
--   live read paths use the pkey (12.3M scans) and idx_es_matched_latest (6.4K scans).
DROP INDEX IF EXISTS public.ethos_userkey_scores_score_idx;
DROP INDEX IF EXISTS public.ethos_userkey_scores_status_fetched_idx;

-- public.creator_ethos_projection:
--   refreshed_idx (11 MB, 1 scan) and source_score (384 kB, 0 scans) are dead; reads go
--   through pkey (17M scans), volume_idx, score_idx, and the market_cap_ethos partial.
DROP INDEX IF EXISTS public.creator_ethos_projection_refreshed_idx;
DROP INDEX IF EXISTS public.idx_creator_ethos_projection_source_score;
