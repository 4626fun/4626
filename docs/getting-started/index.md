---
title: What is 4626?
sidebar_position: 1
---

# What is 4626?

4626 lets creators **launch a vault** from a Zora creator coin on Base, **auction tradable shares**, **run Charm and Ajna strategies**, and **share fees** with holders onchain.

<div class="docs-at-a-glance">

Creator coin on Base? Start with the [Launch checklist](/guides/launch-checklist). After trading is live: [Fees, auction, and lottery](/overview/how-it-works).

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
5. **Solana share bridge** at finalize (~30% of `■`; included in the launch bundle).

[Launch checklist](/guides/launch-checklist) · [After activation](/guides/after-activation)

## Three tokens

| Token | What it is | Example |
|-------|------------|---------|
| **Creator coin** | Zora ERC-20; vault deposit | `$JESSE` |
| **Vault share (`▢`)** | ERC-4626 claim on the vault | `▢JESSE` |
| **Tradable share (`■`)** | DEX + cross-chain ShareOFT | `■JESSE` |

Wrapper locks **1000 ▢ per 1 ■**; `deposit()` presents ~1 creator coin → ~1 ■. Addresses differ. [Token units](/reference/glossary#token-units).

## Before you launch

| Requirement | Why |
|-------------|-----|
| Creator coin on **Base** | Vault deposit asset |
| **50M–100M** creator coin | Activation deposit (shown in app) |
| **4626 account** ready to sign | Deploy and activate |
| **Launch bundle** ($499 USDC) | [Pay launch fee](/guides/strategy-bundle) |

## Milestones

| Milestone | Meaning | Trading on Base? |
|-----------|---------|------------------|
| **Deployed** | Contracts exist; vault empty | No |
| **Activated** | Deposit done; auction scheduled or live | No |
| **Trading live** | Auction done + settle complete | Yes |

## FAQ

**What does $499 cover?** Deploy unlock plus Charm, Ajna, Solana bridge, and Meteora entitlement — not the creator-coin deposit. [Pay launch fee](/guides/strategy-bundle).

**What do buyers get?** Tradable shares (`■`), not the Zora creator coin.

**Do I deploy to Solana separately?** No. ~30% of `■` bridges at Phase 2 finalize. [Solana share bridge](/overview/solana-share-mesh).

**What wallet?** A 4626 account with execution-ready signing.

## App

**[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)** — pay the bundle, then deploy and activate.

[Fees & lottery](/overview/how-it-works) · [Glossary](/reference/glossary) · [Addresses](/reference/addresses)
