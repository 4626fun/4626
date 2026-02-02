---
title: Fee architecture
sidebar_position: 1
---

# Fee architecture

This document describes how CreatorVault captures and distributes fees across the token lifecycle, from fair launch auctions through ongoing trading. It covers the tax hook integration, fee distribution mechanics, and the rationale behind design choices.

**Who this is for:** Protocol engineers, auditors, integrators, and creators planning token launches.

---

## Overview

CreatorVault uses a dual-phase token launch system:

1. **Fair launch (CCA):** Continuous Clearing Auction for price discovery over 1-4 weeks
2. **Ongoing trading:** 6.9% fee capture via Uniswap V4 Tax Hook or ShareOFT detection

**Key terms:**

- **CCA (Continuous Clearing Auction):** Official Uniswap mechanism for fair token launches
- **Tax Hook:** Pre-deployed Uniswap V4 hook that extracts configurable swap fees
- **ShareOFT:** LayerZero OFT wrapper that detects buys and captures fees on any DEX
- **GaugeController:** Contract that receives fees and distributes them to lottery, burn, and voters

---

## Phase 1: Fair launch via CCA

CCA is an official Uniswap mechanism that eliminates sniping and timing games. No custom hook approval is required.

```
+---------------------------------------------------------------+
|                    FAIR LAUNCH (CCA)                          |
+---------------------------------------------------------------+
|                                                               |
|  1. Creator deposits creator coin -> receives ■TOKEN          |
|                                                               |
|  2. Creator sends ■TOKEN to CCALaunchStrategy                 |
|                                                               |
|  3. CCA Auction runs:                                         |
|     +-------------------------------------------------------+ |
|     |  WEEK 1: 20% supply released (slow)                   | |
|     |  WEEK 2: 30% supply released (medium)                 | |
|     |  WEEK 3-4: 50% supply released (fast)                 | |
|     |                                                       | |
|     |  - Bids spread over time (no concentration)           | |
|     |  - Early bidders get lower average price              | |
|     |  - Clearing price discovered fairly                   | |
|     |  - No sniping possible                                | |
|     +-------------------------------------------------------+ |
|                                                               |
|  4. Auction graduates (requires minimum ETH raised)           |
|                                                               |
|  5. V4 pool initialized at fair clearing price                |
|                                                               |
|  6. Raised ETH sent to Vault/Creator treasury                 |
|                                                               |
+---------------------------------------------------------------+

CCA Factory (v1.1.0): 0xcca1101C61cF5cb44C968947985300DF945C3565
Networks: Base, Mainnet, Unichain, Sepolia
```

---

## Phase 2: Ongoing trading

After CCA graduation, trading continues with two fee capture mechanisms.

### V4 Tax Hook (primary)

CreatorVault uses an existing, approved Tax Hook on Base. This avoids the need for custom hook development and allowlist approval.

