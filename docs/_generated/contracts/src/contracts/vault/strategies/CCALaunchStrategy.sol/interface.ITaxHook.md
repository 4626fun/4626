# ITaxHook
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/vault/strategies/CCALaunchStrategy.sol)

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

