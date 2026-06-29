BEGIN;

CREATE TABLE IF NOT EXISTS public.solana_meteora_pool_status (
  id BIGSERIAL PRIMARY KEY,
  creator_token TEXT NOT NULL,
  share_oft TEXT NULL,
  share_mesh_mint TEXT NOT NULL,
  quote_mint TEXT NOT NULL DEFAULT 'So11111111111111111111111111111111111111112',
  pool_address TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'creating', 'created', 'failed', 'skipped')),
  provision_attempt_count INTEGER NOT NULL DEFAULT 0,
  last_signature TEXT NULL,
  last_error TEXT NULL,
  response_json JSONB NULL,
  source_session_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS solana_meteora_pool_status_share_mesh_uidx
  ON public.solana_meteora_pool_status (share_mesh_mint, quote_mint);

CREATE INDEX IF NOT EXISTS solana_meteora_pool_status_creator_idx
  ON public.solana_meteora_pool_status (LOWER(creator_token), updated_at DESC);

CREATE INDEX IF NOT EXISTS solana_meteora_pool_status_status_idx
  ON public.solana_meteora_pool_status (status, updated_at DESC);

ALTER TABLE public.solana_meteora_pool_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'solana_meteora_pool_status'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY "deny_public_rest"
      ON public.solana_meteora_pool_status
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMIT;
