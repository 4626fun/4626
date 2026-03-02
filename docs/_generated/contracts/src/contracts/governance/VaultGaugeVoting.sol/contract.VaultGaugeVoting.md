# VaultGaugeVoting
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/governance/VaultGaugeVoting.sol)

**Inherits:**
[IVaultGaugeVoting](/contracts/governance/CreatorGaugeController.sol/interface.IVaultGaugeVoting.md), Ownable, ReentrancyGuard


## State Variables
### EPOCH_DURATION
Duration of each epoch (7 days)


```solidity
uint256 public constant EPOCH_DURATION = 7 days
```


### BPS_PRECISION
Precision for basis points (10000 = 100%)


```solidity
uint256 public constant BPS_PRECISION = 10000
```


### PPM_PRECISION
Precision for probability in PPM (1,000,000 = 100%)


```solidity
uint256 public constant PPM_PRECISION = 1_000_000
```


### MAX_VAULTS_PER_VOTE
Maximum number of vaults a user can vote for at once


```solidity
uint256 public constant MAX_VAULTS_PER_VOTE = 10
```


### genesisEpochStart
Genesis epoch start (first Thursday 00:00 UTC after deployment)

This is set in constructor to the next Thursday 00:00 UTC


```solidity
uint256 public immutable genesisEpochStart
```


### ve4626
ve4626 token for voting power


```solidity
Ive4626 public immutable ve4626
```


### registry
Optional registry for auto-whitelisting vaults


```solidity
ICreatorRegistry public registry
```


### useRegistryWhitelist
Whether to use registry for whitelist


```solidity
bool public useRegistryWhitelist
```


### isWhitelistedVault
Manually whitelisted vaults


```solidity
mapping(address => bool) public isWhitelistedVault
```


### _whitelistedVaults
Set of all whitelisted vaults


```solidity
EnumerableSet.AddressSet private _whitelistedVaults
```


### minCreatorsForBudget
Total gauge probability budget (in bps) is derived from creator count (and optionally TVL).
The intent: ve4626 votes allocate a bounded pool of "probability bps" each week,
analogous to emissions in ve(3,3) systems.
Example target behavior:
- 5 creators  → 100 bps total (1.00%)
- 100 creators → 300 bps total (3.00%)
We implement a simple linear interpolation on creator count (whitelisted vault count),
and allow an optional multiplicative TVL multiplier for future tuning.


```solidity
uint256 public minCreatorsForBudget = 5
```


### maxCreatorsForBudget

```solidity
uint256 public maxCreatorsForBudget = 100
```


### minTotalGaugeProbabilityBps

```solidity
uint256 public minTotalGaugeProbabilityBps = 100
```


### maxTotalGaugeProbabilityBps

```solidity
uint256 public maxTotalGaugeProbabilityBps = 300
```


### tvlMultiplierBps
Optional multiplier for future TVL-based scaling (10000 = 1.0x)


```solidity
uint256 public tvlMultiplierBps = BPS_PRECISION
```


### _epochVaultVotes
Vault votes per epoch: epoch => vault => total votes (ve4626-weighted)


```solidity
mapping(uint256 => mapping(address => uint256)) private _epochVaultVotes
```


### _epochTotalVotes
Total votes per epoch: epoch => total votes


```solidity
mapping(uint256 => uint256) private _epochTotalVotes
```


### _epochUserVaultVotes
User votes per epoch: epoch => user => vault => votes


```solidity
mapping(uint256 => mapping(address => mapping(address => uint256))) private _epochUserVaultVotes
```


### _epochUserVotedVaults
Set of vaults a user voted for in a given epoch: epoch => user => set(vault)


```solidity
mapping(uint256 => mapping(address => EnumerableSet.AddressSet)) private _epochUserVotedVaults
```


### lastCheckpointedEpoch
Last epoch that emitted a checkpoint event (for UI/debug)


```solidity
uint256 public lastCheckpointedEpoch
```


