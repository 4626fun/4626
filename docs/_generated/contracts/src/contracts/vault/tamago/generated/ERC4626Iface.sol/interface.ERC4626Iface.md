# ERC4626Iface
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/vault/tamago/generated/ERC4626Iface.sol)


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

### asset


```solidity
function asset() external view returns (address);
```

### totalAssets


```solidity
function totalAssets() external view returns (uint256);
```

### convertToShares


```solidity
function convertToShares(uint256 assets) external view returns (uint256);
```

### convertToAssets


```solidity
function convertToAssets(uint256 shares) external view returns (uint256);
```

### maxDeposit


```solidity
function maxDeposit(address _receiver) external view returns (uint256);
```

### maxMint


```solidity
function maxMint(address _receiver) external view returns (uint256);
```

### maxWithdraw


```solidity
function maxWithdraw(address ownerAddr) external view returns (uint256);
```

### maxRedeem


```solidity
function maxRedeem(address ownerAddr) external view returns (uint256);
```

### previewDeposit


```solidity
function previewDeposit(uint256 assets) external view returns (uint256);
```

### previewMint


```solidity
function previewMint(uint256 shares) external view returns (uint256);
```

### previewWithdraw


```solidity
function previewWithdraw(uint256 assets) external view returns (uint256);
```

### previewRedeem


```solidity
function previewRedeem(uint256 shares) external view returns (uint256);
```

### deposit


```solidity
function deposit(uint256 assets, address receiver) external returns (uint256);
```

### mint


```solidity
function mint(uint256 shares, address receiver) external returns (uint256);
```

### withdraw


```solidity
function withdraw(uint256 assets, address receiver, address ownerAddr) external returns (uint256);
```

### redeem


```solidity
function redeem(uint256 shares, address receiver, address ownerAddr) external returns (uint256);
```

## Events
### Transfer

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

### Approval

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

### Deposit

```solidity
event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
```

### Withdraw

```solidity
event Withdraw(
    address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
);
```

