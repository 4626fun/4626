# CreatorOVaultCoreModule
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/modules/CreatorOVaultCoreModule.sol)

**Inherits:**
[CreatorOVaultModuleBase](/contracts/vault/modules/CreatorOVaultModuleBase.sol/abstract.CreatorOVaultModuleBase.md), [ICreatorOVaultModuleIdentity](/contracts/vault/modules/ICreatorOVaultModuleIdentity.sol/interface.ICreatorOVaultModuleIdentity.md)

Core ERC-4626 + queue + profit unlocking + reporting logic for CreatorOVault.

Must be invoked via delegatecall from CreatorOVault.


## State Variables
### MODULE_KIND

```solidity
bytes32 internal constant MODULE_KIND = keccak256("CreatorOVaultModule.core")
```


### MODULE_STORAGE_VERSION

```solidity
bytes32 internal constant MODULE_STORAGE_VERSION = keccak256("CreatorOVaultModuleStorage.v1")
```


### MAX_FEE

```solidity
uint16 internal constant MAX_FEE = 2_000
```


### MAX_BPS

```solidity
uint256 internal constant MAX_BPS = 10_000
```


### MAX_BPS_EXTENDED

```solidity
uint256 internal constant MAX_BPS_EXTENDED = 1_000_000_000_000
```


### MAX_PRICE_CHANGE_BPS

```solidity
uint256 internal constant MAX_PRICE_CHANGE_BPS = 1000
```


### MINIMUM_FIRST_DEPOSIT

```solidity
uint256 internal constant MINIMUM_FIRST_DEPOSIT = 50_000_000e18
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

### unlockedShares


```solidity
function unlockedShares() external view onlyDelegateCall returns (uint256);
```

### lockedShares


```solidity
function lockedShares() external view onlyDelegateCall returns (uint256);
```

### _availableProfitShares


```solidity
function _availableProfitShares() internal view returns (uint256 available);
```

### _processProfitUnlock


```solidity
function _processProfitUnlock() internal;
```

### totalAssets


```solidity
function totalAssets() public view onlyDelegateCall returns (uint256);
```

### _getStrategyAssetsSafe


```solidity
function _getStrategyAssetsSafe(address strategy) internal view returns (uint256 assets);
```

### _firstStrategyValuationNotReady


```solidity
function _firstStrategyValuationNotReady() internal view returns (address bad);
```

### _requireStrategyValuationsReady


```solidity
function _requireStrategyValuationsReady() internal view;
```

### deposit


```solidity
function deposit(uint256 assets, address receiver) external onlyDelegateCall returns (uint256 shares);
```

### mint


```solidity
function mint(uint256 shares, address receiver) external onlyDelegateCall returns (uint256 assets);
```

### redeem


```solidity
function redeem(uint256 shares, address receiver, address owner_)
    external
    onlyDelegateCall
    returns (uint256 assets);
```

### withdraw


```solidity
function withdraw(uint256 assets, address receiver, address owner_)
    external
    onlyDelegateCall
    returns (uint256 shares);
