# CreatorOVaultModuleStorage
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/modules/CreatorOVaultModuleStorage.sol)

Storage layout shared by CreatorOVault delegatecall modules.

MUST match CreatorOVault's storage layout exactly (including OZ bases).
FIX: I-02 — Layout integrity is verified at deploy time via `setModulesOnce()` which checks
`moduleStorageVersion()`. Upgrades MUST bump MODULE_STORAGE_VERSION if layout changes.
Storage-hardening roadmap: `docs/research/ovault-storage-namespacing-rfc.md`.


## State Variables
### _balances

```solidity
mapping(address => uint256) internal _balances
```


### _allowances

```solidity
mapping(address => mapping(address => uint256)) internal _allowances
```


### _totalSupply

```solidity
uint256 internal _totalSupply
```


### _name

```solidity
string internal _name
```


### _symbol

```solidity
string internal _symbol
```


### _owner

```solidity
address internal _owner
```


### _status

```solidity
uint256 internal _status
```


### _nameFallback

```solidity
string internal _nameFallback
```


### _versionFallback

```solidity
string internal _versionFallback
```


### coinBalance

```solidity
uint256 internal coinBalance
```


### activeStrategies

```solidity
mapping(address => bool) internal activeStrategies
```


### strategyWeights

```solidity
mapping(address => uint256) internal strategyWeights
```


### strategyList

```solidity
address[] internal strategyList
```


### totalStrategyWeight

```solidity
uint256 internal totalStrategyWeight
```


### management

```solidity
address internal management
```


### pendingManagement

```solidity
address internal pendingManagement
```


### keeper

```solidity
address internal keeper
```


### emergencyAdmin

```solidity
address internal emergencyAdmin
```


### gaugeController

```solidity
address internal gaugeController
```


### burnStream

```solidity
address internal burnStream
```


### performanceFee

```solidity
uint16 internal performanceFee
```


### performanceFeeRecipient

```solidity
address internal performanceFeeRecipient
```


### profitUnlockingRate

```solidity
uint256 internal profitUnlockingRate
```


### fullProfitUnlockDate

```solidity
uint96 internal fullProfitUnlockDate
```


### profitMaxUnlockTime

```solidity
uint32 internal profitMaxUnlockTime
```


### totalLockedShares

```solidity
uint256 internal totalLockedShares
```


### totalQueuedWithdrawalShares

```solidity
uint256 internal totalQueuedWithdrawalShares
```


### lastProfitUnlockUpdate

```solidity
uint96 internal lastProfitUnlockUpdate
```


### lastReport

```solidity
uint96 internal lastReport
```


### totalAssetsAtLastReport

```solidity
uint256 internal totalAssetsAtLastReport
```


### trustedPpsCheckpoint

```solidity
uint256 internal trustedPpsCheckpoint
```


### trustedPpsMaxDeviationBps

```solidity
uint256 internal trustedPpsMaxDeviationBps
```


### totalSharesBurned

```solidity
uint256 internal totalSharesBurned
```


### isShutdown

```solidity
bool internal isShutdown
```


### paused

```solidity
bool internal paused
```


### whitelistEnabled

```solidity
bool internal whitelistEnabled
```


### whitelist

```solidity
mapping(address => bool) internal whitelist
```


### operatorEpoch

```solidity
uint256 internal operatorEpoch
```


### _operatorPerms

```solidity
mapping(uint256 => mapping(address => uint256)) internal _operatorPerms
```


### operatorNonce

```solidity
uint256 internal operatorNonce
```


### protocolRescue

```solidity
address internal protocolRescue
```


### rescueDelay

```solidity
uint64 internal rescueDelay
```


### pendingRescueOwner

```solidity
address internal pendingRescueOwner
```


### rescueUnlockTime

```solidity
uint64 internal rescueUnlockTime
```


### maxTotalSupply

```solidity
uint256 internal maxTotalSupply
```


### deploymentThreshold

```solidity
uint256 internal deploymentThreshold
```


### minDeploymentInterval

```solidity
uint256 internal minDeploymentInterval
```


### lastDeployment

```solidity
uint256 internal lastDeployment
```


### lastDepositBlock

```solidity
mapping(address => uint256) internal lastDepositBlock
```


### withdrawDelayBlocks

```solidity
uint256 internal withdrawDelayBlocks
```


### largeWithdrawalThreshold

```solidity
uint256 internal largeWithdrawalThreshold
```


### largeWithdrawalDelayBlocks

