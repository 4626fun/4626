-- RLS for Shovel protocol index tables (Tier A).
-- Shovel creates tables in public.*; this migration adds service_role write +
-- authenticated read policies. Idempotent — safe to re-run after Shovel startup.
--
-- Apply via:
--   psql "$SHOVEL_PG_URL" -f migrations/001_protocol_index_rls.sql
-- or Railway deferred applier `scripts/apply-protocol-index-rls.sh` (retries after
-- shovel-main creates tables).
--
-- Freshness view is built dynamically from tables that exist so disabled
-- integrations do not break apply on greenfield deploys.

do $$
declare
  t text;
  parts text[] := array[]::text[];
  view_sql text;
  protocol_tables text[] := array[
    'protocol_phase1_deployed',
    'protocol_phase2_launched',
    'protocol_share_bridge_solana',
    'protocol_lottery_winners',
    'protocol_lottery_multi_jackpot',
    'protocol_lottery_entries',
    'protocol_vault_burn_stream_set',
    'protocol_burn_stream_dripped',
    'protocol_share_oft_transfers',
    'protocol_share_oft_buy_fees'
  ];
  required_enabled text[] := array[
    'protocol_phase1_deployed',
    'protocol_lottery_winners',
    'protocol_lottery_multi_jackpot',
    'protocol_lottery_entries',
    'protocol_share_oft_buy_fees'
  ];
begin
  -- Fail closed until currently-enabled product tables exist so the deferred
  -- Railway applier retries instead of claiming success with open tables.
  foreach t in array required_enabled
  loop
    if to_regclass(format('public.%I', t)) is null then
      raise exception 'required protocol table public.% missing — retry after Shovel converge', t;
    end if;
  end loop;

  if to_regclass('shovel.task_updates') is null then
    raise exception 'shovel.task_updates missing — retry after Shovel converge';
  end if;

  foreach t in array protocol_tables
  loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_service_all on public.%I', t, t);
    execute format(
      'create policy %I_service_all on public.%I for all to service_role using (true) with check (true)',
      t, t
    );
    execute format('drop policy if exists %I_authenticated_read on public.%I', t, t);
    execute format(
      'create policy %I_authenticated_read on public.%I for select to authenticated using (true)',
      t, t
    );
    parts := array_append(
      parts,
      format(
        $q$select %L::text as table_name,
          max(block_num) as max_block,
          max(to_timestamp(block_time)) as max_block_time,
          count(*) as row_count
        from public.%I$q$,
        t,
        t
      )
    );
  end loop;

  parts := array_append(
    parts,
    $q$select
      'shovel:' || ig_name as table_name,
      max(src_num)::numeric as max_block,
      null::timestamptz as max_block_time,
      count(*)::bigint as row_count
    from shovel.task_updates
    group by ig_name$q$
  );

  view_sql := 'create or replace view public.v_protocol_index_freshness as ' ||
    array_to_string(parts, ' union all ');
  execute view_sql;

  comment on view public.v_protocol_index_freshness is
    'Ops snapshot for Tier A Shovel tables + shovel.task_updates cursors. Tip-following with row_count=0 does not prove event decoding — compare against eth_getLogs smoke checks.';

  -- Ops view: keep PostgREST away; operators use service_role / direct psql.
  revoke all on table public.v_protocol_index_freshness from anon, authenticated;
  grant select on table public.v_protocol_index_freshness to service_role;
end $$;
