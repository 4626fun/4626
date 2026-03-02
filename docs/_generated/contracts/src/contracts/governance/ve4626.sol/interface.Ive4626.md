# Ive4626
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/governance/ve4626.sol)

**Titles:**
ve4626 - 4626 Protocol Token, Ive4626

**Author:**
0xakita.eth

Vote-escrowed ERC4626 (ve■4626) for protocol-wide boosts.

Interface for ve4626 (Vote-Escrowed ■4626)

Users lock ■4626 to get voting power and lottery boosts.


## Functions
### lock


```solidity
function lock(address token, uint256 amount, uint256 duration) external returns (uint256 votingPower);
```

### extendLock


```solidity
function extendLock(uint256 newEnd) external returns (uint256 newVotingPower);
```

### increaseLock


```solidity
function increaseLock(uint256 amount) external returns (uint256 newVotingPower);
```

### unlock


```solidity
function unlock() external returns (uint256 amount);
```

### getLock


```solidity
function getLock(address user) external view returns (Lock memory);
```

### votingPower


```solidity
function votingPower(address user) external view returns (uint256);
```

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

### MIN_LOCK_DURATION


```solidity
function MIN_LOCK_DURATION() external view returns (uint256);
```

### MAX_LOCK_DURATION


```solidity
function MAX_LOCK_DURATION() external view returns (uint256);
```

## Events
### Locked

```solidity
event Locked(address indexed user, address indexed token, uint256 amount, uint256 lockEnd, uint256 votingPower);
```

### LockExtended

```solidity
event LockExtended(address indexed user, uint256 oldEnd, uint256 newEnd, uint256 newVotingPower);
```

### LockIncreased

```solidity
event LockIncreased(address indexed user, uint256 addedAmount, uint256 totalAmount, uint256 newVotingPower);
```

### Unlocked

```solidity
event Unlocked(address indexed user, uint256 amount, address token);
```

## Errors
### InvalidToken

```solidity
error InvalidToken();
```

### ZeroAmount

```solidity
error ZeroAmount();
```

### InvalidLockDuration

```solidity
error InvalidLockDuration();
```

### NoExistingLock

```solidity
error NoExistingLock();
```

### LockDurationTooShort

```solidity
error LockDurationTooShort();
```

### LockExpired

```solidity
error LockExpired();
```

### LockNotExpired

```solidity
error LockNotExpired();
```

## Structs
### Lock

```solidity
struct Lock {
    uint256 amount;
    uint256 end;
    uint256 start;
    address lockedToken;
    uint256 underlyingValue;
}
```

