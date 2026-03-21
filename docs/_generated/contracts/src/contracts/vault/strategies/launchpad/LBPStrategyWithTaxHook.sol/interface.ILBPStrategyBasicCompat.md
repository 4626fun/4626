# ILBPStrategyBasicCompat
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/vault/strategies/launchpad/LBPStrategyWithTaxHook.sol)

**Inherits:**
IDistributionContract


## Functions
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

## Events
### AuctionCreated

```solidity
event AuctionCreated(address indexed auction);
```

### Migrated

```solidity
event Migrated(PoolKey indexed key, uint160 initialSqrtPriceX96);
```

### TokensSwept

```solidity
event TokensSwept(address indexed operator, uint256 amount);
```

### CurrencySwept

```solidity
event CurrencySwept(address indexed operator, uint256 amount);
```

## Errors
### InvalidSweepBlock

```solidity
error InvalidSweepBlock(uint256 sweepBlock, uint256 migrationBlock);
```

### TokenSplitTooHigh

```solidity
error TokenSplitTooHigh(uint24 tokenSplit, uint24 maxTokenSplit);
```

### InvalidTickSpacing

```solidity
error InvalidTickSpacing(int24 tickSpacing, int24 minTickSpacing, int24 maxTickSpacing);
```

### InvalidFee

```solidity
error InvalidFee(uint24 fee, uint24 maxFee);
```

### InvalidPositionRecipient

```solidity
error InvalidPositionRecipient(address positionRecipient);
```

### AuctionSupplyIsZero

```solidity
error AuctionSupplyIsZero();
```

### InvalidFundsRecipient

```solidity
error InvalidFundsRecipient(address invalidFundsRecipient, address expectedFundsRecipient);
```

### InvalidEndBlock

```solidity
error InvalidEndBlock(uint256 endBlock, uint256 migrationBlock);
```

### InvalidCurrency

```solidity
error InvalidCurrency(address actual, address expected);
```

### MigrationNotAllowed

```solidity
error MigrationNotAllowed(uint256 migrationBlock, uint256 currentBlock);
```

### CurrencyAmountTooHigh

```solidity
error CurrencyAmountTooHigh(uint256 currencyAmount, uint256 maxCurrencyAmount);
```

### NoCurrencyRaised

```solidity
error NoCurrencyRaised();
```

### InsufficientCurrency

```solidity
error InsufficientCurrency(uint256 amountNeeded, uint256 amountAvailable);
```

### SweepNotAllowed

```solidity
error SweepNotAllowed(uint256 sweepBlock, uint256 currentBlock);
```

### NotOperator

```solidity
error NotOperator(address caller, address operator);
```

### NativeCurrencyTransferNotFromAuction

```solidity
error NativeCurrencyTransferNotFromAuction(address sender, address expectedSender);
```

