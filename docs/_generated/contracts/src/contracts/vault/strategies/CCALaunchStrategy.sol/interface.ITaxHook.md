# ITaxHook
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/vault/strategies/CCALaunchStrategy.sol)

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

