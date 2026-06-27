---
title: Getting started
sidebar_position: 1
---

# Getting started

**New here?** Read this page first, then [How it works](/overview/how-it-works) if you want the full picture.

## Who this is for

You already have (or are launching) a **creator coin on Base** — usually through Zora. You want to:

- Put a large slice of that coin into a **vault** you control  
- Let the public **buy tradable shares** in a fair auction  
- Route **trading fees and creator revenue** to people who hold those shares  

4626 is the onchain system and app that does that.

## The idea in 30 seconds

1. You **deposit creator coin** into a vault (think: a smart contract piggy bank).  
2. The vault mints **shares** — receipts that represent a claim on what’s inside.  
3. Some shares go into a **fair-launch auction** so buyers can discover price openly.  
4. After launch, people **trade shares on Base** (and optionally on Solana later).  
5. **Fees and external earnings** flow back into the vault so **share holders** benefit.

You keep your original creator coin as a separate token. **Shares are a different asset** with their own ticker and contract address.

## Three names you’ll see

| Name | Plain English | Example |
|------|----------------|---------|
| **Creator coin** | Your existing Zora token | `$JESSE` |
| **Vault share (`▢`)** | Internal receipt from the vault | `▢JESSE` |
| **Tradable share (`■`)** | What buyers hold and trade on DEXs | `■JESSE` |

The app wraps vault shares into tradable shares **1:1**. Don’t confuse creator coin with share token — they are **not** the same address.

More detail: [How it works — tokens](/overview/how-it-works#three-tokens-one-vault).

## What you need before the app

| Requirement | Why |
|-------------|-----|
| Creator coin **live on Base** | The vault holds this token |
| **50M–100M** creator coin in your wallet | Minimum vault deposit (app shows your exact floor) |
| **4626 account** + wallet signing set up | Deploy and activate need signatures |
| **Strategy bundle paid** ($499 USDC) | Unlocks deploy in the app — [what’s included](/guides/strategy-bundle) |

## Steps in order

Do these in sequence. The [Launch checklist](/guides/greenfield-checklist) has the same path with more detail.

| Step | What you do | Where |
|------|-------------|--------|
| **1. Pay** | Buy the launch bundle ($499 USDC) | [Strategy bundle](/guides/strategy-bundle) |
| **2. Deploy** | Create vault + share contracts in one transaction | [Launch vault](/guides/launch-token) |
| **3. Activate** | Deposit creator coin and start the auction | [Activate vault](/guides/activate-vault) |
| **4. Wait for auction** | Fair launch runs; you monitor in the app | — |
| **5. Go live** | Shares trade on Base; fees and lottery kick in | [How it works](/overview/how-it-works) |

**Solana is optional.** You can launch and trade on Base first. [Solana share mesh](/overview/solana-share-mesh) explains when bridged shares show up on Solana.

## Open the app

**[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)**

Sign in, finish wallet setup if prompted, pay the bundle if you haven’t yet, then follow Deploy → Activate.

## Where to go next

| If you want… | Read |
|--------------|------|
| The full story (fees, lottery, phases) | [How it works](/overview/how-it-works) |
| A printable launch path | [Launch checklist](/guides/greenfield-checklist) |
| Solana vs Base | [Solana share mesh](/overview/solana-share-mesh) |
| Contract addresses | [Addresses](/reference/addresses) |
| A term you don’t know | [Glossary](/reference/glossary) |
