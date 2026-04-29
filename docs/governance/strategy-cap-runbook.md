# Strategy Cap & Whitelisting Runbook

This runbook is the operational counterpart to [`strategy-onboarding-checklist.md`](./strategy-onboarding-checklist.md). It describes what governance does, in what order, and what NEVER to do when whitelisting or capping a `CreatorOVault` strategy.

## Hard rules

1. **Never whitelist a strategy that has not been classified** as `internal-accounting`, `oracle-backed`, or `capped`. Classification is the precondition; everything else flows from it.
2. **Never whitelist a `capped` strategy with `strategyMaxAssets == 0`.** A zero cap is uncapped — the wrong default for any strategy in this class. Set the cap **before** `addStrategy` and before any `forceDeployToStrategies()` call.
3. **Never assume an oracle is safe because it worked once.** Oracle-backed strategies still get a conservative cap on first activation. Drop the cap (set to 0) only after the oracle path has been observed under live conditions for at least 30 days AND a reviewer signs off.
4. **Never deploy contract changes as a result of this PR to Vercel or push to production environments without an explicit, separate operator action.** This PR is a hold-for-review.

## Canonical procedure (new strategy)

```
# 1. Implement + audit the strategy contract; merge code in a PR.
# 2. Classify and document in docs/governance/strategy-classification.md.
# 3. Deploy strategy contract (out of scope here).
# 4. Governance multisig actions (in order):
#    a. setStrategyMaxAssets(strategy, cap)   <-- FIRST, even if cap == debt-budget today.
#    b. addStrategy(strategy, weight, addToQueue=true)
#    c. Optionally injectCapital / forceDeployToStrategies once UI mirror is updated.
# 5. Operator updates workspace_strategy_targets row:
#       max_assets_cap = <on-chain cap>
#       status = 'active'
#       updated_source = 'governance-runbook'
# 6. Schedule cap re-review (calendar event or follow-up issue, default +30 days).
```

Doing the cap call FIRST is intentional. Auto-allocation can fire from any subsequent deposit; a strategy that is whitelisted before the cap is set is whitelisted *uncapped* for whatever interval lies between the two transactions, and that interval is governance-observable.

## Cap re-review triggers

A re-review of `strategyMaxAssets` is required when ANY of the following occur:

- Material TVL change (default threshold: ±25% from the value used when the cap was set).
- The strategy ships a behavioural change (new pool, new oracle, new bridge route, new deposit/withdraw path).
- The vault adds a peer strategy whose failure mode could correlate (e.g. shared oracle).
- An incident (suspected oracle manipulation, donation attempt, withdraw failure) involving this strategy or a similar one.

The re-review either confirms the existing cap, raises it, lowers it, or removes it (oracle-backed strategies graduating out of the cap regime). The decision and rationale are appended to the strategy's row in `docs/governance/strategy-classification.md`.

## Cap-rationale documentation requirements

When setting or changing a cap, the PR / governance proposal MUST include:

- The cap value (in the underlying token's units).
- The vault TVL at the time the cap was chosen.
- The failure scenario the cap is meant to bound. ("If the strategy reports 10x its true assets, share price moves by at most X%.")
- The data point or model used to compute the bound.
- Who reviewed it.

## What the cap does NOT do

The cap clamps the strategy's contribution to `totalAssets()`. It does **not**:

- Prevent a deposit FROM going into the strategy. (Deposit routing is governed by `strategyDebt` budgets and `defaultQueue`, not the cap.)
- Prevent a strategy from holding more than `cap` worth of assets. The cap only limits how much the vault recognises in pricing.
- Replace strategy-level review. A bad strategy with a small cap is still a bad strategy.

If you need to limit how much capital can be ALLOCATED, use weight + debt budget. The cap is a **pricing** safety bound.

## Zero-row state today

`workspace_strategy_targets` in the live `4626fun` Supabase project has zero rows as of this PR. We are setting up the rule before the first row exists, which is the right time. The first row that gets inserted MUST come with `max_assets_cap` populated when applicable, OR with classification metadata showing it is `internal-accounting` / `oracle-backed`.

## Deployment hold (this PR)

This PR introduces:

- The on-chain `setStrategyMaxAssets` setter and the clamp in `_getStrategyAssetsSafe()` (in `CreatorOVault.sol`, `CreatorOVaultCoreModule.sol`, and `CreatorOVaultStrategiesModule.sol`).
- A bumped module storage version (`CreatorOVaultModuleStorage.v2`) so any subsequent module replacement is forced through `setModulesOnce`'s identity check.
- The `max_assets_cap` mirror column on `workspace_strategy_targets` (migration only — not applied to the Supabase production project here).
- Documentation: this runbook + the onboarding checklist + the deployment note.

**Do NOT deploy this branch to Vercel or a production chain until the PR has been reviewed and signed off.** See [`docs/governance/strategy-cap-deployment-note.md`](./strategy-cap-deployment-note.md).
