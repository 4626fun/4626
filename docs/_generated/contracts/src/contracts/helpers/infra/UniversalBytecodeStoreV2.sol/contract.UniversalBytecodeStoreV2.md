# UniversalBytecodeStoreV2
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/helpers/infra/UniversalBytecodeStoreV2.sol)

**Title:**
UniversalBytecodeStoreV2

**Author:**
0xakita.eth

Append-only storage for contract creation bytecode (supports >24KB via chunking).

Compatible with v1 selectors for `store(bytes)`, `get(bytes32)`, and `pointers(bytes32)`.
Why v2 exists:
- v1 stored the entire creation bytecode in a single SSTORE2 pointer contract.
- EIP-170 limits contract runtime bytecode to ~24KB, so storing >24KB creation bytecode reverts.
- v2 splits large bytecode into multiple SSTORE2 pointers and reconstructs it on read.


## State Variables
### CHUNK_SIZE
Safe chunk size under EIP-170 (leaves headroom for STOP prefix).


```solidity
uint256 internal constant CHUNK_SIZE = 24_000
```


### pointers
codeId => "exists" pointer (first chunk pointer).

Kept for compatibility with v1 callers that check `pointers(codeId) != address(0)`.


```solidity
mapping(bytes32 => address) public pointers
```


### sizes
codeId => total creation bytecode size.


```solidity
mapping(bytes32 => uint256) public sizes
```


### chunkPointers
codeId => chunk pointers (each chunk pointer's runtime contains the chunk bytes).
Mapping slots are zero-initialized by the EVM.


```solidity
mapping(bytes32 => address[]) internal chunkPointers
```


## Functions
### store

Store a creation bytecode blob. Key is `keccak256(creationCode)`.

Append-only: cannot overwrite an existing id.


```solidity
function store(bytes calldata creationCode) external returns (bytes32 codeId, address pointer);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`codeId`|`bytes32`|keccak256(creationCode)|
|`pointer`|`address`|first chunk pointer (for existence checks)|


### get

Read the full creation bytecode for a codeId.


```solidity
function get(bytes32 codeId) external view returns (bytes memory creationCode);
```

### chunkCount

Number of stored chunks for `codeId`.


```solidity
function chunkCount(bytes32 codeId) external view returns (uint256);
```

### chunkPointerAt

Get a chunk pointer by index (for debugging/inspection).


```solidity
function chunkPointerAt(bytes32 codeId, uint256 index) external view returns (address);
```

### _sliceCalldata


```solidity
function _sliceCalldata(bytes calldata data, uint256 start, uint256 len) internal pure returns (bytes memory out);
```

## Events
### Stored

```solidity
event Stored(bytes32 indexed codeId, address indexed pointer, uint256 size);
```

## Errors
### EmptyBytecode

```solidity
error EmptyBytecode();
```

### AlreadyStored

```solidity
error AlreadyStored(bytes32 codeId);
```

