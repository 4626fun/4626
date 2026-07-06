---
title: Smart contracts
sidebar_position: 1
---

# Smart contracts

Onchain reference for 4626 vault infrastructure. For the launch journey, start with [Launch a vault](/guides/).

4626 uses **shared infrastructure** (batcher, factories, registry) plus a **per-creator stack** for each launch.

## Per-creator stack

| Contract | Documentation |
|----------|---------------|
| CreatorRegistry | [Registry](/contracts/core/creator-registry) — creator coin → vault lookup |
| CreatorOVault | [Vault](/contracts/core/creator-ovault) — ERC-4626 · creator coin deposit |
| CreatorOVaultWrapper | [Wrapper](/contracts/core/creator-ovault-wrapper) — ▢ → ■ at 1:1 |
| CreatorShareOFT | [ShareOFT](/contracts/core/creator-share-oft) — tradable ■ share |
| CreatorGaugeController | [Gauge](/contracts/governance/gauge-controller) — fees · jackpot custody |
| CCA launch strategy | [Auction](/contracts/strategies/cca-launch) — fair-launch auction |
| CreatorLotteryManager | [Lottery](/contracts/utilities/lottery-manager) — instant lottery on buys |
| CreatorOracle | [Oracle](/contracts/utilities/creator-oracle) — TWAP pricing |

## Shared infrastructure

**[Contract addresses](/reference/addresses)** (v1.14.1) — batcher, factories, modules.

Impairment: [disclosures](/reference/impairment-v1-disclosures) · Terminology: [Glossary](/reference/glossary)

## Deploy phases

| Phase | Creator-facing step | Onchain effect |
|-------|---------------------|----------------|
| 1 | [Deploy contracts](/guides/launch-token) | Per-creator stack deployed; vault unfunded |
| 2 | [Activate vault](/guides/activate-vault) | Deposit + wrap + **30/30/30/10** share split |
| 3 | Automatic (launch bundle) | Charm 45% · Ajna 45% · 10% idle |
| 4 | After activation | CCA auction scheduled (Thursday 00:00 UTC) → live → graduate |

Launch is **complete on Base** only after the auction graduates, `sweepCurrency()` / `migrate()` succeed, and hook config aligns with the intended fee collector — see [After activation](/guides/after-activation#when-is-trading-live-on-base).

Source: [github.com/wenakita/4626/contracts](https://github.com/wenakita/4626/tree/main/contracts)
