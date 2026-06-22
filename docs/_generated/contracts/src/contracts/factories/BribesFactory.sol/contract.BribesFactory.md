# BribesFactory
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/factories/BribesFactory.sol)


## Constants
### gaugeVoting

```solidity
address public immutable gaugeVoting
```


## State Variables
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

