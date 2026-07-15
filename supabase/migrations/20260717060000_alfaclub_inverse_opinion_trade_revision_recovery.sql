-- Durable, immutable manual revision recovery and explicit send-unknown resolution.

ALTER TABLE alfaclub.inverse_opinion_trade_journal_revision_audit
  ADD COLUMN public_text VARCHAR(2000),
  ADD COLUMN claimant_token UUID,
  ADD COLUMN lease_expires_at TIMESTAMPTZ,
  ADD COLUMN send_started_at TIMESTAMPTZ,
  ADD COLUMN recovery_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_recovered_at TIMESTAMPTZ,
  ADD COLUMN resolution_operator_address TEXT,
  ADD COLUMN resolution_note VARCHAR(500),
  ADD COLUMN resolved_at TIMESTAMPTZ;

-- Legacy requested rows predate durable text and cannot be replayed safely.
UPDATE alfaclub.inverse_opinion_trade_journal_revision_audit
SET audit_state = 'send_unknown',
    last_error_code = 'legacy_revision_text_unavailable'
WHERE audit_state = 'requested'
  AND public_text IS NULL;

ALTER TABLE alfaclub.inverse_opinion_trade_journal_revision_audit
  ADD CONSTRAINT inverse_journal_revision_public_text_check
    CHECK (
      public_text IS NULL
      OR length(btrim(public_text)) BETWEEN 1 AND 2000
    ),
  ADD CONSTRAINT inverse_journal_revision_recovery_attempt_check
    CHECK (recovery_attempt_count >= 0),
  ADD CONSTRAINT inverse_journal_revision_requested_recovery_check
    CHECK (
      audit_state <> 'requested'
      OR (
        public_text IS NOT NULL
        AND claimant_token IS NOT NULL
        AND lease_expires_at IS NOT NULL
      )
    ),
  ADD CONSTRAINT inverse_journal_revision_resolution_operator_check
    CHECK (
      resolution_operator_address IS NULL
      OR resolution_operator_address ~ '^0x[a-f0-9]{40}$'
    ),
  ADD CONSTRAINT inverse_journal_revision_resolution_check
    CHECK (
      (resolved_at IS NULL
        AND resolution_operator_address IS NULL
        AND resolution_note IS NULL)
      OR (resolved_at IS NOT NULL
        AND resolution_operator_address IS NOT NULL
        AND length(btrim(resolution_note)) BETWEEN 8 AND 500)
    );

CREATE INDEX IF NOT EXISTS inverse_journal_revision_recovery_idx
  ON alfaclub.inverse_opinion_trade_journal_revision_audit (
    audit_state,
    lease_expires_at,
    dispatch_id
  )
  WHERE audit_state IN ('requested', 'send_unknown');

CREATE OR REPLACE FUNCTION alfaclub.enforce_inverse_journal_revision_immutable_payload()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.public_text IS DISTINCT FROM NEW.public_text
    OR OLD.client_message_id IS DISTINCT FROM NEW.client_message_id
  THEN
    RAISE EXCEPTION 'inverse journal revision payload is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inverse_journal_revision_immutable_payload_guard
  ON alfaclub.inverse_opinion_trade_journal_revision_audit;
CREATE TRIGGER inverse_journal_revision_immutable_payload_guard
  BEFORE UPDATE ON alfaclub.inverse_opinion_trade_journal_revision_audit
  FOR EACH ROW
  EXECUTE FUNCTION alfaclub.enforce_inverse_journal_revision_immutable_payload();
