-- Migration: codify KPR runtime tables and agent_rate_limits in the migration pipeline.
--
-- Addresses audit findings:
--   - M-31 (4626-340): KPR Tables Created at Runtime by Application Code
--   - M-32 (4626-341): `agent_rate_limits` Table Created Outside Migration Pipeline
--   - L-11 (4626-359): duplicate tracker for M-31 (see acceptance doc)
--
-- Previously these tables were created by
--   - `frontend/server/_lib/kpr/runtimeSchema.ts`
--   - `frontend/server/_lib/infra/durableRateLimit.ts`
-- at application boot via `CREATE TABLE IF NOT EXISTS ...`. Application-
-- time DDL is invisible to migration tooling, can drift across
-- environments, and will not be rebuilt if the database is recreated
-- from migrations. Move the schema into the migration pipeline and
-- leave the runtime helpers as safe no-ops (a follow-up commit
-- removes the runtime DDL calls entirely).
--
-- Design notes:
--   * All columns and names match the runtime helpers exactly so this
--     migration is a no-op on any environment where the runtime DDL has
--     already run. `IF NOT EXISTS` guards each statement.
--   * Indexes on (`kpr_runtime_records`, `kpr_runtime_decisions`,
--     `kpr_runtime_replay_nonces`) are preserved verbatim.
--   * RLS is enabled with deny-all policies; the backend connects as
--     the service role which bypasses RLS, matching how these tables
--     are currently used (no direct client access).

BEGIN;

-- ---------------------------------------------------------------------
-- KPR runtime tables (M-31, L-11)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kpr_runtime_records (
  id BIGSERIAL PRIMARY KEY,
  workflow TEXT NOT NULL,
  kind TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'kpr',
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workflow, kind, idempotency_key)
);

CREATE INDEX IF NOT EXISTS kpr_runtime_records_kind_created_idx
  ON kpr_runtime_records (kind, created_at DESC);

CREATE TABLE IF NOT EXISTS kpr_runtime_decisions (
  id BIGSERIAL PRIMARY KEY,
  workflow TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  decision_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'stored',
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workflow, idempotency_key)
);

CREATE INDEX IF NOT EXISTS kpr_runtime_decisions_created_idx
  ON kpr_runtime_decisions (created_at DESC);

CREATE TABLE IF NOT EXISTS kpr_runtime_replay_nonces (
  nonce TEXT PRIMARY KEY,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS kpr_runtime_replay_expires_idx
  ON kpr_runtime_replay_nonces (expires_at);

ALTER TABLE kpr_runtime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpr_runtime_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpr_runtime_replay_nonces ENABLE ROW LEVEL SECURITY;

-- Deny-all baseline: only the service role (which bypasses RLS) can
-- access these tables. Any future read/write policies must replace
-- these in the same migration that adds them.
DROP POLICY IF EXISTS kpr_runtime_records_deny_all ON kpr_runtime_records;
CREATE POLICY kpr_runtime_records_deny_all ON kpr_runtime_records
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS kpr_runtime_decisions_deny_all ON kpr_runtime_decisions;
CREATE POLICY kpr_runtime_decisions_deny_all ON kpr_runtime_decisions
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS kpr_runtime_replay_nonces_deny_all ON kpr_runtime_replay_nonces;
CREATE POLICY kpr_runtime_replay_nonces_deny_all ON kpr_runtime_replay_nonces
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------
-- agent_rate_limits (M-32)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_rate_limits (
  key TEXT NOT NULL,
  window_id BIGINT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key, window_id)
);

ALTER TABLE agent_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_rate_limits_deny_all ON agent_rate_limits;
CREATE POLICY agent_rate_limits_deny_all ON agent_rate_limits
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

COMMIT;
