---
title: Getting Started
sidebar_position: 2
---

# Getting Started

This guide will help you get CreatorVault up and running.

## Prerequisites

- **Node.js** 18+ with pnpm
- **Foundry** for Solidity development
- **Coinbase Smart Wallet** (or any EIP-4337 wallet) for gas-free deployment

## Installation

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

## Deploy a Vault (Web UI)

The easiest way to deploy is through the web interface:

1. Navigate to [erc4626.fun/deploy](https://erc4626.fun/deploy)
2. Connect Coinbase Smart Wallet
3. Enter your Creator Coin address (e.g., `0x5b67...75` for akita)
4. Send 50,000,000 tokens to your smart wallet (for initial CCA deposit)
5. Confirm smart wallet address
6. Click **"Deploy + Launch"**
7. Sign once → All contracts deployed + CCA live

**Result**: Vault + OFT + Lottery + CCA live in ~30 seconds with zero gas fees.

## Gas-Free Deployment (EIP-4337)

CreatorVault supports 1-click, gas-free deployment via account abstraction.

### Powered By

- **EIP-5792**: Batch transaction execution (`wallet_sendCalls`) - all deployment steps in one signature
- **EIP-4337**: Account abstraction for smart wallet support (Coinbase Smart Wallet, Safe, etc.)
- **Coinbase CDP**: Paymaster service sponsors gas fees (~$50-100 saved per deployment)

### Setup (Optional but Recommended)

To enable gas-free deployments, configure the Coinbase CDP paymaster endpoint:

1. Get CDP API key from [Coinbase Developer Portal](https://portal.cdp.coinbase.com/)
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

1. **User connects** with Coinbase Smart Wallet (or any EIP-5792 compatible wallet)
2. **Deploy button clicked** → Frontend prepares batch call
3. **Single signature request** → User signs once to authorize entire deployment
4. **Backend batches** all deployment transactions (vault, wrapper, OFT, oracle, CCA, lottery)
5. **Paymaster sponsors gas** → Coinbase CDP covers gas fees
6. **Execution** → Contracts deployed + auction launched
7. **Fallbacks** → If paymaster unavailable, user pays gas. If batching unsupported, falls back to multi-tx flow

### Benefits

- **Zero gas fees** for creators (when paymaster configured)
- **One signature** for entire deployment stack
- **Atomic execution** (all-or-nothing - no partial deploys)
- **Better UX** (no 10 separate wallet confirmations)

## Next Steps

- [Architecture](/architecture) - Learn how CreatorVault works
- [Tokenomics](/tokenomics) - Understand the fee structure and lottery
- [Developer Guide](/developers) - Build on CreatorVault
