# L-05 (4626-353): FullRangeStrategy stubbed valuation math

**Status:** Acceptance — risk-accepted, tracked for follow-up
**Finding:** L-05
**Linear:** 4626-353
**File:** `contracts/vault/strategies/univ4/FullRangeStrategy.sol`
**Scope affected:** `_calculateLiquidity`, `_calculateAmountsForLiquidity`, `getTotalValue`

## Problem

Two helpers are explicit stubs that do not reflect actual Uniswap V4 pool
state:

- `_calculateLiquidity(creatorCoinAmount, pairedAmount)` returns the
  geometric mean `sqrt(a*b)` (or `a+b` if one side is zero).
- `_calculateAmountsForLiquidity(liquidity)` returns a 50/50 split
  (`liquidity / 2` on each side).

Both are only used by `getTotalValue()`, which the vault currently
references for strategy-weighted NAV reporting. The mint/burn pathways
(`_posmMint` / `_posmIncrease` / `_posmDecrease`) already use
`@uniswap/v4-periphery`'s `LiquidityAmounts.getLiquidityForAmounts` for
the actual on-chain action, so funds are not at risk of mispricing —
the stub only affects the off-chain-readable `getTotalValue()`.

Reported impact ("L-05"): NAV reporter over/under-states the
FullRangeStrategy leg when the pool price is skewed away from
`sqrt(1)`; accounting inside the vault can drift relative to the true
position.

## Why we are deferring a code fix

Writing a correct on-chain valuation helper requires:

1. Reading current pool tick/slot0 via `PoolManager.extsload` (V4 does
   not expose a direct `slot0()` getter — needs key-derived extsload or
   a periphery `StateLibrary` call).
2. Computing `sqrtPriceX96` and the target range's
   `sqrtPriceA`/`sqrtPriceB`.
3. Calling
   `LiquidityAmounts.getAmountsForLiquidity(sqrtPriceX96, sqrtPriceAX96,
   sqrtPriceBX96, liquidity)` — which is the routine that the mint path
   already relies on.
4. Converting `creatorCoinAmount` and `pairedAmount` into a single
   unit (paired-denominated NAV) via the creator oracle.

Steps 1–3 are mechanical refactors but they require a forge fuzz suite
to prove they match the mint-path math at edge ticks (MIN_TICK,
MAX_TICK, tickSpacing boundaries). The auditor team flagged this as a
`Low` precisely because the helper is only consumed off-chain, so we
are treating it as engineering debt rather than a hotfix.

## Mitigation in place

- Mint/withdraw pathways already use periphery `LiquidityAmounts`, so
  the stub does **not** govern token flow.
- Rebalance authority (`lpManager` / `owner`) is trusted and cannot be
  spoofed via the stub.
- Vault NAV is additionally sanity-checked against the oracle by the
  backend "vault-integrity" CRE workflow (see
  `cre/cre-workflows/vault-integrity/`) before any user-facing
  surfacing; stub skew > 2% trips an alert.

## Exit criteria (to close this finding)

1. Replace both helpers with `LiquidityAmounts.getAmountsForLiquidity`-
   based math, reading `sqrtPriceX96` from the pool via
   `StateLibrary.getSlot0`.
2. Introduce a `FullRangeStrategyValuationTest` forge test that fuzzes
   over tick values in `[MIN_TICK, MAX_TICK]` and asserts
   `getTotalValue()` round-trips within 1 wei of the amount the mint
   path burned to create the position.
3. Keep the stub behaviour reachable only under `isEmergencyMode` as a
   last-resort read-only fallback.

## References

- `contracts/vault/strategies/univ4/FullRangeStrategy.sol:550-571`
- `@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol`
- `@uniswap/v4-core/src/libraries/StateLibrary.sol`
