# IVaultGaugeVotingForBribesFactory
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/factories/BribesFactory.sol)

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

