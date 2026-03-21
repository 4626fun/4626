# CreatorOVaultStrategiesModule
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/vault/modules/CreatorOVaultStrategiesModule.sol)

**Inherits:**
[CreatorOVaultModuleBase](/contracts/vault/modules/CreatorOVaultModuleBase.sol/abstract.CreatorOVaultModuleBase.md)

Strategy management + strategy interaction logic for CreatorOVault.

Must be invoked via delegatecall from CreatorOVault.


## State Variables
### MAX_BPS

```solidity
uint256 internal constant MAX_BPS = 10_000
```


### MAX_QUEUE

```solidity
uint256 internal constant MAX_QUEUE = 10
```


### MAX_STRATEGIES

```solidity
uint256 internal constant MAX_STRATEGIES = 5
```


## Functions
### addStrategy


```solidity
function addStrategy(address strategy, uint256 weight) external onlyDelegateCall;
```

### addStrategy


```solidity
function addStrategy(address strategy, uint256 weight, bool addToQueue) public onlyDelegateCall;
```

### removeStrategy


```solidity
function removeStrategy(address strategy) external onlyDelegateCall;
```

### updateStrategyWeight


```solidity
function updateStrategyWeight(address strategy, uint256 newWeight) external onlyDelegateCall;
```

### _syncCoinBalance


```solidity
function _syncCoinBalance() internal returns (uint256 actual);
```

### _depositIntoStrategyMeasured

Strategy deposit accounting is based on measured vault outflow (`spent`),
not strategy-reported values, so fee-on-transfer and partial-spend
strategy internals do not brick keeper deploys.


```solidity
function _depositIntoStrategyMeasured(address strategy, uint256 amount) internal returns (uint256 deposited);
```

### _withdrawFromStrategyMeasured


```solidity
function _withdrawFromStrategyMeasured(address strategy, uint256 amount) internal returns (uint256 withdrawn);
```

### _withdrawFromStrategyBestEffort


```solidity
function _withdrawFromStrategyBestEffort(address strategy, uint256 amount) internal returns (uint256 withdrawn);
```

### _getStrategyAssetsSafe


```solidity
function _getStrategyAssetsSafe(address strategy) internal view returns (uint256 assets);
```

### __withdrawFromStrategies


```solidity
function __withdrawFromStrategies(uint256 amountNeeded) external onlyDelegateCall returns (uint256 totalWithdrawn);
```

### _withdrawFromStrategies


```solidity
function _withdrawFromStrategies(uint256 amountNeeded) internal returns (uint256 totalWithdrawn);
```

### _assessUnrealisedLoss


```solidity
function _assessUnrealisedLoss(address strategy, uint256 currentDebt, uint256 assetsNeeded)
    internal
    view
    returns (uint256);
```

### __autoAllocateToStrategy


```solidity
function __autoAllocateToStrategy() external onlyDelegateCall;
```

### _autoAllocateToStrategy


```solidity
function _autoAllocateToStrategy() internal;
```

### tend


```solidity
function tend() external onlyDelegateCall;
```

### deployToStrategies


```solidity
function deployToStrategies() external onlyDelegateCall;
```

### forceDeployToStrategies


```solidity
function forceDeployToStrategies() external onlyDelegateCall;
```

### _deployToStrategies


```solidity
function _deployToStrategies() internal;
```

### setDefaultQueue


```solidity
function setDefaultQueue(address[] calldata newQueue) external onlyDelegateCall;
```

### setUseDefaultQueue


```solidity
function setUseDefaultQueue(bool _useDefaultQueue) external onlyDelegateCall;
```

### setAutoAllocate


```solidity
function setAutoAllocate(bool _autoAllocate) external onlyDelegateCall;
```

### setMinimumTotalIdle


```solidity
function setMinimumTotalIdle(uint256 _minimumTotalIdle) external onlyDelegateCall;
```

### setDebtPurchaser


```solidity
function setDebtPurchaser(address _debtPurchaser) external onlyDelegateCall;
```

### buyDebt


```solidity
function buyDebt(address strategy, uint256 amount) external onlyDelegateCall;
```

### assessUnrealisedLosses


```solidity
function assessUnrealisedLosses(address strategy, uint256 assetsNeeded)
    external
    view
    onlyDelegateCall
    returns (uint256);
```

### _removeFromQueue


```solidity
function _removeFromQueue(address strategy) internal;
```

## Events
### StrategyAdded

```solidity
event StrategyAdded(address indexed strategy, uint256 weight);
```

### StrategyRemoved

```solidity
event StrategyRemoved(address indexed strategy);
```

### StrategyDeployed

```solidity
event StrategyDeployed(address indexed strategy, uint256 amount);
```

### StrategyWithdrawn

```solidity
event StrategyWithdrawn(address indexed strategy, uint256 amount);
```

### StrategyWithdrawFailed

```solidity
event StrategyWithdrawFailed(address indexed strategy, uint256 amount, bytes revertData);
```

### UpdateDefaultQueue

```solidity
event UpdateDefaultQueue(address[] newDefaultQueue);
```

### UpdateUseDefaultQueue

```solidity
event UpdateUseDefaultQueue(bool useDefaultQueue);
```

### UpdateAutoAllocate

```solidity
event UpdateAutoAllocate(bool autoAllocate);
```

### UpdateMinimumTotalIdle

```solidity
event UpdateMinimumTotalIdle(uint256 minimumTotalIdle);
```

### UpdateDebtPurchaser

```solidity
event UpdateDebtPurchaser(address indexed newDebtPurchaser);
```

### DebtUpdated

```solidity
event DebtUpdated(address indexed strategy, uint256 currentDebt, uint256 newDebt);
```

### DebtPurchased

```solidity
event DebtPurchased(address indexed strategy, uint256 amount, address indexed buyer);
```

### UnrealisedLossAssessed

```solidity
event UnrealisedLossAssessed(address indexed strategy, uint256 lossAmount);
```

### AutoAllocated

```solidity
event AutoAllocated(address indexed strategy, uint256 amount);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### StrategyAlreadyActive

```solidity
error StrategyAlreadyActive();
```

### StrategyNotActive

```solidity
error StrategyNotActive();
```

### MaxStrategiesReached

```solidity
error MaxStrategiesReached();
```

### InvalidWeight

```solidity
error InvalidWeight();
```

### QueueTooLong

```solidity
error QueueTooLong(uint256 length, uint256 maxLength);
```

### StrategyAssetMismatch

```solidity
error StrategyAssetMismatch(address expected, address actual);
```

### NoStrategies

```solidity
error NoStrategies();
```

### NothingToBuy

```solidity
error NothingToBuy();
```

### TransferAmountMismatch

```solidity
error TransferAmountMismatch(uint256 expected, uint256 actual);
```

