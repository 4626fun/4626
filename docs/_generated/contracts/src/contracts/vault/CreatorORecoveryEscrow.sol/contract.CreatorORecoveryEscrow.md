# CreatorORecoveryEscrow
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/CreatorORecoveryEscrow.sol)

**Inherits:**
Ownable

Epoch-scoped recovery escrow. Vault notifies recoveries and executes claims.


## State Variables
### vault

```solidity
address public vault
```


### recoveredByEpochAsset

```solidity
mapping(uint256 => mapping(address => uint256)) public recoveredByEpochAsset
```


### claimedByEpochAsset

```solidity
mapping(uint256 => mapping(address => uint256)) public claimedByEpochAsset
```


## Functions
### constructor


```solidity
constructor(address initialOwner) Ownable(initialOwner);
```

### setVault


```solidity
function setVault(address vault_) external onlyOwner;
```

### notifyRecovery


```solidity
function notifyRecovery(address asset, uint256 epochId, uint256 amount) external;
```

### claimRecovery


```solidity
function claimRecovery(address asset, uint256 epochId, address receiver, uint256 amount) external;
```

## Errors
### Unauthorized

```solidity
error Unauthorized();
```

### ClaimExceedsRecovered

```solidity
error ClaimExceedsRecovered(uint256 epochId, address asset, uint256 recovered, uint256 requested);
```

