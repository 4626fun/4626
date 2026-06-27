---
title: Activate a vault
sidebar_position: 4
---

# Activate a vault

**Phase 2** — activation deposits creator coin into your vault, wraps shares for the ShareOFT, and seeds the **CCA auction**.

Prerequisites: [Phase 1 deploy](/guides/launch-token) complete. Journey map: [Greenfield checklist](/guides/greenfield-checklist).

## Preferred path: Permit2

One typed-data signature + one batcher call pulls creator coin, deposits to the vault, wraps shares, and allocates the auction slice to the CCA strategy. The app uses this path when your wallet supports Permit2.

## Fallback: approve + activate

1. Approve the batcher for your deposit amount
2. Call the batcher activate function with vault, wrapper, CCA strategy, and deposit parameters

The app falls back automatically when Permit2 signing is unavailable.

## Deposit rules

- **50M–100M** creator coin for greenfield launches (see app for your configured minimum)
- Auction seed is **99% creator coin / 1% USDC** — not a balanced pair

## After activation

| Step | What happens |
|------|----------------|
| **CCA auction** | Monitor in the app until the fair-launch completes |
| **Phase 2b finalize** | Pipe A may bridge ~30% ShareOFT to [Solana mesh](/overview/solana-share-mesh) |
| **Phase 3** | Charm + Ajna strategies attach (included in [strategy bundle](/guides/strategy-bundle)) |

Base ShareOFT trading and lottery can work without waiting on Solana relay.

## Related

- [Launch a vault](/guides/launch-token)
- [CCA strategy contract](/contracts/strategies/cca-launch)
- [Live addresses](/reference/addresses)
