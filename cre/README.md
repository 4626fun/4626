# CRE Workflows — 4626

Chainlink Runtime Environment (CRE) workflows that automate critical onchain operations for the 4626 protocol.

**A single workflow manages every registered vault automatically.**

## Hackathon Submission Quick Links

- Requirement mapping: `docs/hackathon/chainlink-cre-submission.md`
- 3-5 minute walkthrough script: `docs/hackathon/video-script.md`
- Simulation evidence logs: `docs/hackathon/evidence/`
- Public-source packaging runbook: `docs/hackathon/public-source-packaging.md`

## Files Using Chainlink

Core CRE workflow files:
- `cre/cre-workflows/project.yaml`
- `cre/cre-workflows/keepr-queue/main.ts`
- `cre/cre-workflows/keepr-queue/workflow.yaml`
- `cre/cre-workflows/vault-keeper/main.ts`
- `cre/cre-workflows/vault-keeper/workflow.yaml`
- `cre/cre-workflows/auction-settlement/main.ts`
- `cre/cre-workflows/auction-settlement/workflow.yaml`
- `cre/cre-workflows/payout-integrity/main.ts`
- `cre/cre-workflows/payout-integrity/workflow.yaml`
- `cre/cre-workflows/runtime-indexer-block/main.ts`
- `cre/cre-workflows/runtime-indexer-block/workflow.yaml`
- `cre/cre-workflows/runtime-indexer-data-fetch/main.ts`
- `cre/cre-workflows/runtime-indexer-data-fetch/workflow.yaml`
- `cre/cre-workflows/runtime-reference-feeds/main.ts`
- `cre/cre-workflows/runtime-reference-feeds/workflow.yaml`
- `cre/cre-workflows/runtime-orchestrator/main.ts`
- `cre/cre-workflows/runtime-orchestrator/workflow.yaml`

CRE-to-app orchestration bridge files:
- `frontend/api/_handlers/cre/vaults/_active.ts`
- `frontend/api/_handlers/cre/keeper/_tend.ts`
- `frontend/api/_handlers/cre/keeper/_report.ts`
- `frontend/api/_handlers/cre/keeper/_sweep.ts`
- `frontend/api/_handlers/cre/keeper/_markSettled.ts`
- `frontend/api/_handlers/cre/keeper/_alert.ts`
- `frontend/api/_handlers/cre/keeper/_aiAssess.ts`
- `frontend/api/_handlers/cre/runtime/_ingest.ts`
- `frontend/api/_handlers/cre/runtime/_decisions.ts`
- `frontend/api/_handlers/cre/runtime/_trigger.ts`
- `frontend/api/_handlers/_routes.ts`
- `frontend/server/agent/eliza/llm.ts`

## Simulation-First Proof (Hackathon)

All commands below were run from `cre/cre-workflows` and logs were saved under `docs/hackathon/evidence`.

```bash
# Terminal A: start local mock API bridge
set -a && source .env && set +a
node ../scripts/hackathon/mock-cre-api-server.mjs

# Terminal B: DeFi + AI orchestration proof
cre workflow simulate ./payout-integrity --target local-simulation \
  | tee ../../docs/hackathon/evidence/cre-payout-integrity-local-simulation.log

# Terminal B: Queue orchestration proof
cre workflow simulate ./keepr-queue --target local-simulation \
  | tee ../../docs/hackathon/evidence/cre-keepr-queue-local-simulation.log
```

Expected output highlights:
- `payout-integrity`: `AI assessment: enabled=true verdict=critical confidence=0.93`
- `payout-integrity`: `alertsSent: 2` with deterministic alerts in result payload
- `keepr-queue`: `processed=0 succeeded=0 failed=0 retried=0 skipped=0`

## What It Does

Every 5 minutes, the unified `4626` workflow runs six tasks in sequence:

