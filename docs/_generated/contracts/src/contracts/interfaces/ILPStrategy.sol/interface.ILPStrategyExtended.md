# ILPStrategyExtended
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/interfaces/ILPStrategy.sol)

**Inherits:**
[ILPStrategy](/contracts/interfaces/ILPStrategy.sol/interface.ILPStrategy.md)

**Title:**
ILPStrategyExtended

Extended interface with additional view functions


## Functions
### getTickRange

Get the tick range for this position


```solidity
function getTickRange() external view returns (int24 lower, int24 upper);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`lower`|`int24`|Lower tick bound|
|`upper`|`int24`|Upper tick bound|


### needsRebalance

Check if rebalance is needed


```solidity
function needsRebalance() external view returns (bool);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|True if rebalance should be called|


### getAccumulatedFees

Get accumulated fees


```solidity
function getAccumulatedFees() external view returns (uint256 fees0, uint256 fees1);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`fees0`|`uint256`|Fees in token0|
|`fees1`|`uint256`|Fees in token1|


