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

Source: [github.com/wenakita/4626/contracts](https://github.com/wenakita/4626/tree/main/contracts)
