-- Durable source lineage and position lifecycle authority for InverseAKITA opinion trades.
-- Source text is intentionally limited to one bounded excerpt plus its SHA-256 hash.

CREATE SCHEMA IF NOT EXISTS alfaclub;

CREATE TABLE IF NOT EXISTS alfaclub.inverse_opinion_source_messages (
  source_message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  source_excerpt VARCHAR(500) NOT NULL,
  sender_address TEXT,
  public_author_label VARCHAR(120),
  source_timestamp TIMESTAMPTZ NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, message_id),
  CONSTRAINT inverse_opinion_source_room_check
    CHECK (length(btrim(room_id)) BETWEEN 1 AND 128),
  CONSTRAINT inverse_opinion_source_message_check
    CHECK (length(btrim(message_id)) BETWEEN 1 AND 256),
  CONSTRAINT inverse_opinion_source_hash_check
    CHECK (source_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT inverse_opinion_source_excerpt_check
    CHECK (length(source_excerpt) BETWEEN 1 AND 500),
  CONSTRAINT inverse_opinion_source_sender_check
    CHECK (sender_address IS NULL OR sender_address ~ '^0x[a-f0-9]{40}$')
);

CREATE TABLE IF NOT EXISTS alfaclub.inverse_opinion_trade_decisions (
  decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_message_id UUID NOT NULL
    REFERENCES alfaclub.inverse_opinion_source_messages(source_message_id) ON DELETE RESTRICT,
  intent_ordinal INTEGER NOT NULL,
  normalized_market TEXT NOT NULL,
  source_side TEXT NOT NULL,
  inverse_side TEXT NOT NULL,
  execution_phase TEXT NOT NULL DEFAULT 'claimed',
  terminal_outcome TEXT,
  reason_code VARCHAR(128),
  executor_wallet TEXT,
  requested_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  attribution_quality TEXT NOT NULL DEFAULT 'unknown',
  observed_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_message_id, intent_ordinal, normalized_market),
  CONSTRAINT inverse_opinion_decision_ordinal_check
    CHECK (intent_ordinal BETWEEN 0 AND 31),
  CONSTRAINT inverse_opinion_decision_market_check
    CHECK (normalized_market ~ '^[A-Z0-9][A-Z0-9._-]{0,31}$'),
  CONSTRAINT inverse_opinion_decision_source_side_check
    CHECK (source_side IN ('long', 'short')),
  CONSTRAINT inverse_opinion_decision_inverse_side_check
    CHECK (inverse_side IN ('long', 'short') AND inverse_side <> source_side),
  CONSTRAINT inverse_opinion_decision_phase_check
    CHECK (execution_phase IN ('observed', 'claimed', 'submitted', 'resolved', 'unknown')),
  CONSTRAINT inverse_opinion_decision_outcome_check
    CHECK (
      terminal_outcome IS NULL
      OR terminal_outcome IN ('executed', 'rejected', 'blocked', 'failed', 'incomplete')
    ),
  CONSTRAINT inverse_opinion_decision_phase_outcome_check
    CHECK (
      (execution_phase = 'resolved' AND terminal_outcome IS NOT NULL AND resolved_at IS NOT NULL)
      OR (execution_phase <> 'resolved' AND terminal_outcome IS NULL AND resolved_at IS NULL)
    ),
  CONSTRAINT inverse_opinion_decision_submitted_at_check
    CHECK (
      (execution_phase IN ('submitted', 'unknown') AND submitted_at IS NOT NULL)
      OR execution_phase NOT IN ('submitted', 'unknown')
    ),
  CONSTRAINT inverse_opinion_decision_executor_check
    CHECK (executor_wallet IS NULL OR executor_wallet ~ '^0x[a-f0-9]{40}$'),
  CONSTRAINT inverse_opinion_decision_requested_object_check
    CHECK (jsonb_typeof(requested_parameters) = 'object'),
  CONSTRAINT inverse_opinion_decision_receipt_object_check
    CHECK (jsonb_typeof(receipt_summary) = 'object'),
  CONSTRAINT inverse_opinion_decision_attribution_check
    CHECK (attribution_quality IN ('complete', 'partial', 'unknown'))
);

