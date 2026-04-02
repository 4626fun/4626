begin;

-- 1) Enable RLS on public tables flagged by advisor.
alter table public.agent_api_logs enable row level security;
alter table public.creator_agent_wallets enable row level security;
alter table public.profile_wallets enable row level security;
alter table public.wallets enable row level security;
alter table public.agent_rate_limits enable row level security;
alter table public.creator_xmtp_agents enable row level security;
alter table public.keepr_join_requests enable row level security;
alter table public.auth_nonces enable row level security;
alter table public.agent_subdomains enable row level security;
alter table public.creators enable row level security;
alter table public.creator_coins enable row level security;
alter table public.creator_metrics_state enable row level security;
alter table public.agent_background_tasks enable row level security;

-- 2) Remove redundant deny-all policy duplicates.
-- These are permissive false policies on role public and are redundant where
-- table-specific policies already exist; they trigger advisor "multiple permissive policies" warnings.
drop policy if exists "No public access" on public.access_requests;
drop policy if exists "No public access" on public.allowlist;
drop policy if exists "No public access" on public.deploys;

-- 3) Remove duplicate indexes (keep the newer canonical names).
drop index if exists public.waitlist_points_ledger_signup_idx;
drop index if exists public.waitlist_points_ledger_unique_source;
drop index if exists public.waitlist_signups_created_at_idx;
drop index if exists public.waitlist_signups_csw_idx;
drop index if exists public.waitlist_signups_referred_by_signup_id_idx;
drop index if exists public.waitlist_signups_referral_code_unique;

commit;;
