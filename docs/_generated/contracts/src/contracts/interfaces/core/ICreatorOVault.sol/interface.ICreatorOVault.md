# ICreatorOVault
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/interfaces/core/ICreatorOVault.sol)

**Title:**
ICreatorOVault

**Author:**
0xakita.eth

Minimal vault interface for registry and helper wiring.

Used by batchers and controllers to configure vaults.


## Functions
### deposit


```solidity
function deposit(uint256 assets, address receiver) external returns (uint256 shares);
```

### setGaugeController


```solidity
function setGaugeController(address _controller) external;
```

### setWhitelist


```solidity
function setWhitelist(address _account, bool _status) external;
```

### setProtocolRescue


```solidity
function setProtocolRescue(address rescue) external;
```

### transferOwnership


```solidity
function transferOwnership(address newOwner) external;
```

### convertToAssets


```solidity
function convertToAssets(uint256 shares) external view returns (uint256);
```

