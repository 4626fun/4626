# UniversalCreate2DeployerFromStore
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/factories/UniversalCreate2DeployerFromStore.sol)

**Title:**
UniversalCreate2DeployerFromStore

**Author:**
0xakita.eth

CREATE2 deployer using bytecode stored on-chain.

Used with `UniversalBytecodeStore` to keep calldata small.


## State Variables
### store

```solidity
UniversalBytecodeStore public immutable store
```


## Functions
### constructor


```solidity
constructor(address _store) ;
```

### deploy


```solidity
function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr);
```

### computeAddress


```solidity
function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address);
```

## Events
### Deployed

```solidity
event Deployed(address indexed addr, bytes32 indexed salt, bytes32 indexed codeId, bytes32 initCodeHash);
```

## Errors
### CodeNotFound

```solidity
error CodeNotFound(bytes32 codeId);
```

### DeployFailed

```solidity
error DeployFailed();
```

