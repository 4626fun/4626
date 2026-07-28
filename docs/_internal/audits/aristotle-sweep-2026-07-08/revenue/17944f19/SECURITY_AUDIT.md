# Security Audit — Creator Payout / Gauge Subsystem

**Scope (this subsystem only):**
- `CreatorGaugeController.sol` (`tradeFeeCollector` — ShareOFT/WETH fee intake, split, burn, jackpot)
- `CreatorPayoutRouter.sol` (external-earnings lane — swap → unwrap → queue burn)
- `CreatorCoinPolicyController.sol` (CreatorCoin admin/ownership policy)

**Focus:** access control, accounting, reentrancy, external-call safety.

**Method:** manual review of control flow, state accounting, external-call surfaces, and
privilege boundaries. External contracts (vault, wrapper, oracle, DEX routers, LayerZero OFT,
lottery/voter distributors) are treated as trust boundaries and their behavior is stated as an
assumption where it matters.

Many prior audit fixes are already present (`FIX:` markers). The findings below are issues that
remain, ordered by severity. Severity uses likelihood × impact; privileged-actor issues are
called out explicitly because the codebase itself invests in in-flight-fund protection, so gaps
in that protection are treated as in-scope rather than "trusted owner, ignore."

---

## Summary of findings

| ID | Severity | Contract | Title |
|----|----------|----------|-------|
| H-1 | High | CreatorGaugeController | `emergencyWithdraw` can drain undistributed ShareOFT fees and permanently brick distribution via accounting desync |
| M-1 | Medium | CreatorGaugeController | WETH fees can become permanently locked (protected from withdrawal, but no forced-exit if swaps always revert) |
| M-2 | Medium | CreatorGaugeController | `fallbackMinOutputBps` assumes a 1:1 WETH↔CreatorCoin unit price, breaking slippage protection |
| M-3 | Medium | CreatorGaugeController | Voter-slice `notifyRewards` accounting assumes the distributor pulls its approval; otherwise ShareOFT is re-swept as "bridged fees" (double count / re-distribution) |
| M-4 | Medium | All | Centralization: single-key control over fee recipients, jackpot payout target, and swap routing (no timelock) |
| L-1 | Low | CreatorGaugeController | `_sqrtPriceLimitX96` ignores token decimals; on-chain price bound is frequently clamped/meaningless |
| L-2 | Low | CreatorGaugeController | Owner-set `swapFeeTier` / stale oracle can silently brick WETH processing (feeds M-1) |
| I-1 | Info | All | Standing unlimited approvals to vault/wrapper/router |
| I-2 | Info | CreatorGaugeController | Fee-on-transfer / rebasing ShareOFT would break `pendingFees`/`accountedOFTBalance` accounting |

---

## H-1 — `emergencyWithdraw` drains undistributed ShareOFT fees and can permanently brick distribution

**Contract:** `CreatorGaugeController.sol`, `emergencyWithdraw` (≈L1168–1191).

**Root cause.** The contract deliberately protects in-flight balances (`jackpotReserve` for
ShareOFT, `pendingWETHFees` for WETH). But for ShareOFT the guard only checks the *jackpot*
slice, not the *pending, not-yet-distributed* fees:

```solidity
if (token == address(shareOFT) && jackpotReserve > 0) revert JackpotReserveProtected();
if (token == address(shareOFT)) {
    if (amount >= accountedOFTBalance) accountedOFTBalance = 0;
    else accountedOFTBalance -= amount;
}
...
IERC20(token).safeTransfer(to, amount);
```

`pendingFees` (ShareOFT already pulled via `receiveFees`/`deposit`/`receiveBridgedFees` and
awaiting `_distribute`) is **not** consulted. `jackpotReserve` is only ever incremented inside
`_distributeInternal`/`_distributeVaultShares`, so a freshly deployed or recently-distributed
controller sits in a window where `jackpotReserve == 0` while `pendingFees > 0`.

**Exploit / failure path.**
1. Fees flow in: `receiveFees(X)` → `pendingFees = X`, `accountedOFTBalance = X`, `jackpotReserve = 0`.
2. Before anyone calls `distribute()`, the owner calls `emergencyWithdraw(shareOFT, X, attacker)`.
   The `jackpotReserve > 0` guard is false, so the transfer succeeds — the pending, distribution-
   bound fees (destined for lottery reserve, voters, and PPS burn) are removed.
