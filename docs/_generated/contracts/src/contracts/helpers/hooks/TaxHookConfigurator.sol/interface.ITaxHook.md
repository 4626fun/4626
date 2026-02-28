# ITaxHook
[Git Source](https://github.com/4626/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/helpers/hooks/TaxHookConfigurator.sol)

**Title:**
TaxHookConfigurator

**Author:**
0xakita.eth (4626)

Helper to configure the existing V4 Tax Hook for 4626

Interface for the existing Tax Hook (poolId-keyed configuration)

EXISTING TAX HOOK:
Address: 0xca975B9dAF772C71161f3648437c3616E5Be0088 (Base)
This hook is already deployed and approved on Uniswap V4!
We just need to configure it for our ■AKITA/ETH pool.

CONFIGURATION:
- Set 6.9% (690 bps) fee on swaps
- Route fees to CreatorGaugeController
- GaugeController then distributes: 50% burn, 31% lottery, 19% creator


## Functions
### setTaxConfig


```solidity
function setTaxConfig(bytes32 poolId, TaxConfig calldata config) external;
```

### getTaxConfig


```solidity
function getTaxConfig(bytes32 poolId) external view returns (TaxConfig memory);
```

### canConfigure


```solidity
function canConfigure(bytes32 poolId, address caller) external view returns (bool);
```

## Structs
### TaxConfig

```solidity
struct TaxConfig {
    uint256 buyTaxBps; // Tax on buys in basis points
    uint256 sellTaxBps; // Tax on sells in basis points
    address taxRecipient; // Where taxes go
    bool enabled; // Whether taxes are active
}
```

