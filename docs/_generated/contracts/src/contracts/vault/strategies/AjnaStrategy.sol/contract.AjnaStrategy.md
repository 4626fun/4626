# AjnaStrategy
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/vault/strategies/AjnaStrategy.sol)

**Inherits:**
[IStrategy](/contracts/interfaces/IStrategy.sol/interface.IStrategy.md), Ownable, ReentrancyGuard

**Title:**
AjnaStrategy

**Author:**
0xakita.eth

Yield strategy for Creator Coins via Ajna permissionless lending

LENDS the vault's creator tokens as the Ajna pool QUOTE TOKEN.
Borrowers post collateral (e.g., USDC) and borrow the creator token (quote).
Ajna is permissionless - any token can be used without governance approval.
This strategy creates/uses a creator token lending pool where users can:
- Lend tokens (what we do) and earn interest
- Borrow tokens using collateral
Yield Source: Interest paid by borrowers


## State Variables
### vault
CreatorOVault that owns this strategy


```solidity
address public immutable vault
```


### CREATOR_COIN
Creator token (AKITA, etc.)


```solidity
IERC20 public immutable CREATOR_COIN
```


### ajnaPool
Ajna pool for creator token lending


```solidity
address public ajnaPool
```


### ajnaFactory
Ajna ERC20 pool factory


```solidity
address public ajnaFactory
```


### collateralToken
Collateral token for the Ajna pool (e.g., USDC, WETH)

Borrowers post this collateral to borrow the creator token (quote).


```solidity
address public collateralToken
```


### interestRateWad
Ajna pool interest rate (WAD) used when deploying a new pool.

Ajna factory bounds are [MIN_RATE, MAX_RATE] (on Base currently 1%..10%).


```solidity
uint256 public immutable interestRateWad
```


### ajnaSubsetHash
Ajna pool subset hash used for standard ERC20 pools.


```solidity
bytes32 public immutable ajnaSubsetHash
```


### _isActive
Strategy active status


```solidity
bool private _isActive
```


### lastHarvest
Last harvest timestamp


```solidity
uint256 public lastHarvest
```


### strategyName
Strategy name


```solidity
string public strategyName
```


### bucketIndex
Bucket index for Ajna lending (price point)

Ajna uses "Fenwick indices" from 1..7388 (0 is invalid for add/move).
Index 4156 corresponds to price = 1.0 (quote per collateral, WAD).
Lower index => higher price; higher index => lower price.


```solidity
uint256 public bucketIndex
```


### idleBufferBps
Target % of total strategy assets to keep idle in the strategy (basis points).

Inspired by Ajna's buffered ERC-4626 vault pattern, but implemented as a simple
best-effort idle buffer inside the strategy (no separate Buffer contract).
Keeping some idle reduces the chance we need to touch Ajna during withdrawals.


```solidity
uint256 public idleBufferBps = 1000
```


## Functions
### onlyVault


```solidity
modifier onlyVault() ;
```

### whenActive


```solidity
modifier whenActive() ;
```

### constructor

Bucket index defaults to 4156 (price = 1.0 quote per collateral, WAD).
After deployment, call setBucketIndex() to adjust based on market price
or use moveToBucket() to rebalance existing positions.


```solidity
constructor(address _vault, address _creatorCoin, address _ajnaFactory, address _collateralToken, address _owner)
    Ownable(_owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vault`|`address`|The vault that owns this strategy|
|`_creatorCoin`|`address`|The creator token to lend|
|`_ajnaFactory`|`address`|The Ajna ERC20 pool factory|
|`_collateralToken`|`address`|The collateral token for the pool (e.g., USDC, WETH)|
|`_owner`|`address`|The owner of this strategy|


### _initializeAjnaPool


```solidity
function _initializeAjnaPool() internal;
```

### deposit

Deposit creator tokens into Ajna lending pool

Only callable by vault


```solidity
function deposit(uint256 amount) external override onlyVault whenActive nonReentrant returns (uint256 deployed);
```

