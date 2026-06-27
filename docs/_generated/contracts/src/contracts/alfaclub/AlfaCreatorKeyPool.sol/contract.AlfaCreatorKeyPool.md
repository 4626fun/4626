# AlfaCreatorKeyPool
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/alfaclub/AlfaCreatorKeyPool.sol)

**Inherits:**
ERC20, IERC1155Receiver, ReentrancyGuard

**Title:**
AlfaCreatorKeyPool

Constant-product AMM whose priced pair is exactly:
asset A: ERC20 `creatorCoin`
asset B: ERC1155 `friendKey` for a single `keyTokenId`
LP shares (`akLP`, this contract's own ERC20) are *receipts* representing
pro-rata ownership of the (A, B) pair only. They are not an asset in the
pair, are never priced against A or B, and never enter `getReserves()`.
All swap/mint/burn math reads from internal stored reserves
(`_creatorCoinReserve`, `_keyReserve`), never from live ERC20/ERC1155
balances. This makes the pool donation-resistant: tokens sent directly
to the contract are not credited to any LP and cannot dilute later
entrants. The same guarantee implies: anyone transferring akLP shares
to the pool itself does NOT change the priced pair — LP shares are not
a reserve asset.


## Constants
### BPS

```solidity
uint256 public constant BPS = 10_000
```


### MAX_FEE_BPS
Hard ceiling on configurable fee. Must stay below `BPS` so the
buy-side gross-up `BPS / (BPS - feeBps)` cannot divide by zero or
blow up. 10% is well above any room-type fee we expect to ship
(today: 3 bps Social, 690 bps Trading) and leaves headroom without
letting a misconfigured factory deploy a confiscatory pool.


```solidity
uint256 public constant MAX_FEE_BPS = 1_000
```


### factory

```solidity
address public immutable factory
```


### friendKey

```solidity
address public immutable friendKey
```


### creatorCoin

```solidity
address public immutable creatorCoin
```


### keyTokenId

```solidity
uint256 public immutable keyTokenId
```


### feeBps
Swap fee in basis points, fixed at construction by the factory
based on the room type of `keyTokenId` (e.g. 3 for Social,
690 for Trading). No setter — fee is part of the pool's
identity.


```solidity
uint16 public immutable feeBps
```


## State Variables
### _creatorCoinReserve

```solidity
uint256 private _creatorCoinReserve
```


### _keyReserve

```solidity
uint256 private _keyReserve
```


## Functions
### constructor


```solidity
constructor(address _friendKey, address _creatorCoin, uint256 _keyTokenId, uint16 _feeBps)
    ERC20("4626 AlfaClub Key LP", "akLP");
```

### getReserves

The two priced reserves of the AMM pair. LP shares are NOT included.


```solidity
function getReserves() public view returns (uint256 creatorCoinReserve, uint256 keyReserve);
```

### mintInitialLiquidity


```solidity
function mintInitialLiquidity(uint256 keyAmount, uint256 creatorCoinAmount, address recipient)
    external
    nonReentrant
    returns (uint256 lpShares);
```

### quoteAddLiquidity


```solidity
function quoteAddLiquidity(uint256 keyAmount) public view returns (uint256 creatorCoinAmount, uint256 lpShares);
```

### addLiquidity


```solidity
function addLiquidity(uint256 keyAmount, uint256 maxCreatorCoinAmount, uint256 minLpShares, address recipient)
    external
    nonReentrant
    returns (uint256 creatorCoinAmount, uint256 lpShares);
```

### removeLiquidity


```solidity
function removeLiquidity(uint256 lpShares, uint256 minCreatorCoinAmount, uint256 minKeyAmount, address recipient)
    external
    nonReentrant
    returns (uint256 creatorCoinAmount, uint256 keyAmount);
```

### quoteBuyKeys


```solidity
function quoteBuyKeys(uint256 keyAmount) public view returns (uint256 creatorCoinAmountIn);
```

### buyKeys


```solidity
function buyKeys(uint256 keyAmount, uint256 maxCreatorCoinAmount, address recipient)
    external
    nonReentrant
    returns (uint256 creatorCoinAmountIn);
```

### quoteSellKeys


```solidity
function quoteSellKeys(uint256 keyAmount) public view returns (uint256 creatorCoinAmountOut);
```

### sellKeys


```solidity
function sellKeys(uint256 keyAmount, uint256 minCreatorCoinAmount, address recipient)
    external
    nonReentrant
    returns (uint256 creatorCoinAmountOut);
```

### onERC1155Received


```solidity
function onERC1155Received(address, address, uint256 id, uint256, bytes calldata) external view returns (bytes4);
```

### onERC1155BatchReceived


```solidity
function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
    external
    pure
    returns (bytes4);
```

### supportsInterface


```solidity
function supportsInterface(bytes4 interfaceId) external pure returns (bool);
```

### _pullExactCreatorCoin


```solidity
function _pullExactCreatorCoin(address from, uint256 amount) internal;
```

### _pushExactCreatorCoin


```solidity
function _pushExactCreatorCoin(address to, uint256 amount) internal;
```

### _settleReserves

Single write-point for the pair reserves. Every state-changing
pool action ends here, and only here. Donations bypass it by
construction.


```solidity
function _settleReserves(uint256 creatorCoinReserve, uint256 keyReserve) internal;
```

### _ceilDiv


```solidity
function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256);
```

### _sqrt


```solidity
function _sqrt(uint256 y) internal pure returns (uint256 z);
```

## Events
### LiquidityAdded

```solidity
event LiquidityAdded(
    address indexed provider,
    address indexed recipient,
    uint256 keyAmount,
    uint256 creatorCoinAmount,
    uint256 lpShares
);
```

### LiquidityRemoved

```solidity
event LiquidityRemoved(
    address indexed provider,
    address indexed recipient,
    uint256 keyAmount,
    uint256 creatorCoinAmount,
    uint256 lpShares
);
```

### KeysBought

```solidity
event KeysBought(address indexed buyer, address indexed recipient, uint256 keyAmount, uint256 creatorCoinAmountIn);
```

### KeysSold

```solidity
event KeysSold(address indexed seller, address indexed recipient, uint256 keyAmount, uint256 creatorCoinAmountOut);
```

### Sync

```solidity
event Sync(uint256 creatorCoinReserve, uint256 keyReserve);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### ZeroAmount

```solidity
error ZeroAmount();
```

### NotFactory

```solidity
error NotFactory();
```

### AlreadyInitialized

```solidity
error AlreadyInitialized();
```

### InsufficientLiquidityMinted

```solidity
error InsufficientLiquidityMinted();
```

### InsufficientReserves

```solidity
error InsufficientReserves();
```

### SlippageExceeded

```solidity
error SlippageExceeded();
```

### WrongFriendKey

```solidity
error WrongFriendKey();
```

### WrongTokenId

```solidity
error WrongTokenId(uint256 tokenId);
```

### BatchTransfersUnsupported

```solidity
error BatchTransfersUnsupported();
```

### FeeOnTransferUnsupported

```solidity
error FeeOnTransferUnsupported();
```

### FeeBpsTooHigh

```solidity
error FeeBpsTooHigh(uint256 feeBps);
```

