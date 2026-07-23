CREATE TABLE IF NOT EXISTS public.solana_b2_canary_authorizations (
  id BIGSERIAL PRIMARY KEY,
  source_event_id TEXT NOT NULL UNIQUE,
  share_mesh_mint TEXT NOT NULL,
  approval_ref TEXT NOT NULL CHECK (char_length(approval_ref) BETWEEN 8 AND 200),
  status TEXT NOT NULL DEFAULT 'authorized' CHECK (status IN ('authorized', 'consumed', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS solana_b2_canary_authorizations_active_idx
  ON public.solana_b2_canary_authorizations (share_mesh_mint, expires_at)
  WHERE status = 'authorized';

ALTER TABLE public.solana_b2_canary_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.solana_b2_canary_authorizations FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.solana_b2_canary_authorizations_id_seq FROM anon, authenticated;
