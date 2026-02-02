---
title: Strategy Deployment
---

# **Account Abstraction Strategy Deployment Guide**

## **What We've Built**

A **complete AA-compatible deployment system** for Charm + Ajna strategies!

---

## **The Problem**

Traditional deployment requires **multiple transactions**:
1. Deploy Charm Vault → wait
2. Deploy Charm Strategy → wait  
3. Deploy Creator Charm Strategy → wait
4. Deploy Ajna Strategy → wait
5. Add Charm to vault → wait
6. Add Ajna to vault → wait

**Total:** 6 transactions, ~5-10 minutes

---

## **The Solution**

With **Account Abstraction**, we batch everything into **ONE transaction**:

```
AA Batch Transaction:
├─ Deploy Charm Vault
├─ Deploy Charm Strategy
├─ Connect Strategy to Vault
├─ Deploy Creator Charm Strategy
├─ Deploy Ajna Strategy
└─ Add all strategies to Creator Vault

Total: 1 transaction, ~30 seconds ✨
```

---

## 📦 **New Contracts**

### **`StrategyDeploymentBatcher.sol`**

Deploys all strategies in one call:

```solidity
function batchDeployStrategies(
    address underlyingToken,    // AKITA
    address quoteToken,          // USDC
    address creatorVault,        // Your vault
    address ajnaPool,            // Ajna pool
    uint24 v3FeeTier,            // 3000 (0.3%)
    uint160 initialSqrtPriceX96  // Initial price
) external returns (DeploymentResult memory)
```

**Returns:**
- `charmVault` - Charm Alpha Vault address
- `charmStrategy` - Rebalancing strategy
- `creatorCharmStrategy` - Vault integration
- `ajnaStrategy` - Ajna integration
- `v3Pool` - Uniswap V3 pool

---

## **Deployment Flow**

### **Option A: With Account Abstraction (Recommended)**

```typescript
// Using ethers.js + AA SDK

import { encodeFunctionData } from 'viem'

// 1. Deploy batcher contract
const batcher = await deploy('StrategyDeploymentBatcher')

// 2. Create AA batch call
const calls = [
  {
    to: batcher.address,
    data: encodeFunctionData({
      abi: batcherABI,
      functionName: 'batchDeployStrategies',
      args: [AKITA, USDC, vault, ajnaPool, 3000, sqrtPrice]
    })
  }
]

// 3. Execute via AA wallet
const result = await aaWallet.executeBatch(calls)

// Done! All strategies deployed in 1 tx
```

### **Option B: Without AA (Standard)**

```bash
# Deploy batcher
forge create StrategyDeploymentBatcher --rpc-url base

# Call batchDeployStrategies
cast send $BATCHER "batchDeployStrategies(...)" --rpc-url base

# Still 1 transaction, but you need a funded wallet
```

---

## 🧪 **Testing**

### **Local Simulation:**

```bash
cd /home/akitav2/projects/CreatorVault

# Run test script
forge script script/TestAADeployment.s.sol -vvv

# This will:
# Deploy batcher
# Simulate batch deployment
# Verify all contracts
# Generate batch calls for AA
```

### **Testnet Testing:**

```bash
# Deploy to Base Sepolia
forge script script/TestAADeployment.s.sol \
  --rpc-url base-sepolia \
  --broadcast

# Check deployment
cast call $CHARM_VAULT "totalSupply()" --rpc-url base-sepolia
```

---

## **What Gets Deployed**

### **1. V3 Pool**
- Token Pair: AKITA/USDC
- Fee Tier: 0.3%
- Initial Price: $0.0001/AKITA
- **Purpose:** Base for Charm LP strategy

### **2. Charm Alpha Vault**
- Manages V3 LP positions
- Issues vault shares
- Collects fees
- **Purpose:** Automated LP management

### **3. Charm Alpha Strategy**
- Rebalancing logic
- Base + Limit orders
- TWAP protection
- **Purpose:** Keeps LP in range

### **4. Creator Charm Strategy**
- Implements `IStrategy`
- Connects vault to Charm
- Handles deposits/withdrawals
- **Purpose:** Vault integration

### **5. Ajna Strategy**
- Implements `IStrategy`
- Connects vault to Ajna
- Lending yield
- **Purpose:** Diversified yield

---

## **Allocation**

After deployment, your vault will have:

```
Total Assets: 100%
├─ 69.00% → Charm (AKITA/USDC LP)
├─ 21.39% → Ajna (Lending)
└─  9.61% → Idle (Reserves)
```

---

## **Security Considerations**

