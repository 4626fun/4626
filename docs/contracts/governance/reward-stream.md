---
title: RewardStream4626
sidebar_position: 5
---

# RewardStream4626

Thin multi-token **partner reward stream** for vault voters (Flywheel-inspired, 4626-native).

## Purpose

Partners (or protocol) fund **pre-funded ERC-20s** that epoch voters claim pro-rata by gauge vote weight.

This is **not**:

- Hermes Flywheel (no continuous index core, no strategy flywheel, no emissions minter)
- Protocol fee lane (`ve4626VoterRewardsDistributor` / ShareOFT from `CreatorGaugeController`)
- One-shot bribes (`BribeDepot4626`) — still preferred for simple single-epoch bribes

## Layout

```
contracts/shared/governance/rewards/
  RewardStream4626.sol
  RewardStreamFactory4626.sol
  interfaces/
    IRewardStream4626.sol
    IRewardWeightSource.sol
```

## Rules (v1 / Design A)

| Rule | Choice |
|------|--------|
| Accounting | Epoch bag: `epochTokenRewards[epoch][token] += received` |
| Fund credit | **Current epoch** |
| Claim | Only `epoch < currentEpoch` (finalized) |
| Weight | `ve4626GaugeVoting` epoch user/vault weights |
| Tokens | Owner **allowlist** (`addRewardToken` / `removeRewardToken`) |
| FOT | Balance-delta credit on `fund` |
| Zero-vote bag | Permissionless `rolloverZeroVoteEpoch` after ≥1 ended epoch |
| Leftover unclaimed | Owner `rolloverExpiredEpoch` after `rolloverGraceEpochs` (default 4, min 2) |
| Emissions | **None** — pull-only funded tokens |

## API

```solidity
// Factory
createStream(vault) → stream
getOrCreateStream(vault) → stream
streamOf(vault)

// Stream
addRewardToken(token)          // owner
removeRewardToken(token)       // owner
fund(token, amount)            // allowlisted; credits current epoch
claim(epoch, token)
claimMany(epoch, tokens[])
previewClaim(user, epoch, token)
rolloverZeroVoteEpoch(epoch, token)
rolloverExpiredEpoch(epoch, token)  // owner
```

## Lane comparison

| Lane | Contract | Tokens | Who funds |
|------|----------|--------|-----------|
| Protocol fee → voters | `ve4626VoterRewardsDistributor` | Vault ShareOFT only | Gauge controller |
| One-shot bribes | `BribeDepot4626` | Any ERC-20 | Anyone |
| Partner campaigns | `RewardStream4626` | Allowlisted ERC-20s | Partners / protocol |

## Security notes

- Stream create and fund always gate via `ve4626GaugeVoting.canReceiveStreams` (whitelist when surface mode is off; [GaugeSurfaceRegistry4626](./gauge-surface-registry.md) when `useSurfaceRegistry` is armed). Factories do not hold a local surface registry.
- Optional surface registry separates votes / bribes / streams flags on voting.
- No path into jackpot / burn / fee split.
- Owner cannot pull bags except via documented rollover policy.

## Frontend

- `/vote` panel: `frontend/src/components/ve33/RewardStream4626Panel.tsx`
- Hook: `frontend/src/hooks/useRewardStream4626.ts`
- Env: `VITE_REWARD_STREAM_FACTORY_4626`, `VITE_VE4626_GAUGE_VOTING`

## Tests

```bash
forge test --match-path 'test/governance/RewardStream4626.t.sol' -vv
```
