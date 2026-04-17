# CreatorOVaultModuleStorage
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/modules/CreatorOVaultModuleStorage.sol)

Storage layout shared by CreatorOVault delegatecall modules.

MUST match CreatorOVault's storage layout exactly (including OZ bases).
FIX: I-02 — Layout integrity is verified at deploy time via `setModulesOnce()` which checks
`moduleStorageVersion()`. Upgrades MUST bump MODULE_STORAGE_VERSION if layout changes.
Consider adopting ERC-7201 namespaced storage for structural collision immunity.


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


## Structs
### QueuedWithdrawal

```solidity
struct QueuedWithdrawal {
    uint256 shares;
    uint256 unlockBlock;
    address receiver;
}
```

