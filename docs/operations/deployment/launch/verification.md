---
title: Verification
---

# AKITA Vault Launch Verification (Base)

## Phase 0: Pre-launch (Required)

### Strategy Configuration (Admin)

Before launching, ensure the vault has yield strategies configured (management-only):

- Deploy strategies via the phased deployment flow / `DeploymentBatcher`
- Set weights:
  - Charm (AKITA/USDC): **6900**
  - Ajna: **2139**
- Set idle reserve:
  - `minimumTotalIdle = 4,805,000 * 1e18` (9.61% of the 50M launch deposit)

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
vault.getStrategyCount()           -> 2
vault.strategyWeights(charmStrategy) -> 6900
vault.strategyWeights(ajnaStrategy)  -> 2139
vault.minimumTotalIdle()           -> 4_805_000e18
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

1. Sign a Permit2 `PermitTransferFrom` payload for the creator token
2. `DeploymentBatcher.finalizePhase2WithPermit2(...)`:
   - Pulls the creator-token deposit with Permit2 signature transfer
   - Deposits through the wrapper (minting wrapped share tokens)
   - Defers the 50% auction allocation on the batcher
   - Sends the remaining 50% to creator vesting
   - Transfers final ownership to the protocol / creator destinations

### Fallback path

If Permit2 signing is unavailable, the frontend falls back to:

1. `approve(creatorToken, DeploymentBatcher, depositAmount)`
2. `DeploymentBatcher.finalizePhase2(...)`

### Strategy Deployment Timing

Activation does not call `vault.deployToStrategies()`. Yield deployment happens when a keeper/owner/management calls `vault.deployToStrategies()` (or `vault.tend()`).

---

## Phase 2: Auction (Days 0-7)

- Users bid ETH for ■AKITA via the auction UI
- Auction runs until it is graduated

---

## Phase 3: Post-Auction Completion (Day 7+)

Completion is a 2-step process reflected in `CompleteAuction.tsx`:

1. **Sweep**: Call `CCALaunchStrategy.sweepCurrency()` (permissionless)
   - Sweeps raised ETH
   - Configures the oracle's V4 pool reference if configured

2. **Configure hook**: Call `TaxHook.setTaxConfig(...)` (token owner required)
   - Enables the 6.9% tax hook for ■AKITA/ETH trades

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
