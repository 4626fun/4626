# CreatorCoinPolicyController
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/routers/CreatorCoinPolicyController.sol)

**Inherits:**
Ownable

**Title:**
CreatorCoinPolicyController

**Author:**
0xakita.eth

Protocol-owned policy controller for CreatorCoin admin actions.

This contract is intended to hold CreatorCoin ownership after deployment.
It only permits setting the creatorCoinPayoutRecipient (external earnings lane)
to the configured PayoutRouter and supports an explicit ownership handoff for
controlled upgrades/migrations.
Per AGENTS.md "Canonical Lane Terminology":
- creatorCoinPayoutRecipient = CreatorCoin external earnings lane (routes to
PayoutRouter → VaultShareBurnStream in router mode, or direct treasury).
- This is distinct from tradeFeeCollector (ShareOFT/hook trade-fee lane).
See docs/audits/creatorvault-business-logic-core-structure-audit.md.


## Constants
### creatorCoin

```solidity
address public immutable creatorCoin
```


### payoutRouter

```solidity
address public immutable payoutRouter
```


## State Variables
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

Enforce creatorCoinPayoutRecipient (external earnings lane) to the configured PayoutRouter.
The on-chain CreatorCoin function is still named setPayoutRecipient (ABI compatibility).
All prose, docs, and higher-level comments use the canonical AGENTS.md term.


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

