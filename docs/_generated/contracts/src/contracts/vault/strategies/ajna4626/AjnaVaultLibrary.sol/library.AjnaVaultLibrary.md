# AjnaVaultLibrary
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/vault/strategies/ajna4626/AjnaVaultLibrary.sol)

**Title:**
AjnaVaultLibrary

Math and validation helpers for the inner Ajna ERC-4626 vault.


## Constants
### MAX_AJNA_BUCKET_INDEX

```solidity
uint256 internal constant MAX_AJNA_BUCKET_INDEX = 7_388
```


## Functions
### validateBucketIndex


```solidity
function validateBucketIndex(uint256 bucketIndex, uint256 minBucketIndex) internal pure;
```

### ensureBufferRatio


```solidity
function ensureBufferRatio(
    uint256 totalAssets,
    uint256 currentBufferAssets,
    uint256 assetsLeavingBuffer,
    uint256 ratioBps
) internal pure;
```

### lpToAssets


```solidity
function lpToAssets(IAjnaPool pool, uint256 bucketIndex, uint256 lpAmount) internal view returns (uint256);
```

### bucketAssets


```solidity
function bucketAssets(IAjnaPool pool, uint256 bucketIndex, address lender) internal view returns (uint256 assets);
```

### burnableLp


```solidity
function burnableLp(uint256 trackedLp, uint256 requestedLp) internal pure returns (uint256);
```

## Errors
### InvalidBucketIndex

```solidity
error InvalidBucketIndex();
```

### BufferRatioViolated

```solidity
error BufferRatioViolated();
```

### InsufficientBucketLiquidity

```solidity
error InsufficientBucketLiquidity();
```

