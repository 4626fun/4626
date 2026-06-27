---
title: Contracts
sidebar_position: 1
---

# Smart contracts

4626 deploys **shared infrastructure once per chain** and a **per-creator stack** for each vault launch.

## Per-creator stack

| Contract | Doc |
|----------|-----|
| CreatorOVault | [Vault](/contracts/core/creator-ovault) — ERC-4626, strategies, shares |
| CreatorOVaultWrapper | [Wrapper](/contracts/core/creator-ovault-wrapper) — share wrapping |
| CreatorShareOFT | [ShareOFT](/contracts/core/creator-share-oft) — LayerZero share token |
| CreatorGaugeController | [Gauge](/contracts/governance/gauge-controller) — fees & jackpot custody |
| CCA launch strategy | [CCA](/contracts/strategies/cca-launch) — fair launch auction |
| CreatorLotteryManager | [Lottery](/contracts/utilities/lottery-manager) — instant lottery |
| CreatorOracle | [Oracle](/contracts/utilities/creator-oracle) — TWAP pricing |

## Shared infrastructure

Factories, deployment batcher, registry, bridge adapter, and module addresses: **[live addresses](/reference/addresses)**.

Impairment side-pocket behavior: [impairment v1 disclosures](/reference/impairment-v1-disclosures).

Source: [github.com/wenakita/4626/contracts](https://github.com/wenakita/4626/tree/main/contracts)
