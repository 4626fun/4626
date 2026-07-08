-- RLS for Shovel protocol index tables (Tier A).
-- Shovel creates tables in public.*; this migration adds read policies for authenticated
-- app users and denies anon writes. Run after Shovel's first startup (tables must exist).

-- Helper: enable RLS + service_role full access pattern used by other 4626 index tables.

do $$
declare
  t text;
begin
  foreach t in array array[
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
  ]
  loop
    execute format('alter table if exists public.%I enable row level security', t);
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
  end loop;
end $$;

-- Freshness view for ops (compare Shovel internal cursor vs chain tip externally).
create or replace view public.v_protocol_index_freshness as
select
  'protocol_phase1_deployed' as table_name,
  max(block_num) as max_block,
  max(to_timestamp(block_time)) as max_block_time,
  count(*) as row_count
from public.protocol_phase1_deployed
union all
select 'protocol_lottery_winners', max(block_num), max(to_timestamp(block_time)), count(*)
from public.protocol_lottery_winners
union all
select 'protocol_share_oft_transfers', max(block_num), max(to_timestamp(block_time)), count(*)
from public.protocol_share_oft_transfers;

comment on view public.v_protocol_index_freshness is
  'Ops snapshot for Tier A Shovel tables. Shovel bookkeeping lives in schema shovel.*';
