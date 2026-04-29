# Deployment note — `strategyMaxAssets` cap PR

**Status: HOLD FOR REVIEW. Do not deploy from this branch.**

## What changes on-chain

This PR bumps `MODULE_STORAGE_VERSION` from `CreatorOVaultModuleStorage.v1` to `CreatorOVaultModuleStorage.v2` and appends the `strategyMaxAssets` mapping at the end of the storage layout (after `_adminModule`). Existing storage slots are untouched, but the version bump means:

- Any existing deployed `CreatorOVault` instance running v1 modules will FAIL `setModulesOnce` if you try to plug in v2 modules — that's the safety check (`_validateModuleIdentity` reverts on mismatch). Re-deploying the modules and pointing the vault at them must therefore be a coordinated operation, not a hot-swap on a live vault.
- Newly deployed vaults pick up v2 directly with no migration step.

## What this PR does NOT change

- No changes to the Solana programs.
- No changes to the indexer's contract ABI consumers other than the new event `UpdateStrategyMaxAssets(address,uint256,uint256)`.
- No Vercel-deployed surface is modified.
- No production Supabase migration is applied. The migration file `supabase/migrations/20260429000000_add_max_assets_cap.sql` is committed for the next scheduled migration window.

## Pre-deployment checklist

1. PR reviewed and signed off (see `docs/governance/strategy-cap-runbook.md`).
2. CI is green; specifically `test/vault/strategies/CreatorOVaultStrategies.MaxAssetsCap.t.sol` passes.
3. The 5 pre-existing `main` test failures are confirmed unchanged (i.e. this PR does not cause new failures).
4. Operator UI mirror has been merged & deployed to staging; the `max_assets_cap` column appears next to the on-chain value.
5. Governance has agreed initial caps for any pending strategies (`ajna_sleeve`, `charm_active_lp`, `solana_bridge_strategy`).

## Order of operations on the deploy day

1. Merge this PR.
2. Run the Supabase migration in the next scheduled window (`workspace_strategy_targets.max_assets_cap`).
3. Redeploy the three modules (`CreatorOVaultCoreModule`, `CreatorOVaultStrategiesModule`, `CreatorOVaultAdminModule`) — they all advertise `CreatorOVaultModuleStorage.v2`.
4. For new vaults: deploy with the new modules from the start (`setModulesOnce` against v2 modules).
5. For each newly-classified strategy, execute the runbook ordering:
   1. `setStrategyMaxAssets(strategy, cap)` if `capped`.
   2. `addStrategy(strategy, weight, true)`.
   3. Mirror in Supabase + UI.
6. Do NOT push to Vercel as part of this rollout. The frontend changes shipped in this PR (operator UI mirror) ride the next regular Vercel deploy — they are read-only display of an existing column and are safe to release alongside other changes.