### withdraw

Withdraw creator tokens from Ajna lending pool

Only callable by vault


```solidity
function withdraw(uint256 amount) external override onlyVault nonReentrant returns (uint256 received);
```

### harvest

Harvest yield from Ajna pool


```solidity
function harvest() external override onlyVault returns (uint256 yieldAmount);
```

### rebalance

Rebalance strategy positions


```solidity
function rebalance() external override onlyVault;
```

### emergencyWithdraw

Emergency withdraw all assets


```solidity
function emergencyWithdraw() external override onlyVault returns (uint256 amount);
```

### _depositToAjnaExternal

Deploy creator tokens to Ajna pool as lender

Ajna uses a bucket-based system for lending


```solidity
function _depositToAjnaExternal(uint256 amount) external;
```

### _depositToAjna


```solidity
function _depositToAjna(uint256 amount) internal;
```

### _withdrawFromAjna

Withdraw creator tokens from Ajna pool


```solidity
function _withdrawFromAjna(uint256 amount) internal returns (uint256);
```

### _getAjnaQuoteBalance

Get current creator token balance in Ajna (includes interest)


```solidity
function _getAjnaQuoteBalance() internal view returns (uint256);
```

### asset


```solidity
function asset() external view override returns (address);
```

### getTotalAssets


```solidity
function getTotalAssets() public view override returns (uint256);
```

### isActive


```solidity
function isActive() external view override returns (bool);
```

### pendingYield


```solidity
function pendingYield() external view returns (uint256);
```

### name


```solidity
function name() external view returns (string memory);
```

### yieldSource


```solidity
function yieldSource() external pure returns (string memory);
```

### estimatedAPY


```solidity
function estimatedAPY() external pure returns (uint256);
```

### setAjnaPool

Set or update the Ajna pool

Owner can deploy to a new pool if needed


```solidity
function setAjnaPool(address _pool) external onlyOwner;
```

### setBucketIndex

Set the bucket index for lending

Ajna bucket indices are Fenwick indices.
Lower index => higher price; higher index => lower price.
Index 4156 corresponds to price = 1.0 (quote per collateral, WAD).


```solidity
function setBucketIndex(uint256 _index) external onlyOwner;
```

### moveToBucket

Move liquidity to a different bucket

Useful for rebalancing or adjusting to market conditions


```solidity
function moveToBucket(uint256 newIndex, uint256 lpAmount) external onlyOwner;
```

### initializeApprovals

Initialize approvals for Ajna pool


```solidity
function initializeApprovals() external onlyOwner;
```

### setActive

Pause/unpause strategy


```solidity
function setActive(bool active) external onlyOwner;
```

### setIdleBufferBps

Set the strategy's idle buffer target.

0 = fully deploy to Ajna (previous behavior). 10_000 = keep everything idle.


```solidity
function setIdleBufferBps(uint256 newBps) external onlyOwner;
```

### rescueTokens

Rescue stuck tokens (not creator token when active)


```solidity
function rescueTokens(address token, uint256 amount, address to) external onlyOwner;
```

## Events
### StrategyDeposit

```solidity
event StrategyDeposit(uint256 amount, uint256 shares);
```

### StrategyWithdraw

```solidity
event StrategyWithdraw(uint256 amount, uint256 shares);
```

### YieldHarvested

```solidity
event YieldHarvested(uint256 amount, uint256 timestamp);
```

### StrategyRebalanced

```solidity
event StrategyRebalanced(uint256 totalAssets, uint256 timestamp);
```

### EmergencyWithdrawn

```solidity
event EmergencyWithdrawn(uint256 amount, address recipient);
```

### IdleBufferBpsUpdated

```solidity
event IdleBufferBpsUpdated(uint256 oldBps, uint256 newBps);
```

## Errors
### OnlyVault

```solidity
error OnlyVault();
```

### StrategyPaused

```solidity
error StrategyPaused();
```

### InsufficientAssets

```solidity
error InsufficientAssets();
```

