# DeploymentBatcher
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/batchers/DeploymentBatcher.sol)

**Inherits:**
ReentrancyGuard

**Title:**
DeploymentBatcher

**Author:**
0xakita.eth

Multi-transaction 4626 deployment orchestrator (Phases 1–3).

We can no longer deploy the full stack in one transaction on Base due to code-deposit gas limits.
This contract splits deployment into multiple calls:
- Phase 1: deploy vault + wrapper + shareOFT + minimal wiring (no token pulls / no auction)
- Phase 2a: deploy gauge + CCA + oracle + wiring (no token pulls)
- Phase 2b: deposit + vesting + ownership transfers (plus optional deferred auction)


## State Variables
### CHARM_FACTORY
Charm Finance Alpha Vault Factory on Base.


```solidity
address public constant CHARM_FACTORY = 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa
```


### MIN_DEPOSIT
Minimum deposit amount (50M tokens, 18 decimals)


```solidity
uint256 public constant MIN_DEPOSIT = 50_000_000e18
```


### MAX_DEPOSIT
Maximum deposit amount (50M tokens, 18 decimals)


```solidity
uint256 public constant MAX_DEPOSIT = 50_000_000e18
```


### AUCTION_PERCENT
Percentage of ■TOKENs allocated to CCA auction


```solidity
uint8 public constant AUCTION_PERCENT = 40
```


### VESTING_PERCENT
Percentage of ■TOKENs vested to the creator


```solidity
uint8 public constant VESTING_PERCENT = 40
```


### LP_RESERVE_PERCENT
Percentage of ■TOKENs reserved on strategy for LP migration


```solidity
uint8 public constant LP_RESERVE_PERCENT = 20
```


### DEFAULT_LAUNCH_DISCOUNT_BPS
Default launch discount (80% of oracle-derived reference price).


```solidity
uint16 public constant DEFAULT_LAUNCH_DISCOUNT_BPS = 8_000
```


### DEFAULT_LAUNCH_TICK_SPACING_BPS
Default launch tick spacing (1% of derived floor price).


```solidity
uint16 public constant DEFAULT_LAUNCH_TICK_SPACING_BPS = 100
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


### vaultCoreModule

```solidity
address public immutable vaultCoreModule
```


### vaultStrategiesModule

```solidity
address public immutable vaultStrategiesModule
```


### vaultAdminModule

```solidity
address public immutable vaultAdminModule
```


### pendingAuctions
Pending auction allocations keyed by creator/owner/version salt.


```solidity
mapping(bytes32 => PendingAuction) public pendingAuctions
```


### phase1SplitStates
Split phase-1 state keyed by creator/owner/version salt.


```solidity
mapping(bytes32 => Phase1SplitState) public phase1SplitStates
```


### solanaBridgeAdapter
SolanaBridgeAdapter address for bridging the Solana allocation.


```solidity
address public solanaBridgeAdapter
```


### solanaDestination
Solana deployer/multisig wallet address (bytes32 pubkey) to receive bridged tokens.


```solidity
bytes32 public solanaDestination
```


### ovaultRuntimeConfig
OVault runtime wiring used for Solana compose orchestration.


```solidity
OVaultRuntimeConfig private ovaultRuntimeConfig
```


### phase3Helper
Dedicated phase-3 execution helper to keep this contract under EIP-170 runtime limits.


```solidity
DeploymentBatcherPhase3Helper public immutable phase3Helper
```


### uniV4Helper
Dedicated UniV4 execution helper to keep this contract under EIP-170 runtime limits.


```solidity
DeploymentBatcherUniV4Helper public immutable uniV4Helper
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
    address _ajnaFactory,
    address _vaultCoreModule,
    address _vaultStrategiesModule,
    address _vaultAdminModule
) ;
```

### deployPhase1CoreWithSalt


```solidity
function deployPhase1CoreWithSalt(
    Phase1Params calldata params,
    CodeIds calldata codeIds,
    bytes32 shareOftSaltOverride
) external nonReentrant returns (Phase1Result memory out);
```

### finalizePhase1WithSalt


```solidity
function finalizePhase1WithSalt(
    Phase1Params calldata params,
    CodeIds calldata codeIds,
    bytes32 shareOftSaltOverride
) external nonReentrant returns (Phase1Result memory out);
```

### _deployPhase1CoreInternal


```solidity
function _deployPhase1CoreInternal(Phase1Params calldata params, CodeIds calldata codeIds)
    internal
    returns (Phase1Result memory out);
```

### _finalizePhase1InternalSplit


```solidity
function _finalizePhase1InternalSplit(Phase1Params calldata params, CodeIds calldata codeIds)
    internal
    returns (Phase1Result memory out);
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

### finalizePhase2WithPermit2


