-- Zora-created Coinbase Smart Wallets on Base, enriched with owner EOAs.
--
-- This is the primary asset the `@4626/zora-csw-indexer` service
-- produces: a queryable map from CSW address to current owner EOAs, so
-- future outreach / install flows can target the EOAs that have the
-- authority to sign `addOwnerAddress` on their CSW.
--
-- `initial_owners` comes from the ZoraSmartWalletCreated event payload
-- and is immutable once written. `current_owners` is refreshed by
-- re-reading ownerAtIndex on the CSW and WILL drift over time as users
-- add/remove owners — `last_owner_sync_at` tells you how stale it is.

create table if not exists public.zora_csw_owners (
  csw_address         text        primary key,
  base_owner          text,
  initial_owners      text[]      not null default '{}',
  current_owners      text[],
  creation_nonce      numeric,
  creation_block      bigint,
  creation_tx_hash    text,
  first_indexed_at    timestamptz not null default now(),
  last_owner_sync_at  timestamptz,
  source              text        not null default 'zora_account_manager',
  metadata            jsonb       not null default '{}'::jsonb
);

-- Primary access pattern: "which CSWs does this EOA own?" For both
-- tables (initial and current) use GIN to support array containment
-- queries like `where current_owners @> array['0xabc…']`.
create index if not exists idx_zora_csw_owners_current_owners
  on public.zora_csw_owners using gin (current_owners);

create index if not exists idx_zora_csw_owners_initial_owners
  on public.zora_csw_owners using gin (initial_owners);

-- Secondary: quick lookup by the canonical "baseOwner" (first owner at
-- creation), which is often the Zora signup EOA.
create index if not exists idx_zora_csw_owners_base_owner
  on public.zora_csw_owners (base_owner);

-- Time-based queries (recent creations, stale enrichment).
create index if not exists idx_zora_csw_owners_creation_block
  on public.zora_csw_owners (creation_block desc);

create index if not exists idx_zora_csw_owners_last_owner_sync_at
  on public.zora_csw_owners (last_owner_sync_at nulls first);

-- RLS: lock down hard. Only service-role (used by the indexer and
-- server-side admin endpoints) can read or write. No anon access.
alter table public.zora_csw_owners enable row level security;

-- Explicitly drop-and-create so re-running the migration is idempotent.
drop policy if exists zora_csw_owners_service_role_all on public.zora_csw_owners;
create policy zora_csw_owners_service_role_all
  on public.zora_csw_owners
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.zora_csw_owners is
  'Index of Zora-created Coinbase Smart Wallets on Base with their current owner EOAs. Populated by the @4626/zora-csw-indexer service via the ZoraSmartWalletCreated event at 0x0Ba958A449701907302e28F5955fa9d16dDC45c3. Used for pre-qualified outreach and install-flow routing.';

comment on column public.zora_csw_owners.initial_owners is
  'Immutable owner list at CSW creation time, taken from the event payload.';

comment on column public.zora_csw_owners.current_owners is
  'Current owner list, refreshed by re-reading ownerAtIndex on the CSW. Can drift from initial_owners as users add/remove owners. Null until first enrichment pass.';

comment on column public.zora_csw_owners.last_owner_sync_at is
  'When current_owners was last refreshed. Null means never enriched.';
