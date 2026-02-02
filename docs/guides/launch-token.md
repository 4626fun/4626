---
title: Launch a token
sidebar_position: 3
---

# Launch a token

This guide covers launching ■TOKEN via Continuous Clearing Auction for fair price discovery.

**Prerequisites:**
- Vault deployed and activated
- ■TOKEN supply ready
- CCA strategy configured

---

## Overview

The CCA launch process:

```
1. Prepare ■TOKEN supply
2. Configure CCA strategy
3. Create auction
4. Monitor during auction
5. Complete after graduation
6. Trading begins on V4
```

---

## Preparation

### Have ■TOKEN ready

Ensure sufficient ■TOKEN exists for the auction:

```solidity
// Check supply
uint256 balance = shareOFT.balanceOf(owner);

// If needed, mint via deposit + wrap flow
creatorCoin.approve(address(wrapper), amount);
wrapper.deposit(amount, owner);
```

### Configure strategy

```solidity
CCALaunchStrategy strategy = new CCALaunchStrategy(
    shareOFT,
    owner
);

// Set recipients
strategy.setFundsRecipient(treasury);    // Raised ETH
strategy.setTokensRecipient(vault);      // Unsold tokens

// Set V4 configuration
strategy.setFeeRecipient(gaugeController);
strategy.setTaxRateBps(690);             // 6.9% tax
strategy.setPoolFeeTier(3000);           // 0.3% pool fee
```

---

## Create auction

### Transfer tokens to strategy

```solidity
uint256 auctionAmount = 10_000_000e18; // 10M ■TOKEN
shareOFT.transfer(address(strategy), auctionAmount);
```

### Initialize auction

```solidity
address auction = strategy.createAuction(
    auctionAmount,
    0.0001 ether,    // Min price per token
    0.01 ether,      // Max price per token
    7 days,          // Duration
    ""               // Config data
);
```

### Auction parameters

| Parameter | Description | Typical value |
|-----------|-------------|---------------|
| Amount | ■TOKEN to auction | 10-50% of supply |
| Min price | Floor price | Based on creator coin |
| Max price | Ceiling price | 10-100x min |
| Duration | Auction length | 7 days |

---

## During auction

### Monitor progress

```solidity
IContinuousClearingAuction auction = IContinuousClearingAuction(auctionAddress);

// Current state
uint256 clearingPrice = auction.clearingPrice();
uint256 raised = auction.currencyRaised();
bool graduated = auction.isGraduated();
```

### Keeper tasks

```solidity
// Trigger checkpoints periodically
strategy.checkpoint();
```

### User bidding

Users submit bids via the auction:

```solidity
// User bids 1 ETH with max price
auction.submitBid{value: 1 ether}(
    maxPrice,        // Max ETH per token willing to pay
    tokenAmount,     // Tokens desired
    bidder,          // Bid owner
    0,               // prevTickPrice (0 for simple bids)
    ""               // Hook data
);
```

---

## After graduation

### Check graduation

```solidity
require(strategy.isGraduated(), "Auction not graduated");
```

### Complete auction

```solidity
// Configures V4 pool with tax hook
strategy.completeAuction();
```

### Sweep funds

```solidity
// Send raised ETH to recipient
strategy.sweepCurrency();

// Return unsold tokens
strategy.sweepUnsoldTokens();
```

---

## Post-launch

### V4 pool active

Trading begins automatically on the V4 pool with:
- 6.9% tax on buys
- Liquidity from auction
- Price based on clearing price

### Verify tax hook

```solidity
// Tax hook should be configured
// Fees route to GaugeController
// Lottery entries activate for buyers
```

### Monitor trading

```solidity
// Check fee collection
uint256 pending = gaugeController.pendingFees();

// Trigger distribution if needed
if (pending >= threshold) {
    gaugeController.distribute();
}
```

---

## Timeline

| Phase | Duration | Activities |
|-------|----------|------------|
| Setup | 1-2 days | Deploy, configure, transfer tokens |
| Auction | 7 days | Users bid, checkpoints run |
| Graduation | Automatic | V4 pool created |
| Post-launch | Ongoing | Trading, fee distribution |

---

## Best practices

### Pricing

- Research comparable tokens
- Set min price conservatively
- Max price should allow upside

### Communication

- Announce auction dates clearly
- Explain bidding mechanics
- Share auction address widely

### Monitoring

- Run checkpoints every few hours
- Watch for unusual activity
- Be ready to answer questions

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Low participation | Extend marketing, check pricing |
| Graduation fails | Ensure V4 contracts configured |
| Tax hook not working | Verify configuration post-graduation |
| Sweep fails | Wait for graduation to complete |

---

## Related

- [Auction concept](/concepts/auction) - How CCA works
- [CCA Strategy](/contracts/strategies/cca-launch) - Contract details
- [Fee flow](/overview/fee-flow) - Post-launch economics
