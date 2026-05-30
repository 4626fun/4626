-- Agent runtime leases, background task queue, API audit logs,
-- control audit events, and keepr send ledger.
-- Extracted from duplicated runtime bootstrap in:
--   - frontend/server/agents/eliza/index.ts
--   - frontend/server/agents/eliza/_taskQueue.ts
--   - frontend/server/_lib/agent/agentAudit.ts
--   - frontend/server/_lib/agentControl/audit.ts
--   - frontend/server/keepr/sendCommand.ts

-- Primary lease holder for the single Railway XMTP consumer (and standbys).
CREATE TABLE IF NOT EXISTS agent_runtime_leases (
  lease_key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  runtime_role TEXT NOT NULL,
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE agent_runtime_leases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'agent_runtime_leases'
      AND policyname = 'deny_all_non_service'
  ) THEN
    CREATE POLICY deny_all_non_service
      ON agent_runtime_leases
      FOR ALL
      TO public
      USING (false) WITH CHECK (false);
  END IF;
END
$$;

COMMENT ON TABLE agent_runtime_leases IS 'Lease/heartbeat table for the single primary Eliza/XMTP runtime (Railway).';

-- Background task queue for Eliza agent work distribution.
CREATE TABLE IF NOT EXISTS agent_background_tasks (
  id BIGSERIAL PRIMARY KEY,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  leased_at TIMESTAMPTZ,
  leased_by TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_background_tasks_pending_idx
  ON agent_background_tasks (status, priority DESC, run_after ASC, created_at ASC);

COMMENT ON TABLE agent_background_tasks IS 'Durable background task queue for the Eliza agent runtime.';

-- Lightweight API audit log for agent-facing endpoints.
CREATE TABLE IF NOT EXISTS agent_api_logs (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  ip_hash TEXT NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_api_logs IS 'Minimal audit trail for agent API surface (rate-limit / abuse signals).';

-- Structured audit events for the agent control / capability system.
CREATE TABLE IF NOT EXISTS agent_control_audit_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  subsystem TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  reason TEXT NULL,
  error_code TEXT NULL,
  error_message TEXT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_control_audit_events_created_idx
  ON agent_control_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS agent_control_audit_events_proposal_idx
  ON agent_control_audit_events (proposal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_control_audit_events_event_type_idx
  ON agent_control_audit_events (event_type, created_at DESC);

COMMENT ON TABLE agent_control_audit_events IS 'Audit trail for agent control plane capability proposals and executions.';

-- Per-vault daily send limits ledger (keepr automation guardrail).
CREATE TABLE IF NOT EXISTS keepr_send_daily_ledger (
  vault_address TEXT NOT NULL,
  token TEXT NOT NULL,
  day DATE NOT NULL,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vault_address, token, day)
);

CREATE INDEX IF NOT EXISTS keepr_send_daily_ledger_vault_day_idx
  ON keepr_send_daily_ledger (vault_address, day DESC);

COMMENT ON TABLE keepr_send_daily_ledger IS 'Durable per-vault daily spend ledger for keepr send-command automation.';
