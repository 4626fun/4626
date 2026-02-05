# IVaultGaugeVotingForBribeDepot
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/governance/bribes/BribeDepot.sol)


## Functions
### currentEpoch


```solidity
function currentEpoch() external view returns (uint256);
```

### getVaultWeightAtEpoch


```solidity
function getVaultWeightAtEpoch(uint256 epoch, address vault) external view returns (uint256);
```

### getUserVoteWeightAtEpoch


```solidity
function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256);
```

