# CreatorVaultDeployer
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/helpers/batchers/CreatorVaultDeployer.sol)

**Inherits:**
ReentrancyGuard

**Title:**
CreatorVaultDeployer

**Author:**
0xakita.eth

Multi-transaction CreatorVault deployment orchestrator (Phases 1–3).

We can no longer deploy the full stack in one transaction on Base due to code-deposit gas limits.
This contract splits deployment into multiple calls:
- Phase 1: deploy vault + wrapper + shareOFT + minimal wiring (no token pulls / no auction)
- Phase 2a: deploy gauge + CCA + oracle + wiring (no token pulls)
- Phase 2b: deposit + vesting + ownership transfers (plus optional deferred auction)


## State Variables
### V3_FEE_TIER

```solidity
uint24 public constant V3_FEE_TIER = 3000
```


### registry

```solidity
ICreatorRegistry public immutable registry
```


### bytecodeStore

```solidity
IUniversalBytecodeStore public immutable bytecodeStore
```


### create2Deployer

```solidity
IUniversalCreate2DeployerFromStore public immutable create2Deployer
```


### protocolTreasury

```solidity
address public immutable protocolTreasury
```


### poolManager

```solidity
address public immutable poolManager
```


### taxHook

```solidity
address public immutable taxHook
```


### chainlinkEthUsd

```solidity
address public immutable chainlinkEthUsd
```


### vaultActivationBatcher

```solidity
address public immutable vaultActivationBatcher
```


### lotteryManager

```solidity
address public immutable lotteryManager
```


### permit2

```solidity
address public immutable permit2
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


### pendingAuctions
Pending auction allocations keyed by creator/owner/version salt.


```solidity
mapping(bytes32 => PendingAuction) public pendingAuctions
```


## Functions
### constructor


```solidity
constructor(
    address _registry,
    address _bytecodeStore,
    address _create2Deployer,
    address _protocolTreasury,
    address _poolManager,
    address _taxHook,
    address _chainlinkEthUsd,
    address _vaultActivationBatcher,
    address _lotteryManager,
    address _permit2,
    address _usdc,
    address _uniswapV3Factory,
    address _uniswapRouter,
    address _ajnaFactory
) ;
```

### deployPhase1


```solidity
function deployPhase1(Phase1Params calldata params, CodeIds calldata codeIds)
    external
    nonReentrant
    returns (Phase1Result memory out);
```

### deployPhase1WithSalt


```solidity
function deployPhase1WithSalt(Phase1Params calldata params, CodeIds calldata codeIds, bytes32 shareOftSaltOverride)
    external
    nonReentrant
    returns (Phase1Result memory out);
```

### _deployPhase1Internal


```solidity
function _deployPhase1Internal(Phase1Params calldata params, CodeIds calldata codeIds, bytes32 shareOftSaltOverride)
    internal
    returns (Phase1Result memory out);
```

### deployPhase2AndLaunch


```solidity
function deployPhase2AndLaunch(Phase2Params calldata params, CodeIds calldata codeIds)
    external
    nonReentrant
    returns (Phase2Result memory out);
```

### deployPhase2AndLaunchWithPermit


```solidity
function deployPhase2AndLaunchWithPermit(
    Phase2Params calldata params,
    CodeIds calldata codeIds,
    PermitData calldata permit
) external nonReentrant returns (Phase2Result memory out);
```

### deployPhase2Core


```solidity
function deployPhase2Core(Phase2CoreParams calldata params, CodeIds calldata codeIds)
    external
    nonReentrant
    returns (Phase2Result memory out);
```

### finalizePhase2


```solidity
function finalizePhase2(Phase2FinalizeParams calldata params)
    external
    nonReentrant
    returns (Phase2Result memory out);
```

### launchDeferredAuction


```solidity
function launchDeferredAuction(DeferredAuctionParams calldata params)
    external
    nonReentrant
    returns (address auction);
```

### _deployPhase2Core


```solidity
function _deployPhase2Core(Phase2CoreParams memory params, CodeIds calldata codeIds)
    internal
    returns (Phase2Result memory out);
