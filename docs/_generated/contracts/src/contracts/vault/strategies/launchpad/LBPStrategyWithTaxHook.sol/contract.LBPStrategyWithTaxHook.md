# LBPStrategyWithTaxHook
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/vault/strategies/launchpad/LBPStrategyWithTaxHook.sol)

**Inherits:**
[ILBPStrategyBasicCompat](/contracts/vault/strategies/launchpad/LBPStrategyWithTaxHook.sol/interface.ILBPStrategyBasicCompat.md)

**Title:**
LBPStrategyWithTaxHook

Fork of Uniswap Liquidity Launcher LBPStrategyBasic that creates the v4 pool
with an external hook address (e.g. the existing Base tax hook).

Hooks are immutable per pool key. To use a non-strategy hook, the pool must be initialized with it.


## State Variables
### token
The token that is being distributed


```solidity
address public immutable token
```


### currency
The currency that the auction raised funds in


```solidity
address public immutable currency
```


### poolLPFee
The LP fee that the v4 pool will use expressed in hundredths of a bip (1e6 = 100%)


```solidity
uint24 public immutable poolLPFee
```


### poolTickSpacing
The tick spacing that the v4 pool will use


```solidity
int24 public immutable poolTickSpacing
```


### totalSupply
The supply of the token that was sent to this contract to be distributed


```solidity
uint128 public immutable totalSupply
```


### reserveSupply
The remaining supply of the token that was not sent to the auction


```solidity
uint128 public immutable reserveSupply
```


### positionRecipient
The address that will receive the position


```solidity
address public immutable positionRecipient
```


### migrationBlock
The block number at which migration is allowed


```solidity
uint64 public immutable migrationBlock
```


### auctionFactory
The auction factory that will be used to create the auction


```solidity
address public immutable auctionFactory
```


### operator
The operator that can sweep currency and tokens from the pool after sweepBlock


```solidity
address public immutable operator
```


### sweepBlock
The block number at which the operator can sweep currency and tokens from the pool


```solidity
uint64 public immutable sweepBlock
```


### createOneSidedTokenPosition
Whether to create a one sided position in the token after the full range position


```solidity
bool public immutable createOneSidedTokenPosition
```


### createOneSidedCurrencyPosition
Whether to create a one sided position in the currency after the full range position


```solidity
bool public immutable createOneSidedCurrencyPosition
```


### poolManager
PoolManager used to initialize the v4 pool


```solidity
IPoolManager public immutable poolManager
```


### positionManager
The position manager that will be used to create the position


```solidity
IPositionManager public immutable positionManager
```


### taxHook
External hook used for the v4 pool (e.g. Base tax hook)


```solidity
address public immutable taxHook
```


### auction
The auction that will be used to create the auction


```solidity
IContinuousClearingAuction public auction
```


### auctionParameters
Encoded AuctionParameters (passed to the CCA factory)


```solidity
bytes public auctionParameters
```


## Functions
### constructor


```solidity
constructor(
    address _token,
    uint128 _totalSupply,
    MigratorParameters memory _migratorParams,
    bytes memory _auctionParams,
    IPositionManager _positionManager,
    IPoolManager _poolManager,
    address _taxHook
) ;
```

### getPoolToken

Gets the address of the token that will be used to create the pool


```solidity
function getPoolToken() internal view virtual returns (address);
```

### onTokensReceived

Notify a distribution contract that it has received the tokens to distribute


```solidity
function onTokensReceived() external;
```

### migrate


```solidity
function migrate() external;
```

### sweepToken


```solidity
function sweepToken() external;
```

### sweepCurrency


```solidity
function sweepCurrency() external;
```

### _validateMigratorParams


```solidity
function _validateMigratorParams(uint128 _totalSupply, MigratorParameters memory migratorParams) private pure;
```

### _validateAuctionParams


```solidity
function _validateAuctionParams(bytes memory auctionParams, MigratorParameters memory migratorParams) private pure;
```

### _validateMigration


```solidity
function _validateMigration() private;
```

### _prepareMigrationData


```solidity
function _prepareMigrationData() private view returns (MigrationData memory data);
```

### _initializePool


```solidity
function _initializePool(MigrationData memory data) private returns (PoolKey memory key);
```

### _createPositionPlan


```solidity
function _createPositionPlan(MigrationData memory data) private view returns (bytes memory, bool);
```

### _transferAssetsAndExecutePlan


```solidity
function _transferAssetsAndExecutePlan(MigrationData memory data, bytes memory plan) private;
```

### _getTokenTransferAmount


```solidity
function _getTokenTransferAmount(MigrationData memory data) private view returns (uint128);
```

### _getCurrencyTransferAmount


```solidity
function _getCurrencyTransferAmount(MigrationData memory data) private pure returns (uint128);
```

### receive

Only accept native currency transfers from the auction when currency is native.


```solidity
receive() external payable;
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

## Structs
### MigratorParameters

```solidity
struct MigratorParameters {
    uint64 migrationBlock;
    address currency;
    uint24 poolLPFee;
    int24 poolTickSpacing;
    uint24 tokenSplitToAuction;
    address auctionFactory;
    address positionRecipient;
    uint64 sweepBlock;
    address operator;
    bool createOneSidedTokenPosition;
    bool createOneSidedCurrencyPosition;
}
```

### MigrationData

```solidity
struct MigrationData {
    uint160 sqrtPriceX96;
    uint128 initialTokenAmount;
    uint128 initialCurrencyAmount;
    uint128 leftoverCurrency;
    uint128 liquidity;
    bool shouldCreateOneSided;
    bool hasOneSidedParams;
}
```

