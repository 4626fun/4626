# IVaultGaugeVotingForBribesFactory
[Git Source](https://github.com/creatorvault/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/contracts/factories/BribesFactory.sol)

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

