# ITaxHook
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/vault/strategies/CCALaunchStrategy.sol)

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

