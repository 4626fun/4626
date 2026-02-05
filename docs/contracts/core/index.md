---
title: Core Contracts
sidebar_position: 1
---

# Core Contracts

The foundational contracts that power CreatorVault.

## Overview

| Contract | Purpose |
|----------|---------|
| **[CreatorRegistry](/contracts/core/creator-registry)** | Central registry for all platform contracts |
| **[CreatorOVault](/contracts/core/creator-ovault)** | ERC-4626 vault for creator coins |
| **[CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper)** | Wraps vault shares into OFT |
| **[CreatorShareOFT](/contracts/core/creator-share-oft)** | LayerZero OFT for cross-chain transfers |

## Deployment Order

1. **CreatorRegistry** - Deploy first (shared infrastructure)
2. **CreatorOVault** - Per-creator vault
3. **CreatorOVaultWrapper** - Links vault to OFT
4. **CreatorShareOFT** - Enables cross-chain and trading fees
