---
title: What is 4626?
sidebar_position: 1
---

# What is 4626?

4626 lets creators deposit a **Zora creator coin** into an **ERC-4626 vault** on Base, sell **tradable shares** through a **fair-launch auction**, and route trading fees and external revenue to share holders.

<div class="docs-at-a-glance">

**Start here if:** you have a creator coin on Base and want to launch a vault.

**Launch path:** [Launch checklist](/guides/greenfield-checklist) → five steps from bundle payment through trading live.

**Deep dive:** [Fees, auction, and lottery](/overview/how-it-works).

</div>

## Who this is for

Creators with a **creator coin on Base** (typically via Zora) who want to:

- Deposit creator coin into a **vault**
- Run **open price discovery** (fair-launch auction — not a private presale)
- Share **trade fees** and qualified **creator revenue** with share holders onchain

## How it works (short)

1. Pay the **launch bundle** ($499 USDC) — unlocks deploy.
2. **Deploy** vault, share, gauge, oracle, and auction contracts.
3. **Activate** — deposit 50M–100M creator coin and start the auction.
4. After the auction **finalizes**, `■` shares trade on Base; lottery and fees apply to qualifying **buys**.
5. **Solana is optional** — same `■` share may bridge later; creator coin stays on Base.

Full timeline: [Launch checklist](/guides/greenfield-checklist) · [After activation](/guides/after-activation)

## Three tokens (do not mix addresses)

| Token | What it is | Example |
|-------|------------|---------|
| **Creator coin** | Zora ERC-20; vault deposit | `$JESSE` |
| **Vault share (`▢`)** | ERC-4626 claim on the vault | `▢JESSE` |
| **Tradable share (`■`)** | DEX + cross-chain ShareOFT | `■JESSE` |

[CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) wraps ▢ → ■ at 1:1. Creator coin address **≠** share token address.

## Before you launch

| Requirement | Why |
|-------------|-----|
| Creator coin on **Base** | Vault deposit asset |
| **50M–100M** creator coin for activation | Shown in app for your release version |
| **4626 account** with signing ready | Deploy and activate transactions |
| **Launch bundle active** ($499 USDC) | [Pay launch fee](/guides/strategy-bundle) |

## Launch steps

| Step | Action | Guide |
|------|--------|-------|
| 1 | Pay launch bundle ($499 USDC) | [Pay launch fee](/guides/strategy-bundle) |
| 2 | Deploy contracts | [Deploy contracts](/guides/launch-token) |
| 3 | Activate vault (deposit + auction) | [Activate vault](/guides/activate-vault) |
| 4 | Auction → finalize → trading live | [After activation](/guides/after-activation) |
| 5 | Optional Solana share bridge | [Optional: Solana trading](/overview/solana-share-mesh) |

## Milestones

| Milestone | You are here when… | Trading on Base? |
|-----------|-------------------|------------------|
| **Deployed** | Contracts exist; vault empty | No |
| **Activated** | Deposit done; **auction running** | No |
| **Trading live** | Auction done + finalize complete | Yes |

## FAQ

### What does the $499 fee cover?

The **launch bundle** unlocks deploy plus Charm LP, Ajna lending, optional Solana bridge entitlement, and Meteora provisioning. It does **not** include the creator coin deposit. Details: [Pay launch fee](/guides/strategy-bundle).

### What do buyers get?

**Tradable shares (`■`)**, not the Zora creator coin.

### Is Solana required?

No. See [Optional: Solana trading](/overview/solana-share-mesh).

### What wallet do I need?

A 4626 account with execution-ready signing (including Coinbase Smart Wallet / Base App where applicable).

## Application

**[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)** — confirm launch bundle is active, then deploy and activate.

## More reading

| Topic | Page |
|-------|------|
| Step-by-step launch | [Launch checklist](/guides/greenfield-checklist) |
| Fees & lottery | [How fees and lottery work](/overview/how-it-works) |
| Terminology | [Glossary](/reference/glossary) |
| Contract addresses | [Addresses](/reference/addresses) (v1.14.1) |