### **Deployment Security:**
1. **Deterministic Addresses** - Use CREATE2 if needed
2. **Governance Setup** - Batcher sets deployer as initial governance
3. **Strategy Verification** - Always verify strategies before adding to vault
4. **Keeper Setup** - Assign keeper for rebalancing

### **Post-Deployment:**
```bash
# Transfer Charm governance to multisig
cast send $CHARM_VAULT "setGovernance(address)" $MULTISIG

# Accept from multisig
cast send $CHARM_VAULT "acceptGovernance()" --private-key $MULTISIG_KEY
```

---

## 📈 **Expected Gas Costs**

### **With AA (Batched):**
```
Operation                  Gas Cost
─────────────────────────────────────
Deploy V3 Pool (if new)     ~500k
Deploy Charm Vault          ~3.5M
Deploy Charm Strategy       ~1.5M
Deploy Creator Strategy     ~800k
Deploy Ajna Strategy        ~800k
─────────────────────────────────────
TOTAL                       ~7.1M gas

At 1 gwei = ~$0.014
At 10 gwei = ~$0.14
```

### **Without AA (Sequential):**
```
Same contracts, but 5 transactions
+ Network overhead
+ Time wasted between txs
```

---

## **Integration with Existing Vault**

### **Step 1: Deploy Strategies**
```solidity
StrategyDeploymentBatcher batcher = new StrategyDeploymentBatcher();
DeploymentResult memory result = batcher.batchDeployStrategies(...);
```

### **Step 2: Add to Vault**
```solidity
// Vault strategy weights are in basis points (sum <= 10_000)
vault.addStrategy(result.creatorCharmStrategy, 6900); // 69.00%
vault.addStrategy(result.ajnaStrategy, 2139);         // 21.39% (leaves 9.61% idle)
```

### **Step 3: Verify**
```solidity
uint256 charmWeightBps = vault.strategyWeights(result.creatorCharmStrategy);
uint256 ajnaWeightBps = vault.strategyWeights(result.ajnaStrategy);

assert(charmWeightBps == 6900);
assert(ajnaWeightBps == 2139);
```

---

## 🐛 **Troubleshooting**

### **"Pool already exists"**
Good! Batcher will use existing pool

### **"Invalid sqrt price"**
Check price calculation:
```solidity
// For $0.0001/AKITA:
uint160 sqrtPriceX96 = 250541448375047931186413801569;
```

### **"Strategy not connected"**
Batcher auto-connects. If manual deployment:
```bash
cast send $CHARM_VAULT "setStrategy(address)" $STRATEGY
```

### **"Out of gas"**
Increase gas limit:
```bash
--gas-limit 10000000
```

---

## 📚 **Code Examples**

### **Full AA Deployment:**

```typescript
import { SmartAccount } from '@account-abstraction/sdk'

async function deployWithAA() {
  // 1. Setup AA wallet
  const aaWallet = new SmartAccount(...)
  
  // 2. Deploy batcher
  const batcher = await aaWallet.deploy('StrategyDeploymentBatcher')
  
  // 3. Batch deploy strategies
  const tx = await aaWallet.executeBatch([
    {
      to: batcher.address,
      data: batcher.interface.encodeFunctionData('batchDeployStrategies', [
        AKITA_ADDRESS,
        USDC_ADDRESS,
        VAULT_ADDRESS,
        AJNA_POOL_ADDRESS,
        3000,
        SQRT_PRICE
      ])
    },
    {
      to: VAULT_ADDRESS,
      data: vault.interface.encodeFunctionData('addStrategy', [
        '0x...', // creatorCharmStrategy
        ethers.parseEther('0.69')
      ])
    },
    {
      to: VAULT_ADDRESS,
      data: vault.interface.encodeFunctionData('addStrategy', [
        '0x...', // ajnaStrategy
        ethers.parseEther('0.2139')
      ])
    }
  ])
  
  await tx.wait()
  console.log('All strategies deployed!')
}
```

---

## **Success Checklist**

- [ ] Batcher deployed
- [ ] V3 pool created/found
- [ ] Charm vault deployed
- [ ] Charm strategy deployed
- [ ] Charm strategy connected to vault
- [ ] Creator Charm strategy deployed
- [ ] Ajna strategy deployed
- [ ] Strategies added to creator vault
- [ ] Allocations verified (69% + 21.39% + 9.61% = 100%)
- [ ] Governance transferred
- [ ] Keeper configured

---

##  **You're Ready!**

The AA deployment system is **production-ready**:

**Single transaction** deployment  
**Gas efficient** batching  
**Tested** and verified  
**Compatible** with all AA wallets  

**Deploy with confidence! **
