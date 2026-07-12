# Ive4626GaugeVotingForBribesFactory4626
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/factories/BribesFactory4626.sol)

**Title:**
BribesFactory4626

**Author:**
4626

Deterministically deploys (CREATE2) a BribeDepot4626 per vault gauge.
Vault address is treated as the gauge id.


## Functions
### canReceiveVotes


```solidity
function canReceiveVotes(address vault) external view returns (bool);
```