CREATE TABLE IF NOT EXISTS alfaclub.inverse_position_lifecycles (
  lifecycle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executor_wallet TEXT NOT NULL,
  normalized_market TEXT NOT NULL,
  side TEXT NOT NULL,
  opening_decision_id UUID NOT NULL UNIQUE
    REFERENCES alfaclub.inverse_opinion_trade_decisions(decision_id) ON DELETE RESTRICT,
  lifecycle_state TEXT NOT NULL DEFAULT 'pending',
  attribution_quality TEXT NOT NULL DEFAULT 'unknown',
  reconciliation_generation INTEGER NOT NULL DEFAULT 0,
  current_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  realized_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  last_reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inverse_position_lifecycle_executor_check
    CHECK (executor_wallet ~ '^0x[a-f0-9]{40}$'),
  CONSTRAINT inverse_position_lifecycle_market_check
    CHECK (normalized_market ~ '^[A-Z0-9][A-Z0-9._-]{0,31}$'),
  CONSTRAINT inverse_position_lifecycle_side_check
    CHECK (side IN ('long', 'short')),
  CONSTRAINT inverse_position_lifecycle_state_check
    CHECK (lifecycle_state IN ('pending', 'partial', 'open', 'closed', 'ambiguous', 'incomplete')),
  CONSTRAINT inverse_position_lifecycle_terminal_check
    CHECK (
      (lifecycle_state IN ('closed', 'incomplete') AND closed_at IS NOT NULL)
      OR (lifecycle_state NOT IN ('closed', 'incomplete') AND closed_at IS NULL)
    ),
  CONSTRAINT inverse_position_lifecycle_attribution_check
    CHECK (attribution_quality IN ('complete', 'partial', 'unknown')),
  CONSTRAINT inverse_position_lifecycle_generation_check
    CHECK (reconciliation_generation >= 0),
  CONSTRAINT inverse_position_lifecycle_snapshot_object_check
    CHECK (jsonb_typeof(current_snapshot) = 'object'),
  CONSTRAINT inverse_position_lifecycle_result_object_check
    CHECK (jsonb_typeof(realized_result) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS inverse_position_lifecycles_one_open_idx
  ON alfaclub.inverse_position_lifecycles (executor_wallet, normalized_market, side)
  WHERE closed_at IS NULL;

CREATE TABLE IF NOT EXISTS alfaclub.inverse_position_lifecycle_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_id UUID NOT NULL
    REFERENCES alfaclub.inverse_position_lifecycles(lifecycle_id) ON DELETE RESTRICT,
  decision_id UUID
    REFERENCES alfaclub.inverse_opinion_trade_decisions(decision_id) ON DELETE RESTRICT,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  evidence_layer TEXT NOT NULL,
  analysis_verdict TEXT,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lifecycle_id, event_key),
  CONSTRAINT inverse_position_event_key_check
    CHECK (length(btrim(event_key)) BETWEEN 1 AND 160),
  CONSTRAINT inverse_position_event_type_check
    CHECK (event_type IN ('open', 'add', 'trim', 'close', 'reconcile')),
  CONSTRAINT inverse_position_event_evidence_check
    CHECK (evidence_layer IN ('observed', 'derived', 'interpretation')),
  CONSTRAINT inverse_position_event_verdict_check
    CHECK (analysis_verdict IS NULL OR analysis_verdict IN ('hold', 'add', 'trim', 'exit', 'watch')),
  CONSTRAINT inverse_position_event_payload_object_check
    CHECK (jsonb_typeof(event_payload) = 'object')
);

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
    IF NEW.terminal_outcome IS DISTINCT FROM OLD.terminal_outcome THEN
      RAISE EXCEPTION 'terminal outcome cannot change without a phase transition'
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

