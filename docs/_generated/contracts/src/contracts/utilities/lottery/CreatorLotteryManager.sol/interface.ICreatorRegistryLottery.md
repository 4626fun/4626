# ICreatorRegistryLottery
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/lottery/CreatorLotteryManager.sol)

**Title:**
CreatorLotteryManager

**Author:**
0xakita.eth

SHARED swap-based lottery service for ALL Creator Coins (hub-only, deployed on Base)

ARCHITECTURE (Hub-Centric):
This is a SHARED service deployed ONLY on the hub chain (Base).
It serves ALL Creator Coins by looking up their contracts from the registry.
Remote chain OFTs send lottery entry messages here via LayerZero.

LOTTERY MECHANICS:
1. User trades ANY share token (■AKITA, ■DRAGON, etc) on ANY chain
2. Hub: local processSwapLottery() is called directly
Remote: OFT sends MSG_TYPE_LOTTERY_ENTRY via LayerZero to this contract
3. Win probability scales with trade size ($1 = base, $10,000 = max)
4. ve4626 lockers get boosted win chances
5. Winners receive % from ALL active creator vaults (diversified prize!)
6. Winner callback sent to source chain OFT for UX notification

MULTI-TOKEN PRIZE PAYOUT:
Winner gets shares from EVERY active creator vault on Base:
- ■AKITA shares (69% of AKITA vault jackpot)
- ■DRAGON shares (69% of DRAGON vault jackpot)
- ■XYZ shares (69% of XYZ vault jackpot)
- ... etc for ALL active creators
Result: Winner gets a diversified portfolio of ALL creator tokens!

CROSS-CHAIN FLOW (Hub-Centric):
Trade on Base:
1. OFT calls processSwapLottery() directly
2. VRF + payout happen locally
Trade on Remote (e.g., Arbitrum):
1. Remote OFT sends MSG_TYPE_LOTTERY_ENTRY to this contract
2. This contract processes VRF locally on Base
3. If win: pay from ALL hub vaults
4. Send MSG_TYPE_WINNER_CALLBACK to source chain OFT


## Functions
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

### isCreatorCoinActive


```solidity
function isCreatorCoinActive(address _token) external view returns (bool);
```

### getLayerZeroEndpoint


```solidity
function getLayerZeroEndpoint(uint256 _chainId) external view returns (address);
```

### getAllCreatorCoins


```solidity
function getAllCreatorCoins() external view returns (address[] memory);
```

