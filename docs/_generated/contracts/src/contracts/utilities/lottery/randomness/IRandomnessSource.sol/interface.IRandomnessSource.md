# IRandomnessSource
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/lottery/randomness/IRandomnessSource.sol)

**Title:**
IRandomnessSource

Pluggable randomness interface for 4626.fun's lottery stack.
Lets `CreatorLotteryManager` consume Chainlink VRF, drand, or any
future source through a single shape.

Two flavors:
- `request` style (Chainlink VRF): caller asks for a future round
- `pull` style    (drand):         caller reads a sealed past round
A source MAY support either or both — the lottery manager picks
which one to use per creator coin.


## Functions
### mode

Returns the mode this source operates in.


```solidity
function mode() external view returns (SourceMode);
```

### isReady

Returns true if the source has fulfilled randomness for `key`.


```solidity
function isReady(uint256 key) external view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`key`|`uint256`|request id (REQUEST mode) or round number (PULL mode)|


### randomWord

Returns the random word for `key`. Reverts if not ready.


```solidity
function randomWord(uint256 key) external view returns (uint256);
```

## Enums
### SourceMode

```solidity
enum SourceMode {
    REQUEST, // VRF-style: callback after fulfillment
    PULL // drand-style: read sealed historical randomness
}
```

