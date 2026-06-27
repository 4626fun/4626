# AjnaERC4626Vault
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/vault/strategies/ajna4626/AjnaERC4626Vault.sol)

**Inherits:**
ERC4626, ReentrancyGuard

**Title:**
AjnaERC4626Vault

Inner ERC-4626 vault that manages an idle buffer plus Ajna quote-token
bucket positions.

This vault is intended to sit behind `ERC4626StrategyAdapter`, with
`CreatorOVault` remaining the public product vault.


## Constants
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


### DEVIATION_MAX_WITHDRAW_UNDER_REPORTS
Bit 0: maxWithdraw intentionally under-reports vs ERC-4626 spec.


```solidity
uint256 public constant DEVIATION_MAX_WITHDRAW_UNDER_REPORTS = 1 << 0
```


### DEVIATION_MAX_REDEEM_UNDER_REPORTS
Bit 1: maxRedeem intentionally under-reports vs ERC-4626 spec.


```solidity
uint256 public constant DEVIATION_MAX_REDEEM_UNDER_REPORTS = 1 << 1
```


## State Variables
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

### onlySwapperOrKeeper


```solidity
modifier onlySwapperOrKeeper() ;
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

### isPartialWithdrawVault

Flag signalling this vault intentionally understates
maxWithdraw / maxRedeem relative to the ERC-4626 spec.

FIX: L-08 (4626-356) — the vault deliberately returns
buffer-only capacity from maxWithdraw/maxRedeem because bucket
LP positions require an on-chain Ajna pool interaction to
liquidate. Integrators (aggregators, routers, indexers) must
read this flag and call `bucketAssets(index)` + `getBuckets()`
to recover the full withdrawable balance. Returning `true` is a
stable ABI contract: it will never silently flip to `false`
without a new contract deployment.


```solidity
function isPartialWithdrawVault() external pure returns (bool);
```

### erc4626DeviationFlags

Bitmap of ERC-4626 deviations this vault knowingly takes.

FIX: F-19 (4626-442). Stable ABI: bits only change via a new
contract deployment. Interpret against the shared convention in
`docs/contracts/ERC4626_DEVIATION_FLAGS.md`.
Bit 0 = maxWithdraw under-reports (capped at idle buffer)
Bit 1 = maxRedeem under-reports (capped at idle buffer)
Bits 2..255 = reserved for future deviations; always zero here.


```solidity
function erc4626DeviationFlags() external pure returns (uint256);
```

### hasConservativeMaxWithdraw

Human-readable convenience: true iff maxWithdraw / maxRedeem
are capped below the share-entitlement value.

Equivalent to `erc4626DeviationFlags() & 0x3 != 0` for this vault.
Kept separate from `isPartialWithdrawVault()` for semantic clarity:
`isPartialWithdrawVault` is a vault-wide behavioural flag ("partial
withdraw semantics"); `hasConservativeMaxWithdraw` is a narrower
assertion about the maxWithdraw / maxRedeem return values.


```solidity
function hasConservativeMaxWithdraw() external pure returns (bool);
```

### maxWithdraw

Returns the maximum assets withdrawable by `owner` from the idle buffer only.

FIX: F-19 — ERC-4626 deviation: this intentionally understates available assets
because bucket LP positions require an on-chain Ajna pool interaction to liquidate.
Off-chain integrators should query bucket positions separately for total availability.
Probe `erc4626DeviationFlags()` (bit 0) or `hasConservativeMaxWithdraw()` to detect
this deviation without parsing NatSpec. See also `isPartialWithdrawVault()`.


```solidity
function maxWithdraw(address owner) public view override returns (uint256);
```

### maxRedeem

Returns the maximum shares redeemable by `owner` backed by idle buffer only.

FIX: F-19 — see maxWithdraw; same ERC-4626 deviation applies. Probe
`erc4626DeviationFlags()` (bit 1) or `hasConservativeMaxWithdraw()` to detect.


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
    onlySwapperOrKeeper
    notPaused
    nonReentrant
    returns (uint256 movedAssets, uint256 mintedBucketLp);
```

### moveToBuffer


```solidity
function moveToBuffer(uint256 fromIndex, uint256 bucketLpAmount)
    external
    onlySwapperOrKeeper
    notPaused
    nonReentrant
    returns (uint256 pulledAssets, uint256 burnedBucketLp);
```

### move


```solidity
function move(uint256 fromIndex, uint256 toIndex, uint256 bucketLpAmount)
    external
    onlySwapperOrKeeper
    notPaused
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

