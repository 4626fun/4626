# ICreatorLotteryManager
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/utilities/bridge/SolanaBridgeAdapter.sol)

**Title:**
ICreatorLotteryManager

Minimal interface for the hub-only lottery manager.


## Functions
### processSwapLottery


```solidity
function processSwapLottery(address buyer, address tokenIn, uint256 amountIn, uint256 buyerCurrentShareBalance)
    external
    payable
    returns (uint256 entryId);
```