### _epochCheckpointed
Tracks which epochs have emitted `EpochCheckpointed` (idempotency guard).


```solidity
mapping(uint256 => bool) private _epochCheckpointed
```


## Functions
### constructor

Constructor


```solidity
constructor(address _ve4626, address owner_) Ownable(owner_);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_ve4626`|`address`|ve4626 token address|
|`owner_`|`address`|Owner address|


### vote

Vote for vaults with specified weights

Weights are relative - [100, 50, 50] means 50%/25%/25%


```solidity
function vote(address[] calldata vaults, uint256[] calldata weights) external override nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vaults`|`address[]`|Array of vault addresses to vote for|
|`weights`|`uint256[]`|Array of relative weights for each vault|


### resetVotes

Reset all votes for the caller


```solidity
function resetVotes() external override nonReentrant;
```

### _clearUserVotes

Clear all votes for a user


```solidity
function _clearUserVotes(uint256 epoch, address user) internal;
```

### checkpoint

Checkpoint the most recently ended epoch (anyone can call)

Emits exactly once per ended epoch (integrator-safe, idempotent).


```solidity
function checkpoint() external override;
```

### currentEpoch

Get the current epoch number


```solidity
function currentEpoch() public view override returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Current epoch (0-indexed from genesis)|


### epochStartTime

Get the start time of a specific epoch


```solidity
function epochStartTime(uint256 epoch) public view override returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`epoch`|`uint256`|Epoch number|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Start timestamp of the epoch|


### epochEndTime

Get the end time of a specific epoch


```solidity
function epochEndTime(uint256 epoch) public view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`epoch`|`uint256`|Epoch number|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|End timestamp of the epoch|


### timeUntilNextEpoch

Get time remaining in current epoch


```solidity
function timeUntilNextEpoch() public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Seconds until epoch ends|


### getTotalGaugeProbabilityBps

Total gauge probability budget in bps (basis points) for the current system size.

Uses whitelisted vault count as the proxy for number of active creators.


```solidity
function getTotalGaugeProbabilityBps() public view returns (uint256 budgetBps);
```

### getTotalGaugeProbabilityPPM

Total gauge probability budget in PPM (parts per million) for easier, low-rounding math.

1 bps = 100 PPM.


```solidity
function getTotalGaugeProbabilityPPM() public view returns (uint256);
```

### getVaultGaugeProbabilityBoostPPM

Vault's vote-directed probability boost in PPM.

This is the vault's share of the total gauge probability budget, based on ve4626 votes.
Rules:
- If totalVotes == 0: equal split across whitelisted vaults
- If vault is not whitelisted: 0


```solidity
function getVaultGaugeProbabilityBoostPPM(address vault) external view returns (uint256 boostPPM);
```

### getVaultWeight

Get total votes for a vault


```solidity
function getVaultWeight(address vault) external view override returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vault`|`address`|Vault address|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Total voting weight for the vault|


### getTotalWeight

Get total votes across all vaults


```solidity
function getTotalWeight() external view override returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Total voting weight|


### getVaultWeightBps

Get vault's weight as basis points of total


```solidity
function getVaultWeightBps(address vault) external view override returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vault`|`address`|Vault address|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Weight in basis points (0-10000)|


### getHistoricalVaultWeight

Get historical vault weight for a specific epoch


```solidity
function getHistoricalVaultWeight(uint256 epoch, address vault) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`epoch`|`uint256`|Epoch number|
|`vault`|`address`|Vault address|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Weight for that epoch|


### getHistoricalTotalWeight

Get historical total weight for a specific epoch


```solidity
function getHistoricalTotalWeight(uint256 epoch) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`epoch`|`uint256`|Epoch number|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Total weight for that epoch|


### getUserVotes

Get all vaults a user voted for and their weights


```solidity
function getUserVotes(address user)
    external
    view
    override
    returns (address[] memory vaults, uint256[] memory weights);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|User address|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`vaults`|`address[]`|Array of vault addresses|
