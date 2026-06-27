# CreatorOVaultAdminModule
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/vault/modules/CreatorOVaultAdminModule.sol)

**Inherits:**
[CreatorOVaultModuleBase](/contracts/vault/modules/CreatorOVaultModuleBase.sol/abstract.CreatorOVaultModuleBase.md), [ICreatorOVaultModuleIdentity](/contracts/vault/modules/ICreatorOVaultModuleIdentity.sol/interface.ICreatorOVaultModuleIdentity.md)

Admin + emergency + rescue + config logic for CreatorOVault.

Must be invoked via delegatecall from CreatorOVault.


## Constants
### MODULE_KIND

```solidity
bytes32 internal constant MODULE_KIND = keccak256("CreatorOVaultModule.admin")
```


### MODULE_STORAGE_VERSION

```solidity
bytes32 internal constant MODULE_STORAGE_VERSION = keccak256("CreatorOVaultModuleStorage.v3")
```


### MAX_BPS

```solidity
uint256 internal constant MAX_BPS = 10_000
```


### MAX_FEE

```solidity
uint16 internal constant MAX_FEE = 2_000
```


### MAX_MANAGEMENT_FEE

```solidity
uint16 internal constant MAX_MANAGEMENT_FEE = 500
```


### SECONDS_PER_YEAR

```solidity
uint256 internal constant SECONDS_PER_YEAR = 365 days
```


### MIN_RISK_CONFIG_DELAY

```solidity
uint64 internal constant MIN_RISK_CONFIG_DELAY = 1 days
```


### MAX_RISK_CONFIG_DELAY

```solidity
uint64 internal constant MAX_RISK_CONFIG_DELAY = 30 days
```


### RISK_KIND_NONE

```solidity
uint8 internal constant RISK_KIND_NONE = 0
```


### RISK_KIND_PERFORMANCE_FEE

```solidity
uint8 internal constant RISK_KIND_PERFORMANCE_FEE = 1
```


### RISK_KIND_MANAGEMENT_FEE

```solidity
uint8 internal constant RISK_KIND_MANAGEMENT_FEE = 2
```


### RISK_KIND_STRATEGY_MAX_ASSETS

```solidity
uint8 internal constant RISK_KIND_STRATEGY_MAX_ASSETS = 3
```


### RISK_KIND_MANAGEMENT_FEE_RECIPIENT

```solidity
uint8 internal constant RISK_KIND_MANAGEMENT_FEE_RECIPIENT = 4
```


### MAX_VALUATION_MISS_THRESHOLD

```solidity
uint8 internal constant MAX_VALUATION_MISS_THRESHOLD = 30
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
### moduleKind


```solidity
function moduleKind() external pure returns (bytes32);
```

### moduleStorageVersion


```solidity
function moduleStorageVersion() external pure returns (bytes32);
```

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

### setCCALaunchStrategy

Link/unlink the vault's CCA strategy used for auction-time deposit gating.

Zero address clears the gate linkage.


```solidity
function setCCALaunchStrategy(address _ccaLaunchStrategy) external onlyDelegateCall;
```

### setBurnStream

Update the vault's burn stream address.

FIX: L-01 (4626-349) — previously one-time-set. Once the initial
non-zero burn stream was wired, any future override required a
full vault migration. If the Charm/gauge infra upgrades the
burn stream contract, this is operationally expensive.
Override now permitted via the same onlyDelegateCall gate that
governs every other admin setter in this module. The call still
runs through the vault's management/multisig path (see
CreatorOVaultRescueModule / `onlyDelegateCall` construction), so
unilateral overrides from an EOA are not possible. A governance
timelock should enforce the delay at that layer; we deliberately
do NOT add a second timelock here so the setter shape matches
every other `set*` in this module.
Emits UpdateBurnStream(oldBurnStream, newBurnStream).


```solidity
function setBurnStream(address _burnStream) external onlyDelegateCall;
```

### setBurnStreamAuthorizedQueuer

Authorize or revoke a burn-stream share queuer (for example PayoutRouter).

Only the vault may call `VaultShareBurnStream.setAuthorizedQueuer`; this bridges owner intent.


```solidity
function setBurnStreamAuthorizedQueuer(address queuer, bool authorized) external onlyDelegateCall;
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

### scheduleSetPerformanceFee


```solidity
function scheduleSetPerformanceFee(uint16 _performanceFee) external onlyDelegateCall;
```

### scheduleSetManagementFee


```solidity
function scheduleSetManagementFee(uint16 _managementFee) external onlyDelegateCall;
```

### scheduleSetStrategyMaxAssets


```solidity
function scheduleSetStrategyMaxAssets(address strategy, uint256 cap) external onlyDelegateCall;
```

### scheduleSetManagementFeeRecipient


```solidity
function scheduleSetManagementFeeRecipient(address recipient) external onlyDelegateCall;
```

