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

## Fee Split (Defaults, Configurable)

| Allocation | Percentage | Description |
|------------|------------|-------------|
| Lottery | 69% (default) | Jackpot reserve in `CreatorGaugeController` |
| Voter/Protocol Branch | 21.39% (default) | Routed to `ve4626VoterRewardsDistributor` when configured, protocol/jackpot fallback otherwise |
| Burn | 9.61% (default) | Immediate PPS-accretive burn |
