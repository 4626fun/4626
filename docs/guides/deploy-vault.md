---
title: Deploy a vault
sidebar_position: 1
---

# Deploy a vault

This guide walks through deploying a new CreatorOVault for a Zora Creator Coin.

**Prerequisites:**
- Creator coin address on Base
- Deployer wallet with ETH for gas
- Familiarity with the [token model](/overview/token-model)

---

## Overview

Deploying a vault creates the core infrastructure:

```
Deploy sequence:
1. CreatorOVault (ERC-4626)
2. CreatorOVaultWrapper
3. CreatorShareOFT (■TOKEN)
4. Configure relationships
5. Add strategies
```

---

## Option 1: Factory deployment

Use `CreatorVaultDeployer` for a complete deployment:

```solidity
CreatorVaultDeployer deployer = CreatorVaultDeployer(DEPLOYER_ADDRESS);

// Deploy all components
(address vault, address wrapper, address shareOFT) = deployer.deployVault(
    creatorCoin,           // TOKEN address
    "Creator OVault - AKITA",  // Vault name
    "▢AKITA",              // Vault symbol
    "AKITA Shares",        // OFT name
    "■AKITA",              // OFT symbol
    owner                  // Owner address
);
```

This deploys:
- CreatorOVault
- CreatorOVaultWrapper
- CreatorShareOFT (if registry available)

---

## Option 2: Manual deployment

### Step 1: Deploy vault

```solidity
CreatorOVault vault = new CreatorOVault(
    creatorCoin,              // Underlying asset
    owner,                    // Owner address
    "Creator OVault - AKITA", // Name
    "▢AKITA"                  // Symbol
);
```

### Step 2: Deploy wrapper

```solidity
CreatorOVaultWrapper wrapper = new CreatorOVaultWrapper(
    creatorCoin,      // TOKEN
    address(vault),   // Vault address
    owner             // Owner
);
```

### Step 3: Deploy ShareOFT

```solidity
CreatorShareOFT shareOFT = new CreatorShareOFT(
    "AKITA Shares",       // Name
    "■AKITA",             // Symbol
    registry,             // CreatorRegistry address
    owner                 // Owner
);
```

### Step 4: Configure relationships

```solidity
// Set vault on wrapper
wrapper.setShareOFT(address(shareOFT));

// Set vault on ShareOFT
shareOFT.setVault(address(vault));

// Set minter permission
shareOFT.setMinter(address(wrapper), true);

// Set gauge controller
shareOFT.setGaugeController(gaugeController);
```

---

## Configuration

### Access control

```solidity
// Set management (can manage strategies)
vault.setManagement(managementAddress);

// Set keeper (can deploy/report)
vault.setKeeper(keeperAddress);

// Set emergency admin
vault.setEmergencyAdmin(emergencyAddress);
```

### Strategy setup

```solidity
// Add yield strategies
vault.addStrategy(charmStrategy, 6900);   // 69%
vault.addStrategy(ajnaStrategy, 2139);    // 21.39%

// Set idle buffer
vault.setMinimumTotalIdle(4_805_000e18);  // 9.61%
```

### Fee configuration

```solidity
// Set performance fee (default 10%)
vault.setPerformanceFee(1000);

// Set fee recipient
vault.setPerformanceFeeRecipient(feeRecipient);
```

### DEX registration

```solidity
// Register trading venues for fee detection
shareOFT.setAddressType(uniswapPool, OperationType.SwapOnly);
shareOFT.setAddressTypes(dexPools, OperationType.SwapOnly);
```

---

## Verification

### Check deployment

```solidity
// Vault
require(vault.asset() == creatorCoin);
require(vault.owner() == owner);

// Wrapper
require(wrapper.shareOFT() == shareOFT);

// ShareOFT
require(shareOFT.vault() == address(vault));
require(shareOFT.gaugeController() == gaugeController);
```

### Test deposit

```solidity
// Approve
creatorCoin.approve(address(vault), testAmount);

// Deposit
uint256 shares = vault.deposit(testAmount, depositor);

// Verify
require(vault.balanceOf(depositor) == shares);
require(vault.totalAssets() == testAmount);
```

---

## Post-deployment

### Register with CreatorRegistry

```solidity
registry.registerVault(
    creatorCoin,
    address(vault),
    address(wrapper),
    address(shareOFT)
);
```

### Whitelist (if enabled)

```solidity
// Whitelist initial depositors
vault.setWhitelistEnabled(true);
vault.setWhitelistBatch(addresses, true);
```

### Cross-chain setup (if needed)

```solidity
// Configure LayerZero peers on each chain
shareOFT.setPeer(dstEid, bytes32(peerAddress));
```

---

## Next steps

- [Activate vault](./activate-vault) - Complete activation
- [Launch token](./launch-token) - Fair launch via CCA
- [Strategy docs](/contracts/strategies) - Configure strategies

---

## Troubleshooting

### Common issues

| Issue | Solution |
|-------|----------|
| First deposit fails | Ensure amount >= MINIMUM_FIRST_DEPOSIT (5M) |
| ShareOFT not minting | Check minter permission on wrapper |
| No fees collected | Register DEX pools as SwapOnly |
| Cross-chain fails | Configure peers on both chains |
