# @4626/zora-csw-indexer

A standalone service that indexes **Zora-created Coinbase Smart Wallets on Base** into Supabase, enriched with their current owner EOAs.

## Why this exists

4626's install flow (agent-as-co-owner) requires a signature from an existing CSW owner. To reach Zora users at scale, we need a queryable list of `(csw → owner_eoas[])` pairs so we can target outreach and pre-populate install pages.

The Zora content-coin sandbox is too restrictive to host the signing flow itself (see `docs/design/sub-account-lifecycle-spec.md` for the failed exploration). This indexer sidesteps that entirely — build the dataset once, then every future campaign queries it.

## How it works

Zora deploys CSWs through a custom contract, **`ZoraAccountManager`** at `0x0Ba958A449701907302e28F5955fa9d16dDC45c3` on Base. Every creation emits:

```solidity
event ZoraSmartWalletCreated(
    address indexed smartWallet,
    address indexed baseOwner,
    address[] owners,
    uint256 nonce
);
```

Source: [ourzora/zora-protocol/packages/smart-wallet](https://github.com/ourzora/zora-protocol/tree/main/packages/smart-wallet).

The indexer:

1. **Scans** `eth_getLogs` on the ZoraAccountManager for `ZoraSmartWalletCreated` events
2. **Decodes** each event into `(cswAddress, baseOwner, initialOwners, nonce)`
3. **Upserts** rows into `public.zora_csw_owners` in Supabase
4. **Enriches** each row with *current* owners by calling `ownerAtIndex(i)` on the CSW (initial owners can drift if users add/remove owners via `addOwnerAddress`)

## Schema

See `migrations/001_zora_csw_owners.sql`. Highlights:

| Column               | Purpose |
|----------------------|---------|
| `csw_address`        | Primary key. Checksummed. |
| `base_owner`         | First owner at creation (often the Zora signup EOA). |
| `initial_owners`     | Immutable. From the event payload. |
| `current_owners`     | Refreshed by on-chain read. Can drift from initial. |
| `creation_block`, `creation_tx_hash`, `creation_nonce` | Provenance. |
| `last_owner_sync_at` | When `current_owners` was last refreshed. |

GIN indexes on both owner arrays support `where current_owners @> array['0xabc…']` queries in `O(log n)`.

RLS is enabled and only `service_role` can read/write — the indexer's service-role key is the one key that can touch this table.

## Setup

```bash
cd indexer
cp .env.example .env
# Fill in BASE_RPC_URL (paid endpoint recommended) and SUPABASE_* keys
pnpm install
```

The Supabase migration (`migrations/001_zora_csw_owners.sql`) should already be applied if this service was bootstrapped by our setup script. If not:

```bash
# Option A: Supabase CLI
supabase db push

# Option B: paste the SQL into the Supabase dashboard SQL editor

# Option C: run via MCP from the main 4626 workspace (what we used to
# apply this initially)
```

## Usage

### POC: index the 100 most recent Zora CSWs

```bash
pnpm poc
```

This walks backwards from the current Base tip in 10k-block windows, gathering creation events until it has 100, upserts them, then enriches each row with current owner EOAs. Typical runtime: 1–3 minutes depending on RPC latency.

Override the target count:

```bash
POC_TARGET_COUNT=500 pnpm poc
```

### Full historical scan (future)

Not yet implemented. Planned: `pnpm index:full` walks from a configured `INDEXER_START_BLOCK` up to the current tip in forward order, checkpointing progress so it's resumable.

### Enrichment-only refresh (future)

Planned: `pnpm enrich` refreshes `current_owners` for the N oldest-synced rows. Scheduled via cron to keep the dataset from going stale.

## RPC considerations

The public `https://mainnet.base.org` RPC caps `eth_getLogs` at a 10,000-block range and will rate-limit even modest enrichment workloads. Use a paid provider:

- Alchemy Base mainnet (recommended — generous free tier)
- QuickNode Base
- Ankr Base Premium
- matrixed.link (already used by the main 4626 frontend)

Set `BASE_RPC_URL` in `.env` accordingly. If your provider allows larger ranges, bump `GETLOGS_WINDOW` (default 10_000).

## Sample queries

Once the table is populated:

```sql
-- CSWs where a specific EOA is an owner
select csw_address, current_owners
from zora_csw_owners
where current_owners @> array['0xabc…'];

-- 100 freshest Zora CSWs with address-only owners (targetable for EOA-signed install)
select csw_address, base_owner, current_owners, creation_block
from zora_csw_owners
where current_owners is not null
  and array_length(current_owners, 1) > 0
order by creation_block desc
limit 100;

-- CSWs needing enrichment (never synced or synced > 7 days ago)
select csw_address
from zora_csw_owners
where last_owner_sync_at is null
   or last_owner_sync_at < now() - interval '7 days'
order by last_owner_sync_at nulls first
limit 1000;
```

## What this dataset enables

- Pre-populated `/install-agent/[cswAddress]` pages on 4626.fun — we can DM-link straight into a flow where the CSW field is filled in and the user just connects a known-good owner EOA.
- Targeted Farcaster mentions / DMs by joining `current_owners` with Farcaster's verified-addresses dataset.
- "Top Zora creators not yet using 4626" dashboards.
- Any future primitive that needs to reach Zora's user base on-chain.
