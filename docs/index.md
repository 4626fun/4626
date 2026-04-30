---
title: 4626
sidebar_position: 1
slug: /
---

# 4626

**A creator economy that behaves like a system.**

4626 is the Base-native creator finance layer that turns Zora Creator Coins (Coinbase Creator Coins) into composable, onchain creator economies.

## Choose Your Lane

- **Users**: [/users](/users)
- **Creators**: [/creators](/creators)
- **Developers**: [/developers](/developers)
- **Protocol Integrators**: [/protocols](/protocols)
- **Operators/SRE**: [/operators](/operators)

## Architecture Lenses

The architecture remains organized around two system lenses:

- **Four compressions**: deployment, geography (multichain), distribution (launch), and engagement (game loop).
- **Three primitives**: account, market, and game loop.

Start with:

- [Users](/users) for product usage
- [Creators](/creators) for launch and operations
- [Developers](/developers) for implementation details
- [Protocol Integrators](/protocols) for interop and APIs
- [Operators/SRE](/operators) for deployment and runbooks

## What is 4626?

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

- [Wallet Architecture](/wallet-architecture) - canonical CSW, sub-account, signer roles, and trust boundaries
- [Users](/users) - product usage and troubleshooting
- [Creators](/creators) - launch and creator workflows
- [Developers](/developers) - build and contribute
- [Protocol Integrators](/protocols) - interop and contract surfaces
- [Operators/SRE](/operators) - deployment and reliability
- [Security](/security) - threat surfaces and mitigations
- [Audits](/audits) - external and internal security reviews
- [API Reference](/api) - auto-generated contract and frontend docs

## Tech Stack

- **Solidity 0.8.20** - Smart contracts
- **LayerZero V2** - Cross-chain messaging
- **Chainlink VRF 2.5** - Lottery randomness
- **Uniswap V4** - Continuous Clearing Auction + liquidity
- **EIP-4337 / EIP-5792** - Account abstraction + batching
- **Yearn V3** - Vault architecture

## First Deployment: akita

akita is the first Creator Coin to launch with 4626:

| Item | Value |
|------|-------|
| **Creator Coin** | akita (Base) |
| **Token Address** | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` |
| **Vault Symbol** | ▢AKITA |
| **OFT Symbol** | ■AKITA |
| **DEX Pair** | akita/ZORA (Uniswap V4, 3% fee tier) |

## Links

- **Website**: [4626.fun](https://4626.fun)
- **GitHub**: [github.com/wenakita/4626](https://github.com/wenakita/4626)
- **Coinbase Creator Coins**: [Coinbase Ecosystem](https://www.coinbase.com)
- **LayerZero**: [docs.layerzero.network](https://docs.layerzero.network)
- **Uniswap CCA**: [cca.uniswap.org](https://cca.uniswap.org)
