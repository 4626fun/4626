-- Auth nonce, agent nonce, and handoff tables.
-- Extracted from duplicated runtime bootstrap in frontend/server/auth/_shared.ts,
-- frontend/server/auth/_siwa.ts, and frontend/server/auth/_handoff.ts.
--
-- These are small, high-churn ephemeral tables used for one-time tokens,
-- SIWA receipts, and cross-context handoff codes. They are safe to
-- bootstrap at cold start in dev/Railway/agent contexts.

CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce TEXT PRIMARY KEY,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS auth_nonces_expires_idx ON auth_nonces (expires_at);

COMMENT ON TABLE auth_nonces IS 'Ephemeral nonces for general auth flows (short-lived).';

-- Agent/SIWA nonces (tied to agent registry entries).
CREATE TABLE IF NOT EXISTS auth_agent_nonces (
  nonce TEXT PRIMARY KEY,
  agent_id BIGINT NOT NULL,
  agent_registry TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_by_address TEXT
);

CREATE INDEX IF NOT EXISTS auth_agent_nonces_expires_idx ON auth_agent_nonces (expires_at);
CREATE INDEX IF NOT EXISTS auth_agent_nonces_agent_idx ON auth_agent_nonces (agent_id, agent_registry);

-- RLS: service-role only writes; reads are internal.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'auth_agent_nonces'
      AND policyname = 'deny_public_rest'
  ) THEN
    ALTER TABLE auth_agent_nonces ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "deny_public_rest" ON auth_agent_nonces
      AS RESTRICTIVE FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END
$$;

COMMENT ON TABLE auth_agent_nonces IS 'Nonces for SIWA / agent-signed receipt flows.';

-- Cross-context handoff codes (email OTP → wallet context, etc.).
CREATE TABLE IF NOT EXISTS auth_handoffs (
  code_hash TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  privy_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

-- No index on expires_at: table is tiny and purged by cron; seq scan is cheaper.

-- Backfill column (safe if migration re-applied).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_handoffs' AND column_name = 'privy_token'
  ) THEN
    ALTER TABLE auth_handoffs ADD COLUMN privy_token TEXT;
  END IF;
END
$$;

COMMENT ON TABLE auth_handoffs IS 'Single-use handoff codes bridging auth contexts (e.g. OTP → wallet).';
