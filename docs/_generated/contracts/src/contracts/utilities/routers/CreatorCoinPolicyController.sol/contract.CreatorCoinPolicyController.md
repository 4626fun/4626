# CreatorCoinPolicyController
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/utilities/routers/CreatorCoinPolicyController.sol)

**Inherits:**
Ownable

**Title:**
CreatorCoinPolicyController

**Author:**
0xakita.eth

Protocol-owned policy controller for CreatorCoin admin actions.

This contract is intended to hold CreatorCoin ownership after deployment.
It only permits setting payoutRecipient to the configured router and
supports an explicit ownership handoff for controlled upgrades/migrations.


## State Variables
### creatorCoin

```solidity
address public immutable creatorCoin
```


### payoutRouter

```solidity
address public immutable payoutRouter
```


### pendingCreatorCoinOwner

```solidity
address public pendingCreatorCoinOwner
```


## Functions
### constructor


```solidity
constructor(address _creatorCoin, address _payoutRouter, address _owner) Ownable(_owner);
```

### enforcePayoutRouter

Enforce payout recipient to the configured payout router.


```solidity
function enforcePayoutRouter() external onlyOwner;
```

### proposeCreatorCoinOwnershipTransfer


```solidity
function proposeCreatorCoinOwnershipTransfer(address newOwner) external onlyOwner;
```

### acceptCreatorCoinOwnership


```solidity
function acceptCreatorCoinOwnership() external;
```

### cancelCreatorCoinOwnershipTransfer


```solidity
function cancelCreatorCoinOwnershipTransfer() external onlyOwner;
```

## Events
### PayoutRecipientEnforced

```solidity
event PayoutRecipientEnforced(address indexed creatorCoin, address indexed payoutRouter);
```

### CreatorCoinOwnershipTransferred

```solidity
event CreatorCoinOwnershipTransferred(address indexed creatorCoin, address indexed newOwner);
```

### CreatorCoinOwnershipTransferProposed

```solidity
event CreatorCoinOwnershipTransferProposed(address indexed creatorCoin, address indexed proposedOwner);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### NoPendingTransfer

```solidity
error NoPendingTransfer();
```

### NotPendingOwner

```solidity
error NotPendingOwner();
```

