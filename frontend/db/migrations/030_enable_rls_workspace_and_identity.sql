-- Enable Row Level Security on 9 `public.*` tables that were created
-- without RLS and got flagged by Supabase's `rls_disabled_in_public`
-- linter (lint 0013). Workspace ops surfaces + arch-b audit events.
--
-- Context: all server handlers connect via `DATABASE_URL` as the `postgres`
-- superuser through the Supabase pooler, and superuser connections bypass
-- RLS by default. Enabling RLS here denies `anon` and `authenticated`
-- (PostgREST) access without affecting server-side reads/writes. Matches
-- the pattern established in migration 023 (`enable_rls_on_internal_public_tables`).
--
-- NOT using `FORCE ROW LEVEL SECURITY`: the table owner is `postgres`
-- which is the same role our server connects as; forcing would block
-- legitimate server writes.
--
-- Explicit deny-all policies for these tables are added in migration 031
-- to satisfy Supabase's `rls_enabled_no_policy` info-level lint and
-- document "server-only" intent.

-- Workspace ops tables — internal admin/ops surfaces accessed only via
-- `frontend/server/_lib/workspace/{repository,schema}.ts`. Never intended
-- to be reachable via the public PostgREST API.
ALTER TABLE public.workspace_strategy_targets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_monitoring_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_alert_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_approvals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_task_state             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_activity_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_audit_logs             ENABLE ROW LEVEL SECURITY;

-- Agent control audit trail — written by
-- `frontend/server/_lib/agentControl/audit.ts`. Audit data should never
-- be reachable via the public REST API.
ALTER TABLE public.agent_control_audit_events       ENABLE ROW LEVEL SECURITY;
