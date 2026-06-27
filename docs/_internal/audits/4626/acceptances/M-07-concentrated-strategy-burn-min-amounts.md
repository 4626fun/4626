# M-07 — ConcentratedStrategy `_posmBurn` Zero Minimum Amounts

- **Linear:** [4626-316](https://linear.app/4626fun/issue/4626-316) · sub-finding [4626-440](https://linear.app/4626fun/issue/4626-440)
- **Severity:** Medium
- **Confidence (auditor):** Plausible
- **File:** `contracts/vault/strategies/univ4/ConcentratedStrategy.sol::_posmBurn`
- **Finding:** BURN_POSITION action was submitted with `uint128(0)` as both `amount0Min` and `amount1Min`. The prior `FIX: S-H05` comment argued that V4 burn returns the full position value at current pool price, and that manipulation is guarded by the TWAP deviation check in `checkCanRebalance()` (900-second window). The auditor noted that flash-loan-style manipulation shorter than 15 minutes was not caught and slippage was uncapped during the burn.

## Disposition: Fixed — dual defense (TWAP-derived min amounts + existing 900s TWAP gate)

Shipped with [PR #TBD](https://github.com/wenakita/4626/pulls) against `main` under the [M-xx][4626-440] remediation batch.

### What shipped

1. **`_posmBurn` signature change** — now accepts `amount0Min` and `amount1Min` instead of hard-coded zeros.
2. **`_computeBurnMinAmounts` helper** — derives expected `amount0` / `amount1` from the TWAP-implied `sqrtPriceX96` via `LiquidityAmounts.getAmountsForLiquidity()`, then shaves a per-path slippage floor.
3. **Two path-specific slippage constants**:
   - `REBALANCE_BURN_SLIPPAGE_BPS = 100` (1%) — used by `rebalance()`.
   - `WITHDRAW_BURN_SLIPPAGE_BPS = 200` (2%) — used by `withdrawAll()`.
   Withdraws get the looser floor because the path is already `onlyLPManager` (higher trust) and we don't want legitimate withdraws to revert during natural short-term volatility.
4. **Governance opt-out preserved** — when `maxTwapDeviation == 0` the helper falls back to `(0, 0)` rather than reading from spot. Operators who explicitly disable TWAP checks have opted out of manipulation protection wholesale; letting spot set the floor in that regime would let a spot-manipulator set their own guard.
5. **Zero-liquidity short-circuit** — `_computeBurnMinAmounts(…, 0, …)` returns `(0, 0)` without touching the oracle, so `withdrawAll` paths for empty positions never hit the TWAP oracle.

### Why constants, not governance parameters

The acceptance doc originally recommended a single governance-tunable `maxBurnSlippageBps`. Splitting the slippage into two path-specific constants instead of one governance value:

- Removes an ongoing operational surface (a compromised or misconfigured governor cannot silently widen slippage tolerance).
- Lets rebalance stay tight (1%) while giving `withdrawAll` the slack it needs for emergency unwinds.
- Neither number sits in the attacker's model because both are enforced on top of the 900s TWAP gate — the slippage budget isn't the *primary* defense, it's the defense-in-depth.

If volatility on mainnet requires raising the rebalance slippage above 1%, the fix is to bump the constant in a scheduled upgrade rather than to expose it to a governance call.

### Test coverage

`test/ConcentratedStrategy.BurnSlippage.t.sol` pins the math inside `_computeBurnMinAmounts` via a harness that exposes the internal. Full-path burn coverage (i.e. forge-running the PositionManager) requires a live V4 stack which is out of scope for this sprint's sandbox, matching the original acceptance doc's caveat. Cases covered:

- Zero liquidity — returns `(0, 0)` without touching the oracle.
- `maxTwapDeviation == 0` — returns `(0, 0)` (explicit governance opt-out).
- Happy path at TWAP mid — mins equal `LiquidityAmounts.getAmountsForLiquidity(twap, lo, hi, L)` × (1 - rebalance slippage).
- Withdraw path — same math with looser 2% slippage; asserts `withdraw_min < rebalance_min` for identical inputs.
- TWAP move anchoring — shifting the TWAP tick shifts the min amounts predictably (up-move reduces amount0 floor, raises amount1 floor; down-move symmetric). Property pins why a spot-sandwich cannot undercut the floor: mins track TWAP, not spot.
- Out-of-range TWAP (both sides) — when TWAP sits above `tickUpper`, amount0 floor is 0 and amount1 floor is positive; below `tickLower` is symmetric.
- **Oracle presence guard (follow-up).** With `twapOracle == address(0)` and `maxTwapDeviation > 0` (mis-config), `_computeBurnMinAmounts` reverts with `TwapOracleNotSet()` instead of a raw call-to-zero revert; mirrors `getTwap()`. Two complementary cases pin that zero-liquidity and `maxTwapDeviation == 0` still short-circuit before the oracle read, so the guard order is: `liquidity == 0` → `maxTwapDeviation == 0` → oracle presence → TWAP read.

### Follow-up: oracle presence guard in `_computeBurnMinAmounts`

Codex review on the S-H05 PR noted that routing `withdrawAll` through `_computeBurnMinAmounts` introduced a new DOS path in the mis-config state `(twapOracle == address(0) && maxTwapDeviation > 0)`: before the fix, `withdrawAll` did not call the oracle; after the fix, the direct `twapOracle.getTWAPTick(twapDuration)` call would revert low-level on the zero address.

Resolution: add a presence check that mirrors `getTwap()`—`if (address(twapOracle) == address(0)) revert TwapOracleNotSet();`—placed **after** the `liquidity == 0` and `maxTwapDeviation == 0` short-circuits so no-op burns and the governance opt-out still skip the oracle entirely. A zero-min fallback was explicitly rejected for the mis-config state because it would silently disable the S-H05 slippage floor precisely when operators believe protection is on. Named revert also aligns `withdrawAll`’s failure mode with `rebalance()`, which already surfaces `TwapOracleNotSet()` via `checkCanRebalance → getTwap`.

### Remaining items

- [x] Min amounts derived from TWAP in both `_posmBurn` call sites.
- [x] Slippage tunable (via constants) with a conservative default.
- [x] Harness tests exercise legitimate burn conditions without reverts under ±5% TWAP moves.
- [x] `FIX: S-H05` comment updated to reflect dual defense.
- [ ] Post-mainnet: revisit `REBALANCE_BURN_SLIPPAGE_BPS` and TWAP window against realized volatility; widen only via upgrade, never governance. *(Follow-up ticket to be filed once mainnet volatility data exists.)*

## Tracking

Linear: [4626-440](https://linear.app/4626fun/issue/4626-440) (In Review). Parent [4626-422](https://linear.app/4626fun/issue/4626-422) pre-merge blocker.
When the PR merges, move this document to `docs/audits/4626/closed/`.
