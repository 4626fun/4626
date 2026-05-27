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

- `valuationMissThreshold` (0 = off, max **30** consecutive misses)
- `strategyValuationMisses` (saturates at `uint8` max; does not wrap)
- On `report()`, consecutive unhealthy valuations trigger **`__ejectDisabledStrategy`**: best-effort withdraw, debt zeroed, strategy removed from list + default queue, emit `StrategyValuationAutoDisabled`.

Use `forceRemoveStrategy` for active strategies with irrecoverable shortfall; inactive ejected strategies are already off the list.

## Audit hardening (v2.1)

- **Valuation health loop** iterates `strategyList` **backward** so swap-pop ejection cannot skip strategies or OOB-revert when multiple strategies eject in one `report()`.
- **First deposit** skips `maxTotalSupply` cap check (avoids virtual-shares / layout footguns on bootstrap).
- **Management fee recipient** routes through the same risk timelock as fees (`scheduleSetManagementFeeRecipient` / `setManagementFeeRecipient`).
- **Risk schedule** `pendingRiskUnlockTime` rejects `block.timestamp + delay` overflow past `uint64`.
- **Share `permit`** uses `SignatureChecker` (EOA + ERC-1271 smart wallets).
- **`migrateStrategy`** ejects inactive-but-listed strategies before adding the replacement.

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
