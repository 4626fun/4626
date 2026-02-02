# ICreatorRegistry
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/interfaces/core/ICreatorRegistry.sol)

**Title:**
ICreatorRegistry

**Author:**
0xakita.eth

Registry interface for core CreatorVault addresses.

Used by vaults, OFTs, and helpers to resolve ecosystem contracts.


## Functions
### registerCreatorCoin

Register a new Creator Coin


```solidity
function registerCreatorCoin(
    address _token,
    string calldata _name,
    string calldata _symbol,
    address _creator,
    address _pool,
    uint24 _poolFee
) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_token`|`address`|Creator Coin token address|
|`_name`|`string`|Token name|
|`_symbol`|`string`|Token symbol|
|`_creator`|`address`|Creator's address|
|`_pool`|`address`|Primary liquidity pool|
|`_poolFee`|`uint24`|Pool fee tier|


### setCreatorVault

Set vault address for a Creator Coin


```solidity
function setCreatorVault(address _token, address _vault) external;
```

### setCreatorShareOFT

Set ShareOFT address for a Creator Coin


```solidity
function setCreatorShareOFT(address _token, address _shareOFT) external;
```

### setCreatorWrapper

Set wrapper address for a Creator Coin


```solidity
function setCreatorWrapper(address _token, address _wrapper) external;
```

### setCreatorOracle

Set oracle address for a Creator Coin


```solidity
function setCreatorOracle(address _token, address _oracle) external;
```

### setCreatorGaugeController

Set gauge controller address for a Creator Coin


```solidity
function setCreatorGaugeController(address _token, address _gaugeController) external;
```

### setCreatorCoinStatus

Set active status for a Creator Coin


```solidity
function setCreatorCoinStatus(address _token, bool _isActive) external;
```

### getCreatorCoin

Get full Creator Coin info


```solidity
function getCreatorCoin(address _token) external view returns (CreatorCoinInfo memory);
```

### getVaultForToken

Get vault for a Creator Coin


```solidity
function getVaultForToken(address _token) external view returns (address);
```

### getShareOFTForToken

Get ShareOFT for a Creator Coin


```solidity
function getShareOFTForToken(address _token) external view returns (address);
```

### getWrapperForToken

Get wrapper for a Creator Coin


```solidity
function getWrapperForToken(address _token) external view returns (address);
```

### getOracleForToken

Get oracle for a Creator Coin


```solidity
function getOracleForToken(address _token) external view returns (address);
```

### getGaugeControllerForToken

Get gauge controller for a Creator Coin


```solidity
function getGaugeControllerForToken(address _token) external view returns (address);
```

### getAllCreatorCoins

Get all registered Creator Coins


```solidity
function getAllCreatorCoins() external view returns (address[] memory);
```

### isCreatorCoinRegistered

Check if a Creator Coin is registered


```solidity
function isCreatorCoinRegistered(address _token) external view returns (bool);
```

### isCreatorCoinActive

Check if a Creator Coin is registered AND active

Returns false if not registered or if deactivated


```solidity
function isCreatorCoinActive(address _token) external view returns (bool);
```

### registerChain

Register a new chain


```solidity
function registerChain(uint16 _chainId, string calldata _chainName, address _wrappedNativeToken, bool _isActive)
    external;
```

### setDexInfrastructure

Set DEX infrastructure for a chain


```solidity
function setDexInfrastructure(
    uint16 _chainId,
    address _poolManager,
    address _swapRouter,
    address _positionManager,
    address _quoter
) external;
```

### setChainStatus

Set chain active status


```solidity
function setChainStatus(uint16 _chainId, bool _isActive) external;
```

### getChainConfig

Get chain configuration


```solidity
function getChainConfig(uint16 _chainId) external view returns (ChainConfig memory);
```

### getSupportedChains

Get all supported chains


```solidity
function getSupportedChains() external view returns (uint16[] memory);
```

### getCurrentChainId

Get current chain ID


```solidity
function getCurrentChainId() external view returns (uint16);
```

### isChainSupported

Check if chain is supported


```solidity
function isChainSupported(uint16 _chainId) external view returns (bool);
```

### setLayerZeroEndpoint

Set LayerZero endpoint for a chain


```solidity
function setLayerZeroEndpoint(uint16 _chainId, address _endpoint) external;
```

### getLayerZeroEndpoint

Get LayerZero endpoint for a chain


```solidity
function getLayerZeroEndpoint(uint16 _chainId) external view returns (address);
```

### setChainIdToEid

Set chain ID to LayerZero EID mapping


```solidity
function setChainIdToEid(uint256 _chainId, uint32 _eid) external;
```

### getEidForChainId

Get EID for a chain ID


```solidity
function getEidForChainId(uint256 _chainId) external view returns (uint32);
```

