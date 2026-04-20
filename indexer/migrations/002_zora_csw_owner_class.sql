-- Per-EOA wallet-type classification for all owners of Zora CSWs.
--
-- On-chain, a Privy embedded EOA and a self-custody EOA (MetaMask,
-- Rabby, Coinbase Wallet extension, Rainbow, etc.) are indistinguishable
-- by format. But they behave differently: Privy signs only as ERC-4337
-- UserOps (so the EOA's own nonce stays 0), while extension wallets
-- typically submit direct txs on one or more chains (nonce > 0).
--
-- We store the Base and Ethereum mainnet nonces we observed so future
-- campaigns can re-classify or refine the heuristic without re-hitting
-- the RPC.
--
-- Keyed on EOA rather than CSW because the same EOA often shows up as
-- an owner of multiple CSWs — deduping at classification time saves
-- both RPC calls and redundant rows.

create table if not exists public.zora_csw_owner_class (
  eoa                    text        primary key,
  wallet_class           text        not null,
  base_nonce             integer,
  mainnet_nonce          integer,
  farcaster_fid          integer,
  farcaster_username     text,
  farcaster_display_name text,
  first_classified_at    timestamptz not null default now(),
  last_updated_at        timestamptz not null default now(),
  metadata               jsonb       not null default '{}'::jsonb
);

-- Filtering by class is the primary query: "give me all extension-wallet
-- EOAs" or "all Privy embedded EOAs".
create index if not exists idx_zora_csw_owner_class_wallet_class
  on public.zora_csw_owner_class (wallet_class);

-- Ranking by mainnet tx volume — how seasoned is this self-custody user?
-- Descending because we always want the most active first.
create index if not exists idx_zora_csw_owner_class_mainnet_nonce
  on public.zora_csw_owner_class (mainnet_nonce desc nulls last);

-- FID lookup when we want to find the Farcaster profile for an EOA.
create index if not exists idx_zora_csw_owner_class_farcaster_fid
  on public.zora_csw_owner_class (farcaster_fid)
  where farcaster_fid is not null;

-- RLS: service-role only, same pattern as zora_csw_owners.
alter table public.zora_csw_owner_class enable row level security;

drop policy if exists zora_csw_owner_class_service_role_all on public.zora_csw_owner_class;
create policy zora_csw_owner_class_service_role_all
  on public.zora_csw_owner_class
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.zora_csw_owner_class is
  'Per-EOA wallet-type classification (Privy embedded vs extension/self-custody) plus optional Farcaster profile mapping. Populated by classifyOwners.ts and crossReferenceFarcaster.ts in @4626/zora-csw-indexer.';

comment on column public.zora_csw_owner_class.wallet_class is
  'One of: likely_privy_embedded, likely_extension_eoa, likely_contract, unknown.';

comment on column public.zora_csw_owner_class.base_nonce is
  'eth_getTransactionCount at the time of classification. Updated on re-classify.';

comment on column public.zora_csw_owner_class.mainnet_nonce is
  'eth_getTransactionCount on Ethereum mainnet at classification time. Proxy for "how seasoned is this self-custody wallet".';

comment on column public.zora_csw_owner_class.farcaster_fid is
  'Farcaster FID resolved via Neynar verified-address lookup. Null if the EOA has no registered Farcaster verification.';