```solidity
uint256 internal largeWithdrawalDelayBlocks
```


### queuedWithdrawals

```solidity
mapping(address => QueuedWithdrawal) internal queuedWithdrawals
```


### defaultQueue

```solidity
address[] internal defaultQueue
```


### useDefaultQueue

```solidity
bool internal useDefaultQueue
```


### autoAllocate

```solidity
bool internal autoAllocate
```


### minimumTotalIdle

```solidity
uint256 internal minimumTotalIdle
```


### strategyDebt

```solidity
mapping(address => uint256) internal strategyDebt
```


### totalDebt

```solidity
uint256 internal totalDebt
```


### debtPurchaser

```solidity
address internal debtPurchaser
```


### _coreModule

```solidity
address internal _coreModule
```


### _strategiesModule

```solidity
address internal _strategiesModule
```


### _adminModule

```solidity
address internal _adminModule
```


### strategyMaxAssets

```solidity
mapping(address => uint256) internal strategyMaxAssets
```


### managementFee

```solidity
uint16 internal managementFee
```


### managementFeeRecipient

```solidity
address internal managementFeeRecipient
```


### riskConfigDelay
Delay before scheduled risk changes execute. 0 = instant (legacy behavior).


```solidity
uint64 internal riskConfigDelay
```


### pendingRiskKind
Single-flight pending risk update (Morpho-style governance latency).


```solidity
uint8 internal pendingRiskKind
```


### pendingRiskTarget

```solidity
address internal pendingRiskTarget
```


### pendingRiskValue

```solidity
uint256 internal pendingRiskValue
```


### pendingRiskUnlockTime

```solidity
uint64 internal pendingRiskUnlockTime
```


### valuationMissThreshold
Consecutive unhealthy valuation reports before auto-disable. 0 = disabled.


```solidity
uint8 internal valuationMissThreshold
```


### strategyValuationMisses

```solidity
mapping(address => uint8) internal strategyValuationMisses
```


### sharePermitNonces

```solidity
mapping(address => uint256) internal sharePermitNonces
```


### vaultMode

```solidity
VaultMode internal vaultMode
```


### activeImpairmentEpoch

```solidity
uint256 internal activeImpairmentEpoch
```


### nextImpairmentEpochId

```solidity
uint256 internal nextImpairmentEpochId
```


### impairmentChallengeWindow

```solidity
uint64 internal impairmentChallengeWindow
```


### impairmentEpochs

```solidity
mapping(uint256 => ImpairmentEpoch) internal impairmentEpochs
```


### strategyImpaired

```solidity
mapping(address => bool) internal strategyImpaired
```


### impairmentAmountClaimed

```solidity
mapping(uint256 => mapping(address => uint256)) internal impairmentAmountClaimed
```


### impairmentClaimMinted

```solidity
mapping(uint256 => mapping(address => bool)) internal impairmentClaimMinted
```


### impairmentRootUnlockTime

```solidity
mapping(uint256 => uint64) internal impairmentRootUnlockTime
```


### impairmentRootChallenged

```solidity
mapping(uint256 => bool) internal impairmentRootChallenged
```


### impairmentGuardian

```solidity
address internal impairmentGuardian
```


### impairmentClaims

```solidity
address internal impairmentClaims
```


### impairmentRecoveryEscrow

```solidity
address internal impairmentRecoveryEscrow
```


### ccaLaunchStrategy
Optional CCA launch strategy used to enforce auction-time deposit pauses.


```solidity
address internal ccaLaunchStrategy
```


## Structs
### ImpairmentEpoch

```solidity
struct ImpairmentEpoch {
    ImpairmentEpochStatus status;
    address strategy;
    address recoveryAsset;
    uint256 reasonCode;
    uint256 tripBlock;
    uint64 trippedAt;
    uint64 finalizedAt;
    uint64 resolvedAt;
    uint256 totalSharesAtTrip;
    uint256 totalClaimSupply;
    uint256 excludedBookValue;
    bytes32 snapshotRoot;
    uint256 totalRecovered;
    uint256 totalClaimed;
}
```

### QueuedWithdrawal

```solidity
struct QueuedWithdrawal {
    uint256 shares;
    uint256 unlockBlock;
    address receiver;
}
```

## Enums
### VaultMode

```solidity
enum VaultMode {
    Normal,
    Suspect
}
```

### ImpairmentEpochStatus

```solidity
enum ImpairmentEpochStatus {
    None,
    Tripped,
    Finalized,
    Resolved
}
```

