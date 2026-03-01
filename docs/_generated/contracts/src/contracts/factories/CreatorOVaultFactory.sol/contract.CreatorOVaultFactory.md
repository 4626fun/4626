# CreatorOVaultFactory
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/factories/CreatorOVaultFactory.sol)

**Inherits:**
Ownable

**Title:**
CreatorOVaultFactory

**Author:**
0xakita.eth

Registry for Creator Vault deployments (contracts deployed via script)

DEPRECATED: This factory is superseded by DeploymentBatcher (contracts/helpers/batchers/).
DeploymentBatcher handles phased deployment (Phase 1-3) with CREATE2 deterministic
addresses, hub-centric architecture support, and remote chain OFT-only deployment.
This contract is kept for backwards compatibility with existing deployments.
New deployments should use DeploymentBatcher exclusively.

LEGACY DESIGN RATIONALE:
Original factory exceeded EVM contract size limit (88KB > 24KB)
because it embedded bytecode for 6 contracts.
LEGACY APPROACH:
- Contracts deployed directly via Foundry script (no size limit)
- This contract just stores deployment info
- Enables lookup, enumeration, and registry integration

DEPLOYMENT FLOW (LEGACY):
1. Deploy this factory (part of infrastructure)
2. Run DeployVaultStack script which:
- Deploys all 6 contracts individually
- Calls factory.registerDeployment() to store info
3. Addresses stored here for lookup


## State Variables
### registry

```solidity
ICreatorRegistry public registry
```


### deploymentCount

```solidity
uint256 public deploymentCount
```


### deployments

```solidity
mapping(address => DeploymentInfo) public deployments
```


### deployedTokens

```solidity
address[] public deployedTokens
```


### authorizedDeployers
Authorized deployers (can register deployments)


```solidity
mapping(address => bool) public authorizedDeployers
```


## Functions
### constructor


```solidity
constructor(address _registry, address _owner) Ownable(_owner);
```

### onlyAuthorizedDeployer


```solidity
modifier onlyAuthorizedDeployer() ;
```

### setAuthorizedDeployer

Authorize/deauthorize a deployer


```solidity
function setAuthorizedDeployer(address _deployer, bool _authorized) external onlyOwner;
```

### setRegistry

Update registry address


```solidity
function setRegistry(address _registry) external onlyOwner;
```

### registerDeployment

Register a deployment (called by script after deploying contracts)

Only authorized deployers can call this


```solidity
function registerDeployment(
    address _creatorCoin,
    address _vault,
    address _wrapper,
    address _shareOFT,
    address _gaugeController,
    address _ccaStrategy,
    address _oracle,
    address _creator
) external onlyAuthorizedDeployer;
```

### _registerWithRegistry


```solidity
function _registerWithRegistry(
    address _creatorCoin,
    address _vault,
    address _wrapper,
    address _shareOFT,
    address _oracle,
    address _gaugeController,
    address _creator
) internal;
```

### getDeployment


```solidity
function getDeployment(address _token) external view returns (DeploymentInfo memory);
```

### getAllDeployedTokens


```solidity
function getAllDeployedTokens() external view returns (address[] memory);
```

### isDeployed


```solidity
function isDeployed(address _token) external view returns (bool);
```

### isAuthorizedDeployer


```solidity
function isAuthorizedDeployer(address _deployer) external view returns (bool);
```

## Events
### DeploymentRegistered

```solidity
event DeploymentRegistered(
    address indexed creatorCoin,
    address indexed vault,
    address wrapper,
    address shareOFT,
    address gaugeController,
    address ccaStrategy,
    address oracle,
    address creator
);
```

### DeployerAuthorized

```solidity
event DeployerAuthorized(address indexed deployer, bool authorized);
```

### RegistryUpdated

```solidity
event RegistryUpdated(address indexed newRegistry);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### AlreadyDeployed

```solidity
error AlreadyDeployed();
```

### NotAuthorized

```solidity
error NotAuthorized();
```

## Structs
### DeploymentInfo

```solidity
struct DeploymentInfo {
    address creatorCoin;
    address vault;
    address wrapper;
    address shareOFT;
    address gaugeController;
    address ccaStrategy;
    address oracle;
    address creator;
    uint256 deployedAt;
    bool exists;
}
```

