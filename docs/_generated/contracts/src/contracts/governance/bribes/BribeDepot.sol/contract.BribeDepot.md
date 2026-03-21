# BribeDepot
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/governance/bribes/BribeDepot.sol)

**Inherits:**
Ownable, ReentrancyGuard

**Title:**
BribeDepot

**Author:**
4626

Vault-scoped bribe depot for ve(3,3) voting epochs.

Deployed per-vault by BribesFactory using CREATE2.


## State Variables
### vault
Vault this depot is tied to


```solidity
address public immutable vault
```


### gaugeVoting
Gauge voting contract used for vote weights


```solidity
IVaultGaugeVotingForBribeDepot public immutable gaugeVoting
```


### totalBribes
epoch => token => total bribe amount


```solidity
mapping(uint256 => mapping(address => uint256)) public totalBribes
```


### claimed
epoch => token => user => claimed


```solidity
mapping(uint256 => mapping(address => mapping(address => bool))) public claimed
```


### claimedAmount
epoch => token => total amount paid out (sum of transfers attempted)


```solidity
mapping(uint256 => mapping(address => uint256)) public claimedAmount
```


### isClosed
epoch => token => closed (no further claims; may have been rolled forward)


```solidity
mapping(uint256 => mapping(address => bool)) public isClosed
```


### rolloverGraceEpochs
Number of epochs to wait before rolling forward leftover bribes.

4 epochs ≈ 4 weeks after the epoch ends.


```solidity
uint256 public rolloverGraceEpochs = 4
```


## Functions
### constructor


```solidity
constructor(address _vault, address _gaugeVoting) Ownable(msg.sender);
```

### bribe

Add bribe tokens for the current epoch.


```solidity
function bribe(address token, uint256 amount) external nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|Token to bribe with|
|`amount`|`uint256`|Amount to bribe|


### claim

Claim bribe rewards for a past epoch.


```solidity
function claim(uint256 epoch, address token) external nonReentrant returns (uint256 amount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`epoch`|`uint256`|Epoch to claim|
|`token`|`address`|Token to claim|


### rolloverZeroVoteEpoch

Roll bribes from an epoch with zero vault weight into the current epoch.

Safe because there were no eligible claimants for that epoch.


```solidity
function rolloverZeroVoteEpoch(uint256 epoch, address token) external nonReentrant returns (uint256 rolled);
```

### rolloverExpiredEpoch

Roll leftover (unclaimed + rounding dust) forward after a grace period.

Once rolled, the epoch/token is closed and can no longer be claimed.


```solidity
function rolloverExpiredEpoch(uint256 epoch, address token) external nonReentrant returns (uint256 rolled);
```

## Events
### Bribed

```solidity
event Bribed(address indexed token, uint256 amount, uint256 indexed epoch);
```

### Claimed

```solidity
event Claimed(address indexed user, address indexed token, uint256 amount, uint256 indexed epoch);
```

### BribeRolledOver

```solidity
event BribeRolledOver(address indexed token, uint256 indexed fromEpoch, uint256 indexed toEpoch, uint256 amount);
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

### AlreadyClaimed

```solidity
error AlreadyClaimed();
```

### NoUserVotes

```solidity
error NoUserVotes();
```

### EpochNotEnded

```solidity
error EpochNotEnded();
```

### EpochClosed

```solidity
error EpochClosed();
```

### RolloverNotAllowedYet

```solidity
error RolloverNotAllowedYet();
```

### NotZeroVoteEpoch

```solidity
error NotZeroVoteEpoch();
```

