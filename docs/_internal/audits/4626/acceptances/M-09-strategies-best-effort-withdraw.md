# M-09 Acceptance Criteria — Strategy Withdraw DoS on User Hot Path

**Finding:** 4626-420  
**Severity:** Medium  
**File:** `contracts/vault/modules/CreatorOVaultStrategiesModule.sol`  
**Base SHA:** `43746e1ced400e60e00c10c527939f250db23896`

## Summary

`_withdrawFromStrategies` (the user-facing withdrawal hot path) called `_withdrawFromStrategyMeasured`, which reverts on two conditions:

1. The strategy itself reverts inside `IStrategy.withdraw(...)`.
2. The strategy's reported `withdrawn` does not equal the measured `balanceOf` delta (`TransferAmountMismatch`).

Either condition bubbling up freezes every vault withdrawal in the default queue until governance manually `forceRemoveStrategy`'s the broken strategy — a denial-of-service vector where one misbehaving leg of the queue blocks all users.

The fix introduces `_tryWithdrawFromStrategyMeasured`:

- Wraps the strategy call in `try/catch`.
- On revert: emits `StrategyWithdrawFailed(strategy, amount, revertData)` and returns `0` (or the measured delta if the strategy moved funds before reverting).
- On accounting mismatch: emits `StrategyWithdrawFailed` with an encoded `TransferAmountMismatch(reported, received)` payload and returns the measured `received`.
- `_withdrawFromStrategies` now uses the try-helper and `continue`s past zero-withdrawal legs.
- `removeStrategy` retains strict `_withdrawFromStrategyMeasured` semantics — admin flows must still revert on shortfall.

## Acceptance checklist

- [ ] **User withdraw with one broken strategy succeeds** — if queue is `[BrokenStrategy, GoodStrategy]` and each holds enough to cover the requested amount, the user's withdrawal completes from `GoodStrategy` and emits `StrategyWithdrawFailed` for `BrokenStrategy`.
- [ ] **Reverting strategy returns 0** — direct unit test of `_tryWithdrawFromStrategyMeasured` on a strategy that reverts with no state change returns `0` and emits `StrategyWithdrawFailed`.
- [ ] **Partial-then-revert returns measured delta** — if a strategy moves X tokens then reverts, helper returns X and emits `StrategyWithdrawFailed`; `coinBalance` tracks the measured post-balance.
- [ ] **Report-mismatch returns measured** — if `reported != received`, helper returns `received` and emits `StrategyWithdrawFailed` with a `TransferAmountMismatch(reported, received)`-encoded payload.
- [ ] **Over-report mismatch is caught** — strategy reports 500 but transfers 400: helper returns 400, vault accounting unaffected.
- [ ] **Under-report mismatch is caught** — strategy reports 400 but transfers 500: helper returns 500, vault accounting unaffected.
- [ ] **Aggregate shortfall still reverts at caller** — if the combined measured withdrawal across the queue is insufficient to cover the user's requested amount, the vault's core module still reverts with `InsufficientBalance`. Best-effort resilience ≠ silent success.
- [ ] **`removeStrategy` still strict** — calling `removeStrategy` on a reverting strategy reverts with `StrategyWithdrawShortfall`. Admin flows are not downgraded.
- [ ] **Events** — `StrategyWithdrawFailed(strategy, amount, revertData)` is emitted on every failure path; `DebtUpdated` / `StrategyWithdrawn` emitted on successful legs as before.
- [ ] **Unit tests pass** — `tests/M09.StrategyWithdrawResilience.t.sol` (6 cases: happy path, revert-with-no-move, partial-then-revert, over-report mismatch, under-report mismatch, queue-skip property).
- [ ] **No regressions** — existing strategies-module test suite still green; `forceRemoveStrategy` unchanged.

## Out of scope

- Changing strategy asset-valuation / `_getStrategyAssetsSafe` behavior (already try/catch'd upstream).
- Changing deposit hot path — on-deposit failures already fail closed and are the correct semantics.
- Introducing per-strategy circuit breakers. That's a separate hardening track.
