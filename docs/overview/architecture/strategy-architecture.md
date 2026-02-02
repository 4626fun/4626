# CreatorVault Strategy Architecture

## Overview

CreatorVault uses a **multi-token, multi-strategy** approach to maximize yield across different DeFi protocols while maintaining liquidity.

---

## 🎯 Token Pairing Strategy

### **For Price Discovery: CREATOR/ZORA**

All creator tokens have a **Uniswap V4 pool paired with ZORA** for:
- ✅ Primary trading venue
- ✅ Price discovery and oracle
- ✅ Bucket calculation for Ajna lending
- ✅ Market cap calculations

**Example**: AKITA/ZORA on Uniswap V4

### **For Yield Strategies: WETH & USDC**

Different yield strategies use different token pairs:

| Strategy | Token Pair | Purpose |
|----------|------------|---------|
| **Ajna Lending** | CREATOR/WETH | Permissionless lending pools |
| **Charm LP #1** | CREATOR/WETH | Automated V3 LP management |
| **Charm LP #2** | CREATOR/USDC | Stable pair for predictable yield |

---

## 📊 Complete Architecture

```
Creator Token (e.g., AKITA)
│
├─ TRADING & PRICE DISCOVERY
│  └─ Uniswap V4: CREATOR/ZORA
│     - Primary trading venue
│     - Price oracle for other strategies
│     - 3% fee tier (custom tick spacing 200)
│
├─ LENDING STRATEGY
│  └─ Ajna: CREATOR/WETH
│     - Permissionless lending
│     - Bucket-based interest rates
│     - No oracles needed
│     - Uses ZORA price for bucket calculation
│
├─ LP STRATEGY #1 (Volatile Pair)
│  └─ Charm Finance: CREATOR/WETH
│     - Uniswap V3 concentrated liquidity
│     - Automated rebalancing
│     - 1% fee tier
│
└─ LP STRATEGY #2 (Stable Pair)
   └─ Charm Finance: CREATOR/USDC
      - Uniswap V3 concentrated liquidity
      - Automated rebalancing
      - 1% fee tier
```

---

## 🔄 How Strategies Interact

### **1. Price Discovery Flow**

```
Uniswap V4 (CREATOR/ZORA)
  ↓ Current tick
  ↓ Calculate bucket
Ajna Strategy (CREATOR/WETH)
  ↓ Deposit at optimal bucket
  ↓ Earn interest
Vault
```

### **2. Multi-Strategy Allocation**

```
User deposits 100M CREATOR tokens
  ↓
Vault splits allocation:
  - 25M → Ajna (CREATOR/WETH)    [Lending yield]
  - 25M → Charm LP #1 (CREATOR/WETH) [LP fees + rebalancing]
  - 25M → Charm LP #2 (CREATOR/USDC) [Stable LP fees]
  - 25M → Idle (in vault)        [Available for withdrawals]
```

---

## 💰 Yield Sources

### **Ajna Lending (CREATOR/WETH)**

- **Yield**: Interest from borrowers
- **Risk**: Low (over-collateralized)
- **Liquidity**: Can be withdrawn anytime
- **APY**: 5-15% typical

### **Charm LP #1 (CREATOR/WETH)**

- **Yield**: Trading fees + IL protection
- **Risk**: Medium (impermanent loss)
- **Liquidity**: Automated rebalancing
- **APY**: 10-50% depending on volume

### **Charm LP #2 (CREATOR/USDC)**

- **Yield**: Trading fees
- **Risk**: Lower (USDC is stable)
- **Liquidity**: Predictable
- **APY**: 5-20% typical

---

## 🎨 Why This Architecture?

### **1. ZORA for Trading**
```
✅ Aligned with creator economy narrative
✅ Single trading venue for all creators
✅ Unified liquidity
✅ Easy price comparisons (all in ZORA)
```

### **2. WETH for Lending**
```
✅ Deep liquidity in DeFi
✅ Standard collateral across protocols
✅ Lower slippage
✅ Better borrowing demand
```

### **3. USDC for Stable LPs**
```
✅ Predictable yields
✅ Less impermanent loss
✅ Attracts risk-averse depositors
✅ Stable unit of account
```

