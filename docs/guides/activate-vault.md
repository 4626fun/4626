---
title: Activate a vault
sidebar_position: 2
---

# Activate a vault

Activation deposits creator coin into your vault, wraps shares for the ShareOFT, and seeds the **CCA auction**.

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

- Monitor the CCA auction in the app
- Phase 2 finalize bridges a Solana share slice when Pipe A is wired (see [How it works](/overview/how-it-works))
- Paid strategies (Charm + Ajna) deploy in Phase 3 when entitlements are active

## Related

- [Launch a vault](/guides/launch-token)
- [CCA strategy contract](/contracts/strategies/cca-launch)
- [Live addresses](/reference/addresses)
