-- Telemetry / event logging tables + creative tool storage (Hermit, Zora trends).
-- Extracted from duplicated runtime bootstrap in:
--   frontend/server/_lib/messaging/chatCommandCenterTelemetry.ts
--   frontend/server/_lib/messaging/telegramLinkTelemetry.ts
--   frontend/server/_lib/messaging/creatorXmtpAgents.ts
--   frontend/server/_lib/hermit/repository.ts
--   frontend/server/_lib/zora/zoraTrendOpsStore.ts

CREATE TABLE IF NOT EXISTS chat_command_center_events (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  conversation_id TEXT NULL,
  conversation_type TEXT NULL,
  command_id TEXT NULL,
  source TEXT NULL,
  payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS best-effort
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_command_center_events'
      AND policyname = 'chat_command_center_events_deny_all'
  ) THEN
    ALTER TABLE chat_command_center_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY chat_command_center_events_deny_all
      ON chat_command_center_events
      FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS chat_command_center_events_created_idx
  ON chat_command_center_events (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_command_center_events_event_idx
  ON chat_command_center_events (event, created_at DESC);

COMMENT ON TABLE chat_command_center_events IS 'Audit/telemetry for chat command center (XMTP/Telegram command surface).';

CREATE TABLE IF NOT EXISTS telegram_link_telemetry_events (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  source TEXT NULL,
  flow_id TEXT NULL,
  phase TEXT NULL,
  status TEXT NULL,
  telegram_user_id TEXT NULL,
  privy_user_id TEXT NULL,
  chat_id TEXT NULL,
  payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'telegram_link_telemetry_events'
      AND policyname = 'telegram_link_telemetry_events_deny_all'
  ) THEN
    ALTER TABLE telegram_link_telemetry_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY telegram_link_telemetry_events_deny_all
      ON telegram_link_telemetry_events
      FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS telegram_link_telemetry_events_created_idx
  ON telegram_link_telemetry_events (created_at DESC);

COMMENT ON TABLE telegram_link_telemetry_events IS 'Telemetry for Telegram Mini App linking / onboarding flows.';

CREATE TABLE IF NOT EXISTS creator_xmtp_agents (
  creator_address TEXT PRIMARY KEY,
  xmtp_agent_address TEXT NOT NULL,
  encrypted_private_key_b64 TEXT NOT NULL,
  encrypted_private_key_iv_b64 TEXT NOT NULL,
  encrypted_private_key_tag_b64 TEXT NOT NULL,
  listed_publicly BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  agent_type TEXT NOT NULL DEFAULT 'eoa',
  privy_wallet_id TEXT,
  csw_address TEXT,
  last_processed_message_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS creator_xmtp_agents_listed_idx
  ON creator_xmtp_agents (listed_publicly, created_at DESC);
CREATE INDEX IF NOT EXISTS creator_xmtp_agents_updated_idx
  ON creator_xmtp_agents (updated_at DESC);

COMMENT ON TABLE creator_xmtp_agents IS 'Per-creator XMTP agent key material and metadata (for delegated chat agents).';

CREATE TABLE IF NOT EXISTS hermit_memes (
  id BIGSERIAL PRIMARY KEY,
  owner_address TEXT NOT NULL,
  room_id TEXT NOT NULL,
  cid TEXT,
  url TEXT NOT NULL,
  caption TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS hermit_memes_room_created_idx
  ON hermit_memes (room_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS hermit_memes_owner_created_idx
  ON hermit_memes (owner_address, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE hermit_memes IS 'Hermit creative meme/image storage (AlfaClub + public rooms).';

CREATE TABLE IF NOT EXISTS zora_trend_ops (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  ticker_hash TEXT NOT NULL UNIQUE,
  predicted_coin_address TEXT NOT NULL,
  deployed_coin_address TEXT NULL,
  tx_hash TEXT NULL,
  actor_wallet TEXT NULL,
  group_id TEXT NULL,
  vault_address TEXT NULL,
  status TEXT NOT NULL DEFAULT 'predicted',
  last_error TEXT NULL,
  funnel_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  routeability JSONB NOT NULL DEFAULT '{}'::jsonb,
  funnel_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('predicted', 'deploying', 'deployed', 'funnel_pending', 'funnel_completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS zora_trend_ops_status_idx
  ON zora_trend_ops (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS zora_trend_ops_ticker_idx
  ON zora_trend_ops (ticker, created_at DESC);

COMMENT ON TABLE zora_trend_ops IS 'Zora trend / content coin prediction + deployment funnel tracking.';
