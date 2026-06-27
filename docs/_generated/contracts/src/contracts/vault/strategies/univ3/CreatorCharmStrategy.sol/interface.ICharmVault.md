# ICharmVault
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/vault/strategies/univ3/CreatorCharmStrategy.sol)

**Title:**
CreatorCharmStrategy

**Author:**
0xakita.eth

Charm vault strategy adapter for CREATOR/USDC.

Used by CreatorOVault as a yield strategy.


## Functions
### deposit


```solidity
function deposit(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address to)
    external
    returns (uint256 shares, uint256 amount0, uint256 amount1);
```

### withdraw


```solidity
function withdraw(uint256 shares, uint256 amount0Min, uint256 amount1Min, address to)
    external
    returns (uint256 amount0, uint256 amount1);
```

### getTotalAmounts


```solidity
function getTotalAmounts() external view returns (uint256 total0, uint256 total1);
```

### totalSupply


```solidity
function totalSupply() external view returns (uint256);
```

### balanceOf


```solidity
function balanceOf(address account) external view returns (uint256);
```

### baseLower


```solidity
function baseLower() external view returns (int24);
```

### baseUpper


```solidity
function baseUpper() external view returns (int24);
```

### pool


```solidity
function pool() external view returns (address);
```

### rebalance


```solidity
function rebalance() external;
```

### token0


```solidity
function token0() external view returns (address);
```

### token1


```solidity
function token1() external view returns (address);
```