### setManagementFeeRecipient


```solidity
function setManagementFeeRecipient(address recipient) external onlyDelegateCall;
```

### executePendingRiskConfig


```solidity
function executePendingRiskConfig() external onlyDelegateCall;
```

### cancelPendingRiskConfig


```solidity
function cancelPendingRiskConfig() external onlyDelegateCall;
```

### setRiskConfigDelay


```solidity
function setRiskConfigDelay(uint64 delay) external onlyDelegateCall;
```

### setValuationMissThreshold


```solidity
function setValuationMissThreshold(uint8 threshold) external onlyDelegateCall;
```

### setImpairmentGuardian


```solidity
function setImpairmentGuardian(address guardian) external onlyDelegateCall;
```

### setImpairmentClaims


```solidity
function setImpairmentClaims(address claims) external onlyDelegateCall;
```

### setImpairmentRecoveryEscrow


```solidity
function setImpairmentRecoveryEscrow(address escrow) external onlyDelegateCall;
```

### _scheduleRiskChange


```solidity
function _scheduleRiskChange(uint8 kind, address target, uint256 value) internal;
```

### _executeRiskChange


```solidity
function _executeRiskChange(uint8 kind, address target, uint256 value) internal;
```

### setPerformanceFeeRecipient


```solidity
function setPerformanceFeeRecipient(address _performanceFeeRecipient) external onlyDelegateCall;
```

### setProfitMaxUnlockTime


```solidity
function setProfitMaxUnlockTime(uint256 _profitMaxUnlockTime) external onlyDelegateCall;
```

### setTrustedPpsDeviationBps


```solidity
function setTrustedPpsDeviationBps(uint256 _trustedPpsMaxDeviationBps) external onlyDelegateCall;
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

### setStrategyMaxAssets

Set the governance-enforced asset cap for a strategy.

Pass 0 to disable the cap (uncapped). The cap clamps the strategy's
contribution to `totalAssets()` so misreporting cannot inflate share price.


```solidity
function setStrategyMaxAssets(address strategy, uint256 cap) external onlyDelegateCall;
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

### UpdateCcaLaunchStrategy

```solidity
event UpdateCcaLaunchStrategy(address indexed oldStrategy, address indexed newStrategy);
```

### UpdateBurnStream

```solidity
event UpdateBurnStream(address indexed oldBurnStream, address indexed newBurnStream);
```

### BurnStreamQueuerUpdated

```solidity
event BurnStreamQueuerUpdated(address indexed queuer, bool authorized);
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

### UpdateTrustedPpsDeviationBps

```solidity
event UpdateTrustedPpsDeviationBps(uint256 newTrustedPpsDeviationBps);
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

### RescueDisabled

```solidity
event RescueDisabled();
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

### UpdateStrategyMaxAssets

```solidity
event UpdateStrategyMaxAssets(address indexed strategy, uint256 oldCap, uint256 newCap);
```

### UpdateManagementFee

```solidity
event UpdateManagementFee(uint16 newManagementFee);
```

### UpdateManagementFeeRecipient

```solidity
event UpdateManagementFeeRecipient(address indexed newRecipient);
```

### UpdateRiskConfigDelay

```solidity
event UpdateRiskConfigDelay(uint64 newDelay);
```

### RiskConfigScheduled

```solidity
event RiskConfigScheduled(uint8 kind, address indexed target, uint256 value, uint64 unlockTime);
```

### RiskConfigExecuted

```solidity
event RiskConfigExecuted(uint8 kind, address indexed target, uint256 value);
```

### RiskConfigCancelled

```solidity
event RiskConfigCancelled(uint8 kind);
```

### UpdateValuationMissThreshold

```solidity
event UpdateValuationMissThreshold(uint8 newThreshold);
```

### ImpairmentGuardianUpdated

```solidity
event ImpairmentGuardianUpdated(address indexed guardian);
```

### ImpairmentClaimsUpdated

```solidity
event ImpairmentClaimsUpdated(address indexed claims);
```

### ImpairmentRecoveryEscrowUpdated

```solidity
event ImpairmentRecoveryEscrowUpdated(address indexed escrow);
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

### RiskConfigDelayOutOfBounds

```solidity
error RiskConfigDelayOutOfBounds(uint64 provided, uint64 min, uint64 max);
```

### PendingRiskConfigExists

```solidity
error PendingRiskConfigExists(uint8 kind);
```

### NoPendingRiskConfig

```solidity
error NoPendingRiskConfig();
```

### RiskConfigTooEarly

```solidity
error RiskConfigTooEarly(uint64 unlockTime);
```

### InvalidRiskConfigKind

```solidity
error InvalidRiskConfigKind(uint8 kind);
```

### InvalidImpairmentConfig

```solidity
error InvalidImpairmentConfig(address provided);
```

