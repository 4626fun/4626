# UniversalBytecodeStore
[Git Source](https://github.com/creatorvault/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/contracts/helpers/infra/UniversalBytecodeStore.sol)

**Title:**
UniversalBytecodeStore

**Author:**
0xakita.eth

Append-only storage for contract creation bytecode.

Used by CREATE2 deployers to keep calldata small.


## State Variables
### pointers
codeId => pointer contract (runtime contains the creation bytecode).


```solidity
mapping(bytes32 => address) public pointers
```


## Functions
### store

Store a creation bytecode blob. Key is `keccak256(creationCode)`.

Append-only: cannot overwrite an existing id.


```solidity
function store(bytes calldata creationCode) external returns (bytes32 codeId, address pointer);
```

### get

Read the creation bytecode for a codeId.


```solidity
function get(bytes32 codeId) external view returns (bytes memory creationCode);
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