| Task | What | Impact |
|------|------|--------|
| **Vault Keeper** | Deploy idle funds (`tend`), harvest yields (`report`) | Revenue |
| **Ajna Bucket Manager** | Move Ajna liquidity buckets using oracle TWAP + local liquidity | Risk/Execution |
| **Charm Rebalance Manager** | Trigger Charm vault `rebalance()` when price deviates by >= configured threshold | Risk/Execution |
| **Auction Settlement** | Attempt canonical completion for graduated CCA auctions (`sweepCurrency`, `migrate`, optional hook config, `sweepUnsoldTokens`) | Feature |
| **Keepr Queue** | Process pending XMTP group ops + Neynar/Farcaster actions | Infrastructure |
| **Bridge Integrity Monitor** | Monitor bridge signer overlap, canonical route/scalar drift, and liveness freshness | Risk/Integrity |

An optional always-on listener complements cron for lower-latency strategy reactions:

| Service | What | Mode |
|---------|------|------|
| **Strategy Event Listener** | Subscribes to oracle v3Pool `Swap` events, evaluates Ajna/Charm thresholds, enqueues deduped strategy actions | Continuous (WebSocket) |

Cron Ajna/Charm workflows stay enabled as fallback heartbeat and recovery path.

## Problem This Solves

4626 runs a multi-strategy, multi-chain protocol surface where value-critical operations span onchain state, external systems, and asynchronous workflows. Without deterministic orchestration, operators face:

- missed or delayed actions (settlements, keeper actions, risk actions),
- duplicated execution risk under retries and network instability,
- inconsistent data assumptions across systems.

This CRE layer solves that by making execution deterministic, auditable, and idempotent.

## Why This Secures Value

- **Reliable prices:** Chainlink Data Feeds and MVR reads provide accurate, reliable, non-manipulable reference inputs.
- **Tamper-proof randomness:** Chainlink VRF 2.5 gives cryptographic proof randomness was generated from the request path.
- **Verified offchain orchestration:** CRE executes offchain computation in deterministic workflow paths with capability-level guardrails.
- **Operational safety:** idempotency keys, checkpoints, and replay-protection reduce duplicate writes and race-condition failures.

## Chainlink Product Strengths Used Here

| Product | Strength | Where used |
|---|---|---|
| **CRE** | Verified offchain computation with deterministic trigger/capability orchestration | `cre/cre-workflows/**` |
| **Data Feeds + MVR** | Reliable, tamper-resistant oracle data for strategy and risk inputs | `cre/cre-workflows/runtime-reference-feeds/main.ts` |
| **VRF 2.5** | Cryptographically verifiable randomness for fair lottery outcomes | `contracts/utilities/lottery/vrf/CreatorVRFConsumerV2_5.sol`, `contracts/utilities/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol` |

## Roadmap (Including Rebalance Direction)

- **Now:** deterministic CRE orchestration for indexing, data fetch, feed verification, and decision checkpointing.
- **Next:** broaden low-latency event triggers and protocol guardrail workflows.
- **Rebalance roadmap:** today automation handles strategy-specific rebalancing (Ajna bucket movement, Charm vault rebalance). Next phase adds cross-strategy reallocation between Ajna, Charm, and idle balances under deterministic policy constraints.
- **Later:** migrate more write paths to native CRE report receivers for end-to-end verifiable execution.

### Payout Integrity Monitor

A dedicated CRE workflow runs every 30 minutes to verify the full fee pipeline:

| Check | What | Severity |
|-------|------|----------|
| **externalRevenueRecipient** | Creator Coin `payoutRecipient()` matches configured lane mode (`payout_router` or `gauge`) | Critical |
| **tradeFeeCollector** | ShareOFT `gaugeController()` matches expected collector (typically gauge) | Critical |
| **BPS Config** | `burnShareBps + lotteryShareBps + creatorShareBps + protocolShareBps == 10000` | Critical |
| **Vault Wiring** | GaugeController's `vault()` matches registered vault | Critical |
| **Burn Stream** | Active epoch not stale (>24h without `drip()`) | Warning |
| **Gauge Balance** | GaugeController holds shares and `lastDistribution` is fresh | Warning |

