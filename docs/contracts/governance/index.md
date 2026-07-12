---
title: Governance Contracts
sidebar_position: 2
---

# Governance Contracts

Contracts that manage fee distribution and the ve■4626 / gauge incentive system.

## Overview

| Contract | Purpose |
|----------|---------|
| **[GaugeController](/contracts/governance/gauge-controller)** | Fee splitting and distribution |
| **[ve■4626 naming](/contracts/governance/ve-naming)** | Canonical names: ve■4626, Utility, ve33, veLottery |
| **[ve■4626 (`ve4626`)](/contracts/governance/ve4626)** | Lock **■4626 only**; dual-decay power; utility + lottery boost API |
| **[ve4626GaugeVoting](/contracts/governance/vault-gauge-voting)** | Vote-directed probability budgets (ve33) |
| **[GaugeSurfaceRegistry4626](/contracts/governance/gauge-surface-registry)** | Votes / bribes / streams eligibility allowlist |
| **[RewardStream4626](/contracts/governance/reward-stream)** | Partner multi-token epoch reward streams |
| **[ve4626VoterRewardsDistributor](/contracts/governance/voter-rewards-distributor)** | Voter reward claims |

## Fee Split (immutable BPS)

Split in ShareOFT ■ first. See [Token units](/reference/glossary#token-units).

| Allocation | Percentage | Unit / destination |
|------------|------------|--------------------|
| Lottery | 69% | ShareOFT ■ → `jackpotReserve` |
| Voter/Protocol | 21.39% | ShareOFT ■ → `ve4626VoterRewardsDistributor` (or fallback) |
| Burn | 9.61% | ■ slice → unwrap → ▢ burned (PPS ↑) |
| Creator | 0% (default) | ShareOFT ■ → `creatorTreasury` when enabled |
