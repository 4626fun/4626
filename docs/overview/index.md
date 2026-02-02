---
title: Overview
sidebar_position: 1
---

# Overview

This section provides a high-level introduction to the 4626 protocol.

**Who this is for:** Anyone new to 4626 who wants to understand how the system works.

---

## Contents

| Topic | Description |
|-------|-------------|
| [Introduction](./introduction) | Protocol overview and key concepts |
| [Architecture](./architecture) | System design and contracts |
| [Strategies](./strategies) | Yield strategy documentation |
| [Account Abstraction](./account-abstraction) | ERC-4337 integration |
| [Naming](./naming) | Token and vault naming conventions |

---

## Core architecture

```
Creator Coin (TOKEN)
        |
        v
+------------------+
|  CreatorOVault   |---> Issues ▢TOKEN (vault shares)
+------------------+            |
        |                       v
        |               +--------------+
        |               |   Wrapper    |---> ■TOKEN (OFT)
        |               +--------------+           |
        |                                          v
        |                              +-------------------+
        |                              | CCA Strategy      |
        |                              | Auctions ■TOKEN   |
        |                              | for ETH           |
        |                              +-------------------+
        v
+------------------+   +------------------+
| Charm Strategy   |   | Ajna Strategy    |
| Deploys TOKEN    |   | Lends TOKEN      |
| to V3 LP         |   | to Ajna pools    |
+------------------+   +------------------+
```

**Key distinction:**
- CCA auctions **■TOKEN** (wrapped shares) for ETH to bootstrap liquidity
- Yield strategies deploy **TOKEN** (creator coin) for yield generation

---

## Quick links

- [Strategy architecture](/overview/architecture/strategy-architecture) - How yield strategies work
- [Fee architecture](/overview/architecture/fee-architecture) - Fee distribution flow
- [Account abstraction](/overview/account-abstraction/activation) - 1-click vault activation
