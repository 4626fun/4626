# IVaultGaugeVotingForBribesFactory
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/factories/BribesFactory.sol)

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

