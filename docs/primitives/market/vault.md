---
title: Vault
sidebar_position: 10
slug: /primitives/market/vault
---

# Vault (ERC-4626)

The vault is the balance sheet of a creator economy.

4626’s per-creator vault is ERC-4626 compliant and borrows patterns from Yearn V3 (strategy queues, profit unlocking).

## What It Does

- holds deposited creator coins
- mints vault shares representing proportional ownership
- allocates assets across strategies

## Strategy Topology

`CreatorOVault` is the only public deposit and withdrawal surface.

Strategies sit underneath the vault:

- `CreatorCharmStrategy` for Uniswap/Charm LP management
- canonical Ajna path: `ERC4626StrategyAdapter -> AjnaERC4626Vault -> AjnaVaultAuth + AjnaVaultBuffer`

Solana-side tradable shares use **ShareOFT** bridged from Base (`solana_ovault_mesh` at finalize).

The old direct Ajna contract path has been removed from the repo. The only supported Ajna sleeve is the nested adapter-backed bundle registered on `CreatorOVault`.

Why the nested Ajna bundle exists:

- `CreatorOVault` keeps its existing strategy accounting and ERC-4626 product surface
- `ERC4626StrategyAdapter` is the only Ajna-facing strategy the outer vault needs to know about
- Ajna-specific buffer policy, pause/auth, keeper controls, and bucket mechanics live inside the inner Ajna vault bundle

## Security Surfaces

- inflation/donation style attacks on early deposits (virtual shares offset)
- flash-loan and same-block manipulation
- oracle assumptions for valuations
## References

- [Security](/security)
- [Contracts: CreatorOVault](/contracts/core/creator-ovault)

