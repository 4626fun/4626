---
title: Governance Contracts
sidebar_position: 2
---

# Governance Contracts

Contracts that manage fee distribution and the ve(3,3) incentive system.

## Overview

| Contract | Purpose |
|----------|---------|
| **[GaugeController](/contracts/governance/gauge-controller)** | Fee splitting and distribution |
| **[VaultGaugeVoting](/contracts/governance/vault-gauge-voting)** | Vote-directed probability budgets |
| **[ve4626](/contracts/governance/ve4626)** | Vote-escrow token |
| **[VoterRewardsDistributor](/contracts/governance/voter-rewards-distributor)** | Voter reward claims |

## Fee Split (Defaults, Configurable)

| Allocation | Percentage | Description |
|------------|------------|-------------|
| Lottery | 69% (default) | Jackpot reserve in `CreatorGaugeController` |
| Burn | 21.39% (default) | Immediate PPS-accretive burn |
| Voter/Protocol Branch | 9.61% (default) | Routed to `VoterRewardsDistributor` when configured, protocol/jackpot fallback otherwise |
