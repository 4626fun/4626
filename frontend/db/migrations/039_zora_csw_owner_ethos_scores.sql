-- Migration 039: cache Ethos scores for Zora CSW owner EOAs
--
-- The Zora CSW owner-class table is the durable per-owner profile surface
-- used by the outreach/indexer pipeline. Add Ethos columns here so owner
-- refreshes and app profile views can hydrate reputation once and let every
-- downstream dashboard/UI read it without live Ethos calls.

BEGIN;

ALTER TABLE public.zora_csw_owner_class
  ADD COLUMN IF NOT EXISTS ethos_userkey TEXT,
  ADD COLUMN IF NOT EXISTS ethos_score NUMERIC,
  ADD COLUMN IF NOT EXISTS ethos_level TEXT,
  ADD COLUMN IF NOT EXISTS ethos_score_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_zora_csw_owner_class_ethos_score
  ON public.zora_csw_owner_class (ethos_score DESC NULLS LAST, last_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_zora_csw_owner_class_ethos_stale
  ON public.zora_csw_owner_class (ethos_score_updated_at ASC NULLS FIRST)
  WHERE ethos_userkey IS NOT NULL;

COMMENT ON COLUMN public.zora_csw_owner_class.ethos_userkey IS
  'Ethos userkey used for the cached score, typically address:<lowercase_eoa>.';

COMMENT ON COLUMN public.zora_csw_owner_class.ethos_score IS
  'Cached Ethos credibility score for this owner EOA. Null means unchecked or no score.';

COMMENT ON COLUMN public.zora_csw_owner_class.ethos_level IS
  'Cached Ethos credibility level label returned by Ethos.';

COMMENT ON COLUMN public.zora_csw_owner_class.ethos_score_updated_at IS
  'When the cached Ethos score/level was last refreshed.';

COMMIT;
