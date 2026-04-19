---
title: Verification
---

# AKITA Vault Launch Verification (Base)

## Canonical Path

Use the frontend `/deploy` deploy-session flow for production launches.

For the launch order and required preconditions, start with [Ship Checklist](/operations/deployment/launch/ship-checklist).

- It is the canonical path for the phased `DeploymentBatcher` flow.
- It is the only path that is expected to complete with Charm, Ajna, and `SolanaStrategy` together.
- It runs the Solana route / OVault preflight before phase 3.

`/admin/deploy-strategies` is now a legacy two-strategy helper backed by `StrategyDeploymentBatcher`. It deploys only Charm + Ajna and leaves the remainder idle on Base, so it is not equivalent to the canonical launch flow.

## Phase 0: Pre-launch (Required)

### Strategy Configuration (Canonical `/deploy`)

Before launching, verify the deploy session completed through phase 3:

- Charm strategy: **3000 bps**
- Ajna strategy: **3000 bps**
- `SolanaStrategy`: **3000 bps**
- Idle reserve: **1000 bps** (10% of the launch deposit via `setMinimumTotalIdle`)
- Solana preflight succeeded before phase 3 started

### Image Gate + CCA Render Readiness

Before accepting a launch as production-ready, verify image generation is part of the deploy-session gate:

1. `POST /api/deploy/session/status` for the active session id and confirm:
   - session advances through `phase3_sent -> phase4_sent -> completed`
   - `lastError` does **not** contain `phase4 image gate failed`
2. Read auction status:
   - `GET /api/v1/auction/status?ccaStrategy=<address>`
   - response includes:
     - `auctionTokenImagePath` (`/api/v1/token/<auctionToken>/image?chain=8453&format=png`) for same-origin fallback
     - `auctionTokenImageUrl` (`https://<api-host>/v1/token/<auctionToken>/image?chain=8453&format=png`) as canonical URL
3. Verify canonical image endpoint for ShareOFT:
   - `GET /api/v1/token/<shareOFT>/image?chain=8453&format=png`
   - returns `200` and non-empty image bytes
4. Open the vault CCA panel and confirm the generated ShareOFT image is rendered in the price-discovery header (no fallback logo under healthy conditions).

### Canonical Ajna Verification (Current Deploy Path)

The Ajna sleeve is the nested adapter-backed bundle:

- `ERC4626StrategyAdapter`
- `AjnaERC4626Vault`
- `AjnaVaultAuth`

Verify the nested shape instead:

1. `CreatorOVault` strategy list contains an `ERC4626StrategyAdapter`
2. `ERC4626StrategyAdapter.ERC4626_VAULT()` returns the inner `AjnaERC4626Vault`
3. `AjnaERC4626Vault.AUTH()` returns `AjnaVaultAuth`
4. `AjnaVaultAuth` exposes the expected:
   - `admin`
   - `bufferRatio`
   - `minBucketIndex`
   - `paused`

Recommended operator check:

- Open `/status?vault=<vault>` and confirm the Ajna section reports:
  - adapter-backed inner vault
  - inner vault address
  - auth address/admin
  - buffer ratio
  - current or suggested bucket floor

If `/status` does not show the adapter-backed inner vault shape, treat that deployment as misconfigured.

### Ajna Auth Admin Alignment Branch

Use deploy-session status to distinguish new auto-handoff launches from legacy vaults:

1. Call `/api/deploy/session/status` for the launch session id.
2. Inspect `data.phase3AjnaAdminAlignment`:
   - `ajnaAuthAdminMatchesOwner === true` means the new auto-handoff path is aligned.
   - `ajnaAuthAdminMatchesOwner === false` means `AjnaVaultAuth.admin` is still mismatched.
3. For mismatched legacy vaults, run:
   - `pnpm -C frontend exec tsx scripts/ops/ajna-admin-backfill-safe.ts --origin https://4626.fun --only-enabled`
   - then `--propose --safe-address <SAFE> --safe-owner-pk <PK>` to submit Safe proposals.
4. Re-check `/status?vault=<vault>` and confirm `ajnaAuthAdmin` now equals the creator canonical CSW.

### Canonical Ajna Automation Verification (Opt-In)

If the creator enabled Ajna automation, verify the sender model as well:

1. The vault's Ajna automation status is enabled from the creator-owned UI flow (`DeploymentSuccess` or `Admin Agent Setup`).
2. The allowed scope is exactly `ajna_min_bucket_only`.
3. `AjnaVaultAuth.admin()` equals the creator's canonical Coinbase Smart Wallet, not a protocol keeper wallet.
4. Protected CRE vault reads expose the canonical sender context for that vault, while public reads expose only safe status fields.
5. Disabling or revoking automation causes future Ajna actions to hard-stop with canonical-sender errors rather than falling back to a shared keeper wallet.

This is intentionally different from the XMTP server-signer flow. XMTP signer
availability does not authorize Ajna execution for a vault.

### On-chain Checks

