# Strategy Classification Register

Source-of-truth list of every strategy considered for `CreatorOVault`. Each row pins the valuation mode (per [the onboarding checklist](./strategy-onboarding-checklist.md)) and the cap rationale, if any.

Update this file in the same PR that adds, classifies, or re-caps a strategy.

| Strategy | Feature flag | Class | `strategyMaxAssets` (initial) | Rationale |
| --- | --- | --- | --- | --- |
| AJNA 4626 sleeve | `ajna_sleeve` | `capped` (pending) | TBD on activation — propose 1% of vault TVL or absolute floor, whichever is larger | AJNA quote-token valuation depends on pool state; cap is a pricing safety bound until oracle path is validated |
| Charm Alpha LP | `charm_active_lp` | `capped` (pending) | TBD on activation — start small and re-review after 30 days | LP valuation revalued via tick price; manipulation-sensitive |
| Solana bridge strategy | `solana_bridge_strategy` | `capped` (pending) | TBD on activation — small absolute cap | Cross-chain inventory; off-chain reconciliation is part of the valuation path |
| Solana OVault mesh | `solana_ovault_mesh` | TODO classify before next governance action | n/a | Currently `active` per `creator_strategy_features` — needs an explicit class entry before any non-trivial allocation |

## How to update

1. New strategy → append a row, fill all four columns, link the audit/PR.
2. Cap change → add a dated bullet under the strategy with the new cap and the reason.
3. Class change (e.g. `capped` graduating to `oracle-backed`) → strike-through the old class line and add the new one with the date and reviewer.

## Cross-references

- Live `creator_strategy_features` queue (Supabase, project `4626fun`): governance must confirm class before flipping any of these to `active` with non-trivial weight.
- Live `workspace_strategy_targets` (Supabase, project `4626fun`): currently zero rows; first row must include `max_assets_cap` if the strategy is `capped`.
