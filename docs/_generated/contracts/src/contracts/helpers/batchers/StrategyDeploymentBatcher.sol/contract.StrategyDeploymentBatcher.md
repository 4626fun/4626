# StrategyDeploymentBatcher
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/helpers/batchers/StrategyDeploymentBatcher.sol)

**Inherits:**
ReentrancyGuard

**Title:**
StrategyDeploymentBatcher

**Author:**
0xakita.eth

Batches deployment and wiring of 4626 strategies.

Used by AA deployment flows to create pools, vaults, and adapters.


## State Variables
### V3_FACTORY

```solidity
address public constant V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD
```


### UNISWAP_ROUTER

```solidity
address public constant UNISWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481
```


### CHARM_FACTORY
Charm Finance Alpha Vault Factory on Base

Vaults created via this factory appear on alpha.charm.fi UI


```solidity
address public constant CHARM_FACTORY = 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa
```


### creatorCharmStrategyFactory

```solidity
address public immutable creatorCharmStrategyFactory
```


### ajnaStrategyFactory

```solidity
address public immutable ajnaStrategyFactory
```


### ADD_STRATEGY_SELECTOR

```solidity
bytes4 private constant ADD_STRATEGY_SELECTOR = bytes4(keccak256("addStrategy(address,uint256)"))
```


## Functions
### constructor


```solidity
constructor() ;
```

### batchDeployStrategies

Deploy all strategies for a creator vault (FULLY AUTOMATED)

This function is FULLY AUTOMATED:
- Deploys CharmAlphaVault, sets strategy, and transfers ownership atomically
- Calls rebalance() automatically after deployment
- No manual acceptance needed!
- Owner gets immediate control of all contracts


```solidity
function batchDeployStrategies(
    address underlyingToken,
    address quoteToken,
    address creatorVault,
    address _ajnaFactory,
    uint24 v3FeeTier,
    uint160 initialSqrtPriceX96,
    address owner,
    string memory vaultName,
    string memory vaultSymbol
) external nonReentrant returns (DeploymentResult memory result);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`underlyingToken`|`address`|The creator token (e.g., CREATOR)|
|`quoteToken`|`address`|The quote token for LP (e.g., USDC - 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)|
|`creatorVault`|`address`|The vault that will use these strategies|
|`_ajnaFactory`|`address`|The Ajna ERC20Pool factory address (if using Ajna)|
|`v3FeeTier`|`uint24`|The Uniswap V3 fee tier (e.g., 3000 for 0.3%)|
|`initialSqrtPriceX96`|`uint160`|Initial price for V3 pool (e.g., for 99/1 CREATOR/USDC)|
|`owner`|`address`|The creator coin owner who will own all strategies (typically the creator)|
|`vaultName`|`string`|Standard name for the Charm vault (e.g., "4626: akita/USDC")|
|`vaultSymbol`|`string`|Standard symbol for the Charm vault (e.g., "CV-akita-USDC")|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`result`|`DeploymentResult`|All deployed contract addresses|


### encodeAddStrategyBatch

Helper to encode vault.addStrategy() calls for AA

Returns calldata for batched execution


```solidity
function encodeAddStrategyBatch(
    address,
    /* vault */
    DeploymentResult memory result,
    uint256 charmWeightBps, // e.g., 6900 for 69.00%
    uint256 ajnaWeightBps // e.g., 2139 for 21.39%
) external pure returns (bytes[] memory calls);
```

## Events
### StrategiesDeployed

```solidity
event StrategiesDeployed(address indexed creator, address indexed underlyingToken, DeploymentResult result);
```

## Errors
### InvalidOwnerAddress

```solidity
error InvalidOwnerAddress();
```

### InvalidVaultName

```solidity
error InvalidVaultName();
```

### InvalidVaultSymbol

```solidity
error InvalidVaultSymbol();
```

### ZeroUnderlying

```solidity
error ZeroUnderlying();
```

### ZeroQuote

```solidity
error ZeroQuote();
```

### ZeroVault

```solidity
error ZeroVault();
```

## Structs
### DeploymentResult

```solidity
struct DeploymentResult {
    address charmVault;
    address charmStrategy;
    address creatorCharmStrategy;
    address ajnaStrategy;
    address v3Pool;
}
```

