# ICreatorOVault
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/interfaces/core/ICreatorOVault.sol)

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

### setModulesOnce


```solidity
function setModulesOnce(address coreModule, address strategiesModule, address adminModule) external;
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