Alerts are sent to `POST /api/cre/keeper/alert` and forwarded to the configured webhook.

### Settlement Tracking

Auction settlement is a one-time event (~7 days after deployment). The system tracks:

- `graduated_at` — when `isGraduated()` first returns true
- `settlement_stage` — current completion phase (`graduated_detected`, `awaiting_migration_block`, `awaiting_owner_hook_config`, `completed`, ...)
- `settled_at` — only after canonical completion (`sweepCurrency` + `migrate` + hook policy satisfied)

Once settled, vaults are excluded from the auction-settlement workflow to avoid redundant reads. The on-chain `sweepCurrencyBlock` check remains a secondary guard.
## Solana Workflows

The Solana integration runs as separate workflows (cron-driven, independent from the unified 4626 runner):

| Workflow | What | Schedule |
|----------|------|----------|
| **keepr-solana-relay-entries** | Relay PendingEntries PDAs to Base | 30s |
| **keepr-solana-settle-fees** | Settle TransferFeeConfig fees to Base gauge | 5m |
| **keepr-solana-winner-relay** | Relay Base winners to Solana WinnerRecord PDA | 1m |
| **keepr-solana-graduation** | Close Alpha Vault when Base CCA graduates | 1m |
| **keepr-solana-price-monitor** | Monitor DLMM price + recenter on deviation | 1m |
| **bridge-integrity-monitor** | Monitor bridge route/scalar/liveness invariants from 4626 integration layer | 5m |

Required env vars for Solana workflows (see `secrets.example.env`):
- `SOLANA_RPC_URL`
- `SOLANA_KEEPER_KEYPAIR` or `SOLANA_KEEPER_KEYPAIRS`
- `SOLANA_KEEPER_PUBKEY`
- `SOLANA_CREATOR_MINTS`
- `SOLANA_SHARE_OFT_MAPPING`
- `SOLANA_BRIDGE_ADAPTER`
- `LOTTERY_MANAGER`

Optional operational hardening for the winner relay:
- `SOLANA_WINNER_RELAY_STATE_FILE` to persist Base event checkpoints across process restarts
- `SOLANA_CREATOR_COIN_TO_MINT_MAPPING_FILE` for file-backed creatorCoin → Solana mint mappings
- `SOLANA_TWIN_TO_PUBKEY_MAPPING_FILE` for file-backed Twin → Solana pubkey mappings

## Solana Launch Scripts

TypeScript launch helpers for DLMM + Alpha Vault:

```bash
# Create DLMM pool (requires DLMM_* env vars)
npm run solana:create-dlmm-pool

# Create Pro Rata Alpha Vault (requires ALPHA_VAULT_* env vars)
npm run solana:create-alpha-vault
```

## Solana Authority Lifecycle

Phase A/B/C authority actions (Token-2022 mint + program upgrade authority):

```bash
# Phase A: move mint authorities to multisig
AUTHORITY_TYPES=mint_tokens,transfer_fee_config,withheld_withdraw,transfer_hook_program_id \
NEW_AUTHORITY=MultisigPubkey \
npm run solana:set-token-authority

# Phase B: revoke hook reassignment authority
AUTHORITY_TYPES=transfer_hook_program_id NEW_AUTHORITY=none \
npm run solana:set-token-authority

# Phase C: revoke program upgrade authority (optional)
NEW_UPGRADE_AUTHORITY=none npm run solana:set-program-upgrade-authority
```

## Token Badge Applications

Prepare application payloads for Meteora/Orca support:

```bash
BADGE_TARGET=meteora npm run solana:prepare-token-badge
BADGE_TARGET=orca npm run solana:prepare-token-badge
```

