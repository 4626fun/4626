# VaultRolePolicyManager
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/governance/VaultRolePolicyManager.sol)

**Inherits:**
Ownable

**Title:**
VaultRolePolicyManager

Yearn-inspired role policy templates for vault deployment lanes.

DeploymentBatcher can call `validateRoleAssignments` before phase-2 wiring.
Policy id 0 is reserved as the no-op default for backwards compatibility.


## State Variables
### policies

```solidity
mapping(uint256 => RolePolicy) public policies
```


### allowlistedAccounts

```solidity
mapping(uint256 => mapping(uint8 => mapping(address => bool))) public allowlistedAccounts
```


## Functions
### constructor


```solidity
constructor(address initialOwner) Ownable(initialOwner);
```

### setRolePolicy


```solidity
function setRolePolicy(uint256 policyId, RolePolicy calldata policy) external onlyOwner;
```

### setRoleAllowlistedAccount


```solidity
function setRoleAllowlistedAccount(uint256 policyId, VaultRole role, address account, bool allowed)
    external
    onlyOwner;
```

### validateRoleAssignments

Validate owner/role tuple against a configured policy template.

Policy id 0 is intentionally treated as permissive so existing deploy
flows continue to work when no policy is configured.


```solidity
function validateRoleAssignments(
    uint256 policyId,
    address owner,
    address management,
    address keeper,
    address emergencyAdmin
) external view;
```

### _validateRoleRule


```solidity
function _validateRoleRule(uint256 policyId, RoleRule rule, VaultRole role, address owner, address account)
    internal
    view;
```

## Events
### RolePolicySet

```solidity
event RolePolicySet(
    uint256 indexed policyId,
    bool active,
    bool requireOwnerEoa,
    RoleRule managementRule,
    RoleRule keeperRule,
    RoleRule emergencyAdminRule
);
```

### RoleAllowlistSet

```solidity
event RoleAllowlistSet(uint256 indexed policyId, VaultRole indexed role, address indexed account, bool allowed);
```

## Errors
### PolicyNotActive

```solidity
error PolicyNotActive(uint256 policyId);
```

### OwnerMustBeEoa

```solidity
error OwnerMustBeEoa(address owner);
```

### InvalidRole

```solidity
error InvalidRole(uint8 role);
```

### RoleAssignmentNotAllowed

```solidity
error RoleAssignmentNotAllowed(uint8 role, address account);
```

## Structs
### RolePolicy

```solidity
struct RolePolicy {
    bool active;
    bool requireOwnerEoa;
    RoleRule managementRule;
    RoleRule keeperRule;
    RoleRule emergencyAdminRule;
}
```

## Enums
### RoleRule

```solidity
enum RoleRule {
    Any,
    MustEqualOwner,
    MustBeAllowlisted
}
```

### VaultRole

```solidity
enum VaultRole {
    Management,
    Keeper,
    EmergencyAdmin
}
```

