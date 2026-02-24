---
title: Vault
sidebar_position: 10
slug: /primitives/market/vault
---

# Vault (ERC-4626)

The vault is the balance sheet of a creator economy.

CreatorVault’s per-creator vault is ERC-4626 compliant and borrows patterns from Yearn V3 (strategy queues, profit unlocking).

## What It Does

- holds deposited creator coins
- mints vault shares representing proportional ownership
- allocates assets across strategies
## Security Surfaces

- inflation/donation style attacks on early deposits (virtual shares offset)
- flash-loan and same-block manipulation
- oracle assumptions for valuations
## References

- [Security](/security)
- [Contracts: CreatorOVault](/contracts/core/creator-ovault)

