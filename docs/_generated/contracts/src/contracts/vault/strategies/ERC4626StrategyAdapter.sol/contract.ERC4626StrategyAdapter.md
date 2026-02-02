# ERC4626StrategyAdapter
[Git Source](https://github.com/creatorvault/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/contracts/vault/strategies/ERC4626StrategyAdapter.sol)

**Inherits:**
[IStrategy](/contracts/interfaces/IStrategy.sol/interface.IStrategy.md), Ownable, ReentrancyGuard

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

### rescueTokens


```solidity
function rescueTokens(address token, uint256 amount, address to) external onlyOwner;
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

