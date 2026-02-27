---
title: Three Primitives
sidebar_position: 2
slug: /primitives
---

# Three Primitives

4626 is built around three primitives that define the integration and security boundaries.

## Account

Execution is optimized for smart accounts (EIP-4337) and batching (EIP-5792). This is where wallet capability detection and fallback behavior live.

- [Account](/primitives/account)

## Market

The market primitive includes vault accounting (ERC-4626 / Yearn V3 patterns) and the launch/discovery mechanism (Uniswap CCA).

- [Market](/primitives/market)
- [Vault](/primitives/market/vault)
- [Auction (CCA)](/primitives/market/auction)

## Game Loop

The game loop primitive is the onchain engagement engine: trading fees fund a VRF-backed lottery, with optional governance boosts.

- [Game Loop](/primitives/game-loop)
- [Lottery](/primitives/game-loop/lottery)

## What Can Go Wrong (Why This Structure Matters)

- **Account** failures: wallet cannot batch, paymaster unavailable, wrong “canonical” account assumptions, signature/userop errors.
- **Market** failures: vault inflation attacks, manipulation around launch, oracle risk.
- **Game loop** failures: randomness assumptions, fee routing errors, misclassification of swap recipients.

If you are integrating or auditing, read these in order: Account → Market → Game Loop.

