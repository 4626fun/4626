BEGIN;

CREATE TABLE IF NOT EXISTS public.solana_share_mesh_mappings (
  id BIGSERIAL PRIMARY KEY,
  creator_token TEXT NOT NULL,
  share_oft TEXT NOT NULL,
  share_mesh_mint TEXT NOT NULL,
  source_session_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed')),
  apply_attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  applied_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS solana_share_mesh_mappings_share_oft_uidx
  ON public.solana_share_mesh_mappings (LOWER(share_oft));

CREATE INDEX IF NOT EXISTS solana_share_mesh_mappings_status_created_idx
  ON public.solana_share_mesh_mappings (status, created_at DESC);

ALTER TABLE public.solana_share_mesh_mappings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'solana_share_mesh_mappings'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY "deny_public_rest"
      ON public.solana_share_mesh_mappings
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMIT;
