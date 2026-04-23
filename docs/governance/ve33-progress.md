---
title: ve(3,3) Progress
sidebar_position: 1
---

# ve(3,3) Implementation Progress

Current status of the ve(3,3) governance system.

## Completed

- [x] ve4626 vote-escrow token (`contracts/governance/ve4626.sol`)
- [x] ve4626BoostManager for lottery boosts (`contracts/governance/ve4626BoostManager.sol`)
- [x] VaultGaugeVoting for probability direction (`contracts/governance/VaultGaugeVoting.sol`)
- [x] VoterRewardsDistributor for fee claims (`contracts/governance/VoterRewardsDistributor.sol`)
- [x] Integration with CreatorLotteryManager (`contracts/utilities/lottery/CreatorLotteryManager.sol`)
- [x] Frontend voting UI (`frontend/src/pages/GaugeVoting.tsx`)
- [x] Bribe marketplace contract (`contracts/governance/bribes/BribeDepot.sol`)

## In Progress

- [ ] Bribe marketplace frontend (contract is deployed; UI is not yet shipped)

## Planned

- [ ] Cross-chain voting aggregation (no code yet; design pending)

> Categories: **Completed** means contract and, where applicable, frontend exist in the audited commit. **In Progress** means partial code is merged. **Planned** means no code exists yet.

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
