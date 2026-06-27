# IAmoeManager
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/lottery/zk/LotteryAmoeRouter.sol)

Manager-facing fan-out interface. The router calls this with the
`pointsBurnedAsUSD` value taken straight from the PLONK public
inputs, so the manager no longer trusts an off-chain relayer's
claim about points accounting.
Matches `CreatorLotteryManager.processAmoeEntry`'s exact signature
— when the rollout op `setAuthorizedAmoeRelayer(<router>)` runs,
the manager treats this router as the relayer.


## Functions
### processAmoeEntry


```solidity
function processAmoeEntry(address buyer, address creatorCoin, uint256 pointsBurnedAsUSD)
    external
    returns (uint256 entryId);
```

