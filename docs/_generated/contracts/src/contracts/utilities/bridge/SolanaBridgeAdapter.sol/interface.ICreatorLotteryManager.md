# ICreatorLotteryManager
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/utilities/bridge/SolanaBridgeAdapter.sol)

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

