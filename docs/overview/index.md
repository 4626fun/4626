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
+------------------+     +-----------------+
|  Zora Creator    | --> |  CreatorOVault  |
|  Coin (TOKEN)    |     |  (▢TOKEN)       |
+------------------+     +-----------------+
                               |
         +---------------------+---------------------+
         |                     |                     |
         v                     v                     v
+----------------+   +------------------+   +----------------+
| CCA Strategy   |   | Charm Strategy   |   | Ajna Strategy  |
| (Launch)       |   | (V3 LP)          |   | (Lending)      |
+----------------+   +------------------+   +----------------+
```

---

## Quick links

- [Strategy architecture](/overview/architecture/strategy-architecture) - How yield strategies work
- [Fee architecture](/overview/architecture/fee-architecture) - Fee distribution flow
- [Account abstraction](/overview/account-abstraction/activation) - 1-click vault activation