```

### _finalizePhase2Internal


```solidity
function _finalizePhase2Internal(Phase2FinalizeParams memory params) internal returns (Phase2Result memory out);
```

### deployPhase3Strategies

Deploy + register initial yield strategies (Charm CREATOR/USDC + Ajna lending).

Uses UniversalBytecodeStore + CREATE2 deployer to avoid embedding initcode in this batcher.


```solidity
function deployPhase3Strategies(Phase3Params calldata params, StrategyCodeIds calldata codeIds)
    external
    nonReentrant
    returns (Phase3Result memory out);
```

### _requireOwner


```solidity
function _requireOwner(address owner) internal view;
```

### _pullCreatorTokens


```solidity
function _pullCreatorTokens(address creatorToken, address owner, uint256 amount) internal;
```

### _permitAndPull


```solidity
function _permitAndPull(address creatorToken, address owner, uint256 amount, PermitData calldata permit) internal;
```

### _requirePhase1CodeIds


```solidity
function _requirePhase1CodeIds(CodeIds calldata codeIds) internal pure;
```

### _requirePhase2CodeIds


```solidity
function _requirePhase2CodeIds(CodeIds calldata codeIds) internal pure;
```

### _deriveBaseSalt


```solidity
function _deriveBaseSalt(address creatorToken, address owner, string memory version)
    internal
    view
    returns (bytes32);
```

### _saltFor


```solidity
function _saltFor(bytes32 baseSalt, string memory label) internal pure returns (bytes32);
```

### _deriveShareOftSalt


```solidity
function _deriveShareOftSalt(address owner, string memory shareSymbolLower, string memory version)
    internal
    pure
    returns (bytes32);
```

### _defaultTickSpacingQ96


```solidity
function _defaultTickSpacingQ96(uint256 floorPriceQ96) internal pure returns (uint256);
```

### _toLower


```solidity
function _toLower(string memory input) internal pure returns (string memory);
```

### _toUpper


```solidity
function _toUpper(string memory input) internal pure returns (string memory);
```

## Events
### Phase1Deployed

```solidity
event Phase1Deployed(
    address indexed creatorToken,
    address indexed owner,
    address oftBootstrapRegistry,
    address vault,
    address wrapper,
    address shareOFT
);
```

### Phase2DeployedAndLaunched

```solidity
event Phase2DeployedAndLaunched(
    address indexed creatorToken,
    address indexed owner,
    address gaugeController,
    address ccaStrategy,
    address oracle,
    address auction
);
```

### Phase2CoreDeployed

```solidity
event Phase2CoreDeployed(
    address indexed creatorToken,
    address indexed owner,
    address gaugeController,
    address ccaStrategy,
    address oracle
);
```

### AuctionDeferred

```solidity
event AuctionDeferred(
    address indexed creatorToken,
    address indexed owner,
    address indexed shareOFT,
    address ccaStrategy,
    uint256 amount
);
```

### AuctionLaunchedDeferred

```solidity
event AuctionLaunchedDeferred(
    address indexed creatorToken,
    address indexed owner,
    address indexed shareOFT,
    address ccaStrategy,
    uint256 amount,
    address auction
);
```

### Phase3StrategiesDeployed

```solidity
event Phase3StrategiesDeployed(
    address indexed creatorToken,
    address indexed owner,
    address indexed vault,
    address v3Pool,
    address charmVault,
    address charmStrategy,
    address ajnaStrategy,
    uint256 charmWeightBps,
    uint256 ajnaWeightBps
);
```

### CreatorShareVestingDeployed

```solidity
event CreatorShareVestingDeployed(
    address indexed shareOFT,
    address indexed beneficiary,
    address vesting,
    uint256 amount,
    uint64 startTimestamp,
    uint64 durationSeconds
);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### InvalidPercent

```solidity
error InvalidPercent();
```

### InvalidCodeId

```solidity
error InvalidCodeId();
```

### NotOwner

```solidity
error NotOwner();
```

### Phase1Missing

