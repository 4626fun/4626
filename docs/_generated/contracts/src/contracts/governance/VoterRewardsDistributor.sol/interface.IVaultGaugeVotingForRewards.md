# IVaultGaugeVotingForRewards
[Git Source](https://github.com/creatorvault/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/contracts/governance/VoterRewardsDistributor.sol)

**Title:**
VoterRewardsDistributor

**Author:**
0xakita.eth

Distributes the "protocol" fee slice to ve4626 voters (ve(3,3) mechanics)

Inspired by ve(3,3) systems where voters receive fees/bribes for voting on gauges.
Conceptually similar to bribe/fee-distributor patterns used in b(3,3)/ve(3,3) stacks
(e.g. Hermes V2) but simplified for CreatorVault.
How it works:
- Each CreatorGaugeController sends its voter slice (currently 9.61%) to this contract.
- The slice is recorded per (epoch, vault).
- Users claim pro-rata by their vote weight for that (epoch, vault).
Reward token:
- We distribute vault shares (sTOKEN / ERC-4626 shares) for that vault.
- This keeps everything composable: users can hold shares or redeem underlying.


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

