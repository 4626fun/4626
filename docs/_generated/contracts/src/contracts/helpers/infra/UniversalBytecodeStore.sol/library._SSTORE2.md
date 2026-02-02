# _SSTORE2
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/helpers/infra/UniversalBytecodeStore.sol)

**Title:**
_SSTORE2

**Author:**
0xakita.eth

Minimal bytecode storage helper.

Internal library used by UniversalBytecodeStore.


## State Variables
### DATA_OFFSET

```solidity
uint256 internal constant DATA_OFFSET = 1
```


## Functions
### write


```solidity
function write(bytes memory data) internal returns (address pointer);
```

### read


```solidity
function read(address pointer) internal view returns (bytes memory data);
```

