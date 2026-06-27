# UniversalCreate2DeployerFromStore
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/factories/UniversalCreate2DeployerFromStore.sol)

**Title:**
UniversalCreate2DeployerFromStore

**Author:**
0xakita.eth

CREATE2 deployer using bytecode stored on-chain.

Used with `UniversalBytecodeStore` to keep calldata small.


## Constants
### store

```solidity
UniversalBytecodeStore public immutable store
```


### owner

```solidity
address public immutable owner
```


## State Variables
### authorizedDeployers

```solidity
mapping(address => bool) public authorizedDeployers
```


## Functions
### constructor


```solidity
constructor(address _store, address _owner) ;
```

### setAuthorizedDeployer


```solidity
function setAuthorizedDeployer(address deployer, bool allowed) external;
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

### DeployerAuthorized

```solidity
event DeployerAuthorized(address indexed deployer, bool allowed);
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

### NotAuthorizedDeployer

```solidity
error NotAuthorizedDeployer();
```

