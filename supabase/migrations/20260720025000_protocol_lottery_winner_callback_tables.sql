-- Shovel-shaped callback evidence tables used by Solana winner settlement.
-- Created fail-closed so cold environments do not 42P01 when the worker runs
-- before shovel has materialized these integrations.

CREATE TABLE IF NOT EXISTS public.protocol_lottery_winner_callbacks (
  tx_hash bytea NOT NULL,
  log_idx numeric,
  dst_eid integer NOT NULL,
  token bytea NOT NULL,
  winner bytea NOT NULL,
  total_shares_paid numeric NOT NULL DEFAULT 0,
  block_num numeric,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS protocol_lottery_winner_callbacks_tx_lookup_idx
  ON public.protocol_lottery_winner_callbacks (tx_hash, dst_eid);

CREATE TABLE IF NOT EXISTS public.protocol_lottery_winner_callback_drops (
  tx_hash bytea NOT NULL,
  log_idx numeric,
  dst_eid integer NOT NULL,
  token bytea NOT NULL,
  winner bytea NOT NULL,
  total_shares_paid numeric NOT NULL DEFAULT 0,
  reason text,
  block_num numeric,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS protocol_lottery_winner_callback_drops_tx_lookup_idx
  ON public.protocol_lottery_winner_callback_drops (tx_hash, dst_eid);
