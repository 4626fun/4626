---
title: Governance Acceptance
---

# **GOVERNANCE ACCEPTANCE: DO YOU NEED TO DO THIS FOR EVERY VAULT?**

## ❓ **YOUR QUESTION:**
> "do i need to accept ownership every vault? or is this automated"

---

## **SHORT ANSWER:**

**YES** - You need to accept governance for **each new CharmAlphaVault** that gets deployed.

**BUT** - This only happens when a **new CREATOR launches their vault**, not when users deposit.

**GOOD NEWS** - The vault works perfectly fine without accepting! You just can't change governance settings until you accept.

---

## **WHEN DOES THIS HAPPEN?**

### **Scenario 1: CREATOR Deploys Vault (You Accept) **
```
Creator A launches their vault
  ↓
batchDeployStrategies() creates:
  - CharmAlphaVault A (pendingGovernance = your multisig)
  - Strategies A
  ↓
You need to accept governance for CharmAlphaVault A
```

### **Scenario 2: Another CREATOR Deploys Vault (You Accept) **
```
Creator B launches their vault
  ↓
batchDeployStrategies() creates:
  - CharmAlphaVault B (pendingGovernance = your multisig)
  - Strategies B
  ↓
You need to accept governance for CharmAlphaVault B
```

### **Scenario 3: User Deposits (No Action Needed) **
```
User deposits to Creator A's vault
  ↓
Funds go through existing CharmAlphaVault A
  ↓
NO acceptance needed - vault already set up
```

---

## **WHY IS THIS NEEDED?**

CharmAlphaVault uses **two-step governance transfer** for safety:

```solidity
// Step 1: Current governance proposes new owner
function setGovernance(address _governance) external onlyGovernance {
    pendingGovernance = _governance;  // You're now "pending"
}

// Step 2: New owner accepts
function acceptGovernance() external {
    require(msg.sender == pendingGovernance);
    governance = msg.sender;  // You're now the owner
}
```

**This prevents accidents:**
- If wrong address is set, you can't recover with one-step transfer
- New owner must prove they control the address
- Industry standard (Compound, Aave, etc. use this)

---

## **HOW OFTEN WILL THIS HAPPEN?**

**It depends on your use case:**

### **If you're running a platform with many creators:**
- Each creator that launches = 1 acceptance needed
- Example: 10 creators launch → 10 acceptances needed

### **If you're launching your own single vault:**
- Just once! (1 creator = 1 acceptance)

### **User deposits:**
- Never require acceptance 

---

## **WHAT HAPPENS IF YOU DON'T ACCEPT?**

### **What STILL WORKS:** 
- Users can deposit
- Users can withdraw
- Strategy rebalances automatically
- Fees are collected
- Everything functions normally

### **What DOESN'T WORK:** 
- You can't change protocol fee
- You can't change supply cap
- You can't update the strategy
- You can't call emergency functions
- You can't transfer governance to someone else

**Summary:** The vault works fine, but you can't modify governance parameters.

---

## **CAN WE AUTOMATE THIS?**

### **Option 1: Manual Acceptance (Current) **

**Pros:**
- Safest approach
- Follows industry best practices
- Clear audit trail

**Cons:**
- Requires manual transaction for each vault
- Multisig signers need to be online

---

### **Option 2: Skip Acceptance (Lazy Mode) 🤷**

Just don't accept governance!

**Pros:**
- No extra transactions needed
- Vault works perfectly
- Can accept later when you need to change something

**Cons:**
- Can't modify governance parameters
- Looks "incomplete" if you check ownership

---

### **Option 3: Batch Acceptance 📦**

Accept multiple vaults at once from your multisig:

