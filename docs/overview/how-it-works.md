---
title: How it works
sidebar_position: 2
---

# How it works

4626 turns a **Zora creator coin** into a **vault with tradable shares** on Base. Share holders benefit from trading activity and from creator revenue that flows into the vault.

**Launching now?** Use the [Launch checklist](/guides/greenfield-checklist). **Brand new?** Start with [Getting started](/getting-started).

## What problem this solves

A creator coin by itself doesn’t give buyers:

- A clear **ownership receipt** tied to vault value  
- A **fair, open launch** (vs opaque presales)  
- Automatic **fee sharing** with holders  

4626 adds a vault, a fair auction, tradable shares, and onchain fee routing.

## Three tokens, one vault {#three-tokens-one-vault}

```text
  Creator coin ($TICKER)          Vault share (▢TICKER)         Tradable share (■TICKER)
  ─────────────────────          ─────────────────────         ───────────────────────
  Your Zora token                Receipt inside the vault      What people buy & sell
  Goes IN the vault              Minted when you deposit       Wrapped 1:1 from ▢ shares
  Same address as before         Not the main DEX token        This is the DEX token
```

**Rule:** creator coin address **≠** share token address.

## What happens after launch

```text
  Buyer swaps on Base DEX
           │
           ▼
  Buys ■ share ──► Trade fee ──► Gauge (split / jackpot / burn)
           │
           └──► May enter instant lottery (buys only — not wraps or deposits)

  Zora creator payouts ──► Payout router ──► Vault ──► Each share worth more (PPS rises)
```

- **Trade fees** — On share transfers; part returns to holders via the gauge (including burn mechanics).  
- **Creator revenue** — External Zora earnings can enter the vault so **price per share** rises for everyone.  
- **Jackpot** — Fees build a pool; the lottery manager picks winners on qualifying **buys**.  

Integrator lane names: [Glossary](/reference/glossary).

## Launch journey

| Step | You do | Result |
|------|--------|--------|
| **1 — Pay** | [Strategy bundle](/guides/strategy-bundle) | App unlocks deploy |
| **2 — Deploy** | [Launch vault](/guides/launch-token) | Contracts exist |
| **3 — Activate** | [Activate vault](/guides/activate-vault) | Coin in vault; auction starts |
| **4 — Auction** | Wait / monitor in app | Price discovery completes |
| **5 — Finalize** | Automatic onchain | Optional ~30% of shares → [Solana](/overview/solana-share-mesh) |
| **6 — Strategies** | Automatic with bundle | Charm 45% · Ajna 45% · 10% idle CREATOR |

Steps 2–3 are what you click in the app. Steps 4–6 happen after activation.

## Solana (optional)

Base is the hub. You do **not** need Solana to trade or run the lottery on Base.

After finalize, shares **may** bridge to Solana as the same `■TICKER` for Meteora trading. Creator coin stays on Base. [Solana share mesh](/overview/solana-share-mesh).

## Core contracts (developers)

Shared batcher and factories: [addresses](/reference/addresses) (v1.14.1). Each creator also gets:

| Contract | Role |
|----------|------|
| [CreatorRegistry](/contracts/core/creator-registry) | Creator coin → vault stack lookup |
| [CreatorOVault](/contracts/core/creator-ovault) | Holds creator coin; mints ▢ shares |
| [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) | Wraps ▢ → ■ |
| [CreatorShareOFT](/contracts/core/creator-share-oft) | Tradable ■ share |
| [CreatorGaugeController](/contracts/governance/gauge-controller) | Fees and jackpot custody |
| [CCA strategy](/contracts/strategies/cca-launch) | Fair-launch auction |
| [CreatorLotteryManager](/contracts/utilities/lottery-manager) | Lottery on share buys |
| [CreatorOracle](/contracts/utilities/creator-oracle) | Pricing for lottery |

Strategy impairment: [disclosures](/reference/impairment-v1-disclosures).

## Next steps

[Getting started](/getting-started) · [Launch checklist](/guides/greenfield-checklist) · [Contracts](/contracts)
