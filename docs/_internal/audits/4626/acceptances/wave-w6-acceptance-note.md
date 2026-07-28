# Wave W6 Acceptance Note

## Accepted Risk
`OVaultStrategiesModule` strategy-cap dilution remains accepted risk for Wave W6.

The current `strategyMaxAssets` clamp protects valuation reads, but there is no small existing hook that safely fail-closes new deposits the moment a live strategy reports above cap without risking false positives or blocking normal vault inflows during transient accounting skew. A partial patch here would change deposit availability semantics across the vault core and strategy deployment paths without enough focused contract coverage.

## Required Follow-Up
Implement a dedicated over-cap guard as a standalone contract change set:

1. Add an explicit `anyStrategyOverConfiguredCap()` style view/helper in the vault core or shared module layer.
2. Decide the fail-closed surface deliberately: `maxDeposit`, `deposit`, auto-deploy, keeper deploy, or a combination.
3. Add focused Foundry coverage for transient overshoot, stale valuation reads, capped growth, and recovery after governance raises the cap.
4. Revisit whether keepers should also auto-pause deployment/rebalance while a strategy is over cap.
