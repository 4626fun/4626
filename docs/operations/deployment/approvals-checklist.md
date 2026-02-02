---
title: Approvals checklist
sidebar_position: 2
---

# Required approvals checklist

This document lists all approvals required for vault deployment.

**Who this is for:** Protocol operators setting up deployment infrastructure.

---

## Critical approval

After deploying CCALaunchStrategy, the protocol owner must approve the batcher:

```solidity
CCALaunchStrategy(ccaAddress).setApprovedLauncher(
    VAULT_ACTIVATION_BATCHER_ADDRESS,
    true
);
```

This is the only critical approval needed from the protocol.

---

## Full checklist

### 1. Deploy contracts

```bash
forge create StrategyDeploymentBatcher
forge create VaultActivationBatcher
forge create CCALaunchStrategy
```

### 2. Protocol approval (critical)

From your multisig:

```solidity
ccaStrategy.setApprovedLauncher(vaultActivationBatcherAddress, true);
```

### 3. User approvals

Each user approves their tokens before deploying:

```solidity
creatorToken.approve(strategyDeploymentBatcherAddress, MAX_UINT);
```

---

## Coinbase Smart Wallet (optional)

If using Coinbase Smart Wallet features:

### Session keys

- Allow batch transactions without signing each time
- Set expiry (e.g., 24 hours)

### Spend limits

- Allow batchers to spend your tokens within limits
- Prevents over-spending

---

## Approval matrix

| Contract | Approver | Approved spender | Purpose |
|----------|----------|------------------|---------|
| CCALaunchStrategy | Protocol multisig | VaultActivationBatcher | Launch auctions |
| Creator token | User | StrategyDeploymentBatcher | Deploy strategies |
| Creator token | User | VaultActivationBatcher | Activate vault |

---

## Security notes

- Approvals should use explicit amounts when possible
- Revoke unnecessary approvals after use
- Session keys should have short expiry times

---

## References

- [Pre-launch verification](./pre-launch.md)
- [CCA verification](./cca-verification.md)
