-- Migration 047: precomputed creator Ethos projection for fast Explore sorting/coverage.
--
-- This table is server-only and is refreshed by the Ethos sync lane.

BEGIN;

CREATE TABLE IF NOT EXISTS public.creator_ethos_projection (
  creator_address TEXT PRIMARY KEY,
  coin_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NULL,
  market_cap_usd NUMERIC(38, 12) NULL,
  volume_24h_usd NUMERIC(38, 12) NULL,
  twitter_username TEXT NULL,
  zora_handle TEXT NULL,
  ethos_score INTEGER NULL CHECK (ethos_score BETWEEN 0 AND 2800),
  ethos_level TEXT NULL,
  ethos_score_source TEXT NULL,
  score_updated_at TIMESTAMPTZ NULL,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_ethos_projection_score_idx
  ON public.creator_ethos_projection (ethos_score DESC NULLS LAST, creator_address);

CREATE INDEX IF NOT EXISTS creator_ethos_projection_volume_idx
  ON public.creator_ethos_projection (volume_24h_usd DESC NULLS LAST, creator_address);

CREATE INDEX IF NOT EXISTS creator_ethos_projection_refreshed_idx
  ON public.creator_ethos_projection (refreshed_at DESC);

ALTER TABLE public.creator_ethos_projection ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_ethos_projection'
      AND policyname = 'creator_ethos_projection_deny_public_rest'
  ) THEN
    CREATE POLICY creator_ethos_projection_deny_public_rest
      ON public.creator_ethos_projection
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

COMMENT ON TABLE public.creator_ethos_projection IS
  'Precomputed top creator-coin + Ethos score projection for fast creator sorting and coverage metrics.';

COMMIT;
