# IVaultGaugeVotingForBribeDepot
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/governance/bribes/BribeDepot.sol)


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

### canReceiveVotes


```solidity
function canReceiveVotes(address vault) external view returns (bool);
```

