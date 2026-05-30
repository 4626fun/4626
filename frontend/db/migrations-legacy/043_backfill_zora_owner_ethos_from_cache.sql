-- Migration 043: cron-safe Zora owner Ethos cache hydration function
--
-- Why
--   Ethos score data lands in public.ethos_userkey_scores. We need a safe,
--   repeatable DB-side job to project those scores into
--   public.zora_csw_owner_class without running local scripts.
--
-- What this migration does
--   1) Creates public.backfill_zora_owner_ethos_from_cache(p_limit integer)
--   2) Each run updates at most p_limit rows to keep runtime bounded.
--   3) Function is idempotent and can be scheduled frequently.
--
-- Usage
--   SELECT * FROM public.backfill_zora_owner_ethos_from_cache(50000);
--
-- Note
--   This hydrates from existing cache only. New score discovery still depends
--   on whichever process writes to ethos_userkey_scores.

BEGIN;

CREATE OR REPLACE FUNCTION public.backfill_zora_owner_ethos_from_cache(
  p_limit integer DEFAULT 50000
)
RETURNS TABLE(updated_rows integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50000), 200000));
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      z.ctid AS row_ctid,
      s.ethos_userkey,
      s.score,
      s.level,
      COALESCE(s.ethos_last_updated_at, s.fetched_at, NOW()) AS score_updated_at
    FROM public.zora_csw_owner_class z
    JOIN public.ethos_userkey_scores s
      ON s.ethos_userkey = ('address:' || lower(z.eoa))
     AND s.status = 'matched'
    WHERE
      z.ethos_userkey IS DISTINCT FROM s.ethos_userkey
      OR z.ethos_score IS DISTINCT FROM s.score
      OR z.ethos_level IS DISTINCT FROM s.level
      OR z.ethos_score_updated_at IS NULL
      OR z.ethos_score_updated_at < COALESCE(s.ethos_last_updated_at, s.fetched_at, NOW())
    ORDER BY z.ethos_score_updated_at NULLS FIRST, z.last_updated_at NULLS FIRST
    LIMIT v_limit
  ),
  updated AS (
    UPDATE public.zora_csw_owner_class z
    SET
      ethos_userkey = r.ethos_userkey,
      ethos_score = r.score,
      ethos_level = r.level,
      ethos_score_updated_at = r.score_updated_at,
      last_updated_at = NOW()
    FROM ranked r
    WHERE z.ctid = r.row_ctid
    RETURNING 1
  )
  SELECT COUNT(*)::integer AS updated_rows
  FROM updated;
END;
$$;

COMMENT ON FUNCTION public.backfill_zora_owner_ethos_from_cache(integer) IS
  'Hydrates zora_csw_owner_class.ethos_* from ethos_userkey_scores address keys in bounded batches; safe for cron scheduling.';

COMMIT;
