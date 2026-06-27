# M-02 — CreatorOracle TWAP Ring Buffer: Custom Implementation Risk

- **Linear:** [4626-311](https://linear.app/4626fun/issue/4626-311) (parent) · [4626-436](https://linear.app/4626fun/issue/4626-436) (ring-buffer test gap)
- **Severity:** Medium
- **Confidence (auditor):** Plausible
- **File:** `contracts/utilities/oracles/CreatorOracle.sol`
- **Finding:** The oracle implements a custom ring-buffer TWAP instead of delegating to Uniswap V4's `Oracle.sol` library or `observe()`. Custom implementations have a history of subtle bugs (off-by-one ring pointer, incorrect time weighting, buffer-not-yet-full edge cases, wrap-around).

## Disposition: Risk-accepted with mitigation plan — mitigation (1) now complete

Migrating `CreatorOracle` to delegate TWAP observation to the V4 pool's native `observe()` is a deep refactor that changes both the on-chain storage layout and every downstream consumer (lottery pricing, vault PPS, LBP migration pricing). Shipping it inside a single audit-remediation sprint without the ability to run `forge test` against the full suite is not acceptable — the blast radius is larger than the "Plausible" risk justifies.

## Current state at HEAD

- The ring-buffer storage and cumulative-tick logic are implemented in `contracts/utilities/oracles/CreatorOracle.sol` (observation writes, ring advance, and TWAP observation traversal).
- Targeted TWAP/ring-buffer safety coverage lives in `test/CreatorOracle.TwapSafety.t.sol` and — as of 4626-436 — `test/CreatorOracle.RingBuffer.t.sol`. Between the two suites the following scenarios are now covered:
  - `test_recordObservation_FirstWriteAdvancesIndexAndInitializesNextSlot` (first write, next-slot initialization)
  - `test_getTWAPTick_DoesNotUseUninitializedObservation` (buffer-not-yet-full read path)
  - `test_ringBuffer_sameBlockWriteIsIdempotent` (time delta 0 idempotence — 4626-436)
  - `test_ringBuffer_wrapAroundAtMaxCardinality` (N+1 writes into a size-N buffer — 4626-436)
  - `test_ringBuffer_cumulativeTickMonotonicityAcrossWrap` (cumulative-tick monotonicity across the wrap boundary — 4626-436)

Quick verification commands:

- `grep -nE 'ring buffer|_write|_observe|getTWAPTick' contracts/utilities/oracles/CreatorOracle.sol`
- `find test -iname '*twap*' -o -iname '*ringbuffer*'`
- `grep -nE 'test_ringBuffer_' test/CreatorOracle.RingBuffer.t.sol`
- `forge test --match-contract CreatorOracleRingBufferTest -vvv`

Mitigation:

1. Extend the existing `test/CreatorOracle.TwapSafety.t.sol` suite (which already covers first-write index advance and buffer-not-yet-full behavior) to additionally cover:
   - Two observations in the same block (time delta 0).
   - Wrap-around (N+1 observations into a buffer of size N).
   - Monotonicity of cumulative tick sums across wrap.
2. Re-audit the ring-buffer advance logic against V4's `Oracle.sol` as reference.
3. File a follow-up engineering ticket tracking a migration to `observe()` for a future major version; include a storage-migration story.

Until the additional cases in (1) land, treat this finding as known-open. No code change is shipped in the Sprint 5 PR for this item.

## Reproduction / verification (for future re-audit)

Current state of the custom ring-buffer implementation at HEAD:

- Storage and cumulative-tick accumulator: `contracts/utilities/oracles/CreatorOracle.sol`; the ring-buffer data structures and `_write` / `_observeCumulative` / buffer-advance logic live in this file. Reproducing the review: `grep -nE 'ringBuffer|cumulative|_observe|_write' contracts/utilities/oracles/CreatorOracle.sol`.
- Partial ring-buffer coverage exists today in `test/CreatorOracle.TwapSafety.t.sol`. Reproducing: `find test -iname '*ringbuffer*' -o -iname '*twap*'` returns that file, and `grep -nE 'function test_' test/CreatorOracle.TwapSafety.t.sol` surfaces the shipped mitigation — notably `test_recordObservation_FirstWriteAdvancesIndexAndInitializesNextSlot` (first-write index advance + next-slot initialization) and `test_getTWAPTick_DoesNotUseUninitializedObservation` (buffer-not-yet-full behavior uses the oldest initialized slot rather than reading an uninitialized one), plus auto-update / deviation-cap guards (`test_recordSwapObservation_BaseAutoUpdate_RequiresMinWindow`, `test_recordSwapObservation_BaseAutoUpdate_DoesNotBypassMaxDeviation`) and a tick-bound overflow check. Scenarios still uncovered and required before close: same-block write (time delta 0), full wrap-around (N+1 writes into a size-N buffer), and monotonicity of the cumulative-tick accumulator across a wrap. The mitigation PR should extend `test/CreatorOracle.TwapSafety.t.sol` (or add a sibling `test/CreatorOracle.RingBuffer.t.sol`) with those three cases.
- Consumer surface that depends on the TWAP today (so a reviewer can re-audit blast radius before close): lottery pricing (`contracts/utilities/lottery/CreatorLotteryManager.sol`), vault PPS (`contracts/vault/CreatorOVault.sol` + `contracts/vault/modules/CreatorOVaultStrategiesModule.sol`), LBP/CCA migration pricing (`contracts/vault/strategies/CCALaunchStrategy.sol`). Reproducing: `grep -rn 'CreatorOracle\|_twap\|getTwap' contracts/ --include='*.sol'`.

## Tracking

- Linear [4626-311](https://linear.app/4626fun/issue/4626-311) remains **open** — this file does not close it.
- When the test suite in item (1) of the mitigation plan lands, link the PR here and move this file under `docs/audits/4626/closed/`. If the follow-up engineering ticket (item 3 — migration to V4 `observe()`) is filed separately, cross-link it here and in 4626-311.
