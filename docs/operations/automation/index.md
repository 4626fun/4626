---
title: Automation
sidebar_position: 2
---

# Automation

Guides for automating vault operations with keepers.

---

## Guides

| Guide | Description |
|-------|-------------|
| [Quick Start](./quick-start) | Get started with automation |
| [Full Automation](./full-automation) | Complete keeper setup |
| [Completion Options](./completion-options) | CCA completion strategies |

---

## Overview

Automation handles:

- **Vault operations**: Deploy to strategies, report profits
- **CCA completion**: Graduate auctions to V4 pools
- **Fee distribution**: Trigger GaugeController distributions
- **Lottery**: Process VRF callbacks

---

## Keeper responsibilities

```
┌─────────────────────────────────────────┐
│              Keeper Bot                  │
├─────────────────────────────────────────┤
│                                          │
│  Vault Operations                        │
│  ├─► deployToStrategies()               │
│  ├─► report()                           │
│  └─► tend()                             │
│                                          │
│  Fee Distribution                        │
│  └─► gaugeController.distribute()       │
│                                          │
│  CCA Management                          │
│  └─► ccaAuction.graduate()              │
│                                          │
└─────────────────────────────────────────┘
```

---

## Quick links

- [Glossary](/reference/glossary)
- [Operations Overview](/operations)

---

## Related

- [Deployment](/operations/deployment) - Contract deployment
- [Troubleshooting](/guides/troubleshooting) - Common issues