```solidity
function finalizePhase2WithPermit2(
    Phase2FinalizeParams calldata params,
    ISignatureTransfer.PermitTransferFrom calldata permit,
    bytes calldata signature
) external nonReentrant returns (Phase2Result memory out);
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

Deploy + register initial yield strategies (Charm + Ajna + SolanaStrategy).

Uses UniversalBytecodeStore + CREATE2 deployer to avoid embedding initcode in this batcher.


```solidity
function deployPhase3Strategies(Phase3Params calldata params, StrategyCodeIds calldata codeIds)
    external
    nonReentrant
    returns (Phase3Result memory out);
```

### deployUniV4Strategies

Deploy + configure UniV4 strategy set with approved-hook enforcement.

Deploys a hook registry + FullRange + Concentrated + LimitOrder + CreatorLPManager,
configures all pools using the same hook, then transfers ownerships.


```solidity
function deployUniV4Strategies(UniV4DeployParams calldata params, UniV4CodeIds calldata codeIds)
    external
    nonReentrant
    returns (UniV4DeploymentResult memory out);
```

### setSolanaConfig

Set Solana bridge adapter + destination configuration.

finalizePhase2 no longer bridges ShareOFT; Solana routing is handled separately.


```solidity
function setSolanaConfig(address _adapter, bytes32 _destination) external;
```

### setOVaultRuntimeConfig

Configure OVault runtime composer + Solana EID.

Enabled configs require a non-zero composer and EID.


```solidity
function setOVaultRuntimeConfig(address _hubComposer, uint32 _solanaEid, bool _enabled) external;
```

### getOVaultRuntimeConfig


```solidity
function getOVaultRuntimeConfig() external view returns (OVaultRuntimeConfig memory);
```

### _requireOwner


```solidity
function _requireOwner(address owner) internal view;
```

### _pullCreatorTokens


```solidity
function _pullCreatorTokens(address creatorToken, address owner, uint256 amount) internal;
```

### _permit2Pull


```solidity
function _permit2Pull(
    address creatorToken,
    address owner,
    uint256 amount,
    ISignatureTransfer.PermitTransferFrom calldata permit,
    bytes calldata signature
) internal;
```

### _requirePhase1CodeIds


```solidity
function _requirePhase1CodeIds(CodeIds calldata codeIds) internal pure;
```

### _requirePhase2CodeIds


```solidity
function _requirePhase2CodeIds(CodeIds calldata codeIds) internal pure;
```

### _requireUniV4CodeIds


```solidity
function _requireUniV4CodeIds(UniV4CodeIds calldata codeIds) internal pure;
```

### _phase1ParamsHash


```solidity
function _phase1ParamsHash(Phase1Params calldata params) internal pure returns (bytes32);
```

### _phase1CodeIdsHash


```solidity
function _phase1CodeIdsHash(CodeIds calldata codeIds) internal pure returns (bytes32);
```

### _deriveInitCodeHash


```solidity
function _deriveInitCodeHash(bytes32 codeId, bytes memory constructorArgs) internal view returns (bytes32);
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

### Phase1CoreDeployed

```solidity
event Phase1CoreDeployed(
    address indexed creatorToken,
    address indexed owner,
    address oftBootstrapRegistry,
    address vault,
    address wrapper,
    bytes32 shareOftSalt
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
    uint256 amount,
    uint256 lpReserveAmount
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
    address ajnaVaultAuth,
    address ajnaVault,
    address ajnaStrategy,
    address solanaStrategy,
    uint256 charmWeightBps,
    uint256 ajnaWeightBps,
    uint256 solanaWeightBps
);
```

### UniV4StrategiesDeployed

```solidity
event UniV4StrategiesDeployed(
    address indexed creatorToken,
    address indexed owner,
    address indexed vault,
    address hookRegistry,
    address fullRangeStrategy,
    address concentratedStrategy,
    address limitOrderStrategy,
    address creatorLPManager,
    address poolHook,
    address registryOwner
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

### SolanaConfigSet

```solidity
event SolanaConfigSet(address indexed adapter, bytes32 solanaDestination);
```

### OVaultRuntimeConfigSet

```solidity
event OVaultRuntimeConfigSet(address indexed hubComposer, uint32 indexed solanaEid, bool enabled);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### InvalidDepositAmount

```solidity
error InvalidDepositAmount();
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

### Phase1CoreMissing

```solidity
error Phase1CoreMissing();
```

### Phase1StateMismatch

```solidity
error Phase1StateMismatch();
```

### SaltOverrideDisabled

```solidity
error SaltOverrideDisabled();
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

### InvalidSolanaEid

```solidity
error InvalidSolanaEid();
```

### InvalidSolanaBridgeConfig

```solidity
error InvalidSolanaBridgeConfig();
```

### PermitTokenMismatch

