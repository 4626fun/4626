-- Telegram trading, linking, funnel, and holder-room schema.
-- Extracted from duplicated runtime bootstrap in frontend/server/_lib/messaging/telegramTrading.ts
-- and legacy frontend/db mirrors.
--
-- These tables support Telegram Mini App linking, action tokens, funnels,
-- holder room gating, and trade prompts.

CREATE TABLE IF NOT EXISTS telegram_user_links (
  telegram_user_id BIGINT PRIMARY KEY,
  telegram_username TEXT NULL,
  profile_id BIGINT NOT NULL,
  privy_user_id TEXT NOT NULL,
  canonical_csw_address TEXT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_user_links_profile_idx ON telegram_user_links(profile_id);
CREATE INDEX IF NOT EXISTS telegram_user_links_privy_idx ON telegram_user_links(privy_user_id);

CREATE TABLE IF NOT EXISTS telegram_action_tokens (
  token_hash TEXT PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL,
  chat_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  intent_payload_json JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_action_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  chat_id TEXT NOT NULL,
  message_id BIGINT NULL,
  profile_id BIGINT NOT NULL,
  action_type TEXT NOT NULL,
  intent_payload_json JSONB NOT NULL,
  correlation_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_action_audit_user_chat_idx ON telegram_action_audit(telegram_user_id, chat_id, created_at DESC);

CREATE TABLE IF NOT EXISTS telegram_funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NULL,
  chat_id TEXT NULL,
  event_name TEXT NOT NULL,
  action_type TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_funnel_events_chat_event_idx ON telegram_funnel_events(chat_id, event_name, created_at DESC);

CREATE TABLE IF NOT EXISTS telegram_miniapp_replay_nonces (
  init_data_hash TEXT PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL,
  auth_date INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_miniapp_sessions (
  token_hash TEXT PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL,
  telegram_username TEXT NULL,
  chat_id TEXT NULL,
  chat_type TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_link_start_token_claims (
  token_hash TEXT PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL,
  chat_id TEXT NOT NULL,
  privy_user_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_chat_vault_scope (
  chat_id TEXT PRIMARY KEY,
  allowed_vault_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  buy_sell_enabled BOOLEAN NOT NULL DEFAULT true,
  bid_enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS telegram_holder_room_policies (
  chat_id TEXT NOT NULL,
  vault_address TEXT NOT NULL,
  room_chat_id TEXT NOT NULL,
  min_shares_raw TEXT NOT NULL,
  grace_hours INTEGER NOT NULL DEFAULT 24,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, vault_address)
);

CREATE TABLE IF NOT EXISTS telegram_holder_room_members (
  room_chat_id TEXT NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  canonical_csw_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_eligible_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_chat_id, telegram_user_id)
);

CREATE INDEX IF NOT EXISTS telegram_holder_room_members_status_idx ON telegram_holder_room_members(status, last_eligible_at);

CREATE TABLE IF NOT EXISTS telegram_trade_percent_prompts (
  chat_id TEXT NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  action_type TEXT NOT NULL,
  vault_address TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, telegram_user_id, action_type)
);

CREATE TABLE IF NOT EXISTS telegram_inline_signal_feeds (
  inline_message_id TEXT PRIMARY KEY,
  source_chat_id TEXT NOT NULL,
  owner_telegram_user_id BIGINT NOT NULL,
  paused BOOLEAN NOT NULL DEFAULT false,
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_active_messages (
  chat_id TEXT NOT NULL,
  owner_telegram_user_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, message_id)
);

CREATE TABLE IF NOT EXISTS telegram_onboarding_sessions (
  telegram_user_id BIGINT PRIMARY KEY,
  step TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_private_dm_welcome_sent (
  telegram_user_id BIGINT PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE telegram_user_links IS 'Telegram user to 4626 profile linkage (Mini App + web).';
COMMENT ON TABLE telegram_action_tokens IS 'Single-use signed action tokens for Telegram interactions.';
COMMENT ON TABLE telegram_funnel_events IS 'Funnel analytics events from Telegram surfaces.';
COMMENT ON TABLE telegram_holder_room_policies IS 'Per-chat holder room gating configuration.';
COMMENT ON TABLE telegram_trade_percent_prompts IS 'Active trade percent prompt sessions per user per vault.';