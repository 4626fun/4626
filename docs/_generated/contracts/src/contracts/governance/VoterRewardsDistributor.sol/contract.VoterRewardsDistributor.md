# VoterRewardsDistributor
[Git Source](https://github.com/4626/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/governance/VoterRewardsDistributor.sol)

**Inherits:**
Ownable, ReentrancyGuard


## State Variables
### BPS

```solidity
uint256 public constant BPS = 10_000
```


### gaugeVoting

```solidity
IVaultGaugeVotingForRewards public immutable gaugeVoting
```


### protocolTreasury
Where zero-vote epoch rewards are swept after the grace period.

Set by owner; must be non-zero before sweeping is enabled.


```solidity
address public protocolTreasury
```


### sweepGraceEpochs
Number of weekly epochs to wait before allowing a zero-vote epoch sweep.

4 epochs ≈ 4 weeks after the epoch ends (sweepable starting epoch+5).


```solidity
uint256 public sweepGraceEpochs = 4
```


### vaultRewardToken
Vault => reward token (vault shares token). Set on first notification.


```solidity
mapping(address => address) public vaultRewardToken
```


### epochVaultRewards
epoch => vault => total rewards (in vault share tokens)


```solidity
mapping(uint256 => mapping(address => uint256)) public epochVaultRewards
```


### hasClaimed
epoch => vault => user => claimed?


```solidity
mapping(uint256 => mapping(address => mapping(address => bool))) public hasClaimed
```


## Functions
### constructor


```solidity
constructor(address _gaugeVoting, address _owner) Ownable(_owner);
```

### setProtocolTreasury


```solidity
function setProtocolTreasury(address _protocolTreasury) external onlyOwner;
```

### notifyRewards

Notify rewards for a vault for the current epoch.

Caller must have approved `token` to this contract.


```solidity
function notifyRewards(address vault, address token, uint256 amount) external nonReentrant;
```

### sweepZeroVoteEpoch

Sweep rewards for a (epoch, vault) that had 0 votes, after the grace period.

Your selected policy:
- sweepGraceEpochs = 4
- sweep only when vault vote weight == 0 for that epoch
- sweep to protocolTreasury


```solidity
function sweepZeroVoteEpoch(address vault, uint256 epoch) external onlyOwner nonReentrant returns (uint256 amount);
```

### previewClaim


```solidity
function previewClaim(address user, address vault, uint256 epoch) external view returns (uint256 amount);
```

### claim


```solidity
function claim(address vault, uint256 epoch) external nonReentrant returns (uint256 amount);
```

### claimMany


```solidity
function claimMany(address[] calldata vaults, uint256 epoch) external nonReentrant returns (uint256 totalAmount);
```

### _claim


```solidity
function _claim(address user, address vault, uint256 epoch) internal returns (uint256 amount);
```

## Events
### RewardsNotified

```solidity
event RewardsNotified(uint256 indexed epoch, address indexed vault, address indexed token, uint256 amount);
```

### RewardTokenSet

```solidity
event RewardTokenSet(address indexed vault, address indexed token);
```

### Claimed

```solidity
event Claimed(uint256 indexed epoch, address indexed vault, address indexed user, address token, uint256 amount);
```

### ProtocolTreasuryUpdated

```solidity
event ProtocolTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
```

### ZeroVoteEpochSwept

```solidity
event ZeroVoteEpochSwept(
    uint256 indexed epoch, address indexed vault, address indexed token, uint256 amount, address protocolTreasury
);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### ZeroAmount

```solidity
error ZeroAmount();
```

### RewardTokenMismatch

```solidity
error RewardTokenMismatch();
```

### ProtocolTreasuryNotSet

```solidity
error ProtocolTreasuryNotSet();
```

### SweepNotAllowedYet

```solidity
error SweepNotAllowedYet();
```

### NotZeroVoteEpoch

```solidity
error NotZeroVoteEpoch();
```

### EpochNotEnded

```solidity
error EpochNotEnded();
```

