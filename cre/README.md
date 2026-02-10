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

## Solana Workflows

The Solana integration runs as separate workflows (cron-driven, independent from the unified 4626 runner):

| Workflow | What | Schedule |
|----------|------|----------|
| **keepr-solana-entry-relay** | Drain PendingEntries PDAs + relay entries to Base | 30s |
| **keepr-solana-fee-flush** | Harvest TransferFeeConfig fees + forward to Base gauge | 5m |
| **keepr-solana-winner-relay** | Relay Base winners to Solana WinnerRecord PDA | 1m |
| **keepr-solana-graduation** | Close Alpha Vault when Base CCA graduates | 1m |
| **keepr-solana-price-monitor** | Monitor DLMM price + recenter on deviation | 1m |

Required env vars for Solana workflows (see `secrets.example.env`):
- `SOLANA_RPC_URL`
- `SOLANA_KEEPER_KEYPAIR` or `SOLANA_KEEPER_KEYPAIRS`
- `SOLANA_KEEPER_PUBKEY`
- `SOLANA_CREATOR_MINTS`
- `SOLANA_SHARE_OFT_MAPPING`
- `SOLANA_BRIDGE_ADAPTER`
- `LOTTERY_MANAGER`

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

Optional (ERC-4337 smart wallet mode):
- `CRE_ERC4337_ENABLED=true`
- `CRE_ERC4337_SMART_WALLET` — canonical smart wallet address (UserOp sender)
- `CRE_ERC4337_BUNDLER_URL` — bundler endpoint (CDP or compatible)
- `CRE_ERC4337_PAYMASTER_URL` — paymaster endpoint (optional)
- `CRE_ERC4337_OWNER_PRIVATE_KEY` — EOA signer for UserOps (must be an onchain owner)
- `CRE_ERC4337_VERSION` — Coinbase Smart Wallet version (`1` or `1.1`)
- `CRE_ERC4337_PRIVY_WALLET_ID` — use Privy Wallet API for signing
- `CRE_ERC4337_OWNER` — owner address (required for Privy signer)
- `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_WALLET_AUTHORIZATION_KEY` — required for Privy signer

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

If ERC-4337 is enabled, `KEEPER_ADDRESS` must be the smart wallet
(`CRE_ERC4337_SMART_WALLET`). Otherwise, use the EOA derived from
`KEEPR_PRIVATE_KEY`.

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
