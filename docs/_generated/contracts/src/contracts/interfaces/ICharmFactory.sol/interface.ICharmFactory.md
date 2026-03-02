# ICharmFactory
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/interfaces/ICharmFactory.sol)

**Title:**
ICharmFactory

Interface for Charm Finance's Alpha Vault Factory

Base: 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa
Vaults created via this factory appear on alpha.charm.fi UI


## Functions
### createVault

Create a new Alpha Vault


```solidity
function createVault(
    address pool,
    address manager,
    uint256 maxTotalSupply,
    int24 baseThreshold,
    int24 limitThreshold,
    uint24 fullRangeWeight,
    uint32 period,
    string memory name,
    string memory symbol
) external returns (address vault);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`pool`|`address`|Uniswap V3 pool address|
|`manager`|`address`|Address that will manage the vault (rebalancing)|
|`maxTotalSupply`|`uint256`|Maximum total supply of vault shares (use type(uint256).max for unlimited)|
|`baseThreshold`|`int24`|Threshold for base position in ticks|
|`limitThreshold`|`int24`|Threshold for limit position in ticks|
|`fullRangeWeight`|`uint24`|Weight for full range position (0-10000 basis points)|
|`period`|`uint32`|Rebalance period in seconds|
|`name`|`string`|ERC20 name for vault shares|
|`symbol`|`string`|ERC20 symbol for vault shares|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`vault`|`address`|Address of the created vault|


### allVaults

Get vault by index


```solidity
function allVaults(uint256 index) external view returns (address);
```

### allVaultsLength

Total number of vaults created


```solidity
function allVaultsLength() external view returns (uint256);
```

### governance

Charm governance address


```solidity
function governance() external view returns (address);
```

