# ISimpleSellTaxHook
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/services/messaging/CreatorShareOFT.sol)

**Title:**
ISimpleSellTaxHook

Interface for the V4 tax hook that requires token owner to configure

Hook at 0xca975B9dAF772C71161f3648437c3616E5Be0088 on Base


## Functions
### setTaxConfig


```solidity
function setTaxConfig(
    address token_,
    address counterAsset_,
    address recipient_,
    uint256 taxRate_,
    bool counterIsEth,
    bool enabled_,
    bool lock_
) external;
```

