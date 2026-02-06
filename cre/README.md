# CRE Workflows — 4626

Chainlink Runtime Environment (CRE) workflows that automate critical onchain operations for the 4626 protocol.

**A single workflow manages every registered vault automatically.**

## What It Does

Every 5 minutes, the unified `4626` workflow runs three tasks in sequence:

| Task | What | Impact |
|------|------|--------|
| **Vault Keeper** | Deploy idle funds (`tend`), harvest yields (`report`) | Revenue |
| **Auction Settlement** | Settle graduated CCA auctions (`sweepCurrency`, `sweepUnsoldTokens`) | Feature |
| **Keepr Queue** | Process pending XMTP group ops + Neynar/Farcaster actions | Infrastructure |

## Architecture

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

### 2. Register Vaults

Each vault is registered via `POST /api/keepr/vault/upsert`. Include CCA strategy addresses in `config_json`:

```json
{
  "contracts": {
    "ccaStrategy": "0x..."
  }
}
```

- **Vault Keeper** processes every registered vault (only needs `vault_address`)
- **Auction Settlement** only processes vaults with `contracts.ccaStrategy`
- **Keepr Queue** processes all pending actions regardless of vault

### 3. Authorize the Keeper

```bash
# Per vault — authorize the keeper wallet
cast send $VAULT --rpc-url $RPC "setKeeper(address)" $KEEPER_ADDRESS
```

Auction settlement is permissionless — no auth needed.

### 4. Fund the Keeper

Send **0.1 ETH** to the keeper wallet on Base.

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
npm run start:auction-settlement
npm run start:keepr-queue

# Tests
npm test
```

## Directory Structure

```
cre/
├── config.ts                           # ABIs, timing constants
├── runner.ts                           # Local CLI runner
├── package.json
├── workflows/
│   ├── 4626.workflow.ts                # Unified entrypoint (runs all 3)
│   ├── vault-keeper.workflow.ts        # Standalone vault keeper
│   ├── auction-settlement.workflow.ts  # Standalone auction settlement
│   └── keepr-queue-executor.workflow.ts
├── actions/
│   ├── vault-keeper.action.ts          # tend/report logic (multi-vault)
│   ├── auction-settlement.action.ts    # sweep logic (multi-vault)
│   └── keepr-queue-executor.action.ts  # XMTP/Neynar queue processor
├── utils/
│   ├── onchain.ts                      # viem clients, read/write/dry-run
│   ├── registry.ts                     # Vault registry client
│   └── alerts.ts                       # Webhook alerting
├── tests/
│   ├── vault-keeper.test.ts
│   └── auction-settlement.test.ts
└── secrets.example.env
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cre/vaults/active` | GET | Returns all registered vaults |
| `/api/keepr/actions/pending` | GET | Returns pending queue actions |
| `/api/keepr/actions/updateStatus` | POST | Updates action status |

All require `Authorization: Bearer $KEEPR_API_KEY`.