3. **Accounting desync / permanent DoS:** the withdraw decrements `accountedOFTBalance` but leaves
   `pendingFees` unchanged. The next `_distributeInternal` executes
   `accountedOFTBalance -= oftAmount` with `oftAmount == pendingFees > accountedOFTBalance`, which
   underflows and reverts (Solidity ≥0.8 checked arithmetic). Because `pendingFees` can only be
   cleared *inside* `_distributeInternal`, and that function now always reverts, **distribution is
   bricked forever** and any subsequently received fees are frozen too. Even a partial withdraw
   (`amount < pendingFees`) triggers the same underflow.

**Impact.** Loss of undistributed protocol/lottery/voter fees and a permanent denial of service on
the core distribution path. Requires the owner key, but it defeats the very in-flight protection
the contract is built around and can also be triggered *accidentally* by a legitimate emergency
withdrawal.

**Remediation.**
- Protect pending fees the same way as the jackpot and WETH lanes:
  ```solidity
  if (token == address(shareOFT) && (jackpotReserve > 0 || pendingFees > 0))
      revert PendingFeesProtected();
  ```
  With that guard, ShareOFT is only withdrawable once `jackpotReserve == 0 && pendingFees == 0`,
  so the `accountedOFTBalance` adjustment block becomes unreachable and cannot desync.
- Alternatively, if emergency withdrawal of surplus ShareOFT must remain possible, only allow the
  *unaccounted* surplus: `amount <= shareOFT.balanceOf(this) - accountedOFTBalance`, and never
  touch `accountedOFTBalance`/`pendingFees`.

---

## M-1 — WETH fees can become permanently locked (no forced exit when swaps always revert)

**Contract:** `CreatorGaugeController.sol`, `_processWETHFees`, `emergencyWithdraw`.

`emergencyWithdraw` reverts on WETH whenever `pendingWETHFees > 0` (the L-4 fix). The *only* way to
drain `pendingWETHFees` is `_processWETHFees`, which performs the WETH→CreatorCoin swap and reverts
if the swap can't complete. There is no alternative exit.

