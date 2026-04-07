# ApprovedV4HooksRegistry
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/strategies/univ4/ApprovedV4HooksRegistry.sol)

**Inherits:**
Ownable, [IApprovedV4HooksRegistry](/contracts/vault/strategies/univ4/ApprovedV4HooksRegistry.sol/interface.IApprovedV4HooksRegistry.md)


## State Variables
### _approvedHooks

```solidity
mapping(address => bool) private _approvedHooks
```


### _knownHooks

```solidity
mapping(address => bool) private _knownHooks
```


### _allHooks

```solidity
address[] private _allHooks
```


## Functions
### constructor


```solidity
constructor(address _owner) Ownable(_owner);
```

### setHookApproval


```solidity
function setHookApproval(address hook, bool approved) external onlyOwner;
```

### isHookApproved


```solidity
function isHookApproved(address hook) external view returns (bool);
```

### getAllHooks


```solidity
function getAllHooks() external view returns (address[] memory);
```

### getApprovedHooks


```solidity
function getApprovedHooks() external view returns (address[] memory hooks);
```

## Events
### HookApprovalUpdated

```solidity
event HookApprovalUpdated(address indexed hook, bool approved);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### HookNotContract

```solidity
error HookNotContract(address hook);
```

