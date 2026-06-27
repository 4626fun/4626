---
title: Multisig Deployment
sidebar_position: 2
---

# Deploy with Multisig

Deploying 4626 with Safe multisig as owner.

## Steps

1. **Deploy Safe** - Create multisig wallet
2. **Deploy contracts** - Set Safe as pending owner
3. **Accept ownership** - Safe accepts ownership
4. **Configure** - Execute config via Safe

## Ownership Transfer

```solidity
// From deployer EOA
vault.transferOwnership(safeAddress);

// From Safe multisig
vault.acceptOwnership();
```
