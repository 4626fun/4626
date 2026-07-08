# Tier A — Shovel → Supabase (4626 protocol index)

**Recommendation: Shovel** (not Envio) for this repo.

| | Shovel | Envio |
|---|--------|-------|
| Output | Postgres tables (native Supabase) | Hosted GraphQL + separate DB |
| Infra | One Docker container + existing Supabase | Envio cloud/hosted stack + schema sync |
| RPC | Reuses `BASE_LOGS_RPC_URL` (Alchemy) | HyperSync (different provider path) |
| Fit | Matches Zora CSW / creator-metrics `eth_getLogs` → Postgres pattern | Better when GraphQL is the primary API |

Shovel declaratively indexes Base mainnet events into `public.*` tables. Dynamic per-vault contracts (ShareOFT, burn streams) use Shovel `filter_ref` chains off `Phase1Deployed` / `UpdateBurnStream`.

## What gets indexed (v1.18.0-greenfield)

| Integration | Source contract | Events / data |
|-------------|-----------------|---------------|
| `protocol_phase1_deployed` | `DeploymentBatcher` | `Phase1Deployed` → vault, shareOFT, wrapper |
| `protocol_phase2_launched` | `DeploymentBatcher` | `Phase2DeployedAndLaunched` |
| `protocol_share_bridge_solana` | `DeploymentBatcher` | `ShareAllocationBridgedToSolana` (Pipe A) |
| `protocol_lottery_*` | `LotteryManager4626` | `LotteryWinner`, `MultiTokenJackpotWon`, `LotteryEntryCreated` |
| `protocol_share_oft_transfers` | per-vault ShareOFT | ERC-20 `Transfer` (via `filter_ref`) |
| `protocol_share_oft_buy_fees` | per-vault ShareOFT | `BuyFee` |
| `protocol_vault_burn_stream_set` | per-vault CreatorOVault | `UpdateBurnStream` |
| `protocol_burn_stream_dripped` | per-vault burn stream | `StreamDripped` |

Addresses default to `docs/reference/addresses.md` (v1.18.0). Override via env before rendering config.

## Prerequisites

1. **Supabase direct Postgres URL** (`SHOVEL_PG_URL`) — session mode `:5432`, not the pooler, for long-running writes.
2. **Alchemy Base RPC** — same URL as Vercel `BASE_LOGS_RPC_URL` (dedicated `eth_getLogs` lane).
3. **Start block** — pin `SHOVEL_BASE_START_BLOCK` to the v1.18.0 `DeploymentBatcher` creation block on [BaseScan](https://basescan.org/address/0x02D7abC547F8B1e7E2D7a919D8D1005918361750) before backfill.

## Quick start

```bash
cd indexer/shovel
# Pull SHOVEL_PG_URL + RPC from frontend/.env (auto-fallback if Alchemy is capped)
./scripts/sync-env-from-frontend.sh

set -a && source .env && set +a
node render-config.mjs --write   # writes config.generated.json

# Option A: host-native (recommended — Docker v1.6 image has a converge bug; main binary works)
./scripts/start.sh
tail -f .run/shovel.log

# Option B: Docker (not recommended until indexsupply/shovel main is published)
# docker compose up -d
```

After first run (tables created by Shovel):

```bash
# Apply RLS + freshness view (Supabase SQL editor or psql)
psql "$SHOVEL_PG_URL" -f migrations/001_protocol_index_rls.sql
```

## Wire Alchemy RPC (Vercel + Shovel)

Set the **same** Alchemy Base mainnet URL in both places:

| Surface | Env var | Example |
|---------|---------|---------|
| Vercel crons / keeper log scans | `BASE_LOGS_RPC_URL` | `https://base-mainnet.g.alchemy.com/v2/<key>` |
| Shovel indexer (this dir) | `BASE_LOGS_RPC_URL` | same |
| General reads / txs | `BASE_RPC_URL` | can differ (CDP, etc.) |

Resolution order in app code: `BASE_LOGS_RPC_URL` → `BASE_RPC_URL` → public fallback.

Optional tuning (already used by cron handlers):

```bash
BASE_LOGS_RPC_RANGE=2000          # blocks per getLogs chunk
BASE_LOGS_RPC_CONCURRENCY=4       # parallel chunk workers
```

## Sample queries

```sql
-- Recent greenfield vault launches
select
  encode(creator_token, 'hex') as creator_token,
  encode(share_oft, 'hex') as share_oft,
  block_num
from protocol_phase1_deployed
order by block_num desc
limit 20;

-- Lottery winners (indexed — replaces live eth_getLogs in /api/v1/lottery/recentWinners)
select
  encode(token, 'hex') as token,
  encode("user", 'hex') as winner,
  reward_amount,
  block_num
from protocol_lottery_winners
order by block_num desc
limit 50;

-- ShareOFT transfer volume by contract
select encode(log_addr, 'hex') as share_oft, count(*) as transfers
from protocol_share_oft_transfers
group by 1
order by 2 desc;

-- Indexer freshness
select * from v_protocol_index_freshness;
```

## Ops notes

- Uses **`shovel-main`** binary (`indexsupply.net/bin/main/…`) — v1.6 Docker/`1.6` binary hit `converge-retry` loops here; main works.
- Alchemy `BASE_LOGS_RPC_URL` is probed first; when capped (429), sync falls back to `BASE_READ_RPC_URL` / `BASE_RPC_URL` (currently matrixed.link).
- Start block pinned to **48345250** (v1.18.0 `DeploymentBatcher` deploy window).
- Shovel internal state lives in schema `shovel.*` (do not drop).
- Re-render config after address cutovers: `node render-config.mjs --write && docker compose up -d`.
- For v1.16.1 historical vaults on the **old** batcher (`0xA9024e…`), add a second source block range or a separate config file — this scaffold targets v1.18.0-greenfield only.
- Envio remains an option if you later need a public GraphQL API; keep Postgres as source of truth and add Envio as a read replica layer only if product requires it.

## Related

- `indexer/README.md` — Zora CSW indexer (same Postgres pattern)
- `docs/reference/addresses.md` — canonical contract addresses
- `frontend/api/_handlers/v1/lottery/_recentWinners.ts` — today scans logs live; migrate to `protocol_lottery_winners` when backfill is caught up
