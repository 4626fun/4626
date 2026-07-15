-- Durable terminal reply outbox for InverseAKITA opinion-trade decisions.
-- Source room/message/timestamp remain reachable through the decision FK.

CREATE TABLE IF NOT EXISTS alfaclub.inverse_opinion_reply_deliveries (
  decision_id UUID NOT NULL
    REFERENCES alfaclub.inverse_opinion_trade_decisions(decision_id) ON DELETE RESTRICT,
  delivery_kind TEXT NOT NULL,
  public_text VARCHAR(2000) NOT NULL,
  client_message_id VARCHAR(160) NOT NULL,
  delivery_state TEXT NOT NULL DEFAULT 'pending',
  message_id VARCHAR(256),
  claimant_token UUID,
  lease_expires_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error_code VARCHAR(128),
  send_started_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (decision_id, delivery_kind),
  UNIQUE (client_message_id),
  CONSTRAINT inverse_opinion_reply_delivery_kind_check
    CHECK (delivery_kind IN ('result', 'receipt')),
  CONSTRAINT inverse_opinion_reply_delivery_text_check
    CHECK (length(btrim(public_text)) BETWEEN 1 AND 2000),
  CONSTRAINT inverse_opinion_reply_delivery_client_id_check
    CHECK (length(btrim(client_message_id)) BETWEEN 1 AND 160),
  CONSTRAINT inverse_opinion_reply_delivery_state_check
    CHECK (delivery_state IN ('pending', 'sending', 'sent', 'failed', 'send_unknown')),
  CONSTRAINT inverse_opinion_reply_delivery_attempt_check
    CHECK (attempt_count BETWEEN 0 AND 100),
  CONSTRAINT inverse_opinion_reply_delivery_lease_check
    CHECK (
      (delivery_state = 'sending' AND claimant_token IS NOT NULL AND lease_expires_at IS NOT NULL)
      OR delivery_state <> 'sending'
    ),
  CONSTRAINT inverse_opinion_reply_delivery_sent_check
    CHECK (
      (delivery_state = 'sent' AND message_id IS NOT NULL AND sent_at IS NOT NULL)
      OR delivery_state <> 'sent'
    )
);

CREATE INDEX IF NOT EXISTS inverse_opinion_reply_delivery_recovery_idx
  ON alfaclub.inverse_opinion_reply_deliveries (
    delivery_state,
    lease_expires_at,
    updated_at,
    decision_id
  )
  WHERE delivery_state IN ('pending', 'sending', 'failed');

CREATE OR REPLACE FUNCTION alfaclub.enforce_inverse_opinion_reply_delivery_payload()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.decision_id IS DISTINCT FROM NEW.decision_id
    OR OLD.delivery_kind IS DISTINCT FROM NEW.delivery_kind
    OR OLD.public_text IS DISTINCT FROM NEW.public_text
    OR OLD.client_message_id IS DISTINCT FROM NEW.client_message_id
  THEN
    RAISE EXCEPTION 'inverse opinion terminal reply payload is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inverse_opinion_reply_delivery_payload_guard
  ON alfaclub.inverse_opinion_reply_deliveries;
CREATE TRIGGER inverse_opinion_reply_delivery_payload_guard
  BEFORE UPDATE ON alfaclub.inverse_opinion_reply_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION alfaclub.enforce_inverse_opinion_reply_delivery_payload();

ALTER TABLE alfaclub.inverse_opinion_reply_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE alfaclub.inverse_opinion_reply_deliveries FROM PUBLIC;
REVOKE ALL ON TABLE alfaclub.inverse_opinion_reply_deliveries FROM anon;
REVOKE ALL ON TABLE alfaclub.inverse_opinion_reply_deliveries FROM authenticated;
GRANT USAGE ON SCHEMA alfaclub TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE alfaclub.inverse_opinion_reply_deliveries TO service_role;
