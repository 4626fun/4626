# ISimpleSellTaxHook
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/utilities/messaging/CreatorShareOFT.sol)

**Title:**
ISimpleSellTaxHook

Interface for the V4 tax hook that requires token owner to configure

Hook at 0xca975B9dAF772C71161f3648437c3616E5Be0088 on Base (hub-only)


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

