# Create2Deployer
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/factories/Create2Deployer.sol)

**Title:**
Create2Deployer

**Author:**
0xakita.eth

Minimal CREATE2 deployer for deterministic deployments.

Used by deployment tooling that passes init code via calldata.


## State Variables
### owner

```solidity
address public immutable owner
```


### authorizedDeployers

```solidity
mapping(address => bool) public authorizedDeployers
```


## Functions
### onlyAuthorized


```solidity
modifier onlyAuthorized() ;
```

### constructor


```solidity
constructor() ;
```

### setAuthorizedDeployer


```solidity
function setAuthorizedDeployer(address deployer, bool allowed) external;
```

### deploy


```solidity
function deploy(bytes32 salt, bytes memory initCode) external onlyAuthorized returns (address addr);
```

### computeAddress


```solidity
function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address);
```

## Events
### Deployed

```solidity
event Deployed(address indexed addr, bytes32 indexed salt, bytes32 indexed initCodeHash);
```

### DeployerAuthorized

```solidity
event DeployerAuthorized(address indexed deployer, bool allowed);
```

## Errors
### DeployFailed

```solidity
error DeployFailed();
```

### NotAuthorizedDeployer

```solidity
error NotAuthorizedDeployer();
```

