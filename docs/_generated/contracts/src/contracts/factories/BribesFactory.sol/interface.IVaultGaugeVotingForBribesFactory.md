# IVaultGaugeVotingForBribesFactory
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/factories/BribesFactory.sol)

**Title:**
BribesFactory

**Author:**
4626

Deterministically deploys (CREATE2) a BribeDepot per vault gauge.
Vault address is treated as the gauge id.


## Functions
### canReceiveVotes


```solidity
function canReceiveVotes(address vault) external view returns (bool);
```

