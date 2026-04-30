CREATE TABLE IF NOT EXISTS public.chat_directory_profiles (
  canonical_wallet TEXT PRIMARY KEY,
  xmtp_address TEXT NULL,
  xmtp_inbox_id TEXT NULL,
  display_name TEXT NULL,
  avatar_url TEXT NULL,
  ethos_profile_id BIGINT NULL,
  ethos_userkey TEXT NULL,
  ethos_score NUMERIC NULL,
  ethos_level TEXT NULL,
  ethos_score_updated_at TIMESTAMPTZ NULL,
  last_seen_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_directory_profiles_score_idx
  ON public.chat_directory_profiles (ethos_score DESC NULLS LAST, last_seen_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.chat_presence_sessions (
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
  ON public.chat_presence_sessions (privacy_visible, available_until DESC, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS chat_presence_sessions_wallet_idx
  ON public.chat_presence_sessions (canonical_wallet, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.vault_chat_policies (
  vault_address TEXT PRIMARY KEY,
  group_id TEXT NULL,
  creator_address TEXT NULL,
  share_token_address TEXT NULL,
  min_holding_raw NUMERIC(78, 0) NOT NULL DEFAULT 0,
  grace_hours INTEGER NOT NULL DEFAULT 24,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NULL,
  updated_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vault_chat_policies_enabled_idx
  ON public.vault_chat_policies (enabled, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.vault_chat_memberships (
  vault_address TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  profile_id BIGINT NULL,
  xmtp_inbox_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  balance_raw NUMERIC(78, 0) NULL,
  last_checked_at TIMESTAMPTZ NULL,
  last_eligible_at TIMESTAMPTZ NULL,
  grace_started_at TIMESTAMPTZ NULL,
  add_action_id BIGINT NULL,
  remove_action_id BIGINT NULL,
  failure_reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vault_address, wallet_address)
);

CREATE INDEX IF NOT EXISTS vault_chat_memberships_status_idx
  ON public.vault_chat_memberships (vault_address, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS vault_chat_memberships_recheck_idx
  ON public.vault_chat_memberships (status, last_checked_at NULLS FIRST);

ALTER TABLE public.chat_directory_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_presence_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_chat_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_chat_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_public_rest" ON public.chat_directory_profiles;
CREATE POLICY "deny_public_rest"
  ON public.chat_directory_profiles
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_public_rest" ON public.chat_presence_sessions;
CREATE POLICY "deny_public_rest"
  ON public.chat_presence_sessions
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_public_rest" ON public.vault_chat_policies;
CREATE POLICY "deny_public_rest"
  ON public.vault_chat_policies
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_public_rest" ON public.vault_chat_memberships;
CREATE POLICY "deny_public_rest"
  ON public.vault_chat_memberships
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);
