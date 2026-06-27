---
title: Getting started
sidebar_position: 1
---

# Getting started

Read this page first. For launch steps, use the [Launch checklist](/guides/greenfield-checklist). For fees and lottery detail, see [How it works](/overview/how-it-works).

## Who this is for

You have (or are launching) a **creator coin on Base** — usually through Zora — and you want to:

- Deposit a large amount of that coin into a **vault**
- Let the public **buy tradable shares** in a **fair auction** (not a private presale)
- Send **trading fees and creator revenue** to people who hold those shares

4626 is the app and onchain system on Base that does that.

## The idea in 30 seconds

1. You **deposit creator coin** into a vault (a smart contract that holds the token and tracks ownership).
2. The vault mints **shares** — receipts for your stake in what’s inside.
3. Part of the supply goes into a **fair auction** so buyers set price in the open.
4. After the auction, people **trade shares on Base** (Solana can come later).
5. **Fees and Zora payouts** can flow back into the vault so **share holders** benefit.

Your **creator coin** and your **share token** are different assets with different contract addresses.

## Three names you’ll see {#three-names-youll-see}

| Name | Plain English | Example |
|------|----------------|---------|
| **Creator coin** | Your existing Zora token | `$JESSE` |
| **Vault share (`▢`)** | Internal receipt from the vault | `▢JESSE` |
| **Tradable share (`■`)** | What buyers hold and trade | `■JESSE` |

Tradable shares wrap vault shares **1:1**. Never swap addresses between creator coin and share token.

More detail: [How it works — three tokens](/overview/how-it-works#three-tokens-one-vault).

## What you need

| Requirement | Why |
|-------------|-----|
| Creator coin **on Base** | The vault holds this token |
| **50M–100M** tokens in your wallet | Vault deposit at activation (app shows exact minimum) |
| **4626 account** + working wallet signing | Deploy and activate need signatures |
| **Launch bundle paid** ($499 USDC) | Unlocks deploy — [what’s included](/guides/strategy-bundle) |

## Launch steps (in order)

Same order as the [Launch checklist](/guides/greenfield-checklist):

| # | Step | Guide |
|---|------|--------|
| 1 | **Pay** launch bundle ($499 USDC) | [Strategy bundle](/guides/strategy-bundle) |
| 2 | **Deploy** vault + share contracts | [Launch vault](/guides/launch-token) |
| 3 | **Activate** — deposit coin, start auction | [Activate vault](/guides/activate-vault) |
| 4 | **Auction runs** — monitor in the app | — |
| 5 | **Finalize** — onchain wrap-up; optional Solana bridge | [Solana share mesh](/overview/solana-share-mesh) |
| 6 | **Strategies on** — Charm + Ajna (from bundle, automatic) | [How it works](/overview/how-it-works) |

**Solana is optional.** You can trade and run the lottery on Base without waiting for Solana.

## When are you “live”?

| Milestone | What it means |
|-----------|----------------|
| **Deployed** | Contracts exist; no creator coin in vault yet |
| **Activated** | Coin deposited; **auction running** |
| **Trading live** | Auction finished; **■ shares** trade on Base; buys can enter the lottery |

You’re not fully live for public trading until the **auction completes**.

## Common questions

**What’s the $499 for?**  
It unlocks deploy plus the full launch package: Charm liquidity, Ajna lending, Solana share bridge entitlement, and Meteora setup. It is **not** your creator coin deposit. See [Strategy bundle](/guides/strategy-bundle).

**Why 50M–100M creator coin?**  
That’s the required vault deposit at activation — a large slice of supply goes into the vault and auction. The app shows your exact minimum.

**Creator coin vs share — which do buyers get?**  
Buyers get **■ tradable shares**, not your Zora creator coin. Creator coin goes **into** the vault; shares represent claims **on** the vault.

**Do I need Solana?**  
No. Base is the hub. Solana is optional reach for the same **■** share after finalize. [Solana share mesh](/overview/solana-share-mesh).

**What wallet do I need?**  
A 4626 account with signing set up in the app (Coinbase Smart Wallet / Base App paths are supported). Finish wallet setup before deploy if the app prompts you.

## Open the app

**[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)** — sign in, pay the bundle if needed, then Deploy → Activate.

## More reading

| Topic | Page |
|-------|------|
| Fees, lottery, phases | [How it works](/overview/how-it-works) |
| Printable checklist | [Launch checklist](/guides/greenfield-checklist) |
| Contract addresses | [Addresses](/reference/addresses) |
| Terminology | [Glossary](/reference/glossary) |
