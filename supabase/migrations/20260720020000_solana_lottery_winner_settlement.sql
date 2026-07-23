ALTER TABLE public.solana_lottery_entry_inbox
  ADD COLUMN IF NOT EXISTS base_request_id NUMERIC;

CREATE UNIQUE INDEX IF NOT EXISTS solana_lottery_entry_inbox_base_request_id_uq
  ON public.solana_lottery_entry_inbox (base_request_id)
  WHERE base_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.solana_lottery_winner_settlement (
  id BIGSERIAL PRIMARY KEY,
  win_id TEXT NOT NULL UNIQUE CHECK (win_id ~ '^0x[0-9a-f]{64}$' OR win_id ~ '^pending:[0-9]+$'),
  entry_inbox_id BIGINT NOT NULL UNIQUE REFERENCES public.solana_lottery_entry_inbox(id),
  base_tx_hash TEXT NOT NULL CHECK (base_tx_hash ~ '^0x[0-9a-f]{64}$'),
  base_log_index BIGINT NOT NULL CHECK (base_log_index >= 0),
  base_request_id NUMERIC NOT NULL,
  creator_token TEXT NOT NULL,
  beneficiary_csw TEXT NOT NULL,
  winner_solana TEXT NOT NULL,
  creator_mint TEXT NOT NULL,
  shares_paid NUMERIC NOT NULL CHECK (shares_paid >= 0 AND shares_paid <= 18446744073709551615),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitting', 'confirmed', 'quarantined')),
  attempt_id UUID,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  solana_signature TEXT,
  win_id_record TEXT,
  winner_record TEXT,
  last_error TEXT,
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS solana_lottery_winner_settlement_status_idx
  ON public.solana_lottery_winner_settlement (status, id);

ALTER TABLE public.solana_lottery_winner_settlement ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.solana_lottery_winner_settlement FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.solana_lottery_winner_settlement_id_seq FROM anon, authenticated;
