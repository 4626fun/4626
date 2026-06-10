# Strategy Cap & Whitelisting Runbook

This runbook is the operational counterpart to [`strategy-onboarding-checklist.md`](./strategy-onboarding-checklist.md). It describes what governance does, in what order, and what NEVER to do when whitelisting or capping a `CreatorOVault` strategy.

`strategyMaxAssets` is a governance trust ceiling: the maximum valuation the vault is willing to trust from a strategy until governance/operator review updates the cap. It is not an allocation target and not a promise that the strategy should always hold that amount.

## Hard rules

1. **Never whitelist a strategy that has not been classified** as `internal-accounting`, `oracle-backed`, or `capped`. Classification is the precondition; everything else flows from it.
2. **Never whitelist a `capped` strategy with `strategyMaxAssets == 0`.** A zero cap is uncapped — the wrong default for any strategy in this class. Set the cap **before** `addStrategy` and before any `forceDeployToStrategies()` call.
3. **Never assume an oracle is safe because it worked once.** Oracle-backed strategies still get a conservative cap on first activation. Drop the cap (set to 0) only after the oracle path has been observed under live conditions for at least 30 days AND a reviewer signs off.
4. **Never broadcast cap or activation transactions until simulation is clean and the operator/governance approval is explicit.**

## Canonical procedure (new strategy)

```
# 1. Implement + audit the strategy contract; merge code in a PR.
# 2. Classify and document in docs/governance/strategy-classification.md.
# 3. Locate or provision the concrete per-creator strategy address.
# 4. Compute:
#      - intended debt ceiling
#      - current estimated strategy NAV
#      - safety buffer and rationale
# 5. Governance multisig actions (in order):
#    a. setStrategyMaxAssets(strategy, cap)   <-- FIRST, even if cap == debt-budget today.
#    b. addStrategy(strategy, weight, addToQueue=true)
#    c. Optionally injectCapital / forceDeployToStrategies once UI mirror is updated.
# 6. Operator updates workspace_strategy_targets row:
#       max_assets_cap = <on-chain cap>
#       status = 'active'
#       updated_source = 'governance-runbook'
#       notes = valuation class + cap rationale
# 7. Schedule cap re-review (calendar event or follow-up issue, default +30 days).
```

Doing the cap call FIRST is intentional. Auto-allocation can fire from any subsequent deposit; a strategy that is whitelisted before the cap is set is whitelisted *uncapped* for whatever interval lies between the two transactions, and that interval is governance-observable.

## Choosing the cap

For capped or first-observed externally-valued strategies, choose the cap as a trust ceiling:

```
cap = max(intended debt ceiling, current strategy NAV) + safety buffer
```

The safety buffer is strategy-specific and must be justified in the proposal. It should account for expected NAV drift, yield, normal rebalances, oracle confidence, keeper reconciliation confidence, and the maximum pricing error governance is willing to tolerate before another review.

First launch example only: with **`vault_full_deploy`**, each Phase 3 strategy (Charm, Ajna) initially receives **45%** of productive allocation (4_500 bps of 10_000). On a 50,000,000 creator-token principal that is about 22,500,000 creator-token-equivalent units per strategy before idle reserve. A first cap might be 25,000,000 to 30,000,000 per strategy depending on risk and reconciliation confidence. That number is a starting trust ceiling, not a static allocation target.

## Cap re-review triggers

A re-review of `strategyMaxAssets` is required when ANY of the following occur:

- Actual strategy NAV exceeds 80% of cap.
- Material TVL change (default threshold: ±25% from the value used when the cap was set).
- Target weight changes.
- The strategy ships a behavioural change (new pool, new oracle, new bridge route, new deposit/withdraw path).
- Large swap or LP rebalance materially shifts strategy inventory.
- Keeper reconciliation changes or fails.
- Governance changes the strategy risk classification.
- The vault adds a peer strategy whose failure mode could correlate (e.g. shared oracle).
- An incident (suspected oracle manipulation, donation attempt, withdraw failure) involving this strategy or a similar one.

The re-review either confirms the existing cap, raises it, lowers it, or removes it (oracle-backed strategies graduating out of the cap regime). The decision and rationale are appended to the strategy's row in `docs/governance/strategy-classification.md`.

## Cap-rationale documentation requirements

When setting or changing a cap, the PR / governance proposal MUST include:

- The cap value (in underlying token or creator-token-equivalent units, with units explicit).
- The vault TVL at the time the cap was chosen.
- The intended debt ceiling and current estimated strategy NAV used in the formula.
- The safety buffer and why it is large enough for normal drift but small enough to bound trust.
- The failure scenario the cap is meant to bound. ("If the strategy reports 10x its true assets, share price moves by at most X%.")
- The data point or model used to compute the bound.
- Who reviewed it.

## What the cap does NOT do

The cap clamps the strategy's contribution to `totalAssets()`. It does **not**:

- Prevent a deposit FROM going into the strategy. (Deposit routing is governed by `strategyDebt` budgets and `defaultQueue`, not the cap.)
- Prevent a strategy from holding more than `cap` worth of assets. The cap only limits how much the vault recognises in pricing.
- Replace strategy-level review. A bad strategy with a small cap is still a bad strategy.

If you need to limit how much capital can be ALLOCATED, use weight + debt budget. The cap is a **pricing** safety bound.

## Current deployment and data mirror

The current CreatorOVault deployment path includes:

- The on-chain `setStrategyMaxAssets` setter and the clamp in `_getStrategyAssetsSafe()` (in `CreatorOVault.sol`, `CreatorOVaultCoreModule.sol`, and `CreatorOVaultStrategiesModule.sol`).
- Current CreatorOVault module storage fingerprint `CreatorOVaultModuleStorage.current`, which all vault/modules must share for `setModulesOnce` identity checks.
- The `max_assets_cap` mirror column on `workspace_strategy_targets`.

Previously deployed vaults that do not expose `setStrategyMaxAssets` are outside this release path.
