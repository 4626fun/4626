---
title: Activate a vault
sidebar_position: 4
---

# Activate a vault

**Step 3:** deposit creator coin and start the **fair-launch auction**.

Need Steps 1–2 first: [Strategy bundle](/guides/strategy-bundle) · [Launch vault](/guides/launch-token) · [Checklist](/guides/greenfield-checklist)

## What activation does

The app moves **50M–100M** creator coin from your wallet into the vault, mints shares, and starts the **fair auction** (Continuous Clearing Auction on Uniswap V4) for your **■** tradable shares.

Buyers participate in the auction through the app / onchain — this is open price discovery, not a private sale.

## In the app

- **Usually one signature** — the app deposits, wraps, and starts the auction in one batch (Permit2).  
- **Fallback** — approve creator coin, then activate (two steps).  

## Deposit rules

- **50M–100M** creator coin (exact minimum in app)  
- Auction seed: **99% creator coin / 1% USDC** (not 50/50)  

## After activation

| Stage | What to expect |
|-------|----------------|
| **Auction running** | Monitor until complete — not fully “live” for DEX trading yet |
| **Auction done + finalize** | ■ shares trade on Base; lottery on **buys** |
| **Solana** | Optional later ([Solana share mesh](/overview/solana-share-mesh)) |
| **Strategies** | Charm + Ajna from bundle (automatic) |

## Related

[Launch vault](/guides/launch-token) · [How it works](/overview/how-it-works) · [Auction contract](/contracts/strategies/cca-launch)
