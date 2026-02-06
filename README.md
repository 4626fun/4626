# CreatorVault

**Zora coin + Smart Wallet + Farcaster identity + Base groupchats = the creator economy OS on Base.**

CreatorVault is the **Base-native creator finance layer** that turns **Zora Creator Coins (Coinbase Creator Coins)** into composable, onchain “creator economies” with FriendTech-like loops: discover → take action → share → engage. In one click, creators deploy institutional-grade **ERC-4626 vault** infrastructure (Yearn V3 architecture) with cross-chain **LayerZero V2 OFT** shares, pluggable **yield strategies**, and a **6.9% trading-fee lottery** (on all DEX trades) powered by **Chainlink VRF** — launched via **Uniswap CCA** and executed through **EIP-4337** account abstraction (optimized for Coinbase Smart Wallet / AA). The app pairs this finance layer with an aggregator UX that uses **Farcaster identity** signals, and is designed to extend into **Base group chats** for community coordination and gating.

**Elevator pitch (one line):** CreatorVault unifies Zora coins, Smart Wallet AA execution, and Farcaster identity into a Base-native vault + incentive layer for creator economies.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636)](https://docs.soliditylang.org/)
[![LayerZero](https://img.shields.io/badge/LayerZero-V2-7B3FE4)](https://layerzero.network/)
[![Multi-Chain](https://img.shields.io/badge/Chains-8+-4CAF50)](#supported-chains)
[![Tests](https://github.com/wenakita/4626/actions/workflows/test.yml/badge.svg)](https://github.com/wenakita/4626/actions/workflows/test.yml)
[![Lottery Tests](https://img.shields.io/badge/Lottery_Tests-88-blue)](#lottery-smart-wallet-compatibility)

---

## Project Metadata (AI-Friendly)

```json
{
  "name": "CreatorVault",
  "version": "1.0.0",
  "description": "Omnichain vault platform for creator coins with gas-free deployment, cross-chain OFT, pluggable yield strategies, and instant lottery incentives",
  "key_features": [
    "ERC-4626 vault (Yearn V3 architecture)",
    "LayerZero V2 omnichain share token (OFT)",
    "One-click deployment via EIP-4337 (gas-sponsored by Coinbase CDP)",
    "Uniswap V4 Continuous Clearing Auction (CCA) for fair launch",
    "6.9% trading fee (buys and sells) funding Chainlink VRF lottery",
    "Pluggable yield strategies",
    "Anti-whale guards and flash loan protection"
  ],
  "tokenomics": {
    "buy_fee": "6.9%",
    "sell_fee": "6.9%",
    "fee_mechanism": "6.9% fee collected on all DEX trades (buys and sells)",
    "fee_allocation": "69% lottery, 21.39% burn (PPS increase), 9.61% voter rewards",
    "lottery": "Instant lottery: $1 traded = 0.0004% instant win chance, Chainlink VRF for fairness"
  },
  "tech_stack": [
    "Solidity 0.8.20",
    "LayerZero V2 (cross-chain messaging)",
    "Chainlink VRF 2.5 (lottery randomness)",
    "Uniswap V4 (Continuous Clearing Auction + liquidity)",
    "EIP-4337 / EIP-5792 (account abstraction + batching)",
    "Yearn V3 (vault architecture)"
  ],
  "chains": ["Base (hub)", "Ethereum", "Arbitrum", "BSC", "Avalanche", "Monad", "Sonic", "HyperEVM"],
  "github": "https://github.com/wenakita/4626",
  "first_deployment": "akita Creator Coin (Base: 0x5b674196812451b7cec024fe9d22d2c0b172fa75)"
}
```

---

## Features

**CreatorVault provides a complete vault-as-a-service platform for Creator Coins. Each feature is designed to maximize creator revenue and community engagement:**

### Core Features

- **One-Click Deployment**: Deploy vault + wrapper + OFT + oracle + CCA strategy in a single gas-free transaction via **EIP-4337** account abstraction and **Coinbase CDP** paymaster.
- **Omnichain Shares**: **LayerZero V2 OFT** enables share tokens to move across 8+ chains with unified liquidity and cross-chain yield.
- **Pluggable Yield Strategies**: **ERC-4626** vault supports multiple strategies (e.g., Uniswap V4 LP, lending protocols, RWA yield) with configurable allocations.
- **Fair Launch via CCA**: **Uniswap Continuous Clearing Auction** provides transparent, DeFi-native price discovery with no front-running.
- **Instant Lottery**: 6.9% fee on all DEX trades (buys + sells) funds **Chainlink VRF lottery** - every trade is an instant lottery roll where **$1 traded = 0.0004% win chance** (e.g., $10k trade = 4% instant win chance).
- **Security**: Virtual shares offset, flash loan protection, anti-whale guards, minimum deposits, and queued large withdrawals.
- **Creator-first**: Each creator owns their vault ecosystem - fees split to lottery (69%), burn (21.39%), voter rewards (9.61%), full branding control.

### Tokenomics (6.9% Trading Fee Explained)

**The 6.9% fee applies to ALL DEX trades (buys and sells) and is the core incentive mechanism. Here's the exact flow:**

1. **Trade Event** -> User buys or sells share tokens (■AKITA, ■BRET, etc.) on a DEX (Uniswap V4 pool).
2. **Fee Collection** -> 6.9% of the trade amount is automatically deducted and sent to the **GaugeController** contract.
3. **GaugeController Routing** -> Fees are split: **69% to lottery prize pool**, **21.39% burned** (increases PPS for all holders), **9.61% to voter rewards**.
4. **Instant Lottery Roll** -> Trader's win probability is calculated instantly based on their trade size. Win chance scales linearly: **$1 traded = 0.0004% chance**, $100 = 0.04%, $1,000 = 0.4%, $10,000 = 4% (works for both buys and sells).
5. **Instant Prize Roll** -> **Chainlink VRF 2.5** provides provably fair randomness for each trade - win chance is checked instantly.
6. **Winner Payout** -> If the trader wins, they receive 69% of the accumulated prize pool immediately in **vault shares** (from ALL active creator vaults - diversified portfolio!).

**Key Details:**
- **6.9% on buys AND sells** -> Consistent fee on all trading activity (69% to lottery, 21.39% burned, 9.61% voter rewards).
- **Fee only on DEX trades** -> Deposits, withdrawals, and cross-chain transfers are NOT taxed.
- **6.9% choice** -> Playful nod to meme culture while maintaining sustainability (lower than typical 10-15% meme coin fees).

### Security Features

- **Anti-Inflation Attack**: Virtual shares offset (1e3), minimum first deposit (50,000,000 tokens), price change limits (10% max per tx).
- **Flash Loan Protection**: Block delay between deposit/withdraw, queued large withdrawals (100k+ tokens).
- **Access Control**: Role-based permissions (Owner, Management, Keeper, EmergencyAdmin) with 2-step ownership transfer.
- **Whale Guards**: Maximum single deposit limits, graduated fee tiers for large purchases.

---

## Architecture

CreatorVault’s architecture is built for **provenance, identity, and execution**:

- **Provenance (Zora)**: Creator Coins and Content Coins are the discovery layer and identity anchor.
- **Execution (Smart Wallet AA)**: creators can deploy and operate vault infrastructure via EIP-4337/EIP-5792-style batching.
- **Social context (Farcaster → Base)**: Farcaster identity is used as a trust signal in the app, and Base group chats are the natural coordination surface.

Onchain, CreatorVault consists of:

- **Shared infrastructure** (deployed once per chain, referenced via `CreatorRegistry`)
- **Per-creator vault stack** (deployed per creator coin)
- **Optional incentives layer** (ve(3,3) voting, voter rewards, bribes)

### Core Contracts (Text Description of Data Flow)

1. **CreatorOVault** (ERC-4626 Vault)
   - Holds deposited Creator Coins (e.g., akita tokens).
   - Mints vault shares (▢AKITA) representing proportional ownership.
   - Allocates deposits across multiple yield strategies.
   - Based on **Yearn V3** architecture (profit unlocking, strategy queues, debt purchasing).

2. **CreatorOVaultWrapper**
   - Wraps vault shares (▢AKITA) into **LayerZero OFT** share tokens (■AKITA).
   - Enables cross-chain transfers via LayerZero V2 messaging.
   - 1:1 wrapping ratio (no dilution).

3. **CreatorShareOFT** (LayerZero V2 OFT)
   - **Omnichain fungible token** - same token on all chains.
   - Collects **6.9% fee on all DEX trades** (buys and sells) via `setAddressType` for DEX pools.
   - Routes fees to **CreatorGaugeController** (which funds the lottery and, when enabled, voter rewards).
   - Triggers instant lottery roll for all traders (win or lose determined immediately).

4. **CreatorGaugeController**
   - Receives trading fees from all share tokens and splits: 69% lottery, 21.39% burn, 9.61% voter rewards.
   - Unwraps fees into vault shares and routes them by configured splits:
     - jackpot reserve (default: 69%)
     - burn / PPS increase (default: 21.39%, off by default)
     - voter rewards (default: 9.61%) to `VoterRewardsDistributor` when configured (otherwise falls back to `protocolTreasury`)

5. **CreatorLotteryManager**
   - **Shared service** (one per chain): triggered by approved swap contracts.
   - Calculates instant win probability (percentage-based: $1 traded = 0.0004% chance).
   - Integrates **Chainlink VRF 2.5** for provably fair randomness on every qualifying trade.
   - Winners receive 69% of jackpot reserve in **vault shares from ALL active creator vaults** (diversified prize!).
   - **Instant lottery** - each trade is an independent roll, winners paid immediately.
   - Optional boosts:
     - personal boost via `ve4626BoostManager`
     - vote-directed boost via `VaultGaugeVoting` (bounded weekly budget)

6. **CreatorCCAStrategy** (Uniswap CCA Integration)
   - Allocates vault assets to **Uniswap Continuous Clearing Auction** for fair launch price discovery.
   - After auction ends, migrates liquidity to Uniswap V4 pool for ongoing trading.

7. **CreatorOracle** (Price Oracle)
   - Tracks real-time share token price via **Uniswap V4 TWAP**.
   - Used for vault accounting and lottery prize valuations.

8. **CreatorRegistry**
   - Central registry for all platform contracts.
   - Maps Creator Coins -> (Vault, Wrapper, OFT, GaugeController, Lottery).
   - Stores chain configurations (LayerZero endpoints, DEX infrastructure).

### Deployment Flow (CreatorVaultDeployer Phases 1–3 + Activation)

**User-facing goal**: one creator flow from `/deploy` (wallet/bundler may execute multiple transactions under the hood).

```
User clicks "Deploy" -> wallet/bundler executes a phased sequence

Phase 1 — deterministic deploy (CreatorVaultDeployer):
- deploy per-creator contracts (vault, wrapper, share OFT, gauge controller, oracle, CCA strategy, etc.)
- register them in CreatorRegistry

Phase 2 — configuration (CreatorVaultDeployer):
- wire roles + addresses (vault↔wrapper↔OFT, gauge controller config, oracle config, etc.)
- set required approvals/launch permissions

Phase 3 — optional activation + launch:
- for “go live” actions (deposit → wrap → start CCA), use `VaultActivationBatcher`
- wallets that support batching can combine approve+activate; otherwise execute sequentially

Notes:
- Gas sponsorship depends on the configured paymaster/bundler; not all wallets/chains will be sponsored.
```

### Token Flow Diagram (Text)

```
Creator Coin (akita)
   v Deposit
CreatorOVault (▢AKITA shares)
   v Wrap
CreatorOVaultWrapper
   v Mint
CreatorShareOFT (■AKITA)
   v Bridge
LayerZero V2 Messaging -> Arbitrum, Ethereum, BSC, etc.
   v Unwrap on destination chain
▢AKITA -> Redeem -> akita (if available on that chain)
```

**Trading Fee Flow:**

```
User trades ■AKITA on Uniswap V4 (buy or sell)
   v 6.9% fee deducted
CreatorShareOFT.transfer hook
   v Send fee
CreatorGaugeController
   v Route by configured split (jackpot reserve + optional burn + optional voter rewards slice)
CreatorLotteryManager (prize pool)
   v Calculate percentage-based win chance ($1 = 0.0004%)
   v Instant Chainlink VRF roll -> Winner (if lucky) receives 69% of prize pool in vault shares
```

### Incentives Layer (optional): ve4626 + ve(3,3)

This layer can be deployed and enabled after the core system is live.

- **ve4626**: vote-escrow token that represents locked power.
- **ve4626BoostManager**: exposes personal boost signals used by `CreatorLotteryManager`.
- **VaultGaugeVoting**: weekly voting that allocates a bounded probability budget across whitelisted vaults.
- **VoterRewardsDistributor**: receives the voter slice (9.61% default) from each `CreatorGaugeController` and lets voters claim pro-rata per epoch/vault.
- **BribesFactory / BribeDepot**: optional external bribes per vault (epoch-scoped).

---

## Tokenomics & Incentives (Detailed)

### Fee Structure

| Action | Fee | Recipient | Notes |
|--------|-----|-----------|-------|
| **DEX Buy** (e.g., Uniswap V4) | **6.9%** | GaugeController -> Lottery | Applies to all token purchases on DEX pools |
| **DEX Sell** (e.g., Uniswap V4) | **6.9%** | GaugeController -> Lottery | Applies to all token sales on DEX pools |
| **Vault Deposit** (akita -> ▢AKITA) | **0%** | N/A | Direct deposits are free |
| **Vault Withdrawal** (▢AKITA -> akita) | **0%** | N/A | Withdrawals are free |
| **Cross-Chain Bridge** (via LayerZero) | **0%** + gas | LayerZero relayers | Only pay LayerZero messaging fees (~ $1-5 depending on chain) |

### Lottery Mechanics (Provably Fair)

1. **Instant Win Chance** (Percentage-Based):
   - Every DEX trade (buy or sell) has an instant chance to win proportional to USD trade value.
   - **Win Formula**: For every **$1 traded** = **0.0004% instant win chance**.
   - **Examples**:
     - $1 trade = 0.0004% chance to win instantly
     - $10 trade = 0.004% chance to win instantly
     - $100 trade = 0.04% chance to win instantly
     - $1,000 trade = 0.4% chance to win instantly
     - $10,000 trade = 4% chance to win instantly
   - Each trade is an independent roll - win or lose is determined immediately.

2. **Prize Pool Growth**:
   - 69% of 6.9% trading fees -> Lottery prize pool (21.39% burned, 9.61% to voter rewards).
   - Example: $1M daily volume -> $69,000 in fees -> ~$47,610 to lottery (69%), ~$14,770 burned (21.39%), ~$6,620 voter rewards (9.61%).

3. **Instant Drawing Process**:
   - Every trade triggers an instant lottery roll - no waiting for weekly/monthly draws.
   - **Chainlink VRF 2.5** requests random number onchain for each qualifying trade.
   - Random number determines if trader wins based on their trade-size percentage chance.
   - Example: $10,000 trade = 4% chance -> VRF roll -> if lucky, instant win.
   - Winner receives 69% of the accumulated prize pool immediately in **vault shares from ALL active creator vaults**.

4. **Transparency**:
   - All trades, win probabilities, VRF rolls, and payouts are onchain and auditable.
   - VRF randomness is cryptographically verifiable.
   - Anyone can verify the math: (Trader's USD volume) x 0.0004% = Win chance.

### Incentive Alignment

- **Creators**: Lottery drives trading volume -> more liquidity -> higher token price -> more fees collected -> larger prize pools.
- **Traders**: Every trade triggers instant lottery roll (larger trades = higher win probability) -> FOMO + gamification -> more trading activity.
- **Whales**: $10,000 trade = 4% chance to win -> Incentivizes large trades while keeping small traders competitive.
- **Holders**: Prize pool grows with trading volume -> incentive to participate in ecosystem -> every trade is a new chance to win.
- **Platform**: Sustainable revenue via 6.9% trading fees -> 69% lottery, 21.39% burn (PPS increase), 9.61% voter rewards (no direct platform take).

---

## One-Click Gas-Free Deployment (EIP-4337)

**CreatorVault supports 1-click, gas-free deployment via account abstraction:**

### Powered By

- **EIP-5792**: Batch transaction execution (`wallet_sendCalls`) - all 10 deployment steps in one signature.
- **EIP-4337**: Account abstraction for smart wallet support (Coinbase Smart Wallet, Safe, etc.).
- **Coinbase CDP**: Paymaster service sponsors gas fees (~$50-100 saved per deployment).

### Setup (Optional but Recommended)

**To enable gas-free deployments, configure the Coinbase CDP paymaster endpoint (server-only):**

1. Get CDP API key from [Coinbase Developer Portal](https://portal.cdp.coinbase.com/).
2. Add to `.env`:

```bash
# Client-side: always use the same-origin proxy
VITE_CDP_PAYMASTER_URL=/api/paymaster
# Server-side: real CDP paymaster endpoint (keep secret)
CDP_PAYMASTER_URL=https://api.developer.coinbase.com/rpc/v1/base/<CDP_API_KEY_ID>
```

3. Restart dev server:

```bash
cd frontend
pnpm dev
```

### How It Works

1. **User connects** with Coinbase Smart Wallet (or any EIP-5792 compatible wallet).
2. **Deploy button clicked** -> Frontend prepares batch call.
3. **Single signature request** -> User signs once to authorize entire deployment.
4. **Backend batches** all deployment transactions (vault, wrapper, OFT, oracle, CCA, lottery).
5. **Paymaster sponsors gas** -> Coinbase CDP covers gas fees.
6. **Execution** -> Contracts deployed + auction launched (may be multiple txs; still one creator “flow”).
7. **Fallbacks** -> If paymaster unavailable, user pays gas. If batching unsupported, falls back to multi-tx flow.

### Benefits

- **Zero gas fees** for creators (when paymaster configured).
- **One signature** for entire deployment stack.
- **Atomic execution** (all-or-nothing - no partial deploys).
- **Better UX** (no 10 separate wallet confirmations).

---

## Supported Chains

**CreatorVault uses LayerZero V2 for omnichain share tokens. All chains share the same OFT token:**

| Network | Chain ID | LZ Endpoint ID | Status | Explorer |
|---------|----------|----------------|--------|----------|
| **Base** | 8453 | 30184 | Hub chain | [BaseScan](https://basescan.org) |
| **Ethereum** | 1 | 30101 | Configured | [Etherscan](https://etherscan.io) |
| **Arbitrum** | 42161 | 30110 | Configured | [Arbiscan](https://arbiscan.io) |
| **BSC** | 56 | 30102 | Configured | [BscScan](https://bscscan.com) |
| **Avalanche** | 43114 | 30106 | Configured | [SnowTrace](https://snowtrace.io) |
| **Monad** | 10143 | 30390 | Configured | [MonadExplorer](https://monadexplorer.com) |
| **Sonic** | 146 | 30332 | Configured | [SonicScan](https://sonicscan.org) |
| **HyperEVM** | 999 | 30275 | Configured | [Hyperliquid](https://hyperliquid.xyz) |

**Base is the hub chain** - all deployments start on Base, then OFT can be bridged to other chains.

---

## Quick Start

### Prerequisites

- **Node.js** 18+ with pnpm
- **Foundry** for Solidity development
- **Coinbase Smart Wallet** (or any EIP-4337 wallet) for gas-free deployment

### Installation

```bash
# Clone repository
git clone https://github.com/wenakita/4626.git
cd 4626

# Install dependencies
pnpm install

# Compile contracts
forge build

# Run tests
forge test -vvv
```

### Deploy a Vault (Web UI)

1. Navigate to [app.4626.fun/deploy](https://app.4626.fun/deploy)
2. Connect Coinbase Smart Wallet
3. Enter your Creator Coin address (e.g., 0x5b67...75 for akita)
4. Send 50,000,000 tokens to your smart wallet (for initial CCA deposit)
5. Confirm smart wallet address
6. Click **"Deploy + Launch"**
7. Sign once -> All contracts deployed + CCA live

**Result**: Vault + OFT + Lottery + CCA live in ~30 seconds with zero gas fees.

---

## Project Structure

```
CreatorVault/
  contracts/                      # Solidity contracts
    core/                         # Platform core
      CreatorRegistry.sol
    vault/                        # ERC-4626 vaults
      CreatorOVault.sol
      CreatorOVaultWrapper.sol
    services/messaging/           # LayerZero V2 OFT
      CreatorShareOFT.sol
    governance/                   # Tokenomics
      CreatorGaugeController.sol
      ve4626.sol
      ve4626BoostManager.sol
    services/lottery/             # Lottery system
      CreatorLotteryManager.sol
      vrf/                        # Chainlink VRF
        CreatorVRFConsumerV2_5.sol
    services/oracles/             # Price oracles
      CreatorOracle.sol
    vault/strategies/             # Yield strategies
      BaseCreatorStrategy.sol
      CCALaunchStrategy.sol
    factories/                    # Deployment factories
      CreatorOVaultFactory.sol
    helpers/                      # Batchers and infra helpers
      batchers/
      infra/
      hooks/
      routers/
    vault/strategies/univ4/       # LP management
    interfaces/                   # All interfaces
  frontend/                       # React frontend (Vite)
    src/
      components/                 # UI components
      pages/                      # Page routes
      lib/                        # Web3 utils
      config/                     # Contract addresses
    public/                       # Brand assets (logo, icons)
  deployments/                    # Deployed contract addresses
  script/                         # Foundry deploy scripts
  README.md
```

---

## Reference Deployment: AKITA (Base)

**AKITA is the current reference Creator Coin stack used by the app defaults.**
Source of truth: `frontend/src/config/contracts.defaults.ts`.

| Item | Value |
|------|-------|
| **Creator Coin** | akita (Base) |
| **Token Address** | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` |
| **Vault (CreatorOVault)** | `0xA015954E2606d08967Aee3787456bB3A86a46A42` |
| **Wrapper (CreatorOVaultWrapper)** | `0x58Cd1E9248F89138208A601e95A531d3c0fa0c4f` |
| **Share OFT (CreatorShareOFT)** | `0x4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57` |
| **Gauge Controller** | `0xB471B53cD0A30289Bc3a2dc3c6dd913288F8baA1` |
| **CCA Strategy** | `0x00c7897e0554b34A477D9D144AcC613Cdc97046F` |
| **Oracle** | `0x8C044aeF10d05bcC53912869db89f6e1f37bC6fC` |
| **Vault Symbol** | ▢AKITA |
| **OFT Symbol** | ■AKITA |
| **DEX Pairing Path** | Launches through Uniswap CCA (then migrates to active market liquidity) |
| **Lottery Prize Source** | 6.9% trading fees routed via `CreatorGaugeController` (69% jackpot reserve by default) |
| **Auction Route** | [Open auction page](https://app.4626.fun/auction/bid/0x00c7897e0554b34A477D9D144AcC613Cdc97046F) |

---

## Identity + Portfolio (Current App Model)

- **Canonical wallet graph**: profile identity is modeled across `profiles`, `wallets`, and `profile_wallets` (not just flat wallet columns).
- **Wallet sync endpoint**: `POST /api/wallet/sync` refreshes linked wallets from Privy and updates canonical mappings.
- **Portfolio provenance API**: `GET/PATCH /api/portfolio/me` supports source-aware profile fields and manual overrides.
- **Public portfolio route**: `/portfolio/:address` (app host) renders public profile view by wallet address.
- **Deploy guardrails**: deploy session creation checks canonical wallet linkage and fails closed on ownership mismatch.

---

## Security

**CreatorVault inherits Yearn V3's battle-tested security model with additional safeguards:**

### Anti-Inflation Attack

- **Virtual shares offset** (1e3) prevents first-depositor inflation attacks.
- **Minimum first deposit** (50,000,000 tokens) ensures meaningful initial liquidity.
- **Price change limits** (10% max per tx) prevents manipulation.

### Flash Loan Protection

- **Block delay** between deposit/withdraw (same-block attacks prevented).
- **Large withdrawal queue** (100k+ tokens) -> queued with unlock period.
- **Profit unlocking** (Yearn V3 mechanism) smooths out sudden PnL spikes.

### Access Control

- **Owner**: Full control (deployment, strategy management, emergency shutdown).
- **Management**: Add/remove strategies, adjust allocations.
- **Keeper**: Report profits, tend strategies (operational role).
- **EmergencyAdmin**: Shutdown vault in case of exploit (can't steal funds).

### Whale Guards

- **Maximum single deposit** (configurable per vault).
- **Graduated fee tiers** for large DEX purchases (future feature).

### Audits

- **Internal audits** completed for core contracts (Vault, OFT, Lottery).
- **Public audit** (planned) via Code4rena or Spearbit.

---

## Lottery Smart Wallet Compatibility

**The lottery system supports all wallet types including smart contract wallets and ERC-4337 accounts.**

### Supported Wallets

| Wallet Type | Status | Notes |
|-------------|--------|-------|
| **EOA (Externally Owned Account)** | Supported | Standard Ethereum wallets |
| **Coinbase Smart Wallet** | Supported | ERC-4337 account abstraction |
| **Safe (Gnosis)** | Supported | Multi-signature wallets |
| **Argent** | Supported | Social recovery wallets |
| **Proxy Wallets** | Supported | Transparent/UUPS proxies |
| **ERC-4337 Accounts** | Supported | Via bundler transactions |

### DEX Aggregator Support (Zero-Integration)

DEX aggregators work out-of-the-box without code changes. Aggregator contracts are marked as `SwapOnly`, ensuring the final user recipient receives lottery entries:

| Aggregator | Support Method | User Entry |
|------------|----------------|------------|
| **1inch** | `SwapOnly` classification | Final recipient gets entry |
| **Paraswap** | `SwapOnly` classification | Final recipient gets entry |
| **LlamaSwap** | `SwapOnly` classification | Final recipient gets entry |
| **CoW Swap** | `SwapOnly` classification | Final recipient gets entry |
| **Uniswap Universal Router** | `SwapOnly` classification | Final recipient gets entry |
| **Multi-hop routes** | Chained `SwapOnly` | Final recipient gets entry |

### Edge Case Test Coverage (88 Lottery Tests)

The lottery system is tested against 88 edge cases across multiple categories:

<details>
<summary><strong>Wallet Type Tests (5 tests)</strong></summary>

- EOA wallets receive lottery entries
- Coinbase Smart Wallet receives entries
- Safe multisig receives entries
- Argent wallet receives entries
- Proxy wallets receive entries

</details>

<details>
<summary><strong>Transaction Origin Tests (3 tests)</strong></summary>

- Direct EOA transactions work correctly
- ERC-4337 bundler transactions attribute entry to recipient (not bundler)
- Different `tx.origin` vs recipient handled correctly

</details>

<details>
<summary><strong>Aggregator Scenarios (4 tests)</strong></summary>

- Single-hop aggregator routes
- Multi-hop with 2 aggregators
- Multi-hop with 3 aggregators
- Split route aggregations

</details>

<details>
<summary><strong>Address Type Tests (4 tests)</strong></summary>

- `SwapOnly` to Unknown triggers lottery
- `SwapOnly` to `SwapOnly` skips lottery (intermediate hop)
- `NoFees` sender skips lottery
- Unknown to Unknown skips lottery (not a buy)

</details>

<details>
<summary><strong>Amount Edge Cases (4 tests)</strong></summary>

- Zero amount (allowed, no lottery)
- 1 wei (triggers lottery)
- Very large amounts (100k+ tokens)
- Max uint128 transfers

</details>

<details>
<summary><strong>State Edge Cases (7 tests)</strong></summary>

- Lottery disabled
- Fees disabled
- No gauge controller (reverts on set to zero)
- Gauge controller required for fees
- Lottery manager reverts (transfer still succeeds)
- No lottery manager (no revert)
- Lottery enable/disable toggle

</details>

<details>
<summary><strong>ILotteryBeneficiary Interface (5 tests)</strong></summary>

- Returns valid address (uses returned address)
- Returns zero address (falls back to recipient)
- Reverts (falls back to recipient)
- Returns self (uses self)
- High gas consumption (still works)

</details>

<details>
<summary><strong>Multiple Swap Tests (3 tests)</strong></summary>

- Same block, same user (all entries logged)
- Same block, different users (all entries logged)
- Different blocks (entries logged per block)

</details>

<details>
<summary><strong>Protocol-Specific Tests (2 tests)</strong></summary>

- CoW Swap settlement contracts
- Uniswap Universal Router

</details>

<details>
<summary><strong>DeFi Recipient Tests (3 tests)</strong></summary>

- Yield vault as recipient
- Bridge contract as recipient
- Timelock as recipient

</details>

<details>
<summary><strong>Permission Tests (2 tests)</strong></summary>

- Non-owner cannot set address type
- Cannot set zero address

</details>

<details>
<summary><strong>Advanced Edge Cases (18 tests)</strong></summary>

- Self-transfer (no lottery)
- Aggregator self-transfer (no lottery)
- Address type change mid-transaction
- Sandwich attack (all entries logged)
- MEV bot marked as SwapOnly (no entry)
- Circular transfers (no exploit)
- Very deep aggregator chain (10 hops)
- `transferFrom` EOA to EOA (no lottery)
- `transferFrom` aggregator to user (triggers lottery)
- Small amount (1 wei triggers lottery)
- Max uint balance transfer
- Rapid successive transfers (100 in same block)
- Transfer to different smart wallet types
- Nested smart wallet call with bundler origin
- Batch transfer to multiple recipients
- Zero address recipient (reverts)
- Transfer to ShareOFT contract (allowed)
- Lottery enabled toggle behavior

</details>

<details>
<summary><strong>Fuzz Tests (2 tests)</strong></summary>

- Random recipient addresses (256 runs)
- Random amounts 1 wei to 1000 ETH (256 runs)

</details>

### Running Tests

```bash
# Run all lottery tests
forge test --match-path "test/CreatorShareOFT.Lottery.t.sol" -v

# Run all edge case tests
forge test --match-path "test/CreatorShareOFT.EdgeCases.t.sol" -v

# Run specific test
forge test --match-test test_SmartWallet_CanParticipateInLottery -vvv
```

---

## Usage Examples

### For Creators

**Deploy a vault for your Creator Coin:**

```solidity
// Via Factory (or use web UI at app.4626.fun/deploy)
(address vault, address wrapper, address shareOFT) = factory.deployCreatorVault(
    0x5b67...75,                       // Your Creator Coin address
    "TOKEN Vault",                     // Vault name
    "▢TOKEN",                         // Vault symbol
    "TOKEN Share",                    // OFT name
    "■TOKEN",                         // OFT symbol
    "base",                           // Chain prefix
    msg.sender                        // Your address (revenue recipient)
);
```

**Configure DEX pools for trading fee:**

```solidity
shareOFT.setAddressType(uniswapV4Pool, OperationType.SwapOnly);
shareOFT.setGaugeController(gaugeControllerAddress);
```

**Add yield strategies:**

```solidity
vault.addStrategy(strategyAddress, 5000); // 50% allocation to strategy
```

### For Users

**Deposit Creator Coins:**

```solidity
IERC20(akitaToken).approve(vaultAddress, 1000e18);
vault.deposit(1000e18, msg.sender); // Receive ▢AKITA vault shares
```

**Wrap for cross-chain:**

```solidity
wrapper.wrap(shareAmount); // Convert ▢AKITA -> ■AKITA
```

**Bridge to another chain:**

```solidity
SendParam memory sendParams = SendParam({
    dstEid: 30110, // Arbitrum
    to: addressToBytes32(msg.sender),
    amountLD: 100e18,
    minAmountLD: 99e18,
    extraOptions: "",
    composeMsg: "",
    oftCmd: ""
});

shareOFT.send{value: fee}(sendParams, fee, msg.sender);
```

---

## Contributing

**We welcome contributions from the community:**

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Write tests** for new features (`forge test`)
4. **Commit** changes (`git commit -m 'Add amazing feature'`)
5. **Push** to branch (`git push origin feature/amazing-feature`)
6. **Open** a Pull Request

### Development Commands

```bash
# Compile contracts
forge build

# Run tests with verbosity
forge test -vvv

# Run specific test
forge test --match-test testVaultDeposit -vvv

# Deploy to Base (example)
forge script script/DeployCreatorVault.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify

# Start frontend dev server
cd frontend && pnpm dev
```

### Environment Notes (Server vs Client)

- `NEYNAR_API_KEY` is **server-only** and required for webhook verification paths.
- `VITE_*` env vars are client-exposed by design. Do not put secrets in `VITE_` keys.
- `WALLET_SYNC_LEGACY_FALLBACK=true` keeps legacy wallet-upsert fallback enabled during staged migration.

### Repo build philosophy (Zora-style)

This repo is intentionally split into:

- **Fast UI loop**: `frontend/` (Vite + React). Prefer `pnpm -C frontend dev` / `pnpm -C frontend build` for day-to-day changes.
- **Heavy onchain loop**: Foundry contracts at repo root. Run `forge build` / `forge test` when you’re changing Solidity.

For the Vercel API surface, avoid “hidden” dynamic imports: add endpoints by registering them in `frontend/api/_handlers/_routes.ts` so the bundler includes them.

---

## License

**MIT License** - see [LICENSE](LICENSE) file for details.

---

## Links

- **Website**: [4626.fun](https://4626.fun)
- **App**: [app.4626.fun](https://app.4626.fun)
- **GitHub**: [github.com/wenakita/4626](https://github.com/wenakita/4626)
- **Docs Site (source)**: [`apps/docs-site`](apps/docs-site)
- **Coinbase Creator Coins**: [Coinbase Ecosystem](https://www.coinbase.com)
- **LayerZero**: [docs.layerzero.network](https://docs.layerzero.network)
- **Uniswap CCA**: [cca.uniswap.org](https://cca.uniswap.org)
- **akita Token**: [Uniswap V4 Pool](https://app.uniswap.org/explore/tokens/base/0x5b674196812451b7cec024fe9d22d2c0b172fa75)

---

## Brand Assets

**Logos, icons, and brand guidelines are available in `/frontend/public/`:**
a
- **Logo** (SVG, PNG): `/frontend/public/logo.svg`
- **Favicon**: `/frontend/public/favicon.ico`
- **Protocol logos**: `/frontend/public/protocols/` (Uniswap, LayerZero, Chainlink, etc.)

**For media inquiries or partnership discussions, contact [@wenakita](https://x.com/wenakita) on Twitter.**

---

**CreatorVault | Omnichain Vaults for Creator Coins | Powered by LayerZero V2 + Uniswap CCA**

*Enabling any creator to launch institutional-grade vault infrastructure with zero gas fees, fair launch price discovery, and instant lottery incentives - all in one click.*
