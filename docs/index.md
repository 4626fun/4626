---
title: CreatorVault
sidebar_position: 1
slug: /
---

# CreatorVault

**Zora coin + Smart Wallet + Farcaster identity + Base groupchats = the creator economy OS on Base.**

CreatorVault is the **Base-native creator finance layer** that turns **Zora Creator Coins (Coinbase Creator Coins)** into composable, onchain "creator economies" with FriendTech-like loops: discover → take action → share → engage.

## What is CreatorVault?

In one click, creators deploy institutional-grade **ERC-4626 vault** infrastructure (Yearn V3 architecture) with:

- Cross-chain **LayerZero V2 OFT** shares
- Pluggable **yield strategies**
- A **6.9% trading-fee lottery** (on all DEX trades) powered by **Chainlink VRF**
- Fair launch via **Uniswap CCA**
- Execution through **EIP-4337** account abstraction (optimized for Coinbase Smart Wallet)

## Core Features

| Feature | Description |
|---------|-------------|
| **One-Click Deployment** | Deploy vault + wrapper + OFT + oracle + CCA in a single gas-free transaction |
| **Omnichain Shares** | LayerZero V2 OFT enables share tokens on 8+ chains |
| **Pluggable Yield** | ERC-4626 vault supports multiple strategies |
| **Fair Launch** | Uniswap Continuous Clearing Auction for transparent price discovery |
| **Instant Lottery** | 6.9% fee on trades funds Chainlink VRF lottery |
| **Security** | Virtual shares offset, flash loan protection, anti-whale guards |

## Quick Links

- [Getting Started](/getting-started) - Installation and deployment guide
- [Architecture](/architecture) - How CreatorVault works under the hood
- [Tokenomics](/tokenomics) - Fee structure and lottery mechanics
- [Security](/security) - Security features and audits
- [Lens Integration](/lens) - Lens + Grove Phase 1 guidance for this repo
- [API Reference](/api) - Auto-generated contract and frontend documentation

## Tech Stack

- **Solidity 0.8.20** - Smart contracts
- **LayerZero V2** - Cross-chain messaging
- **Chainlink VRF 2.5** - Lottery randomness
- **Uniswap V4** - Continuous Clearing Auction + liquidity
- **EIP-4337 / EIP-5792** - Account abstraction + batching
- **Yearn V3** - Vault architecture

## First Deployment: akita

akita is the first Creator Coin to launch with CreatorVault:

| Item | Value |
|------|-------|
| **Creator Coin** | akita (Base) |
| **Token Address** | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` |
| **Vault Symbol** | ▢AKITA |
| **OFT Symbol** | ■AKITA |
| **DEX Pair** | akita/ZORA (Uniswap V4, 3% fee tier) |

## Links

- **Website**: [erc4626.fun](https://erc4626.fun)
- **GitHub**: [github.com/wenakita/4626](https://github.com/wenakita/4626)
- **Coinbase Creator Coins**: [Coinbase Ecosystem](https://www.coinbase.com)
- **LayerZero**: [docs.layerzero.network](https://docs.layerzero.network)
- **Uniswap CCA**: [cca.uniswap.org](https://cca.uniswap.org)