```

### queueWithdrawal


```solidity
function queueWithdrawal(uint256 shares, address receiver) external onlyDelegateCall;
```

### claimQueuedWithdrawal


```solidity
function claimQueuedWithdrawal() external onlyDelegateCall returns (uint256 assets);
```

### cancelQueuedWithdrawal


```solidity
function cancelQueuedWithdrawal() external onlyDelegateCall returns (uint256 shares);
```

### maxDeposit


```solidity
function maxDeposit(address receiver) external view onlyDelegateCall returns (uint256);
```

### maxMint


```solidity
function maxMint(address receiver) external view onlyDelegateCall returns (uint256);
```

### maxWithdraw


```solidity
function maxWithdraw(address owner_) external view onlyDelegateCall returns (uint256);
```

### maxRedeem


```solidity
function maxRedeem(address owner_) external view onlyDelegateCall returns (uint256);
```

### _syncCoinBalance


```solidity
function _syncCoinBalance() internal returns (uint256 actual);
```

### _pullCreatorCoinExact


```solidity
function _pullCreatorCoinExact(address from, uint256 amount) internal;
```

### _pushCreatorCoinExact


```solidity
function _pushCreatorCoinExact(address to, uint256 amount) internal;
```

### _ensureCoin


```solidity
function _ensureCoin(uint256 coinNeeded) internal;
```

### _withdrawFromStrategies


```solidity
function _withdrawFromStrategies(uint256 amountNeeded) internal;
```

### _autoAllocateToStrategy


```solidity
function _autoAllocateToStrategy() internal;
```

### _checkPriceChange


```solidity
function _checkPriceChange(uint256 priceBefore, uint256 priceAfter) internal pure;
```

### _checkTrustedPpsDeviation


```solidity
function _checkTrustedPpsDeviation(uint256 currentPps) internal view;
```

### pricePerShare


```solidity
function pricePerShare() public view onlyDelegateCall returns (uint256);
```

### report


```solidity
function report() external onlyDelegateCall returns (uint256 profit, uint256 loss);
```

### _increaseReportBaselineForPrincipalInflow


```solidity
function _increaseReportBaselineForPrincipalInflow(uint256 assetsIn) internal;
```

### _decreaseReportBaselineForPrincipalOutflow


```solidity
function _decreaseReportBaselineForPrincipalOutflow(uint256 assetsOut) internal;
```

### burnSharesForPriceIncrease


```solidity
function burnSharesForPriceIncrease(uint256 shares) external onlyDelegateCall;
```

### injectCapital


```solidity
function injectCapital(uint256 amount) external onlyDelegateCall;
```

### _revertBytes


```solidity
function _revertBytes(bytes memory ret) internal pure;
```

## Events
### Deposit

```solidity
event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
```

### Withdraw

```solidity
event Withdraw(
    address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
);
```

### Reported

```solidity
event Reported(uint256 profit, uint256 loss, uint256 performanceFees, uint256 totalAssets);
```

### CapitalInjected

```solidity
event CapitalInjected(address indexed from, uint256 amount, uint256 newPricePerShare);
```

### SharesBurnedForPrice

```solidity
event SharesBurnedForPrice(address indexed from, uint256 shares, uint256 newPricePerShare);
```

### WithdrawalQueued

```solidity
event WithdrawalQueued(address indexed user, uint256 shares, uint256 unlockBlock);
```

### WithdrawalClaimed

```solidity
event WithdrawalClaimed(address indexed user, uint256 assets);
```

### WithdrawalCancelled

```solidity
event WithdrawalCancelled(address indexed user, uint256 shares);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### ZeroAmount

```solidity
error ZeroAmount();
```

### ZeroShares

```solidity
error ZeroShares();
```

### InvalidAmount

```solidity
error InvalidAmount();
```

### Unauthorized

```solidity
error Unauthorized();
```

### InsufficientBalance

```solidity
error InsufficientBalance();
```

### Paused

```solidity
error Paused();
```

### VaultIsShutdown

```solidity
error VaultIsShutdown();
```

### FirstDepositTooSmall

```solidity
error FirstDepositTooSmall(uint256 provided, uint256 minimum);
```

### PriceChangeExceedsLimit

```solidity
error PriceChangeExceedsLimit(uint256 priceBefore, uint256 priceAfter, uint256 maxChangeBps);
```

### TrustedPpsDeviationExceeded

```solidity
error TrustedPpsDeviationExceeded(uint256 checkpointPps, uint256 currentPps, uint256 maxDeviationBps);
```

### InflationAttackDetected

```solidity
error InflationAttackDetected(uint256 assets, uint256 shares);
```

### WithdrawTooSoon

```solidity
error WithdrawTooSoon(uint256 currentBlock, uint256 requiredBlock);
```

### TransferTooSoon

```solidity
error TransferTooSoon(uint256 currentBlock, uint256 requiredBlock);
```

### LargeWithdrawalMustBeQueued

```solidity
error LargeWithdrawalMustBeQueued(uint256 amount, uint256 threshold);
```

### WithdrawalNotUnlocked

```solidity
error WithdrawalNotUnlocked(uint256 currentBlock, uint256 unlockBlock);
```

### NoQueuedWithdrawal

```solidity
error NoQueuedWithdrawal();
```

### QueuedWithdrawalReceiverMismatch

```solidity
error QueuedWithdrawalReceiverMismatch(address existing, address provided);
```

### StrategyValuationNotReady

```solidity
error StrategyValuationNotReady(address strategy);
```

### TransferAmountMismatch

```solidity
error TransferAmountMismatch(uint256 expected, uint256 actual);
```

### ModulesNotSet

```solidity
error ModulesNotSet();
```

### OnlyGaugeController

```solidity
error OnlyGaugeController();
```

