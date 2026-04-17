# CreatorLinearVesting
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/utilities/vesting/CreatorLinearVesting.sol)

**Title:**
CreatorLinearVesting

Minimal linear vesting wallet for the creator’s ShareOFT allocation.

Intentionally small/simple (no cliff, no revocation) to minimize deployment gas.


## State Variables
### token

```solidity
IERC20 public immutable token
```


### beneficiary

```solidity
address public immutable beneficiary
```


### startTimestamp

```solidity
uint64 public immutable startTimestamp
```


### durationSeconds

```solidity
uint64 public immutable durationSeconds
```


### released

```solidity
uint256 public released
```


### totalAllocation

```solidity
uint256 public totalAllocation
```


### seeded

```solidity
bool public seeded
```


## Functions
### constructor


```solidity
constructor(address token_, address beneficiary_, uint64 startTimestamp_, uint64 durationSeconds_) ;
```

### seed


```solidity
function seed() external;
```

### vestedAmount


```solidity
function vestedAmount(uint64 timestamp) public view returns (uint256);
```

### releasable


```solidity
function releasable() public view returns (uint256);
```

### release


```solidity
function release() external returns (uint256 amount);
```

### release


```solidity
function release(address to) external returns (uint256 amount);
```

## Events
### Released

```solidity
event Released(address indexed beneficiary, address indexed to, uint256 amount);
```

### Seeded

```solidity
event Seeded(uint256 totalAllocation);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### ZeroDuration

```solidity
error ZeroDuration();
```

### NotBeneficiary

```solidity
error NotBeneficiary();
```

### AlreadySeeded

```solidity
error AlreadySeeded();
```

### NotSeeded

```solidity
error NotSeeded();
```

