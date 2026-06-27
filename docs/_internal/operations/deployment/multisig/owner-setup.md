---
title: Owner Setup
sidebar_position: 3
---

# Multisig Owner Setup

Configure Safe multisig as contract owner.

## Role Assignment

Assign roles from Safe:

```solidity
// Set management role
vault.setManagement(managementAddress);

// Set keeper role
vault.setKeeper(keeperAddress);

// Set emergency admin
vault.setEmergencyAdmin(emergencyAddress);
```

## Security Best Practices

- Owner: Multisig only
- Management: Can be EOA or multisig
- Keeper: Bot-friendly EOA
- EmergencyAdmin: Hot wallet for quick response
