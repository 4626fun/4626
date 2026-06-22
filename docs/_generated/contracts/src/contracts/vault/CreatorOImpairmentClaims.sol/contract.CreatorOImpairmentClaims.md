# CreatorOImpairmentClaims
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/CreatorOImpairmentClaims.sol)

**Inherits:**
ERC1155, Ownable

Non-transferable v1 impairment claims keyed by epoch id.


## State Variables
### vault

```solidity
address public vault
```


### totalSupply

```solidity
mapping(uint256 => uint256) public totalSupply
```


## Functions
### constructor


```solidity
constructor(address initialOwner) ERC1155("") Ownable(initialOwner);
```

### setVault


```solidity
function setVault(address vault_) external onlyOwner;
```

### mintFromVault


```solidity
function mintFromVault(address account, uint256 epochId, uint256 amount) external;
```

### _update


```solidity
function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override;
```

## Errors
### Unauthorized

```solidity
error Unauthorized();
```

### ClaimTransferDisabled

```solidity
error ClaimTransferDisabled();
```

