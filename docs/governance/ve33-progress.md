---
title: ve(3,3) Progress
sidebar_position: 1
---

# ve(3,3) Implementation Progress

Current status of the ve(3,3) governance system.

## Completed

- [x] ve4626 vote-escrow token (`contracts/shared/governance/ve4626.sol`)
- [x] ve4626BoostManager for lottery boosts (`contracts/shared/governance/ve4626BoostManager.sol`)
- [x] ve4626GaugeVoting for probability direction (`contracts/shared/governance/ve4626GaugeVoting.sol`)
- [x] ve4626VoterRewardsDistributor for fee claims (`contracts/shared/governance/ve4626VoterRewardsDistributor.sol`)
- [x] Integration with LotteryManager4626 boost path
- [x] Frontend voting UI (`frontend/src/pages/GaugeVoting.tsx`)
- [x] Bribe marketplace contract (`contracts/shared/governance/bribes/BribeDepot.sol`)
- [x] **Curve-style dual-decay** `getTotalVotingPower()` on ve4626
- [x] **Utility** `ve4626Utility` + `ve4626UtilityToken` (**ve33** / **veLottery**) — [ve-naming.md](../contracts/governance/ve-naming.md)
- [x] `sync(user)` — dual-decay capacity clamp (burn veLottery first, then ve33)
- [x] **P1 stale-utility fix:** `previewUtilities` / `effectiveVe33Of` / `effectiveVeLotteryOf`; gauge `vote()` syncs; boost uses live effective veLottery
- [x] `ve4626BoostManager`: working-balance `calculateBoostForPosition` (**1.0×–2.5×** tokenless-normalized); additive lock PPM ≡ 0
- [x] LotteryManager: personal mult via ForPosition + total Share USD (pool L), with uplift blended by covered swap fraction
- [x] `ve4626GaugeVoting`: `setUtility` + optional `ve33Token` + 1h epoch freeze
- [x] `DeployRewardsEcosystem` deploys + wires `setUtility` on voting + boostManager

## In Progress

- [ ] Bribe marketplace frontend
- [ ] Mainnet deploy / canary
- [ ] Permanent b-mode (deposit-only) — design only

## Planned

- [ ] Cross-chain voting aggregation
- [ ] Full design: [2026-07-09-ve-rights-split-design.md](../plans/2026-07-09-ve-rights-split-design.md)

## Architecture (implemented)

```
■ → ve■4626 (ve4626, dual-decay)
       │
       ▼ ve4626Utility
  ┌────┴────┐
  ▼         ▼
ve33   veLottery
  │         │
  ▼         ▼
GaugeVoting  BoostManager → Lottery mult (+ coverage)
(+ fees)
```

## Fee Flow to Voters

```
Trading fees (6.9%)
   ↓
GaugeController splits
   ↓
21.39% → ve4626VoterRewardsDistributor
   ↓
Voters claim pro-rata
```