DROP TRIGGER IF EXISTS inverse_opinion_decision_transition_guard
  ON alfaclub.inverse_opinion_trade_decisions;
CREATE TRIGGER inverse_opinion_decision_transition_guard
  BEFORE UPDATE ON alfaclub.inverse_opinion_trade_decisions
  FOR EACH ROW
  EXECUTE FUNCTION alfaclub.enforce_inverse_opinion_decision_transition();

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

  IF NEW.reconciliation_generation < OLD.reconciliation_generation THEN
    RAISE EXCEPTION 'inverse position reconciliation generation cannot decrease'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.lifecycle_state = OLD.lifecycle_state THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.lifecycle_state = 'pending' AND NEW.lifecycle_state IN ('partial', 'open'))
    OR (OLD.lifecycle_state = 'partial' AND NEW.lifecycle_state IN ('open', 'ambiguous'))
    OR (OLD.lifecycle_state = 'open' AND NEW.lifecycle_state = 'closed')
    OR (OLD.lifecycle_state = 'ambiguous' AND NEW.lifecycle_state = 'incomplete')
  ) THEN
    RAISE EXCEPTION 'illegal inverse position lifecycle transition'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inverse_position_lifecycle_transition_guard
  ON alfaclub.inverse_position_lifecycles;
CREATE TRIGGER inverse_position_lifecycle_transition_guard
  BEFORE UPDATE ON alfaclub.inverse_position_lifecycles
  FOR EACH ROW
  EXECUTE FUNCTION alfaclub.enforce_inverse_position_lifecycle_transition();

CREATE INDEX IF NOT EXISTS inverse_opinion_trade_decisions_observed_idx
  ON alfaclub.inverse_opinion_trade_decisions (observed_at DESC);
CREATE INDEX IF NOT EXISTS inverse_position_lifecycles_closed_idx
  ON alfaclub.inverse_position_lifecycles (closed_at DESC)
  WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS inverse_position_lifecycle_events_time_idx
  ON alfaclub.inverse_position_lifecycle_events (lifecycle_id, occurred_at ASC);

ALTER TABLE alfaclub.inverse_opinion_source_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE alfaclub.inverse_opinion_trade_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alfaclub.inverse_position_lifecycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alfaclub.inverse_position_lifecycle_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE alfaclub.inverse_opinion_source_messages FROM anon, authenticated;
REVOKE ALL ON TABLE alfaclub.inverse_opinion_trade_decisions FROM anon, authenticated;
REVOKE ALL ON TABLE alfaclub.inverse_position_lifecycles FROM anon, authenticated;
REVOKE ALL ON TABLE alfaclub.inverse_position_lifecycle_events FROM anon, authenticated;
GRANT USAGE ON SCHEMA alfaclub TO service_role;
GRANT ALL ON TABLE alfaclub.inverse_opinion_source_messages TO service_role;
GRANT ALL ON TABLE alfaclub.inverse_opinion_trade_decisions TO service_role;
GRANT ALL ON TABLE alfaclub.inverse_position_lifecycles TO service_role;
GRANT ALL ON TABLE alfaclub.inverse_position_lifecycle_events TO service_role;

COMMENT ON TABLE alfaclub.inverse_opinion_source_messages IS
  'Deduplicated AlfaClub source snapshots with bounded excerpt and hash; never duplicate full message text.';
COMMENT ON TABLE alfaclub.inverse_opinion_trade_decisions IS
  'Deterministic normalized opinion intents with execution phase separate from terminal outcome.';
COMMENT ON TABLE alfaclub.inverse_position_lifecycles IS
  'Cross-window position lifecycle truth keyed by executor wallet, market, and side.';
COMMENT ON TABLE alfaclub.inverse_position_lifecycle_events IS
  'Append-only decision influence and reconciliation events for a position lifecycle.';
