---
title: Deploy Vault
sidebar_position: 2
---

# Deploy Vault

Technical guide to deploying a CreatorVault.

## Via Web UI (Recommended)

1. Navigate to [erc4626.fun/deploy](https://erc4626.fun/deploy)
2. Connect wallet
3. Enter token address
4. Click Deploy
5. Sign once

## Via Smart Contract

```solidity
// Deploy using factory
(address vault, address wrapper, address shareOFT) = factory.deployCreatorVault(
    creatorCoinAddress,     // Your Creator Coin
    "TOKEN Vault",          // Vault name
    "▢TOKEN",               // Vault symbol
    "TOKEN Share",          // OFT name
    "■TOKEN",               // OFT symbol
    "base",                 // Chain prefix
    msg.sender              // Revenue recipient
);
```

## Via Script

```bash
forge script script/DeployCreatorVault.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify
```

## Post-Deployment Configuration

### 1. Set DEX Pools

```solidity
shareOFT.setAddressType(uniswapPool, OperationType.SwapOnly);
```

### 2. Configure GaugeController

```solidity
shareOFT.setGaugeController(gaugeController);
```

### 3. Add Strategies (Optional)

```solidity
vault.addStrategy(strategyAddress, 5000); // 50% allocation
```

## Verification

After deployment, verify:

- [ ] Vault accepts deposits
- [ ] OFT mints correctly
- [ ] Fee collection works
- [ ] Lottery entries trigger
