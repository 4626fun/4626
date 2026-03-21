# ICreatorRegistry
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/interfaces/core/ICreatorRegistry.sol)

**Title:**
ICreatorRegistry

**Author:**
0xakita.eth

Registry interface for core 4626 addresses.

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


### setVault

Set vault address for a Creator Coin


```solidity
function setVault(address _token, address _vault) external;
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

### setCanonicalWallet

Set the canonical smart wallet for a creator

This is the creator's ERC-4337 smart wallet (e.g., Coinbase Smart Wallet).
It serves as the unified on-chain identity:
- ERC-8004 agent wallet (on-chain agent registration)
- ERC-4337 account (UserOp sender, gas sponsorship)
- Vault owner and asset holder
- Lottery prize recipient


```solidity
function setCanonicalWallet(address _token, address _wallet) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_token`|`address`|Creator Coin address|
|`_wallet`|`address`|Canonical smart wallet address|


### setOmnichainVaultMesh

Configure Solana OVault mesh metadata for a creator coin.


```solidity
function setOmnichainVaultMesh(address _token, OmnichainVaultMeshConfig calldata _cfg) external;
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

### getTokenForShareOFT

Reverse-lookup: get the Creator Coin address for a given ShareOFT


```solidity
function getTokenForShareOFT(address _shareOFT) external view returns (address);
```

### getCanonicalWallet

Get the canonical smart wallet for a creator

Returns address(0) if not set


```solidity
function getCanonicalWallet(address _token) external view returns (address);
```

### getTokenForCanonicalWallet

Reverse-lookup: get the Creator Coin address for a canonical wallet


```solidity
function getTokenForCanonicalWallet(address _wallet) external view returns (address);
```

### getOmnichainVaultMesh

Read Solana OVault mesh metadata for a creator coin.


```solidity
function getOmnichainVaultMesh(address _token) external view returns (OmnichainVaultMeshConfig memory);
```

### isSolanaDepositEligible

Returns true when this creator coin is currently eligible for Solana deposit routing.


```solidity
function isSolanaDepositEligible(address _token) external view returns (bool);
```

### getSolanaAssetMint

Returns configured Solana asset mint for a creator coin.


```solidity
function getSolanaAssetMint(address _token) external view returns (bytes32);
```

### setRemoteOFTPeer

Set remote OFT peer for EVM-addressable chains.


```solidity
function setRemoteOFTPeer(address _token, uint32 _chainEid, address _remoteOFT) external;
```

### removeRemoteOFTPeer

Remove remote OFT peer for EVM-addressable chains.


```solidity
function removeRemoteOFTPeer(address _token, uint32 _chainEid) external;
```

### getRemoteOFTPeer

Get remote OFT peer for EVM-addressable chains.


```solidity
function getRemoteOFTPeer(address _token, uint32 _chainEid) external view returns (address);
```

### getRemoteOFTChains

Get all remote OFT peer chains for EVM-addressable peers.


```solidity
function getRemoteOFTChains(address _token) external view returns (uint32[] memory);
```

### getAllRemoteOFTPeers

Get all remote EVM OFT peers for a token.


```solidity
function getAllRemoteOFTPeers(address _token) external view returns (uint32[] memory eids, address[] memory ofts);
```

### getTokenForRemoteOFT

Reverse-lookup token for EVM remote OFT address.


```solidity
function getTokenForRemoteOFT(address _remoteOFT) external view returns (address);
```

### setRemoteOFTPeerBytes32

Set remote OFT peer for non-EVM chains using bytes32 identity (e.g., Solana pubkey).


```solidity
function setRemoteOFTPeerBytes32(address _token, uint32 _chainEid, bytes32 _remoteOFT) external;
```

### removeRemoteOFTPeerBytes32

Remove remote bytes32 OFT peer mapping.


```solidity
function removeRemoteOFTPeerBytes32(address _token, uint32 _chainEid) external;
```

### getRemoteOFTPeerBytes32

Get remote bytes32 OFT peer.


```solidity
function getRemoteOFTPeerBytes32(address _token, uint32 _chainEid) external view returns (bytes32);
```

### getRemoteOFTChainsBytes32

Get all chain EIDs with bytes32 remote peers.


```solidity
function getRemoteOFTChainsBytes32(address _token) external view returns (uint32[] memory);
```

### getAllRemoteOFTPeersBytes32

Get all bytes32 remote OFT peers for a token.


```solidity
function getAllRemoteOFTPeersBytes32(address _token)
    external
    view
    returns (uint32[] memory eids, bytes32[] memory peers);
```

### getTokenForRemoteOFTBytes32

Reverse-lookup token for bytes32 remote OFT identity.


```solidity
function getTokenForRemoteOFTBytes32(bytes32 _remoteOFT) external view returns (address);
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
function registerChain(uint256 _chainId, string calldata _chainName, address _wrappedNativeToken, bool _isActive)
    external;
```

### setDexInfrastructure

Set DEX infrastructure for a chain


```solidity
function setDexInfrastructure(
    uint256 _chainId,
    address _poolManager,
    address _swapRouter,
    address _positionManager,
    address _quoter
) external;
```

### setChainStatus

Set chain active status


```solidity
function setChainStatus(uint256 _chainId, bool _isActive) external;
```

### getChainConfig

