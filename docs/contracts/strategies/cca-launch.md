---
title: CCA Launch Strategy
sidebar_position: 1
---

# CCA Launch Strategy

Fair launch strategy using Uniswap's Continuous Clearing Auction mechanism.

**Source:** `contracts/vault/strategies/CCALaunchStrategy.sol`

---

## Overview

CCALaunchStrategy enables fair token launches by auctioning ■TOKEN (wrapped shares) via Uniswap's CCA. All bidders receive the same clearing price, eliminating sniping and MEV advantages.

---

## Key features

- **Fair price discovery** - Clearing price auction, no timing games
- **MEV resistant** - No sandwich attacks possible
- **Early participant rewards** - Earlier bids get better prices naturally
- **V4 graduation** - Automatically creates V4 pool after auction

---

## Auction mechanism

### How CCA works

1. Creator deposits ■TOKEN to strategy
2. Strategy creates auction via CCA Factory
3. Users submit bids with max price
4. Clearing price updates continuously
5. After duration, auction graduates
6. Filled bidders claim tokens at clearing price
7. V4 pool created with liquidity

### Clearing price

```
              Price
                │
        Max ────┤     ┌─────────────────
                │     │
    Clearing ───┼─────┤ ← All above get filled
                │     │
        Min ────┼─────┴─────────────────
                │
                └────────────────────── Cumulative bids
```

All filled bids pay the clearing price, not their max bid.

---

## Functions

### Auction management

```solidity
// Create new auction
function createAuction(
    uint256 amount,      // ■TOKEN to auction
    uint256 minPrice,    // Floor price
    uint256 maxPrice,    // Ceiling price
    uint256 duration,    // Auction length
    bytes calldata configData
) external returns (address auction);

// Trigger checkpoint (update clearing price)
function checkpoint() external;

// Complete auction after graduation
function completeAuction() external;
```

### Post-auction

```solidity
// Sweep raised currency to recipient
function sweepCurrency() external;

// Sweep unsold tokens
function sweepUnsoldTokens() external;
```

### Configuration

```solidity
// Set recipients
function setFundsRecipient(address recipient) external;
function setTokensRecipient(address recipient) external;

// Set V4 pool parameters
function setPoolFeeTier(uint24 feeTier) external;
function setPoolTickSpacing(int24 tickSpacing) external;

// Set tax hook config
function setTaxHook(address hook) external;
function setTaxRateBps(uint256 rate) external;
function setFeeRecipient(address recipient) external;
```

### View functions

```solidity
// Current auction address
function currentAuction() external view returns (address);

// Historical auctions
function pastAuctions(uint256 index) external view returns (address);

// Auction state
function isGraduated() external view returns (bool);
function clearingPrice() external view returns (uint256);
function currencyRaised() external view returns (uint256);
```

---

## State

```solidity
// Core
IERC20 public immutable auctionToken;    // ■TOKEN
address public currency;                  // ETH (address(0))

// Factory
address public ccaFactory;
address public constant UNISWAP_CCA_FACTORY_V110 = 
    0xcca1101C61cF5cb44C968947985300DF945C3565;

// Current auction
address public currentAuction;
address[] public pastAuctions;

// Recipients
address public fundsRecipient;
address public tokensRecipient;

// V4 configuration
IPoolManager public poolManager;
address public taxHook;
address public feeRecipient;
uint256 public taxRateBps = 690;      // 6.9%
uint24 public poolFeeTier = 3000;     // 0.3%
int24 public poolTickSpacing = 60;
```

---

## Lifecycle

### 1. Setup

```solidity
// Deploy strategy
CCALaunchStrategy strategy = new CCALaunchStrategy(
    shareOFT,           // ■TOKEN
    owner
);

// Configure
strategy.setFundsRecipient(treasury);
strategy.setTokensRecipient(vault);
strategy.setFeeRecipient(gaugeController);
```

### 2. Create auction

```solidity
// Transfer ■TOKEN to strategy
shareOFT.transfer(address(strategy), auctionAmount);

// Create auction
address auction = strategy.createAuction(
    auctionAmount,
    0.0001 ether,      // Min price per token
    0.01 ether,        // Max price per token
    7 days,            // Duration
    ""                 // Config data
);
```

### 3. During auction

```solidity
// Users submit bids
IContinuousClearingAuction(auction).submitBid{value: bidAmount}(
    maxPrice,
    tokenAmount,
    bidder,
    0,       // prevTickPrice
    ""       // hookData
);

// Keeper triggers checkpoints
strategy.checkpoint();
```

### 4. After graduation

```solidity
// Check graduation
require(strategy.isGraduated(), "Not graduated");

// Complete auction (configures V4 pool)
strategy.completeAuction();

// Sweep funds
strategy.sweepCurrency();
strategy.sweepUnsoldTokens();
```

---

## V4 graduation

When auction ends, a V4 pool is created:

```
Auction graduates
        │
        ▼
┌─────────────────────────────┐
│   V4 Pool Creation          │
│                             │
│   1. Create pool key        │
│   2. Initialize pool        │
│   3. Add liquidity          │
│   4. Configure tax hook     │
└─────────────────────────────┘
        │
        ▼
Trading begins on V4
(with 6.9% tax to GaugeController)
```

---

## Events

```solidity
event AuctionCreated(address indexed auction, uint256 amount);
event AuctionCompleted(address indexed auction, uint256 raised);
event CurrencySwept(address indexed auction, uint256 amount);
event TokensSwept(address indexed auction, uint256 amount);
```

---

## Related

- [Auction Concept](/concepts/auction) - How CCA works
- [Token Model](/overview/token-model) - Why ■TOKEN is auctioned
- [Fee Flow](/overview/fee-flow) - Post-launch fee distribution
