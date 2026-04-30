# Deployment note — `strategyMaxAssets` caps

This note covers the current CreatorOVault deployment path for strategy valuation caps.

## What changes on-chain

The current CreatorOVault module storage fingerprint is `CreatorOVaultModuleStorage.current`. The vault and all three modules must advertise the same fingerprint so `setModulesOnce` can reject mismatched module storage at deploy time.

The current CreatorOVault storage layout includes `strategyMaxAssets` at the end of the module storage struct. The cap is a governance trust ceiling:

> The maximum valuation the vault is willing to trust from this strategy until governance/operator review updates the cap.

`strategyMaxAssets` is not an allocation target and not a promise that the strategy should always hold that amount. Allocation remains governed by strategy weights, debt budgets, queue behavior, and keeper actions.

Previously deployed vaults that do not expose `setStrategyMaxAssets` are outside this release path.

## What this rollout does not change

- No changes to the Solana programs.
- No Vercel deployment is required for this note.
- No Supabase schema migration should be re-applied; production already has `public.workspace_strategy_targets.max_assets_cap NUMERIC(78,0) NULL`.
- No on-chain transaction should be broadcast until simulation is clean and governance/operator approval is explicit.
- Pending strategy feature rows are entitlements only until provisioning produces concrete per-creator strategy addresses.

## Pre-deployment checklist

1. Current CreatorOVault bytecode and modules compile with the same `CreatorOVaultModuleStorage.current` fingerprint.
2. `test/vault/strategies/CreatorOVaultStrategies.MaxAssetsCap.t.sol` passes.
3. Deployment simulation is clean without `--broadcast`.
4. Governance has classified every strategy before activation: `internal-accounting`, `oracle-backed`, or `capped`.
5. Governance has chosen initial trust ceilings for any capped strategy using the runbook formula:
   `cap = max(intended debt ceiling, current strategy NAV) + safety buffer`.
6. For pending strategy features, concrete per-creator strategy addresses are known before any cap or activation calldata is prepared.

## Order of operations

1. Simulate the current CreatorOVault infra deployment without `--broadcast`.
2. After approval, deploy current CreatorOVault infra using the documented Base mainnet deployment path.
3. For each newly-classified strategy, execute governance actions in this order:
   1. `setStrategyMaxAssets(strategy, cap)` if the strategy requires a cap.
   2. `addStrategy(strategy, weight, true)`.
   3. Mirror the cap, classification, and rationale in Supabase.
4. Do not activate uncapped externally-valued strategies. A `strategyMaxAssets` value of `0` means uncapped and is not valid for a strategy classified as `capped`.
