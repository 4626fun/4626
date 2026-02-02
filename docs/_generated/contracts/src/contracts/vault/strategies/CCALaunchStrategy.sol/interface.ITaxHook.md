# ITaxHook
[Git Source](https://github.com/creatorvault/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/contracts/vault/strategies/CCALaunchStrategy.sol)

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

