# CreatorRegistry
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/core/CreatorRegistry.sol)

**Inherits:**
[ICreatorRegistry](/contracts/governance/VaultGaugeVoting.sol/interface.ICreatorRegistry.md), Ownable

**Title:**
CreatorRegistry

**Author:**
0xakita.eth

Registry for CreatorVault deployments and configs.

Used by factories, vaults, and OFTs to resolve ecosystem addresses.


## State Variables
### MAX_SUPPORTED_CHAINS

```solidity
uint256 public constant MAX_SUPPORTED_CHAINS = 99
```


### MAX_CREATOR_COINS

```solidity
uint256 public constant MAX_CREATOR_COINS = 999999
```


### creatorCoins
Creator Coin info by token address


```solidity
mapping(address => CreatorCoinInfo) private creatorCoins
```


### vaultToToken
Reverse lookup: vault → token


```solidity
mapping(address => address) public vaultToToken
```


### shareOFTToToken
Reverse lookup: shareOFT → token


```solidity
mapping(address => address) public shareOFTToToken
```


### wrapperToToken
Reverse lookup: wrapper → token


```solidity
mapping(address => address) public wrapperToToken
```


### oracleToToken
Reverse lookup: oracle → token


```solidity
mapping(address => address) public oracleToToken
```


### gaugeControllerToToken
Reverse lookup: gaugeController → token


```solidity
mapping(address => address) public gaugeControllerToToken
```


### registeredTokens
All registered Creator Coin addresses


```solidity
address[] private registeredTokens
```


### authorizedFactories
Authorized factories that can register Creator Coins


```solidity
mapping(address => bool) public authorizedFactories
```


### chainConfigs
Chain config by chain ID


```solidity
mapping(uint16 => ChainConfig) private chainConfigs
```


### supportedChains
All supported chains


```solidity
uint16[] private supportedChains
```


### currentChainId
Current chain ID


```solidity
uint16 private currentChainId
```


### layerZeroEndpoints
LayerZero endpoints by chain


```solidity
mapping(uint16 => address) public layerZeroEndpoints
```


### chainIdToEid
Chain ID to LZ EID mapping


```solidity
mapping(uint256 => uint32) public chainIdToEid
```


### eidToChainId

```solidity
mapping(uint32 => uint256) public eidToChainId
```


### lzConfigs
LZ config per chain


```solidity
mapping(uint16 => LzConfig) public lzConfigs
```


### defaultLzConfig
Default LZ config for standard chains


```solidity
LzConfig public defaultLzConfig
```


### layerZeroCommonEndpoint
Common LZ endpoint (fallback)


```solidity
address public immutable layerZeroCommonEndpoint
```


### lotteryManagers
Lottery managers by chain


```solidity
mapping(uint16 => address) public lotteryManagers
```


### gaugeControllers
Gauge controllers by chain


```solidity
mapping(uint16 => address) public gaugeControllers
```


### gasReserves
Gas reserves by chain


```solidity
mapping(uint16 => address) public gasReserves
```


### hubChainId
Hub chain configuration


```solidity
uint16 public hubChainId = 8453
```


### hubChainEid

```solidity
uint32 public hubChainEid = 30184
```


## Functions
### onlyAuthorizedOrOwner


```solidity
modifier onlyAuthorizedOrOwner() ;
```

### constructor


```solidity
constructor(address _initialOwner) Ownable(_initialOwner);
```

### setAuthorizedFactory

Authorize a factory to register Creator Coins


```solidity
function setAuthorizedFactory(address _factory, bool _authorized) external onlyOwner;
```

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
) external override onlyAuthorizedOrOwner;
```

### setCreatorVault

Set vault address for a Creator Coin


```solidity
function setCreatorVault(address _token, address _vault) external override onlyAuthorizedOrOwner;
```

### setCreatorShareOFT

Set ShareOFT address for a Creator Coin


```solidity
function setCreatorShareOFT(address _token, address _shareOFT) external override onlyAuthorizedOrOwner;
```

### setCreatorWrapper

Set wrapper address for a Creator Coin


```solidity
function setCreatorWrapper(address _token, address _wrapper) external override onlyAuthorizedOrOwner;
```

### setCreatorOracle

Set oracle address for a Creator Coin


```solidity
function setCreatorOracle(address _token, address _oracle) external override onlyAuthorizedOrOwner;
```

### setCreatorGaugeController

Set gauge controller address for a Creator Coin


```solidity
function setCreatorGaugeController(address _token, address _gaugeController)
    external
    override
    onlyAuthorizedOrOwner;
```

### setCreatorCoinStatus

Set active status for a Creator Coin


```solidity
function setCreatorCoinStatus(address _token, bool _isActive) external override onlyOwner;
```

### setCreatorPool

Update Creator Coin pool info


```solidity
function setCreatorPool(address _token, address _pool, uint24 _poolFee) external onlyOwner;
```

### getCreatorCoin


```solidity
function getCreatorCoin(address _token) external view override returns (CreatorCoinInfo memory);
```

### getVaultForToken


```solidity
function getVaultForToken(address _token) external view override returns (address);
```

### getShareOFTForToken


```solidity
function getShareOFTForToken(address _token) external view override returns (address);
```

### getWrapperForToken


```solidity
function getWrapperForToken(address _token) external view override returns (address);
```

### getOracleForToken


```solidity
function getOracleForToken(address _token) external view override returns (address);
```

### getGaugeControllerForToken


```solidity
function getGaugeControllerForToken(address _token) external view override returns (address);
```

### getAllCreatorCoins


```solidity
function getAllCreatorCoins() external view override returns (address[] memory);
```

### isCreatorCoinRegistered


```solidity
function isCreatorCoinRegistered(address _token) external view override returns (bool);
```

### isCreatorCoinActive


```solidity
function isCreatorCoinActive(address _token) external view override returns (bool);
```

### getCreatorCoinCount


```solidity
function getCreatorCoinCount() external view returns (uint256);
```

### getTokenForVault

Get token address from vault


```solidity
function getTokenForVault(address _vault) external view returns (address);
```

### getTokenForShareOFT

Get token address from ShareOFT


```solidity
function getTokenForShareOFT(address _shareOFT) external view returns (address);
```

### registerChain


```solidity
function registerChain(uint16 _chainId, string calldata _chainName, address _wrappedNativeToken, bool _isActive)
    external
    override
    onlyOwner;
