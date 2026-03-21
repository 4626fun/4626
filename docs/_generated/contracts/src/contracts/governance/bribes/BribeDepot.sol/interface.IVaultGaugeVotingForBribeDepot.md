# IVaultGaugeVotingForBribeDepot
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/governance/bribes/BribeDepot.sol)


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

