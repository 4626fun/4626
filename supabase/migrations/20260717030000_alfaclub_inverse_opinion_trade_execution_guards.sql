-- Concurrency and recovery guards for InverseAKITA execution/reconciliation.

ALTER TABLE alfaclub.inverse_opinion_trade_decisions
  ADD COLUMN IF NOT EXISTS execution_claim_token UUID,
  ADD COLUMN IF NOT EXISTS execution_claim_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_deadline_at TIMESTAMPTZ;

UPDATE alfaclub.inverse_opinion_trade_decisions
SET execution_claim_expires_at = COALESCE(execution_claim_expires_at, updated_at)
WHERE execution_phase = 'claimed'
  AND execution_claim_expires_at IS NULL;

UPDATE alfaclub.inverse_opinion_trade_decisions
SET recovery_deadline_at = COALESCE(
  recovery_deadline_at,
  submitted_at + INTERVAL '15 minutes',
  updated_at + INTERVAL '15 minutes'
)
WHERE execution_phase = 'unknown'
  AND recovery_deadline_at IS NULL;

ALTER TABLE alfaclub.inverse_opinion_trade_decisions
  DROP CONSTRAINT IF EXISTS inverse_opinion_decision_execution_claim_check;
ALTER TABLE alfaclub.inverse_opinion_trade_decisions
  ADD CONSTRAINT inverse_opinion_decision_execution_claim_check
  CHECK (
    (execution_phase = 'claimed' AND execution_claim_expires_at IS NOT NULL)
    OR (
      execution_phase <> 'claimed'
      AND execution_claim_token IS NULL
      AND execution_claim_expires_at IS NULL
    )
  );

ALTER TABLE alfaclub.inverse_opinion_trade_decisions
  DROP CONSTRAINT IF EXISTS inverse_opinion_decision_recovery_check;
ALTER TABLE alfaclub.inverse_opinion_trade_decisions
  ADD CONSTRAINT inverse_opinion_decision_recovery_check
  CHECK (
    execution_attempt_count >= 0
    AND recovery_attempt_count >= 0
    AND (
      execution_phase <> 'unknown'
      OR recovery_deadline_at IS NOT NULL
    )
  );

CREATE TABLE IF NOT EXISTS alfaclub.inverse_opinion_fill_claims (
  executor_wallet TEXT NOT NULL,
  fill_identity VARCHAR(96) NOT NULL,
  decision_id UUID NOT NULL
    REFERENCES alfaclub.inverse_opinion_trade_decisions(decision_id) ON DELETE RESTRICT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (executor_wallet, fill_identity),
  UNIQUE (decision_id, fill_identity),
  CONSTRAINT inverse_opinion_fill_claim_wallet_check
    CHECK (executor_wallet ~ '^0x[a-f0-9]{40}$'),
  CONSTRAINT inverse_opinion_fill_claim_identity_check
    CHECK (length(btrim(fill_identity)) BETWEEN 1 AND 96)
);

CREATE INDEX IF NOT EXISTS inverse_opinion_trade_decisions_claim_expiry_idx
  ON alfaclub.inverse_opinion_trade_decisions (execution_claim_expires_at)
  WHERE execution_phase = 'claimed';

CREATE INDEX IF NOT EXISTS inverse_opinion_trade_decisions_recovery_idx
  ON alfaclub.inverse_opinion_trade_decisions (recovery_deadline_at)
  WHERE execution_phase = 'unknown';

CREATE OR REPLACE FUNCTION alfaclub.enforce_inverse_opinion_decision_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.source_message_id <> OLD.source_message_id
    OR NEW.intent_ordinal <> OLD.intent_ordinal
    OR NEW.normalized_market <> OLD.normalized_market
    OR NEW.source_side <> OLD.source_side
    OR NEW.inverse_side <> OLD.inverse_side THEN
    RAISE EXCEPTION 'inverse opinion decision identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.execution_phase = OLD.execution_phase THEN
    IF NEW.terminal_outcome IS DISTINCT FROM OLD.terminal_outcome
      OR NEW.execution_phase = 'submitted' THEN
      RAISE EXCEPTION 'illegal same-phase inverse opinion decision update'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.execution_phase = 'observed' AND NEW.execution_phase = 'claimed' AND NEW.terminal_outcome IS NULL)
    OR (OLD.execution_phase = 'claimed' AND NEW.execution_phase = 'submitted' AND NEW.terminal_outcome IS NULL)
    OR (
      OLD.execution_phase = 'claimed'
      AND NEW.execution_phase = 'resolved'
      AND NEW.terminal_outcome IN ('rejected', 'blocked')
    )
    OR (
      OLD.execution_phase = 'submitted'
      AND NEW.execution_phase = 'resolved'
      AND NEW.terminal_outcome IN ('executed', 'failed')
    )
    OR (OLD.execution_phase = 'submitted' AND NEW.execution_phase = 'unknown' AND NEW.terminal_outcome IS NULL)
    OR (
      OLD.execution_phase = 'unknown'
      AND NEW.execution_phase = 'resolved'
      AND NEW.terminal_outcome IN ('executed', 'failed', 'incomplete')
    )
  ) THEN
    RAISE EXCEPTION 'illegal inverse opinion decision transition'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION alfaclub.enforce_inverse_position_lifecycle_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.executor_wallet <> OLD.executor_wallet
    OR NEW.normalized_market <> OLD.normalized_market
    OR NEW.side <> OLD.side
    OR NEW.opening_decision_id <> OLD.opening_decision_id THEN
    RAISE EXCEPTION 'inverse position lifecycle identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.reconciliation_generation <= OLD.reconciliation_generation THEN
    RAISE EXCEPTION 'inverse position reconciliation generation must increment'
      USING ERRCODE = '23514';
  END IF;

  IF (OLD.attribution_quality = 'complete' AND NEW.attribution_quality <> 'complete')
    OR (OLD.attribution_quality = 'partial' AND NEW.attribution_quality = 'unknown') THEN
    RAISE EXCEPTION 'inverse position attribution quality cannot decrease'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.lifecycle_state = OLD.lifecycle_state THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.lifecycle_state = 'pending' AND NEW.lifecycle_state IN ('partial', 'open', 'incomplete'))
    OR (OLD.lifecycle_state = 'partial' AND NEW.lifecycle_state IN ('open', 'ambiguous', 'incomplete'))
    OR (OLD.lifecycle_state = 'open' AND NEW.lifecycle_state = 'closed')
    OR (OLD.lifecycle_state = 'ambiguous' AND NEW.lifecycle_state = 'incomplete')
  ) THEN
    RAISE EXCEPTION 'illegal inverse position lifecycle transition'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE alfaclub.inverse_opinion_fill_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE alfaclub.inverse_opinion_fill_claims FROM anon, authenticated;
GRANT ALL ON TABLE alfaclub.inverse_opinion_fill_claims TO service_role;
