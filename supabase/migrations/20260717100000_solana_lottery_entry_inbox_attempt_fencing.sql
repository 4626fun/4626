-- Fence Solana lottery submit attempts so uncertain/slow LZ sends cannot be retried
-- as a new economic entry without explicit receipt reconciliation.

BEGIN;

ALTER TABLE public.solana_lottery_entry_inbox
  ADD COLUMN IF NOT EXISTS submit_attempt_id TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS solana_lottery_entry_inbox_submit_attempt_uidx
  ON public.solana_lottery_entry_inbox (submit_attempt_id)
  WHERE submit_attempt_id IS NOT NULL;

-- Legacy uncertain sends have no fence token and must never become retryable.
UPDATE public.solana_lottery_entry_inbox
SET
  status = 'quarantined',
  quarantine_reason = 'submit_crash_unconfirmed',
  lease_owner = NULL,
  lease_expires_at = NULL,
  updated_at = NOW()
WHERE status = 'submitting'
  AND submit_attempt_id IS NULL;

ALTER TABLE public.solana_lottery_entry_inbox
  ADD CONSTRAINT solana_lottery_entry_inbox_submitting_attempt_chk
  CHECK (status <> 'submitting' OR submit_attempt_id IS NOT NULL);

COMMIT;