```javascript
// Accept governance for multiple vaults in one multisig transaction
const calls = [
    {
        to: charmVaultA,
        data: charmVault.interface.encodeFunctionData("acceptGovernance")
    },
    {
        to: charmVaultB,
        data: charmVault.interface.encodeFunctionData("acceptGovernance")
    },
    {
        to: charmVaultC,
        data: charmVault.interface.encodeFunctionData("acceptGovernance")
    }
];

// Send as batched multisig transaction
await multisig.execTransaction(calls);
```

**Pros:**
- Accept many at once
- Only one multisig signing session
- Still safe and standard

**Cons:**
- Still requires manual action

---

### **Option 4: Auto-Accept in Deployment (Requires Code Change) **

I can modify the batcher to automatically accept governance in the same transaction!

**How it works:**
```solidity
// Deploy CharmAlphaVault with a callback mechanism
// Batcher deploys, sets strategy, then calls back to multisig
// Multisig auto-accepts via ERC-1271 or similar
```

**Pros:**
- Fully automated
- No manual acceptance needed
- One transaction does everything

**Cons:**
- Requires modifying CharmAlphaVault code (diverges from original Charm)
- Requires multisig to support callbacks (most do)
- More complex, more testing needed

**Want me to implement this?** I can do it if you want full automation!

---

## 💼 **WHICH OPTION SHOULD YOU CHOOSE?**

### **For a Single Vault:**
→ **Option 1 (Manual)** - Just accept it once, no big deal

### **For a Few Vaults (2-5 creators):**
→ **Option 3 (Batch)** - Accept them all at once weekly

### **For Many Vaults (10+ creators):**
→ **Option 4 (Auto-Accept)** - Worth automating

### **For Low-Touch Operation:**
→ **Option 2 (Skip It)** - Accept only when you need to change settings

---

## **MY RECOMMENDATION:**

**Start with Option 1 (Manual):**
1. It's the safest
2. It's the standard
3. You'll know exactly what you're accepting
4. You can always switch to automation later

**Then consider Option 3 (Batch) if you get many vaults:**
- Accept 5-10 vaults at once in a single multisig transaction
- Do it weekly or monthly

**Only implement Option 4 (Auto) if:**
- You're expecting 50+ creator vaults
- The manual burden becomes significant
- You're comfortable with more complex code

---

## **COMPARISON TABLE:**

| Option | Effort per Vault | Safety | Complexity | Recommended For |
|--------|------------------|--------|------------|-----------------|
| **Manual** | 1 tx each |  | Low | 1-5 vaults |
| **Skip** | 0 tx |  | Low | Low-touch ops |
| **Batch** | 1 tx per batch |  | Medium | 5-20 vaults |
| **Auto** | 0 tx |  | High | 20+ vaults |

---

## **WHAT I RECOMMEND FOR YOU:**

Based on your setup:
1. **Start with manual acceptance** (Option 1)
2. **If you get 5+ vaults, switch to batch** (Option 3)
3. **If you get 20+ vaults, I'll implement auto-accept** (Option 4)

**For now, manual is FINE!** It's:
- Safe
- Simple
- Standard
- One tx per new creator vault (not per deposit)

---

## ❓ **WANT ME TO IMPLEMENT AUTO-ACCEPT?**

If you want Option 4 (full automation), I can implement it! It would:
- Eliminate manual acceptance
- Work with most multisigs (Safe, Gnosis, etc.)
- Keep everything in one transaction

**Just say the word and I'll code it up!** 

Otherwise, **manual acceptance is totally fine for most use cases.**

---

## **SUMMARY:**

**Question:** "do i need to accept ownership every vault?"

**Answer:** 
- YES - Once per new CREATOR vault deployed
- NO - Not for each user deposit (only on vault creation)
- 🤷 OPTIONAL - Vault works fine without accepting, you just can't change governance settings

**Frequency:**
- If 1 creator launches: Accept once
- If 10 creators launch: Accept 10 times (or batch them)
- If 100 users deposit: No acceptance needed

**Bottom line:** It's per CREATOR vault launch, not per user interaction. For most cases, this is totally manageable! 

