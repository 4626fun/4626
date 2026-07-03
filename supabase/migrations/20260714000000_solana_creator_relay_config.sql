BEGIN;

CREATE TABLE IF NOT EXISTS public.solana_creator_relay_config (
  id BIGSERIAL PRIMARY KEY,
  creator_token TEXT NOT NULL,
  share_oft TEXT NOT NULL,
  share_mesh_mint TEXT NOT NULL,
  relay_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  readiness_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (readiness_status IN ('pending', 'verified', 'failed')),
  readiness_checks_json JSONB NULL,
  b2_verified_at TIMESTAMPTZ NULL,
  relay_enabled_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  source_session_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS solana_creator_relay_config_share_mesh_uidx
  ON public.solana_creator_relay_config (share_mesh_mint);

CREATE INDEX IF NOT EXISTS solana_creator_relay_config_creator_idx
  ON public.solana_creator_relay_config (LOWER(creator_token), updated_at DESC);

CREATE INDEX IF NOT EXISTS solana_creator_relay_config_relay_enabled_idx
  ON public.solana_creator_relay_config (relay_enabled, updated_at DESC)
  WHERE relay_enabled = TRUE;

ALTER TABLE public.solana_creator_relay_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'solana_creator_relay_config'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY "deny_public_rest"
      ON public.solana_creator_relay_config
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMIT;
