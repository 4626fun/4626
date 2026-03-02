# IVaultGaugeVotingForBribesFactory
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/factories/BribesFactory.sol)

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

