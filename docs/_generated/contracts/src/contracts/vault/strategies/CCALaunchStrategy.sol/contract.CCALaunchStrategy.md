# CCALaunchStrategy
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/vault/strategies/CCALaunchStrategy.sol)

**Inherits:**
Ownable, ReentrancyGuard

**Title:**
CCALaunchStrategy

**Author:**
0xakita.eth

Fair launch strategy using Uniswap's Continuous Clearing Auction

USE CASES:
1. Initial ■AKITA token launch - fair price discovery
2. Creator token fundraise - no sniping, early participants rewarded
3. Periodic fee auctions - sell accumulated fees fairly

WHY CCA?
- Official Uniswap mechanism (already deployed on Base)
- Fair price discovery - no timing games
- Early participants get better prices naturally
- No MEV/sandwich attacks
- Graduates to Uniswap V4 pool automatically

CCA Factory is chain-specific; configure via `CCA_FACTORY`.


## State Variables
### UNISWAP_CCA_FACTORY_V110
Uniswap v1.1.0 CCA factory (canonical on Base/Mainnet/Unichain/Sepolia)

See https://github.com/Uniswap/continuous-clearing-auction#deployments


```solidity
address public constant UNISWAP_CCA_FACTORY_V110 = 0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5
```


### MPS
Milli-basis points constant


```solidity
uint24 public constant MPS = 1e7
```


### Q96
Q96 fixed point scalar (2^96) used by Uniswap pricing


```solidity
uint256 public constant Q96 = 2 ** 96
```


### auctionToken
Token being auctioned (e.g., ■AKITA)


```solidity
IERC20 public immutable auctionToken
```


### currency
Currency to raise (address(0) for ETH)


```solidity
address public currency
```


### ccaFactory
Uniswap CCA factory used to create auctions (upgradeable by owner)

Stored in state so we can migrate factory versions without redeploying this strategy.


```solidity
address public ccaFactory
```


### currentAuction
Current active auction (if any)


```solidity
address public currentAuction
```


### pastAuctions
Historical auctions


```solidity
address[] public pastAuctions
```


### fundsRecipient
Funds recipient (vault or treasury)


```solidity
address public fundsRecipient
```


### tokensRecipient
Unsold tokens recipient


```solidity
address public tokensRecipient
```


### oracle
Oracle to configure with V4 pool on graduation


```solidity
address public oracle
```


### poolManager
V4 PoolManager (configure via `setPoolManager`)


```solidity
IPoolManager public poolManager
```


### taxHook
Tax hook for the V4 pool (configure via `setTaxHook`)


```solidity
address public taxHook
```


### feeRecipient
Fee recipient for the tax hook (GaugeController)


```solidity
address public feeRecipient
```


### taxRateBps
Tax rate in basis points (690 = 6.9%)


```solidity
uint256 public taxRateBps = 690
```


### poolFeeTier
Fee tier for V4 pool (default 3000 = 0.3%)


```solidity
uint24 public poolFeeTier = 3000
```


### poolTickSpacing
Tick spacing for V4 pool


```solidity
int24 public poolTickSpacing = 60
```


### approvedLaunchers
Approved addresses that can launch auctions (e.g., VaultActivationBatcher)


```solidity
mapping(address => bool) public approvedLaunchers
```


### defaultDuration
Default auction duration in blocks (~1 week on Base at 2s blocks)


```solidity
uint64 public defaultDuration = 302_400
```


### defaultClaimDelay
Default claim delay after auction ends


```solidity
uint64 public defaultClaimDelay = 3600
```


### defaultTickSpacing
Default tick spacing in Q96 (recommended ~1% of floor price)

In Uniswap CCA, tickSpacing is a *price granularity* in Q96, not an ERC20/ETH amount.


```solidity
uint256 public defaultTickSpacing = (Q96 / 1000) / 100
```


### defaultFloorPrice
Default floor price in Q96

0.001 ETH per 1 token => 1 ETH buys 1000 tokens => floorPrice = 0.001 * 2^96 = Q96/1000.


```solidity
uint256 public defaultFloorPrice = Q96 / 1000
```


## Functions
### constructor

Create CCA launch strategy


```solidity
constructor(
    address _auctionToken,
    address _currency,
    address _fundsRecipient,
    address _tokensRecipient,
    address _owner
) Ownable(_owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_auctionToken`|`address`|Token to auction (e.g., ■AKITA)|
|`_currency`|`address`|Currency to raise (address(0) for ETH, or USDC/WETH)|
|`_fundsRecipient`|`address`|Where to send raised funds|
|`_tokensRecipient`|`address`|Where to send unsold tokens|
|`_owner`|`address`|Strategy owner|


