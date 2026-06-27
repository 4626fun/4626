---
title: Launch a vault
sidebar_position: 3
---

# Launch a vault

**Step 2 of launch:** create your vault and share contracts in **one deploy transaction**.

Prerequisites: [Strategy bundle](/guides/strategy-bundle) paid · [Launch checklist](/guides/greenfield-checklist)

## What “deploy” means

The app calls shared 4626 infrastructure to deploy **your** vault stack on Base: vault, share tokens, fee controller, oracle, and auction contract. You pick names and symbols (e.g. `▢AKITA` and `■AKITA`).

You are **not** moving creator coin yet — that happens in the next step ([Activate](/guides/activate-vault)).

## Before you click Deploy

- Strategy bundle shows **active**  
- Creator coin address is correct in the app  
- **50M–100M** creator coin is in your wallet (for activation soon)  
- Wallet signing is ready (smart wallet or connected wallet per app prompts)  

## In the app

1. Go to **[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)**  
2. Sign in and confirm your creator coin  
3. Set vault / share names and symbols  
4. Submit **Deploy** and wait for confirmation  

## What gets created

| Piece | Plain English |
|-------|----------------|
| Vault | Holds your creator coin |
| Share tokens | ▢ internal + ■ tradable |
| Registry entry | Links your coin → these contracts |
| Gauge | Routes fees |
| Oracle | Pricing for lottery |
| Auction | Fair launch for shares |

Technical detail: [Contracts hub](/contracts).

## Next step

**[Activate vault](/guides/activate-vault)** — deposit creator coin and start the auction.

Shared addresses (batcher, factories): [v1.14.1](/reference/addresses).
