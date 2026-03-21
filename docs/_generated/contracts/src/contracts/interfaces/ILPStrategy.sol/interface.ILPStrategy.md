# ILPStrategy
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/interfaces/ILPStrategy.sol)

**Title:**
ILPStrategy

**Author:**
0xakita.eth

Interface for LP strategy adapters.

Implemented by strategies used by `CreatorLPManager`.


## Functions
### deposit

Deposit tokens and create/add to LP position


```solidity
function deposit(uint256 creatorCoinAmount, uint256 pairedAmount) external returns (uint256 liquidity);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`creatorCoinAmount`|`uint256`|Amount of creator coin to deposit|
|`pairedAmount`|`uint256`|Amount of paired token (WETH) to deposit|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`liquidity`|`uint256`|Amount of liquidity minted/added|


### withdraw

Withdraw liquidity from position


```solidity
function withdraw(uint256 liquidity) external returns (uint256 creatorCoinAmount, uint256 pairedAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`liquidity`|`uint256`|Amount of liquidity to withdraw|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`creatorCoinAmount`|`uint256`|Amount of creator coin returned|
|`pairedAmount`|`uint256`|Amount of paired token returned|


### withdrawAll

Withdraw all liquidity from position


```solidity
function withdrawAll() external returns (uint256 creatorCoinAmount, uint256 pairedAmount);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`creatorCoinAmount`|`uint256`|Total creator coin withdrawn|
|`pairedAmount`|`uint256`|Total paired token withdrawn|


### rebalance

Rebalance the LP position

For full range: collect fees

For limit order: reposition to maintain tick offset

For concentrated: adjust tick range based on price


```solidity
function rebalance() external;
```

### getTotalValue

Get total value held in the strategy


```solidity
function getTotalValue() external view returns (uint256 creatorCoinValue, uint256 pairedValue);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`creatorCoinValue`|`uint256`|Value in creator coin terms|
|`pairedValue`|`uint256`|Value in paired token terms|


### getLiquidity

Get current liquidity in position


```solidity
function getLiquidity() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Current liquidity amount|


### isActive

Check if strategy is active


```solidity
function isActive() external view returns (bool);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|True if strategy is accepting deposits|


### strategyType

Get strategy type


```solidity
function strategyType() external pure returns (StrategyType);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`StrategyType`|The type of this strategy|


## Enums
### StrategyType

```solidity
enum StrategyType {
    FullRange,
    LimitOrder,
    Concentrated
}
```

