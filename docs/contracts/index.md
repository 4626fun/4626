---
title: Contracts
sidebar_position: 1
---

# Smart contracts

**New to 4626?** Start with [Getting started](/getting-started) and [How it works](/overview/how-it-works). This section is for **onchain detail** after you understand the product.

4626 uses **shared infrastructure** (one batcher and factories per chain) plus a **per-creator stack** each time someone launches a vault.

## Per-creator stack

| Contract | Doc |
|----------|-----|
| CreatorRegistry | [Registry](/contracts/core/creator-registry) — find vault addresses from creator coin |
| CreatorOVault | [Vault](/contracts/core/creator-ovault) — holds creator coin; mints ▢ shares |
| CreatorOVaultWrapper | [Wrapper](/contracts/core/creator-ovault-wrapper) — ▢ → ■ wrapping |
| CreatorShareOFT | [ShareOFT](/contracts/core/creator-share-oft) — tradable ■ share |
| CreatorGaugeController | [Gauge](/contracts/governance/gauge-controller) — fees and jackpot |
| CCA launch strategy | [CCA](/contracts/strategies/cca-launch) — fair auction |
| CreatorLotteryManager | [Lottery](/contracts/utilities/lottery-manager) — instant lottery on buys |
| CreatorOracle | [Oracle](/contracts/utilities/creator-oracle) — pricing |

## Shared infrastructure

Factories, deployment batcher, bridge adapter: **[live addresses](/reference/addresses)** (v1.14.1).

Impairment (strategy failure): [impairment v1 disclosures](/reference/impairment-v1-disclosures).

Source code: [github.com/wenakita/4626/contracts](https://github.com/wenakita/4626/tree/main/contracts)