### getChainIdForEid

Get chain ID for an EID


```solidity
function getChainIdForEid(uint32 _eid) external view returns (uint256);
```

### getLzConfig

Get full LZ config for a chain


```solidity
function getLzConfig(uint16 _chainId) external view returns (LzConfig memory);
```

### getEffectiveLzConfig

Get effective LZ config (custom or default)


```solidity
function getEffectiveLzConfig(uint16 _chainId) external view returns (LzConfig memory);
```

### setLotteryManager

Set lottery manager for a chain


```solidity
function setLotteryManager(uint16 _chainId, address _manager) external;
```

### getLotteryManager

Get lottery manager for a chain


```solidity
function getLotteryManager(uint16 _chainId) external view returns (address);
```

### setGaugeController

Set gauge controller for a chain


```solidity
function setGaugeController(uint16 _chainId, address _controller) external;
```

### getGaugeController

Get gauge controller for a chain


```solidity
function getGaugeController(uint16 _chainId) external view returns (address);
```

### setGasReserve

Set gas reserve for a chain


```solidity
function setGasReserve(uint16 _chainId, address _reserve) external;
```

### getGasReserve

Get gas reserve for a chain


```solidity
function getGasReserve(uint16 _chainId) external view returns (address);
```

### getWrappedNativeToken

Get wrapped native token for a chain


```solidity
function getWrappedNativeToken(uint16 _chainId) external view returns (address);
```

### getPoolManager

Get pool manager for a chain


```solidity
function getPoolManager(uint16 _chainId) external view returns (address);
```

### getSwapRouter

Get swap router for a chain


```solidity
function getSwapRouter(uint16 _chainId) external view returns (address);
```

### isHubChain

Check if this is the hub chain


```solidity
function isHubChain() external view returns (bool);
```

### hubChainId

Get hub chain ID


```solidity
function hubChainId() external view returns (uint16);
```

### hubChainEid

Get hub chain EID


```solidity
function hubChainEid() external view returns (uint32);
```

## Events
### CreatorCoinRegistered

```solidity
event CreatorCoinRegistered(
    address indexed token,
    string name,
    string symbol,
    address indexed creator,
    address vault,
    address shareOFT,
    address wrapper
);
```

### CreatorCoinUpdated

```solidity
event CreatorCoinUpdated(address indexed token);
```

### CreatorCoinStatusChanged

```solidity
event CreatorCoinStatusChanged(address indexed token, bool isActive);
```

### ChainRegistered

```solidity
event ChainRegistered(uint16 indexed chainId, string chainName);
```

### ChainUpdated

```solidity
event ChainUpdated(uint16 indexed chainId);
```

### ChainStatusChanged

```solidity
event ChainStatusChanged(uint16 indexed chainId, bool isActive);
```

### LayerZeroEndpointUpdated

```solidity
event LayerZeroEndpointUpdated(uint16 indexed chainId, address endpoint);
```

### LzConfigUpdated

```solidity
event LzConfigUpdated(uint16 indexed chainId);
```

### EcosystemContractSet

```solidity
event EcosystemContractSet(uint16 indexed chainId, string contractType, address indexed contractAddress);
```

## Structs
### CreatorCoinInfo
Information about a registered Creator Coin


```solidity
struct CreatorCoinInfo {
    address token; // Creator Coin token address
    string name; // Token name
    string symbol; // Token symbol
    address vault; // CreatorOVault address
    address shareOFT; // CreatorShareOFT address
    address wrapper; // CreatorOVaultWrapper address
    address oracle; // CreatorOracle address (per-creator price oracle)
    address gaugeController; // CreatorGaugeController address (per-creator fee distribution)
    address creator; // Creator's address (admin)
    address pool; // Primary liquidity pool
    uint24 poolFee; // Pool fee tier (e.g., 3000 = 0.3%)
    uint16 primaryChainId; // Chain where token originated
    bool isActive; // Active status
    uint256 registeredAt; // Registration timestamp
}
```

### ChainConfig
Chain configuration


```solidity
struct ChainConfig {
    uint16 chainId;
    string chainName;
    address wrappedNativeToken;
    string wrappedNativeSymbol;
    address poolManager; // Uniswap V4 PoolManager
    address swapRouter; // UniversalRouter
    address positionManager; // V4 PositionManager
    address quoter; // Quoter
    address chainlinkNativeFeed;
    bool isActive;
}
```

### LzConfig
LayerZero configuration per chain


```solidity
struct LzConfig {
    address endpoint;
    uint32 eid;
    address sendLib;
    address receiveLib;
    address executor;
    address dvn;
    address lzReadDvn;
    address[] optionalDvns;
    uint64 confirmations;
    bool isConfigured;
    bool useCustomOApp;
}
```

