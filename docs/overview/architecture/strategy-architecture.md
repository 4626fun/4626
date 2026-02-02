---
title: Strategy architecture
sidebar_position: 2
---

# Strategy architecture

This document describes how CreatorVault allocates deposited tokens across multiple yield strategies, including Ajna lending and Charm Finance LP management. It explains the token pairing rationale, allocation mechanics, and expected yields.

**Who this is for:** Protocol engineers, vault operators, and anyone evaluating CreatorVault yield strategies.

---

## Overview

CreatorVault uses a multi-strategy approach to maximize yield while maintaining liquidity for withdrawals:

- **Trading:** CREATOR/ZORA pools on Uniswap V4 for price discovery
- **Lending:** Ajna pools with WETH collateral for interest income
- **LP management:** Charm Finance vaults for automated V3 liquidity

**Key terms:**

- **Ajna:** Permissionless lending protocol using bucket-based interest rates
- **Charm Finance:** Automated LP management for Uniswap V3 concentrated liquidity
- **Idle buffer:** Portion of assets kept liquid in the vault for withdrawals

---

## Token pairing strategy

### Price discovery: CREATOR/ZORA

All creator tokens have a Uniswap V4 pool paired with ZORA. This pool serves as:

- Primary trading venue
- Price oracle for other strategies
- Bucket calculation source for Ajna lending
- Market cap reference

### Yield strategies: WETH and USDC

Different strategies use different quote tokens based on liquidity depth:

| Strategy | Token pair | Purpose |
|----------|------------|---------|
| Ajna Lending | CREATOR/WETH | Permissionless lending pools |
| Charm LP #1 | CREATOR/WETH | Volatile pair with automated rebalancing |
| Charm LP #2 | CREATOR/USDC | Stable pair for predictable yield |

---

## Architecture diagram

```
Creator Token (e.g., AKITA)
|
+-- TRADING & PRICE DISCOVERY
|   +-- Uniswap V4: CREATOR/ZORA
|       - Primary trading venue
|       - Price oracle for other strategies
|       - 3% fee tier (custom tick spacing 200)
|
+-- LENDING STRATEGY
|   +-- Ajna: CREATOR/WETH
|       - Permissionless lending
|       - Bucket-based interest rates
|       - No oracles needed
|       - Uses ZORA price for bucket calculation
|
+-- LP STRATEGY #1 (Volatile Pair)
|   +-- Charm Finance: CREATOR/WETH
|       - Uniswap V3 concentrated liquidity
|       - Automated rebalancing
|       - 1% fee tier
|
+-- LP STRATEGY #2 (Stable Pair)
    +-- Charm Finance: CREATOR/USDC
        - Uniswap V3 concentrated liquidity
        - Automated rebalancing
        - 1% fee tier
```

---

## Strategy interactions

### Price discovery flow

```
Uniswap V4 (CREATOR/ZORA)
  | Current tick
  v Calculate bucket
Ajna Strategy (CREATOR/WETH)
  | Deposit at optimal bucket
  v Earn interest
Vault
```

The V4 pool provides the reference price used to calculate optimal Ajna bucket placement. This ensures lending positions are placed at market-relevant price levels.

### Multi-strategy allocation

```
User deposits 100M CREATOR tokens
  |
  v
Vault splits allocation:
  - 25M -> Ajna (CREATOR/WETH)        [Lending yield]
  - 25M -> Charm LP #1 (CREATOR/WETH) [LP fees + rebalancing]
  - 25M -> Charm LP #2 (CREATOR/USDC) [Stable LP fees]
  - 25M -> Idle (in vault)            [Available for withdrawals]
```

---

## Yield sources

### Ajna Lending (CREATOR/WETH)

| Attribute | Value |
|-----------|-------|
| Yield source | Interest from borrowers |
| Risk level | Low (over-collateralized) |
| Liquidity | Can be withdrawn anytime |
| Expected APY | 5-15% typical |

### Charm LP #1 (CREATOR/WETH)

| Attribute | Value |
|-----------|-------|
| Yield source | Trading fees + IL protection |
| Risk level | Medium (impermanent loss exposure) |
| Liquidity | Automated rebalancing |
| Expected APY | 10-50% depending on volume |

### Charm LP #2 (CREATOR/USDC)

