---
title: Activate a vault
sidebar_position: 4
---

# Activate a vault

**Step 3 of launch:** put creator coin **into** the vault and **start the fair auction**.

Prerequisites: [Deploy](/guides/launch-token) finished · [Launch checklist](/guides/greenfield-checklist)

## What “activate” means

Activation pulls **50M–100M** of your creator coin from your wallet into the vault, mints shares, and seeds the **CCA auction** — the open price-discovery sale for your tradable **■** shares.

After this, buyers participate in the auction through the app / onchain flow.

## In the app

Most users sign **once** (Permit2 path): the app pulls coin, deposits, wraps, and starts the auction in one batch.

If your wallet doesn’t support that, the app falls back to **approve**, then **activate** — two steps instead of one.

## Deposit rules

- **50M–100M** creator coin (exact minimum shown in app)  
- Auction starts as **99% creator coin / 1% USDC** — not a 50/50 pair  

## After you activate

| What | What to expect |
|------|----------------|
| **Auction** | Runs until complete — monitor in the app |
| **Trading on Base** | ■ shares become tradable; buys can enter the lottery |
| **Solana** | Optional later — share bridge after finalize ([explainer](/overview/solana-share-mesh)) |
| **Strategies** | Charm + Ajna from your bundle attach automatically |

You **don’t** need to wait for Solana to be “live” on Base.

## Related

- [Launch vault](/guides/launch-token) · [How it works](/overview/how-it-works)  
- [Auction contract](/contracts/strategies/cca-launch) · [Addresses](/reference/addresses)