The command prints two artifacts:
- token metadata JSON payload (mint/name/symbol/uri/image/extensions)
- a ready-to-submit token-list entry payload (`chainId`, `address`, `symbol`, `name`, `decimals`, `logoURI`, `extensions.metadata`)

`logoURI` resolution order:
1. if `CREATOR_TOKEN` is provided, default to
   `https://<api-origin>/v1/token/<creator-token>/image?chain=<creator-chain>&style=raw&format=png`
   (stable proxy pattern)
2. otherwise use `TOKEN_IMAGE` / `TOKEN_IMAGE_URL` (explicit image)
3. if both are set, proxy wins by default; set `TOKEN_IMAGE_EXPLICIT_OVERRIDE=1` to force explicit image

For reliable wallet/aggregator icon display (Phantom/Backpack/Jupiter/Meteora),
complete all of the following:
1. host a stable metadata URI (`TOKEN_METADATA_URI` or `TOKEN_URI`)
2. use proxy fallback via `CREATOR_TOKEN` (or explicit image override when intentional)
3. submit the generated token-list entry to the target ecosystem indexers
4. avoid changing metadata/image URLs after launch

## Solana Deployment Scripts

Program + mint setup, PDA initialization, and supply bridging:

```bash
# Upgrade Anchor program (uses solana CLI)
npm run solana:upgrade-program

# Create Token-2022 mint (TransferFeeConfig + TransferHook)
npm run solana:create-token-2022-mint

# Initialize CreatorConfig + PendingEntries + WinnerRecord + ExtraAccountMetaList
npm run solana:init-creator-pdas

# Bridge initial supply to Solana
npm run solana:bridge-supply
```

## Architecture

### Legacy Runner (local `tsx runner.ts`)

```
cron (*/5 * * * *)
    │
    ▼
┌──────────────────────┐
│  4626.workflow.ts     │
│  (unified entrypoint) │
└──────────┬───────────┘
           │
    ┌──────┼──────────────────┐
    ▼      ▼                  ▼
 Vault   Auction           Keepr
 Keeper  Settlement        Queue
    │      │                  │
    ▼      ▼                  ▼
 Onchain  Onchain          HTTP API
 (viem)   (viem)           (Vercel)
    │      │                  │
    └──────┴──────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
 Registry API   Alerts
 (vault list)   (webhook)
```

### CRE SDK Workflows (Chainlink DON)

```
Chainlink DON
    │
    ├── keepr-queue (every 30s)
    │       └── HTTPClient → Vercel API
    │
    ├── vault-keeper (every 5m)
    │       ├── EVMClient → read vault state (Base)
    │       └── HTTPClient → POST /cre/keeper/tend|report
    │
    ├── auction-settlement (hourly, unsettled vaults only)
    │       ├── HTTPClient → GET /cre/vaults/active?settled=false
    │       ├── EVMClient → currentAuction, isGraduated, sweepCurrencyBlock
    │       ├── HTTPClient → POST /cre/keeper/sweep
    │       └── HTTPClient → POST /cre/keeper/mark-settled
    │
    └── payout-integrity (every 30m)
            ├── HTTPClient → GET /cre/vaults/active
            ├── EVMClient → externalRevenueRecipient, tradeFeeCollector, BPS x4,
            │                vault, lastDistribution, burnStream x3, balanceOf
            └── HTTPClient → POST /cre/keeper/alert (on failure)
```

The CRE stack now has two write models:

- most workflows still use the existing **HTTP bridge pattern**, where on-chain
  reads happen directly via `EVMClient` and writes are delegated to Vercel API
  endpoints that execute transactions with the shared keeper wallet
- canonical Ajna automation is different: opted-in vaults carry a per-vault
  signer context, and Ajna writes execute from the creator's canonical Coinbase
  Smart Wallet using that creator's Privy embedded EOA as the signer bridge

There is **no** fallback from canonical Ajna execution to the shared protocol
keeper wallet when the per-vault context is missing, revoked, or invalid.

