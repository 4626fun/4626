# Strategy Classification Register

Source-of-truth list of every strategy considered for `CreatorOVault`. Each row pins the valuation mode (per [the onboarding checklist](./strategy-onboarding-checklist.md)) and the cap rationale, if any.

Update this file in the same PR that adds, classifies, or re-caps a strategy.

| Strategy | Feature flag | Class | `strategyMaxAssets` (initial) | Rationale |
| --- | --- | --- | --- | --- |
| AJNA 4626 sleeve | `ajna_sleeve` | `capped` unless valuation is verified as internal-accounting or oracle-backed | TBD on activation: `max(intended debt ceiling, current strategy NAV) + safety buffer` | AJNA can grow if more creator coins are deposited/lent; cap is a trust ceiling until the valuation path is validated |
| Charm Alpha LP | `charm_active_lp` | `capped` | TBD on activation: cap total trusted NAV, not just creator-token inventory | LP inventory can shift between creator token and USDC; valuation is market-state sensitive and needs active review after large rebalances |
| Solana bridge strategy | `solana_bridge_strategy` | `capped` unless keeper/oracle reconciliation is verified as safe enough for another class | TBD on activation: start tighter than local strategies unless reconciliation confidence is high | Cross-chain inventory; keeper/reconciliation trust is part of the valuation path |
| Solana OVault mesh | `solana_ovault_mesh` | Determine whether this is a Phase 2b routing entitlement rather than a Phase 3 strategy allocation | n/a unless a concrete `CreatorOVault` strategy address exists | Currently `active` per `creator_strategy_features`; no `setStrategyMaxAssets` calldata applies if there is no vault strategy address |

## How to update

1. New strategy → append a row, fill all four columns, link the audit/PR.
2. Cap change → add a dated bullet under the strategy with the new cap and the reason.
3. Class change (e.g. `capped` graduating to `oracle-backed`) → strike-through the old class line and add the new one with the date and reviewer.

## Cross-references

- Live `creator_strategy_features` queue (Supabase, project `4626fun`): governance must confirm class before flipping any of these to `active` with non-trivial weight.
- Live `workspace_strategy_targets` (Supabase, project `4626fun`): capped strategy rows must include `max_assets_cap`, `updated_source = 'governance-runbook'`, and notes with the valuation class, intended debt ceiling, estimated NAV, safety buffer, and review triggers.
