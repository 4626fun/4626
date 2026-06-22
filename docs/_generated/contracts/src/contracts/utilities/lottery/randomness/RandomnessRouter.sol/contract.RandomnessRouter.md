# RandomnessRouter
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/utilities/lottery/randomness/RandomnessRouter.sol)

**Inherits:**
ReentrancyGuard

**Title:**
RandomnessRouter

Per-creator-coin randomness source selector. Sits beside
`CreatorLotteryManager` (NOT inside it — that contract is large,
audited, and uses a delegate-call admin module that makes inline
changes risky during a hackathon).

Wiring model
------------
The lottery manager continues to use Chainlink VRF as the default
settlement source for every existing creator coin. New creators
(and existing creators who opt in via governance) can be tagged
here with a custom source — typically `DrandRandomnessSource` for
lower latency or `ChainlinkVRFAdapter` for an explicit per-coin
override.
A separate keeper service queries this router after every entry
and feeds the chosen source's randomness back into the lottery
manager via the existing `onRandomWordsCallback` path. That keeps
the diff to audited code zero.

Mode mismatch handling
----------------------
Sources can be REQUEST (Chainlink VRF) or PULL (drand). The
router's `acquire` function picks the right shape per source so
the keeper has a single call site to spin entropy for any coin.


## State Variables
### owner

```solidity
address public owner
```


### defaultSource
Default source used when a creator coin has no override.


```solidity
IRandomnessSource public defaultSource
```


### sourceOf
Per-creator override.


```solidity
mapping(address => IRandomnessSource) public sourceOf
```


## Functions
### constructor


```solidity
constructor(address _owner, IRandomnessSource _defaultSource) ;
```

### onlyOwner


```solidity
modifier onlyOwner() ;
```

### setOwner


```solidity
function setOwner(address _owner) external onlyOwner;
```

### setDefaultSource


```solidity
function setDefaultSource(IRandomnessSource _source) external onlyOwner;
```

### setSourceFor


```solidity
function setSourceFor(address creatorCoin, IRandomnessSource _source) external onlyOwner;
```

### clearSourceFor


```solidity
function clearSourceFor(address creatorCoin) external onlyOwner;
```

### resolve

Resolve which source serves `creatorCoin`. Reverts if neither
a per-coin override nor a default is set.


```solidity
function resolve(address creatorCoin) public view returns (IRandomnessSource src);
```

### acquireRequest

REQUEST-mode acquisition. Caller is the keeper / lottery manager
hook. The returned `key` is what the keeper later uses to read
the random word.

For PULL-mode sources (e.g. drand), use `currentPullKey` to read
the active round directly without going through this function.

Defense-in-depth: `acquireRequest` makes a low-level call into
`src.request()` and emits the `RandomnessAcquired` log only after
the call returns. Sources are admin-curated via `setSourceFor`
(see audit §4.1, finding `reentrancy-events`), but a future or
mis-configured source must not be able to re-enter the router and
observe inconsistent log ordering. The OpenZeppelin `nonReentrant`
modifier closes that surface unconditionally.


```solidity
function acquireRequest(address creatorCoin)
    external
    nonReentrant
    returns (address sourceAddr, IRandomnessSource.SourceMode m, uint256 key);
```

### readPull

PULL-mode read. `key` is typically the current drand round
(caller derives it via `DrandRandomnessSource.roundAt`).


```solidity
function readPull(address creatorCoin, uint256 key) external view returns (uint256);
```

## Events
### OwnerUpdated

```solidity
event OwnerUpdated(address indexed previous, address indexed current);
```

### DefaultSourceUpdated

```solidity
event DefaultSourceUpdated(address indexed previous, address indexed current);
```

### SourceOverrideSet

```solidity
event SourceOverrideSet(address indexed creatorCoin, address indexed source);
```

### RandomnessAcquired

```solidity
event RandomnessAcquired(
    address indexed creatorCoin, address indexed source, IRandomnessSource.SourceMode mode, uint256 key
);
```

## Errors
### NotOwner

```solidity
error NotOwner();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### NoSource

```solidity
error NoSource();
```

### UnsupportedMode

```solidity
error UnsupportedMode();
```

### NotReady

```solidity
error NotReady();
```

