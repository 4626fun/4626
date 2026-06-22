# CreatorOVaultCoreModule
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/modules/CreatorOVaultCoreModule.sol)

**Inherits:**
[CreatorOVaultModuleBase](/contracts/vault/modules/CreatorOVaultModuleBase.sol/abstract.CreatorOVaultModuleBase.md), [ICreatorOVaultModuleIdentity](/contracts/vault/modules/ICreatorOVaultModuleIdentity.sol/interface.ICreatorOVaultModuleIdentity.md)

Core ERC-4626 + queue + profit unlocking + reporting logic for CreatorOVault.

Must be invoked via delegatecall from CreatorOVault.


## Constants
### MODULE_KIND

```solidity
bytes32 internal constant MODULE_KIND = keccak256("CreatorOVaultModule.core")
```


### MODULE_STORAGE_VERSION

```solidity
bytes32 internal constant MODULE_STORAGE_VERSION = keccak256("CreatorOVaultModuleStorage.v3")
```


### MAX_FEE

```solidity
uint16 internal constant MAX_FEE = 2_000
```


### MAX_BPS

```solidity
uint256 internal constant MAX_BPS = 10_000
```


### SECONDS_PER_YEAR

```solidity
uint256 internal constant SECONDS_PER_YEAR = 31_556_952
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


### MAX_VALUATION_MISS_THRESHOLD

```solidity
uint8 internal constant MAX_VALUATION_MISS_THRESHOLD = 30
```


### IMPAIR_REASON_MAX

```solidity
uint256 internal constant IMPAIR_REASON_MAX = 7
```


### CCA_PHASE_AUCTION_LIVE

```solidity
uint8 internal constant CCA_PHASE_AUCTION_LIVE = 1
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
function _firstStrategyValuationNotReady(bool allowMissGrace) internal view returns (address bad);
```

### _requireStrategyValuationsReady


```solidity
function _requireStrategyValuationsReady(bool allowMissGrace) internal view;
```

### _isCcaAuctionLive


```solidity
function _isCcaAuctionLive() internal view returns (bool);
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

### _accrueManagementFee


```solidity
function _accrueManagementFee(uint256 currentTotalAssets) internal;
```

### _processValuationHealth


```solidity
function _processValuationHealth() internal;
```

### _ejectDisabledStrategy


```solidity
function _ejectDisabledStrategy(address strategy) internal;
```

### _isValuationReady


```solidity
function _isValuationReady(address strategy) internal view returns (bool);
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

### setImpairmentChallengeWindow


```solidity
function setImpairmentChallengeWindow(uint64 window) external onlyDelegateCall;
```

### tripImpairment


```solidity
function tripImpairment(address strategy, uint256 reasonCode) external onlyDelegateCall returns (uint256 epochId);
```

### clearImpairmentTrip


```solidity
function clearImpairmentTrip(uint256 epochId) external onlyDelegateCall;
```

### proposeImpairmentRoot


```solidity
function proposeImpairmentRoot(
    uint256 epochId,
    bytes32 snapshotRoot,
    uint256 totalClaimSupply,
    address recoveryAsset
) external onlyDelegateCall;
```

### challengeImpairmentRoot


```solidity
function challengeImpairmentRoot(uint256 epochId, string calldata reason) external onlyDelegateCall;
```

### clearImpairmentRootAfterChallenge


```solidity
function clearImpairmentRootAfterChallenge(uint256 epochId) external onlyDelegateCall;
```

### finalizeImpairment


```solidity
function finalizeImpairment(uint256 epochId) external onlyDelegateCall;
```

### mintImpairmentClaim


```solidity
function mintImpairmentClaim(uint256 epochId, address account, uint256 amount, bytes32[] calldata proof)
    external
    onlyDelegateCall;
```

### notifyImpairmentRecovery


```solidity
function notifyImpairmentRecovery(uint256 epochId, uint256 amount) external onlyDelegateCall;
```

### claimImpairmentRecovery


```solidity
function claimImpairmentRecovery(
    uint256 epochId,
    address receiver,
    uint256 /*claimUnits*/
)
    external
    onlyDelegateCall
    returns (uint256 amountOut);
```

### _isStrategyListed


```solidity
function _isStrategyListed(address strategy) internal view returns (bool);
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

