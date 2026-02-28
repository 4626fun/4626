# IVaultGaugeVoting
[Git Source](https://github.com/4626/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/governance/VaultGaugeVoting.sol)

**Title:**
IVaultGaugeVoting

Interface for VaultGaugeVoting


## Functions
### vote


```solidity
function vote(address[] calldata vaults, uint256[] calldata weights) external;
```

### resetVotes


```solidity
function resetVotes() external;
```

### getVaultWeight


```solidity
function getVaultWeight(address vault) external view returns (uint256);
```

### getTotalWeight


```solidity
function getTotalWeight() external view returns (uint256);
```

### getVaultWeightBps


```solidity
function getVaultWeightBps(address vault) external view returns (uint256);
```

### getUserVotes


```solidity
function getUserVotes(address user) external view returns (address[] memory vaults, uint256[] memory weights);
```

### checkpoint


```solidity
function checkpoint() external;
```

### currentEpoch


```solidity
function currentEpoch() external view returns (uint256);
```

### epochStartTime


```solidity
function epochStartTime(uint256 epoch) external view returns (uint256);
```

## Events
### Voted

```solidity
event Voted(address indexed user, address indexed vault, uint256 weight, uint256 epoch);
```

### VotesReset

```solidity
event VotesReset(address indexed user, uint256 epoch);
```

### EpochCheckpointed

```solidity
event EpochCheckpointed(uint256 indexed epoch, uint256 totalWeight);
```

### VaultWhitelisted

```solidity
event VaultWhitelisted(address indexed vault, bool status);
```

