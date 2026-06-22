# DeploymentBatcherPhase2Module
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/batchers/DeploymentBatcher.sol)


## Constants
### AUCTION_PERCENT

```solidity
uint8 internal constant AUCTION_PERCENT = 30
```


### VESTING_PERCENT

```solidity
uint8 internal constant VESTING_PERCENT = 30
```


### SOLANA_ALLOC_PERCENT

```solidity
uint8 internal constant SOLANA_ALLOC_PERCENT = 30
```


### LP_RESERVE_PERCENT

```solidity
uint8 internal constant LP_RESERVE_PERCENT = 10
```


### MIN_FIRST_DEPOSIT
Allowed first-deposit range (creator-token principal, 18 decimals).

Must stay >= CreatorOVault.MINIMUM_FIRST_DEPOSIT (50M). The upper bound
keeps the four-way share split (auction/vesting/Solana/LP) within sizes
the CCA + LZ bridge lanes have been validated for.


```solidity
uint256 internal constant MIN_FIRST_DEPOSIT = 50_000_000e18
```


### MAX_FIRST_DEPOSIT

```solidity
uint256 internal constant MAX_FIRST_DEPOSIT = 100_000_000e18
```


### DEFAULT_LAUNCH_DISCOUNT_BPS

```solidity
uint16 internal constant DEFAULT_LAUNCH_DISCOUNT_BPS = 8_000
```


### DEFAULT_LAUNCH_TICK_SPACING_BPS

```solidity
uint16 internal constant DEFAULT_LAUNCH_TICK_SPACING_BPS = 100
```


### DEFAULT_SHARE_BRIDGE_GAS_LIMIT

```solidity
uint128 internal constant DEFAULT_SHARE_BRIDGE_GAS_LIMIT = 200_000
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
    address _vaultActivationBatcher,
    address _batcher
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

### deployPhase2CoreOrchestrator


```solidity
function deployPhase2CoreOrchestrator(
    DeploymentBatcher.Phase2CoreParams calldata params,
    DeploymentBatcher.CodeIds calldata codeIds,
    bytes32 baseSalt,
    string calldata shareSymbolLower,
    DeploymentBatcher.Phase1SplitState calldata p1state,
    address rolePolicyManager,
    uint256 rolePolicyId
) external returns (DeploymentBatcher.Phase2Result memory out);
```

### _deployPhase2CoreBody


```solidity
function _deployPhase2CoreBody(
    DeploymentBatcher.Phase2CoreParams calldata params,
    DeploymentBatcher.CodeIds calldata codeIds,
    bytes32 baseSalt,
    string calldata shareSymbolLower
) internal returns (DeploymentBatcher.Phase2Result memory out);
```

### finalizePhase2Execution


```solidity
function finalizePhase2Execution(DeploymentBatcher.Phase2FinalizeParams calldata params, bytes32 baseSalt)
    public
    returns (FinalizeExecutionResult memory result);
```

### _readTokenMetadata


```solidity
function _readTokenMetadata(address token) internal view returns (string memory name, string memory symbol);
```

### _ensureRegistryAndShareOftPeerWired


```solidity
function _ensureRegistryAndShareOftPeerWired(
    DeploymentBatcher.Phase2FinalizeParams calldata params,
    uint32 solanaEid
) internal;
```

### _bridgeShareAllocationToSolana


```solidity
function _bridgeShareAllocationToSolana(address shareOFT, uint256 amount) internal;
```

### _saltFor


```solidity
function _saltFor(bytes32 baseSalt, string memory label) internal pure returns (bytes32);
```

### launchDeferredAuctionExecution


```solidity
function launchDeferredAuctionExecution(
    address shareOFT,
    address ccaStrategy,
    uint256 amount,
    uint256 lpReserveAmount,
    uint256 floorPriceQ96,
    uint128 requiredRaise,
    bytes calldata auctionSteps
) external returns (address auction);
```

### _validateFinalizePhase2


```solidity
function _validateFinalizePhase2(
    DeploymentBatcher.Phase2FinalizeParams calldata params,
    DeploymentBatcher.Phase1SplitState calldata p1state
) internal view;
```

### finalizePhase2Orchestrator


```solidity
function finalizePhase2Orchestrator(
    DeploymentBatcher.Phase2FinalizeParams calldata params,
    DeploymentBatcher.Phase1SplitState calldata p1state,
    bytes32 baseSalt
) public returns (DeploymentBatcher.Phase2Result memory out, FinalizeExecutionResult memory execution);
```

### finalizePhase2Entry


```solidity
function finalizePhase2Entry(
    DeploymentBatcher.Phase2FinalizeParams calldata params,
    DeploymentBatcher.Phase1SplitState calldata p1state,
    bytes32 baseSalt
) external payable returns (FinalizeEntryResult memory result);
```

### finalizePhase2EntryWithPermit2


```solidity
function finalizePhase2EntryWithPermit2(
    DeploymentBatcher.Phase2FinalizeParams calldata params,
    DeploymentBatcher.Phase1SplitState calldata p1state,
    bytes32 baseSalt,
    address permit2,
    ISignatureTransfer.PermitTransferFrom calldata permit,
    bytes calldata signature
) external payable returns (FinalizeEntryResult memory result);
```

## Errors
### NotBatcherContext

```solidity
error NotBatcherContext();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### SolanaShareBridgeNotConfigured

```solidity
error SolanaShareBridgeNotConfigured();
```

### SolanaShareOftPeerNotConfigured

```solidity
error SolanaShareOftPeerNotConfigured();
```

### InsufficientSolanaBridgeFee

```solidity
error InsufficientSolanaBridgeFee(uint256 required, uint256 provided);
```

### SolanaBridgeRefundFailed

```solidity
error SolanaBridgeRefundFailed();
```

### AuctionAmountMismatch

```solidity
error AuctionAmountMismatch();
```

### InvalidDepositAmount

```solidity
error InvalidDepositAmount();
```

### DeprecatedFinalizeSolanaParams

```solidity
error DeprecatedFinalizeSolanaParams();
```

### Phase1Missing

```solidity
error Phase1Missing();
```

### Phase2Missing

```solidity
error Phase2Missing();
```

### Phase1StateMismatch

```solidity
error Phase1StateMismatch();
```

### InvalidCreatorTreasury

```solidity
error InvalidCreatorTreasury(address provided);
```

### InvalidCreatorCoinPayoutRecipient

```solidity
error InvalidCreatorCoinPayoutRecipient();
```

### InvalidCodeId

```solidity
error InvalidCodeId();
```

### PermitTokenMismatch

```solidity
error PermitTokenMismatch();
```

### PermitAmountTooLow

```solidity
error PermitAmountTooLow();
```

## Structs
### FinalizeExecutionResult

```solidity
struct FinalizeExecutionResult {
    uint256 auctionAmount;
    uint256 lpReserveAmount;
    uint256 solanaAmount;
    uint256 vestingAmount;
    address vestingAddress;
    uint64 vestingStartTimestamp;
    uint64 vestingDurationSeconds;
}
```

### FinalizeEntryResult

```solidity
struct FinalizeEntryResult {
    DeploymentBatcher.Phase2Result phase2;
    FinalizeExecutionResult execution;
}
```