**Failure path.** Any persistent condition that makes the swap revert strands the WETH with no
recovery: a wrong `swapFeeTier` (pool doesn't exist for that tier — see L-2), an oracle that is
permanently stale/reverting with `fallbackMinOutputBps == 0` (→ `minAmountOut == 0` →
`MinOutputUnavailable`), a too-tight/miscomputed `sqrtPriceLimitX96` (see L-1) causing partial fills
that then fail the `wethBefore - wethAfter != wethAmount` check, or the CreatorCoin/pool being
paused/illiquid. Because WETH withdrawal is blocked while `pendingWETHFees > 0`, the funds are
locked indefinitely.

**Impact.** Permanent loss of availability of accrued WETH fees.

**Remediation.** Provide a guarded escape hatch that keeps accounting consistent, e.g. an
owner-only `rescuePendingWETH(uint256 amount, address to)` that decrements `pendingWETHFees` by the
same `amount` it transfers (ideally timelocked / multisig-gated), or allow `emergencyWithdraw` of
WETH once a configurable "processing has been failing" condition holds. The key invariant: any WETH
that leaves must also reduce `pendingWETHFees` so the state cannot desync (the mirror of H-1).

---

## M-2 — `fallbackMinOutputBps` treats WETH and CreatorCoin as 1:1

**Contract:** `CreatorGaugeController.sol`, `_calculateMinOutput`.

```solidity
if (!useOracleSlippage || address(oracle) == address(0)) {
    if (fallbackMinOutputBps > 0) return (wethAmount * fallbackMinOutputBps) / MAX_BPS;
    return 0;
}
```

The fallback computes the minimum *CreatorCoin* output as a fraction of the *WETH* input amount,
i.e. it assumes 1 WETH ≈ 1 CreatorCoin (and identical decimals). CreatorCoins typically trade far
below 1 WETH, so:
- If CreatorCoin ≪ WETH (the normal case), `minOut` is set absurdly high and every fallback swap
  reverts — feeding the lock condition in M-1.
- If an operator "tunes" `fallbackMinOutputBps` down far enough to let swaps pass, the resulting
  `minOut` no longer bears any relation to real value, so the fallback provides **no meaningful
  slippage/sandwich protection** while appearing to (the inline comment even describes it as a
  "floor").

**Impact.** Either bricks the fallback path (availability) or gives a false sense of MEV protection
(value loss to sandwiching) when the oracle is down.

**Remediation.** Remove the raw fallback, or express it against a real price. The fallback should
convert `wethAmount` to CreatorCoin units using a price source and *its* decimals before applying
the bps haircut; if no trustworthy price is available, fail closed (return 0) rather than using a
unit-agnostic multiplier. Update the comment to stop describing it as a value floor.

---

## M-3 — Voter-slice accounting assumes `notifyRewards` pulls its approval

**Contract:** `CreatorGaugeController.sol`, `_routeVoterShareOft` (≈L744–775).

```solidity
shareOFT.forceApprove(address(voterRewardsDistributor), toVoters);
try voterRewardsDistributor.notifyRewards(address(vault), address(shareOFT), toVoters) {
    totalProtocolEarned += toVoters;      // success: assumes tokens left the contract
} catch { ... fallback transfer ... }
```

On the success branch the code assumes the distributor pulls `toVoters` ShareOFT via `transferFrom`
(consistent with the pre-approval). If the distributor's `notifyRewards` is a
"record-now, transfer-separately" design (a common pattern) and does **not** pull, the ShareOFT
stays in this contract but is **not** re-added to `accountedOFTBalance` (it was subtracted with
`oftAmount` at the start of `_distributeInternal` and only re-added on the jackpot/fallback paths).

**Consequence.** The leftover ShareOFT is now "unaccounted" relative to `accountedOFTBalance`.
The permissionless `receiveBridgedFees()` computes `balance - accountedOFTBalance` and will sweep
exactly this residue back into `pendingFees`/`totalFeesReceived`, double-counting it and
re-distributing funds that were already credited as `totalProtocolEarned`. The residual approval
also lingers until the distributor eventually pulls.

**Impact.** Corrupted lifetime accounting and unintended re-distribution of voter funds; magnitude
scales with every distribution. Not a direct external theft, but a real accounting-integrity /
value-misrouting bug, and it is reachable permissionlessly via `receiveBridgedFees`.

**Remediation.** Make the transfer explicit and balance-checked instead of relying on the
integration's semantics: measure `shareOFT.balanceOf(this)` before/after the call and only credit
`totalProtocolEarned` by the amount that actually left; or `safeTransfer` the slice to the
distributor and then call a pure `notifyRewards`. Reset the approval to 0 on the success branch too
(the catch branch already does). Document the exact expected distributor interface.

---

## M-4 — Centralization: single-key control over recipients, jackpot payout, and routing

**Contracts:** all three.

Concentrated privileges with no on-chain timelock:
- **`payJackpot`** pays an arbitrary `winner` any `amount ≤ jackpotReserve`, gated only by
  `msg.sender == lotteryManager`. `lotteryManager` is owner-settable (`setLotteryManager`). A
  compromised/malicious lottery manager (or an owner who repoints it) can drain the entire jackpot
  reserve to any address.
- **Owner** can repoint `creatorTreasury`, `protocolTreasury`, `voterRewardsDistributor`,
  `oracle`, `wrapper`, `vault`, `creatorCoin`, and `swapFeeTier`/slippage at will, redirecting fee
  value or altering swap execution. `setCreatorCoin`/`setVault` after the fact can point swaps and
  deposits at attacker-chosen contracts.
- **`CreatorPayoutRouter`**: owner/keeper drive `convertViaExternalAndQueue` with caller-supplied
  calldata to allowlisted targets. The self/vault/wrapper/token allowlist guard (L-3 fix) plus the
  `minOut > 0` / balance-delta checks prevent output theft, but a keeper can still grief within the
  approved DEX set. `CreatorCoinPolicyController` correctly uses a two-step ownership handoff.

**Impact.** These are trust assumptions rather than unauthenticated exploits, but jackpot drain and
fee redirection are high-value actions guarded by single keys.

**Remediation.** Put owner and lottery-manager mutations behind a timelock + multisig; constrain
`payJackpot` (e.g. require the manager to be the immutable/whitelisted lottery contract and bound
per-call/per-epoch amounts); emit and monitor the existing events; consider making
`vault`/`creatorCoin` immutable once set.

---

## L-1 — `_sqrtPriceLimitX96` ignores token decimals

**Contract:** `CreatorGaugeController.sol`, `_sqrtPriceLimitX96`.

The limit price is derived from `minAmountOut / amountIn` in **raw token units** with no decimal
normalization. When WETH (18 dec) and CreatorCoin have different decimals — or whenever the
computed root falls outside `(MIN_SQRT_RATIO, MAX_SQRT_RATIO)` — the function clamps to the pool
bound, i.e. the price limit provides no protection and the swap relies solely on
`amountOutMinimum`. In the opposite direction a miscomputed-too-tight limit causes partial fills
that then revert on the `wethBefore - wethAfter != wethAmount` check (feeds M-1).

**Impact.** The intended second layer of price protection is often inert or counterproductive.
`amountOutMinimum` is still enforced, so this is Low, but the code implies a guarantee it does not
provide.

**Remediation.** Either drop `sqrtPriceLimitX96` and rely on a correctly-priced `amountOutMinimum`,
or compute the limit with proper decimal scaling and validate it against pool token ordering with
tests covering both `tokenIn < tokenOut` orderings and unequal decimals.

---

## L-2 — Owner-set `swapFeeTier` / stale oracle can silently brick WETH processing

**Contract:** `CreatorGaugeController.sol`, `setSwapConfig`, `_processWETHFees`.

`setSwapConfig` accepts any `uint24` fee tier without checking a pool exists; a wrong tier makes
every `_processWETHFees` swap revert. Combined with a stale oracle (`minAmountOut == 0` →
`MinOutputUnavailable`) and `fallbackMinOutputBps == 0`, WETH processing halts. Because WETH cannot
be withdrawn while pending (M-1), the effect escalates from "processing paused" to "funds locked."

**Remediation.** Validate the fee tier against a known set / pool existence; surface a clear
"processing blocked" view; and pair with the M-1 escape hatch so a misconfiguration is recoverable.

---

## I-1 — Standing unlimited approvals

`CreatorPayoutRouter` grants `type(uint256).max` approvals to the vault, wrapper, and (per path) the
V3 router at construction/`setSwapPath`; `CreatorGaugeController` uses bounded `forceApprove` per
call, which is better. Standing max approvals mean a compromise of any approved spender drains the
router's holdings of that token. Prefer per-call bounded approvals reset to 0, or accept the risk
explicitly given these are canonical/trusted contracts.

## I-2 — Fee-on-transfer / rebasing ShareOFT would break accounting

`receiveFees`/`deposit` credit `pendingFees += amount` using the requested amount, not the measured
balance delta. If ShareOFT were ever fee-on-transfer or rebasing, `pendingFees`/`accountedOFTBalance`
would drift from the real balance and distributions would revert or under/over-pay. ShareOFT is a
first-party token so this is informational; if that ever changes, switch to balance-delta accounting
(as the swap paths already do).

---

## Notes on things that are handled well

- All external, state-changing entry points use `nonReentrant`, and `_distributeInternal` follows
  checks-effects-interactions (`pendingFees = 0` before external calls) — reentrancy surface is
  well controlled.
- `receiveBridgedFees` uses an explicit `accountedOFTBalance` watermark so jackpot ShareOFT is not
  swept as bridged fees (subject to the M-3 caveat).
- `CreatorPayoutRouter`'s external-swap path is hardened: allowlisted target+spender, self/custody
  allowlist rejection, bounded approve-then-reset, overspend check, and output measured by
  balance-delta with `minOut > 0`, which blocks output redirection by a compromised keeper.
- `CreatorCoinPolicyController` uses a two-step ownership handoff and validates zero addresses.
- Constructor asserts `block.chainid == 8453` and that fee-split bps sum to `MAX_BPS`.

*This review is a best-effort manual audit of the three in-scope files and does not guarantee the
absence of other issues, particularly in the external contracts treated as trust boundaries.*
