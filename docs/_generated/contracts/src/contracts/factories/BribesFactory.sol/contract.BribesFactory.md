# BribesFactory
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/factories/BribesFactory.sol)


## State Variables
### gaugeVoting

```solidity
address public immutable gaugeVoting
```


### bribeDepotOf

```solidity
mapping(address vault => address depot) public bribeDepotOf
```


## Functions
### constructor


```solidity
constructor(address _gaugeVoting) ;
```

### createBribeDepot


```solidity
function createBribeDepot(address vault) public returns (address depot);
```

### getOrCreateBribeDepot


```solidity
function getOrCreateBribeDepot(address vault) external returns (address depot);
```

## Events
### BribeDepotCreated

```solidity
event BribeDepotCreated(address indexed vault, address indexed depot);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### DepotAlreadyExists

```solidity
error DepotAlreadyExists(address vault, address depot);
```

### VaultNotWhitelisted

```solidity
error VaultNotWhitelisted(address vault);
```