### onlyApprovedOrOwner

Only owner or approved launchers can call


```solidity
modifier onlyApprovedOrOwner() ;
```

### setApprovedLauncher

Approve or revoke launcher permissions

Only owner can manage approved launchers


```solidity
function setApprovedLauncher(address launcher, bool approved) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`launcher`|`address`|Address to approve (e.g., VaultActivationBatcher)|
|`approved`|`bool`|Whether to approve or revoke|


### setCcaFactory

Update the Uniswap CCA factory address used for deployments.

Allows migrating to newer Uniswap factory deployments without redeploying this strategy.


```solidity
function setCcaFactory(address newFactory) external onlyOwner;
```

### _launchAuctionInternal

Internal shared implementation for launching an auction.
IMPORTANT: Do NOT call the external entrypoint via `this.launchAuction(...)` from within the contract.
That changes `msg.sender` (breaks auth) and also trips ReentrancyGuard (both entrypoints are nonReentrant).


```solidity
function _launchAuctionInternal(uint256 amount, uint256 floorPrice, uint128 requiredRaise)
    internal
    returns (address auction);
```

### launchAuction

Launch a new CCA auction for token distribution


```solidity
function launchAuction(uint256 amount, uint256 floorPrice, uint128 requiredRaise, bytes calldata auctionSteps)
    external
    onlyApprovedOrOwner
    nonReentrant
    returns (address auction);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of tokens to auction|
|`floorPrice`|`uint256`|Starting floor price (Q96 format)|
|`requiredRaise`|`uint128`|Minimum currency to raise for graduation|
|`auctionSteps`|`bytes`|Deprecated. Ignored in favor of strategy-enforced safe schedule.|


### launchAuctionSimple

Launch auction with default parameters


```solidity
function launchAuctionSimple(uint256 amount, uint128 requiredRaise)
    external
    onlyApprovedOrOwner
    nonReentrant
    returns (address auction);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of tokens to auction|
|`requiredRaise`|`uint128`|Minimum currency to raise|


### checkpoint

Checkpoint the current auction

Can be called by anyone, updates price discovery


```solidity
function checkpoint() external;
```

### sweepCurrency

Sweep raised currency after auction graduates

Also configures the oracle with the V4 pool if oracle is set
NOTE: Tax hook configuration must be done separately by token owner
(see getTaxHookCalldata() for the exact call to make)


```solidity
function sweepCurrency() external nonReentrant;
```

### _configureOracleV4Pool

Configure oracle with V4 pool details

Called automatically on graduation if oracle is set


```solidity
function _configureOracleV4Pool() internal;
```

### getTaxHookCalldata

Get the calldata for configuring the tax hook

Returns the exact bytes to call on the tax hook (for ERC-4337 batching)
Token owner must call: taxHook.call(getTaxHookCalldata())


```solidity
function getTaxHookCalldata() external view returns (address target, bytes memory data);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`target`|`address`|The tax hook address to call|
|`data`|`bytes`|The calldata for setTaxConfig|


### getCompleteAuctionCalldata

Get all calldata needed for "Click 2" (complete auction + configure hook)

Returns array of calls for ERC-4337 batching:
1. sweepCurrency() on this strategy
2. setTaxConfig() on the tax hook (requires token owner)


