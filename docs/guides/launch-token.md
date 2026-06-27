---
title: Launch a vault
sidebar_position: 3
---

# Launch a vault

**Phase 1** — greenfield deploy creates your per-creator contract stack in one atomic batch.

Full journey: [Greenfield checklist](/guides/greenfield-checklist).

## Before you start

- [Strategy bundle](/guides/strategy-bundle) active (`vault_full_deploy`)
- Creator coin live on Base (typically via Zora)
- **50M–100M** creator coin on your execution wallet
- Wallet signing ready in the app

## Steps

1. Go to **[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)**
2. Connect and confirm your creator coin address
3. Set vault / share names and symbols (e.g. `▢AKITA`, `■AKITA`)
4. Submit **Deploy** — canonical smart wallet paths use sponsored ERC-4337 UserOps when configured

## What deploys

| Contract | Role |
|----------|------|
| [CreatorRegistry](/contracts/core/creator-registry) entry | Maps creator coin → this stack |
| CreatorOVault | ERC-4626 vault |
| CreatorOVaultWrapper | Share wrapping for OFT |
| CreatorShareOFT | Cross-chain share token |
| CreatorGaugeController | Fee routing |
| CreatorOracle | NAV / pricing |
| CCA launch strategy | Fair-launch auction |

Contract details: [Contracts hub](/contracts).

## After deploy

**Phase 2** — [Activate vault](/guides/activate-vault) to deposit creator coin and start the CCA auction.

Shared batcher and factories: [addresses](/reference/addresses) (v1.14.1).
