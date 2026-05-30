-- Workspace / creator strategy management tables.
-- Extracted from duplicated runtime bootstrap in frontend/server/_lib/workspace/schema.ts.

CREATE TABLE IF NOT EXISTS workspace_strategy_targets (
  vault_address TEXT NOT NULL,
  strategy_address TEXT NOT NULL,
  target_weight_bps INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vault_address, strategy_address)
);

CREATE INDEX IF NOT EXISTS workspace_strategy_targets_vault_idx ON workspace_strategy_targets(vault_address);

CREATE TABLE IF NOT EXISTS workspace_monitoring_snapshots (
  id BIGSERIAL PRIMARY KEY,
  vault_address TEXT NOT NULL,
  snapshot_kind TEXT NOT NULL DEFAULT 'vault_report',
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_monitoring_snapshots_vault_kind_idx ON workspace_monitoring_snapshots(vault_address, snapshot_kind, created_at DESC);

CREATE TABLE IF NOT EXISTS workspace_alert_events (
  id BIGSERIAL PRIMARY KEY,
  vault_address TEXT NOT NULL,
  source TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_alert_events_vault_created_idx ON workspace_alert_events(vault_address, created_at DESC);

CREATE TABLE IF NOT EXISTS workspace_approvals (
  id BIGSERIAL PRIMARY KEY,
  vault_address TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_approvals_vault_status_idx ON workspace_approvals(vault_address, status, created_at DESC);

CREATE TABLE IF NOT EXISTS workspace_task_state (
  id BIGSERIAL PRIMARY KEY,
  vault_address TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ,
  assigned_to TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_task_state_vault_status_idx ON workspace_task_state(vault_address, status, due_at);

CREATE TABLE IF NOT EXISTS workspace_activity_events (
  id BIGSERIAL PRIMARY KEY,
  vault_address TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_address TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_activity_events_vault_created_idx ON workspace_activity_events(vault_address, created_at DESC);

CREATE TABLE IF NOT EXISTS workspace_notification_preferences (
  vault_address TEXT NOT NULL,
  principal_address TEXT NOT NULL,
  telegram_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vault_address, principal_address)
);

CREATE TABLE IF NOT EXISTS workspace_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  vault_address TEXT NOT NULL,
  actor_address TEXT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  diff_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_audit_logs_vault_created_idx ON workspace_audit_logs(vault_address, created_at DESC);

COMMENT ON TABLE workspace_strategy_targets IS 'Per-vault strategy weight targets for creator-managed vaults.';
COMMENT ON TABLE workspace_approvals IS 'Approval workflow for sensitive vault actions.';
COMMENT ON TABLE workspace_audit_logs IS 'Audit trail for workspace / vault operations.';