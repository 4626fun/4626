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
| KPR action (multi-pass) | `kpr/actions/vault-strategy-reallocator.action.ts` |
| KPR workflow | `kpr/workflows/vault-strategy-reallocator.workflow.ts` (every 15 min) |
| Unified keeper | `kpr/workflows/4626.workflow.ts` step 8 (every 5 min, up to 4 passes/vault) |
| Keeper jobs enqueue | `GET|POST /api/keeper/jobs/enqueue-active-vaults` with `KEEPER_ACTIVE_VAULT_WORKFLOWS=...,rebalance,...` |
| HTTP bridge | `POST /api/keeper/rebalance-strategies` |

Env tuning:

- `VAULT_STRATEGY_REALLOC_MIN_DEVIATION_BPS` — default **500** (5% overweight band)
- `VAULT_STRATEGY_REALLOC_MAX_PASSES` — default **4** on-chain calls per vault per tick

Production enablement (keeper_jobs worker lane):

```env
KEEPER_ACTIVE_VAULT_ENQUEUE_ENABLED=1
KEEPER_ACTIVE_VAULT_WORKFLOWS=sweep,tend,report,rebalance,payout
VAULT_STRATEGY_REALLOC_MIN_DEVIATION_BPS=500
VAULT_STRATEGY_REALLOC_MAX_PASSES=4
```

Enqueue order runs `tend` before `rebalance` so fresh idle/strategy NAV is available before cross-strategy moves.

## Operations runbook

| Signal | Meaning | Action |
|--------|---------|--------|
| `skippedReason=within_deviation_band` | Drift inside band | No action |
| `skippedReason=single_strategy_vault` | Only one productive strategy | Expected for single-strategy vaults |
| `convergenceIncomplete=true` / batch `maxPassesHit` | Still drifting after max passes | Inspect large skew, keeper auth, or raise `VAULT_STRATEGY_REALLOC_MAX_PASSES` temporarily |
| `error=keeper_not_authorized` | Keeper lacks vault write auth | Fix `setKeeper` / ERC-4337 keeper lane for that vault |
| HTTP bridge 500 | On-chain revert | Check Basescan trace for `rebalanceStrategies` |

Batch metrics from `executeVaultStrategyReallocator()`:

- `rebalanced` — vaults that executed at least one pass
- `maxPassesHit` — vaults that still exceed the band after exhausting passes (needs operator review)

## Regression gates

CI and local guards prevent wiring drift:

```bash
# Wiring guard — route map, keeper_jobs workflow, runner, unified workflow step 8
node scripts/check-vault-strategy-reallocator-wiring.mjs

# KPR planner + pass-loop unit tests
pnpm -C kpr test vault-strategy-reallocator
pnpm -C kpr test vault-strategy-reallocator-pass-loop
pnpm -C kpr test strategyAllocation.fuzz

# Foundry — on-chain rebalance + sim harness
forge test --match-path "test/vault/strategies/CreatorOVaultStrategies.Rebalance*"
```

`pnpm security:local` includes the guard + KPR tests above. CI job `strategy-reallocator-guards` in `.github/workflows/test.yml` runs the same subset on every PR.

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
