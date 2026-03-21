# ICreatorGaugeController
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/interfaces/core/ICreatorGaugeController.sol)

**Title:**
ICreatorGaugeController

**Author:**
0xakita.eth

Interface for configuring creator gauge controllers.

Used by registry and vault setup flows.


## Functions
### setVault


```solidity
function setVault(address _vault) external;
```

### setWrapper


```solidity
function setWrapper(address _wrapper) external;
```

### setCreatorCoin


```solidity
function setCreatorCoin(address _creatorCoin) external;
```

### setLotteryManager


```solidity
function setLotteryManager(address _lotteryManager) external;
```

### setOracle


```solidity
function setOracle(address _oracle) external;
```

### transferOwnership


```solidity
function transferOwnership(address newOwner) external;
```

### receiveFees


```solidity
function receiveFees(uint256 amount) external;
```

