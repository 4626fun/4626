# DeploymentBatcherPhase2Module
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/batchers/DeploymentBatcher.sol)


## State Variables
### AUCTION_PERCENT

```solidity
uint8 internal constant AUCTION_PERCENT = 40
```


### VESTING_PERCENT

```solidity
uint8 internal constant VESTING_PERCENT = 40
```


### DEFAULT_LAUNCH_DISCOUNT_BPS

```solidity
uint16 internal constant DEFAULT_LAUNCH_DISCOUNT_BPS = 8_000
```


### DEFAULT_LAUNCH_TICK_SPACING_BPS

```solidity
uint16 internal constant DEFAULT_LAUNCH_TICK_SPACING_BPS = 100
```


### create2Deployer

```solidity
IUniversalCreate2DeployerFromStore public immutable create2Deployer
```


### registry

```solidity
address public immutable registry
```


### chainlinkEthUsd

```solidity
address public immutable chainlinkEthUsd
```


### poolManager

```solidity
address public immutable poolManager
```


### taxHook

```solidity
address public immutable taxHook
```


### protocolTreasury

```solidity
address public immutable protocolTreasury
```


### lotteryManager

```solidity
address public immutable lotteryManager
```


### vaultActivationBatcher

```solidity
address public immutable vaultActivationBatcher
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
    address _registry,
    address _chainlinkEthUsd,
    address _poolManager,
    address _taxHook,
    address _protocolTreasury,
    address _lotteryManager,
    address _vaultActivationBatcher
) ;
```

### deployPhase2Core


```solidity
function deployPhase2Core(
    DeploymentBatcher.Phase2CoreParams calldata params,
    DeploymentBatcher.CodeIds calldata codeIds,
    bytes32 baseSalt,
    string calldata shareSymbolLower
) external returns (DeploymentBatcher.Phase2Result memory out);
```

### finalizePhase2Execution


```solidity
function finalizePhase2Execution(DeploymentBatcher.Phase2FinalizeParams calldata params, bytes32 baseSalt)
    external
    returns (FinalizeExecutionResult memory result);
```

### _saltFor


```solidity
function _saltFor(bytes32 baseSalt, string memory label) internal pure returns (bytes32);
```

## Errors
### NotBatcherContext

```solidity
error NotBatcherContext();
```

## Structs
### FinalizeExecutionResult

```solidity
struct FinalizeExecutionResult {
    uint256 auctionAmount;
    uint256 lpReserveAmount;
    uint256 vestingAmount;
    address vestingAddress;
    uint64 vestingStartTimestamp;
    uint64 vestingDurationSeconds;
}
```

