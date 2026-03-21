# TaxHookConfigurator
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/hooks/TaxHookConfigurator.sol)

**Inherits:**
Ownable


## State Variables
### TAX_HOOK
The existing tax hook on Base


```solidity
address public constant TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088
```


### POOL_MANAGER
Uniswap V4 Pool Manager on Base


```solidity
address public constant POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b
```


### WETH
WETH on Base


```solidity
address public constant WETH = 0x4200000000000000000000000000000000000006
```


### DEFAULT_FEE_BPS
Default fee: 6.9% = 690 basis points


```solidity
uint256 public constant DEFAULT_FEE_BPS = 690
```


## Functions
### constructor


```solidity
constructor(address initialOwner) Ownable(initialOwner);
```

### configureCreatorPool

Configure tax hook for a ■AKITA/ETH pool


```solidity
function configureCreatorPool(
    address _shareOFT,
    address _gaugeController,
    uint256 _feeBps,
    uint24 _poolLPFee,
    int24 _tickSpacing
) external onlyOwner returns (bytes32 poolId);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_shareOFT`|`address`|The CreatorShareOFT token address|
|`_gaugeController`|`address`|The CreatorGaugeController address (fee recipient)|
|`_feeBps`|`uint256`|Fee in basis points (690 = 6.9%)|
|`_poolLPFee`|`uint24`|Pool swap fee for the v4 pool (hundredths of a bip; often 0 when using a tax hook)|
|`_tickSpacing`|`int24`|Tick spacing for the pool|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`poolId`|`bytes32`|The pool identifier|


### configureCreatorPoolDefault

Configure with default 6.9% fee


```solidity
function configureCreatorPoolDefault(
    address _shareOFT,
    address _gaugeController,
    uint24 _poolLPFee,
    int24 _tickSpacing
) external onlyOwner returns (bytes32 poolId);
```

### updateFeeRecipient

Update fee recipient (e.g., to new GaugeController)


```solidity
function updateFeeRecipient(bytes32 poolId, address _newRecipient) external onlyOwner;
```

### updateFeeBps

Update fee percentage


```solidity
function updateFeeBps(bytes32 poolId, uint256 _newBuyFeeBps, uint256 _newSellFeeBps) external onlyOwner;
```

### disableFees

Disable fees for a pool


```solidity
function disableFees(bytes32 poolId) external onlyOwner;
```

### _configureCreatorPool


```solidity
function _configureCreatorPool(
    address _shareOFT,
    address _gaugeController,
    uint256 _feeBps,
    uint24 _poolLPFee,
    int24 _tickSpacing
) internal returns (bytes32 poolId);
```

### getPoolId

Get pool ID for a token pair


```solidity
function getPoolId(address _shareOFT, uint24 _poolLPFee, int24 _tickSpacing) external pure returns (bytes32);
```

## Events
### PoolConfigured

```solidity
event PoolConfigured(
    bytes32 indexed poolId, address indexed shareOFT, address indexed gaugeController, uint256 feeBps
);
```

