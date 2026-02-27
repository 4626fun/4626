---
title: Launch Token
sidebar_position: 1
---

# Launch Your Token

Guide to launching a new creator token with 4626.

## Prerequisites

- Creator Coin deployed (e.g., via Zora)
- 50,000,000 tokens for initial CCA deposit
- Coinbase Smart Wallet (recommended) or EOA

## Step 1: Prepare Your Tokens

Ensure you have at least 50M tokens in your wallet for the initial CCA deposit.

## Step 2: Navigate to Deploy

Go to [erc4626.fun/deploy](https://erc4626.fun/deploy)

## Step 3: Connect Wallet

Connect your Coinbase Smart Wallet (or other EIP-4337 wallet).

## Step 4: Enter Token Address

Enter your Creator Coin contract address.

## Step 5: Configure Vault

- **Vault Name**: e.g., "akita Vault"
- **Vault Symbol**: e.g., "▢AKITA"
- **OFT Name**: e.g., "akita Share"
- **OFT Symbol**: e.g., "■AKITA"

## Step 6: Deploy

Click **"Deploy + Launch"** and sign the transaction.

With Coinbase Smart Wallet:
- Single signature for all contracts
- Gas sponsored by CDP paymaster
- Atomic deployment (all-or-nothing)

## Step 7: Start Auction

After deployment, your CCA auction will automatically start.

## What Gets Deployed

| Contract | Purpose |
|----------|---------|
| CreatorOVault | ERC-4626 vault |
| CreatorOVaultWrapper | OFT wrapping |
| CreatorShareOFT | Cross-chain token |
| CreatorGaugeController | Fee distribution |
| CreatorOracle | Price tracking |
| CCA Strategy | Fair launch auction |

## Next Steps

- Monitor your auction at `/auction/{token}`
- Configure additional strategies
- Set up voter rewards (optional)
