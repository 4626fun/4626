# ISimpleSellTaxHook
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/utilities/messaging/CreatorShareOFT.sol)

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

