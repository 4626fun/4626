# AlfaCreatorKeyLPFactory
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/alfaclub/AlfaCreatorKeyLPFactory.sol)

**Inherits:**
Ownable

**Title:**
AlfaCreatorKeyLPFactory

Deploys 4626-owned secondary-market LP pools for Creator Coin / AlfaClub key pairs.


## Constants
### BASE_ALFA_CLUB_FRIEND_KEY

```solidity
address public constant BASE_ALFA_CLUB_FRIEND_KEY = 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F
```


### friendKey

```solidity
address public immutable friendKey
```


### ROOM_TYPE_TRADING

```solidity
uint8 internal constant ROOM_TYPE_TRADING = 0
```


### ROOM_TYPE_SOCIAL

```solidity
uint8 internal constant ROOM_TYPE_SOCIAL = 1
```


### TRADING_FEE_BPS

```solidity
uint16 public constant TRADING_FEE_BPS = 690
```


### SOCIAL_FEE_BPS

```solidity
uint16 public constant SOCIAL_FEE_BPS = 3
```


## State Variables
### poolCreatorAllowed

```solidity
mapping(address => bool) public poolCreatorAllowed
```


### pairAllowed

```solidity
mapping(address => mapping(uint256 => bool)) public pairAllowed
```


### getPool

```solidity
mapping(address => mapping(uint256 => address)) public getPool
```


### allPools

```solidity
address[] public allPools
```


## Functions
### constructor


```solidity
constructor(address initialOwner) Ownable(initialOwner);
```

### allPoolsLength


```solidity
function allPoolsLength() external view returns (uint256);
```

### setPoolCreatorAllowed


```solidity
function setPoolCreatorAllowed(address account, bool allowed) external onlyOwner;
```

### setPairAllowed


```solidity
function setPairAllowed(address creatorCoin, uint256 tokenId, bool allowed) external onlyOwner;
```

### createPoolWithInitialLiquidity


```solidity
function createPoolWithInitialLiquidity(
    address creatorCoin,
    uint256 tokenId,
    uint256 keyAmount,
    uint256 creatorCoinAmount,
    address recipient
) external returns (address pool);
```

### _feeBpsForRoomType


```solidity
function _feeBpsForRoomType(uint256 tokenId, uint8 roomType) internal pure returns (uint16);
```

## Events
### PoolCreatorAllowedSet

```solidity
event PoolCreatorAllowedSet(address indexed account, bool allowed);
```

### PairAllowedSet

```solidity
event PairAllowedSet(address indexed creatorCoin, uint256 indexed tokenId, bool allowed);
```

### PoolCreated

```solidity
event PoolCreated(
    address indexed creatorCoin,
    uint256 indexed tokenId,
    address indexed pool,
    address creator,
    uint256 keyAmount,
    uint256 creatorCoinAmount,
    address recipient
);
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

### PoolCreatorNotAllowed

```solidity
error PoolCreatorNotAllowed(address caller);
```

### PairNotAllowed

```solidity
error PairNotAllowed(address creatorCoin, uint256 tokenId);
```

### PoolAlreadyExists

```solidity
error PoolAlreadyExists(address creatorCoin, uint256 tokenId);
```

### FriendKeyCreatorMissing

```solidity
error FriendKeyCreatorMissing(uint256 tokenId);
```

### UnsupportedRoomType

```solidity
error UnsupportedRoomType(uint256 tokenId, uint8 roomType);
```

