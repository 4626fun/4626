BEGIN;

CREATE TABLE IF NOT EXISTS public.solana_hook_status (
  id BIGSERIAL PRIMARY KEY,
  creator_token TEXT NOT NULL,
  share_oft TEXT NULL,
  hook_mint TEXT NULL,
  creator_config TEXT NULL,
  pending_entries TEXT NULL,
  winner_record TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'creating', 'created', 'failed', 'skipped')),
  provision_attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  response_json JSONB NULL,
  source_session_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS solana_hook_status_creator_uidx
  ON public.solana_hook_status (creator_token);

CREATE INDEX IF NOT EXISTS solana_hook_status_status_idx
  ON public.solana_hook_status (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS solana_hook_status_hook_mint_idx
  ON public.solana_hook_status (hook_mint)
  WHERE hook_mint IS NOT NULL;

ALTER TABLE public.solana_hook_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'solana_hook_status'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY "deny_public_rest"
      ON public.solana_hook_status
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMIT;