```solidity
function getCompleteAuctionCalldata() external view returns (address[] memory targets, bytes[] memory calldatas);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`targets`|`address[]`|Array of addresses to call|
|`calldatas`|`bytes[]`|Array of calldata for each call|


### configureOracleV4Pool

Manually configure oracle V4 pool (if not done on graduation)


```solidity
function configureOracleV4Pool() external onlyOwner;
```

### sweepUnsoldTokens

Sweep unsold tokens after auction ends


```solidity
function sweepUnsoldTokens() external nonReentrant;
```

### _encodeAuctionParams

Encode auction parameters for CCA factory


```solidity
function _encodeAuctionParams(
    uint256 floorPrice,
    uint128 requiredRaise,
    uint64 startBlock,
    uint64 endBlock,
    uint64 claimBlock,
    bytes memory auctionSteps
) internal view returns (bytes memory);
```

### _createLinearSteps

Create linear auction steps (sell evenly over time)


```solidity
function _createLinearSteps(uint64 duration) internal pure returns (bytes memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`duration`|`uint64`|Total duration in blocks|


### _createAcceleratingSteps

Create accelerating auction steps (sell more towards end)

Rewards early participants more


```solidity
function _createAcceleratingSteps(uint64 duration) internal pure returns (bytes memory);
```

### _createUniswapSafeDefaultSteps

Create a Uniswap-safe default schedule.

Uniswap recommends the final block sells a significant amount of tokens because
the final clearing price is used to initialize downstream liquidity.
We allocate 10% over the first half, 40% over the middle, and the remainder in the final block.


```solidity
function _createUniswapSafeDefaultSteps(uint64 duration) internal pure returns (bytes memory);
```

### setDefaultDuration

Update default auction duration


```solidity
function setDefaultDuration(uint64 _duration) external onlyOwner;
```

### setDefaultClaimDelay

Update default claim delay


```solidity
function setDefaultClaimDelay(uint64 _delay) external onlyOwner;
```

### setDefaultTickSpacing

Update default tick spacing


```solidity
function setDefaultTickSpacing(uint256 _spacing) external onlyOwner;
```

### setDefaultFloorPrice

Update default floor price


```solidity
function setDefaultFloorPrice(uint256 _price) external onlyOwner;
```

### setRecipients

Update fund recipients


```solidity
function setRecipients(address _fundsRecipient, address _tokensRecipient) external onlyOwner;
```

### setOracleConfig

Configure oracle for V4 pool setup on graduation


```solidity
function setOracleConfig(address _oracle, address _poolManager, address _taxHook, address _feeRecipient)
    external
    onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_oracle`|`address`|Oracle address to configure|
|`_poolManager`|`address`|V4 PoolManager address|
|`_taxHook`|`address`|Tax hook address for the pool|
|`_feeRecipient`|`address`|GaugeController to receive 6.9% trade fees|


### setFeeRecipient

Update fee recipient (GaugeController)


```solidity
function setFeeRecipient(address _feeRecipient) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_feeRecipient`|`address`|New fee recipient address|


### setTaxRate

Update tax rate


```solidity
function setTaxRate(uint256 _taxRateBps) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_taxRateBps`|`uint256`|Tax rate in basis points (690 = 6.9%)|


### setPoolFeeTier

Update V4 pool fee tier


```solidity
function setPoolFeeTier(uint24 _feeTier) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_feeTier`|`uint24`|Fee in hundredths of bips (3000 = 0.3%)|


### setPoolTickSpacing

Update V4 pool tick spacing


```solidity
function setPoolTickSpacing(int24 _tickSpacing) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tickSpacing`|`int24`|Tick spacing for the pool|


### getAuctionStatus

Get current auction status


```solidity
function getAuctionStatus()
    external
    view
    returns (address auction, bool isActive, bool isGraduated, uint256 clearingPrice, uint256 currencyRaised);
```

### getPastAuctions

Get all past auctions


```solidity
function getPastAuctions() external view returns (address[] memory);
```

### auctionCount

Get auction count


```solidity
function auctionCount() external view returns (uint256);
```

### emergencyWithdraw

Emergency withdraw tokens stuck in strategy


```solidity
function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner;
```

### emergencyWithdrawETH

Emergency withdraw ETH


```solidity
function emergencyWithdrawETH(address payable to) external onlyOwner;
```

### receive


```solidity
receive() external payable;
```

## Events
### AuctionCreated

```solidity
event AuctionCreated(
    address indexed auction, address indexed token, uint256 totalSupply, uint64 startBlock, uint64 endBlock
);
```

### AuctionGraduated

```solidity
event AuctionGraduated(address indexed auction, uint256 currencyRaised, uint256 finalPrice);
```

### FundsSwept

```solidity
event FundsSwept(address indexed auction, uint256 amount);
```

### TokensSwept

```solidity
event TokensSwept(address indexed auction, uint256 amount);
```

### ConfigUpdated

```solidity
event ConfigUpdated(string param, uint256 value);
```

### RecipientsUpdated

```solidity
event RecipientsUpdated(address fundsRecipient, address tokensRecipient);
```

### OracleConfigured

```solidity
event OracleConfigured(address indexed oracle, address poolManager, address hook);
```

### V4PoolConfigured

```solidity
event V4PoolConfigured(address indexed oracle, address token0, address token1);
```

### TaxHookConfigured

```solidity
event TaxHookConfigured(address indexed token, address indexed recipient, uint256 taxRate);
```

### LauncherApproved

```solidity
event LauncherApproved(address indexed launcher, bool approved);
```

### CcaFactoryUpdated

```solidity
event CcaFactoryUpdated(address indexed oldFactory, address indexed newFactory);
```

## Errors
### AuctionAlreadyActive

```solidity
error AuctionAlreadyActive();
```

### NoActiveAuction

```solidity
error NoActiveAuction();
```

### AuctionNotGraduated

```solidity
error AuctionNotGraduated();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### ZeroAmount

```solidity
error ZeroAmount();
```

### InvalidConfig

```solidity
error InvalidConfig();
```

### Unauthorized

```solidity
error Unauthorized();
```

