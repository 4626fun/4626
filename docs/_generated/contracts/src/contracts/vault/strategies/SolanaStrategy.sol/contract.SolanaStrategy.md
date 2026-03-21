# SolanaStrategy
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/vault/strategies/SolanaStrategy.sol)

**Inherits:**
[IStrategy](/contracts/interfaces/IStrategy.sol/interface.IStrategy.md), [IStrategyValuation](/contracts/interfaces/IStrategyValuation.sol/interface.IStrategyValuation.md), Ownable, ReentrancyGuard

**Title:**
SolanaStrategy

IStrategy + IStrategyValuation for Solana exposure under CreatorOVault accounting.

Combines Base liquid balance with keeper-reported remote NAV; enforces freshness and delta guardrails.


## State Variables
### vault

```solidity
address public immutable vault
```


### CREATOR

```solidity
IERC20 public immutable CREATOR
```


### remoteNav

```solidity
uint256 public remoteNav
```


### remoteNavUpdatedAt

```solidity
uint64 public remoteNavUpdatedAt
```


### maxNavAge

```solidity
uint64 public maxNavAge
```


### maxNavDeltaBpsPerUpdate

```solidity
uint16 public maxNavDeltaBpsPerUpdate
```


### minBaseLiquidityBps

```solidity
uint16 public minBaseLiquidityBps
```


### bridgeAddress

```solidity
address public bridgeAddress
```


### totalReconciledFromSolana

```solidity
uint256 public totalReconciledFromSolana
```


### remoteNavEnabled

```solidity
bool public remoteNavEnabled
```


### _emergencyPaused

```solidity
bool private _emergencyPaused
```


### keepers

```solidity
mapping(address => bool) public keepers
```


## Functions
### onlyVault


```solidity
modifier onlyVault() ;
```

### onlyKeeper


```solidity
modifier onlyKeeper() ;
```

### whenActive


```solidity
modifier whenActive() ;
```

### constructor


```solidity
constructor(
    address _vault,
    address _asset,
    address _owner,
    address _keeper,
    uint64 _maxNavAge,
    uint16 _maxNavDeltaBpsPerUpdate,
    uint16 _minBaseLiquidityBps,
    address _bridgeAddress
) Ownable(_owner);
```

### updateRemoteNav

Update keeper-reported remote NAV with delta cap enforcement.


```solidity
function updateRemoteNav(uint256 newRemoteNav, bytes32 reportId) external onlyKeeper;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newRemoteNav`|`uint256`|New NAV value (creator token units).|
|`reportId`|`bytes32`|Report identifier for offchain correlation.|


### rebalanceToSolana

Rebalance tokens from Base to Solana (keeper-only).

Transfers tokens to bridge address. Cannot breach minBaseLiquidityBps buffer.


```solidity
function rebalanceToSolana(uint256 amount) external onlyKeeper whenActive nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of creator tokens to rebalance out.|


### reconcileFromSolana

Mark reconciliation of tokens received from Solana (keeper-only).

Updates flow-tracking state. Call after bridge has deposited tokens to this contract.


```solidity
function reconcileFromSolana(uint256 amount, bytes32 reportId) external onlyKeeper;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of creator tokens received.|
|`reportId`|`bytes32`|Report identifier for offchain correlation.|


### asset


```solidity
function asset() external view override returns (address);
```

### getTotalAssets


```solidity
function getTotalAssets() public view override returns (uint256);
```

### isActive


```solidity
function isActive() external view override returns (bool);
```

### deposit


```solidity
function deposit(uint256 amount) external override onlyVault whenActive nonReentrant returns (uint256 deposited);
```

### withdraw


```solidity
function withdraw(uint256 amount) external override onlyVault nonReentrant returns (uint256 withdrawn);
```

### emergencyWithdraw


```solidity
function emergencyWithdraw() external override onlyVault nonReentrant returns (uint256 withdrawn);
```

### harvest


```solidity
function harvest() external view override onlyVault returns (uint256 profit);
```

### rebalance


```solidity
function rebalance() external override onlyVault;
```

### isValuationReady


```solidity
function isValuationReady() external view override returns (bool);
```

### _isValuationReady


```solidity
function _isValuationReady() internal view returns (bool);
```

### _isActive


```solidity
function _isActive() internal view returns (bool);
```

### setKeeper


```solidity
function setKeeper(address keeper, bool status) external onlyOwner;
```

### setRemoteNavEnabled


```solidity
function setRemoteNavEnabled(bool enabled) external onlyOwner;
```

### setEmergencyPaused


```solidity
function setEmergencyPaused(bool paused) external onlyOwner;
```

### emergencyPaused


```solidity
function emergencyPaused() external view returns (bool);
```

## Events
### RemoteNavUpdated

```solidity
event RemoteNavUpdated(uint256 newRemoteNav, bytes32 reportId);
```

### RebalanceToSolana

```solidity
event RebalanceToSolana(uint256 amount, address indexed bridge);
```

### RebalanceFromSolanaReconciled

```solidity
event RebalanceFromSolanaReconciled(uint256 amount, bytes32 reportId);
```

### KeeperSet

```solidity
event KeeperSet(address indexed keeper, bool status);
```

### RemoteNavEnabledSet

```solidity
event RemoteNavEnabledSet(bool enabled);
```

### EmergencyPausedSet

```solidity
event EmergencyPausedSet(bool paused);
```

## Errors
### OnlyVault

```solidity
error OnlyVault();
```

### OnlyKeeper

```solidity
error OnlyKeeper();
```

### StrategyPaused

```solidity
error StrategyPaused();
```

### NavDeltaExceedsCap

```solidity
error NavDeltaExceedsCap();
```

### InvalidVault

```solidity
error InvalidVault();
```

### InvalidAsset

```solidity
error InvalidAsset();
```

### InvalidKeeper

```solidity
error InvalidKeeper();
```

### RebalanceWouldBreachBuffer

```solidity
error RebalanceWouldBreachBuffer();
```

### InvalidBridgeAddress

```solidity
error InvalidBridgeAddress();
```

### InsufficientBaseLiquidity

```solidity
error InsufficientBaseLiquidity();
```

