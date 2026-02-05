---
title: ve(3,3) Progress
sidebar_position: 1
---

# ve(3,3) Implementation Progress

Current status of the ve(3,3) governance system.

## Completed

- [x] ve4626 vote-escrow token
- [x] ve4626BoostManager for lottery boosts
- [x] VaultGaugeVoting for probability direction
- [x] VoterRewardsDistributor for fee claims
- [x] Integration with CreatorLotteryManager

## In Progress

- [ ] Frontend voting UI
- [ ] Bribe marketplace
- [ ] Cross-chain voting aggregation

## Architecture

```
ve4626 (lock tokens)
   ↓
VaultGaugeVoting (vote on vaults)
   ↓
Probability budget allocated
   ↓
ve4626BoostManager (personal boosts)
   ↓
CreatorLotteryManager (boosted win chance)
```

## Fee Flow to Voters

```
Trading fees (6.9%)
   ↓
GaugeController splits
   ↓
9.61% → VoterRewardsDistributor
   ↓
Voters claim pro-rata
```
