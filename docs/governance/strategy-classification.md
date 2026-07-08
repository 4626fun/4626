# Strategy Classification Register

Source-of-truth list of every **leg** (vault strategy) considered for `CreatorOVault`, plus **arms** (ShareOFT extension facilities) that must never be classified as legs. Each leg row pins the valuation mode (per [the onboarding checklist](./strategy-onboarding-checklist.md)) and the cap rationale, if any.

## Legs vs arms

| Term | Also called | Role | Asset | Vault wiring |
| --- | --- | --- | --- | --- |
| **Leg** | strategy | Deploy / manage **creator coin** in yield sleeves | Creator coin + ▢ vault shares | `addStrategy`, `strategyMaxAssets` caps |
| **Arm** | — | **Extend ShareOFT** — launch, mesh liquidity, bridge, trade routing | ■ ShareOFT | Dedicated pointers / deploy entitlements; **never** `addStrategy` |

**Naming policy:** In docs, UI, and runbooks, call legs **strategies** when the context is vault yield (Charm, Ajna). Do **not** call arms strategies. Onchain identifiers: `CCALaunchArm` / `ccaLaunchArm`. Historical manifests may still list retired `CCALaunchStrategy` / `ccaLaunchStrategy` names.

**New vault launch:** creators pay **`vault_full_deploy`** ($499), which bundles Charm + Ajna Phase 3 **legs** (45%/45%). Solana exposure is seeded via **ShareOFT auto-bridge at finalize** (`solana_ovault_mesh`), an **arm**, not a Phase-3 leg.

Update this file in the same PR that adds, classifies, or re-caps a leg or arm.

## Legs (strategies)

| Strategy | Feature flag | Class | `strategyMaxAssets` (initial) | Rationale |
| --- | --- | --- | --- | --- |
| AJNA 4626 sleeve | `ajna_sleeve` | `capped` unless valuation is verified as internal-accounting or oracle-backed | TBD on activation: `max(intended debt ceiling, current strategy NAV) + safety buffer` | AJNA can grow if more creator coins are deposited/lent; cap is a trust ceiling until the valuation path is validated |
| Charm Alpha LP | `charm_active_lp` | `capped` | TBD on activation: cap total trusted NAV, not just creator-token inventory | LP inventory can shift between creator token and USDC; valuation is market-state sensitive and needs active review after large rebalances |

## Vault arms (ShareOFT extension)

Arms extend ■ ShareOFT. They are **not** legs and must not appear in `addStrategy` or `strategyMaxAssets` batches.

| Arm | Feature flag | Onchain | Cap handling |
| --- | --- | --- | --- |
| Share CCA launch | — | `CCALaunchArm` (`ccaLaunchArm` vault pointer) | CCA primary market + graduation handoff (`sweepCurrency` → `migrate` → `seedLpManager`). No LP mint at `migrate()`. |
| Share mesh V4 LP | `share_mesh_v4` | `OVaultLPManager` | Post-CCA mesh liquidity (`deployShareMeshLpManager` → `seedLpManager` → `seedRebalance`). Keeper completion requires oracle `v4PoolConfigured`, wired `lpManager`, and seeded 3-position liquidity before `settledAt`. |
| Solana OVault mesh | `solana_ovault_mesh` | bridge / route provisioning | Phase 2b routing entitlement for Solana OVault compose/peer wiring. Track route/peer/config risk in the deploy runbook, not the leg cap register. |
| Share trade routing | — | gauge, hook, lottery | Trade-fee domain on ■ (see canonical lane terms: `tradeFeeCollector`, `jackpotCustodian`, `jackpotPayoutAuthority`). |

**Share mesh V4 price domain:** CCA auction floor pricing uses creator-coin USD oracle pre-auction; post-`migrate()` the Phase 2 oracle records the ShareOFT/native-ETH V4 pool (`setV4Pool`). The mesh LP manager consumes that same oracle TWAP (`twapOracle`) for rebalance guards; bootstrap uses one-shot `seedRebalance()` while cardinality is still 1.

**Post-graduation completion order:** `sweepCurrency()` → `migrate()` (pool init + oracle only) → `deployShareMeshLpManager()` → `seedLpManager()` → `seedRebalance()` → keeper invariants → `settledAt`.

## How to update

1. New leg → append a row under **Legs (strategies)**, fill all columns, link the audit/PR.
2. New arm → append a row under **Vault arms**, note feature flag and legacy onchain name if any.
3. Cap change → add a dated bullet under the leg with the new cap and the reason.
4. Class change (e.g. `capped` graduating to `oracle-backed`) → strike-through the old class line and add the new one with the date and reviewer.

## Cross-references

- Live `creator_strategy_features` queue (Supabase, project `4626fun`): governance must confirm class before flipping any of these to `active` with non-trivial weight.
- Live `workspace_strategy_targets` (Supabase, project `4626fun`): capped strategy rows must include `max_assets_cap`, `updated_source = 'governance-runbook'`, and notes with the valuation class, intended debt ceiling, estimated NAV, safety buffer, and review triggers.