|`weights`|`uint256[]`|Array of vote weights|


### hasVotedThisEpoch

Check if user has voted in current epoch


```solidity
function hasVotedThisEpoch(address user) external view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|User address|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|True if user has voted|


### getVaultWeightAtEpoch


```solidity
function getVaultWeightAtEpoch(uint256 epoch, address vault) external view returns (uint256);
```

### getTotalWeightAtEpoch


```solidity
function getTotalWeightAtEpoch(uint256 epoch) external view returns (uint256);
```

### getUserVoteWeightAtEpoch


```solidity
function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256);
```

### getWhitelistedVaults

Get all whitelisted vaults


```solidity
function getWhitelistedVaults() external view returns (address[] memory);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address[]`|Array of whitelisted vault addresses|


### whitelistedVaultCount

Get number of whitelisted vaults


```solidity
function whitelistedVaultCount() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Count of whitelisted vaults|


### _isVaultWhitelisted

Check if a vault is whitelisted


```solidity
function _isVaultWhitelisted(address vault) internal view returns (bool);
```

### _isVaultRegistered


```solidity
function _isVaultRegistered(address vault) internal view returns (bool);
```

### canReceiveVotes

Check if a vault can receive votes


```solidity
function canReceiveVotes(address vault) external view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vault`|`address`|Vault address|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|True if vault is whitelisted|


### setVaultWhitelist

Whitelist or remove a vault (admin only)


```solidity
function setVaultWhitelist(address vault, bool status) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vault`|`address`|Vault address|
|`status`|`bool`|True to whitelist, false to remove|


### batchSetVaultWhitelist

Batch whitelist vaults


```solidity
function batchSetVaultWhitelist(address[] calldata vaults, bool[] calldata statuses) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vaults`|`address[]`|Array of vault addresses|
|`statuses`|`bool[]`|Array of whitelist statuses|


### setRegistry

Set the creator registry for auto-whitelisting


```solidity
function setRegistry(address _registry) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_registry`|`address`|Registry address|


### setUseRegistryWhitelist

Enable/disable registry-based whitelisting


```solidity
function setUseRegistryWhitelist(bool enabled) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`enabled`|`bool`|True to enable|


### setGaugeProbabilityBudgetParams

Configure the creator-count → probability-budget curve.

Values are in basis points (bps). Must keep min <= max.


```solidity
function setGaugeProbabilityBudgetParams(
    uint256 _minCreators,
    uint256 _maxCreators,
    uint256 _minBudgetBps,
    uint256 _maxBudgetBps
) external onlyOwner;
```

### setGaugeProbabilityTvlMultiplierBps

Set an optional multiplier for future TVL-based scaling (10000 = 1.0x).


```solidity
function setGaugeProbabilityTvlMultiplierBps(uint256 _tvlMultiplierBps) external onlyOwner;
```

### emergencyResetAllVotes

Emergency reset of all votes (admin only)

Only use in case of critical bug


```solidity
function emergencyResetAllVotes() external onlyOwner;
```

## Events
### GaugeProbabilityBudgetParamsUpdated

```solidity
event GaugeProbabilityBudgetParamsUpdated(
    uint256 minCreators, uint256 maxCreators, uint256 minBudgetBps, uint256 maxBudgetBps
);
```

### GaugeProbabilityTvlMultiplierUpdated

```solidity
event GaugeProbabilityTvlMultiplierUpdated(uint256 tvlMultiplierBps);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### NoVotingPower

```solidity
error NoVotingPower();
```

### VaultNotWhitelisted

```solidity
error VaultNotWhitelisted(address vault);
```

### TooManyVaults

```solidity
error TooManyVaults();
```

### ArrayLengthMismatch

```solidity
error ArrayLengthMismatch();
```

### ZeroWeight

```solidity
error ZeroWeight();
```

### EpochNotEnded

```solidity
error EpochNotEnded();
```

### LockExpiresBeforeEpochEnd

```solidity
error LockExpiresBeforeEpochEnd();
```

