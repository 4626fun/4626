# CreatorOVaultStrategiesModule
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/vault/modules/CreatorOVaultStrategiesModule.sol)

**Inherits:**
[CreatorOVaultModuleBase](/contracts/vault/modules/CreatorOVaultModuleBase.sol/abstract.CreatorOVaultModuleBase.md), [ICreatorOVaultModuleIdentity](/contracts/vault/modules/ICreatorOVaultModuleIdentity.sol/interface.ICreatorOVaultModuleIdentity.md)

Strategy management + strategy interaction logic for CreatorOVault.

Must be invoked via delegatecall from CreatorOVault.


## Constants
### MODULE_KIND

```solidity
bytes32 internal constant MODULE_KIND = keccak256("CreatorOVaultModule.strategies")
```


### MODULE_STORAGE_VERSION

```solidity
bytes32 internal constant MODULE_STORAGE_VERSION = keccak256("CreatorOVaultModuleStorage.v3")
```


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
### moduleKind


```solidity
function moduleKind() external pure returns (bytes32);
```

### moduleStorageVersion


```solidity
function moduleStorageVersion() external pure returns (bytes32);
```

### addStrategy


```solidity
function addStrategy(address strategy, uint256 weight) external onlyDelegateCall;
```

### addStrategy


```solidity
function addStrategy(address strategy, uint256 weight, bool addToQueue) public onlyDelegateCall;
```

### migrateStrategy


```solidity
function migrateStrategy(address oldStrategy, address newStrategy, uint256 weight, bool addToQueue)
    external
    onlyDelegateCall;
```

### removeStrategy


```solidity
function removeStrategy(address strategy) external onlyDelegateCall;
```

### _addStrategy


```solidity
function _addStrategy(address strategy, uint256 weight, bool addToQueue) internal;
```

### _removeStrategy


```solidity
function _removeStrategy(address strategy) internal;
```

### forceRemoveStrategy


```solidity
function forceRemoveStrategy(address strategy) external onlyDelegateCall;
```

### reinstateImpairedStrategy


```solidity
function reinstateImpairedStrategy(address strategy, uint256 epochId) external onlyDelegateCall;
```

### __ejectDisabledStrategy

Best-effort unwind + list/queue removal for valuation-disabled strategies (core module only).


```solidity
function __ejectDisabledStrategy(address strategy) external onlyDelegateCall;
```

### _ejectStrategyFromList


```solidity
function _ejectStrategyFromList(address strategy) internal;
```

### _isStrategyListed


```solidity
function _isStrategyListed(address strategy) internal view returns (bool);
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

### _tryWithdrawFromStrategyMeasured

FIX: M-09 — best-effort withdraw used on the user-facing withdrawal hot path.
A hostile or temporarily-illiquid strategy must not be able to freeze vault
withdrawals. On revert or measured/reported mismatch we emit
`StrategyWithdrawFailed` and fall through with 0/received — the caller
(`_withdrawFromStrategies`) continues to the next strategy in the queue, and
the vault's core module still reverts with `InsufficientBalance` if the
aggregate shortfall can't be met. Strict accounting remains on
`_withdrawFromStrategyMeasured` for admin flows (`removeStrategy`).
FIX: M-09 Codex review (PR #357) — negative balance deltas (strategy
DECREASED the vault's balance, e.g. via leftover allowance) must be
treated as a failed leg instead of subtracted blindly. Prior version
underflowed on `afterBalRevert - beforeBal` and re-bricked the user's
withdraw, defeating the entire M-09 best-effort fix. Both the revert
path and the success-with-lying-report path now guard this.


```solidity
function _tryWithdrawFromStrategyMeasured(address strategy, uint256 amount) internal returns (uint256 withdrawn);
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

### rebalanceStrategies

Pull overweight strategy TVL back to idle, then redeploy by weight.

Cross-strategy moves always route vault idle — strategies never transfer directly.


```solidity
function rebalanceStrategies(uint256 minDeviationBps) external onlyDelegateCall;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`minDeviationBps`|`uint256`|Minimum overweight drift (bps of target) before withdrawing excess.|


### _deployUnderweightStrategies


```solidity
function _deployUnderweightStrategies(uint256 deployableBase, uint256 minIdle)
    internal
    returns (uint256 totalDeposited);
```

### _sumActiveStrategyAssets


```solidity
function _sumActiveStrategyAssets(uint256 idleBalance) internal view returns (uint256 total);
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

### _findLatestEpochForStrategy


```solidity
function _findLatestEpochForStrategy(address strategy) internal view returns (uint256 epochId);
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

### StrategiesRebalanced

```solidity
event StrategiesRebalanced(uint256 totalWithdrawn, uint256 totalRedeployed);
```

### ImpairedStrategyReinstated

```solidity
event ImpairedStrategyReinstated(address indexed strategy, uint256 indexed epochId);
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

### VaultNotNormal

```solidity
error VaultNotNormal();
```

### TransferAmountMismatch

```solidity
error TransferAmountMismatch(uint256 expected, uint256 actual);
```

### StrategyWithdrawShortfall

```solidity
error StrategyWithdrawShortfall(uint256 expected, uint256 actual);
```

