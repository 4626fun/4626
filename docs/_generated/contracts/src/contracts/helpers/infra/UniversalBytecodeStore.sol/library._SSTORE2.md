# _SSTORE2
[Git Source](https://github.com/4626/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/helpers/infra/UniversalBytecodeStore.sol)

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

