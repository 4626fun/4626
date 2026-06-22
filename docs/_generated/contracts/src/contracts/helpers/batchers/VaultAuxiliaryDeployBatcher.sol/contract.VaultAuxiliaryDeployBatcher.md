# VaultAuxiliaryDeployBatcher
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/batchers/VaultAuxiliaryDeployBatcher.sol)


## Constants
### BASE_WETH

```solidity
address internal constant BASE_WETH = 0x4200000000000000000000000000000000000006
```


### DEFAULT_PROTOCOL_REWARDS

```solidity
address internal constant DEFAULT_PROTOCOL_REWARDS = 0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B
```


### create2Deployer

```solidity
IAuxiliaryCreate2Deployer public immutable create2Deployer
```


### bytecodeStore

```solidity
IAuxiliaryBytecodeStore public immutable bytecodeStore
```


### deploymentBatcher

```solidity
address public immutable deploymentBatcher
```


### protocolTreasury

```solidity
address public immutable protocolTreasury
```


### swapRouter

```solidity
address public immutable swapRouter
```


## Functions
### constructor


```solidity
constructor(
    address create2Deployer_,
    address bytecodeStore_,
    address deploymentBatcher_,
    address protocolTreasury_,
    address swapRouter_
) ;
```

### deployPhase2Auxiliaries


```solidity
function deployPhase2Auxiliaries(Params calldata params, CodeIds calldata codeIds)
    external
    returns (Result memory out);
```

### _deriveInitCodeHash


```solidity
function _deriveInitCodeHash(bytes32 codeId, bytes memory constructorArgs) internal view returns (bytes32);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### NotOwner

```solidity
error NotOwner();
```

### InvalidCodeId

```solidity
error InvalidCodeId();
```

### InvalidAuxiliaryConfig

```solidity
error InvalidAuxiliaryConfig();
```

## Structs
### Params

```solidity
struct Params {
    address creatorToken;
    address owner;
    address vault;
    address swapRouter;
    address weth;
    address protocolRewards;
}
```

### CodeIds

```solidity
struct CodeIds {
    bytes32 vaultShareBurnStream;
    bytes32 payoutRouter;
    bytes32 creatorCoinPolicyController;
}
```

### Result

```solidity
struct Result {
    address burnStream;
    address payoutRouter;
    address creatorCoinPolicyController;
}
```

