# IVaultLiquidityReader
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/libraries/CreatorOVaultLiquidityLib.sol)


## Functions
### coinBalance


```solidity
function coinBalance() external view returns (uint256);
```

### minimumTotalIdle


```solidity
function minimumTotalIdle() external view returns (uint256);
```

### deploymentThreshold


```solidity
function deploymentThreshold() external view returns (uint256);
```

### totalAssets


```solidity
function totalAssets() external view returns (uint256);
```

### totalQueuedWithdrawalShares


```solidity
function totalQueuedWithdrawalShares() external view returns (uint256);
```

### lockedShares


```solidity
function lockedShares() external view returns (uint256);
```

### largeWithdrawalThreshold


```solidity
function largeWithdrawalThreshold() external view returns (uint256);
```

### strategyCount


```solidity
function strategyCount() external view returns (uint256);
```

### strategyList


```solidity
function strategyList(uint256 index) external view returns (address);
```

### activeStrategies


```solidity
function activeStrategies(address strategy) external view returns (bool);
```

### strategyDebt


```solidity
function strategyDebt(address strategy) external view returns (uint256);
```

### strategyMaxAssets


```solidity
function strategyMaxAssets(address strategy) external view returns (uint256);
```

