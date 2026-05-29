# Minimal Halmos Smoke for Creator OVault Share/Asset Math + Fee Math

This is the first targeted symbolic execution layer for 4626's core ERC-4626 accounting (the concrete next step after the Foundry invariant foundation — user choice "3").

## What it covers

- **Ajna sleeve fee helpers** (exact copies of the production logic in `AjnaERC4626Vault.sol`):
  - `_feeFromTotal`, `_feeFromNet`, `_grossUp`, `_netFromGross`
  - These directly determine every `preview*` when the Ajna strategy is in the active mix.

- **CreatorOVault virtual share math** (faithful model of the live contract):
  - `_decimalsOffset() == 3` (VIRTUAL_SHARES_OFFSET = 1_000)
  - VIRTUAL_ASSETS_OFFSET = 1
  - The OZ `convertToShares` / `convertToAssets` formulas under those offsets
  - The `previewRedeem` liquidation cap (the S-C02 queued-withdrawal reservation fix)

- Monotonicity, roundtrip floor properties, and the key "never overstate liquid value after reservations" invariant.

## Relationship to existing high-assurance work

- `contracts/vault/tamago/` + `TamagoERC4626Mirror.t.sol` + Lean specs already prove the ERC4626 mirror + many no-loss / closed-world properties.
- The invariant suites (`CreatorOVaultStrategies.Rebalance.Invariant.t.sol`, `CreatorOVaultUserAccounting.Invariant.t.sol`, `UserPositionInvariantBase.sol`) stress the same accounting under adversarial rebalancing and user flows.
- This Halmos layer is the lightweight "symbolic smoke on the real formulas" step that sits between the two.

## Running

1. Install halmos (once):
   ```bash
   pip install halmos
   # or
   pipx install halmos
   ```

2. From repo root:
   ```bash
   halmos --contract CreatorOVaultMath --function check_ --solver-timeout-assertion 60000
   ```

   For faster iteration on a single property:
   ```bash
   halmos --contract CreatorOVaultMath --function check_feeFromTotal_never_exceeds_input
   ```

3. (Optional) Run the same file as ordinary Foundry fuzz tests (the `check_` functions become normal fuzz tests under `forge test` if you temporarily rename the prefix to `test`).

## Extending to the live CreatorOVault

The current model keeps `totalAssets` / `totalSupply` as controllable state so the symbolic engine can explore the conversion formulas quickly without pulling in the full delegatecall module graph, strategy try/catch valuation paths, or reentrancy guards.

To move to the real contract:

- Use (or extend) `RebalanceTestHarness` + the mock strategies already present in `test/vault/strategies/`.
- Deploy a real `CreatorOVault` (with 0 or 1 strategy) inside a `check_` function.
- Symbolically vary deposits, the coinBalance, strategy reported values (within caps), and queued withdrawal totals.
- Assert the same properties against the live `vault.convertToShares(...)`, `vault.previewRedeem(...)`, etc.

That increment is intentionally left for the next slice once this minimal smoke is green in CI.

## Current status (after "continue")

- **Model layer** — fast pure symbolic exploration of the virtual share formula + Ajna fee helpers.
- **Live layer** (added on "continue") — the same classes of properties now execute directly against a real `CreatorOVault` deployed inside the `check_live_*` functions (0-strategy minimal setup using the exact same module wiring as production and the invariant harnesses). This is the direct realization of "on the real vault’s convertToShares / convertToAssets / fee math".

The file is deliberately split:
- Fast model checks for rapid iteration and broad exploration.
- Live checks that give confidence the actual deployed bytecode satisfies the same properties.

Next natural increments (still minimal):
- Add a 1-strategy live variant using `WeightedMockStrategy` (exercise the safe valuation fallback + `strategyMaxAssets` cap in totalAssets).
- Bring in a minimal Ajna sleeve (AjnaERC4626Vault + adapter) for symbolic fee math through the real preview path.
- Add a CI / Makefile target that runs `halmos` on this contract when the binary is present.

## Status

- Created: 2026-05 as the direct follow-up to the UserPositionInvariantBase + two-suite (stress vs protected user-safety) architecture.
- "continue" step: moved from pure model to live deployed CreatorOVault bytecode checks.
- Scope: pure math + high-signal view surfaces first. Side-effecting paths and full strategy rebalancing come later (or via Certora on narrow modules).

See the verification roadmap in the parent audit docs for the long-term path (Foundry invariants → Halmos on math → selective Certora → targeted Lean only where TVL justifies the cost).