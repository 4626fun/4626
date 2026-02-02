---
title: Introduction
sidebar_position: 1
---

# Introduction

4626 creates tokenized vaults for Zora Creator Coins. Each vault is ERC-4626 compliant, generates yield through automated strategies, and supports cross-chain transfers via LayerZero.

---

## Core concepts

### Vaults

A vault accepts deposits of a creator coin and issues shares representing proportional ownership. The vault deploys assets to yield strategies and distributes returns to shareholders.

### Tokens

| Symbol | Purpose |
|--------|---------|
| TOKEN | Creator coin (underlying asset) |
| ▢TOKEN | Vault shares (receipt for deposits) |
| ■TOKEN | Wrapped shares (cross-chain OFT) |

See [Token model](/overview/token-model) for details.

### Strategies

**Launch:** CCA auctions ■TOKEN for ETH using Uniswap's Continuous Clearing Auction.

**Yield:** Charm, Ajna, and V4 strategies deploy TOKEN for yield.

### Fees

6.9% buy fee on DEX purchases, split between lottery (69%), burn (21.39%), and voters (9.61%). See [Fee flow](/overview/fee-flow).

### Governance

ve4626 holders vote to direct lottery probability. See [Governance](/governance).

---

## Key contracts

| Contract | Purpose |
|----------|---------|
| CreatorOVault | Vault accepting deposits |
| CreatorOVaultWrapper | Converts ▢TOKEN ↔ ■TOKEN |
| CreatorShareOFT | Cross-chain OFT with fee/lottery |
| CreatorGaugeController | Fee distribution |
| VaultGaugeVoting | Probability voting |

---

## Getting started

1. [Architecture](/overview/architecture) - System design
2. [Token model](/overview/token-model) - Three-token system
3. [Deploy vault](/guides/deploy-vault) - Step-by-step guide
4. [Launch token](/guides/launch-token) - CCA auction setup
