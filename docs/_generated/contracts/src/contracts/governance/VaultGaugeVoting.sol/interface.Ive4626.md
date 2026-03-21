# Ive4626
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/governance/VaultGaugeVoting.sol)

**Title:**
VaultGaugeVoting

**Author:**
0xakita.eth

ve(3,3) style gauge voting for directing jackpot probability to creator vaults

VOTING MECHANISM:
ve4626 holders vote to direct jackpot probability to specific creator vaults.
This is similar to veCRV/veVELO, but we direct PROBABILITY instead of emissions.

FIXED BUDGET:
Total system-wide gauge budget is locked at 69,420 PPM forever.
Votes allocate this budget proportionally (with 35,000 PPM per-vault cap).
This feeds directly into CreatorLotteryManager._applyBoost as flat additive PPM.

EPOCH SYSTEM:
Weekly epochs (7 days), starting Thursday 00:00 UTC.
Votes can be changed anytime; weights are tallied live.


## Functions
### getVotingPower


```solidity
function getVotingPower(address user) external view returns (uint256);
```

### getTotalVotingPower


```solidity
function getTotalVotingPower() external view returns (uint256);
```

### hasActiveLock


```solidity
function hasActiveLock(address user) external view returns (bool);
```

### getRemainingLockTime


```solidity
function getRemainingLockTime(address user) external view returns (uint256);
```

