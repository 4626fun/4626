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

### transferCreatorCoinOwnership

Transfer CreatorCoin ownership to a new admin contract/address.

Intended for controlled migrations/upgrades.


```solidity
function transferCreatorCoinOwnership(address newOwner) external onlyOwner;
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

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

