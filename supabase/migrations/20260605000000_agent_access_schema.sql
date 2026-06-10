-- Agent access nonces and room access tokens.
-- Extracted from duplicated runtime bootstrap in frontend/server/_lib/agent/agentAccessProof.ts.

CREATE TABLE IF NOT EXISTS agent_access_nonces (
  nonce TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  share_token TEXT NOT NULL,
  room_key TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_access_nonces_wallet_expires_idx ON agent_access_nonces (wallet_address, expires_at);

CREATE TABLE IF NOT EXISTS agent_room_access_tokens (
  jti TEXT PRIMARY KEY,
  sub TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  share_token TEXT NOT NULL,
  room_key TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_room_access_tokens_sub_idx ON agent_room_access_tokens (sub, expires_at);

COMMENT ON TABLE agent_access_nonces IS 'Short-lived nonces for agent room access proof.';
COMMENT ON TABLE agent_room_access_tokens IS 'JWT-style room access tokens for agents.';