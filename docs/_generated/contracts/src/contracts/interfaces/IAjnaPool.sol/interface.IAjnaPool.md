# IAjnaPool
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/interfaces/IAjnaPool.sol)

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


### drawDebt

Borrow quote token and/or pledge collateral.

Amounts use Ajna WAD precision (1e18), even for non-18-decimal tokens.


```solidity
function drawDebt(address borrowerAddress, uint256 amountToBorrow, uint256 limitIndex, uint256 collateralToPledge)
    external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`borrowerAddress`|`address`|Borrower account to mutate|
|`amountToBorrow`|`uint256`|Quote token amount to borrow (WAD)|
|`limitIndex`|`uint256`|Lower bound on tolerated LUP move|
|`collateralToPledge`|`uint256`|Collateral amount to pledge (WAD)|


### repayDebt

Repay quote token debt and optionally pull collateral.

Amounts use Ajna WAD precision (1e18), even for non-18-decimal tokens.


```solidity
function repayDebt(
    address borrowerAddress,
    uint256 maxQuoteTokenAmountToRepay,
    uint256 collateralAmountToPull,
    address recipient,
    uint256 limitIndex
) external returns (uint256 amountRepaid);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`borrowerAddress`|`address`|Borrower account to mutate|
|`maxQuoteTokenAmountToRepay`|`uint256`|Maximum quote token to repay (WAD)|
|`collateralAmountToPull`|`uint256`|Maximum collateral to pull (WAD)|
|`recipient`|`address`|Recipient of pulled collateral|
|`limitIndex`|`uint256`|Lower bound on tolerated LUP move while pulling collateral|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`amountRepaid`|`uint256`|Actual quote token repaid (WAD)|


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


### borrowerInfo

Get borrower debt and collateral state.

Values are Ajna WAD precision.


```solidity
function borrowerInfo(address borrower)
    external
    view
    returns (uint256 t0Debt, uint256 collateral, uint256 npTpRatio);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`borrower`|`address`|Borrower address|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`t0Debt`|`uint256`|Borrower t0 debt (WAD)|
|`collateral`|`uint256`|Borrower pledged collateral (WAD)|
|`npTpRatio`|`uint256`|Borrower neutral/threshold ratio (WAD)|


### inflatorInfo

Get pool inflator state used to transform t0Debt into current debt.


```solidity
function inflatorInfo() external view returns (uint256 inflator, uint256 lastUpdate);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`inflator`|`uint256`|Pool inflator (WAD)|
|`lastUpdate`|`uint256`|Timestamp of inflator update|


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


