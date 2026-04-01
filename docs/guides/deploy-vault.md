---
title: Deploy Vault
sidebar_position: 2
---

# Deploy Vault

Technical guide to deploying a 4626.

For the launch order and go-live checklist, use [Ship Checklist](/operations/deployment/launch/ship-checklist).

## Via Web UI (Recommended)

Preferred setup is a **1-click deploy**:

- The user approves **one** EOA transaction (setup).
- The server continues the deploy by submitting the remaining ERC-4337 UserOps and then cleans up the temporary owner.

1. Navigate to [app.4626.fun/deploy](https://app.4626.fun/deploy)
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

Current canonical Base defaults (`v1.7.1` reset target):
- Deployment batcher (`DeploymentBatcher`, split Phase-1): `0x14435cc4A8D307b4d3979148E5AB71Af1ed19088`
- Deployment batcher auto-handoff alias: `0x14435cc4A8D307b4d3979148E5AB71Af1ed19088`
- Creator lottery manager: `0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3`
- `UniversalBytecodeStoreV2`: `0x6A578022609cdb65C614FF28912C49FC1EC97071`
- `UniversalCreate2DeployerFromStoreV2`: `0x5ea71D4d03dEe596E93B5e6BEddA6F96BBF9d36a`

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
export UNIVERSAL_BYTECODE_STORE=0x6A578022609cdb65C614FF28912C49FC1EC97071

forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast
```

If you use `./script/deploy.sh infra-v2` or `./script/deploy-infra-v2.sh`, this seed step now runs automatically.

3. Onchain sanity checks:

```bash
export BASE_RPC_URL=https://mainnet.base.org
export NEW_BATCHER=0x14435cc4A8D307b4d3979148E5AB71Af1ed19088

# infra wiring
cast call "$NEW_BATCHER" "bytecodeStore()(address)" --rpc-url "$BASE_RPC_URL"
cast call "$NEW_BATCHER" "create2Deployer()(address)" --rpc-url "$BASE_RPC_URL"

# split Phase-1 selectors in runtime bytecode
cast code "$NEW_BATCHER" --rpc-url "$BASE_RPC_URL" | tr 'A-F' 'a-f' | rg "4154f24e|3bc09a8b"

# v2 store surface
cast call 0x6A578022609cdb65C614FF28912C49FC1EC97071 \
  "chunkCount(bytes32)(uint256)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  --rpc-url "$BASE_RPC_URL"
```

4. Optional Solana bridge config (used by `SolanaStrategy` in Phase 3):

```bash
export PRIVATE_KEY=... # must be protocolTreasury for setSolanaConfig
export BASE_RPC_URL=https://mainnet.base.org
export DEPLOYMENT_BATCHER=0x14435cc4A8D307b4d3979148E5AB71Af1ed19088
export SOLANA_BRIDGE_ADAPTER=0x2414b595c4f18532A5836B6e2E6d536832c572e8
export SOLANA_DESTINATION=0x<32-byte-solana-pubkey>
export SET_BATCHER_SOLANA_CONFIG=1

forge script script/AuthorizeSolanaAdapter.s.sol:AuthorizeSolanaAdapter \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast
```

Optional keeper setup (same script):
- set `SOLANA_KEEPER_PUBKEY=0x<32-byte-solana-pubkey>` before running.

### Phase-3 strategy model (current)

Phase 3 now uses a three-strategy accounting model on `CreatorOVault`:

- Charm strategy: `30%` (`3_000` bps)
- Ajna strategy sleeve: `30%` (`3_000` bps)
- SolanaStrategy: `30%` (`3_000` bps)
- Idle reserve: `10%` (`1_000` bps via `setMinimumTotalIdle`)

Canonical Ajna phase-3 deployment is now a nested bundle:

- `ERC4626StrategyAdapter` is the strategy registered on `CreatorOVault`
- the adapter points to `AjnaERC4626Vault`
- the inner vault is governed by `AjnaVaultAuth` for admin/keeper/pause/buffer/min-bucket policy

Phase-3 bytecode/code-id inputs therefore include the Ajna bundle pieces rather than the old direct strategy:

- `ajnaVaultAuth`
- `ajnaVault`
- `erc4626StrategyAdapter`

Important phase-3 Ajna params:

- `ajnaVaultName`
- `ajnaBufferRatioBps`
- `ajnaMinBucketIndex`
- `ajnaKeeper`

Post-deploy expectations for the canonical Ajna sleeve:

- `CreatorOVault` stores the adapter address in its strategy list
- `ERC4626StrategyAdapter.ERC4626_VAULT()` resolves to the inner Ajna vault
- `AjnaERC4626Vault.AUTH()` resolves to `AjnaVaultAuth`
- on the auto-handoff batcher release, phase-3 sets `AjnaVaultAuth.admin = params.owner` (creator canonical CSW) by default
- adapter `idleBufferBps` is typically set to `0` so buffering is owned by the inner Ajna vault policy rather than duplicated across layers

### Canonical Ajna automation (post-launch)

Ajna automation is now an explicit, per-vault creator opt-in:

- sender: the creator's canonical Coinbase Smart Wallet
- signer bridge: the creator's Privy embedded EOA
- initial scope: `ajna_min_bucket_only`
- revoke behavior: disabling automation removes the canonical sender context for future Ajna actions instead of falling back to any protocol keeper wallet

Operationally this is separate from the existing XMTP/group-agent signer path.
Do not assume the XMTP server signer can manage Ajna for a creator vault.

After launch:

1. Open the success screen or `Admin Agent Setup`.
2. Enable Ajna automation for the vault from the creator's own canonical wallet context.
3. Verify the stored status shows the vault as opted in before expecting CRE Ajna actions to run.

Legacy vault note:

- if `AjnaVaultAuth.admin` is not the creator canonical CSW, run the one-time Safe backfill script:
  - `pnpm -C frontend exec tsx scripts/ops/ajna-admin-backfill-safe.ts --origin https://4626.fun --only-enabled`
  - re-run with `--propose --safe-address <SAFE> --safe-owner-pk <PK>` to submit Safe tx proposals

`SolanaStrategy` is a Base-side strategy adapter with keeper-reported remote NAV:

- `solanaMaxNavAge` bounds how old reported NAV can be before valuation is ignored.
- `solanaMaxNavDeltaBpsPerUpdate` limits per-update NAV jumps (circuit breaker).
- `solanaMinBaseLiquidityBps` enforces a Base liquidity floor during rebalances.
- Withdrawals remain synchronous on Base (strategy only withdraws available Base liquidity).

Vercel cutover order:

1. Merge frontend/api split-phase code + paymaster selector support.
2. Merge repo defaults pointing to the new mainnet infra addresses.
3. Set production env vars listed in "Required config (1-click)" plus canonical contract overrides:
   - `CREATOR_VAULT_BATCHER`, `CREATOR_VAULT_BATCHER_AUTO_HANDOFF`, `DEPLOYMENT_BATCHER`
   - `CREATOR_LOTTERY_MANAGER`, `LOTTERY_MANAGER`
   - `VITE_CREATOR_VAULT_BATCHER`, `VITE_CREATOR_VAULT_BATCHER_AUTO_HANDOFF`, `VITE_LOTTERY_MANAGER`
4. Keep override flags disabled (`VITE_ALLOW_CONTRACT_OVERRIDES`, `ALLOW_API_CONTRACT_OVERRIDES`).
5. Keep:
   - `VITE_DEPLOY_USE_SERVER_CONTINUE=true`
   - `VITE_CDP_PAYMASTER_URL=/api/paymaster`

Acceptance checks:
- `pnpm -C frontend run typecheck`
- `pnpm -C frontend exec vitest run api/__tests__/deploySession.test.ts api/__tests__/deploySessionOwnership.test.ts`
- paymaster accepts split selectors (no `batcher_selector_not_allowed`)
- deploy-session path advances:
  - `created -> phase1_sent -> phase1_finalize_sent -> phase2_core_sent -> phase2_sent -> phase3_sent -> phase4_sent -> completed`
  - no `phase4 image gate failed:*` error in session status
- `/deploy` shows no bytecode infra blocker and no `deployment batcher not configured`
- `/status?vault=0x...` shows Ajna as an adapter-backed inner vault and surfaces auth/min-bucket/buffer metadata
- `GET /api/v1/auction/status?ccaStrategy=0x...` returns:
  - `auctionTokenImagePath` using `/api/v1/token/<auctionToken>/image?chain=8453&format=png` (same-origin fallback)
  - `auctionTokenImageUrl` using canonical `/v1/token/<auctionToken>/image?chain=8453&format=png` on API origin
- `GET /api/v1/token/<shareOFT>/image?chain=8453&format=png` returns `200` with a non-empty image body
- Vault CCA panel renders the generated ShareOFT image (fallback logo is not shown under normal launch conditions)

### Important: Zora cross-app is read-only here

In this app, the Zora cross-app integration is **read-only**. We can use it to read linked accounts/assets, but we **cannot** use it to sign UserOps or send transactions for deployment.

If you see `Cannot transact against a read-only provider app`, it means a deploy path incorrectly tried to use cross-app signing/tx and should be disabled.

### If 1-click is not possible

If the connected EOA wallet is not an onchain owner of the canonical smart wallet, the setup transaction cannot be sent.

Fix: add the EOA as an owner first (one-time). After that, deploys can use the 1-click path.

## Via Smart Contract

```solidity
// Deploy using factory
(address vault, address wrapper, address shareOFT) = factory.deployVault(
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
forge script script/DeployBaseMainnetDeployer.s.sol:DeployBaseMainnetDeployer \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify

forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore \
  --rpc-url $BASE_RPC_URL \
  --broadcast
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
