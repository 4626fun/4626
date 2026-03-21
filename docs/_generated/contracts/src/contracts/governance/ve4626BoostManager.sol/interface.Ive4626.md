# Ive4626
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/governance/ve4626BoostManager.sol)

**Title:**
ve4626BoostManager

**Author:**
0xakita.eth

Calculates personal ve4626 lottery boost (global 2.5x max, coverage-scaled by held creator shares only)

ONE LOCK ONLY: users lock into ve4626 once. No per-creator lock or "veAKITA" required.
- Global multiplier from total ve4626 share
- Coverage = only the creator shares the user actually holds (passed from swap)
- Matches "full 2.5x only up to their value" requirement


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

### getLock


```solidity
function getLock(address user) external view returns (Lock memory);
```

## Structs
### Lock

```solidity
struct Lock {
    uint256 amount;
    uint256 end;
    uint256 start;
    address lockedToken;
    uint256 underlyingValue;
}
```

