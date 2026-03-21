# _SSTORE2
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/helpers/infra/UniversalBytecodeStore.sol)

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

