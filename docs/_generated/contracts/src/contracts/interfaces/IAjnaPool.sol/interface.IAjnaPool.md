# IAjnaPool
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/interfaces/IAjnaPool.sol)

**Title:**
IAjnaPool

**Author:**
Ajna Finance

Interface for Ajna ERC20 lending pools.

Used by Ajna strategy adapters.


## Functions
### addQuoteToken

Add quote tokens to a lending bucket


```solidity
function addQuoteToken(uint256 amount, uint256 index, uint256 expiry)
    external
    returns (uint256 bucketLP, uint256 addedAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of quote tokens to add|
|`index`|`uint256`|Bucket index (price point)|
|`expiry`|`uint256`|Expiration timestamp for the transaction|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`bucketLP`|`uint256`|The amount of LP tokens received|
|`addedAmount`|`uint256`|The actual amount of tokens added|


### removeQuoteToken

Remove quote tokens from a lending bucket


```solidity
function removeQuoteToken(uint256 amount, uint256 index)
    external
    returns (uint256 removedAmount, uint256 redeemedLP);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of LP tokens to burn|
|`index`|`uint256`|Bucket index|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`removedAmount`|`uint256`|The amount of quote tokens removed|
|`redeemedLP`|`uint256`|The amount of LP tokens burned|


### moveQuoteToken

Move quote tokens between buckets


```solidity
function moveQuoteToken(uint256 maxAmount, uint256 fromIndex, uint256 toIndex, uint256 expiry)
    external
    returns (uint256 fromBucketLP, uint256 toBucketLP, uint256 movedAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`maxAmount`|`uint256`|Maximum amount of LP to move|
|`fromIndex`|`uint256`|Source bucket index|
|`toIndex`|`uint256`|Destination bucket index|
|`expiry`|`uint256`|Expiration timestamp|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`fromBucketLP`|`uint256`|LP tokens moved from source|
|`toBucketLP`|`uint256`|LP tokens received in destination|
|`movedAmount`|`uint256`|Amount of quote tokens moved|


### lenderInfo

Get lender info for a specific bucket


```solidity
function lenderInfo(uint256 index, address lender) external view returns (uint256 lpBalance, uint256 depositTime);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`index`|`uint256`|Bucket index|
|`lender`|`address`|Lender address|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`lpBalance`|`uint256`|LP token balance in bucket|
|`depositTime`|`uint256`|Timestamp of last deposit|


### bucketInfo

Get bucket info


```solidity
function bucketInfo(uint256 index)
    external
    view
    returns (uint256 lpBalance, uint256 collateral, uint256 bankruptcyTime, uint256 deposit, uint256 scale);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`index`|`uint256`|Bucket index|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`lpBalance`|`uint256`|Total LP in bucket|
|`collateral`|`uint256`|Total collateral in bucket|
|`bankruptcyTime`|`uint256`|Bankruptcy timestamp|
|`deposit`|`uint256`|Total quote tokens deposited|
|`scale`|`uint256`|Scaling factor|


### quoteTokenAddress

Get the pool's quote token address


```solidity
function quoteTokenAddress() external view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|Quote token address|


### collateralAddress

Get the pool's collateral token address


```solidity
function collateralAddress() external view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|Collateral token address|


### poolUtilization

Get pool utilization rate


```solidity
function poolUtilization() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Utilization in WAD (1e18 = 100%)|


### interestRate

Get current pool interest rate


```solidity
function interestRate() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Interest rate in WAD (1e18 = 100% per year)|


