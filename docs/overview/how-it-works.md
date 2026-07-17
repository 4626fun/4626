---
title: Fees, auction, and lottery
sidebar_position: 2
---

# Fees, auction, and lottery

How a Zora creator coin becomes a vault: auction tradable shares, run strategies, share fees, and run an instant lottery on qualifying buys.

<div class="docs-at-a-glance">

[Launch checklist](/guides/launch-checklist) · Creator coin, vault share (`▢`), and tradable share (`■`) are three separate addresses.

</div>

## What 4626 adds

A creator coin alone does not give ERC-4626 claims, open share auctions, or onchain fee sharing. 4626 deploys vault, auction, ShareOFT, gauge, oracle, and lottery contracts per creator.

## Token model {#three-tokens-one-vault}

```text
  Creator coin ($TICKER)     Vault share (▢TICKER)       Tradable share (■TICKER)
  ─────────────────────     ─────────────────────       ───────────────────────
  Zora ERC-20; deposit      ERC-4626 internal claim     LayerZero ShareOFT (DEX)
  ~1 → 1000 ▢ at bootstrap  Minted on deposit           1000 ▢ → 1 ■ via wrapper
```

Creator coin address **≠** share address. [Token units](/reference/glossary#token-units).

## After trading is live

```text
  DEX buy of ■ on Base
           │
           ▼
  ShareOFT fee → gauge → burn / jackpot / protocol split
           │
           └──► Qualifying buy → instant lottery (VRF)

  Zora creator earnings → creatorCoinPayoutRecipient → vault PPS
```

- **Trade fees** — ShareOFT fees on qualifying DEX routes → gauge split.
- **Creator revenue** — `creatorCoinPayoutRecipient` can accrue holder PPS (router mode).
- **Jackpot** — Gauge custodies; [LotteryManager4626](/contracts/utilities/lottery-manager) pays on qualifying **buys**.

Personal boost: [ve■4626](/overview/ve4626). Formal math: [2.5× boost](/audits/aristotle/curve-boost).

## Share allocation at finalize

Activation wraps the deposit into `■`, then splits **30/30/30/10**:

| Leg | % | What happens |
|-----|---|--------------|
| Auction | 30% | Open price discovery |
| Creator vesting | 30% | 365-day linear vest |
| Solana bridge | 30% | LayerZero bridge at finalize |
| LP reserve | 10% | Held for post-auction v4 migration |

Strategies (same session): Charm **45%** · Ajna **45%** · **10% idle**.

**Trading live** needs auction graduation + `sweepCurrency()` + `migrate()` + hook alignment — not activation alone. [After activation](/guides/after-activation#when-is-trading-live-on-base).

## Solana

Base is primary for deploy, auction, and lottery. ~30% of `■` still bridges at finalize on every new launch. [Solana share bridge](/overview/solana-share-mesh).

## Core contracts

Shared infra: [Addresses](/reference/addresses) (v1.19.1). Per creator: [Registry](/contracts/core/creator-registry) · [Vault](/contracts/core/creator-ovault) · [Wrapper](/contracts/core/creator-ovault-wrapper) · [ShareOFT](/contracts/core/creator-share-oft) · [Gauge](/contracts/governance/gauge-controller) · [CCA arm](/contracts/strategies/cca-launch) · [Lottery](/contracts/utilities/lottery-manager) · [Oracle](/contracts/utilities/creator-oracle).

[Launch checklist](/guides/launch-checklist) · [Glossary](/reference/glossary)
