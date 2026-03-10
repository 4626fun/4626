# CreatorRegistry
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/core/CreatorRegistry.sol)

**Inherits:**
[ICreatorRegistry](/contracts/governance/VaultGaugeVoting.sol/interface.ICreatorRegistry.md), Ownable

**Title:**
CreatorRegistry

**Author:**
0xakita.eth

Registry for 4626 deployments and configs.

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


### canonicalWalletToToken
Reverse lookup: canonicalWallet → token


```solidity
mapping(address => address) public canonicalWalletToToken
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


### remoteOFTPeers
Remote OFT addresses per creator coin per chain EID

creatorCoin → chainEid → remoteOFTAddress


```solidity
mapping(address => mapping(uint32 => address)) public remoteOFTPeers
```


### remoteOFTChains
All chain EIDs that have a remote OFT for a given creator coin


```solidity
mapping(address => uint32[]) private remoteOFTChains
```


### remoteOFTToToken
Reverse lookup: remote OFT address → creator coin (for cross-chain lookups)

Used when a remote OFT sends a lottery entry and we need to identify the creator


```solidity
mapping(address => address) public remoteOFTToToken
```


### remoteOFTPeersBytes32
Remote OFT peers for non-EVM chains keyed by bytes32 identity (e.g., Solana pubkey)

creatorCoin → chainEid → remoteOFTBytes32


```solidity
mapping(address => mapping(uint32 => bytes32)) public remoteOFTPeersBytes32
```


### remoteOFTChainsBytes32
Chain EIDs that have bytes32 peers for a given creator coin


```solidity
mapping(address => uint32[]) private remoteOFTChainsBytes32
```


### remoteOFTBytes32ToToken
Reverse lookup: remote bytes32 peer → creator coin


```solidity
mapping(bytes32 => address) public remoteOFTBytes32ToToken
```


### omnichainVaultMeshConfigs
Per-creator Solana OVault mesh metadata.


```solidity
mapping(address => OmnichainVaultMeshConfig) private omnichainVaultMeshConfigs
```


### chainConfigs
Chain config by chain ID


```solidity
mapping(uint256 => ChainConfig) private chainConfigs
```


### supportedChains
All supported chains


```solidity
uint256[] private supportedChains
```


### currentChainId
Current chain ID


```solidity
uint256 private currentChainId
```


### layerZeroEndpoints
LayerZero endpoints by chain


```solidity
mapping(uint256 => address) public layerZeroEndpoints
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
mapping(uint256 => LzConfig) public lzConfigs
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
mapping(uint256 => address) public lotteryManagers
```


### gaugeControllers
Gauge controllers by chain


```solidity
mapping(uint256 => address) public gaugeControllers
```


### gasReserves
Gas reserves by chain


```solidity
mapping(uint256 => address) public gasReserves
```


### hubChainId
Hub chain configuration


```solidity
uint256 public hubChainId = 8453
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

### setVault

Set vault address for a Creator Coin


```solidity
function setVault(address _token, address _vault) external override onlyAuthorizedOrOwner;
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

### setCanonicalWallet

Set the canonical smart wallet (ERC-4337) for a creator

This wallet serves as the creator's unified on-chain identity:
- ERC-4337 account (UserOp sender, gas sponsorship via paymaster)
- ERC-8004 agent identity (on-chain agent registration)
- Vault owner and primary asset holder
- Lottery prize recipient
Only the registry owner or the creator themselves can set this.


```solidity
function setCanonicalWallet(address _token, address _wallet) external override;
```

### setOmnichainVaultMesh

Configure Solana OVault mesh metadata for a creator coin.

Enabled configs must be fully populated.


```solidity
function setOmnichainVaultMesh(address _token, OmnichainVaultMeshConfig calldata _cfg)
    external
    override
    onlyAuthorizedOrOwner;
