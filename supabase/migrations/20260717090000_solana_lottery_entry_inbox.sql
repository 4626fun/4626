-- Solana lottery entry durable inbox (LZ-era; SOL-P0-02 / SOL-P1-01 / SOL-P1-02).
-- Canonical eligibility source = finalized buy-path event logs, not the 256-entry ring buffer.
-- Server-only: RLS deny-all for PostgREST; postgres pooler bypasses RLS.

BEGIN;

CREATE TABLE IF NOT EXISTS public.solana_lottery_entry_inbox (
  id BIGSERIAL PRIMARY KEY,
  -- Immutable unique source identity:
  -- (cluster_genesis_hash, program_id, signature, instruction_index, event_index)
  source_event_id TEXT NOT NULL,
  cluster_genesis_hash TEXT NOT NULL,
  program_id TEXT NOT NULL,
  signature TEXT NOT NULL,
  instruction_index INTEGER NOT NULL CHECK (instruction_index >= 0),
  event_index INTEGER NOT NULL CHECK (event_index >= 0),
  -- buy_path | relay_entries_reemit (consumers must classify by instruction)
  instruction_kind TEXT NOT NULL
    CHECK (instruction_kind IN ('buy_path', 'relay_entries_reemit')),
  creator_mint TEXT NOT NULL,
  buyer_solana TEXT NOT NULL,
  amount_raw NUMERIC(78, 0) NOT NULL CHECK (amount_raw > 0),
  slot BIGINT NOT NULL CHECK (slot >= 0),
  block_time TIMESTAMPTZ NULL,
  commitment TEXT NOT NULL DEFAULT 'finalized'
    CHECK (commitment IN ('finalized')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'leased',
      'submitting',
      'submitted',
      'confirmed',
      'quarantined',
      'skipped_pricing',
      'skipped_identity'
    )),
  beneficiary_csw TEXT NULL,
  profile_id TEXT NULL,
  share_oft TEXT NULL,
  amount_scaled NUMERIC(78, 0) NULL,
  coverage_share_balance NUMERIC(78, 0) NOT NULL DEFAULT 0,
  lease_owner TEXT NULL,
  lease_expires_at TIMESTAMPTZ NULL,
  leased_at TIMESTAMPTZ NULL,
  quarantine_reason TEXT NULL,
  skip_reason TEXT NULL,
  lz_guid TEXT NULL,
  base_tx_hash TEXT NULL,
  submitted_at TIMESTAMPTZ NULL,
  confirmed_at TIMESTAMPTZ NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  metadata_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT solana_lottery_entry_inbox_source_uidx UNIQUE (source_event_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS solana_lottery_entry_inbox_sig_ix_evt_uidx
  ON public.solana_lottery_entry_inbox (
    cluster_genesis_hash,
    program_id,
    signature,
    instruction_index,
    event_index
  );

CREATE INDEX IF NOT EXISTS solana_lottery_entry_inbox_status_lease_idx
  ON public.solana_lottery_entry_inbox (status, lease_expires_at NULLS FIRST, id)
  WHERE status IN ('pending', 'leased', 'submitted');

CREATE INDEX IF NOT EXISTS solana_lottery_entry_inbox_mint_slot_idx
  ON public.solana_lottery_entry_inbox (creator_mint, slot DESC);

CREATE INDEX IF NOT EXISTS solana_lottery_entry_inbox_quarantine_idx
  ON public.solana_lottery_entry_inbox (status, updated_at DESC)
  WHERE status = 'quarantined';

ALTER TABLE public.solana_lottery_entry_inbox ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'solana_lottery_entry_inbox'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY "deny_public_rest"
      ON public.solana_lottery_entry_inbox
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.solana_lottery_ingest_cursor (
  id BIGSERIAL PRIMARY KEY,
  cursor_key TEXT NOT NULL,
  program_id TEXT NOT NULL,
  last_signature TEXT NULL,
  last_slot BIGINT NULL,
  commitment TEXT NOT NULL DEFAULT 'finalized'
    CHECK (commitment IN ('finalized')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT solana_lottery_ingest_cursor_key_uidx UNIQUE (cursor_key)
);

ALTER TABLE public.solana_lottery_ingest_cursor ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'solana_lottery_ingest_cursor'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY "deny_public_rest"
      ON public.solana_lottery_ingest_cursor
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMIT;
