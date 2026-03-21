# CreatorOVaultModuleBase
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/vault/modules/CreatorOVaultModuleBase.sol)

**Inherits:**
[CreatorOVaultModuleStorage](/contracts/vault/modules/CreatorOVaultModuleStorage.sol/abstract.CreatorOVaultModuleStorage.md)

Shared helpers for CreatorOVault delegatecall modules.


## State Variables
### _self

```solidity
address private immutable _self
```


## Functions
### constructor


```solidity
constructor() ;
```

### onlyDelegateCall


```solidity
modifier onlyDelegateCall() ;
```

### _creatorCoin


```solidity
function _creatorCoin() internal view returns (IERC20);
```

### _sharesUpdate


```solidity
function _sharesUpdate(address from, address to, uint256 value) internal;
```

### _spendAllowance


```solidity
function _spendAllowance(address owner, address spender, uint256 value) internal;
```

### _transferOwnership


```solidity
function _transferOwnership(address newOwner) internal;
```

## Errors
### OnlyDelegateCall

```solidity
error OnlyDelegateCall();
```

