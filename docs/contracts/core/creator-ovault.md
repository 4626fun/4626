---
title: CreatorOVault
sidebar_position: 1
---

# CreatorOVault

ERC-4626 compliant tokenized vault for creator coins with multi-strategy yield generation.

**Source:** `contracts/vault/CreatorOVault.sol`

---

## Overview

CreatorOVault accepts deposits of a creator coin (TOKEN) and issues vault shares (▢TOKEN). The vault deploys idle capital to yield strategies and distributes returns proportionally to shareholders.

---

## Key features

- **ERC-4626 compliant** - Standard tokenized vault interface
- **Multi-strategy** - Supports up to 5 concurrent strategies
- **Profit unlocking** - Gradual profit release prevents manipulation
- **Flash loan protection** - Delay between deposit and withdrawal
- **Large withdrawal queue** - MEV protection for big exits
- **Ownership rescue** - Protocol-assisted recovery mechanism

---

## State

### Assets

```solidity
IERC20 public immutable CREATOR_COIN;  // Underlying asset
uint256 public coinBalance;             // Idle balance in vault
```

### Strategies

```solidity
mapping(address => bool) public activeStrategies;
mapping(address => uint256) public strategyWeights;  // Basis points
mapping(address => uint256) public strategyDebt;     // Deployed amount
uint256 public totalDebt;
uint256 public totalStrategyWeight;
```

### Access control

```solidity
address public management;
address public keeper;
address public emergencyAdmin;
address public gaugeController;
```

### Security

```solidity
uint256 public withdrawDelayBlocks = 1;
uint256 public largeWithdrawalThreshold = 100_000e18;
uint256 public largeWithdrawalDelayBlocks = 10;
uint256 public constant MINIMUM_FIRST_DEPOSIT = 5_000_000e18;
```

---

## Functions

### User functions

```solidity
// Deposit TOKEN, receive ▢TOKEN
function deposit(uint256 assets, address receiver) 
    external returns (uint256 shares);

// Mint exact ▢TOKEN, pull TOKEN
function mint(uint256 shares, address receiver) 
    external returns (uint256 assets);

// Redeem ▢TOKEN for TOKEN
function redeem(uint256 shares, address receiver, address owner) 
    external returns (uint256 assets);

// Withdraw exact TOKEN, burn ▢TOKEN
function withdraw(uint256 assets, address receiver, address owner) 
    external returns (uint256 shares);
```

### Large withdrawal queue

```solidity
// Queue large withdrawal
function queueWithdrawal(uint256 shares, address receiver) external;

// Claim after delay
function claimQueuedWithdrawal() external returns (uint256 assets);

// Cancel and get shares back
function cancelQueuedWithdrawal() external returns (uint256 shares);
```

### Strategy management

```solidity
// Add strategy with weight (management)
function addStrategy(address strategy, uint256 weight) external;

// Remove strategy (management)
function removeStrategy(address strategy) external;

// Update weight (management)
function updateStrategyWeight(address strategy, uint256 newWeight) external;

// Deploy idle funds (keeper)
function deployToStrategies() external;

// Report profit/loss (keeper)
function report() external returns (uint256 profit, uint256 loss);
```

### View functions

```solidity
// Total assets under management
function totalAssets() public view returns (uint256);

// Price per share (1e18 scale)
function pricePerShare() public view returns (uint256);

// Preview functions
function previewDeposit(uint256 assets) public view returns (uint256);
function previewMint(uint256 shares) public view returns (uint256);
function previewWithdraw(uint256 assets) public view returns (uint256);
function previewRedeem(uint256 shares) public view returns (uint256);
```

---

## Events

```solidity
event Deposit(address sender, address receiver, uint256 assets, uint256 shares);
event Withdraw(address sender, address receiver, address owner, uint256 assets, uint256 shares);
event Reported(uint256 profit, uint256 loss, uint256 performanceFees, uint256 totalAssets);
event StrategyAdded(address indexed strategy, uint256 weight);
event StrategyRemoved(address indexed strategy);
event StrategyDeployed(address indexed strategy, uint256 amount);
event SharesBurnedForPrice(address indexed from, uint256 shares, uint256 newPricePerShare);
```

---

## Errors

```solidity
error ZeroAddress();
error ZeroAmount();
error ZeroShares();
error FirstDepositTooSmall(uint256 provided, uint256 minimum);
error WithdrawTooSoon(uint256 currentBlock, uint256 requiredBlock);
error LargeWithdrawalMustBeQueued(uint256 amount, uint256 threshold);
error InflationAttackDetected(uint256 assets, uint256 shares);
error PriceChangeExceedsLimit(uint256 priceBefore, uint256 priceAfter, uint256 maxChangeBps);
```

---

## Security

### Inflation attack prevention

The vault uses a `10^3` decimals offset creating virtual shares:

```solidity
function _decimalsOffset() internal pure override returns (uint8) {
    return 3; // 10^3 = 1000 virtual shares
}
```

Combined with `MINIMUM_FIRST_DEPOSIT`, this makes inflation attacks economically infeasible.

### Price manipulation protection

Maximum 10% price change per transaction:

```solidity
uint256 public constant MAX_PRICE_CHANGE_BPS = 1000;
```

### Flash loan protection

Minimum 1 block between deposit and withdrawal:

```solidity
uint256 public withdrawDelayBlocks = 1;
```

---

## Integration

### Depositing

```solidity
// Approve vault
creatorCoin.approve(address(vault), amount);

// Deposit
uint256 shares = vault.deposit(amount, receiver);
```

### Withdrawing

```solidity
// Small withdrawal (instant)
uint256 assets = vault.redeem(shares, receiver, owner);

// Large withdrawal (queued)
vault.queueWithdrawal(shares, receiver);
// Wait largeWithdrawalDelayBlocks
vault.claimQueuedWithdrawal();
```

---

## Related

- [Token Model](/overview/token-model) - ▢TOKEN explained
- [Vault Concept](/concepts/vault) - Deep dive
- [Strategies](/contracts/strategies) - Capital deployment
