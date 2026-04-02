do $$
declare
  t text;
  tables text[] := array[
    'agent_api_logs',
    'agent_background_tasks',
    'agent_rate_limits',
    'agent_subdomains',
    'auth_nonces',
    'creator_agent_wallets',
    'creator_coins',
    'creator_metrics_state',
    'creator_xmtp_agents',
    'creators',
    'keepr_actions',
    'keepr_join_requests',
    'keepr_logs',
    'keepr_nonces',
    'keepr_vaults',
    'points',
    'profile_wallets',
    'referral_clicks',
    'referral_conversions',
    'wallets'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = t
        and policyname = 'deny_all_public'
    ) then
      execute format(
        'create policy deny_all_public on public.%I for all to public using (false) with check (false)',
        t
      );
    end if;
  end loop;
end
$$;;
