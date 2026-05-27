# Vault strategy reallocation

Cross-strategy TVL moves between Charm and Ajna always route through the **parent vault idle CREATOR buffer**. Strategies never transfer directly to each other.

## Default withdrawal queue (redeems)

Greenfield Phase 3 deploy (`DeploymentBatcher.deployPhase3Strategies`) registers strategies in this order:

1. `addStrategy(charmStrategy, charmWeightBps)` → appends Charm to `defaultQueue`
2. `addStrategy(ajnaStrategy, ajnaWeightBps)` → appends Ajna to `defaultQueue`

So for a standard 45/45 bundle vault:

| Order | Strategy | Role on user redeem |
|------:|----------|---------------------|
| 1 | Charm (`CreatorCharmStrategy`) | Hit first when `useDefaultQueue=true` |
| 2 | Ajna (`ERC4626StrategyAdapter`) | Hit second if Charm liquidity is insufficient |

If `useDefaultQueue=false`, redeems walk `strategyList` instead — same add order by default unless management reorders the queue.

`autoAllocate` (optional, enabled on greenfield deploy) sends **new idle above `minimumTotalIdle`** only to `defaultQueue[0]` on deposit — not a full cross-strategy rebalance.

## Target allocation math

Let:

- `totalAssets = coinBalance + Σ strategy.getTotalAssets()`
- `minIdle = max(minimumTotalIdle, deploymentThreshold)`
- `deployableBase = totalAssets - minIdle` (when positive)
- `target[strategy] = deployableBase × weightBps / totalStrategyWeight`

Drift:

- `drift = actualAssets - target`
- **Overweight** when `drift > target × minDeviationBps / 10_000`
- **Underweight** when `actualAssets < target` (funded after overweight pulls via `deployToStrategies()`)

`strategyDebt` tracks vault accounting for withdrawals/unrealized loss — allocation targets use **live strategy NAV** (`getTotalAssets()`), with `strategyDebt` as fallback when valuation reverts.

## On-chain keeper entrypoint

`CreatorOVault.rebalanceStrategies(minDeviationBps)` (keeper-only):

1. Compute targets from weights + `totalAssets`
2. Withdraw excess from overweight strategies back to idle (queue order: `defaultQueue` when enabled, else `strategyList`)
3. Call internal `_deployToStrategies()` when idle exceeds `minIdle`

Default off-chain trigger band: **500 bps (5%)** via `VAULT_STRATEGY_REALLOC_MIN_DEVIATION_BPS`.

## Automation surfaces

| Surface | Path |
|---------|------|
| Pure planner (TS) | `kpr/utils/strategyAllocation.ts` |
| KPR action | `kpr/actions/vault-strategy-reallocator.action.ts` |
| KPR workflow | `kpr/workflows/vault-strategy-reallocator.workflow.ts` (every 15 min) |
| Unified keeper | `kpr/workflows/4626.workflow.ts` step 8 |
| HTTP bridge | `POST /api/keeper/rebalance-strategies` |

## Charm ↔ Ajna full synergy (greenfield deploy)

When **both** `charm_active_lp` and `ajna_sleeve` are paid and Phase 3 registers both strategies, `DeploymentBatcherPhase3Helper` now wires the direct borrow backstop automatically:

1. Resolve or deploy the shared Ajna ERC20 pool (`collateral=USDC`, `quote=CREATOR`) — same pool the Ajna sleeve uses.
2. Deploy Charm, then Ajna sleeve infrastructure.
3. On Charm (while Phase3Helper still owns it): `setCreatorOracle` (from `CreatorRegistry.getCreatorCoin(...).oracle`, set in Phase 2), `setAjnaPool`, `setAjnaBorrowConfig(true, max, max, 12500 bps, 0, 0)`.
4. Transfer Charm ownership to protocol treasury.

This is **in addition to** vault-level `rebalanceStrategies` and the default withdrawal queue (`Charm → Ajna`). Legacy vaults (e.g. AKITA pre-backstop Charm bytecode) need a new Charm deploy + migration to gain the borrow lane.

## Related but distinct

- **Charm `rebalance()`** — recenters V3 LP range; does not change vault weight targets
- **Ajna bucket manager** — moves buffer ↔ quote buckets inside the Ajna sleeve
- **Charm Ajna borrow backstop** — `CreatorCharmStrategy` optional borrow/repay against Ajna pool on withdraw/deposit shortfalls; not the same as sleeve TVL allocation

## Verification

```bash
# Foundry — queue order + cross-strategy rebalance
forge test --match-contract CreatorOVaultStrategiesRebalanceTest -vv

# KPR planner unit tests
pnpm -C kpr test vault-strategy-reallocator
```
