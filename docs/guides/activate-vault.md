---
title: Activate a vault
sidebar_position: 4
---

# Activate a vault

**Launch step 3:** deposit creator coin into the vault and seed the **Continuous Clearing Auction (CCA)** for tradable `■` shares.

Prerequisites: [Strategy bundle](/guides/strategy-bundle) · [Launch vault](/guides/launch-token) · [Launch checklist](/guides/greenfield-checklist)

## Overview

Activation transfers **50M–100M** creator coin from the execution wallet into [CreatorOVault](/contracts/core/creator-ovault), mints vault shares, wraps ShareOFT, and allocates supply to the [CCA strategy](/contracts/strategies/cca-launch) on Uniswap V4. This constitutes open price discovery — not a private presale.

## Application execution paths

**Permit2 (preferred):** Single typed-data signature and batcher call — deposit, wrap, and CCA seeding in one transaction when the wallet supports Permit2.

**Approve + activate (fallback):** Approve the batcher for the deposit amount, then submit the activate call. The application selects the path automatically.

## Deposit parameters

- **50M–100M** creator coin (application displays configured minimum for deployment version)
- CCA seed composition: **99% creator coin / 1% USDC** (not a balanced pair)

## Post-activation timeline

| Phase | Expected state |
|-------|----------------|
| CCA in progress | Monitor auction in application; secondary trading not yet live |
| CCA complete + finalize | `■` shares tradable on Base; qualifying **buys** may enter lottery |
| Solana (optional) | Pipe A bridge and Meteora may follow finalize — [Solana share mesh](/overview/solana-share-mesh) |
| Strategies | Charm + Ajna attach per bundle weights (automatic) |

Base trading and lottery do not require Solana finalization.

## Next step

[After activation](/guides/after-activation) — CCA monitoring, finalize, trading live, and optional Solana.

## Related documentation

[Launch vault](/guides/launch-token) · [After activation](/guides/after-activation) · [How it works](/overview/how-it-works) · [CCA contract](/contracts/strategies/cca-launch) · [Addresses](/reference/addresses)
