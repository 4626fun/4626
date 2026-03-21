# ERC4626StrategyAdapter
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/vault/strategies/ERC4626StrategyAdapter.sol)

**Inherits:**
[IStrategy](/contracts/interfaces/IStrategy.sol/interface.IStrategy.md), [IStrategyValuation](/contracts/interfaces/IStrategyValuation.sol/interface.IStrategyValuation.md), Ownable, ReentrancyGuard

**Title:**
ERC4626StrategyAdapter

**Author:**
0xakita.eth

Adapts an ERC-4626 vault to the `IStrategy` interface.

Used by CreatorOVault to integrate ERC-4626 yield sources.


## State Variables
### vault
CreatorOVault that owns this strategy.


```solidity
address public immutable vault
```


### ASSET
Underlying asset token (must match the ERC-4626 `asset()`).


```solidity
IERC20 public immutable ASSET
```


### ERC4626_VAULT
Target ERC-4626 vault (strategy holds shares of this vault).


```solidity
IERC4626 public immutable ERC4626_VAULT
```


### _isActive
Strategy active flag.


```solidity
bool private _isActive
```


### idleBufferBps
Target % of strategy assets to keep idle (basis points).


```solidity
uint256 public idleBufferBps = 1000
```


### valuationMaxIncreaseBps
Maximum upward valuation move allowed per check window (basis points).


```solidity
uint256 public valuationMaxIncreaseBps = 1000
```


### valuationMaxDecreaseBps
Maximum downward valuation move allowed per check window (basis points).


```solidity
uint256 public valuationMaxDecreaseBps = 1000
```


### valuationCheckWindow
Length of one valuation guard window (seconds).


```solidity
uint256 public valuationCheckWindow = 30 minutes
```


### lastValuationAssetsPerShare
Last trusted assets-per-share snapshot (1e18 scale).


```solidity
uint256 public lastValuationAssetsPerShare
```


### lastValuationTimestamp
Timestamp when valuation snapshot was last synchronized.


```solidity
uint256 public lastValuationTimestamp
```


## Functions
### onlyVault


```solidity
modifier onlyVault() ;
```

### whenActive


```solidity
modifier whenActive() ;
```

### constructor


```solidity
constructor(address _vault, address _erc4626Vault, address _owner) Ownable(_owner);
```

### isActive


```solidity
function isActive() external view override returns (bool);
```

### asset


```solidity
function asset() external view override returns (address);
```

### isValuationReady

Strategy valuation health check for ERC-4626 deposit/mint gating.

MUST NOT revert. Returns false when the underlying ERC-4626 conversion
reverts for any held shares.


```solidity
function isValuationReady() external view override returns (bool);
```

### getTotalAssets


```solidity
function getTotalAssets() public view override returns (uint256);
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
function emergencyWithdraw() external override onlyVault nonReentrant returns (uint256 totalWithdrawn);
```

### harvest


```solidity
function harvest() external override onlyVault returns (uint256 profit);
```

### rebalance


```solidity
function rebalance() external override onlyVault;
```

### _maxWithdrawBestEffort


```solidity
function _maxWithdrawBestEffort() internal view returns (uint256);
```

### _maxRedeemBestEffort


```solidity
function _maxRedeemBestEffort() internal view returns (uint256);
```

### _withdrawFrom4626BestEffort


```solidity
function _withdrawFrom4626BestEffort(uint256 assets) internal returns (uint256 pulled);
```

### setActive


```solidity
function setActive(bool active) external onlyOwner;
```

### setIdleBufferBps


```solidity
function setIdleBufferBps(uint256 newBps) external onlyOwner;
```

### setValuationGuard

Configure valuation guard thresholds and window.

The allowed valuation drift scales by full elapsed windows since the last trusted snapshot.


```solidity
function setValuationGuard(uint256 maxIncreaseBps, uint256 maxDecreaseBps, uint256 checkWindow) external onlyOwner;
```

### rescueTokens


```solidity
function rescueTokens(address token, uint256 amount, address to) external onlyOwner;
```

### _readCurrentAssetsPerShare


```solidity
function _readCurrentAssetsPerShare() internal view returns (bool ok, uint256 assetsPerShare);
```

### _allowedBpsForElapsedWindows


```solidity
function _allowedBpsForElapsedWindows(uint256 perWindowBps) internal view returns (uint256 allowedBps);
```

### _isWithinValuationBounds


```solidity
function _isWithinValuationBounds(uint256 snapshotPps, uint256 currentPps) internal view returns (bool);
```

### _syncValuationSnapshotBestEffort


```solidity
function _syncValuationSnapshotBestEffort() internal;
```

## Events
### ValuationGuardUpdated

```solidity
event ValuationGuardUpdated(uint256 maxIncreaseBps, uint256 maxDecreaseBps, uint256 checkWindow);
```

### ValuationSnapshotSynced

```solidity
event ValuationSnapshotSynced(uint256 assetsPerShare, uint256 timestamp);
```

## Errors
### OnlyVault

```solidity
error OnlyVault();
```

### StrategyPaused

```solidity
error StrategyPaused();
```

### InvalidBps

```solidity
error InvalidBps();
```

### InvalidWindow

```solidity
error InvalidWindow();
```

