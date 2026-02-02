# CreatorGaugeController
[Git Source](https://github.com/creatorvault/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/contracts/governance/CreatorGaugeController.sol)

**Inherits:**
Ownable, ReentrancyGuard

**Title:**
CreatorGaugeController

**Author:**
0xakita.eth

Fee splitter and gauge controller for creator vaults.

Routes swap fees to lottery, burn, and protocol allocations.


## State Variables
### MAX_BPS

```solidity
uint256 public constant MAX_BPS = 10000
```


### MAX_CREATOR_SHARE

```solidity
uint256 public constant MAX_CREATOR_SHARE = 5000
```


### MAX_PROTOCOL_SHARE

```solidity
uint256 public constant MAX_PROTOCOL_SHARE = 1000
```


### WETH
WETH on Base


```solidity
address public constant WETH = 0x4200000000000000000000000000000000000006
```


### SWAP_ROUTER
Uniswap V3 Router on Base (for WETH → CreatorCoin swaps)


```solidity
address public constant SWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481
```


### DEFAULT_SWAP_FEE
Default swap fee tier (0.3%)


```solidity
uint24 public constant DEFAULT_SWAP_FEE = 3000
```


### shareOFT
The ShareOFT token (e.g., ■AKITA) - what we receive as fees


```solidity
IERC20 public immutable shareOFT
```


### creatorCoin
The underlying Creator Coin (e.g., akita)


```solidity
IERC20 public creatorCoin
```


### wrapper
The wrapper to unwrap OFT → vault shares


```solidity
ICreatorOVaultWrapper public wrapper
```


### vault
The ERC-4626 vault (e.g., ▢AKITA)


```solidity
ICreatorOVault public vault
```


### vaultShares
Vault shares token (same as vault address, but as IERC20)


```solidity
IERC20 public vaultShares
```


### lotteryManager
Lottery manager for jackpot


```solidity
ICreatorLotteryManager public lotteryManager
```


### creatorTreasury
Creator's treasury wallet


```solidity
address public creatorTreasury
```


### protocolTreasury
Protocol multisig (CreatorVault treasury)


```solidity
address public protocolTreasury
```


### swapFeeTier
Swap fee tier for WETH → CreatorCoin


```solidity
uint24 public swapFeeTier = DEFAULT_SWAP_FEE
```


### swapSlippageBps
Slippage tolerance for swaps (in bps, default 100 = 1%)


```solidity
uint256 public swapSlippageBps = 100
```


### oracle
Oracle for price-based slippage protection


```solidity
ICreatorOracle public oracle
```


### oracleTwapDuration
TWAP duration for oracle price (default 30 min)


```solidity
uint32 public oracleTwapDuration = 1800
```


### useOracleSlippage
Whether to use oracle for slippage (if false, uses 0 minimum)


```solidity
bool public useOracleSlippage = true
```


### vaultGaugeVoting
VaultGaugeVoting for ve(3,3) probability direction


```solidity
IVaultGaugeVoting public vaultGaugeVoting
```


### voterRewardsDistributor
Voter rewards distributor (receives the 9.61% voter slice)


```solidity
IVoterRewardsDistributor public voterRewardsDistributor
```


### burnShareBps
Percentage to burn (increases PPS for all holders)


```solidity
uint256 public burnShareBps = 2139
```


### lotteryShareBps
Percentage to lottery reserve (jackpot)


```solidity
uint256 public lotteryShareBps = 6900
```


### creatorShareBps
Percentage to creator treasury


```solidity
uint256 public creatorShareBps = 0
```


### protocolShareBps
Percentage to protocol treasury (multisig)


```solidity
uint256 public protocolShareBps = 961
```


### pendingFees
Pending OFT fees to distribute


```solidity
uint256 public pendingFees
```


### distributionThreshold
Minimum amount before auto-distribution


```solidity
uint256 public distributionThreshold = 100e18
```


### lastDistribution
Last distribution timestamp


```solidity
uint256 public lastDistribution
```


### distributionInterval
Minimum time between distributions


```solidity
uint256 public distributionInterval = 1 hours
```


### jackpotReserve
Vault shares held as jackpot reserve


```solidity
uint256 public jackpotReserve
```


### totalSharesBurned
Total vault shares burned (lifetime)


```solidity
uint256 public totalSharesBurned
```


### totalLotteryFunded
Total distributed to lottery (lifetime)


```solidity
uint256 public totalLotteryFunded
```


### totalCreatorEarned
Total distributed to creator (lifetime)


```solidity
uint256 public totalCreatorEarned
```


### totalProtocolEarned
Total distributed to protocol (lifetime)


```solidity
uint256 public totalProtocolEarned
```


### totalFeesReceived
Total OFT fees received (lifetime)


```solidity
uint256 public totalFeesReceived
```


### totalWETHFeesReceived
Total WETH fees received from tax hook (lifetime)


```solidity
uint256 public totalWETHFeesReceived
```


### pendingWETHFees
Pending WETH fees from tax hook


```solidity
uint256 public pendingWETHFees
```


## Functions
### constructor

Create gauge controller for a Creator Coin vault


```solidity
constructor(address _shareOFT, address _creatorTreasury, address _protocolTreasury, address _owner)
    Ownable(_owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_shareOFT`|`address`|The ShareOFT token address (e.g., ■AKITA)|
|`_creatorTreasury`|`address`|Creator's treasury wallet|
|`_protocolTreasury`|`address`|Protocol multisig (CreatorVault treasury)|
|`_owner`|`address`|Owner (usually the creator)|


### receiveFees

Receive fees from CreatorShareOFT buy transactions

Called by ShareOFT when buy fees are collected
Fees arrive as OFT tokens (e.g., ■AKITA)


```solidity
function receiveFees(uint256 amount) external nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of OFT tokens received|


### deposit

Direct deposit for manual fee deposits


```solidity
function deposit(uint256 amount) external nonReentrant;
```

### receiveWETHFees

Receive WETH fees from the V4 Tax Hook

Called when swaps happen on the ■AKITA/ETH pool with tax hook
The tax hook sends WETH here, which we convert to vault shares


```solidity
function receiveWETHFees(uint256 amount) external nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of WETH received|


### receive

Receive native ETH (e.g., from tax hook that sends ETH directly)


```solidity
receive() external payable;
```

### processWETHFees

Process pending WETH fees: WETH → CreatorCoin → Vault → Distribute


```solidity
function processWETHFees() external nonReentrant;
```

### _processWETHFees


```solidity
function _processWETHFees() internal;
```

### _calculateMinOutput

Calculate minimum output for WETH → CreatorCoin swap using oracle


```solidity
function _calculateMinOutput(uint256 wethAmount) internal view returns (uint256 minOut);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`wethAmount`|`uint256`|Amount of WETH to swap|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`minOut`|`uint256`|Minimum Creator Coin to receive (0 if oracle disabled/unavailable)|


### distribute

Distribute accumulated fees

Can be called by anyone (permissionless)


```solidity
function distribute() external nonReentrant;
```

### forceDistribute

Force distribution (owner only, bypasses time check)


```solidity
function forceDistribute() external nonReentrant onlyOwner;
```

### _distribute


```solidity
function _distribute() internal;
```

### _distributeInternal


```solidity
function _distributeInternal() internal;
```

### _distributeVaultShares

Internal function to distribute vault shares according to fee split

Called from both OFT fee path and WETH fee path
DEFAULT SPLIT (bps): burn=2139, lottery=6900, creator=0, protocol=961


```solidity
function _distributeVaultShares(uint256 vaultSharesReceived) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vaultSharesReceived`|`uint256`|Amount of vault shares to distribute|


### payJackpot

Pay jackpot to lottery winner

Only callable by lottery manager


```solidity
function payJackpot(address winner, uint256 shares) external nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`winner`|`address`|Winner's address|
|`shares`|`uint256`|Amount of vault shares to pay|


### getJackpotReserve

Get available jackpot


```solidity
function getJackpotReserve() external view returns (uint256);
```

### setVault

Set the vault address


```solidity
function setVault(address _vault) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vault`|`address`|CreatorOVault address|


### setWrapper

Set the wrapper address


```solidity
function setWrapper(address _wrapper) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_wrapper`|`address`|CreatorOVaultWrapper address|


### setLotteryManager

Set the lottery manager


```solidity
function setLotteryManager(address _lotteryManager) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_lotteryManager`|`address`|Lottery manager address|


### setCreatorTreasury

Set creator treasury


```solidity
function setCreatorTreasury(address _treasury) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_treasury`|`address`|Creator's treasury wallet|


### setProtocolTreasury

Set protocol treasury (multisig)


```solidity
function setProtocolTreasury(address _treasury) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_treasury`|`address`|Protocol multisig address|


### setCreatorCoin

Set the creator coin address


```solidity
function setCreatorCoin(address _creatorCoin) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_creatorCoin`|`address`|Creator coin address (e.g., akita)|


### setSwapConfig

Set swap configuration for WETH → CreatorCoin


```solidity
function setSwapConfig(uint24 _feeTier, uint256 _slippageBps) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_feeTier`|`uint24`|Uniswap fee tier (100, 500, 3000, 10000)|
|`_slippageBps`|`uint256`|Slippage tolerance in basis points|


### setOracle

Set the oracle for price-based slippage protection


```solidity
function setOracle(address _oracle) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_oracle`|`address`|CreatorOracle address|


### setOracleConfig

Configure oracle settings


```solidity
function setOracleConfig(uint32 _twapDuration, bool _useOracle) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_twapDuration`|`uint32`|TWAP duration in seconds|
|`_useOracle`|`bool`|Whether to use oracle for slippage protection|


### setVaultGaugeVoting

Set VaultGaugeVoting for ve(3,3) probability direction


```solidity
function setVaultGaugeVoting(address _vaultGaugeVoting) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vaultGaugeVoting`|`address`|Address of the VaultGaugeVoting contract|


### setVoterRewardsDistributor

Set the voter rewards distributor to receive the 9.61% voter slice.

If unset, we fall back to protocolTreasury (or jackpot if that is unset).


```solidity
function setVoterRewardsDistributor(address _distributor) external onlyOwner;
```

### setFeeSplit

Update fee split


```solidity
function setFeeSplit(uint256 _burnBps, uint256 _lotteryBps, uint256 _creatorBps, uint256 _protocolBps)
    external
    onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_burnBps`|`uint256`|Percentage to burn (increases PPS)|
|`_lotteryBps`|`uint256`|Percentage to lottery (jackpot)|
|`_creatorBps`|`uint256`|Percentage to creator|
|`_protocolBps`|`uint256`|Percentage to protocol (multisig)|


### setDistributionThreshold

Set distribution threshold


```solidity
function setDistributionThreshold(uint256 _threshold) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_threshold`|`uint256`|Minimum OFT tokens before auto-distribution|


### setDistributionInterval

Set distribution interval


```solidity
function setDistributionInterval(uint256 _interval) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_interval`|`uint256`|Minimum time between distributions|


### getFeeSplit

Get current fee split configuration


```solidity
function getFeeSplit() external view returns (uint256 burn, uint256 lottery, uint256 creator, uint256 protocol);
```

### previewDistribution

Preview how pending fees would be distributed

Returns in vault shares (after unwrapping)


```solidity
function previewDistribution()
    external
    view
    returns (uint256 toBurn, uint256 toLottery, uint256 toCreator, uint256 toProtocol);
```

### getStats

Get lifetime statistics


```solidity
function getStats()
    external
    view
    returns (
        uint256 _totalFeesReceived,
        uint256 _totalWETHFeesReceived,
        uint256 _totalSharesBurned,
        uint256 _totalLotteryFunded,
        uint256 _totalCreatorEarned,
        uint256 _totalProtocolEarned,
        uint256 _pendingFees,
        uint256 _pendingWETHFees,
        uint256 _jackpotReserve,
        uint256 _lastDistribution
    );
```

### getTotalPendingFees

Get total pending fees (both OFT and WETH)


```solidity
function getTotalPendingFees()
    external
    view
    returns (uint256 oftPending, uint256 wethPending, uint256 totalPending);
```

### canDistribute

Check if distribution is possible


```solidity
function canDistribute() external view returns (bool);
```

### timeUntilDistribution

Time until next possible distribution


```solidity
function timeUntilDistribution() external view returns (uint256);
```

### estimatePPSIncrease

Estimate PPS increase from burning shares


```solidity
function estimatePPSIncrease(uint256 sharesToBurn) external view returns (uint256 ppsIncrease);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sharesToBurn`|`uint256`|Amount of shares that would be burned|


### getVaultInfo

Get vault info


```solidity
function getVaultInfo() external view returns (uint256 totalAssets, uint256 totalSupply, uint256 pricePerShare);
```

### previewSwap

Preview WETH → CreatorCoin swap output with slippage protection


```solidity
function previewSwap(uint256 wethAmount)
    external
    view
    returns (uint256 expectedOut, uint256 minOut, bool oracleActive);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`wethAmount`|`uint256`|Amount of WETH to swap|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`expectedOut`|`uint256`|Expected Creator Coin output (from oracle)|
|`minOut`|`uint256`|Minimum output after slippage|
|`oracleActive`|`bool`|Whether oracle slippage is active|


### getOracleInfo

Get oracle info


```solidity
function getOracleInfo()
    external
    view
    returns (
        address oracleAddress,
        bool isActive,
        bool priceFresh,
        int256 creatorPriceUSD,
        uint32 twapDuration,
        uint256 slippageBps
    );
```

### emergencyWithdraw

Emergency withdraw (owner only)


```solidity
function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|Token to withdraw|
|`amount`|`uint256`|Amount to withdraw|
|`to`|`address`|Recipient|


## Events
### FeesReceived

```solidity
event FeesReceived(address indexed from, uint256 oftAmount);
```

### WETHFeesReceived

```solidity
event WETHFeesReceived(address indexed from, uint256 wethAmount);
```

### FeesDistributed

```solidity
event FeesDistributed(
    uint256 sharesBurned, uint256 toLottery, uint256 toCreator, uint256 toProtocol, uint256 newPricePerShare
);
```

### WETHFeesProcessed

```solidity
event WETHFeesProcessed(uint256 wethAmount, uint256 creatorCoinReceived, uint256 sharesReceived);
```

### SharesBurned

```solidity
event SharesBurned(uint256 shares, uint256 newPPS);
```

### JackpotPaid

```solidity
event JackpotPaid(address indexed winner, uint256 shares);
```

### VaultSet

```solidity
event VaultSet(address indexed vault);
```

### WrapperSet

```solidity
event WrapperSet(address indexed wrapper);
```

### LotteryManagerSet

```solidity
event LotteryManagerSet(address indexed manager);
```

### CreatorTreasurySet

```solidity
event CreatorTreasurySet(address indexed treasury);
```

### ProtocolTreasurySet

```solidity
event ProtocolTreasurySet(address indexed treasury);
```

### CreatorCoinSet

```solidity
event CreatorCoinSet(address indexed coin);
```

### FeeSplitUpdated

```solidity
event FeeSplitUpdated(uint256 burnBps, uint256 lotteryBps, uint256 creatorBps, uint256 protocolBps);
```

### ThresholdUpdated

```solidity
event ThresholdUpdated(uint256 newThreshold);
```

### SwapConfigUpdated

```solidity
event SwapConfigUpdated(uint24 feeTier, uint256 slippageBps);
```

### OracleSet

```solidity
event OracleSet(address indexed oracle);
```

### OracleConfigUpdated

```solidity
event OracleConfigUpdated(uint32 twapDuration, bool useOracle);
```

### VaultGaugeVotingUpdated

```solidity
event VaultGaugeVotingUpdated(address indexed vaultGaugeVoting);
```

### VoterRewardsDistributorUpdated

```solidity
event VoterRewardsDistributorUpdated(address indexed distributor);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### InvalidSplit

```solidity
error InvalidSplit();
```

### NothingToDistribute

```solidity
error NothingToDistribute();
```

### TooSoon

```solidity
error TooSoon();
```

### VaultNotSet

```solidity
error VaultNotSet();
```

### WrapperNotSet

```solidity
error WrapperNotSet();
```

### CreatorCoinNotSet

```solidity
error CreatorCoinNotSet();
```

### InsufficientJackpot

```solidity
error InsufficientJackpot();
```

### OnlyLotteryManager

```solidity
error OnlyLotteryManager();
```

### SwapFailed

```solidity
error SwapFailed();
```

### InvalidSlippage

```solidity
error InvalidSlippage();
```

