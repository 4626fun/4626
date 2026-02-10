---
title: Deploy Vault
sidebar_position: 2
---

# Deploy Vault

Technical guide to deploying a CreatorVault.

## Via Web UI (Recommended)

Preferred setup is a **1-click deploy**:

- The user approves **one** EOA transaction (setup).
- The server continues the deploy by submitting the remaining ERC-4337 UserOps and then cleans up the temporary owner.

1. Navigate to [4626.fun/deploy](https://4626.fun/deploy)
2. Sign in (Privy or SIWE) so the app can use the paymaster proxy (`/api/paymaster`)
3. Connect an **owner EOA wallet** on Base (e.g. Coinbase Wallet) that is already an onchain owner of the canonical Coinbase Smart Wallet
4. Click Deploy
5. Approve the one-time setup transaction: `CoinbaseSmartWallet.addOwnerAddress(sessionOwner)`
6. Wait while the server completes Phases 1–4 and removes the temporary owner

Note: the owner EOA needs a small amount of Base ETH to pay gas for the setup transaction.

### Required config (1-click)

Client:
- `VITE_DEPLOY_USE_SERVER_CONTINUE=true`
- `VITE_CDP_PAYMASTER_URL=/api/paymaster` (recommended; avoids cross-origin auth issues)

Server (Vercel):
- `CDP_PAYMASTER_URL` (real bundler/paymaster URL used by `/api/paymaster`)
- `DEPLOY_SESSION_SECRET` (required to store/advance deploy sessions safely)
- `DATABASE_URL` (required for deploy session persistence)
- `BASE_RPC_URL` (optional; defaults to `https://mainnet.base.org`)

### Important: Zora cross-app is read-only here

In this app, the Zora cross-app integration is **read-only**. We can use it to read linked accounts/assets, but we **cannot** use it to sign UserOps or send transactions for deployment.

If you see `Cannot transact against a read-only provider app`, it means a deploy path incorrectly tried to use cross-app signing/tx and should be disabled.

### If 1-click is not possible

If the connected EOA wallet is not an onchain owner of the canonical smart wallet, the setup transaction cannot be sent.

Fix: add the EOA as an owner first (one-time). After that, deploys can use the 1-click path.

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
