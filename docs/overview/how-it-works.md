---
title: How it works
sidebar_position: 2
---

# How it works

4626 turns a **Zora creator coin** into a **vault with tradable shares** on Base. Holders of those shares earn from trading activity and from creator revenue that flows into the vault.

**Just launching?** You can skim the first three sections and use the [Launch checklist](/guides/greenfield-checklist) for steps.

## What problem this solves

A creator coin alone doesn’t give buyers a standardized **claim on vault TVL**, a **fair launch**, or automatic **fee sharing**. 4626 adds:

- A **vault** that holds your creator coin and tracks who owns what  
- A **fair auction** so price discovery isn’t a private presale  
- **Tradable shares** buyers can swap on DEXs  
- **Fee routing** so activity benefits share holders, not just the creator wallet  

## Three tokens, one vault

```text
  Creator coin ($TICKER)          Vault share (▢TICKER)         Tradable share (■TICKER)
  ─────────────────────          ─────────────────────         ───────────────────────
  Your Zora token                Receipt inside the vault      What people buy & sell
  Goes IN the vault              Minted when you deposit       Wrapped 1:1 from ▢ shares
  Same address you had before    Not the main trading token    This is the DEX token
```

**Rule:** creator coin address **≠** share token address. Never treat them as interchangeable.

## What happens after launch

```text
  Buyer swaps on Base DEX
           │
           ▼
  Buys ■ share token ──► Trade fee ──► Gauge (splits / jackpot / burn)
           │
           └──► May enter instant lottery (on buys, not on wraps or deposits)

  Zora creator revenue (payouts) ──► Payout router ──► Vault ──► Share holders gain PPS
```

- **Trade fees** — Charged on share transfers; part goes to holders via the gauge (including share burn mechanics).  
- **Creator revenue** — External Zora earnings can route into the vault so **price per share** rises for everyone.  
- **Jackpot** — A slice of fees builds a pool; the lottery manager picks winners on qualifying **buys**.  

Exact lane names for integrators: [Glossary](/reference/glossary).

## Launch journey (phases)

| Phase | You do | Result |
|-------|--------|--------|
| **0 — Pay** | [Strategy bundle](/guides/strategy-bundle) ($499 USDC) | App unlocks deploy |
| **1 — Deploy** | [Launch vault](/guides/launch-token) in the app | Vault, shares, auction contracts exist |
| **2 — Activate** | [Activate vault](/guides/activate-vault) | Your creator coin is deposited; auction starts |
| **After auction** | App finalizes onchain | Optional: ~30% of shares bridge to [Solana](/overview/solana-share-mesh) |
| **Strategies** | Automatic with bundle | Charm + Ajna manage part of vault CREATOR (45% / 45% / 10% idle) |

Phases 1–2 are what **you** click through in the app. Later steps are orchestrated onchain after the auction.

## Solana (optional)

Base is the **hub**. You do **not** need Solana to go live.

After finalize, a portion of shares **may** bridge to Solana as the same `■TICKER` symbol for Meteora trading. Your **creator coin stays on Base**. Details: [Solana share mesh](/overview/solana-share-mesh).

## Core contracts (for developers)

Each creator gets their own vault stack. Shared factories and the deployment batcher are listed under [addresses](/reference/addresses) (v1.14.1).

| Contract | Role |
|----------|------|
| [CreatorRegistry](/contracts/core/creator-registry) | Lookup: creator coin → vault addresses |
| [CreatorOVault](/contracts/core/creator-ovault) | Holds creator coin; mints ▢ shares |
| [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) | Wraps ▢ → ■ |
| [CreatorShareOFT](/contracts/core/creator-share-oft) | Tradable ■ share; cross-chain |
| [CreatorGaugeController](/contracts/governance/gauge-controller) | Fee split and jackpot custody |
| [CCA strategy](/contracts/strategies/cca-launch) | Fair-launch auction |
| [CreatorLotteryManager](/contracts/utilities/lottery-manager) | Lottery on share **buys** |
| [CreatorOracle](/contracts/utilities/creator-oracle) | Price feeds for lottery sizing |

Impairment (strategy failure mode): [disclosures](/reference/impairment-v1-disclosures).

## Next steps

- [Getting started](/getting-started) · [Launch checklist](/guides/greenfield-checklist) · [Contracts hub](/contracts)