```

### setDexInfrastructure


```solidity
function setDexInfrastructure(
    uint16 _chainId,
    address _poolManager,
    address _swapRouter,
    address _positionManager,
    address _quoter
) external override onlyOwner;
```

### setChainStatus


```solidity
function setChainStatus(uint16 _chainId, bool _isActive) external override onlyOwner;
```

### getChainConfig


```solidity
function getChainConfig(uint16 _chainId) external view override returns (ChainConfig memory);
```

### getSupportedChains


```solidity
function getSupportedChains() external view override returns (uint16[] memory);
```

### getCurrentChainId


```solidity
function getCurrentChainId() external view override returns (uint16);
```

### isChainSupported


```solidity
function isChainSupported(uint16 _chainId) external view override returns (bool);
```

### setLayerZeroEndpoint


```solidity
function setLayerZeroEndpoint(uint16 _chainId, address _endpoint) external override onlyOwner;
```

### getLayerZeroEndpoint


```solidity
function getLayerZeroEndpoint(uint16 _chainId) external view override returns (address);
```

### setChainIdToEid


```solidity
function setChainIdToEid(uint256 _chainId, uint32 _eid) external override onlyOwner;
```

### getEidForChainId


```solidity
function getEidForChainId(uint256 _chainId) external view override returns (uint32);
```

### getChainIdForEid


```solidity
function getChainIdForEid(uint32 _eid) external view override returns (uint256);
```

### getLzConfig


```solidity
function getLzConfig(uint16 _chainId) external view override returns (LzConfig memory);
```

### getEffectiveLzConfig


```solidity
function getEffectiveLzConfig(uint16 _chainId) external view override returns (LzConfig memory);
```

### setLzConfig

Set full LZ config for a chain


```solidity
function setLzConfig(
    uint16 _chainId,
    address _endpoint,
    uint32 _eid,
    address _sendLib,
    address _receiveLib,
    address _executor,
    address _dvn,
    address _lzReadDvn,
    uint64 _confirmations,
    bool _useCustomOApp
) external onlyOwner;
```

### setDefaultLzConfig

Set default LZ config for standard chains


```solidity
function setDefaultLzConfig(
    address _endpoint,
    address _sendLib,
    address _receiveLib,
    address _executor,
    address _dvn,
    address _lzReadDvn,
    uint64 _confirmations
) external onlyOwner;
```

### setLotteryManager


```solidity
function setLotteryManager(uint16 _chainId, address _manager) external override onlyOwner;
```

### getLotteryManager


```solidity
function getLotteryManager(uint16 _chainId) external view override returns (address);
```

### setGaugeController


```solidity
function setGaugeController(uint16 _chainId, address _controller) external override onlyOwner;
```

### getGaugeController


```solidity
function getGaugeController(uint16 _chainId) external view override returns (address);
```

### setGasReserve


```solidity
function setGasReserve(uint16 _chainId, address _reserve) external override onlyOwner;
```

### getGasReserve


```solidity
function getGasReserve(uint16 _chainId) external view override returns (address);
```

### setHubChain

Set hub chain


```solidity
function setHubChain(uint16 _chainId, uint32 _eid) external onlyOwner;
```

### isHubChain


```solidity
function isHubChain() external view override returns (bool);
```

### getWrappedNativeToken


```solidity
function getWrappedNativeToken(uint16 _chainId) external view override returns (address);
```

### getPoolManager


```solidity
function getPoolManager(uint16 _chainId) external view override returns (address);
```

### getSwapRouter


```solidity
function getSwapRouter(uint16 _chainId) external view override returns (address);
```

### getPositionManager

Get position manager for a chain


```solidity
function getPositionManager(uint16 _chainId) external view returns (address);
```

### getQuoter

Get quoter for a chain


```solidity
function getQuoter(uint16 _chainId) external view returns (address);
```

### _getDefaultWrappedNativeSymbol


```solidity
function _getDefaultWrappedNativeSymbol(uint256 _chainId) internal pure returns (string memory);
```

## Events
### FactoryAuthorized

```solidity
event FactoryAuthorized(address indexed factory, bool status);
```

### HubChainSet

```solidity
event HubChainSet(uint16 chainId, uint32 eid);
```

### CurrentChainSet

```solidity
event CurrentChainSet(uint16 indexed chainId);
```

### ChainIdToEidUpdated

```solidity
event ChainIdToEidUpdated(uint16 indexed chainId, uint32 eid);
```

## Errors
### ChainAlreadyRegistered

```solidity
error ChainAlreadyRegistered(uint16 chainId);
```

### ChainNotRegistered

```solidity
error ChainNotRegistered(uint16 chainId);
```

### CreatorCoinAlreadyRegistered

```solidity
error CreatorCoinAlreadyRegistered(address token);
```

### CreatorCoinNotRegistered

```solidity
error CreatorCoinNotRegistered(address token);
```

### TooManyChains

```solidity
error TooManyChains();
```

### TooManyCreatorCoins

```solidity
error TooManyCreatorCoins();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### NotAuthorized

```solidity
error NotAuthorized();
```

