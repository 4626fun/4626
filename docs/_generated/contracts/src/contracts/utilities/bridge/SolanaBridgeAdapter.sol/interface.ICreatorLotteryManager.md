# ICreatorLotteryManager
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/utilities/bridge/SolanaBridgeAdapter.sol)

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

