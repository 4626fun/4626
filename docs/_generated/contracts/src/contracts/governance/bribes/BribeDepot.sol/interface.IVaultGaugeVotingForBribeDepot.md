# IVaultGaugeVotingForBribeDepot
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/governance/bribes/BribeDepot.sol)


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

