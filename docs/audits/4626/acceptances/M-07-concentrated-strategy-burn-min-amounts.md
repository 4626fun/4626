# M-07 — ConcentratedStrategy `_posmBurn` Zero Minimum Amounts

- **Linear:** [4626-316](https://linear.app/4626fun/issue/4626-316)
- **Severity:** Medium
- **Confidence (auditor):** Plausible
- **File:** `contracts/vault/strategies/univ4/ConcentratedStrategy.sol::_posmBurn` (≈L753-767)
- **Finding:** BURN_POSITION action is submitted with `uint128(0)` as both `amount0Min` and `amount1Min`. The existing `FIX: S-H05` comment argues that V4 burn returns the full position value at current pool price, and that manipulation is guarded by the TWAP deviation check in `checkCanRebalance()` (900-second window). The auditor notes a flash-loan-style manipulation shorter than 15 minutes is not caught and slippage is uncapped during the burn.

## Disposition: Risk-accepted with follow-up, not shipped this sprint

Computing sound minimum amounts requires deriving expected `amount0`/`amount1` from current liquidity and TWAP sqrtPrice via V4's `LiquidityAmounts.getAmountsForLiquidity()`, plus a configurable slippage tolerance (e.g. `maxBurnSlippageBps`). That change:

- adds a new governance parameter + setter,
- touches rebalance invariants that depend on burn always succeeding,
- needs a forge fuzz harness to verify that legitimate rebalances don't revert,
- and the existing TWAP window (900s) would need a parallel tightening to actually be effective against <15min manipulation.

None of that can be validated without a working `forge test` pipeline, which this sandbox cannot run. Shipping the math-only change without a fuzz harness risks a footgun where legitimate rebalances revert under volatile but non-adversarial conditions, which is strictly worse than the status quo.

## Mitigation to apply before closing

1. Add a governance-tunable `maxBurnSlippageBps` with a conservative default (e.g. 100 = 1%).
2. In `_posmBurn`, fetch current liquidity for the position (`StateLibrary`), compute expected amounts at TWAP price via `LiquidityAmounts.getAmountsForLiquidity()`, and pass `(expected * (10_000 - maxBurnSlippageBps) / 10_000)` as the minimums.
3. Add forge fuzz coverage: rebalance under ±5% price moves, ±maxTwapDeviation, and verify burn succeeds whenever the TWAP deviation check passes.
4. Consider tightening `maxTwapDeviation` or shortening the TWAP window to <=600s depending on the pool's natural volatility profile.

## Tracking

File a follow-up engineering ticket tagged `audit/4626/M-07`. When the PR lands, link it here and move this document to `docs/audits/4626/closed/`.
