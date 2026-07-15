-- Claim-before-send dispatch authority for the room-1659 InverseAKITA trade journal.

CREATE TABLE IF NOT EXISTS alfaclub.inverse_opinion_trade_journal_dispatch (
  dispatch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  reporting_window_start TIMESTAMPTZ NOT NULL,
  reporting_window_end TIMESTAMPTZ NOT NULL,
  dispatch_state TEXT NOT NULL DEFAULT 'claimed',
  claimant_token UUID NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  client_message_id VARCHAR(160) NOT NULL,
  parent_message_id TEXT,
  content_hash TEXT,
  analysis_revision INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  last_error_code VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, reporting_window_start, reporting_window_end),
  UNIQUE (client_message_id),
  CONSTRAINT inverse_journal_dispatch_room_check CHECK (room_id = '1659'),
  CONSTRAINT inverse_journal_dispatch_window_check
    CHECK (reporting_window_start < reporting_window_end),
  CONSTRAINT inverse_journal_dispatch_window_length_check
    CHECK (reporting_window_end - reporting_window_start = INTERVAL '24 hours'),
  CONSTRAINT inverse_journal_dispatch_state_check
    CHECK (dispatch_state IN ('claimed', 'sending', 'sent', 'failed', 'send_unknown')),
  CONSTRAINT inverse_journal_dispatch_attempt_check CHECK (attempt_count > 0),
  CONSTRAINT inverse_journal_dispatch_revision_check CHECK (analysis_revision >= 0),
  CONSTRAINT inverse_journal_dispatch_content_hash_check
    CHECK (content_hash IS NULL OR content_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT inverse_journal_dispatch_sent_check
    CHECK (
      (dispatch_state = 'sent' AND parent_message_id IS NOT NULL AND sent_at IS NOT NULL)
      OR dispatch_state <> 'sent'
    )
);

CREATE TABLE IF NOT EXISTS alfaclub.inverse_opinion_trade_journal_revision_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL
    REFERENCES alfaclub.inverse_opinion_trade_journal_dispatch(dispatch_id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL,
  operator_address TEXT NOT NULL,
  audit_state TEXT NOT NULL DEFAULT 'requested',
  reply_message_id TEXT,
  content_hash TEXT,
  client_message_id VARCHAR(160) NOT NULL,
  journal_marker VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dispatch_id, revision),
  UNIQUE (client_message_id),
  CONSTRAINT inverse_journal_revision_number_check CHECK (revision > 0),
  CONSTRAINT inverse_journal_revision_operator_check
    CHECK (operator_address ~ '^0x[a-f0-9]{40}$'),
  CONSTRAINT inverse_journal_revision_state_check
    CHECK (audit_state IN ('requested', 'sent', 'failed', 'send_unknown')),
  CONSTRAINT inverse_journal_revision_sent_check
    CHECK (
      (audit_state = 'sent' AND reply_message_id IS NOT NULL AND content_hash IS NOT NULL)
      OR audit_state <> 'sent'
    ),
  CONSTRAINT inverse_journal_revision_hash_check
    CHECK (content_hash IS NULL OR content_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT inverse_journal_revision_marker_check
    CHECK (journal_marker = 'inverse-akita-trade-journal:v1')
);

CREATE INDEX IF NOT EXISTS inverse_journal_dispatch_state_lease_idx
  ON alfaclub.inverse_opinion_trade_journal_dispatch (dispatch_state, lease_expires_at);

ALTER TABLE alfaclub.inverse_opinion_trade_journal_dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE alfaclub.inverse_opinion_trade_journal_revision_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE alfaclub.inverse_opinion_trade_journal_dispatch FROM anon, authenticated;
REVOKE ALL ON TABLE alfaclub.inverse_opinion_trade_journal_revision_audit FROM anon, authenticated;
GRANT USAGE ON SCHEMA alfaclub TO service_role;
GRANT ALL ON TABLE alfaclub.inverse_opinion_trade_journal_dispatch TO service_role;
GRANT ALL ON TABLE alfaclub.inverse_opinion_trade_journal_revision_audit TO service_role;

COMMENT ON TABLE alfaclub.inverse_opinion_trade_journal_dispatch IS
  'One claim-before-send journal parent for each fixed room-1659 24-hour reporting window.';
COMMENT ON TABLE alfaclub.inverse_opinion_trade_journal_revision_audit IS
  'Admin and machine-authorized analysis revisions appended beneath an existing journal parent.';
