-- Durable parent/reply delivery progress and audited unknown-send resolution.

CREATE TABLE IF NOT EXISTS alfaclub.inverse_opinion_trade_journal_deliveries (
  delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL
    REFERENCES alfaclub.inverse_opinion_trade_journal_dispatch(dispatch_id) ON DELETE RESTRICT,
  delivery_kind TEXT NOT NULL,
  delivery_ordinal INTEGER NOT NULL,
  delivery_state TEXT NOT NULL DEFAULT 'pending',
  client_message_id VARCHAR(160) NOT NULL,
  content_hash TEXT NOT NULL,
  message_id TEXT,
  last_error_code VARCHAR(128),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dispatch_id, delivery_kind, delivery_ordinal),
  UNIQUE (client_message_id),
  CONSTRAINT inverse_journal_delivery_kind_check
    CHECK (delivery_kind IN ('parent', 'reply')),
  CONSTRAINT inverse_journal_delivery_ordinal_check
    CHECK (
      (delivery_kind = 'parent' AND delivery_ordinal = 0)
      OR (delivery_kind = 'reply' AND delivery_ordinal >= 0)
    ),
  CONSTRAINT inverse_journal_delivery_state_check
    CHECK (delivery_state IN ('pending', 'sending', 'sent', 'failed', 'send_unknown')),
  CONSTRAINT inverse_journal_delivery_hash_check
    CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT inverse_journal_delivery_sent_check
    CHECK (
      (delivery_state = 'sent' AND message_id IS NOT NULL AND sent_at IS NOT NULL)
      OR delivery_state <> 'sent'
    )
);

CREATE TABLE IF NOT EXISTS alfaclub.inverse_opinion_trade_journal_resolution_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL
    REFERENCES alfaclub.inverse_opinion_trade_journal_dispatch(dispatch_id) ON DELETE RESTRICT,
  operator_address TEXT NOT NULL,
  resolution TEXT NOT NULL,
  delivery_kind TEXT NOT NULL,
  delivery_ordinal INTEGER NOT NULL,
  known_message_id TEXT,
  operator_note VARCHAR(500) NOT NULL,
  prior_state TEXT NOT NULL,
  resulting_state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inverse_journal_resolution_operator_check
    CHECK (operator_address ~ '^0x[a-f0-9]{40}$'),
  CONSTRAINT inverse_journal_resolution_kind_check
    CHECK (resolution IN ('mark_sent', 'mark_failed')),
  CONSTRAINT inverse_journal_resolution_delivery_check
    CHECK (
      delivery_kind IN ('parent', 'reply')
      AND delivery_ordinal >= 0
      AND (delivery_kind <> 'parent' OR delivery_ordinal = 0)
      AND (
        (resolution = 'mark_sent' AND known_message_id IS NOT NULL)
        OR (resolution = 'mark_failed' AND known_message_id IS NULL)
      )
    ),
  CONSTRAINT inverse_journal_resolution_state_check
    CHECK (prior_state = 'send_unknown' AND resulting_state = 'failed'),
  CONSTRAINT inverse_journal_resolution_note_check
    CHECK (length(btrim(operator_note)) BETWEEN 8 AND 500)
);

CREATE INDEX IF NOT EXISTS inverse_journal_deliveries_dispatch_state_idx
  ON alfaclub.inverse_opinion_trade_journal_deliveries (dispatch_id, delivery_state);

ALTER TABLE alfaclub.inverse_opinion_trade_journal_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE alfaclub.inverse_opinion_trade_journal_resolution_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE alfaclub.inverse_opinion_trade_journal_deliveries FROM anon, authenticated;
REVOKE ALL ON TABLE alfaclub.inverse_opinion_trade_journal_resolution_audit FROM anon, authenticated;
GRANT ALL ON TABLE alfaclub.inverse_opinion_trade_journal_deliveries TO service_role;
GRANT ALL ON TABLE alfaclub.inverse_opinion_trade_journal_resolution_audit TO service_role;
