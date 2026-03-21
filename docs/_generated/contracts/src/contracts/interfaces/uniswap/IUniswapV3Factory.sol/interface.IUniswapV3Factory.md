# IUniswapV3Factory
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/interfaces/uniswap/IUniswapV3Factory.sol)

**Title:**
The interface for the Uniswap V3 Factory

**Author:**
Uniswap Labs

The Uniswap V3 Factory facilitates creation of Uniswap V3 pools and control over the protocol fees


## Functions
### getPool

Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist

tokenA and tokenB may be passed in either order


```solidity
function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenA`|`address`|The contract address of either token0 or token1|
|`tokenB`|`address`|The contract address of the other token|
|`fee`|`uint24`|The fee collected upon every swap in the pool, denominated in hundredths of a bip|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`pool`|`address`|The pool address|


### createPool

Creates a pool for the given two tokens and fee

tokenA and tokenB may be passed in either order. tickSpacing is retrieved from the fee. The call will revert if the pool already exists, the fee is invalid, or the token arguments are invalid.


```solidity
function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenA`|`address`|One of the two tokens in the desired pool|
|`tokenB`|`address`|The other of the two tokens in the desired pool|
|`fee`|`uint24`|The desired fee for the pool|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`pool`|`address`|The address of the newly created pool|


