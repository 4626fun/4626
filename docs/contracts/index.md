---
title: Contracts
sidebar_position: 1
---

# Smart contracts

Onchain reference for 4626 vault infrastructure. For product overview and launch procedures, see [Getting started](/getting-started) and [How it works](/overview/how-it-works).

4626 deploys **shared chain infrastructure** (batcher, factories, registry) once per release, plus a **per-creator stack** for each vault launch.

## Per-creator stack

| Contract | Documentation |
|----------|---------------|
| CreatorRegistry | [Registry](/contracts/core/creator-registry) — creator coin → vault stack resolution |
| CreatorOVault | [Vault](/contracts/core/creator-ovault) — ERC-4626 vault; creator coin deposit asset |
| CreatorOVaultWrapper | [Wrapper](/contracts/core/creator-ovault-wrapper) — ▢ → ■ wrapping (1:1) |
| CreatorShareOFT | [ShareOFT](/contracts/core/creator-share-oft) — tradable ■ share; LayerZero OFT |
| CreatorGaugeController | [Gauge](/contracts/governance/gauge-controller) — fee split; jackpot custody |
| CCA launch strategy | [CCA](/contracts/strategies/cca-launch) — Uniswap V4 fair-launch auction |
| CreatorLotteryManager | [Lottery](/contracts/utilities/lottery-manager) — instant lottery on ShareOFT buys |
| CreatorOracle | [Oracle](/contracts/utilities/creator-oracle) — TWAP pricing |

## Shared infrastructure

Deployment batcher, factories, bridge adapter, and module addresses: **[Contract addresses](/reference/addresses)** (v1.14.1).

Strategy impairment: [impairment v1 disclosures](/reference/impairment-v1-disclosures).

Source: [github.com/wenakita/4626/contracts](https://github.com/wenakita/4626/tree/main/contracts)
