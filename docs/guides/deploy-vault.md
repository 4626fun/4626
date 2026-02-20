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
- `AUTH_SESSION_SECRET`
- `CANONICAL_ORIGIN`
- `DATABASE_URL`
- `DEPLOY_SESSION_SECRET`
- `DEPLOY_SESSION_TOKEN_HMAC_SECRET`
- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`
- `PRIVY_WALLET_AUTHORIZATION_KEY`
- `PRIVY_WALLET_OWNER_ID`
- `PRIVY_WALLET_POLICY_ID`
- `BASE_RPC_URL` (optional; defaults to `https://mainnet.base.org`)

Production override safety:
- leave `VITE_ALLOW_CONTRACT_OVERRIDES` unset (or `0`)
- leave `ALLOW_API_CONTRACT_OVERRIDES` unset (or `0`)
- production then uses repo defaults from `frontend/src/config/contracts.defaults.ts`

### Split Phase-1 rollout (Base mainnet + Vercel)

Current canonical Base defaults:
- `CreatorVaultDeployer` (split Phase-1 batcher): `0x32e91185B92c6c13dd56D745aBf24F009cdD3019`
- `UniversalBytecodeStoreV2`: `0x1268f550E794e235e4eFCE7B2D3fd7a30bb62d13`
- `UniversalCreate2DeployerFromStoreV2`: `0x74183076C7D33346880A5bf0e263B761FB4d38BA`

Mainnet deploy order:

1. Deploy/re-verify infra + phased deployer:

```bash
export PRIVATE_KEY=...
export BASE_RPC_URL=https://mainnet.base.org
export ETHERSCAN_API_KEY=...

forge script script/DeployBaseMainnetDeployer.s.sol:DeployBaseMainnetDeployer \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast \
  --verify
```

2. Seed bytecode store:

```bash
export PRIVATE_KEY=...
export BASE_RPC_URL=https://mainnet.base.org
export UNIVERSAL_BYTECODE_STORE=0x1268f550E794e235e4eFCE7B2D3fd7a30bb62d13

forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast
```

If you use `./script/deploy.sh infra-v2` or `./script/deploy-infra-v2.sh`, this seed step now runs automatically.

3. Onchain sanity checks:

```bash
export BASE_RPC_URL=https://mainnet.base.org
export NEW_BATCHER=0x32e91185B92c6c13dd56D745aBf24F009cdD3019

# infra wiring
cast call "$NEW_BATCHER" "bytecodeStore()(address)" --rpc-url "$BASE_RPC_URL"
cast call "$NEW_BATCHER" "create2Deployer()(address)" --rpc-url "$BASE_RPC_URL"

# split Phase-1 selectors in runtime bytecode
cast code "$NEW_BATCHER" --rpc-url "$BASE_RPC_URL" | tr 'A-F' 'a-f' | rg "1331378b|a98ec9d8|4154f24e|3bc09a8b"

# v2 store surface
cast call 0x1268f550E794e235e4eFCE7B2D3fd7a30bb62d13 \
  "chunkCount(bytes32)(uint256)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  --rpc-url "$BASE_RPC_URL"
```

4. Optional Solana routing (required if you want the 20% Solana split to bridge instead of vesting fallback):

```bash
export PRIVATE_KEY=... # must be protocolTreasury for setSolanaConfig
export BASE_RPC_URL=https://mainnet.base.org
export CREATOR_VAULT_BATCHER=0x32e91185B92c6c13dd56D745aBf24F009cdD3019
export SOLANA_BRIDGE_ADAPTER=0x5D0e33a4DFAA4e1EB4BDf41B953baa03CA73eA92
export SOLANA_DESTINATION=0x<32-byte-solana-pubkey>
export SET_BATCHER_SOLANA_CONFIG=1

forge script script/AuthorizeSolanaAdapter.s.sol:AuthorizeSolanaAdapter \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast
```

Optional keeper setup (same script):
- set `SOLANA_KEEPER_PUBKEY=0x<32-byte-solana-pubkey>` before running.

Vercel cutover order:

1. Merge frontend/api split-phase code + paymaster selector support.
2. Merge repo defaults pointing to the new mainnet infra addresses.
3. Set production env vars listed in "Required config (1-click)".
4. Keep override flags disabled (`VITE_ALLOW_CONTRACT_OVERRIDES`, `ALLOW_API_CONTRACT_OVERRIDES`).
5. Keep:
   - `VITE_DEPLOY_USE_SERVER_CONTINUE=true`
   - `VITE_CDP_PAYMASTER_URL=/api/paymaster`

Acceptance checks:
- `pnpm -C frontend run typecheck`
- `pnpm -C frontend exec vitest run api/__tests__/deploySession.test.ts api/__tests__/deploySessionOwnership.test.ts`
- paymaster accepts split selectors (no `batcher_selector_not_allowed`)
- deploy-session path advances:
  - `created -> phase1_sent -> phase1_finalize_sent -> phase2_core_sent -> phase2_sent -> phase3_sent -> completed`
- `/deploy` shows no bytecode infra blocker and no `CreatorVaultBatcher not configured`

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
