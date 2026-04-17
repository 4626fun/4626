# AjnaERC4626Vault
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/strategies/ajna4626/AjnaERC4626Vault.sol)

**Inherits:**
ERC4626, ReentrancyGuard

**Title:**
AjnaERC4626Vault

Inner ERC-4626 vault that manages an idle buffer plus Ajna quote-token
bucket positions.

This vault is intended to sit behind `ERC4626StrategyAdapter`, with
`CreatorOVault` remaining the public product vault.


## State Variables
### MAX_BUCKETS

```solidity
uint256 public constant MAX_BUCKETS = 50
```


### AJNA_POOL

```solidity
IAjnaPool public immutable AJNA_POOL
```


### AUTH

```solidity
AjnaVaultAuth public immutable AUTH
```


### BUFFER

```solidity
AjnaVaultBuffer public immutable BUFFER
```


### ASSET_TOKEN

```solidity
IERC20 public immutable ASSET_TOKEN
```


### _buckets

```solidity
uint256[] private _buckets
```


### _bucketIndexes

```solidity
mapping(uint256 => uint256) private _bucketIndexes
```


### bucketLp

```solidity
mapping(uint256 => uint256) public bucketLp
```


## Functions
### notPaused


```solidity
modifier notPaused() ;
```

### onlyAdapterAuthorized


```solidity
modifier onlyAdapterAuthorized() ;
```

### constructor


```solidity
constructor(address pool_, IERC20 asset_, string memory name_, string memory symbol_, AjnaVaultAuth auth_)
    ERC20(name_, symbol_)
    ERC4626(asset_);
```

### totalAssets


```solidity
function totalAssets() public view override returns (uint256 assets);
```

### maxDeposit


```solidity
function maxDeposit(address) public view override returns (uint256);
```

### maxMint


```solidity
function maxMint(address receiver) public view override returns (uint256);
```

### maxWithdraw

Returns the maximum assets withdrawable by `owner` from the idle buffer only.

FIX: F-19 — ERC-4626 deviation: this intentionally understates available assets
because bucket LP positions require an on-chain Ajna pool interaction to liquidate.
Off-chain integrators should query bucket positions separately for total availability.


```solidity
function maxWithdraw(address owner) public view override returns (uint256);
```

### maxRedeem

Returns the maximum shares redeemable by `owner` backed by idle buffer only.

FIX: F-19 — see maxWithdraw; same ERC-4626 deviation applies.


```solidity
function maxRedeem(address owner) public view override returns (uint256);
```

### previewDeposit


```solidity
function previewDeposit(uint256 assets) public view override returns (uint256);
```

### previewMint


```solidity
function previewMint(uint256 shares) public view override returns (uint256);
```

### previewWithdraw


```solidity
function previewWithdraw(uint256 assets) public view override returns (uint256);
```

### previewRedeem


```solidity
function previewRedeem(uint256 shares) public view override returns (uint256);
```

### deposit


```solidity
function deposit(uint256 assets, address receiver)
    public
    override
    onlyAdapterAuthorized
    notPaused
    nonReentrant
    returns (uint256 shares);
```

### mint


```solidity
function mint(uint256 shares, address receiver)
    public
    override
    onlyAdapterAuthorized
    notPaused
    nonReentrant
    returns (uint256 assetsIn);
```

### withdraw


```solidity
function withdraw(uint256 assets, address receiver, address owner)
    public
    override
    onlyAdapterAuthorized
    notPaused
    nonReentrant
    returns (uint256 shares);
```

### redeem


```solidity
function redeem(uint256 shares, address receiver, address owner)
    public
    override
    onlyAdapterAuthorized
    notPaused
    nonReentrant
    returns (uint256 assetsOut);
```

### moveFromBuffer


```solidity
function moveFromBuffer(uint256 toIndex, uint256 assets)
    external
    onlyAdapterAuthorized
    nonReentrant
    returns (uint256 movedAssets, uint256 mintedBucketLp);
```

### moveToBuffer


```solidity
function moveToBuffer(uint256 fromIndex, uint256 bucketLpAmount)
    external
    onlyAdapterAuthorized
    nonReentrant
    returns (uint256 pulledAssets, uint256 burnedBucketLp);
```

### move


```solidity
function move(uint256 fromIndex, uint256 toIndex, uint256 bucketLpAmount)
    external
    onlyAdapterAuthorized
    nonReentrant
    returns (uint256 fromBucketLp, uint256 toBucketLp);
```

### bufferAssets


```solidity
function bufferAssets() public view returns (uint256);
```

### bucketAssets


```solidity
function bucketAssets(uint256 bucketIndex) public view returns (uint256);
```

### getBuckets


```solidity
function getBuckets() external view returns (uint256[] memory);
```

### buffer


```solidity
function buffer() external view returns (address);
```

### _bufferDeposit


```solidity
function _bufferDeposit(uint256 assets) internal;
```

### _sendFee


```solidity
function _sendFee(uint256 fee) internal;
```

### _trackBucket


```solidity
function _trackBucket(uint256 bucketIndex) internal;
```

### _untrackBucketIfEmpty


```solidity
function _untrackBucketIfEmpty(uint256 bucketIndex) internal;
```

### _spendAllowanceIfNeeded


```solidity
function _spendAllowanceIfNeeded(address owner, address caller, uint256 shares) internal;
```

### _feeFromTotal


```solidity
function _feeFromTotal(uint256 assets, uint256 bps) internal pure returns (uint256);
```

### _feeFromNet


```solidity
function _feeFromNet(uint256 assets, uint256 bps) internal pure returns (uint256);
```

### _grossUp


```solidity
function _grossUp(uint256 netAssets, uint256 bps) internal pure returns (uint256);
```

### _netFromGross


```solidity
function _netFromGross(uint256 grossAssets, uint256 bps) internal pure returns (uint256);
```

## Events
### BufferMovedToBucket

```solidity
event BufferMovedToBucket(uint256 indexed bucketIndex, uint256 assets, uint256 bucketLp);
```

### BucketMovedToBuffer

```solidity
event BucketMovedToBuffer(uint256 indexed bucketIndex, uint256 assets, uint256 bucketLp);
```

### BucketMoved

```solidity
event BucketMoved(uint256 indexed fromIndex, uint256 indexed toIndex, uint256 fromBucketLp, uint256 toBucketLp);
```

### FeeCollected

```solidity
event FeeCollected(address indexed recipient, uint256 amount);
```

## Errors
### NotAuthorized

```solidity
error NotAuthorized();
```

### VaultPaused

```solidity
error VaultPaused();
```

### InvalidQuoteToken

```solidity
error InvalidQuoteToken();
```

### BufferLiquidityInsufficient

```solidity
error BufferLiquidityInsufficient();
```

### MaxBucketsReached

```solidity
error MaxBucketsReached();
```

