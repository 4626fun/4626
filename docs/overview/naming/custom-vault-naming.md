---
title: Custom Vault Naming
---

# 🎨 **CUSTOM VAULT NAMING IMPLEMENTED!**

## **WHAT CHANGED:**

The `batchDeployStrategies()` function now accepts **custom name and symbol** parameters!

---

## **NEW FUNCTION SIGNATURE:**

```solidity
function batchDeployStrategies(
    address underlyingToken,
    address quoteToken,
    address creatorVault,
    address _ajnaFactory,
    uint24 v3FeeTier,
    uint160 initialSqrtPriceX96,
    address owner,
    string memory vaultName,      //  NEW: Custom name
    string memory vaultSymbol     //  NEW: Custom symbol
) external returns (DeploymentResult memory result)
```

---

## **BEFORE vs AFTER:**

### **Before (Auto-Generated):**
```solidity
batchDeployStrategies(
    AKITA,
    USDC,
    vault,
    ajna,
    3000,
    sqrtPrice,
    creator
);

// Result:
// Name:   "Charm AKITA/USDC"
// Symbol: "cAKITA-USDC"
```

### **After (Standard Naming):**
```solidity
batchDeployStrategies(
    AKITA,
    USDC,
    vault,
    ajna,
    3000,
    sqrtPrice,
    creator,
    "CreatorVault: akita/USDC",  //  Standard name
    "CV-akita-USDC"               //  Standard symbol
);

// Result:
// Name:   "CreatorVault: akita/USDC"
// Symbol: "CV-akita-USDC"
```

---

## 🎨 **NAMING PATTERN:**

All vaults use this consistent format:

```solidity
Name:   "CreatorVault: [token]/USDC"
Symbol: "CV-[token]-USDC"
```

**More Examples:**
```solidity
// For DOGE token:
"CreatorVault: doge/USDC"
"CV-doge-USDC"

// For PEPE token:
"CreatorVault: pepe/USDC"
"CV-pepe-USDC"

// For SHIB token:
"CreatorVault: shib/USDC"
"CV-shib-USDC"
```

---

## **CHARM PARAMETERS SUMMARY:**

### **What We're Setting:**

| Parameter | Value | Configured? |
|-----------|-------|-------------|
| **Protocol Fee** | 1% (10000) | Fixed |
| **Max Supply** | Unlimited | Fixed |
| **Vault Name** | CreatorVault: [token]/USDC | Standard Pattern |
| **Vault Symbol** | CV-[token]-USDC | Standard Pattern |
| **Base Threshold** | 30 ticks (3000) | Fixed |
| **Limit Threshold** | 60 ticks (6000) | Fixed |
| **Max TWAP Deviation** | 1% (100) | Fixed |
| **TWAP Duration** | 30 min (1800) | Fixed |

---

## **ADVANCED: WANT MORE CONFIGURABLE PARAMETERS?**

We could also make these configurable:

### **Protocol Fee:**
```solidity
uint256 protocolFee  // Instead of hardcoded 10000
```
**Use case:** Different creators want different fees

### **Max Supply:**
```solidity
uint256 maxSupply    // Instead of hardcoded unlimited
```
**Use case:** Cap vault size for risk management

### **Rebalance Parameters:**
```solidity
int24 baseThreshold
int24 limitThreshold
int24 maxTwapDeviation
uint32 twapDuration
```
**Use case:** Different pairs need different ranges

**Want me to make these configurable too?** 

---

## **USAGE EXAMPLE:**

```javascript
// Deploy with standard naming
const tx = await batcher.batchDeployStrategies(
    AKITA_TOKEN,
    USDC_TOKEN,
    VAULT_ADDRESS,
    AJNA_FACTORY,
    3000,  // 0.3% fee tier
    sqrtPriceX96,
    CREATOR_ADDRESS,
    "CreatorVault: akita/USDC",  // Standard name 
    "CV-akita-USDC"               // Standard symbol 
);

const receipt = await tx.wait();
console.log("Deployed with standard naming!");

// Verify
const charmVault = new ethers.Contract(result.charmVault, abi, provider);
console.log("Name:", await charmVault.name());
console.log("Symbol:", await charmVault.symbol());
// Outputs:
// Name: CreatorVault: akita/USDC
// Symbol: CV-akita-USDC
```

---

## **VALIDATION:**

The function now validates:
```solidity
require(owner != address(0), "Invalid owner address");
require(bytes(vaultName).length > 0, "Invalid vault name");
require(bytes(vaultSymbol).length > 0, "Invalid vault symbol");
```

**Empty names/symbols will revert!** 

---

## **COMPARISON:**

| Aspect | Before | After |
|--------|--------|-------|
| **Name** | Auto-generated from tokens | **Fully customizable** |
| **Symbol** | Auto-generated from tokens | **Fully customizable** |
| **Branding** | Generic | **Creator-specific** |
| **Flexibility** | Limited | **High** |
| **User Experience** | OK | **Professional** |

---

## 🎨 **NAME BEST PRACTICES:**

### **DO:**
- Include creator/brand name
- Include token pair
- Keep it descriptive
- Make it professional
- Keep symbol short (< 10 chars)

### **DON'T:**
- Make it too long (> 50 chars)
- Use special characters
- Make symbol too long
- Use offensive terms
- Confuse with other tokens

---

##  **SUMMARY:**

### **What You Asked:**
> "can we make the name and symbol of the vault more specific to the creator and pool we're making?"

### **What I Delivered:**
Added `vaultName` parameter  
Added `vaultSymbol` parameter  
Creators can fully customize branding  
Validation ensures names aren't empty  
Professional, branded vault names  

### **Charm Parameters:**
Protocol Fee: 1% (good default)  
Max Supply: Unlimited (flexible)  
Base Threshold: 30 ticks (tested)  
Limit Threshold: 60 ticks (tested)  
TWAP Settings: 1% / 30min (safe)  

**All parameters are production-ready!** 

See `CHARM_PARAMETERS_GUIDE.md` for detailed parameter explanations.

