# ERC20Iface
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/vault/tamago/generated/ERC20Iface.sol)


## Functions
### decimals


```solidity
function decimals() external view returns (uint256);
```

### totalSupply


```solidity
function totalSupply() external view returns (uint256);
```

### balanceOf


```solidity
function balanceOf(address account) external view returns (uint256);
```

### allowance


```solidity
function allowance(address ownerAddr, address spender) external view returns (uint256);
```

### owner


```solidity
function owner() external view returns (address);
```

### transferOwnership


```solidity
function transferOwnership(address newOwner) external returns (bool);
```

### renounceOwnership


```solidity
function renounceOwnership() external returns (bool);
```

### approve


```solidity
function approve(address spender, uint256 amount) external returns (bool);
```

### transfer


```solidity
function transfer(address toAddr, uint256 amount) external returns (bool);
```

### transferFrom


```solidity
function transferFrom(address fromAddr, address toAddr, uint256 amount) external returns (bool);
```

### mint


```solidity
function mint(address toAddr, uint256 amount) external returns (bool);
```

### burn


```solidity
function burn(address fromAddr, uint256 amount) external returns (bool);
```

## Events
### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

### Transfer

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

### Approval

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

