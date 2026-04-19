-- Enable Row Level Security on public tables flagged by the Supabase
-- database linter (`rls_disabled_in_public`, lint 0013).
--
-- Context: all server handlers connect via `DATABASE_URL` as the `postgres`
-- superuser through the Supabase pooler, and superuser connections bypass
-- RLS by default. Enabling RLS here denies `anon` and `authenticated`
-- (PostgREST) access without affecting server-side reads/writes. Matches
-- the pattern established in
-- `20260216095709_enable_rls_and_cleanup_public_warnings.sql`.
--
-- Do NOT use `FORCE ROW LEVEL SECURITY` — the table owner is `postgres`
-- which is the same role our server connects as, and forcing would block
-- legitimate server writes.

begin;

-- Workspace ops tables — internal admin/ops surfaces accessed only via
-- `frontend/server/_lib/workspace/{schema,repository}.ts`. Never intended
-- to be reachable via the public PostgREST API.
alter table public.workspace_strategy_targets enable row level security;
alter table public.workspace_monitoring_snapshots enable row level security;
alter table public.workspace_alert_events enable row level security;
alter table public.workspace_approvals enable row level security;
alter table public.workspace_task_state enable row level security;
alter table public.workspace_activity_events enable row level security;
alter table public.workspace_notification_preferences enable row level security;
alter table public.workspace_audit_logs enable row level security;

-- Agent control audit trail — written by `frontend/server/_lib/agentControl/audit.ts`.
-- Audit data should never be reachable via the public REST API.
alter table public.agent_control_audit_events enable row level security;

-- Privy user → profile alias map (added in 20260419200000_profile_merge_infra.sql).
-- Sensitive identity routing metadata; must not be exposed via PostgREST.
-- Server-side resolver in `accountsIdentity.ts` connects as superuser and
-- continues to read/write unaffected.
alter table public.privy_user_aliases enable row level security;

commit;
