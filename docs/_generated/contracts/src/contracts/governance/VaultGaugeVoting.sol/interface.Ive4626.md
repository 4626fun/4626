# Ive4626
[Git Source](https://github.com/4626/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/governance/VaultGaugeVoting.sol)

**Title:**
VaultGaugeVoting

**Author:**
0xakita.eth

ve(3,3) style gauge voting for directing jackpot probability to creator vaults

VOTING MECHANISM:
ve4626 holders vote to direct jackpot probability to specific creator vaults.
This is similar to how veCRV/veVELO holders vote to direct emissions to pools,
but instead of emissions, we're directing PROBABILITY.

EPOCH SYSTEM:
- Weekly epochs (7 days), starting Thursday 00:00 UTC
- Users can vote anytime during an epoch
- Votes are tallied at epoch end
- Historical weights are stored per epoch

VOTING POWER:
- Voting power comes from ve4626 (locked ■4626)
- Users can split votes across multiple vaults
- Votes are normalized by user's total ve4626 balance


## Functions
### getVotingPower


```solidity
function getVotingPower(address user) external view returns (uint256);
```

### getTotalVotingPower


```solidity
function getTotalVotingPower() external view returns (uint256);
```

### hasActiveLock


```solidity
function hasActiveLock(address user) external view returns (bool);
```