```

### setCreatorPool

Update Creator Coin pool info


```solidity
function setCreatorPool(address _token, address _pool, uint24 _poolFee) external onlyOwner;
```

### setRemoteOFTPeer

Register a remote OFT deployment for a creator coin

Called when a CreatorShareOFT is deployed on a remote chain.
This maps the creator coin to its remote OFT address on a given chain.


```solidity
function setRemoteOFTPeer(address _token, uint32 _chainEid, address _remoteOFT)
    external
    override
    onlyAuthorizedOrOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_token`|`address`|Creator coin address (hub chain)|
|`_chainEid`|`uint32`|LayerZero EID of the remote chain|
|`_remoteOFT`|`address`|Address of the CreatorShareOFT on the remote chain|


### removeRemoteOFTPeer

Remove a remote OFT peer for a creator coin


```solidity
function removeRemoteOFTPeer(address _token, uint32 _chainEid) external override onlyOwner;
```

### getRemoteOFTPeer

Get the remote OFT address for a creator coin on a specific chain


```solidity
function getRemoteOFTPeer(address _token, uint32 _chainEid) external view override returns (address);
```

### getRemoteOFTChains

Get all remote chain EIDs that have a deployed OFT for a creator coin


```solidity
function getRemoteOFTChains(address _token) external view override returns (uint32[] memory);
```

### getAllRemoteOFTPeers

Get all remote OFT peers for a creator coin


```solidity
function getAllRemoteOFTPeers(address _token)
    external
    view
    override
    returns (uint32[] memory eids, address[] memory ofts);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`eids`|`uint32[]`|Array of chain EIDs|
|`ofts`|`address[]`|Array of remote OFT addresses (parallel with eids)|


### getTokenForRemoteOFT

Get the creator coin for a remote OFT address (reverse lookup)

Used when a remote OFT sends a lottery entry to identify the creator


```solidity
function getTokenForRemoteOFT(address _remoteOFT) external view override returns (address);
```

### setRemoteOFTPeerBytes32

Sets non-EVM remote OFT peer mapping for a registered creator coin.

Uses bytes32 remote identity so Solana pubkeys can be represented losslessly.


```solidity
function setRemoteOFTPeerBytes32(address _token, uint32 _chainEid, bytes32 _remoteOFT)
    external
    override
    onlyAuthorizedOrOwner;
```

### removeRemoteOFTPeerBytes32

Removes non-EVM remote OFT peer mapping.


```solidity
function removeRemoteOFTPeerBytes32(address _token, uint32 _chainEid) external override onlyOwner;
```

### getRemoteOFTPeerBytes32

Returns bytes32 peer identity for token + EID.


```solidity
function getRemoteOFTPeerBytes32(address _token, uint32 _chainEid) external view override returns (bytes32);
```

### getRemoteOFTChainsBytes32

Returns all EIDs with bytes32 peers for token.


```solidity
function getRemoteOFTChainsBytes32(address _token) external view override returns (uint32[] memory);
```

### getAllRemoteOFTPeersBytes32

Returns all bytes32 peers for token.


```solidity
function getAllRemoteOFTPeersBytes32(address _token)
    external
    view
    override
    returns (uint32[] memory eids, bytes32[] memory peers);
```

### getTokenForRemoteOFTBytes32

Reverse lookup for bytes32 remote OFT identity.


```solidity
function getTokenForRemoteOFTBytes32(bytes32 _remoteOFT) external view override returns (address);
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

### isRegisteredVault

Compatibility helper for gauge voting registry-gates

A vault is considered "registered" once it's mapped to a Creator Coin.


```solidity
function isRegisteredVault(address _vault) external view returns (bool);
```

### getTokenForShareOFT

Get token address from ShareOFT


```solidity
function getTokenForShareOFT(address _shareOFT) external view returns (address);
```

### getCanonicalWallet

Get the canonical smart wallet for a creator


```solidity
function getCanonicalWallet(address _token) external view override returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_token`|`address`|Creator Coin address|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The creator's canonical ERC-4337 smart wallet (address(0) if not set)|


### getTokenForCanonicalWallet

Get the Creator Coin for a canonical wallet (reverse lookup)


```solidity
function getTokenForCanonicalWallet(address _wallet) external view override returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_wallet`|`address`|Canonical smart wallet address|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The creator coin address (address(0) if not found)|


### getOmnichainVaultMesh


```solidity
function getOmnichainVaultMesh(address _token) external view override returns (OmnichainVaultMeshConfig memory);
```

### isSolanaDepositEligible


```solidity
function isSolanaDepositEligible(address _token) external view override returns (bool);
```

### getSolanaAssetMint


```solidity
function getSolanaAssetMint(address _token) external view override returns (bytes32);
```

### registerChain


```solidity
function registerChain(uint256 _chainId, string calldata _chainName, address _wrappedNativeToken, bool _isActive)
    external
    override
    onlyOwner;
