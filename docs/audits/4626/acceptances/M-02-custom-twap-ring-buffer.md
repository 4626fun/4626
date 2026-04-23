# M-02 — CreatorOracle TWAP Ring Buffer: Custom Implementation Risk

- **Linear:** [4626-311](https://linear.app/4626fun/issue/4626-311)
- **Severity:** Medium
- **Confidence (auditor):** Plausible
- **File:** `contracts/utilities/oracles/CreatorOracle.sol`
- **Finding:** The oracle implements a custom ring-buffer TWAP instead of delegating to Uniswap V4's `Oracle.sol` library or `observe()`. Custom implementations have a history of subtle bugs (off-by-one ring pointer, incorrect time weighting, buffer-not-yet-full edge cases, wrap-around).

## Disposition: Risk-accepted with mitigation plan

Migrating `CreatorOracle` to delegate TWAP observation to the V4 pool's native `observe()` is a deep refactor that changes both the on-chain storage layout and every downstream consumer (lottery pricing, vault PPS, LBP migration pricing). Shipping it inside a single audit-remediation sprint without the ability to run `forge test` against the full suite is not acceptable — the blast radius is larger than the "Plausible" risk justifies.

## Current state at HEAD

- The ring-buffer storage and cumulative-tick logic are implemented in `contracts/utilities/oracles/CreatorOracle.sol` (observation writes, ring advance, and TWAP observation traversal).
- Targeted TWAP/ring-buffer safety coverage already exists in `test/CreatorOracle.TwapSafety.t.sol`, including:
  - `test_recordObservation_FirstWriteAdvancesIndexAndInitializesNextSlot`
  - `test_getTWAPTick_DoesNotUseUninitializedObservation`
- Coverage is not yet a dedicated ring-buffer-only suite, and explicit tests for same-block (`timeDelta == 0`) and wrap-around (`N+1` into full ring) remain part of the follow-up mitigation scope below.

Quick verification commands:

- `grep -nE 'ring buffer|_write|_observe|getTWAPTick' contracts/utilities/oracles/CreatorOracle.sol`
- `find test -iname '*twap*' -o -iname '*ringbuffer*'`
- `grep -nE 'FirstWriteAdvancesIndex|DoesNotUseUninitializedObservation' test/CreatorOracle.TwapSafety.t.sol`

Mitigation to apply before this can be closed:

1. Add a `forge test` suite specifically for the ring buffer covering:
   - Buffer not yet full (single observation, observations at the ring boundary).
   - Two observations in the same block (time delta 0).
   - Wrap-around (N+1 observations into a buffer of size N).
   - Monotonicity of cumulative tick sums across wrap.
2. Re-audit the ring-buffer advance logic against V4's `Oracle.sol` as reference.
3. File a follow-up engineering ticket tracking a migration to `observe()` for a future major version; include a storage-migration story.

Until the test suite in (1) lands, treat this finding as known-open. No code change is shipped in the Sprint 5 PR for this item.

## Tracking

When the test suite lands, link the PR here and move this file under `docs/audits/4626/closed/`.
