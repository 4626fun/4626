# ICreatorLotteryManager
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/utilities/bridge/SolanaBridgeAdapter.sol)

**Title:**
ICreatorLotteryManager

Minimal interface for the hub-only lottery manager.


## Functions
### processSwapLottery


```solidity
function processSwapLottery(address buyer, address tokenIn, uint256 amountIn)
    external
    payable
    returns (uint256 entryId);
```