Get chain configuration


```solidity
function getChainConfig(uint256 _chainId) external view returns (ChainConfig memory);
```

### getSupportedChains

Get all supported chains


```solidity
function getSupportedChains() external view returns (uint256[] memory);
```

### getCurrentChainId

Get current chain ID


```solidity
function getCurrentChainId() external view returns (uint256);
```

### isChainSupported

Check if chain is supported


```solidity
function isChainSupported(uint256 _chainId) external view returns (bool);
```

### setLayerZeroEndpoint

Set LayerZero endpoint for a chain


```solidity
function setLayerZeroEndpoint(uint256 _chainId, address _endpoint) external;
```

### getLayerZeroEndpoint

Get LayerZero endpoint for a chain


```solidity
function getLayerZeroEndpoint(uint256 _chainId) external view returns (address);
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
function getLzConfig(uint256 _chainId) external view returns (LzConfig memory);
```

### getEffectiveLzConfig

Get effective LZ config (custom or default)


```solidity
function getEffectiveLzConfig(uint256 _chainId) external view returns (LzConfig memory);
```

### setLotteryManager

Set lottery manager for a chain


```solidity
function setLotteryManager(uint256 _chainId, address _manager) external;
```

### getLotteryManager

Get lottery manager for a chain


```solidity
function getLotteryManager(uint256 _chainId) external view returns (address);
```

### setGaugeController

Set gauge controller for a chain


```solidity
function setGaugeController(uint256 _chainId, address _controller) external;
```

### getGaugeController

Get gauge controller for a chain


```solidity
function getGaugeController(uint256 _chainId) external view returns (address);
```

### setGasReserve

Set gas reserve for a chain


```solidity
function setGasReserve(uint256 _chainId, address _reserve) external;
```

### getGasReserve

Get gas reserve for a chain


```solidity
function getGasReserve(uint256 _chainId) external view returns (address);
```

### getWrappedNativeToken

Get wrapped native token for a chain


```solidity
function getWrappedNativeToken(uint256 _chainId) external view returns (address);
```

### getPoolManager

Get pool manager for a chain


```solidity
function getPoolManager(uint256 _chainId) external view returns (address);
```

### getSwapRouter

Get swap router for a chain


```solidity
function getSwapRouter(uint256 _chainId) external view returns (address);
```

### isHubChain

Check if this is the hub chain


```solidity
function isHubChain() external view returns (bool);
```

### hubChainId

Get hub chain ID


```solidity
function hubChainId() external view returns (uint256);
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

### CanonicalWalletSet

```solidity
event CanonicalWalletSet(address indexed token, address indexed wallet);
```

### RemoteOFTPeerSet

```solidity
event RemoteOFTPeerSet(address indexed creatorCoin, uint32 indexed chainEid, address remoteOFT);
```

### RemoteOFTPeerRemoved

```solidity
event RemoteOFTPeerRemoved(address indexed creatorCoin, uint32 indexed chainEid);
```

### RemoteOFTPeerBytes32Set

```solidity
event RemoteOFTPeerBytes32Set(address indexed creatorCoin, uint32 indexed chainEid, bytes32 remoteOFT);
```

### RemoteOFTPeerBytes32Removed

```solidity
event RemoteOFTPeerBytes32Removed(address indexed creatorCoin, uint32 indexed chainEid);
```

### OmnichainVaultMeshConfigured

```solidity
event OmnichainVaultMeshConfigured(
    address indexed creatorCoin,
    uint32 indexed solanaEid,
    address hubComposer,
    address assetMeshToken,
    address shareMeshToken,
    bytes32 solanaAssetMint,
    bool enabled
);
```

### ChainRegistered

```solidity
event ChainRegistered(uint256 indexed chainId, string chainName);
```

### ChainUpdated

```solidity
event ChainUpdated(uint256 indexed chainId);
```

### ChainStatusChanged

```solidity
event ChainStatusChanged(uint256 indexed chainId, bool isActive);
```

### LayerZeroEndpointUpdated

```solidity
event LayerZeroEndpointUpdated(uint256 indexed chainId, address endpoint);
```

### LzConfigUpdated

```solidity
event LzConfigUpdated(uint256 indexed chainId);
```

### EcosystemContractSet

```solidity
event EcosystemContractSet(uint256 indexed chainId, string contractType, address indexed contractAddress);
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
    address creator; // Creator's address (admin/EOA signer)
    address canonicalWallet; // Canonical smart wallet (ERC-4337 / Coinbase Smart Wallet)
    // Used as: ERC-8004 agent identity, asset holder,
    // lottery prize recipient, and vault owner
    address pool; // Primary liquidity pool
    uint24 poolFee; // Pool fee tier (e.g., 3000 = 0.3%)
    uint256 primaryChainId; // Chain where token originated
    bool isActive; // Active status
    uint256 registeredAt; // Registration timestamp
}
```

### ChainConfig
Chain configuration


```solidity
struct ChainConfig {
    uint256 chainId;
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

### OmnichainVaultMeshConfig
Per-creator Solana OVault mesh configuration.


```solidity
struct OmnichainVaultMeshConfig {
    uint32 solanaEid;
    address hubComposer;
    address assetMeshToken;
    address shareMeshToken;
    bytes32 solanaAssetMint;
    bool enabled;
}
```

