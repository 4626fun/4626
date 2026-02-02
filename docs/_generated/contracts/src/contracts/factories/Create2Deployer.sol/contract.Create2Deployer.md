# Create2Deployer
[Git Source](https://github.com/creatorvault/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/contracts/factories/Create2Deployer.sol)

**Title:**
Create2Deployer

**Author:**
0xakita.eth

Minimal CREATE2 deployer for deterministic deployments.

Used by deployment tooling that passes init code via calldata.


## Functions
### deploy


```solidity
function deploy(bytes32 salt, bytes memory initCode) external returns (address addr);
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

## Errors
### DeployFailed

```solidity
error DeployFailed();
```

