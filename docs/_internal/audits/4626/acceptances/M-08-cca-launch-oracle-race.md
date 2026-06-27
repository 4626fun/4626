# M-08 — CCALaunchStrategy Oracle Configuration During Pool Init Race

- **Linear:** [4626-317](https://linear.app/4626fun/issue/4626-317)
- **Severity:** Medium
- **Confidence (auditor):** Plausible
- **File:** `contracts/vault/strategies/CCALaunchStrategy.sol::migrate` → `_configureOracleV4Pool`
- **Finding:** `poolManager.initialize(key, sqrtPriceX96)` goes live before `_configureOracleV4Pool()` is called. Between those two calls the pool accepts swaps but the oracle is not yet pointed at it; any swap in the window reads a stale or unconfigured oracle price.

## Disposition: Code change deferred, operational mitigation documented below

The mechanical fix is to call `_configureOracleV4Pool()` immediately after `poolManager.initialize()` and before the first `modifyLiquidities` that mints positions. The change is simple in isolation but needs to be validated against:

- whether the oracle contract permits being configured for a pool that has zero liquidity (some V4 oracle hooks require observation cardinality > 0 post-initial-liquidity),
- whether downstream systems (lottery pricing, LBP migration) can tolerate reading the oracle during the mint phase,
- whether any keeper job polls the pool between `initialize` and `migrate` completion.

Because `CCALaunchStrategy.migrate()` is called by the deployment orchestrator in a single atomic transaction wrapping `initialize` → `mint` → `_configureOracleV4Pool`, the real-world exposure window is only the intra-transaction interval. External contracts cannot observe the pool mid-transaction. The only way to exploit this is if another transaction in the same block front-runs the rest of `migrate` after `initialize` succeeds — possible only if `migrate` is externally re-entered, which it is not (it is called once by the orchestrator).

## Operational mitigation (in force today)

Until the code change lands, the deployment runbook forbids any action against a freshly-migrated pool until `migrate()` returns. The orchestrator runs `initialize` and oracle configuration in the same transaction; if the transaction reverts the pool is not initialized. There is no code path where a partially-migrated pool is left live.

## Code change to apply next sprint

Reorder `_configureOracleV4Pool()` to run immediately after `poolManager.initialize()` and before `modifyLiquidities`. Confirm oracle contract accepts configuration at zero-liquidity state; if not, introduce a two-phase configure (register pool ID pre-mint, seed observation post-mint).

## Tracking

File a follow-up engineering ticket tagged `audit/4626/M-08`. Not shipped in the Sprint 5 PR to keep sprint scope focused on changes that can be reasoned about without running the full deployment path.
