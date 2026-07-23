-- Preserve the source-chain OApp transaction used to emit each LayerZero GUID.
-- This is separate from the original B2 buy signature and the Base delivery tx.
ALTER TABLE public.solana_lottery_entry_inbox
  ADD COLUMN IF NOT EXISTS transport_source_tx_hash TEXT NULL;

CREATE INDEX IF NOT EXISTS solana_lottery_entry_inbox_submitted_receipt_idx
  ON public.solana_lottery_entry_inbox (status, submitted_at, id)
  WHERE status = 'submitted';
