# M-08 Acceptance Criteria — Wrapper Cooldown Bypass via ShareOFT Transfer

**Finding:** 4626-419  
**Severity:** Medium  
**Files:** `contracts/vault/CreatorOVaultWrapper.sol`, `contracts/utilities/messaging/CreatorShareOFT.sol`  
**Base SHA:** `43746e1ced400e60e00c10c527939f250db23896`

## Summary

The `CreatorOVaultWrapper` enforces a same-block flash-loan cooldown using `lastWrapperDepositBlock[user]`, but the cooldown was only written when a user interacted with the wrapper directly. Because deposits mint a `CreatorShareOFT` token, a depositor could transfer the ShareOFT to a fresh address in the same block and have the recipient invoke `wrapper.withdraw(...)` / `wrapper.redeem(...)` — bypassing the cooldown entirely.

The fix propagates the cooldown along ShareOFT transfers:

- `CreatorOVaultWrapper.propagateCooldownOnTransfer(from, to)` — onlyShareOFT, monotonic max assignment of `lastWrapperDepositBlock[to] = max(lastWrapperDepositBlock[to], lastWrapperDepositBlock[from])`. Skips mint (`from == 0`), burn (`to == 0`), and self-transfers.
- `CreatorShareOFT._update(from, to, value)` override — calls `super._update` first, then invokes the wrapper hook inside a try/catch so a hook regression cannot freeze ShareOFT transfers. Emits `WrapperCooldownHookFailed(from, to, revertData)` on failure.
- `CreatorShareOFT.setWrapper(address)` — one-way owner setter that also marks the wrapper as `OperationType.NoFees` in the OFT fee router.

## Acceptance checklist

- [ ] **Direct deposit still records the cooldown** — `deposit`/`mint` caller sees `lastWrapperDepositBlock[msg.sender] == block.number`.
- [ ] **Cooldown propagates on ShareOFT transfer** — after `ShareOFT.transfer(A → B)` in the same block as A's deposit, `lastWrapperDepositBlock[B] >= lastWrapperDepositBlock[A]`, so B's in-block withdraw reverts with `FlashLoanCooldownActive`.
- [ ] **Monotonic max semantics** — if B already had a later deposit block than A, transferring from A to B must NOT lower B's cooldown.
- [ ] **Hook is unauthorized except for the registered ShareOFT** — any other caller to `propagateCooldownOnTransfer` reverts with `CooldownHookUnauthorizedCaller`.
- [ ] **Mint/burn are no-ops** — hook called with `from == 0` or `to == 0` returns without touching state.
- [ ] **Self-transfer is a no-op** — hook called with `from == to` returns without touching state.
- [ ] **Hook failure is non-fatal** — if the hook call reverts, ShareOFT transfer still succeeds and emits `WrapperCooldownHookFailed`.
- [ ] **ShareOFT fee routing** — after `setWrapper`, the wrapper address is registered as `OperationType.NoFees`, so wrapper interactions do not pay OFT fees on the cross-chain path.
- [ ] **Events** — `CooldownPropagated(from, to, fromBlock, toBlock)` emitted on every successful propagation; `WrapperSet(oldWrapper, newWrapper)` emitted on setter.
- [ ] **Unit tests pass** — `tests/M08.CooldownPropagation.t.sol` (6 cases: bypass scenario, monotonic propagation, unauthorized caller, mint/burn noop, happy path, self-transfer noop).
- [ ] **No regressions** — existing wrapper test suite still green; ShareOFT OFT base contract tests still green.

## Out of scope

- Cross-chain (LayerZero) cooldown propagation. Because cooldown state lives on one chain, sending ShareOFT via `OFT.send` intrinsically breaks the same-block flash-loan primitive (LZ message delivery spans blocks). No additional work required.
- Changing the cooldown window itself.