```

### setDexInfrastructure


```solidity
function setDexInfrastructure(
    uint256 _chainId,
    address _poolManager,
    address _swapRouter,
    address _positionManager,
    address _quoter
) external override onlyOwner;
```

### setChainStatus


```solidity
function setChainStatus(uint256 _chainId, bool _isActive) external override onlyOwner;
```

### getChainConfig


```solidity
function getChainConfig(uint256 _chainId) external view override returns (ChainConfig memory);
```

### getSupportedChains


```solidity
function getSupportedChains() external view override returns (uint256[] memory);
```

### getCurrentChainId


```solidity
function getCurrentChainId() external view override returns (uint256);
```

### isChainSupported


```solidity
function isChainSupported(uint256 _chainId) external view override returns (bool);
```

### setLayerZeroEndpoint


```solidity
function setLayerZeroEndpoint(uint256 _chainId, address _endpoint) external override onlyOwner;
```

### getLayerZeroEndpoint


```solidity
function getLayerZeroEndpoint(uint256 _chainId) external view override returns (address);
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
function getLzConfig(uint256 _chainId) external view override returns (LzConfig memory);
```

### getEffectiveLzConfig


```solidity
function getEffectiveLzConfig(uint256 _chainId) external view override returns (LzConfig memory);
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
function setLotteryManager(uint256 _chainId, address _manager) external override onlyOwner;
```

### getLotteryManager


```solidity
function getLotteryManager(uint256 _chainId) external view override returns (address);
```

### setGaugeController


```solidity
function setGaugeController(uint256 _chainId, address _controller) external override onlyOwner;
```

### getGaugeController


```solidity
function getGaugeController(uint256 _chainId) external view override returns (address);
```

### setGasReserve


```solidity
function setGasReserve(uint256 _chainId, address _reserve) external override onlyOwner;
```

### getGasReserve


```solidity
function getGasReserve(uint256 _chainId) external view override returns (address);
```

### setHubChain

Set hub chain


```solidity
function setHubChain(uint256 _chainId, uint32 _eid) external onlyOwner;
```

### isHubChain


```solidity
function isHubChain() external view override returns (bool);
```

### getWrappedNativeToken


```solidity
function getWrappedNativeToken(uint256 _chainId) external view override returns (address);
```

### getPoolManager


```solidity
function getPoolManager(uint256 _chainId) external view override returns (address);
```

### getSwapRouter


```solidity
function getSwapRouter(uint256 _chainId) external view override returns (address);
```

### getPositionManager

Get position manager for a chain


```solidity
function getPositionManager(uint256 _chainId) external view returns (address);
```

### getQuoter

Get quoter for a chain


```solidity
function getQuoter(uint256 _chainId) external view returns (address);
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
event HubChainSet(uint256 chainId, uint32 eid);
```

### CurrentChainSet

```solidity
event CurrentChainSet(uint256 indexed chainId);
```

### ChainIdToEidUpdated

```solidity
event ChainIdToEidUpdated(uint256 indexed chainId, uint32 eid);
```

## Errors
### ChainAlreadyRegistered

```solidity
error ChainAlreadyRegistered(uint256 chainId);
```

### ChainNotRegistered

```solidity
error ChainNotRegistered(uint256 chainId);
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

### CanonicalWalletAlreadyInUse

```solidity
error CanonicalWalletAlreadyInUse(address wallet, address token);
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### ZeroBytes32

```solidity
error ZeroBytes32();
```

### NotAuthorized

```solidity
error NotAuthorized();
```

