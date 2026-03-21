# IUniswapV3SwapCallback
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/interfaces/uniswap/IUniswapV3SwapCallback.sol)

**Title:**
Callback for IUniswapV3PoolActions#swap

**Author:**
Uniswap Labs

Any contract that calls IUniswapV3PoolActions#swap must implement this interface


## Functions
### uniswapV3SwapCallback

Called to `msg.sender` after executing a swap via IUniswapV3Pool#swap.

In the implementation you must pay the pool tokens owed for the swap.
The caller of this method must be checked to be a UniswapV3Pool deployed by the canonical UniswapV3Factory.
amount0Delta and amount1Delta can both be 0 if no tokens were swapped.


```solidity
function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount0Delta`|`int256`|The amount of token0 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token0 to the pool.|
|`amount1Delta`|`int256`|The amount of token1 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token1 to the pool.|
|`data`|`bytes`|Any data passed through by the caller via the IUniswapV3PoolActions#swap call|


