-- Zora CSW gate Telegram tokens and entry challenges.
-- Extracted from duplicated runtime bootstrap in frontend/server/_lib/zora/cswGateVerification.ts.

CREATE TABLE IF NOT EXISTS zora_csw_gate_telegram_tokens (
  token_hash TEXT PRIMARY KEY,
  csw_address TEXT NOT NULL,
  requested_telegram_username TEXT NULL,
  source_url TEXT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS zora_csw_gate_telegram_tokens_expires_idx ON zora_csw_gate_telegram_tokens (expires_at);

CREATE TABLE IF NOT EXISTS zora_csw_gate_entry_challenges (
  challenge_hash TEXT PRIMARY KEY,
  csw_address TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS zora_csw_gate_entry_challenges_expires_idx ON zora_csw_gate_entry_challenges (expires_at);

COMMENT ON TABLE zora_csw_gate_telegram_tokens IS 'Single-use tokens for Zora CSW gate Telegram linking.';
COMMENT ON TABLE zora_csw_gate_entry_challenges IS 'Entry challenges for Zora CSW gate.';