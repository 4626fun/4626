# CreatorOVaultAdminModule
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/vault/modules/CreatorOVaultAdminModule.sol)

**Inherits:**
[CreatorOVaultModuleBase](/contracts/vault/modules/CreatorOVaultModuleBase.sol/abstract.CreatorOVaultModuleBase.md)

Admin + emergency + rescue + config logic for CreatorOVault.

Must be invoked via delegatecall from CreatorOVault.


## State Variables
### MAX_FEE

```solidity
uint16 internal constant MAX_FEE = 2_000
```


### SECONDS_PER_YEAR

```solidity
uint256 internal constant SECONDS_PER_YEAR = 365 days
```


### MIN_RESCUE_DELAY

```solidity
uint64 internal constant MIN_RESCUE_DELAY = 1 days
```


### MAX_RESCUE_DELAY

```solidity
uint64 internal constant MAX_RESCUE_DELAY = 30 days
```


## Functions
### shutdownVault


```solidity
function shutdownVault() external onlyDelegateCall;
```

### emergencyWithdrawFromStrategies


```solidity
function emergencyWithdrawFromStrategies() external onlyDelegateCall;
```

### emergencyWithdraw


```solidity
function emergencyWithdraw(uint256 amount, address to) external onlyDelegateCall;
```

### setPaused


```solidity
function setPaused(bool _paused) external onlyDelegateCall;
```

### setGaugeController


```solidity
function setGaugeController(address _gaugeController) external onlyDelegateCall;
```

### setBurnStream


```solidity
function setBurnStream(address _burnStream) external onlyDelegateCall;
```

### setKeeper


```solidity
function setKeeper(address _keeper) external onlyDelegateCall;
```

### setEmergencyAdmin


```solidity
function setEmergencyAdmin(address _emergencyAdmin) external onlyDelegateCall;
```

### setWhitelistEnabled


```solidity
function setWhitelistEnabled(bool _enabled) external onlyDelegateCall;
```

### setWhitelist


```solidity
function setWhitelist(address _account, bool _status) external onlyDelegateCall;
```

### setWhitelistBatch


```solidity
function setWhitelistBatch(address[] calldata _accounts, bool _status) external onlyDelegateCall;
```

### setProtocolRescue


```solidity
function setProtocolRescue(address rescue) external onlyDelegateCall;
```

### setRescueDelay


```solidity
function setRescueDelay(uint64 delay) external onlyDelegateCall;
```

### initiateOwnershipRescue


```solidity
function initiateOwnershipRescue(address newOwner) external onlyDelegateCall;
```

### cancelOwnershipRescue


```solidity
function cancelOwnershipRescue() external onlyDelegateCall;
```

### finalizeOwnershipRescue


```solidity
function finalizeOwnershipRescue() external onlyDelegateCall;
```

### setPerformanceFee


```solidity
function setPerformanceFee(uint16 _performanceFee) external onlyDelegateCall;
```

### setPerformanceFeeRecipient


```solidity
function setPerformanceFeeRecipient(address _performanceFeeRecipient) external onlyDelegateCall;
```

### setProfitMaxUnlockTime


```solidity
function setProfitMaxUnlockTime(uint256 _profitMaxUnlockTime) external onlyDelegateCall;
```

### setPendingManagement


```solidity
function setPendingManagement(address _management) external onlyDelegateCall;
```

### acceptManagement


```solidity
function acceptManagement() external onlyDelegateCall;
```

### setDeploymentParams


```solidity
function setDeploymentParams(uint256 _threshold, uint256 _interval) external onlyDelegateCall;
```

### setMaxTotalSupply


```solidity
function setMaxTotalSupply(uint256 _maxTotalSupply) external onlyDelegateCall;
```

### setFlashLoanProtection


```solidity
function setFlashLoanProtection(
    uint256 _withdrawDelayBlocks,
    uint256 _largeWithdrawalThreshold,
    uint256 _largeWithdrawalDelayBlocks
) external onlyDelegateCall;
```

### syncBalances


```solidity
function syncBalances() external onlyDelegateCall;
```

### rescueETH


```solidity
function rescueETH() external onlyDelegateCall;
```

### rescueToken


```solidity
function rescueToken(address token, uint256 amount, address to) external onlyDelegateCall;
```

## Events
### UpdateManagement

```solidity
event UpdateManagement(address indexed newManagement);
```

### UpdatePendingManagement

```solidity
event UpdatePendingManagement(address indexed newPendingManagement);
```

### UpdateKeeper

```solidity
event UpdateKeeper(address indexed newKeeper);
```

### UpdateEmergencyAdmin

```solidity
event UpdateEmergencyAdmin(address indexed newEmergencyAdmin);
```

### UpdateGaugeController

```solidity
event UpdateGaugeController(address indexed oldController, address indexed newController);
```

### UpdatePerformanceFee

```solidity
event UpdatePerformanceFee(uint16 newPerformanceFee);
```

### UpdatePerformanceFeeRecipient

```solidity
event UpdatePerformanceFeeRecipient(address indexed newRecipient);
```

### UpdateProfitMaxUnlockTime

```solidity
event UpdateProfitMaxUnlockTime(uint256 newProfitMaxUnlockTime);
```

### BalancesSynced

```solidity
event BalancesSynced(uint256 coinBalance);
```

### WhitelistEnabled

```solidity
event WhitelistEnabled(bool enabled);
```

### WhitelistUpdated

```solidity
event WhitelistUpdated(address indexed account, bool status);
```

### EmergencyPause

```solidity
event EmergencyPause(bool paused);
```

### VaultShutdown

```solidity
event VaultShutdown();
```

### EmergencyWithdraw

```solidity
event EmergencyWithdraw(address indexed to, uint256 amount);
```

### RescueConfigured

```solidity
event RescueConfigured(address indexed rescue, uint64 delay);
```

### RescueInitiated

```solidity
event RescueInitiated(address indexed oldOwner, address indexed newOwner, uint64 unlockTime);
```

### RescueCancelled

```solidity
event RescueCancelled(address indexed oldOwner);
```

### RescueFinalized

```solidity
event RescueFinalized(address indexed oldOwner, address indexed newOwner);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### Unauthorized

```solidity
error Unauthorized();
```

### InvalidAmount

```solidity
error InvalidAmount();
```

### VaultNotShutdown

```solidity
error VaultNotShutdown();
```

### RescueNotConfigured

```solidity
error RescueNotConfigured();
```

### RescueDelayOutOfBounds

```solidity
error RescueDelayOutOfBounds(uint64 provided, uint64 min, uint64 max);
```

### RescueAlreadyPending

```solidity
error RescueAlreadyPending(address pendingOwner);
```

### RescueNotPending

```solidity
error RescueNotPending();
```

### RescueTooEarly

```solidity
error RescueTooEarly(uint64 unlockTime);
```

### InvalidRescueOwner

```solidity
error InvalidRescueOwner(address newOwner);
```

### MaxTotalSupplyBelowCurrent

```solidity
error MaxTotalSupplyBelowCurrent(uint256 provided, uint256 current);
```

### TooManyBlocks

```solidity
error TooManyBlocks(uint256 provided, uint256 max);
```

### CannotRescueCreatorCoin

```solidity
error CannotRescueCreatorCoin();
```

### ETHTransferFailed

```solidity
error ETHTransferFailed();
```