| Attribute | Value |
|-----------|-------|
| Yield source | Trading fees |
| Risk level | Lower (USDC is stable) |
| Liquidity | Predictable |
| Expected APY | 5-20% typical |

---

## Design rationale

### ZORA for trading

- Aligned with creator economy narrative
- Single trading venue for all creators
- Unified liquidity across ecosystem
- Consistent price comparisons

### WETH for lending

- Deep liquidity in DeFi lending markets
- Standard collateral across protocols
- Lower slippage on swaps
- Strong borrowing demand

### USDC for stable LPs

- Predictable yields
- Reduced impermanent loss
- Attracts risk-averse depositors
- Stable unit of account

### Multiple strategies

- Diversified yield sources
- Risk-adjusted returns
- Liquidity across different venues
- Optimized for varying market conditions

---

## Deployment example

For AKITA token:

```bash
# 1. Price discovery: Use AKITA/ZORA V4 pool
export AKITA_TOKEN=0x5b674196812451b7cec024fe9d22d2c0b172fa75
export AKITA_VAULT=0xA015954E2606d08967Aee3787456bB3A86a46A42

# 2. Deploy Ajna strategy (AKITA/WETH lending)
./scripts/deploy/ajna/DEPLOY_AKITA_AJNA.sh
# -> Queries AKITA/ZORA for price
# -> Deploys AKITA/WETH Ajna pool
# -> Sets optimal bucket based on ZORA price

# 3. Deploy Charm LP #1 (AKITA/WETH)
# Pending: script DEPLOY_AKITA_CHARM_WETH.sh (not yet authored)

# 4. Deploy Charm LP #2 (AKITA/USDC)
# Pending: script DEPLOY_AKITA_CHARM_USDC.sh (not yet authored)

# 5. Configure vault with all strategies
cast send $AKITA_VAULT "addStrategy(address,uint256)" $AJNA_STRATEGY 100
cast send $AKITA_VAULT "addStrategy(address,uint256)" $CHARM_WETH_STRATEGY 100
cast send $AKITA_VAULT "addStrategy(address,uint256)" $CHARM_USDC_STRATEGY 100
cast send $AKITA_VAULT "setMinimumTotalIdle(uint256)" 25000000000000000000000000
```

---

## Configuration options

### Ajna quote token

```bash
# Default: WETH
AJNA_QUOTE_TOKEN="$WETH"

# Alternative: USDC (more stable)
AJNA_QUOTE_TOKEN="$USDC"

# Alternative: ZORA (align with V4 pool)
AJNA_QUOTE_TOKEN="$ZORA"
```

**Recommendation:** Use WETH for Ajna due to deeper liquidity in DeFi lending markets.

---

## Implementation status

### Completed

- Uniswap V4 price discovery (CREATOR/ZORA)
- Ajna strategy deployment (CREATOR/WETH)
- Automatic bucket calculation from V4 price
- Generalized deployment for any creator
- Multi-strategy vault framework

### In progress

- Charm Finance LP strategy #1 (CREATOR/WETH)
- Charm Finance LP strategy #2 (CREATOR/USDC)
- Deployment scripts for Charm strategies
- Testing multi-strategy allocation

### Planned

- Strategy weight optimization
- Rebalancing logic between strategies
- Performance monitoring dashboard
- Automated strategy deployment via UI

---

## FAQ

**Why not use ZORA for everything?**

ZORA is ideal for trading due to its creator economy narrative, but WETH and USDC have much deeper liquidity in DeFi lending and LP markets. Using standard pairs maximizes yield opportunities.

**Can I change the Ajna quote token?**

Yes. Edit the `AJNA_QUOTE_TOKEN` variable in the deployment scripts. Note that WETH typically has better lending markets.

**Why separate CREATOR/WETH and CREATOR/USDC LPs?**

Diversification. WETH LPs are more volatile but higher yield. USDC LPs are more stable and predictable. Vault users get balanced exposure to both.

**Do all strategies use the same price?**

Yes. All strategies read the price from the CREATOR/ZORA V4 pool for consistency. This ensures accurate Ajna buckets, optimal LP ranges, and no arbitrage between strategies.

---

## References

- [Ajna strategy deployment](../strategies/ajna/deployment.md)
- [Ajna bucket calculator](../strategies/ajna/bucket-calculator.md)
- [Ajna strategy guide](../strategies/ajna/guide.md)
- [Account abstraction activation](../account-abstraction/activation.md)
