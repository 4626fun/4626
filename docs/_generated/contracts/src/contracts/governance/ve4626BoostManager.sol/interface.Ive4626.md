# Ive4626
[Git Source](https://github.com/creatorvault/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/contracts/governance/ve4626BoostManager.sol)

**Title:**
ve4626BoostManager

**Author:**
0xakita.eth

Calculates lottery boost based on ve4626 holdings.

Users who lock ■4626 into ve4626 receive higher win probability.


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

