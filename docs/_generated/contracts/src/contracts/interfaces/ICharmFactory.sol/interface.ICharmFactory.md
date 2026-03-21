# ICharmFactory
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/interfaces/ICharmFactory.sol)

**Title:**
ICharmFactory

Interface for Charm Finance's Alpha Vault Factory

Base: 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa
Vaults created via this factory appear on alpha.charm.fi UI


## Functions
### createVault

Create a new Alpha Vault


```solidity
function createVault(VaultParams calldata params) external returns (address vault);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`params`|`VaultParams`|Vault initialization parameters|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`vault`|`address`|Address of the created vault|


### vaults

Get vault by index


```solidity
function vaults(uint256 index) external view returns (address);
```

### numVaults

Total number of vaults created


```solidity
function numVaults() external view returns (uint256);
```

### governance

Charm governance address


```solidity
function governance() external view returns (address);
```

## Structs
### VaultParams

```solidity
struct VaultParams {
    address pool;
    address manager;
    uint24 managerFee;
    address rebalanceDelegate;
    uint256 maxTotalSupply;
    int24 baseThreshold;
    int24 limitThreshold;
    uint24 fullRangeWeight;
    uint32 period;
    int24 minTickMove;
    int24 maxTwapDeviation;
    uint32 twapDuration;
    string name;
    string symbol;
}
```

