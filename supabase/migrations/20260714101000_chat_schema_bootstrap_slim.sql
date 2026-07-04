-- Slim runtime bootstrap for chat tables still in use.
-- Replaces vault_chat_* and chat_directory_profiles sections of
-- 20260531000000_chat_schema.sql (wallet_directory is managed separately).

CREATE TABLE IF NOT EXISTS chat_presence_sessions (
  session_id_hash TEXT PRIMARY KEY,
  profile_id BIGINT NULL,
  canonical_wallet TEXT NOT NULL,
  xmtp_address TEXT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  privacy_visible BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  available_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 minutes'),
  user_agent_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_presence_sessions_visible_idx
  ON chat_presence_sessions (privacy_visible, available_until DESC, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS chat_presence_sessions_wallet_idx
  ON chat_presence_sessions (canonical_wallet, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS chat_friend_requests (
  requester_wallet TEXT NOT NULL,
  addressee_wallet TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (requester_wallet, addressee_wallet),
  CONSTRAINT chat_friend_requests_non_self CHECK (requester_wallet <> addressee_wallet)
);

CREATE INDEX IF NOT EXISTS chat_friend_requests_addressee_status_idx
  ON chat_friend_requests (addressee_wallet, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS chat_friend_requests_requester_status_idx
  ON chat_friend_requests (requester_wallet, status, updated_at DESC);

COMMENT ON TABLE chat_presence_sessions IS 'Real-time presence / availability for chat users.';
COMMENT ON TABLE chat_friend_requests IS 'Friend request workflow between wallets.';