## Setup

### 1. Create `.env`

```bash
cp secrets.example.env .env
```

Required:
- `KEEPR_PRIVATE_KEY` — EOA private key for the keeper wallet
- `BASE_RPC_URL` — Base mainnet RPC
- `KEEPR_API_BASE_URL` — Your deployment (e.g. `https://4626.fun/api`)
- `KEEPR_API_KEY` — API key for CRE-to-Vercel auth

Optional (ERC-4337 smart wallet mode for shared/global keeper workflows):
- `CRE_ERC4337_ENABLED=true`
- `CRE_ERC4337_SMART_WALLET` — canonical smart wallet address (UserOp sender)
- `CRE_ERC4337_BUNDLER_URL` — bundler endpoint (CDP or compatible)
- `CRE_ERC4337_PAYMASTER_URL` — paymaster endpoint (optional)
- `CRE_ERC4337_OWNER_PRIVATE_KEY` — EOA signer for UserOps (must be an onchain owner)
- `CRE_ERC4337_VERSION` — Coinbase Smart Wallet version (`1` or `1.1`)
- `CRE_ERC4337_PRIVY_WALLET_ID` — use Privy Wallet API for signing
- `CRE_ERC4337_OWNER` — owner address (required for Privy signer)
- `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_WALLET_AUTHORIZATION_KEY` — required for Privy signer

Optional (alerting):
- `KEEPR_ALERT_WEBHOOK_URL` — webhook URL for payout-integrity and settlement alerts

Optional (Ajna bucket manager):
- `AJNA_BUCKET_VAULT_ADDRESS` / `AJNA_BUCKET_ORACLE_ADDRESS` — explicit single-vault targeting for Ajna bucket workflow
- `AJNA_BUCKET_CANONICAL_CSW_ADDRESS` / `AJNA_BUCKET_EMBEDDED_EOA_ADDRESS` / `AJNA_BUCKET_PRIVY_WALLET_ID` — explicit canonical sender context for manual/single-vault Ajna runs
- `AJNA_BUCKET_CSW_VERSION` — optional Coinbase Smart Wallet version override for single-vault Ajna runs (`1` or `1.1`)
- `AJNA_BUCKET_TWAP_DURATION`, `AJNA_BUCKET_TARGET_LTV_BPS`, `AJNA_BUCKET_PRICE_CHANGE_TRIGGER_BPS`
- `AJNA_BUCKET_MOVE_THRESHOLD`, `AJNA_BUCKET_MAX_STEP`
- `AJNA_BUCKET_MOVE_COOLDOWN_SECONDS`, `AJNA_BUCKET_LIQUIDITY_SEARCH_RADIUS`

Canonical Ajna notes:
- creator opt-in is per vault and currently scoped to `ajna_min_bucket_only`
- sender is the creator's canonical CSW, not the protocol keeper wallet
- signer bridge is the creator's Privy embedded EOA, not the XMTP server signer
- new deploy-session launches on the auto-handoff batcher should already have `AjnaVaultAuth.admin = canonical CSW`
- if canonical context cannot be proven, Ajna actions hard-stop with `canonical_sender_required:*`

Optional (Charm rebalance manager):
- `CHARM_REBALANCE_VAULT_ADDRESS` / `CHARM_REBALANCE_ORACLE_ADDRESS` — explicit single-vault targeting for Charm workflow
- `CHARM_REBALANCE_TWAP_DURATION`, `CHARM_REBALANCE_PRICE_CHANGE_TRIGGER_BPS`

