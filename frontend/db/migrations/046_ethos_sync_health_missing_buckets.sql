-- Migration 046: extend Ethos sync health view with actionable missing buckets
--
-- Why
--   `rows_missing_score` alone does not explain where misses come from. We need
--   explicit buckets to distinguish identity-key gaps, cache gaps, and
--   projection lag.
--
-- What this migration does
--   1) Replaces public.v_zora_owner_ethos_sync_health with three additional
--      missing-score buckets.
--   2) Preserves existing columns used by current API handlers/dashboards.

BEGIN;

CREATE OR REPLACE VIEW public.v_zora_owner_ethos_sync_health AS
WITH owner_rows AS (
  SELECT
    z.ethos_score,
    z.ethos_score_updated_at,
    ('address:' || lower(z.eoa))::text AS address_userkey
  FROM public.zora_csw_owner_class z
),
identity_keys AS (
  SELECT DISTINCT k.ethos_userkey
  FROM public.user_ethos_identity_keys k
  WHERE k.ethos_userkey LIKE 'address:0x%'
),
matched_cache AS (
  SELECT
    s.ethos_userkey,
    COALESCE(s.ethos_last_updated_at, s.fetched_at) AS matched_score_at
  FROM public.ethos_userkey_scores s
  WHERE s.status = 'matched'
),
owner_joined AS (
  SELECT
    o.ethos_score,
    o.ethos_score_updated_at,
    (ik.ethos_userkey IS NOT NULL) AS has_identity_key,
    (mc.ethos_userkey IS NOT NULL) AS has_matched_cache
  FROM owner_rows o
  LEFT JOIN identity_keys ik
    ON ik.ethos_userkey = o.address_userkey
  LEFT JOIN matched_cache mc
    ON mc.ethos_userkey = o.address_userkey
),
owners AS (
  SELECT
    COUNT(*)::bigint AS total_rows,
    COUNT(*) FILTER (WHERE ethos_score IS NOT NULL)::bigint AS rows_with_score,
    COUNT(*) FILTER (WHERE ethos_score IS NULL)::bigint AS rows_missing_score,
    COUNT(*) FILTER (
      WHERE ethos_score IS NULL
        AND NOT has_identity_key
    )::bigint AS rows_missing_no_identity_key,
    COUNT(*) FILTER (
      WHERE ethos_score IS NULL
        AND has_identity_key
        AND NOT has_matched_cache
    )::bigint AS rows_missing_no_matched_cache,
    COUNT(*) FILTER (
      WHERE ethos_score IS NULL
        AND has_matched_cache
    )::bigint AS rows_missing_projection_gap,
    COUNT(*) FILTER (
      WHERE ethos_score_updated_at IS NOT NULL
        AND ethos_score_updated_at < NOW() - INTERVAL '24 hours'
    )::bigint AS rows_stale_over_24h,
    MAX(ethos_score_updated_at) AS newest_projected_score_at,
    MIN(ethos_score_updated_at) FILTER (WHERE ethos_score_updated_at IS NOT NULL) AS oldest_projected_score_at
  FROM owner_joined
),
cache AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'matched')::bigint AS matched_cache_rows,
    COUNT(*) FILTER (
      WHERE status = 'matched'
        AND COALESCE(ethos_last_updated_at, fetched_at) < NOW() - INTERVAL '24 hours'
    )::bigint AS matched_cache_stale_over_24h,
    MAX(COALESCE(ethos_last_updated_at, fetched_at)) FILTER (WHERE status = 'matched') AS newest_cache_score_at
  FROM public.ethos_userkey_scores
)
SELECT
  NOW() AS observed_at,
  owners.total_rows,
  owners.rows_with_score,
  owners.rows_missing_score,
  owners.rows_missing_no_identity_key,
  owners.rows_missing_no_matched_cache,
  owners.rows_missing_projection_gap,
  owners.rows_stale_over_24h,
  owners.newest_projected_score_at,
  owners.oldest_projected_score_at,
  cache.matched_cache_rows,
  cache.matched_cache_stale_over_24h,
  cache.newest_cache_score_at
FROM owners
CROSS JOIN cache;

COMMENT ON VIEW public.v_zora_owner_ethos_sync_health IS
  'Single-row operational health snapshot for Zora owner Ethos projection coverage, cache freshness, and missing-score buckets.';

COMMIT;