```
vault.getStrategyCount()                -> 3
vault.strategyWeights(charmStrategy)    -> 3000
vault.strategyWeights(ajnaStrategy)     -> 3000
vault.strategyWeights(solanaStrategy)   -> 3000
vault.minimumTotalIdle()                -> launchDeposit * 10%
```

For the canonical nested Ajna path, also read:

```solidity
adapter.ERC4626_VAULT()            -> innerAjnaVault
innerAjnaVault.AUTH()              -> ajnaVaultAuth
innerAjnaVault.AJNA_POOL()         -> ajnaPool
ajnaVaultAuth.bufferRatio()        -> expected bps
ajnaVaultAuth.minBucketIndex()     -> expected bucket floor
ajnaVaultAuth.paused()             -> false
```

---

## Phase 1: Launch (Day 0)

### What Happens

Users launch via the frontend AA flow, which now prefers Permit2 for the deposit pull whenever the wallet supports typed-data signatures.

### Preferred deploy path

1. `/deploy` creates the deploy session and persists phase 1, phase 2, phase 3, and phase 4 call bundles.
2. The user installs the temporary session owner on the canonical smart wallet.
3. Phase 2 finalize uses Permit2 when available, otherwise approval + `finalizePhase2(...)`.
4. After phase 2 confirms, the server performs Solana preflight and registration.
5. Phase 3 deploys the subset of `{Charm, Ajna, SolanaStrategy}` the creator has paid for via `creator_strategy_features` (strategies with `weightBps == 0` are skipped entirely — no deploy, no `addStrategy`), sets the idle reserve, and calls `vault.deployToStrategies()`. At least one strategy is required (`DeploymentBatcher.deployPhase3Strategies` reverts when the weight sum is zero). Until the updated batcher bytecode is seeded on mainnet, the live contract still requires all three weights to be non-zero — deploy-session clients keep sending the legacy 3-of-3 triple.
6. Before phase 4 send, deploy-session runs the ShareOFT image gate (generate/compose/associate).
7. Phase 4 launches the deferred auction only after image gate readiness succeeds.

### Fallback path

If Permit2 signing is unavailable, the frontend falls back to:

1. `approve(creatorToken, DeploymentBatcher, depositAmount)`
2. `DeploymentBatcher.finalizePhase2(...)`

### Strategy Deployment Timing

The canonical deploy-session path now includes `vault.deployToStrategies()` during phase 3. A separate post-launch `deployToStrategies()` call is only relevant for legacy/manual operator flows.

### Legacy admin helper

If you intentionally use `/admin/deploy-strategies`, treat it as a manual Charm + Ajna utility only:

- It does **not** deploy `SolanaStrategy`.
- It does **not** run Solana route / OVault preflight.
- It should not be used as evidence that the production launch flow is fully configured.

---

## Phase 2: Auction (Days 0-7)

- Users bid ETH for ■AKITA via the auction UI
- Auction runs until it is graduated

---

## Phase 3: Post-Auction Completion (Day 7+)

Completion is a canonical 3-step process reflected in `CompleteAuction.tsx` and keeper workflows:

1. **Sweep**: Call `CCALaunchStrategy.sweepCurrency()` (permissionless)
   - Sweeps raised ETH
   - Enables migration prerequisites

2. **Migrate**: Call `CCALaunchStrategy.migrate()` (permissionless once migration block is ready)
   - Initializes v4 pool and migrates LP position
   - Configures oracle V4 pool reference when configured

3. **Configure hook**: Call `TaxHook.setTaxConfig(...)` (token owner required unless keeper hook mode is explicitly enabled)
   - Activates the hook fee plane for the intended pair/pool
   - Must align hook recipient with intended `tradeFeeCollector`
   - Verify onchain: pool id/key, enabled flag, fee bps, and recipient address

### Optional (Operations)

- Call `vault.deployToStrategies()` after launch to deploy idle AKITA into strategies.

---

## Alternative: Liquidity Launcher Migration

If using `LBPStrategyWithTaxHook` (`contracts/vault/strategies/launchpad/LBPStrategyWithTaxHook.sol`) instead of `CCALaunchStrategy`:

- Auction creation still uses Uniswap CCA, but the strategy is the `fundsRecipient` (via `ActionConstants.MSG_SENDER`), so raised currency must be swept to the strategy address.
- Pool creation + LP minting happens when calling `LBPStrategyWithTaxHook.migrate()` after `migrationBlock`.
- The pool is initialized with the existing Base tax hook address (PoolKey.hooks), so ensure you configure taxes using a poolId computed from the real v4 `PoolKey`.

### Operational Steps

1. After auction end, call `auction.sweepCurrency()` (permissionless) to move funds to the LBP strategy.
2. After `migrationBlock`, call `LBPStrategyWithTaxHook.migrate()` to initialize the v4 pool at the final clearing price and mint the position.
3. Configure taxes via `TaxHookConfigurator.configureCreatorPool(...)` using the correct `(poolLPFee, tickSpacing)` so the pool id matches.
