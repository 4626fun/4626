# CreatorLinearVesting
[Git Source](https://github.com/creatorvault/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/contracts/helpers/vesting/CreatorLinearVesting.sol)

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


## Functions
### constructor


```solidity
constructor(address token_, address beneficiary_, uint64 startTimestamp_, uint64 durationSeconds_) ;
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

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### ZeroDuration

```solidity
error ZeroDuration();
```

