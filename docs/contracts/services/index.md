---
title: Services
sidebar_position: 4
---

# Service Contracts

Shared infrastructure services for CreatorVault.

## Overview

| Service | Purpose |
|---------|---------|
| **[LotteryManager](/contracts/services/lottery-manager)** | Instant lottery system with Chainlink VRF |
| **[CreatorOracle](/contracts/services/creator-oracle)** | Price oracle using Uniswap V4 TWAP |

## Shared vs Per-Creator

- **LotteryManager** - Shared service (one per chain)
- **CreatorOracle** - Per-creator (tracks each token's price)
