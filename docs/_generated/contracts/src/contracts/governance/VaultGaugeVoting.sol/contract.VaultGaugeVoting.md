# VaultGaugeVoting
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/governance/VaultGaugeVoting.sol)

**Inherits:**
[IVaultGaugeVoting](/contracts/governance/CreatorGaugeController.sol/interface.IVaultGaugeVoting.md), Ownable, ReentrancyGuard


## State Variables
### EPOCH_DURATION

```solidity
uint256 public constant EPOCH_DURATION = 7 days
```


### PPM_PRECISION

```solidity
uint256 public constant PPM_PRECISION = 1_000_000
```


### TOTAL_GAUGE_PROBABILITY_PPM
FIXED total gauge probability budget (PPM)


```solidity
uint256 public constant TOTAL_GAUGE_PROBABILITY_PPM = 69_420
```


### MAX_PER_VAULT_PPM
Max any single vault can receive (PPM).


```solidity
uint256 public constant MAX_PER_VAULT_PPM = 35_000
```


### MAX_VAULTS_PER_VOTE
Maximum number of vaults a user can vote for at once


```solidity
uint256 public constant MAX_VAULTS_PER_VOTE = 10
```


### genesisEpochStart
Genesis epoch start (first Thursday 00:00 UTC after deployment)


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


```solidity
function vote(address[] calldata vaults, uint256[] calldata weights) external override nonReentrant;
```

### resetVotes


```solidity
function resetVotes() external override nonReentrant;
```

### _clearUserVotes


```solidity
function _clearUserVotes(uint256 epoch, address user) internal;
```

### checkpoint


```solidity
function checkpoint() external override;
```

### currentEpoch


```solidity
function currentEpoch() public view override returns (uint256);
```

### epochStartTime


```solidity
function epochStartTime(uint256 epoch) public view override returns (uint256);
```

### epochEndTime


```solidity
function epochEndTime(uint256 epoch) public view returns (uint256);
```

### timeUntilNextEpoch


```solidity
function timeUntilNextEpoch() public view returns (uint256);
```

### getTotalGaugeProbabilityBps

Fixed total gauge probability budget in bps (compatibility helper)


```solidity
function getTotalGaugeProbabilityBps() public pure returns (uint256);
```

### getTotalGaugeProbabilityPPM

Fixed total gauge probability budget (PPM)


```solidity
function getTotalGaugeProbabilityPPM() public pure returns (uint256);
```

### getVaultGaugeProbabilityBoostPPM

Vault's vote-directed probability boost in PPM (flat additive to lottery)

Uses fixed 69,420 PPM budget + per-vault cap


```solidity
function getVaultGaugeProbabilityBoostPPM(address vault) external view returns (uint256 boostPPM);
```

### getVaultWeight


```solidity
function getVaultWeight(address vault) external view override returns (uint256);
```

### getTotalWeight


```solidity
function getTotalWeight() external view override returns (uint256);
```

### getVaultWeightBps


```solidity
function getVaultWeightBps(address vault) external view override returns (uint256);
```

### getUserVotes


```solidity
function getUserVotes(address user)
    external
    view
    override
    returns (address[] memory vaults, uint256[] memory weights);
```

### hasVotedThisEpoch

Compatibility helper for existing integrators.


```solidity
function hasVotedThisEpoch(address user) external view returns (bool);
```

### getVaultWeightAtEpoch


```solidity
function getVaultWeightAtEpoch(uint256 epoch, address vault) external view returns (uint256);
```

### getUserVoteWeightAtEpoch


```solidity
function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256);
```

### getWhitelistedVaults


```solidity
function getWhitelistedVaults() external view returns (address[] memory);
```

### whitelistedVaultCount


```solidity
function whitelistedVaultCount() external view returns (uint256);
```

### _isVaultWhitelisted


```solidity
function _isVaultWhitelisted(address vault) internal view returns (bool);
```

### canReceiveVotes


```solidity
function canReceiveVotes(address vault) external view returns (bool);
```

### setVaultWhitelist


```solidity
function setVaultWhitelist(address vault, bool status) external onlyOwner;
```

### batchSetVaultWhitelist


```solidity
function batchSetVaultWhitelist(address[] calldata vaults, bool[] calldata statuses) external onlyOwner;
```

### setRegistry


```solidity
function setRegistry(address _registry) external onlyOwner;
```

### setUseRegistryWhitelist


```solidity
function setUseRegistryWhitelist(bool enabled) external onlyOwner;
```

### emergencyResetAllVotes


```solidity
function emergencyResetAllVotes() external onlyOwner;
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

