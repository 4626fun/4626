# ICreatorRegistryLottery
[Git Source](https://github.com/creatorvault/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/contracts/services/lottery/CreatorLotteryManager.sol)

**Title:**
CreatorLotteryManager

**Author:**
0xakita.eth (CreatorVault)

SHARED swap-based lottery service for ALL Creator Coins

ARCHITECTURE:
This is a SHARED service deployed once per chain.
It serves ALL Creator Coins by looking up their contracts from the registry.

LOTTERY MECHANICS:
1. User trades ANY share token (■AKITA, ■DRAGON, etc) → lottery entry created
2. Win probability scales with trade size ($1 = base, $1000 = max)
3. sToken holders get boosted win chances
4. Winners receive % from ALL active creator vaults (diversified prize!)
5. Winners are broadcast to ALL chains via LayerZero

MULTI-TOKEN PRIZE PAYOUT:
Winner gets shares from EVERY active creator vault:
- ■AKITA shares (69% of AKITA vault jackpot)
- wsDRAGON shares (69% of DRAGON vault jackpot)
- wsXYZ shares (69% of XYZ vault jackpot)
- ... etc for ALL active creators
Result: Winner gets a diversified portfolio of ALL creator tokens! 🎁

CROSS-CHAIN FLOW (Hub = Base):
Winner on Base:
1. Pay from ALL local vaults
2. Broadcast to all remote chains
Winner on Remote:
1. Notify hub (Base)
2. Hub broadcasts to ALL chains (including source)
3. Each chain pays from ALL their local vaults


## Functions
### getLayerZeroEndpoint


```solidity
function getLayerZeroEndpoint(uint16 _chainId) external view returns (address);
```

### getEidForChainId


```solidity
function getEidForChainId(uint256 _chainId) external view returns (uint32);
```

### getSupportedChains


```solidity
function getSupportedChains() external view returns (uint16[] memory);
```

### isHubChain


```solidity
function isHubChain() external view returns (bool);
```

### getGasReserve


```solidity
function getGasReserve(uint16 chainId) external view returns (address);
```

### getRemoteVaults


```solidity
function getRemoteVaults() external view returns (uint32[] memory eids, address[] memory vaults);
```

### getVaultForToken


```solidity
function getVaultForToken(address _token) external view returns (address);
```

### getShareOFTForToken


```solidity
function getShareOFTForToken(address _token) external view returns (address);
```

### getTokenForShareOFT


```solidity
function getTokenForShareOFT(address _shareOFT) external view returns (address);
```

### getOracleForToken


```solidity
function getOracleForToken(address _token) external view returns (address);
```

### getGaugeControllerForToken


```solidity
function getGaugeControllerForToken(address _token) external view returns (address);
```

### isCreatorCoinRegistered


```solidity
function isCreatorCoinRegistered(address _token) external view returns (bool);
```

### isCreatorCoinActive


```solidity
function isCreatorCoinActive(address _token) external view returns (bool);
```

### getLotteryManager


```solidity
function getLotteryManager(uint16 _chainId) external view returns (address);
```

### getAllCreatorCoins


```solidity
function getAllCreatorCoins() external view returns (address[] memory);
```