Optional (strategy event listener):
- `BASE_WS_RPC_URL` — Base WebSocket RPC for `Swap` subscriptions
- `STRATEGY_EVENT_DEBOUNCE_MS`, `STRATEGY_EVENT_COOLDOWN_SECONDS`, `STRATEGY_EVENT_MAX_ACTIONS_PER_HOUR`
- `STRATEGY_EVENT_STATE_FILE`, `STRATEGY_EVENT_BACKFILL_CHUNK_BLOCKS`, `STRATEGY_EVENT_START_LOOKBACK_BLOCKS`, `STRATEGY_EVENT_BACKLOG_ALERT_BLOCKS`
- `STRATEGY_EVENT_RECONNECT_DELAY_MS`, `STRATEGY_EVENT_RECONNECT_DELAY_MAX_MS`, `STRATEGY_EVENT_RECONNECT_BACKOFF_MULTIPLIER`
### 2. Register Vaults

Each vault is registered via `POST /api/keepr/vault/upsert`. Include contract addresses in `config_json`:

```json
{
  "contracts": {
    "ccaStrategy": "0x...",
    "gaugeController": "0x...",
    "burnStream": "0x..."
  }
}
```

- **Vault Keeper** processes every registered vault (only needs `vault_address`)
- **Auction Settlement** only processes vaults with `contracts.ccaStrategy` that are not yet settled
- **Payout Integrity** only processes vaults with `contracts.gaugeController`
- **Keepr Queue** processes all pending actions regardless of vault

### 3. Authorize the Keeper

```bash
# Per vault — authorize the keeper wallet
cast send $VAULT --rpc-url $RPC "setKeeper(address)" $KEEPER_ADDRESS
```

If ERC-4337 is enabled, `KEEPER_ADDRESS` must be the smart wallet
(`CRE_ERC4337_SMART_WALLET`). Otherwise, use the EOA derived from
`KEEPR_PRIVATE_KEY`.

Auction settlement is permissionless — no auth needed.

Ajna exception: canonical Ajna automation does **not** use this shared keeper
authorization. For opted-in vaults, `AjnaVaultAuth.admin()` must remain the
creator's canonical CSW, and Ajna actions fail closed if that relationship no
longer holds.

Legacy vault migration:

- if older vaults still have `AjnaVaultAuth.admin != canonical CSW`, run the Safe backfill script from the frontend workspace:
  - `pnpm -C frontend exec tsx scripts/ops/ajna-admin-backfill-safe.ts --origin https://4626.fun --only-enabled`
  - then re-run with `--propose --safe-address <SAFE> --safe-owner-pk <PK>` to submit `setAdmin(canonicalCsw)` proposals.
- CRE Ajna workflows should remain fail-closed until this migration is complete for each mismatched vault.

### 4. Fund the Keeper

Send **0.1 ETH** to the keeper wallet on Base.

This funds the shared keeper path for non-Ajna workflows. Canonical Ajna
automation instead uses the creator's CSW/embedded-EOA path and does not
fallback to the funded shared keeper.

## Running

```bash
cd cre
npm install

# Run everything
npm start

# Dry-run (simulates onchain writes)
npm run dry-run

# Run individual tasks
npm run start:vault-keeper
npm run start:ajna-bucket-manager
npm run start:charm-rebalance-manager
npm run start:auction-settlement
npm run start:keepr-queue
npm run start:strategy-event-listener
npm run start:bridge-integrity-monitor

# Tests
npm test
```

## Directory Structure

