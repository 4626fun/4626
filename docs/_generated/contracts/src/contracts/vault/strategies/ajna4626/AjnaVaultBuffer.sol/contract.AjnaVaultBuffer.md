# AjnaVaultBuffer
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/vault/strategies/ajna4626/AjnaVaultBuffer.sol)

**Title:**
AjnaVaultBuffer

Dedicated idle reserve for the inner Ajna ERC-4626 vault.

The vault is the only allowed caller. The buffer keeps exit liquidity
separate from Ajna bucket positions so outer withdrawals can inspect a
single reserve balance.


## State Variables
### asset

```solidity
IERC20 public immutable asset
```


### vault

```solidity
address public immutable vault
```


## Functions
### onlyVault


```solidity
modifier onlyVault() ;
```

### constructor


```solidity
constructor(IERC20 asset_) ;
```

### depositFromVault


```solidity
function depositFromVault(uint256 assets) external onlyVault;
```

### withdrawToVault


```solidity
function withdrawToVault(uint256 assets) external onlyVault;
```

### totalAssets


```solidity
function totalAssets() external view returns (uint256);
```

## Errors
### NotVault

```solidity
error NotVault();
```

