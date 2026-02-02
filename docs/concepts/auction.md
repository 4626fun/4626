---
title: Auction
sidebar_position: 2
---

# Continuous Clearing Auction

The CCA Launch Strategy uses Uniswap's Continuous Clearing Auction mechanism for fair token launches.

---

## Why CCA

Traditional token launches have problems:

| Problem | CCA solution |
|---------|--------------|
| Sniping | All bidders get same clearing price |
| MEV/sandwich | No timing advantage |
| Information asymmetry | Price discovery is gradual |
| Whale dominance | Early participants rewarded |

CCA is an official Uniswap mechanism deployed on Base, Mainnet, and other chains.

---

## How it works

### Auction lifecycle

```
Day 0-7: Auction period
├─► Users submit bids (ETH for ■TOKEN)
├─► Each bid specifies max price
├─► Clearing price updates continuously
└─► Early bids get better prices

Day 7: Graduation
├─► Final clearing price determined
├─► All bids above clearing price filled
├─► Graduates to Uniswap V4 pool
└─► Tax hook configured on pool
```

### Clearing price

The clearing price is where supply meets demand:

```
              Price
                │
        Max ────┤     ┌─────────────────
                │     │
                │     │
    Clearing ───┼─────┤ ← All bids above here get filled
                │     │
                │     │
                │     │
        Min ────┼─────┴─────────────────
                │
                └────────────────────── Cumulative bids
```

All filled bidders pay the same clearing price, regardless of their max bid.

---

## Token auctioned

The CCA strategy auctions **■TOKEN** (wrapped vault shares), not TOKEN directly:

```
Creator deposits TOKEN into vault
        │
        ▼
Receives ▢TOKEN (vault shares)
        │
        ▼
Wraps to ■TOKEN via Wrapper
        │
        ▼
■TOKEN deposited to CCA strategy
        │
        ▼
CCA auctions ■TOKEN for ETH
```

### Why auction wrapped shares

- ■TOKEN is cross-chain capable (LayerZero OFT)
- Represents claim on diversified vault yield
- Price discovery for vault itself, not just underlying
- Raised ETH bootstraps LP liquidity

---

## Bidding

### Submit a bid

```solidity
// Bid 1 ETH for ■TOKEN with max price of 0.001 ETH per token
auction.submitBid{value: 1 ether}(
    maxPrice,        // Max ETH/TOKEN you'll pay
    amount,          // Amount of TOKEN desired
    owner,           // Bid owner
    prevTickPrice,   // For ordering (0 for simple bids)
    hookData         // Optional hook data
);
```

### Bid states

| State | Meaning |
|-------|---------|
| Active | Bid placed, may be filled |
| Filled | Above clearing price, will receive tokens |
| Unfilled | Below clearing price, ETH refundable |
| Claimed | Tokens/ETH claimed |

### Claim tokens

After auction ends:

```solidity
// If bid was filled
auction.claimTokens(bidId);

// If bid was unfilled
auction.exitBid(bidId);
```

---

## Graduation

When the auction ends, it "graduates" to a Uniswap V4 pool:

```
Auction ends
    │
    ▼
┌─────────────────────────────┐
│      Graduation process     │
│                             │
│  1. Final price determined  │
│  2. V4 pool created         │
│  3. Liquidity added         │
│  4. Tax hook configured     │
│  5. Oracle updated          │
└─────────────────────────────┘
    │
    ▼
Trading begins on V4 pool
```

### Tax hook configuration

The strategy configures a 6.9% tax hook on graduation:

```solidity
// Called automatically on graduation
ITaxHook(taxHook).setTaxConfig(
    address(shareOFT),  // Token
    address(0),         // ETH counter asset
    feeRecipient,       // GaugeController
    690,                // 6.9% tax rate
    true,               // Counter is ETH
    true,               // Enabled
    false               // Not locked (can update)
);
```

---

## Configuration

| Parameter | Default | Purpose |
|-----------|---------|---------|
| Pool fee tier | 0.3% | V4 pool fee |
| Tax rate | 6.9% | Buy fee on V4 pool |
| Duration | 7 days | Auction length |

CCA uses Uniswap's official factory (`0xcca1101...`).

---

## Post-graduation

After the auction ends:
1. Final clearing price is set
2. V4 pool is created with liquidity
3. Tax hook is configured (6.9%)
4. Trading begins on V4

See [CCA Launch Strategy](/contracts/strategies/cca-launch) for contract API.

---

## Related

- [CCA Launch Strategy](/contracts/strategies/cca-launch) - Contract API
- [Token model](/overview/token-model) - Why ■TOKEN is auctioned
- [Fee flow](/overview/fee-flow) - What happens to raised funds
