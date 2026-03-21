# IAjnaPoolFactory
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/interfaces/IAjnaPool.sol)

**Title:**
IAjnaPoolFactory

Interface for Ajna pool factory


## Functions
### deployPool

Deploy a new ERC20 pool


```solidity
function deployPool(address collateral, address quote, uint256 interestRate) external returns (address pool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`collateral`|`address`|Collateral token|
|`quote`|`address`|Quote token|
|`interestRate`|`uint256`|Initial interest rate|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`pool`|`address`|Address of deployed pool|


### ERC20_NON_SUBSET_HASH

Constant used for standard ERC20 pools (non-subset hash)


```solidity
function ERC20_NON_SUBSET_HASH() external pure returns (bytes32);
```

### deployedPools

Get deployed pool for token pair


```solidity
function deployedPools(bytes32 subsetHash, address collateral, address quote) external view returns (address pool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`subsetHash`|`bytes32`|Pool subset hash (use ERC20_NON_SUBSET_HASH for standard pools)|
|`collateral`|`address`|Collateral token|
|`quote`|`address`|Quote token|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`pool`|`address`|Pool address (address(0) if doesn't exist)|


### MIN_RATE

Minimum allowed interest rate (WAD)


```solidity
function MIN_RATE() external pure returns (uint256);
```

### MAX_RATE

Maximum allowed interest rate (WAD)


```solidity
function MAX_RATE() external pure returns (uint256);
```

### getNumberOfDeployedPools

Get number of deployed pools


```solidity
function getNumberOfDeployedPools() external view returns (uint256);
```

### deployedPoolsList

Get deployed pool by index


```solidity
function deployedPoolsList(uint256 index) external view returns (address pool);
```

