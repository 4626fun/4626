# ICreatorLotteryManager
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/bridge/SolanaBridgeAdapter.sol)

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

