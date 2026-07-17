---
title: What is 4626?
sidebar_position: 1
---

# What is 4626?

4626 lets creators **launch a vault** from a Zora creator coin on Base, **auction tradable shares**, **run Charm and Ajna strategies**, and **share fees** with holders onchain.

<div class="docs-at-a-glance">

Creator coin on Base? Start with the [Launch checklist](/guides/launch-checklist). For fees and lottery after trading is live, see [Fees, auction, and lottery](/overview/how-it-works).

</div>

## Who this is for

Creators with a **creator coin on Base** (typically via Zora) who want to:

- Launch an **ERC-4626 vault** from their creator coin
- **Auction tradable shares** (open price discovery — not a private sale)
- Attach **Charm LP** and **Ajna** lending
- Share **trade fees** and qualified **creator revenue** with holders

## How it works

1. Pay the **launch bundle** ($499 USDC) — unlocks deploy.
2. **Deploy** vault, share, gauge, oracle, and auction contracts.
3. **Activate** — deposit 50M–100M creator coin; attach strategies; schedule the share auction.
4. Auction **graduates** → finalize → `■` shares trade on Base; fees and lottery apply to qualifying buys.
5. **Solana share bridge** runs at finalize (~30% of `■`; included in the launch bundle).

Full timeline: [Launch checklist](/guides/launch-checklist) · [After activation](/guides/after-activation)

## Three tokens

| Token | What it is | Example |
|-------|------------|---------|
| **Creator coin** | Zora ERC-20; vault deposit | `$JESSE` |
| **Vault share (`▢`)** | ERC-4626 claim on the vault | `▢JESSE` |
| **Tradable share (`■`)** | DEX + cross-chain ShareOFT | `■JESSE` |

[CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) locks **1000 ▢ per 1 ■**; `deposit()` presents ~1 creator coin → ~1 ■. Creator coin address **≠** share token address. See [Token units](/reference/glossary#token-units).

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
| 3 | Activate vault (deposit + share split + auction) | [Activate vault](/guides/activate-vault) |
| 4 | Auction → finalize → trading live | [After activation](/guides/after-activation) |
| 5 | Solana share bridge (at finalize) | [Solana share bridge](/overview/solana-share-mesh) |

## Milestones

| Milestone | You are here when… | Trading on Base? |
|-----------|-------------------|------------------|
| **Deployed** | Contracts exist; vault empty | No |
| **Activated** | Deposit done; **auction scheduled or live** | No |
| **Trading live** | Auction done + finalize complete | Yes |

## FAQ

### What does the $499 fee cover?

The **launch bundle** unlocks deploy plus Charm LP, Ajna lending, Solana share bridge + Meteora entitlement. It does **not** include the creator coin deposit. Details: [Pay launch fee](/guides/strategy-bundle).

### What do buyers get?

**Tradable shares (`■`)**, not the Zora creator coin.

### Do I deploy to Solana separately?

No. The Solana share bridge is **built into deployment** and runs at Phase 2 finalize (~30% of `■` supply). Meteora pool setup may complete shortly after. See [Solana share bridge](/overview/solana-share-mesh).

### What wallet do I need?

A 4626 account with execution-ready signing (including Coinbase Smart Wallet / Base App where applicable).

## Application

**[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)** — confirm launch bundle is active, then deploy and activate.

## More reading

| Topic | Page |
|-------|------|
| Step-by-step launch | [Launch checklist](/guides/launch-checklist) |
| Fees & lottery | [How fees and lottery work](/overview/how-it-works) |
| Terminology | [Glossary](/reference/glossary) |
| Contract addresses | [Addresses](/reference/addresses) |
