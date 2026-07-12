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

Always-on (enabled):

| Integration | Source contract | Events / data |
|-------------|-----------------|---------------|
| `protocol_phase1_deployed` | `DeploymentBatcher` | `Phase1Deployed` → vault, shareOFT, wrapper |
| `protocol_lottery_*` | `LotteryManager4626` | `LotteryWinner`, `MultiTokenJackpotWon`, `LotteryEntryCreated` |
| `protocol_share_oft_buy_fees` | per-vault ShareOFT | `BuyFee` (via `filter_ref` off phase1) |

Defined but **disabled** until a product consumer needs them (avoids RPC burn):

| Integration | Why disabled |
|-------------|--------------|
| `protocol_share_oft_transfers` | ERC-20 `Transfer` multi-address getLogs hits 20k caps → infinite `converge-retry` |
| `protocol_phase2_launched` | No app/keeper consumer yet |
| `protocol_share_bridge_solana` | Solana pipe still uses registry/DB paths |
| `protocol_vault_burn_stream_set` / `protocol_burn_stream_dripped` | Unused; drip `filter_ref` also misses deploy-time burn stream |

Addresses default to `docs/reference/addresses.md` (v1.18.0). Override via env before rendering config.
Toggle integrations via `enabled` in `render-config.mjs`, then re-render + redeploy.

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
# Apply RLS + freshness view (idempotent). Railway entrypoint retries this in the
# background after shovel-main starts (tables must exist first).
psql "$SHOVEL_PG_URL" -f migrations/001_protocol_index_rls.sql
# or: ./scripts/apply-protocol-index-rls.sh
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

-- ShareOFT transfer volume by contract (table exists even when integration is disabled)
select encode(log_addr, 'hex') as share_oft, count(*) as transfers
from protocol_share_oft_transfers
group by 1
order by 2 desc;

-- Indexer freshness (ops / service_role). Tip-following with row_count=0 does not
-- prove event decoding — run scripts/smoke-index-decode.mjs.
select * from v_protocol_index_freshness;
```

## Railway (always-on)

Create a new Railway service pointing at this repo:

| Setting | Value |
|---------|-------|
| Config file | `railway.shovel.toml` |
| Dockerfile | `indexer/shovel/Dockerfile` |
| Healthcheck | `/health` (process-only deploy readiness) |

Railway only probes `/health` at deploy time and does **not** continuously restart on later 503s. For continuous monitoring use:

| Signal | How |
|--------|-----|
| `GET /ready` | Lag-aware readiness (slowest live cursor vs chain tip). Expose privately or via a domain + uptime check. |
| `[shovel-status]` log lines | Emitted every `SHOVEL_STATUS_LOG_MS` (default 60s) into Railway deploy logs. |
| `scripts/smoke-index-decode.mjs` | Tip + row_count + optional RPC LotteryWinner compare (decode smoke). |

Required variables on the service:

- `SHOVEL_PG_URL` (or `DIRECT_URL` / `DATABASE_URL`) — Supabase **session** `:5432` URL
- `BASE_LOGS_RPC_URL` + `BASE_READ_RPC_URL` / `BASE_RPC_URL` — probe picks the first that passes header-batch + getLogs checks
- `SHOVEL_BASE_START_BLOCK=48345250`

Optional health / tuning:

- `SHOVEL_BATCH_SIZE=200` (default in `render-config.mjs`)
- `SHOVEL_HEALTH_MAX_LAG_BLOCKS=256` — `/ready` returns 503 when enabled integration tip lags chain tip by more than this
- `SHOVEL_HEALTH_WARMUP_MS=180000` — grace period after process start before `/ready` lag is a hard failure
- `SHOVEL_STATUS_LOG_MS=60000` — continuous status log interval

Deploy from repo root (service must use Dockerfile builder + `railway.shovel.toml`):

```bash
# Prefer explicit project/service — local CLI may already be linked to shovel or hermit.
railway link --project 4626-shovel-indexer
# Ensure service config: dockerfilePath=indexer/shovel/Dockerfile, config file=railway.shovel.toml
railway up --project 4626-shovel-indexer --service 4626-shovel-indexer --detach
```

**CLI link residual risk:** `railway status` / bare `railway up` follow whatever project is currently linked in this workspace. Confirm with `railway status --json` before deploying; do not assume hermit/XMTP when shovel is linked (or the reverse).

Note: Railway CLI `-c` means `--ci` (stream build logs), **not** config-file. Set `railway.shovel.toml` on the service via Railway UI / `update_service` (`railway_config_file`).

The container runs `scripts/railway-entrypoint.sh`: RPC probe → `render-config.mjs` → `shovel-main` (foreground) + `/health`+`/ready` sidecar + deferred RLS apply (retries until required tables exist).

## VM (systemd)

See `scripts/systemd/shovel-indexer.service.example` — same entrypoint as Railway, `EnvironmentFile` pointing at your `frontend/.env`.

## RPC probe

`scripts/probe-shovel-rpc.py` tests each candidate for:

1. `eth_blockNumber`
2. small `eth_getLogs` on the v1.18 `DeploymentBatcher`
3. batched `eth_getBlockByNumber` headers (default **200** blocks — matches Shovel batch size)

Alchemy often passes (1)+(2) but fails (3) at 500-block batches; sync-env and Railway entrypoint skip it and use `BASE_READ_RPC_URL` / matrixed when needed.

```bash
python3 scripts/probe-shovel-rpc.py --json
```

## Ops notes

- Uses **`shovel-main`** binary (`indexsupply.net/bin/main/…`) — v1.6 Docker/`1.6` binary hit `converge-retry` loops here; main works.
- `sync-env-from-frontend.sh` probes **header batches**, not just tiny getLogs; default `SHOVEL_BATCH_SIZE=200` (also the `render-config.mjs` default).
- Start block pinned to **48345250** (v1.18.0 `DeploymentBatcher` deploy window).
- Shovel internal state lives in schema `shovel.*` (do not drop). `task_updates` is **append-only history**.
- Lottery APIs and `/ready` gate on **`MIN(MAX(src_num) per integration)`** across required integrations (slowest *live* cursor). Bare `MIN(src_num)` is wrong.
- `/health` = process deploy readiness; `/ready` + `[shovel-status]` logs = continuous lag monitoring.
- Tip-following with `row_count=0` does **not** prove event decoding. Run `node scripts/smoke-index-decode.mjs` (add `--strict` when RPC should find LotteryWinner rows).
- RLS/freshness apply is deferred until required `protocol_*` tables exist (entrypoint background retries).
- Re-render config after address cutovers: `node render-config.mjs --write` then restart the worker.
- For v1.16.1 historical vaults on the **old** batcher (`0xA9024e…`), add a second source block range or a separate config file — this scaffold targets v1.18.0-greenfield only.
- Envio remains an option if you later need a public GraphQL API; keep Postgres as source of truth and add Envio as a read replica layer only if product requires it.

## Related

- `indexer/README.md` — Zora CSW indexer (same Postgres pattern)
- `docs/reference/addresses.md` — canonical contract addresses
- `frontend/api/_handlers/v1/lottery/_recentWinners.ts` — reads `protocol_lottery_winners` / `protocol_lottery_multi_jackpot` when Shovel index covers the window (RPC fallback for pre-greenfield lookback)
