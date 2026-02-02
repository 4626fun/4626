# ICreatorGaugeController
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/interfaces/core/ICreatorGaugeController.sol)

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

