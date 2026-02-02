---
title: ve(3,3) implementation
sidebar_position: 2
---

# ve(3,3) implementation

Technical documentation for the ve(3,3) voting and rewards system.

**Who this is for:** Protocol engineers implementing or integrating with governance.

---

## Implemented components

### 1. Weekly epoch voting (vault gauges)

**Contract:** `contracts/governance/VaultGaugeVoting.sol`

**Purpose:** ve4626 holders vote weekly to allocate a bounded probability budget across creator vaults.

**Key functions:**
- `currentEpoch()` - Returns current epoch number
- `getVaultWeightAtEpoch(epoch, vault)` - Vault's vote weight for epoch
- `getUserVoteWeightAtEpoch(epoch, user, vault)` - User's vote weight for vault
- `canReceiveVotes(vault)` - Check if vault is whitelisted
- `setVaultWhitelist(vault, status)` - Admin whitelist management
- `getTotalGaugeProbabilityBps()` - Global probability budget
- `getVaultGaugeProbabilityBoostPPM(vault)` - Vault's probability boost

### 2. Voter rewards distribution

**Contract:** `contracts/governance/VoterRewardsDistributor.sol`

**Purpose:** Distribute the protocol/voter slice (9.61%) to voters per epoch/vault.

**Policy:**
- Claims only after epoch ends: `epoch < gaugeVoting.currentEpoch()`
- Claimable amount is pro-rata by vote weight
- Zero-vote epochs: rewards held, can be swept later

**Sweep mechanism:**
- `sweepGraceEpochs = 4`
- `sweepZeroVoteEpoch(vault, epoch)` - Owner-only, sends to treasury if 0 votes

### 3. External bribes

**Contracts:**
- `contracts/governance/bribes/BribeDepot.sol` - Epoch-scoped bribe depot per vault (multi-token)
- `contracts/factories/BribesFactory.sol` - CREATE2 factory for depot deployment

**Design:**
- Deposits only for future epochs (prevents retroactive bribing)
- Claims only after epoch ends, pro-rata by vote weight
- Zero-vote epochs: depositor refund path available

---

## Fee flow

### CreatorGaugeController integration

**Contract:** `contracts/governance/CreatorGaugeController.sol`

If `voterRewardsDistributor` is set:
- Routes 9.61% slice as vault share tokens to `VoterRewardsDistributor.notifyRewards()`

If unset:
- Falls back to `protocolTreasury` (or jackpot reserve as final fallback)

### Lottery probability boost

**Contract:** `contracts/services/lottery/CreatorLotteryManager.sol`

If `vaultGaugeVoting` is set:
- Adds vote-directed probability boost via `getVaultGaugeProbabilityBoostPPM(vault)`

If unset:
- Voting has zero effect on lottery (day-1 safe)

---

## Day-1 simple mode

To launch without ve(3,3) UX while still capturing fees:

| Configuration | Setting | Effect |
|--------------|---------|--------|
| `CreatorLotteryManager.vaultGaugeVoting` | `address(0)` | No vote-directed probability boost |
| `CreatorGaugeController.voterRewardsDistributor` | `address(0)` | Fees go to treasury |
| Bribe contracts | Not deployed | No external bribes |

**Enabling later:** Transfer accumulated vault share tokens from treasury to `VoterRewardsDistributor` and/or deposit bribes to seed first epoch.

---

## Test coverage

| Test file | Coverage |
|-----------|----------|
| `test/VaultGaugeVoting.t.sol` | Voting mechanics |
| `test/VoterRewardsDistributor.t.sol` | Epoch claims, zero-vote sweep |
| `test/Bribes.t.sol` | Bribe deposits and claims |

---

## Follow-ups

- Frontend feature flag to hide `/vote` + bribe UI until launch
- Bribe planner tooling for admin-only epoch planning
