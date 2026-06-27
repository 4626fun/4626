# Ive4626BoostManager
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/lottery/CreatorLotteryManager.sol)


## Functions
### calculateBoost


```solidity
function calculateBoost(address user) external view returns (uint256 boostBps);
```

### getTotalProbabilityBoost


```solidity
function getTotalProbabilityBoost(address user) external view returns (uint256 boostBps);
```

### getCoverageBps


```solidity
function getCoverageBps(
    address user,
    address registry,
    address creatorCoin,
    address shareBalanceToken,
    uint256 creatorShareBalanceAmount,
    uint256 swapAmountUSD
) external view returns (uint256 coverageBps);
```

### hasBoost


```solidity
function hasBoost(address user) external view returns (bool);
```