```solidity
error PermitTokenMismatch();
```

### PermitAmountTooLow

```solidity
error PermitAmountTooLow();
```

### Phase1ShareOFTMissing

```solidity
error Phase1ShareOFTMissing();
```

### InvalidCreatorTreasury

```solidity
error InvalidCreatorTreasury(address provided);
```

### InvalidPayoutRecipient

```solidity
error InvalidPayoutRecipient();
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

### InvalidTickSpacing

```solidity
error InvalidTickSpacing();
```

### InvalidPoolCurrencies

```solidity
error InvalidPoolCurrencies();
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
    address payoutRecipient; // CreatorCoin payout recipient.
    address vault;
    address wrapper;
    address shareOFT;
    string shareSymbol;
    string version;
    uint256 depositAmount;
    uint128 requiredRaise;
    uint256 floorPriceQ96; // Ignored by strategy; launch floor is derived onchain.
    bytes auctionSteps;
}
```

### Phase2CoreParams

```solidity
struct Phase2CoreParams {
    address creatorToken;
    address owner;
    address creatorTreasury;
    address payoutRecipient; // CreatorCoin payout recipient.
    address vault;
    address wrapper;
    address shareOFT;
    string shareSymbol;
    string version;
    uint256 floorPriceQ96; // Ignored by strategy; launch floor is derived onchain.
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
    uint128 requiredRaise;
    uint256 floorPriceQ96; // Ignored by strategy; launch floor is derived onchain.
    bytes auctionSteps;
    bytes32 meteoraAlphaVault;
    IBaseSolanaBridge.Ix[] solanaIxs;
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

### Phase1SplitState

```solidity
struct Phase1SplitState {
    address oftBootstrapRegistry;
    address vault;
    address wrapper;
    address shareOFT;
    bytes32 shareOftSalt;
    bytes32 paramsHash;
    bytes32 codeIdsHash;
    bool coreDone;
    bool finalized;
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
    uint256 lpReserveAmount;
}
```

### DeferredAuctionParams

```solidity
struct DeferredAuctionParams {
    address creatorToken;
    address owner;
    address shareOFT;
    string version;
    uint256 floorPriceQ96; // Ignored by strategy; launch floor is derived onchain.
    uint128 requiredRaise;
    bytes auctionSteps;
}
```

### StrategyCodeIds

```solidity
struct StrategyCodeIds {
    bytes32 charmAlphaVaultDeploy;
    bytes32 creatorCharmStrategy;
    bytes32 ajnaVaultAuth;
    bytes32 ajnaVault;
    bytes32 erc4626StrategyAdapter;
    bytes32 solanaStrategy;
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
    string ajnaVaultName;
    string ajnaVaultSymbol;
    uint256 charmWeightBps;
    uint256 ajnaWeightBps;
    uint256 solanaWeightBps;
    uint256 ajnaBufferRatioBps;
    uint256 ajnaMinBucketIndex;
    address ajnaKeeper;
    address solanaKeeper;
    uint64 solanaMaxNavAge;
    uint16 solanaMaxNavDeltaBpsPerUpdate;
    uint16 solanaMinBaseLiquidityBps;
    address solanaBridgeAddress;
    bool enableAutoAllocate;
    // Optional override: expected Charm factory protocol fee in 1e6 precision.
    // Set to 0 to use CHARM_DEFAULT_PROTOCOL_FEE_PIPS.
    uint24 expectedCharmProtocolFeePips;
}
```

### Phase3Result

```solidity
struct Phase3Result {
    address v3Pool;
    address charmVault;
    address charmStrategy;
    address ajnaVaultAuth;
    address ajnaVault;
    address ajnaStrategy;
    address solanaStrategy;
}
```

### UniV4CodeIds

```solidity
struct UniV4CodeIds {
    bytes32 approvedV4HooksRegistry;
    bytes32 fullRangeStrategy;
    bytes32 concentratedStrategy;
    bytes32 limitOrderStrategy;
    bytes32 creatorLPManager;
}
```

### UniV4DeployParams

```solidity
struct UniV4DeployParams {
    address creatorToken;
    address pairedToken;
    address vault;
    address owner;
    string version;
    address positionManager;
    uint24 fee;
    int24 tickSpacing;
    bool creatorIsCurrency0;
    address poolHook;
    address registryOwner;
    address[] hooksToApprove;
}
```

### UniV4DeploymentResult

```solidity
struct UniV4DeploymentResult {
    address hookRegistry;
    address fullRangeStrategy;
    address concentratedStrategy;
    address limitOrderStrategy;
    address creatorLPManager;
}
```

### OVaultRuntimeConfig

```solidity
struct OVaultRuntimeConfig {
    address hubComposer;
    uint32 solanaEid;
    bool enabled;
}
```

