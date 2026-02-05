# BribeDepot
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/governance/bribes/BribeDepot.sol)

**Inherits:**
Ownable, ReentrancyGuard

**Title:**
BribeDepot

**Author:**
CreatorVault

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


## Events
### Bribed

```solidity
event Bribed(address indexed token, uint256 amount, uint256 indexed epoch);
```

### Claimed

```solidity
event Claimed(address indexed user, address indexed token, uint256 amount, uint256 indexed epoch);
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