```
cre/
├── config.ts                           # ABIs, timing constants
├── runner.ts                           # Local CLI runner (legacy)
├── package.json
│
├── cre-workflows/                      # ← Official CRE SDK project
│   ├── project.yaml                    # CRE project config (RPC, targets)
│   ├── secrets.yaml                    # CRE secrets references
│   ├── .env                            # Local simulation secrets
│   ├── .gitignore                      # Excludes .wasm, .cre/, .env
│   ├── contracts/abi/                  # Shared ABI exports
│   │   ├── Vault.ts
│   │   ├── CCAStrategy.ts
│   │   ├── GaugeController.ts
│   │   ├── BurnStream.ts
│   │   ├── CreatorCoin.ts
│   │   ├── ERC20.ts
│   │   └── index.ts
│   ├── keepr-queue/                    # HTTP-only queue processor
│   │   ├── main.ts                     # CRE workflow (CronCapability + HTTPClient)
│   │   ├── workflow.yaml
│   │   ├── config.staging.json
│   │   ├── config.production.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── vault-keeper/                   # EVM reads + HTTP bridge writes
│   │   ├── main.ts                     # CRE workflow (EVMClient + HTTPClient)
│   │   ├── workflow.yaml
│   │   ├── config.staging.json
│   │   ├── config.production.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── auction-settlement/             # Smart polling (hourly, DB-tracked)
│   │   ├── main.ts                     # CRE workflow (EVMClient + HTTPClient)
│   │   ├── workflow.yaml
│   │   ├── config.staging.json
│   │   ├── config.production.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── payout-integrity/              # Fee pipeline monitor (every 30m)
│       ├── main.ts                     # CRE workflow (EVMClient + HTTPClient)
│       ├── workflow.yaml
│       ├── config.staging.json
│       ├── config.production.json
│       ├── package.json
│       └── tsconfig.json
│
├── workflows/                          # Legacy runner workflows
│   ├── 4626.workflow.ts                # Unified entrypoint (runs all 5)
│   ├── vault-keeper.workflow.ts        # Standalone vault keeper
│   ├── ajna-bucket-manager.workflow.ts # Standalone Ajna bucket manager
│   ├── charm-rebalance-manager.workflow.ts # Standalone Charm rebalance manager
│   ├── auction-settlement.workflow.ts  # Standalone auction settlement
│   ├── keepr-queue-executor.workflow.ts
│   └── strategy-event-listener.workflow.ts # Always-on WS listener (event-driven queue enqueue)
├── actions/
│   ├── vault-keeper.action.ts          # tend/report logic (multi-vault)
│   ├── auction-settlement.action.ts    # sweep logic (multi-vault, sweepCurrencyBlock guard)
│   ├── keepr-queue-executor.action.ts  # XMTP/Neynar queue processor
│   └── strategy-event-listener.action.ts # Swap event listener + trigger evaluation
├── utils/
│   ├── onchain.ts                      # viem clients, read/write/dry-run
│   ├── registry.ts                     # Vault registry client
│   ├── alerts.ts                       # Webhook alerting
│   └── strategy-event-state.ts         # .state persistence (lastProcessedBlock/cooldowns/rate limit)
├── tests/
│   ├── vault-keeper.test.ts
│   └── auction-settlement.test.ts
└── secrets.example.env
```

### systemd Example (Strategy Event Listener)

Use a dedicated unit so cron workflows remain independent:

```ini
[Unit]
Description=4626 strategy event listener
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=app4626
Group=app4626
WorkingDirectory=/opt/4626/cre
EnvironmentFile=/etc/4626/cre.env
ExecStart=/usr/bin/env pnpm --dir /opt/4626/cre start:strategy-event-listener
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cre/vaults/active` | GET | Returns all registered vaults (supports `?settled=false` filter) |
| `/api/cre/keeper/tend` | POST | HTTP bridge — calls `tend()` on a vault |
| `/api/cre/keeper/report` | POST | HTTP bridge — calls `report()` on a vault |
| `/api/cre/keeper/sweep` | POST | HTTP bridge — canonical completion attempt (`sweepCurrency`, `migrate`, optional hook config, best-effort `sweepUnsoldTokens`) |
| `/api/cre/keeper/mark-settled` | POST | Records `graduated_at`, `settled_at`, and `settlement_stage` in DB |
| `/api/cre/keeper/alert` | POST | Receives alerts from CRE workflows, forwards to webhook |
| `/api/cre/keeper/aiAssess` | POST | AI advisory classification endpoint for payout-integrity (deterministic checks remain authoritative) |
| `/api/cre/runtime/ingest` | POST/GET | Receives runtime workflow outputs and returns latest indexed snapshots |
| `/api/cre/runtime/decisions` | POST | Stores runtime orchestration decisions, optional queue enqueue |
| `/api/cre/runtime/trigger` | POST | App-to-CRE HTTP trigger dispatch (JSON-RPC + JWT auth) |
| `/api/keepr/actions/enqueue` | POST | Enqueues deduped strategy/XMTP actions |
| `/api/keepr/actions/pending` | GET | Returns pending queue actions |
| `/api/keepr/actions/updateStatus` | POST | Updates action status |

