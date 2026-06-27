---
title: Launch checklist
sidebar_position: 2
---

# Launch checklist

Use this as your **printable path** for launching a **brand-new** vault on Base. (Existing vaults like AKITA may follow older rules.)

**New to 4626?** Read [Getting started](/getting-started) first for context.

## Before you open the app

- [ ] Creator coin is **live on Base** (usually from Zora)  
- [ ] You hold **50M–100M** of that coin for the vault deposit  
- [ ] You have a **4626 account** and wallet signing works in the app  
- [ ] You paid the **[strategy bundle](/guides/strategy-bundle)** ($499 USDC) — deploy stays locked until this shows active  

## Launch steps

| # | Step | What happens | Guide |
|---|------|--------------|-------|
| 1 | **Pay bundle** | Unlock deploy in the app | [Strategy bundle](/guides/strategy-bundle) |
| 2 | **Deploy** | One transaction creates vault, shares, auction, etc. | [Launch vault](/guides/launch-token) |
| 3 | **Activate** | Deposit creator coin; fair auction starts | [Activate vault](/guides/activate-vault) |
| 4 | **Auction runs** | Buyers discover price; you watch in the app | — |
| 5 | **Finalize** | Onchain wrap-up; optional Solana bridge | [Solana share mesh](/overview/solana-share-mesh) |
| 6 | **Strategies attach** | Charm + Ajna from your bundle (automatic) | [How it works](/overview/how-it-works) |

**App link:** [app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)

## How you know you’re live

**On Base (this is the main milestone)**

- Vault accepts deposits and mints shares  
- Auction completed or in progress  
- **■ shares** trade on Base  
- **Buys** on Base can trigger the [lottery](/contracts/utilities/lottery-manager)  
- Trade fees flow through the [gauge](/contracts/governance/gauge-controller)  

**On Solana (optional, can come later)**

- Bridged **■ share** (not your creator coin) may appear after finalize  
- Meteora pool trading may follow  
- You **don’t** need Solana lottery to count as live on Base  

## Quick reference

- **Your vault’s contracts** — registered in [CreatorRegistry](/contracts/core/creator-registry) at deploy  
- **Shared infra (batcher, factories)** — [Live addresses](/reference/addresses) v1.14.1  

## Related

- [Getting started](/getting-started) · [How it works](/overview/how-it-works)
