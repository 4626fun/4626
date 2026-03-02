---
title: Utilities
sidebar_position: 4
---

# Utility Contracts

Shared infrastructure utilities for 4626.

## Overview

| Utility | Purpose |
|---------|---------|
| **[LotteryManager](/contracts/utilities/lottery-manager)** | Instant lottery system with Chainlink VRF |
| **[CreatorOracle](/contracts/utilities/creator-oracle)** | Price oracle using Uniswap V4 TWAP |

## Shared vs Per-Creator

- **LotteryManager** - Shared utility (one per chain)
- **CreatorOracle** - Per-creator (tracks each token's price)
