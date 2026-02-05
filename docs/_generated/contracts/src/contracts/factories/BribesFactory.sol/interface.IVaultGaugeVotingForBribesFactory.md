# IVaultGaugeVotingForBribesFactory
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/factories/BribesFactory.sol)

**Title:**
BribesFactory

**Author:**
CreatorVault

Deterministically deploys (CREATE2) a BribeDepot per vault gauge.
Vault address is treated as the gauge id.


## Functions
### canReceiveVotes


```solidity
function canReceiveVotes(address vault) external view returns (bool);
```