### **4. Multiple Strategies**
```
✅ Diversified yield sources
✅ Risk-adjusted returns
✅ Liquidity across different venues
✅ Optimized for different market conditions
```

---

## 🚀 Deployment Flow

### **For AKITA (Example):**

```bash
# 1. Price discovery: Use AKITA/ZORA V4 pool
export AKITA_TOKEN=0x5b674196812451b7cec024fe9d22d2c0b172fa75
export AKITA_VAULT=0xA015954E2606d08967Aee3787456bB3A86a46A42

# 2. Deploy Ajna strategy (AKITA/WETH lending)
./scripts/deploy/ajna/DEPLOY_AKITA_AJNA.sh
# → Queries AKITA/ZORA for price
# → Deploys AKITA/WETH Ajna pool
# → Sets optimal bucket based on ZORA price

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

## 📝 Current Implementation Status

### ✅ **Completed:**

- [x] Uniswap V4 price discovery (CREATOR/ZORA)
- [x] Ajna strategy deployment (CREATOR/WETH)
- [x] Automatic bucket calculation from V4 price
- [x] Generalized deployment for any creator
- [x] Multi-strategy vault framework

### 🚧 **In Progress:**

- [ ] Charm Finance LP strategy #1 (CREATOR/WETH)
- [ ] Charm Finance LP strategy #2 (CREATOR/USDC)
- [ ] Deployment scripts for Charm strategies
- [ ] Testing multi-strategy allocation

### 📋 **Planned:**

- [ ] Strategy weight optimization
- [ ] Rebalancing logic between strategies
- [ ] Performance monitoring dashboard
- [ ] Automated strategy deployment via UI

---

## 🎯 Key Takeaways

1. **Trading**: All creator tokens trade on Uniswap V4 in ZORA pairs
2. **Price Discovery**: V4 ZORA pools provide price data for all strategies
3. **Lending**: Ajna uses WETH for lending (deeper liquidity)
4. **LPs**: Charm uses WETH and USDC (standard DeFi pairs)
5. **Diversification**: Multiple strategies = multiple yield sources
6. **Risk Management**: Vault balances allocation across strategies

---

## 🔧 Configuration Options

### **Ajna Quote Token** (in deployment scripts):

```bash
# Default: WETH
AJNA_QUOTE_TOKEN="$WETH"

# Alternative: USDC (more stable)
AJNA_QUOTE_TOKEN="$USDC"

# Alternative: ZORA (align with V4 pool)
AJNA_QUOTE_TOKEN="$ZORA"
```

**Recommendation**: Use **WETH** for Ajna (deeper liquidity in DeFi lending markets)

---

## 📚 Related Documentation

- [Ajna Strategy Deployment](../strategies/ajna/AJNA_DEPLOYMENT.md)
- [Ajna Bucket Calculator](../strategies/ajna/AJNA_BUCKET_CALCULATOR.md)
- [Creator Ajna Guide](../strategies/ajna/CREATOR_AJNA_GUIDE.md)
- [Account Abstraction Activation](../account-abstraction/AA_ACTIVATION.md)

---

## ❓ FAQ

**Q: Why not use ZORA for everything?**

A: While ZORA is perfect for trading (creator economy narrative), WETH and USDC have much deeper liquidity in DeFi lending and LP markets. Using standard pairs maximizes yield opportunities.

**Q: Can I change the Ajna quote token?**

A: Yes! Edit the `AJNA_QUOTE_TOKEN` variable in the deployment scripts. Just note that WETH typically has better lending markets.

**Q: Why separate CREATOR/WETH and CREATOR/USDC LPs?**

A: Diversification. WETH LPs are more volatile but higher yield. USDC LPs are more stable and predictable. Vault users get balanced exposure to both.

**Q: Do all strategies use the same price?**

A: Yes! All strategies read the price from the CREATOR/ZORA V4 pool for consistency. This ensures:
- Ajna buckets are accurate
- LP ranges are optimal
- No arbitrage between strategies

---

**Last Updated**: December 24, 2025


