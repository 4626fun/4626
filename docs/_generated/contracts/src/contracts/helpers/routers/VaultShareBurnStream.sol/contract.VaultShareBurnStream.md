# VaultShareBurnStream
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/helpers/routers/VaultShareBurnStream.sol)

**Inherits:**
ReentrancyGuard

**Title:**
VaultShareBurnStream

Holds CreatorOVault shares (▢TOKEN) and burns them linearly over an epoch.

Enforceability:
- This contract has NO owner and NO withdrawal function.
- Vault shares deposited/minted to this address can only ever leave via burning.
Epoch schedule:
- Weekly epochs aligned to Thursday 00:00 UTC (Unix epoch is Thursday 00:00 UTC).
- Shares minted to this contract are queued for the NEXT epoch.
- During an active epoch, anyone can call `drip()` to burn the proportional amount.


## State Variables
### EPOCH_DURATION

```solidity
uint256 public constant EPOCH_DURATION = 7 days
```


### vault

```solidity
address public immutable vault
```


### vaultShares

```solidity
IERC20 public immutable vaultShares
```


### pendingShares

```solidity
uint256 public pendingShares
```


### pendingEpochStart

```solidity
uint256 public pendingEpochStart
```


### activeShares

```solidity
uint256 public activeShares
```


### activeEpochStart

```solidity
uint256 public activeEpochStart
```


### burnedActive

```solidity
uint256 public burnedActive
```


## Functions
### constructor


```solidity
constructor(address _vault) ;
```

### epochStart


```solidity
function epochStart(uint256 ts) public pure returns (uint256);
```

### nextEpochStart


```solidity
function nextEpochStart(uint256 ts) public pure returns (uint256);
```

### queueShares

Queue newly-minted/received vault shares for the next epoch.

`shares` must correspond to NEW shares not yet accounted as pending/active.
This lets routers call `queueShares(sharesMinted)` right after `vault.deposit(..., this)`.


```solidity
function queueShares(uint256 shares) public nonReentrant;
```

### syncUnaccounted

Convenience: queue ALL unaccounted shares.


```solidity
function syncUnaccounted() external nonReentrant;
```

### start

Start the pending stream once the scheduled epoch begins.


```solidity
function start() public nonReentrant;
```

### drip

Burn the proportional amount of shares for the active epoch.

Permissionless.


```solidity
function drip() external nonReentrant returns (uint256 burnedNow);
```

### checkpoint

Convenience: sync → start (if ready) → drip.


```solidity
function checkpoint() external nonReentrant returns (uint256 burnedNow);
```

### _drip


```solidity
function _drip() internal returns (uint256 burnedNow);
```

## Events
### SharesQueued

```solidity
event SharesQueued(uint256 shares, uint256 indexed scheduledEpochStart);
```

### StreamStarted

```solidity
event StreamStarted(uint256 indexed epochStart, uint256 shares);
```

### StreamDripped

```solidity
event StreamDripped(
    uint256 indexed epochStart, uint256 burnedNow, uint256 burnedTotal, uint256 remaining, uint256 pps
);
```

### StreamCompleted

```solidity
event StreamCompleted(uint256 indexed epochStart, uint256 totalBurned, uint256 pps);
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

### NothingToStart

```solidity
error NothingToStart();
```

### TooSoon

```solidity
error TooSoon(uint256 nowTs, uint256 requiredTs);
```

### NoActiveStream

```solidity
error NoActiveStream();
```

### NoNewShares

```solidity
error NoNewShares();
```

