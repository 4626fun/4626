---
title: Smart contracts
sidebar_position: 1
---

# Smart contracts

Onchain reference for 4626 vault infrastructure. Launch journey: [Launch a vault](/guides/).

Shared infrastructure (batcher, factories, registry) plus a **per-creator stack** per launch.

## Per-creator stack

| Contract | Documentation |
|----------|---------------|
| Registry4626 | [Registry](/contracts/core/creator-registry) — creator coin → vault lookup |
| CreatorOVault | [Vault](/contracts/core/creator-ovault) — ERC-4626 · creator coin deposit |
| CreatorOVaultWrapper | [Wrapper](/contracts/core/creator-ovault-wrapper) — 1000 ▢ → 1 ■ |
| CreatorShareOFT | [ShareOFT](/contracts/core/creator-share-oft) — tradable ■ share |
| CreatorGaugeController | [Gauge](/contracts/governance/gauge-controller) — fees · jackpot custody |
| CCA launch arm | [Auction](/contracts/strategies/cca-launch) — share auction |
| LotteryManager4626 | [Lottery](/contracts/utilities/lottery-manager) — instant lottery on buys |
| CreatorOracle | [Oracle](/contracts/utilities/creator-oracle) — TWAP pricing |

## Shared infrastructure

**[Contract addresses](/reference/addresses)** (v1.19.1) — batcher, factories, modules.

[Impairment disclosures](/reference/impairment-v1-disclosures) · [Glossary](/reference/glossary)

## Deploy phases

| Phase | Creator-facing step | Onchain effect |
|-------|---------------------|----------------|
| 1 | [Deploy contracts](/guides/launch-token) | Per-creator stack; vault unfunded |
| 2 | [Activate vault](/guides/activate-vault) | Deposit + wrap + **30/30/30/10** |
| 3 | Automatic (launch bundle) | Charm 45% · Ajna 45% · 10% idle |
| 4 | After activation | Auction scheduled → live → graduate |

Launch is **complete on Base** after auction graduation, `sweepCurrency()` / `migrate()`, and hook alignment — see [After activation](/guides/after-activation#when-is-trading-live-on-base).

Source: [github.com/wenakita/4626/contracts](https://github.com/wenakita/4626/tree/main/contracts)
