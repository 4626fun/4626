-- Audited, operator-confirmed resolution for terminal reply sends whose
-- external outcome is unknown. Resolution never performs an outbound send.

CREATE TABLE alfaclub.inverse_opinion_reply_delivery_resolution_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL,
  delivery_kind TEXT NOT NULL,
  operator_address TEXT NOT NULL,
  resolution TEXT NOT NULL,
  known_message_id VARCHAR(256),
  operator_note VARCHAR(500) NOT NULL,
  prior_state TEXT NOT NULL,
  resulting_state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inverse_opinion_reply_resolution_delivery_fk
    FOREIGN KEY (decision_id, delivery_kind)
    REFERENCES alfaclub.inverse_opinion_reply_deliveries(decision_id, delivery_kind)
    ON DELETE RESTRICT,
  CONSTRAINT inverse_opinion_reply_resolution_operator_check
    CHECK (operator_address ~ '^0x[a-f0-9]{40}$'),
  CONSTRAINT inverse_opinion_reply_resolution_kind_check
    CHECK (delivery_kind IN ('result', 'receipt')),
  CONSTRAINT inverse_opinion_reply_resolution_action_check
    CHECK (resolution IN ('mark_sent', 'mark_failed')),
  CONSTRAINT inverse_opinion_reply_resolution_state_check
    CHECK (
      prior_state = 'send_unknown'
      AND resulting_state IN ('sent', 'failed')
      AND (
        (resolution = 'mark_sent' AND resulting_state = 'sent' AND known_message_id IS NOT NULL)
        OR
        (resolution = 'mark_failed' AND resulting_state = 'failed' AND known_message_id IS NULL)
      )
    ),
  CONSTRAINT inverse_opinion_reply_resolution_note_check
    CHECK (length(btrim(operator_note)) BETWEEN 8 AND 500)
);

ALTER TABLE alfaclub.inverse_opinion_reply_delivery_resolution_audit
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL
  ON TABLE alfaclub.inverse_opinion_reply_delivery_resolution_audit
  FROM PUBLIC;
REVOKE ALL
  ON TABLE alfaclub.inverse_opinion_reply_delivery_resolution_audit
  FROM anon;
REVOKE ALL
  ON TABLE alfaclub.inverse_opinion_reply_delivery_resolution_audit
  FROM authenticated;
GRANT SELECT, INSERT
  ON TABLE alfaclub.inverse_opinion_reply_delivery_resolution_audit
  TO service_role;
