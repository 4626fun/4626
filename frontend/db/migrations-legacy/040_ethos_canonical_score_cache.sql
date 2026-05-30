-- Migration 040: canonical Ethos score cache projection
--
-- Adds:
--   1) user_ethos_identity_keys  - canonical profile -> candidate Ethos userkeys
--   2) ethos_userkey_scores      - shared per-userkey score cache
--   3) canonical_ethos_scores    - one selected score per canonical profile
--   4) ethos_score_sync_state    - incremental sync cursor state
--
-- All tables are server-only and protected by deny-all RLS policies.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_ethos_identity_keys (
  canonical_user_id BIGINT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ethos_userkey TEXT NOT NULL,
  identity_type TEXT NOT NULL,
  priority SMALLINT NOT NULL,
  source TEXT NOT NULL DEFAULT 'unknown',
  verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (canonical_user_id, ethos_userkey)
);

CREATE INDEX IF NOT EXISTS user_ethos_identity_keys_userkey_idx
  ON public.user_ethos_identity_keys (ethos_userkey);

CREATE INDEX IF NOT EXISTS user_ethos_identity_keys_canonical_idx
  ON public.user_ethos_identity_keys (canonical_user_id, priority, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ethos_userkey_scores (
  ethos_userkey TEXT PRIMARY KEY,
  score INTEGER NULL CHECK (score BETWEEN 0 AND 2800),
  level TEXT NULL,
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('matched', 'not_found', 'error', 'stale', 'unknown')),
  ethos_last_updated_at TIMESTAMPTZ NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw JSONB NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ethos_userkey_scores_status_fetched_idx
  ON public.ethos_userkey_scores (status, fetched_at ASC);

CREATE INDEX IF NOT EXISTS ethos_userkey_scores_score_idx
  ON public.ethos_userkey_scores (score DESC NULLS LAST, fetched_at DESC);

CREATE TABLE IF NOT EXISTS public.canonical_ethos_scores (
  canonical_user_id BIGINT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  selected_userkey TEXT NULL,
  score INTEGER NULL CHECK (score BETWEEN 0 AND 2800),
  level TEXT NULL,
  source_identity_type TEXT NULL,
  score_fetched_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS canonical_ethos_scores_score_idx
  ON public.canonical_ethos_scores (score DESC NULLS LAST, canonical_user_id);

CREATE INDEX IF NOT EXISTS canonical_ethos_scores_1200_idx
  ON public.canonical_ethos_scores (score DESC, canonical_user_id)
  WHERE score >= 1200;

CREATE INDEX IF NOT EXISTS canonical_ethos_scores_1600_idx
  ON public.canonical_ethos_scores (score DESC, canonical_user_id)
  WHERE score >= 1600;

CREATE TABLE IF NOT EXISTS public.ethos_score_sync_state (
  sync_key TEXT PRIMARY KEY,
  cursor_after TEXT NULL,
  last_synced_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_ethos_identity_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ethos_userkey_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_ethos_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ethos_score_sync_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_ethos_identity_keys'
      AND policyname = 'user_ethos_identity_keys_deny_public_rest'
  ) THEN
    CREATE POLICY user_ethos_identity_keys_deny_public_rest
      ON public.user_ethos_identity_keys
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ethos_userkey_scores'
      AND policyname = 'ethos_userkey_scores_deny_public_rest'
  ) THEN
    CREATE POLICY ethos_userkey_scores_deny_public_rest
      ON public.ethos_userkey_scores
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'canonical_ethos_scores'
      AND policyname = 'canonical_ethos_scores_deny_public_rest'
  ) THEN
    CREATE POLICY canonical_ethos_scores_deny_public_rest
      ON public.canonical_ethos_scores
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ethos_score_sync_state'
      AND policyname = 'ethos_score_sync_state_deny_public_rest'
  ) THEN
    CREATE POLICY ethos_score_sync_state_deny_public_rest
      ON public.ethos_score_sync_state
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

COMMENT ON TABLE public.user_ethos_identity_keys IS
  'Candidate Ethos userkeys associated with canonical profiles, with source and priority.';

COMMENT ON TABLE public.ethos_userkey_scores IS
  'Shared cached Ethos scores keyed by Ethos userkey.';

COMMENT ON TABLE public.canonical_ethos_scores IS
  'Selected Ethos score projection for each canonical profile.';

COMMENT ON TABLE public.ethos_score_sync_state IS
  'Cursor/checkpoint state for incremental Ethos score updates sync.';

COMMIT;
