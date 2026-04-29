# Strategy Onboarding Checklist

Every strategy whitelisted for a `CreatorOVault` MUST be classified into exactly one of three valuation modes before it is added (`addStrategy`) and BEFORE any meaningful capital is allowed to flow into it.

The classification, the rationale, and any cap value MUST be recorded in this repo (in `docs/governance/strategy-classification.md`) and mirrored to `creator_strategy_features.notes` / `workspace_strategy_targets.notes` in Supabase.

## Why this exists

ERC-4626 vaults expose a documented class of attacks where a strategy can mis-report the assets it controls and inflate the price-per-share that the vault uses to convert deposits into shares (and shares back into assets):

- OpenZeppelin — *A novel defense against ERC-4626 inflation attacks*: <https://www.openzeppelin.com/news/a-novel-defense-against-erc4626-inflation-attacks>
- Euler — *Donation attack vectors against ERC-4626*: <https://docs.euler.finance/security/attack-vectors/donation-attacks/>

In our architecture, `CreatorOVault.totalAssets()` walks the strategy list and calls `_getStrategyAssetsSafe(strategy)` for each one. If a strategy's `getTotalAssets()` over-reports — because of a poisoned oracle, a directly transferred ("donated") balance, an LP position revalued by a manipulated tick, or simply a bug — share price diverges from reality. Defending against that requires either:

1. The strategy's valuation being structurally non-manipulable (internal accounting only, or a vetted oracle), OR
2. An explicit governance cap that bounds how much the vault is willing to recognise from that strategy regardless of what it claims.

`strategyMaxAssets` (see `setStrategyMaxAssets`) is the on-chain knob enforcing (2). It is a governance trust ceiling: the maximum valuation the vault is willing to trust from this strategy until governance/operator review updates the cap. It is not an allocation target and not a promise that the strategy should always hold that amount.

This checklist makes sure (1) or (2) is decided BEFORE the strategy goes live.

## Valuation modes

A strategy MUST be classified as exactly one of:

### `internal-accounting`

The strategy's `getTotalAssets()` is derived only from values that the vault itself transferred in, plus realised yield that has already settled into the same accounting unit. There is no external price feed, no AMM tick, no off-chain oracle in the path.

Examples: a vault that simply holds the creator coin and accrues from `report()` profit posts; a strategy that wraps a yield token whose `balanceOf` is denominated in the underlying.

OpenZeppelin's defense write-up describes the strongest forms of this mode: tracked balances that cannot be inflated by outside transfers. Donation attacks (Euler) specifically target the *opposite* — strategies whose valuation reads `IERC20(token).balanceOf(address(this))` directly, which a third party can inflate by `transfer`-ing tokens in.

Onboarding requirements:
- [ ] Source of every term in `getTotalAssets()` is explicitly traced and shown to be vault-controlled.
- [ ] No `balanceOf(address(this))` reads on tokens that any party can transfer in.
- [ ] Accounting model reviewed and documented, even if governance does not set a tight cap.
- [ ] Reviewer signs off in PR description; classification recorded.

### `oracle-backed`

The strategy values external positions via a price oracle. The oracle is on the vetted list (Chainlink with deviation/heartbeat checks, or `CreatorOracle`/internal TWAP with a known manipulation cost), and the strategy bounds staleness.

Onboarding requirements:
- [ ] Oracle source identified and listed in the PR description.
- [ ] Heartbeat / deviation parameters reviewed.
- [ ] Manipulation-cost analysis: what does it cost an attacker to push the oracle by N%, and is the resulting inflation bounded by that?
- [ ] Cap accounts for oracle confidence, expected NAV drift, and oracle/rate-limit risk.
- [ ] Reviewer signs off; classification recorded.
- [ ] Even when oracle-backed, a conservative `setStrategyMaxAssets` cap is RECOMMENDED for the first weeks of live operation while the oracle behaviour is observed.

### `capped`

The strategy is neither pure internal-accounting nor backed by a vetted oracle — typically because it holds AMM LP, cross-chain inventory, or new untested machinery. It MUST be activated only with `setStrategyMaxAssets(strategy, cap)` set to a cap conservative enough that *if* the strategy lied about its valuation up to the cap, the resulting share-price impact is acceptable.

Onboarding requirements:
- [ ] `setStrategyMaxAssets(strategy, cap)` called BEFORE the strategy is added with non-zero weight or before `forceDeployToStrategies()` is run.
- [ ] Cap chosen as `max(intended debt ceiling, current strategy NAV) + safety buffer`.
- [ ] Cap rationale documented: what failure does the cap survive, how was the number chosen, and what review trigger will update it.
- [ ] Re-review scheduled (default: 30 days, or after material TVL / strategy changes).
- [ ] Cap value mirrored to `workspace_strategy_targets.max_assets_cap` so the operator UI shows it next to the on-chain value.

## Pending strategy features

| Strategy / feature flag | Tentative class | Required action before non-trivial allocation |
| --- | --- | --- |
| `ajna_sleeve` (AJNA 4626 sleeve) | `capped` unless the valuation path is verified as internal-accounting or oracle-backed | Before activation, locate the concrete strategy address, compute intended debt ceiling and current estimated NAV, then set a trust ceiling with buffer. |
| `charm_active_lp` (Charm Alpha Vault) | `capped` because LP positions are revalued through market state | Before activation, cap total trusted NAV, not just creator-token inventory; re-review after large swap/LP inventory shifts. |
| `solana_bridge_strategy` (cross-chain inventory) | `capped` unless keeper/oracle reconciliation is verified as safe enough for another class | Start tighter because valuation depends on keeper/reconciliation trust; re-review if reconciliation changes or fails. |
| `solana_ovault_mesh` (currently `active`) | Determine whether this is a Phase 2b routing entitlement rather than a Phase 3 strategy allocation | If no `CreatorOVault` strategy address exists, no `setStrategyMaxAssets` calldata applies; still document the risk model. |

Pending features are entitlements only until the activation/provisioning flow produces concrete per-creator strategy addresses.

## Onboarding flow

1. Open a PR adding the strategy to the codebase.
2. In the PR description, fill in:
   - Valuation class (`internal-accounting` / `oracle-backed` / `capped`).
   - For `oracle-backed`: oracle source, heartbeat, deviation, manipulation-cost note.
   - For `capped`: intended debt ceiling, current estimated NAV, proposed `strategyMaxAssets`, safety buffer, and how the cap was chosen.
3. Reviewer confirms classification matches the code.
4. After deploy/provisioning, governance executes (in order):
   1. `setStrategyMaxAssets(strategy, cap)` if applicable. **Set the cap BEFORE `addStrategy`** so any auto-allocation respects the cap from block 0.
   2. `addStrategy(strategy, weight, addToQueue=true)` only after the cap is in place.
   3. Operator UI / Supabase row mirrors the cap.
5. Schedule re-review per the runbook.