```solidity
error Phase1Missing();
```

### InvalidWeight

```solidity
error InvalidWeight();
```

### V3PoolMissing

```solidity
error V3PoolMissing();
```

### MissingInitialSqrtPriceX96

```solidity
error MissingInitialSqrtPriceX96();
```

### AuctionAlreadyPending

```solidity
error AuctionAlreadyPending();
```

### NoPendingAuction

```solidity
error NoPendingAuction();
```

### AuctionShareOFTMismatch

```solidity
error AuctionShareOFTMismatch();
```

### AuctionAmountMismatch

```solidity
error AuctionAmountMismatch();
```

### Phase2Missing

```solidity
error Phase2Missing();
```

## Structs
### CodeIds

```solidity
struct CodeIds {
    bytes32 vault;
    bytes32 wrapper;
    bytes32 shareOFT;
    bytes32 gauge;
    bytes32 cca;
    bytes32 oracle;
    bytes32 oftBootstrap;
}
```

### Phase1Params

```solidity
struct Phase1Params {
    address creatorToken;
    address owner;
    string vaultName;
    string vaultSymbol;
    string shareName;
    string shareSymbol;
    string version;
}
```

### Phase2Params

```solidity
struct Phase2Params {
    address creatorToken;
    address owner;
    address creatorTreasury;
    address payoutRecipient;
    address vault;
    address wrapper;
    address shareOFT;
    string shareSymbol;
    string version;
    uint256 depositAmount;
    uint8 auctionPercent;
    uint128 requiredRaise;
    uint256 floorPriceQ96;
    bytes auctionSteps;
}
```

### Phase2CoreParams

```solidity
struct Phase2CoreParams {
    address creatorToken;
    address owner;
    address creatorTreasury;
    address payoutRecipient;
    address vault;
    address wrapper;
    address shareOFT;
    string shareSymbol;
    string version;
    uint256 floorPriceQ96;
}
```

### Phase2FinalizeParams

```solidity
struct Phase2FinalizeParams {
    address creatorToken;
    address owner;
    address vault;
    address wrapper;
    address shareOFT;
    address gaugeController;
    address ccaStrategy;
    address oracle;
    string version;
    uint256 depositAmount;
    uint8 auctionPercent;
    uint128 requiredRaise;
    uint256 floorPriceQ96;
    bytes auctionSteps;
}
```

### PermitData

```solidity
struct PermitData {
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
}
```

### Phase1Result

```solidity
struct Phase1Result {
    address oftBootstrapRegistry;
    address vault;
    address wrapper;
    address shareOFT;
}
```

### Phase2Result

```solidity
struct Phase2Result {
    address gaugeController;
    address ccaStrategy;
    address oracle;
    address auction;
}
```

### PendingAuction

```solidity
struct PendingAuction {
    address shareOFT;
    address ccaStrategy;
    uint256 amount;
}
```

### DeferredAuctionParams

```solidity
struct DeferredAuctionParams {
    address creatorToken;
    address owner;
    address shareOFT;
    string version;
    uint256 floorPriceQ96;
    uint128 requiredRaise;
    bytes auctionSteps;
}
```

### StrategyCodeIds

```solidity
struct StrategyCodeIds {
    bytes32 charmAlphaVaultDeploy;
    bytes32 creatorCharmStrategy;
    bytes32 ajnaStrategy;
}
```

### Phase3Params

```solidity
struct Phase3Params {
    address creatorToken;
    address owner;
    address vault;
    string version;
    // If the CREATOR/USDC V3 pool does not exist yet, we can create it with this initial price.
    // If the pool already exists, you can pass 0 and we'll skip initialization.
    uint160 initialSqrtPriceX96;
    string charmVaultName;
    string charmVaultSymbol;
    uint256 charmWeightBps;
    uint256 ajnaWeightBps;
    bool enableAutoAllocate;
}
```

### Phase3Result

```solidity
struct Phase3Result {
    address v3Pool;
    address charmVault;
    address charmStrategy;
    address ajnaStrategy;
}
```

