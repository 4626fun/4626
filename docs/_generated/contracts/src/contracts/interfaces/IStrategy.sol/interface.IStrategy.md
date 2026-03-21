# IStrategy
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/interfaces/IStrategy.sol)

**Title:**
IStrategy

**Author:**
0xakita.eth

Interface for 4626 single-asset strategies.

Implemented by strategies used by `CreatorOVault`.


## Functions
### isActive

Check if strategy is active and ready for operations


```solidity
function isActive() external view returns (bool);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|True if strategy is active and accepting deposits|


### asset

Get the underlying asset token address


```solidity
function asset() external view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|Address of the token this strategy accepts|


### getTotalAssets

Get strategy's total value in underlying tokens


```solidity
function getTotalAssets() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Total amount of underlying tokens managed by strategy|


### deposit

Deposit tokens into the strategy


```solidity
function deposit(uint256 amount) external returns (uint256 deposited);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of underlying tokens to deposit|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`deposited`|`uint256`|Actual amount deposited (may differ due to fees/slippage)|


### withdraw

Withdraw tokens from the strategy


```solidity
function withdraw(uint256 amount) external returns (uint256 withdrawn);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of underlying tokens to withdraw|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`withdrawn`|`uint256`|Actual amount withdrawn|


### emergencyWithdraw

Emergency withdrawal - pull all funds immediately

Should bypass normal withdrawal logic for emergency situations


```solidity
function emergencyWithdraw() external returns (uint256 withdrawn);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`withdrawn`|`uint256`|Total amount withdrawn|


### harvest

Harvest any accumulated yields


```solidity
function harvest() external returns (uint256 profit);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`profit`|`uint256`|Amount of profit harvested|


### rebalance

Rebalance the strategy position if needed


```solidity
function rebalance() external;
```

## Events
### StrategyDeposit

```solidity
event StrategyDeposit(address indexed from, uint256 amount, uint256 deposited);
```

### StrategyWithdraw

```solidity
event StrategyWithdraw(address indexed to, uint256 amount, uint256 withdrawn);
```

### StrategyHarvest

```solidity
event StrategyHarvest(uint256 profit);
```

### StrategyRebalanced

```solidity
event StrategyRebalanced(uint256 newTotalAssets);
```

### EmergencyWithdraw

```solidity
event EmergencyWithdraw(address indexed to, uint256 amount);
```

