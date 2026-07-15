-- Complete submitted execution recovery and persist immutable journal delivery text.
-- The U5 dispatch tables may already contain rows from 0200/0400; quarantine
-- non-sent legacy deliveries before public_text becomes required by runtime code.

ALTER TABLE alfaclub.inverse_opinion_trade_journal_deliveries
  ADD COLUMN public_text VARCHAR(2000);

ALTER TABLE alfaclub.inverse_opinion_trade_journal_revision_audit
  ADD COLUMN last_error_code VARCHAR(128);

ALTER TABLE alfaclub.inverse_opinion_trade_journal_deliveries
  ADD CONSTRAINT inverse_journal_delivery_public_text_check
  CHECK (
    public_text IS NULL
    OR length(btrim(public_text)) BETWEEN 1 AND 2000
  );

WITH quarantined AS (
  UPDATE alfaclub.inverse_opinion_trade_journal_deliveries AS delivery
  SET delivery_state = 'send_unknown',
      last_error_code = 'legacy_delivery_text_unavailable',
      updated_at = NOW()
  FROM alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
  WHERE delivery.dispatch_id = dispatch.dispatch_id
    AND delivery.public_text IS NULL
    AND delivery.delivery_state <> 'sent'
    AND dispatch.dispatch_state IN ('claimed', 'sending', 'failed')
  RETURNING delivery.dispatch_id
)
UPDATE alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
SET dispatch_state = 'send_unknown',
    last_error_code = 'legacy_delivery_text_unavailable',
    updated_at = NOW()
WHERE dispatch.dispatch_id IN (SELECT dispatch_id FROM quarantined);

UPDATE alfaclub.inverse_opinion_trade_decisions
SET recovery_deadline_at = COALESCE(
      recovery_deadline_at,
      submitted_at + INTERVAL '15 minutes'
    ),
    updated_at = NOW()
WHERE execution_phase = 'submitted'
  AND submitted_at IS NOT NULL
  AND recovery_deadline_at IS NULL;

CREATE INDEX IF NOT EXISTS inverse_opinion_trade_decisions_submitted_recovery_idx
  ON alfaclub.inverse_opinion_trade_decisions (recovery_deadline_at, decision_id)
  WHERE execution_phase = 'submitted';