**Tax Hook Address:** [`0xca975B9dAF772C71161f3648437c3616E5Be0088`](https://basescan.org/address/0xca975B9dAF772C71161f3648437c3616E5Be0088)

| Feature | Custom Hook | Existing Tax Hook |
|---------|-------------|-------------------|
| Approval | Needs allowlist | Already deployed |
| Risk | Unaudited | Battle-tested |
| Cost | Deploy and verify | Configure only |
| Fees | Custom | 6.9% configurable |

```
+---------------------------------------------------------------------+
|              ■TOKEN/ETH V4 POOL (with Tax Hook)                     |
+---------------------------------------------------------------------+
|                                                                     |
|  User swaps ETH -> ■TOKEN                                           |
|                    |                                                |
|                    v                                                |
|           Tax Hook extracts 6.9%                                    |
|                    |                                                |
|                    v (WETH)                                         |
|          CreatorGaugeController                                     |
|                    |                                                |
|   +----------------+----------------+                               |
|   |                |                |                               |
|   v                v                v                               |
|  69%            21.39%           9.61%                              |
| LOTTERY          BURN        VOTERS/PROTOCOL                        |
+---------------------------------------------------------------------+
```

The Tax Hook sends WETH to the GaugeController, which:

1. Receives WETH from Tax Hook
2. Swaps WETH to creator coin via Uniswap
3. Deposits creator coin to vault, receives vault shares
4. Distributes vault shares: 69% lottery, 21.39% burn, 9.61% voters/protocol

### ShareOFT detection (fallback)

For trades on other DEXes (V2, V3, aggregators), the ShareOFT contract detects buy transfers and captures the 6.9% fee directly.

```
+---------------------------------------------------------------------+
|                    OTHER DEX POOLS (V2/V3/etc)                      |
+---------------------------------------------------------------------+
|                                                                     |
|  POOL SWAP FEE: Standard (0.3% - 1% depending on pool)              |
|  +-- 100% -> Liquidity Providers                                    |
|                                                                     |
|  BUY FEE: 6.9% (detected by ShareOFT on transfer)                   |
|  +-- 100% -> GaugeController (as ■TOKEN)                            |
|              +-- Unwrap -> vault shares                             |
|                  +-- Split: 69% lottery, 21.39% burn, 9.61% voters  |
|                                                                     |
+---------------------------------------------------------------------+
|  TOTAL BUY COST: ~7.2% (0.3% swap + 6.9% fee)                       |
|  TOTAL SELL COST: ~0.3% (pool fee only)                             |
+---------------------------------------------------------------------+
```

---

## Fee distribution

All captured fees flow through the GaugeController with the following split:

| Recipient | Share | Purpose |
|-----------|-------|---------|
| Lottery reserve | 69% | Jackpot pool for swap-to-win lottery |
| Burn | 21.39% | Increases price-per-share (PPS) for holders |
| Voters/Protocol | 9.61% | Governance rewards and protocol treasury |

```
+---------------------------------------------------------------------+
|                    GaugeController Distribution                     |
+---------------------------------------------------------------------+
|                                                                     |
|  Incoming: WETH (from Tax Hook) OR ■TOKEN (from ShareOFT)           |
|                                                                     |
|  Processing:                                                        |
|  +-- WETH path: WETH -> swap -> creator coin -> deposit -> shares   |
|  +-- OFT path: ■TOKEN -> unwrap -> vault shares                     |
|                                                                     |
|  Distribution (vault shares):                                       |
|  +-- 69%    -> Lottery Reserve (jackpot)                            |
|  +-- 21.39% -> Burn (PPS increases)                                 |
|  +-- 9.61%  -> Voter Rewards / Protocol                             |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Token naming convention

CreatorVault uses two derived tokens for each creator coin:

| Token type | Symbol format | Contract | Description |
|------------|---------------|----------|-------------|
| Vault token | ▢{COIN} | CreatorOVault.sol | ERC-4626 shares, stays on-chain, earns yield |
| Share token | ■{COIN} | CreatorShareOFT.sol | Wrapped shares, cross-chain via LayerZero, tradeable |

**Token flow:**

```
Creator Coin (e.g., AKITA)
    |
    v deposit
▢AKITA (Vault Token) <- Stays on-chain, earns yield via strategies
    |
    v wrap
■AKITA (Share Token) <- Cross-chain via LayerZero, trades on DEXes
```

---

## Using CCA Launch Strategy

```solidity
// 1. Get the deployed strategy
CCALaunchStrategy strategy = CCALaunchStrategy(info.ccaStrategy);

// 2. Approve ■TOKEN transfer
shareOFT.approve(address(strategy), amount);

// 3. Launch simple auction (linear distribution)
strategy.launchAuctionSimple(
    1_000_000e18,  // 1M tokens to sell
    100 ether      // Minimum ETH to raise for graduation
);

// 4. Or launch with custom steps (rewards early bidders more)
bytes memory steps = abi.encodePacked(
    // Phase 1: 20% over first half (slow)
    // Phase 2: 30% over third quarter (medium)  
    // Phase 3: 50% over last quarter (fast)
);
strategy.launchAuction(amount, floorPrice, minRaise, steps);

// 5. After graduation, sweep funds
strategy.sweepCurrency();      // ETH to vault
strategy.sweepUnsoldTokens();  // Remaining tokens to creator
```

---

## Security considerations

1. **Official mechanism:** CCA is official Uniswap infrastructure (no custom code risk)
2. **Fair launch:** No sniping, timing games, or MEV attacks during auction
3. **Fee caps:** Buy fee capped at 6.9% with minimum burn share (20%)
4. **Slippage protection:** Users should set appropriate slippage for buy fee
5. **Graduation requirement:** Minimum ETH must be raised before pool initialization

---

## Contract addresses

### External infrastructure

| Contract | Address | Network |
|----------|---------|---------|
| V4 Tax Hook | `0xca975B9dAF772C71161f3648437c3616E5Be0088` | Base |
| CCA Factory | `0xcca1101C61cF5cb44C968947985300DF945C3565` | Base/Mainnet/Unichain |
| V4 Pool Manager | `0x498581fF718922c3f8e6A244956aF099B2652b2b` | Base |
| WETH | `0x4200000000000000000000000000000000000006` | Base |
| Uniswap V3 Router | `0x2626664c2603336E57B271c5C0b26F421741e481` | Base |

### Creator tokens (AKITA example)

| Contract | Address | Network |
|----------|---------|---------|
| AKITA (Creator Coin) | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` | Base |
| ■AKITA (ShareOFT) | Deployed via Factory | Base |
| ▢AKITA (CreatorOVault) | Deployed via Factory | Base |

---

## Design rationale

### For depositors and holders

- **Fair entry:** CCA ensures fair price discovery
- **Passive yield:** Every buy increases PPS through burn
- **Compounding:** Gains compound as trading volume increases

### For CCA bidders

- **Better prices:** Early bidders naturally get lower average prices
- **No sniping risk:** Cannot be front-run or outbid last-second
- **Time to decide:** Spread bids over weeks, not seconds

### For traders

- **Asymmetric fees:** 6.9% on buys, ~0.3% on sells
- **Lottery entry:** Every buy equals a lottery entry
- **Standard pools:** Trade on any DEX

### For creators

- **Revenue:** Creator fee share is configurable (default 0%)
- **Fair launch:** No accusations of insider trading
- **Funds upfront:** CCA raises ETH before trading starts

---

## References

- [Strategy architecture](./strategy-architecture.md)
- [Account abstraction activation](../account-abstraction/activation.md)
- [CCA deployment verification](../../operations/deployment/cca-verification.md)
