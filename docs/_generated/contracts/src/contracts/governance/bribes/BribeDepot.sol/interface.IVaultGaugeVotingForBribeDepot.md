# IVaultGaugeVotingForBribeDepot
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/governance/bribes/BribeDepot.sol)


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