### ManagementFeeAccrued

```solidity
event ManagementFeeAccrued(uint256 feeAssets, uint256 feeShares, uint256 elapsedSeconds);
```

### StrategyValuationAutoDisabled

```solidity
event StrategyValuationAutoDisabled(address indexed strategy, uint8 consecutiveMisses);
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

### ImpairmentChallengeWindowUpdated

```solidity
event ImpairmentChallengeWindowUpdated(uint64 newWindow);
```

### ImpairmentTripped

```solidity
event ImpairmentTripped(
    uint256 indexed epochId,
    address indexed strategy,
    uint256 indexed reasonCode,
    uint256 tripBlock,
    uint256 totalSharesAtTrip
);
```

### ImpairmentTripCleared

```solidity
event ImpairmentTripCleared(uint256 indexed epochId, address indexed strategy);
```

### ImpairmentRootProposed

```solidity
event ImpairmentRootProposed(uint256 indexed epochId, bytes32 indexed root, uint64 unlockTime);
```

### ImpairmentRootChallenged

```solidity
event ImpairmentRootChallenged(uint256 indexed epochId, address indexed challenger, string reason);
```

### ImpairmentRootCleared

```solidity
event ImpairmentRootCleared(uint256 indexed epochId);
```

### ImpairmentRootFinalized

```solidity
event ImpairmentRootFinalized(uint256 indexed epochId, bytes32 indexed root, uint256 totalClaimSupply);
```

### ImpairmentFinalized

```solidity
event ImpairmentFinalized(
    uint256 indexed epochId, address indexed strategy, bytes32 indexed root, uint256 excludedBookValue
);
```

### ImpairmentRecoveryNotified

```solidity
event ImpairmentRecoveryNotified(uint256 indexed epochId, address indexed asset, uint256 amount);
```

### ImpairmentRecoveryClaimed

```solidity
event ImpairmentRecoveryClaimed(
    uint256 indexed epochId, address indexed account, address indexed receiver, uint256 amount
);
```

### ImpairmentResolved

```solidity
event ImpairmentResolved(uint256 indexed epochId);
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

### VaultNotNormal

```solidity
error VaultNotNormal();
```

### VaultNotSuspect

```solidity
error VaultNotSuspect();
```

### NoActiveImpairment

```solidity
error NoActiveImpairment();
```

### ImpairmentAlreadyActive

```solidity
error ImpairmentAlreadyActive(uint256 epochId);
```

### InvalidImpairmentEpoch

```solidity
error InvalidImpairmentEpoch(uint256 epochId);
```

### InvalidImpairmentTransition

```solidity
error InvalidImpairmentTransition(uint256 epochId);
```

### StrategyAlreadyImpaired

```solidity
error StrategyAlreadyImpaired(address strategy);
```

### StrategyNotImpaired

```solidity
error StrategyNotImpaired(address strategy);
```

### InvalidImpairmentReason

```solidity
error InvalidImpairmentReason(uint256 reasonCode);
```

### ImpairmentRootNotReady

```solidity
error ImpairmentRootNotReady(uint64 unlockTime);
```

### ImpairmentRootRequired

```solidity
error ImpairmentRootRequired(uint256 epochId);
```

### ImpairmentRootAlreadyFinalized

```solidity
error ImpairmentRootAlreadyFinalized(uint256 epochId);
```

### ImpairmentRootChallengedErr

```solidity
error ImpairmentRootChallengedErr(uint256 epochId);
```

### ChallengeWindowNotConfigured

```solidity
error ChallengeWindowNotConfigured();
```

### ClaimAlreadyMinted

```solidity
error ClaimAlreadyMinted(uint256 epochId, address account);
```

### InvalidClaimProof

```solidity
error InvalidClaimProof(uint256 epochId, address account);
```

### NothingToClaim

```solidity
error NothingToClaim(uint256 epochId, address account);
```

### RecoveryEscrowNotConfigured

```solidity
error RecoveryEscrowNotConfigured();
```

### ClaimSupplyExceeded

```solidity
error ClaimSupplyExceeded(uint256 epochId, uint256 totalClaimSupply, uint256 requested);
```

### CcaAuctionDepositBlocked

```solidity
error CcaAuctionDepositBlocked();
```

