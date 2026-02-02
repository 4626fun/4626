---
title: VaultGaugeVoting
sidebar_position: 2
---

# VaultGaugeVoting

The VaultGaugeVoting contract manages weekly epoch-based voting where ve4626 holders direct lottery probability to creator vaults.

---

## Overview

| Property | Value |
|----------|-------|
| Inheritance | None |
| State | Epoch snapshots, vote records |
| Access | Public voting, permissioned admin |

---

## Epoch system

### Epoch timing

```solidity
uint256 public constant EPOCH_DURATION = 7 days;
uint256 public epochStartTime; // Thursday 00:00 UTC

function getCurrentEpoch() public view returns (uint256) {
    return (block.timestamp - epochStartTime) / EPOCH_DURATION;
}
```

### Epoch lifecycle

```
Epoch N starts (Thursday 00:00 UTC)
    │
    ├─► Users vote for vaults
    ├─► Fees accumulate
    ├─► Probability active from previous votes
    │
Epoch N+1 starts
    │
    ├─► N rewards become claimable
    ├─► New votes take effect
    └─► Cycle repeats
```

---

## Voting

### Cast votes

```solidity
function vote(
    address[] calldata vaults,
    uint256[] calldata weights
) external;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| vaults | address[] | Vault addresses to vote for |
| weights | uint256[] | Basis points (must sum to 10000) |

**Example:**

```solidity
// Vote 60% for vaultA, 40% for vaultB
vaultGaugeVoting.vote(
    [vaultA, vaultB],
    [6000, 4000]
);
```

### Reset votes

```solidity
function resetVotes() external;
```

Clears all votes for the caller. Useful before re-voting.

### Query votes

```solidity
function getUserVotes(address user, uint256 epoch) 
    external view returns (address[] memory vaults, uint256[] memory weights);

function getVaultWeight(address vault, uint256 epoch) 
    external view returns (uint256);

function getTotalWeight(uint256 epoch) 
    external view returns (uint256);
```

---

## Probability direction

### How weights affect probability

```solidity
function getVaultProbabilityBoost(address vault) external view returns (uint256) {
    uint256 currentEpoch = getCurrentEpoch();
    uint256 vaultWeight = getVaultWeight(vault, currentEpoch);
    uint256 totalWeight = getTotalWeight(currentEpoch);
    
    if (totalWeight == 0) return 0;
    return (vaultWeight * PPM_PRECISION) / totalWeight;
}
```

### Effect on lottery

Vaults with more votes have higher win rates for their buyers:

| Vault votes | Total votes | Probability boost |
|-------------|-------------|-------------------|
| 60,000 | 100,000 | 60% of boost pool |
| 40,000 | 100,000 | 40% of boost pool |
| 0 | 100,000 | Base probability only |

---

## Delegation

### Delegate voting power

```solidity
function delegate(address delegatee) external;
```

Delegating passes your voting power to another address. The delegatee votes on your behalf.

### Query delegation

```solidity
function delegates(address account) external view returns (address);
function getVotingPower(address account) external view returns (uint256);
```

---

## Snapshots

### Epoch snapshots

Votes are snapshotted at epoch boundaries:

```solidity
struct EpochSnapshot {
    uint256 totalWeight;
    mapping(address => uint256) vaultWeights;
    mapping(address => VoteRecord) userVotes;
}

mapping(uint256 => EpochSnapshot) public epochSnapshots;
```

### Querying historical data

```solidity
// Get vault weight for a specific epoch
function getVaultWeight(address vault, uint256 epoch) external view returns (uint256);

// Get total weight for a specific epoch
function getTotalWeight(uint256 epoch) external view returns (uint256);
```

---

## Events

```solidity
event Voted(address indexed user, address[] vaults, uint256[] weights, uint256 epoch);
event VotesReset(address indexed user, uint256 epoch);
event Delegated(address indexed delegator, address indexed delegatee);
event EpochStarted(uint256 indexed epoch, uint256 timestamp);
```

---

## Access control

| Function | Access |
|----------|--------|
| vote | Public (ve4626 holders) |
| resetVotes | Public (voters only) |
| delegate | Public |
| setEpochStartTime | Owner only |
| pause/unpause | Emergency admin |

---

## Integration

### For UI developers

```solidity
// Current epoch
uint256 epoch = vaultGaugeVoting.getCurrentEpoch();

// Time until next epoch
uint256 nextEpoch = epochStartTime + ((epoch + 1) * EPOCH_DURATION);
uint256 timeRemaining = nextEpoch - block.timestamp;

// User's current votes
(address[] memory vaults, uint256[] memory weights) = 
    vaultGaugeVoting.getUserVotes(user, epoch);

// User's voting power
uint256 power = vaultGaugeVoting.getVotingPower(user);
```

### For keepers

```solidity
// Check if new epoch started
uint256 currentEpoch = vaultGaugeVoting.getCurrentEpoch();
if (currentEpoch > lastProcessedEpoch) {
    // Trigger epoch transition logic
}
```

---

## Related

- [ve4626](./ve4626) - Lock tokens for voting power
- [Governance](/governance) - User-facing voting guide
- [Lottery](/concepts/lottery) - Probability direction mechanics
