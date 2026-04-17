# DeploymentBatcherPhase3Helper
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/batchers/DeploymentBatcher.sol)


## State Variables
### V3_FEE_TIER

```solidity
uint24 internal constant V3_FEE_TIER = 3000
```


### CHARM_MANAGER_FEE_PIPS

```solidity
uint24 internal constant CHARM_MANAGER_FEE_PIPS = 160_000
```


### CHARM_DEFAULT_PROTOCOL_FEE_PIPS

```solidity
uint24 internal constant CHARM_DEFAULT_PROTOCOL_FEE_PIPS = 10_000
```


### CHARM_MIN_TICK_MOVE

```solidity
int24 internal constant CHARM_MIN_TICK_MOVE = 10
```


### CHARM_MAX_TWAP_DEVIATION

```solidity
int24 internal constant CHARM_MAX_TWAP_DEVIATION = 500
```


### CHARM_TWAP_DURATION

```solidity
uint32 internal constant CHARM_TWAP_DURATION = 300
```


### CHARM_FACTORY

```solidity
address internal constant CHARM_FACTORY = 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa
```


### CHARM_FACTORY_GOVERNANCE

```solidity
address internal constant CHARM_FACTORY_GOVERNANCE = 0x424cdd9021AF88A86C76b245e24583f9a71e32a1
```


### CHARM_FACTORY_GOVERNANCE_LEGACY

```solidity
address internal constant CHARM_FACTORY_GOVERNANCE_LEGACY = 0x94D85f9E8707fd8955D36173Ee48138E972609c6
```


### create2Deployer

```solidity
IUniversalCreate2DeployerFromStore public immutable create2Deployer
```


### protocolTreasury

```solidity
address public immutable protocolTreasury
```


### usdc

```solidity
address public immutable usdc
```


### uniswapV3Factory

```solidity
address public immutable uniswapV3Factory
```


### uniswapRouter

```solidity
address public immutable uniswapRouter
```


### ajnaFactory

```solidity
address public immutable ajnaFactory
```


### batcher

```solidity
address public immutable batcher
```


## Functions
### constructor


```solidity
constructor(
    address _create2Deployer,
    address _protocolTreasury,
    address _usdc,
    address _uniswapV3Factory,
    address _uniswapRouter,
    address _ajnaFactory
) ;
```

### deployPhase3Strategies


```solidity
function deployPhase3Strategies(
    DeploymentBatcher.Phase3Params calldata params,
    DeploymentBatcher.StrategyCodeIds calldata codeIds,
    bytes32 baseSalt
) external returns (DeploymentBatcher.Phase3Result memory out);
```

### _saltFor


```solidity
function _saltFor(bytes32 baseSalt, string memory label) internal pure returns (bytes32);
```

### _enforceCharmFactoryGovernance


```solidity
function _enforceCharmFactoryGovernance(uint24 expectedProtocolFeePipsConfig) internal view;
```

### _enforceCharmVaultManager


```solidity
function _enforceCharmVaultManager(address charmVault, address expectedManager) internal view;
```

### _isAllowedCharmFactoryGovernance


```solidity
function _isAllowedCharmFactoryGovernance(address governance) internal pure returns (bool);
```

## Errors
### NotBatcher

```solidity
error NotBatcher();
```

### MissingInitialSqrtPriceX96

```solidity
error MissingInitialSqrtPriceX96();
```

### V3PoolMissing

```solidity
error V3PoolMissing();
```

### CharmFactoryGovernanceMismatch

```solidity
error CharmFactoryGovernanceMismatch(address expected, address actual);
```

### CharmFactoryProtocolFeeMismatch

```solidity
error CharmFactoryProtocolFeeMismatch(uint256 expected, uint256 actual);
```

### CharmVaultManagerMismatch

```solidity
error CharmVaultManagerMismatch(address expected, address actual);
```

### Phase3HelperLostAdmin

```solidity
error Phase3HelperLostAdmin();
```

