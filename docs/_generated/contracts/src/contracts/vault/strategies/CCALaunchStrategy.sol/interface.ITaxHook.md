# ITaxHook
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/vault/strategies/CCALaunchStrategy.sol)

**Title:**
ITaxHook

Interface for the configurable tax hook

Hook address is chain-dependent; configure via `setTaxHook`.


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

