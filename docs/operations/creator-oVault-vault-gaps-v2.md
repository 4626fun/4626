# CreatorOVault governance & liquidity v2

Closes the priority-matrix gaps for **new vault deployments** using `CreatorOVaultModuleStorage.v2` modules. Existing mainnet vaults keep their wired `v1` modules until redeployed.

## P0 — Honest instant liquidity (`liquiditySnapshot`)

- `CreatorOVault.liquiditySnapshot()` → `CreatorOVaultLiquidityLib.snapshot(vault)`
- Returns idle balance, `minIdleReserve`, **`instantIdleAssets`** (idle minus reserve), **`instantIdleBps`**, queued withdrawal shares, locked profit shares, per-strategy NAV/debt/valuation readiness, and `maxSyncWithdrawAssets`.

Integrators should treat **`instantIdleBps`** as “redeemable without strategy pull,” not `totalAssets()`.

## P1 — Risk timelock (Morpho-style latency)

- `riskConfigDelay` (0 = instant, legacy default)
- `scheduleSetPerformanceFee`, `scheduleSetManagementFee`, `scheduleSetStrategyMaxAssets`
- `executePendingRiskConfig` / `cancelPendingRiskConfig` (single-flight pending change)
- `setRiskConfigDelay` (owner, 1–30 days)

`setPerformanceFee` / `setStrategyMaxAssets` route through the same scheduler (instant when delay is 0).

## P1 — Management (TVL) fee

- `managementFee` (max 500 bps annualized charge rate)
- `managementFeeRecipient`
- Accrued on each `report()` as share mint (same dilution model as performance fee)

## P2 — ERC-2612 `permit` on vault shares

- `permit(owner, spender, value, deadline, v, r, s)` shares EIP-712 domain with operator permits (`CreatorOVault` / `1`).

## P2 — Valuation auto-disable

- `valuationMissThreshold` (0 = off)
- `strategyValuationMisses`
- On `report()`, consecutive unhealthy valuations **deactivate** the strategy (weight zeroed, no new deploys) and emit `StrategyValuationAutoDisabled`.

Management must `removeStrategy` / `migrateStrategy` to unwind remaining strategy TVL.

## P3 — `migrateStrategy`

- `migrateStrategy(oldStrategy, newStrategy, weight, addToQueue)` — atomic remove + add (management).

## Not in v2 (deferred)

- **ERC-7540** async deposit/redeem (full request/claim lifecycle)
- **Per-user custom withdraw queue** (Yearn redeemer-supplied queue)
- **Fee splitter** / multi-recipient fee routing

## Deploy checklist

1. Deploy fresh `CreatorOVaultCoreModule`, `CreatorOVaultStrategiesModule`, `CreatorOVaultAdminModule` (must return `CreatorOVaultModuleStorage.v2`).
2. `setModulesOnce` on the vault.
3. Set `riskConfigDelay` before production risk changes.
4. Wire keeper `report()` cadence if `managementFee > 0`.