All require `Authorization: Bearer $KEEPR_API_KEY`.

## CRE SDK Workflows

### Prerequisites

1. **CRE CLI** installed (`cre version` should return v1.0.10+)
2. **Bun** v1.0+ installed
3. **CRE account** — run `cre login` to authenticate

### Running CRE Workflows

```bash
# Install dependencies for a workflow
cd cre/cre-workflows/keepr-queue && bun install

# Simulate locally (requires cre login)
cd cre/cre-workflows
cre workflow simulate keepr-queue --target local-simulation
cre workflow simulate vault-keeper --target local-simulation
cre workflow simulate auction-settlement --target local-simulation
cre workflow simulate payout-integrity --target local-simulation

# Deploy to DON (requires cre login + funded account)
cre workflow deploy keepr-queue --target production-settings
cre workflow deploy payout-integrity --target production-settings
```

### CRE Secrets

Set secrets before deploying:

```bash
cre secrets set KEEPR_API_KEY
cre secrets set KEEPR_API_BASE_URL
cre secrets set KEEPR_PRIVATE_KEY
```

For local simulation, add these to `cre/cre-workflows/.env`.

### CRE Quota Constraints

| Resource | Limit | Impact |
|----------|-------|--------|
| EVM reads | ~11 per execution | vault-keeper: 1 vault per run; payout-integrity: 1 vault per run |
| HTTP calls | 5 per execution | keepr-queue: 2 actions per run |
| Cron interval | 30s minimum | keepr-queue uses 30s; auction-settlement uses 1h |
| Concurrent capabilities | 3 | Sequential reads within each workflow |
| Execution timeout | 5 minutes | All workflows complete well within this |

### CRE Quota Budget

**auction-settlement (hourly)**:
- 1 HTTP (fetch unsettled vaults) + 3 EVM reads (currentAuction, isGraduated, sweepCurrencyBlock) + 1 HTTP (sweep) + 1 HTTP (mark-settled) = 3 HTTP + 3 EVM reads

**payout-integrity (every 30 min, 1 vault per run)**:
- 1 HTTP (fetch vaults) + ~11 EVM reads (externalRevenueRecipient, tradeFeeCollector, BPS x4, vault, lastDistribution, burnStream x3, balanceOf) + 1 HTTP (alert if needed) = 2 HTTP + 11 EVM reads

### HTTP Bridge Pattern

Most CRE workflows cannot directly write to contracts (CRE uses a
report-and-forwarder model). Instead, those workflows delegate writes to
Vercel API endpoints:

```
CRE Workflow → HTTPClient.sendRequest(POST /cre/keeper/tend) → Vercel API → viem writeContract → Base
```

The bridge endpoints authenticate with `KEEPR_API_KEY` and use the shared
keeper wallet (`KEEPR_PRIVATE_KEY`) to submit transactions.

Canonical Ajna automation is the current exception: Ajna bucket management can
execute directly from CRE using the vault's stored canonical sender context, or
enqueue canonical-only actions through the protected queue path. It does not
reuse the XMTP server-signer flow and does not downgrade to the shared keeper.

**Phase 4 (Future)**: Deploy `VaultKeeperReceiver` and `AuctionSettlementReceiver`
Solidity contracts implementing `IReceiver.onReport()` to enable native CRE writes
via `runtime.report()` + `evmClient.writeReport()`, removing the HTTP bridge.
