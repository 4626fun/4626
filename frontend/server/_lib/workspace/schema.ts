import { getDb, isDbConfigured } from '../db/postgres.js'
import { ensureWorkspaceSchema as ensureWorkspaceSchemaFromBootstrap } from '../db/schemaBootstrap.js'

let workspaceSchemaEnsured = false

export async function ensureWorkspaceSchema(): Promise<void> {
  if (!isDbConfigured()) return
  if (workspaceSchemaEnsured) return

  const db = await getDb()
  if (!db) return

  try {
    // Condensed path
    await ensureWorkspaceSchemaFromBootstrap(db)

    // Legacy raw blocks below are transitional and will be removed.
    // (The authoritative definitions are now in the 20260529 migration.)

    await db.sql`
      CREATE TABLE IF NOT EXISTS workspace_strategy_targets (
        vault_address TEXT NOT NULL,
        strategy_address TEXT NOT NULL,
        target_weight_bps INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        updated_by TEXT NULL,
        updated_source TEXT NULL,
        notes TEXT NULL,
        max_assets_cap NUMERIC(78, 0) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (vault_address, strategy_address)
      );
    `
    // Make ensureWorkspaceSchema idempotent for environments where the table
    // pre-existed without the cap column (matches migration 032).
    await db.sql`
      ALTER TABLE workspace_strategy_targets
      ADD COLUMN IF NOT EXISTS max_assets_cap NUMERIC(78, 0) NULL;
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS workspace_strategy_targets_vault_idx
      ON workspace_strategy_targets (vault_address, updated_at DESC);
    `

    await db.sql`
      CREATE TABLE IF NOT EXISTS workspace_monitoring_snapshots (
        id BIGSERIAL PRIMARY KEY,
        vault_address TEXT NOT NULL,
        snapshot_kind TEXT NOT NULL DEFAULT 'vault_report',
        payload_json JSONB NOT NULL,
        source TEXT NOT NULL DEFAULT 'workspace',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS workspace_monitoring_snapshots_vault_created_idx
      ON workspace_monitoring_snapshots (vault_address, created_at DESC);
    `

    await db.sql`
      CREATE TABLE IF NOT EXISTS workspace_alert_events (
        id BIGSERIAL PRIMARY KEY,
        vault_address TEXT NOT NULL,
        source TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NULL,
        details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'open',
        dedupe_key TEXT NULL,
        related_task_id BIGINT NULL,
        created_by TEXT NULL,
        acknowledged_by TEXT NULL,
        acknowledged_at TIMESTAMPTZ NULL,
        resolved_by TEXT NULL,
        resolved_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS workspace_alert_events_vault_status_idx
      ON workspace_alert_events (vault_address, status, created_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS workspace_alert_events_dedupe_idx
      ON workspace_alert_events (vault_address, dedupe_key, created_at DESC);
    `

    await db.sql`
      CREATE TABLE IF NOT EXISTS workspace_approvals (
        id BIGSERIAL PRIMARY KEY,
        vault_address TEXT NOT NULL,
        action_type TEXT NOT NULL,
        payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        source TEXT NOT NULL DEFAULT 'workspace',
        severity TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'pending',
        requested_by TEXT NULL,
        signer_address TEXT NULL,
        deadline_at TIMESTAMPTZ NULL,
        decided_by TEXT NULL,
        decided_at TIMESTAMPTZ NULL,
        decision_reason TEXT NULL,
        linked_task_id BIGINT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS workspace_approvals_vault_status_idx
      ON workspace_approvals (vault_address, status, created_at DESC);
    `

    await db.sql`
      CREATE TABLE IF NOT EXISTS workspace_task_state (
        id BIGSERIAL PRIMARY KEY,
        vault_address TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NULL,
        source TEXT NOT NULL DEFAULT 'workspace',
        severity TEXT NOT NULL DEFAULT 'info',
        status TEXT NOT NULL DEFAULT 'pending',
        action_type TEXT NULL,
        action_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        related_alert_id BIGINT NULL,
        related_approval_id BIGINT NULL,
        room_ref TEXT NULL,
        thread_ref TEXT NULL,
        assignee_wallet TEXT NULL,
        due_at TIMESTAMPTZ NULL,
        snoozed_until TIMESTAMPTZ NULL,
        created_by TEXT NULL,
        updated_by TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS workspace_task_state_vault_status_idx
      ON workspace_task_state (vault_address, status, created_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS workspace_task_state_due_idx
      ON workspace_task_state (due_at, status);
    `

    await db.sql`
      CREATE TABLE IF NOT EXISTS workspace_activity_events (
        id BIGSERIAL PRIMARY KEY,
        vault_address TEXT NOT NULL,
        event_type TEXT NOT NULL,
        actor_address TEXT NULL,
        source TEXT NOT NULL DEFAULT 'workspace',
        title TEXT NOT NULL,
        description TEXT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        related_task_id BIGINT NULL,
        related_approval_id BIGINT NULL,
        related_alert_id BIGINT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS workspace_activity_events_vault_created_idx
      ON workspace_activity_events (vault_address, created_at DESC);
    `

    await db.sql`
      CREATE TABLE IF NOT EXISTS workspace_notification_preferences (
        vault_address TEXT NOT NULL,
        principal_address TEXT NOT NULL,
        telegram_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        xmtp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        min_severity TEXT NOT NULL DEFAULT 'warn',
        channels_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (vault_address, principal_address)
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS workspace_notification_preferences_vault_idx
      ON workspace_notification_preferences (vault_address, updated_at DESC);
    `

    await db.sql`
      CREATE TABLE IF NOT EXISTS workspace_audit_logs (
        id BIGSERIAL PRIMARY KEY,
        vault_address TEXT NOT NULL,
        actor_address TEXT NULL,
        actor_role TEXT NULL,
        source TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NULL,
        target_id TEXT NULL,
        before_json JSONB NULL,
        after_json JSONB NULL,
        details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS workspace_audit_logs_vault_created_idx
      ON workspace_audit_logs (vault_address, created_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS workspace_audit_logs_action_created_idx
      ON workspace_audit_logs (action, created_at DESC);
    `

    workspaceSchemaEnsured = true
  } catch (error) {
    workspaceSchemaEnsured = false
    throw error
  }
}
