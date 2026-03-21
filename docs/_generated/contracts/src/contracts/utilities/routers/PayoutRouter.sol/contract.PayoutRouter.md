# PayoutRouter
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/utilities/routers/PayoutRouter.sol)

**Inherits:**
Ownable, ReentrancyGuard

**Title:**
PayoutRouter

**Author:**
0xakita.eth

Receives creator earnings and routes value into the vault via an enforceable burn stream.

Design goals:
- Safe `payoutRecipient`: never reverts on ERC20 transfers (no hooks needed).
- Can accept ETH: wraps to WETH (kept until processed).
- Converts payout tokens → creator coin via Uniswap V3 (exactInput path), deposits into the vault,
and queues the minted vault shares into a burn stream (dripped/burned over time).
- Owner/keeper-gated processing to prevent griefing via bad swap params.

Notes:
- The burn stream MUST be configured on the vault (one-time) so it can burn its own shares.
- Vault shares minted to the burn stream are not withdrawable (no owner escape hatch), satisfying
"not trust me bro" enforceability.


## State Variables
### creatorCoin

```solidity
IERC20 public immutable creatorCoin
```


### vault

```solidity
address public immutable vault
```


### burnStream

```solidity
address public immutable burnStream
```


### swapRouter

```solidity
address public immutable swapRouter
```


### weth

```solidity
address public immutable weth
```


### keeper
Optional keeper (bot/operator) allowed to process swaps.


```solidity
address public keeper
```


### swapPathToCreator
tokenIn => Uniswap V3 encoded path ending in `creatorCoin`.

Path encoding: tokenIn (20) + fee (3) + tokenMid (20) [+ fee (3) + tokenOut (20) ...]


```solidity
mapping(address => bytes) public swapPathToCreator
```


## Functions
### onlyOwnerOrKeeper


```solidity
modifier onlyOwnerOrKeeper() ;
```

### constructor


```solidity
constructor(
    address _creatorCoin,
    address _vault,
    address _burnStream,
    address _owner,
    address _swapRouter,
    address _weth
) Ownable(_owner);
```

### receive


```solidity
receive() external payable;
```

### setKeeper


```solidity
function setKeeper(address newKeeper) external onlyOwner;
```

### setSwapPath

Set the Uniswap V3 swap path for a payout token.

This also pre-approves the router to spend tokenIn.


```solidity
function setSwapPath(address tokenIn, bytes calldata path) external onlyOwner;
```

### convertAndQueue

Convert a payout token into creatorCoin and inject into the vault (PPS-only).


```solidity
function convertAndQueue(address tokenIn, uint256 amountIn, uint256 minCreatorOut)
    external
    nonReentrant
    onlyOwnerOrKeeper
    returns (uint256 creatorOut, uint256 sharesQueued);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenIn`|`address`|Payout token to convert (e.g. USDC, WETH, ZORA). Use creatorCoin to inject directly.|
|`amountIn`|`uint256`|Amount of tokenIn to convert/inject (must already be held by this router).|
|`minCreatorOut`|`uint256`|Minimum creatorCoin received from swap (slippage guard). Ignored when tokenIn==creatorCoin.|


### emergencyWithdraw

Emergency withdraw any token (including payouts) to a safe address.

Intended for safety; does not attempt to preserve PPS semantics.


```solidity
function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner nonReentrant;
```

### _readAddress


```solidity
function _readAddress(bytes memory data, uint256 offset) internal pure returns (address addr);
```

## Events
### KeeperUpdated

```solidity
event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);
```

### SwapPathSet

```solidity
event SwapPathSet(address indexed tokenIn, bytes path);
```

### ConvertedAndQueued

```solidity
event ConvertedAndQueued(address indexed tokenIn, uint256 amountIn, uint256 creatorOut, uint256 vaultSharesQueued);
```

### EmergencyWithdraw

```solidity
event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### NotAuthorized

```solidity
error NotAuthorized();
```

### ZeroAmount

```solidity
error ZeroAmount();
```

### PathNotSet

```solidity
error PathNotSet(address tokenIn);
```

### InvalidPath

```solidity
error InvalidPath(address tokenIn);
```

