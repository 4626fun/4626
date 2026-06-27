# ve4626
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/governance/ve4626.sol)

**Inherits:**
[Ive4626](/contracts/governance/VaultGaugeVoting.sol/interface.Ive4626.md), Ownable, ERC20, ERC20Permit, ERC20Votes, ReentrancyGuard


## Constants
### MIN_LOCK_DURATION

```solidity
uint256 public constant override MIN_LOCK_DURATION = 7 days
```


### MAX_LOCK_DURATION

```solidity
uint256 public constant override MAX_LOCK_DURATION = 4 * 365 days
```


### wrappedShareOFT
Wrapped ShareOFT token (e.g., ■4626)


```solidity
address public immutable wrappedShareOFT
```


## State Variables
### vault
Vault for calculating underlying value


```solidity
address public vault
```


### boostManager
Boost manager address


```solidity
address public boostManager
```


### _locks
User locks


```solidity
mapping(address => Lock) private _locks
```


### _totalVotingSupply
Total voting supply


```solidity
uint256 private _totalVotingSupply
```


### _totalSupplyCheckpoints

```solidity
SupplyCheckpoint[] private _totalSupplyCheckpoints
```


## Functions
### constructor

Constructor


```solidity
constructor(string memory _name, string memory _symbol, address _wrappedShareOFT, address _owner)
    ERC20(_name, _symbol)
    ERC20Permit(_name)
    Ownable(_owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_name`|`string`|Token name (e.g., "Vote-Escrowed Wrapped 4626 Share")|
|`_symbol`|`string`|Token symbol (e.g., "ve■4626")|
|`_wrappedShareOFT`|`address`|The ■4626 (or similar) token to lock|
|`_owner`|`address`|Owner address|


### lock

Lock wrapped shares (■4626) to receive voting power


```solidity
function lock(address _token, uint256 amount, uint256 duration)
    external
    override
    nonReentrant
    returns (uint256 votingPowerAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_token`|`address`|Token to lock (must be wrappedShareOFT)|
|`amount`|`uint256`|Amount to lock|
|`duration`|`uint256`|Lock duration in seconds|


### extendLock

Extend lock duration


```solidity
function extendLock(uint256 newEnd) external override nonReentrant returns (uint256 newVotingPower);
```

### increaseLock

Increase lock amount


```solidity
function increaseLock(uint256 amount) external override nonReentrant returns (uint256 newVotingPower);
```

### unlock

Unlock tokens after lock expires


```solidity
function unlock() external override nonReentrant returns (uint256 amount);
```

### burnExpiredLock


```solidity
function burnExpiredLock(address user) external override nonReentrant;
```

### _calculateVotingPower


```solidity
function _calculateVotingPower(uint256 amount, uint256 lockEnd) internal view returns (uint256);
```

### _getUnderlyingValue


```solidity
function _getUnderlyingValue(
    address,
    /* token */
    uint256 amount
)
    internal
    view
    returns (uint256);
```

### _notifyBoostManager


```solidity
function _notifyBoostManager(address user) internal;
```

### getLock


```solidity
function getLock(address user) external view override returns (Lock memory);
```

### votingPower


```solidity
function votingPower(address user) public view override returns (uint256);
```

### getVotingPower


```solidity
function getVotingPower(address user) external view override returns (uint256);
```

### votingPowerAt


```solidity
function votingPowerAt(address user, uint256 timestamp) external view returns (uint256);
```

### getTotalVotingPower


```solidity
function getTotalVotingPower() external view override returns (uint256);
```

### totalVotingSupply


```solidity
function totalVotingSupply() external view returns (uint256);
```

### hasActiveLock


```solidity
function hasActiveLock(address user) external view override returns (bool);
```

### getRemainingLockTime


```solidity
function getRemainingLockTime(address user) external view returns (uint256);
```

### setVault


```solidity
function setVault(address _vault) external onlyOwner;
```

### setBoostManager


```solidity
function setBoostManager(address _boostManager) external onlyOwner;
```

### transfer


```solidity
function transfer(address, uint256) public pure override returns (bool);
```

### transferFrom


```solidity
function transferFrom(address, address, uint256) public pure override returns (bool);
```

### approve


```solidity
function approve(address, uint256) public pure override returns (bool);
```

### _update


```solidity
function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes);
```

### _writeSupplyCheckpoint

FIX: H-06 — append the current _totalVotingSupply to the checkpoint
array, replacing the last entry in-place when two writes happen
within the same clock tick (matches the OZ Checkpoints convention).


```solidity
function _writeSupplyCheckpoint() internal;
```

### SafeCastUint48

FIX: H-06 — tiny local helper because we do not want to import
OZ SafeCast just for one uint48 cast.


```solidity
function SafeCastUint48(uint256 v) private pure returns (uint48);
```

### getPastVotes


```solidity
function getPastVotes(address account, uint256 timepoint) public view override returns (uint256);
```

### getPastTotalSupply


```solidity
function getPastTotalSupply(uint256 timepoint) public view override returns (uint256);
```

### nonces


```solidity
function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256);
```

## Events
### ExpiredLockBurned

```solidity
event ExpiredLockBurned(address indexed user, uint256 burnedBalance);
```

## Errors
### FutureSupplyLookup

```solidity
error FutureSupplyLookup(uint256 timepoint, uint48 clockNow);
```

### SupplyCheckpointOverflow

```solidity
error SupplyCheckpointOverflow(uint256 supply);
```

## Structs
### SupplyCheckpoint

```solidity
struct SupplyCheckpoint {
    uint48 clockTime; // ERC20Votes clock() value (default: block.number)
    uint208 supply; // _totalVotingSupply at that time
}
```

