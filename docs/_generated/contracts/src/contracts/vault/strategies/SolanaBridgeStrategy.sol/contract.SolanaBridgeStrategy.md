# SolanaBridgeStrategy
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/vault/strategies/SolanaBridgeStrategy.sol)

**Inherits:**
[IStrategy](/contracts/interfaces/IStrategy.sol/interface.IStrategy.md), [IStrategyValuation](/contracts/interfaces/IStrategyValuation.sol/interface.IStrategyValuation.md), Ownable, ReentrancyGuard

**Title:**
SolanaBridgeStrategy

Minimal CreatorOVault strategy adapter for Solana allocation.

This strategy intentionally keeps deposits local by default. Bridging is an explicit
owner action (`bridgeToSolana`) so vault withdrawals are not implicitly coupled to a
cross-chain return path.


## State Variables
### vault

```solidity
address public immutable vault
```


### ASSET

```solidity
IERC20 public immutable ASSET
```


### bridgeAdapter

```solidity
address public bridgeAdapter
```


### solanaDestination

```solidity
bytes32 public solanaDestination
```


### _isActive

```solidity
bool private _isActive
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
constructor(address _vault, address _asset, address _bridgeAdapter, bytes32 _solanaDestination, address _owner)
    Ownable(_owner);
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


```solidity
function isValuationReady() external pure override returns (bool);
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
function emergencyWithdraw() external override onlyVault nonReentrant returns (uint256 withdrawn);
```

### harvest


```solidity
function harvest() external override onlyVault returns (uint256 profit);
```

### rebalance


```solidity
function rebalance() external override onlyVault;
```

### setActive


```solidity
function setActive(bool active) external onlyOwner;
```

### setBridgeConfig


```solidity
function setBridgeConfig(address adapter, bytes32 destination) external onlyOwner;
```

### bridgeToSolana


```solidity
function bridgeToSolana(uint256 amount) external payable onlyOwner whenActive nonReentrant;
```

### rescueTokens


```solidity
function rescueTokens(address token, uint256 amount, address to) external onlyOwner;
```

## Events
### BridgeConfigUpdated

```solidity
event BridgeConfigUpdated(address indexed adapter, bytes32 indexed destination);
```

### BridgedToSolana

```solidity
event BridgedToSolana(uint256 amount, bytes32 indexed destination);
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

### InvalidAddress

```solidity
error InvalidAddress();
```

### InvalidAmount

```solidity
error InvalidAmount();
```

### BridgeConfigMissing

```solidity
error BridgeConfigMissing();
```

