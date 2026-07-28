# Security Re-Audit — Agent Revenue / Gauge Lane

**Date:** 2026-07-08
**Scope (commit `14aed93`):**
`AgentGaugeController.sol`, `AgentRevenueRouter.sol`, `AgentOVaultTaxAdapter.sol`,
`AgentRevenuePolicyController.sol`
**Objective:** Verify that the previously reported High/Medium findings were remediated,
and report only *residual* or *new* issues that have a concrete, demonstrable exploit path.

---

## 1. Status of previously reported findings

| ID | Description | Remediation present | Verdict |
|----|-------------|---------------------|---------|
| **H-03** | Swap used `deadline = block.timestamp` (no deadline protection on L2). | `_processWETHFees` now uses `deadline: block.timestamp + 2 minutes`, and the swap also enforces `amountOutMinimum` + a derived `sqrtPriceLimitX96`, with a post-swap `wethBefore - wethAfter == wethAmount` full-fill check. | **Fixed.** |
| **M-02** | `payJackpot` could under/over-pay when reserve was insufficient. | `payJackpot` now reverts with `InsufficientJackpot` when `amount > jackpotReserve`, and decrements both `jackpotReserve` and `accountedOFTBalance`. | **Fixed.** |
| **AUDIT-2026-07-01-M01** | `emergencyWithdraw` could drain the ShareOFT jackpot custody. | `emergencyWithdraw` now reverts (`JackpotReserveProtected`) for `shareOFT` while `jackpotReserve > 0 || pendingFees > 0`, and blocks `WETH` while `pendingWETHFees > 0`. | **Partially fixed — see R-1.** The specific path is blocked, but an equivalent owner drain path remains. |
| **G-11** | Bridged-fee sweep could vacuum jackpot ShareOFT into `pendingFees`. | `accountedOFTBalance` now tracks expected OFT holdings; `receiveBridgedFees` only sweeps `balance - accountedOFTBalance`. Accounting is consistent across intake/distribute/payout paths. | **Fixed.** |
| **G-12** | No fallback slippage floor when oracle unavailable. | `fallbackMinOutputBps` state + `setFallbackMinOutputBps` setter added. | **Ineffective — see R-2** (variable is never read; behaviour is unchanged fail-closed). |
| **G-19** | Force distributions were unobservable. | `ForceDistributed` event added and emitted by `forceDistribute`. | **Fixed.** |
| **G-24** | Fee-split constants could drift from `MAX_BPS`. | Constructor asserts `burn+lottery+treasury+protocol == MAX_BPS`. | **Fixed.** |
| **L-03 (4626-351)** | Hardcoded Base-only WETH/router addresses would brick on other chains. | Constructor asserts `block.chainid == 8453`. | **Fixed.** |

The `_calculateMinOutput` oracle path is genuinely fail-closed (returns `0` → `MinOutputUnavailable`
revert) on stale/absent oracle, so WETH processing cannot proceed without live slippage protection.
This is correct.

---

## 2. Residual / new issues with concrete exploitability

### R-1 (Medium) — M01 remediation is incomplete: owner can still drain the jackpot reserve via `setLotteryManager` → `payJackpot`

The M01 fix blocks jackpot exfiltration through `emergencyWithdraw`, but the reserve remains fully
owner-drainable through the lottery-payout path, because the payout authority is an owner-settable
address with no timelock or allowlist:

```solidity
function setLotteryManager(address _lotteryManager) external onlyOwner {   // line 869
    if (_lotteryManager == address(0)) revert ZeroAddress();
    lotteryManager = ILotteryManager4626(_lotteryManager);
}

function payJackpot(address winner, uint256 amount) external nonReentrant { // line 812
    if (msg.sender != address(lotteryManager)) revert OnlyLotteryManager();
    if (amount > jackpotReserve) revert InsufficientJackpot();
    if (winner == address(0)) revert ZeroAddress();
    jackpotReserve -= amount;
    accountedOFTBalance -= amount;
    shareOFT.safeTransfer(winner, amount);
}
```

**Concrete exploit (owner / compromised owner key):**
1. `setLotteryManager(attackerEOA)` (owner-only, no delay).
2. From `attackerEOA`: `payJackpot(attackerEOA, jackpotReserve)`.

The entire ShareOFT jackpot reserve is transferred out in one block, achieving exactly the outcome
that the `emergencyWithdraw`/`JackpotReserveProtected` fix was meant to prevent. The
`emergencyWithdraw` guard is therefore only cosmetic against a malicious/compromised owner.

**Impact:** Loss of all custodied jackpot ShareOFT (user-owed lottery reserve).
**Likelihood driver:** single-key owner compromise, or a rug by the owner.
**Recommendation:** Put `setLotteryManager` behind a timelock and/or restrict `payJackpot`
recipients (e.g. only the configured lottery manager may receive, or enforce that a payout is
matched by a lottery draw). If owner is intended to be a multisig/timelock, document the trust
assumption explicitly and note that jackpot custody is fully owner-controlled — because right now
the on-chain protection implies otherwise.

> Note: the same owner-set-then-route pattern applies to `setWrapper`/`setVault`: a malicious
> wrapper receives a `forceApprove` allowance in `_burnShareOftSlice`/`_wrapVaultSharesToShareOft`
> and could pull the approved slice. This is bounded per-distribution (the burn/voter slices) and
> is strictly weaker than R-1, but it reinforces that jackpot/fee custody currently rests entirely
> on owner honesty.

### R-2 (Low / Informational) — G-12 remediation is dead code

`fallbackMinOutputBps` is declared (line 138) and has an owner setter (line 966), but it is **never
read**. `_calculateMinOutput` still returns `0` whenever the oracle is disabled/stale/reverting:

```solidity
if (!useOracleSlippage || address(oracle) == address(0)) {
    return 0;   // fallbackMinOutputBps ignored
}
```

The runtime behaviour (fail-closed) is safe, so there is **no exploit** here — but the documented
G-12 "fallback minimum output" does nothing. Either wire `fallbackMinOutputBps` into
`_calculateMinOutput` deliberately (careful: WETH input units vs. agent-token output units — a naive
`amountIn * bps` floor under-protects by orders of magnitude, which is exactly why the current code
comments warn against it), or remove the dead state/setter to avoid a false sense of protection.

### R-3 (Low) — leftover ShareOFT allowance to `voterRewardsDistributor` on partial spend

In `_routeVoterShareOft`, the success branch does `forceApprove(distributor, toVoters)` before
`notifyRewards`, but when the distributor pulls **less** than `toVoters` there is no
`forceApprove(..., 0)` reset (unlike the `catch` branch). A residual allowance
`toVoters - spent` persists between distributions.

**Exploitability:** requires the configured (owner-set, protocol-controlled) distributor to be
malicious/compromised; it could later pull up to the residual allowance of ShareOFT. Bounded and
low, but trivially removable by resetting the allowance to `0` after the call in the success path.

### R-4 (Low) — dust-ETH griefing of WETH emergency withdrawal

`receive()` wraps any incoming ETH and increments `pendingWETHFees`; `emergencyWithdraw` reverts on
`WETH` while `pendingWETHFees > 0`. Anyone can send 1 wei to keep `pendingWETHFees > 0` and block
WETH emergency withdrawal. It is not a permanent lock (owner can `processWETHFees()` to clear it,
subject to oracle availability), so impact is limited to temporary griefing. Consider allowing WETH
emergency withdrawal of the balance in excess of `pendingWETHFees`.

### Minor / non-security notes
- `emergencyWithdraw`: the second `if (pendingFees > 0) revert PendingOftFeesProtected();` (inside
  the `token == shareOFT` block) is unreachable — the combined guard above already reverts when
  `pendingFees > 0`. Dead branch; harmless.
- `AgentRevenueRouter.emergencyWithdraw` correctly protects `agentToken`/`shareOFT`/`weth`; the
  external-swap path (`_convertViaExternalAndQueue`) is well-guarded (allowlisted target+spender,
  `_requireSafeExternalSwapAddress` excludes protocol addresses, approval reset to 0, and an
  overspend check on `tokenIn`). No exploitable issue found there.
- `AgentOVaultTaxAdapter` and `AgentRevenuePolicyController` are accounting/config only; no
  fund-custody issues found.

---

## 3. Summary

- **All previously reported High findings (H-03) and Medium findings (M-02) are fixed.**
- **AUDIT-2026-07-01-M01 is only partially remediated:** the `emergencyWithdraw` vector is closed,
  but the jackpot reserve remains fully owner-drainable via `setLotteryManager` + `payJackpot`
  (**R-1, Medium**, concrete two-step exploit). This is the one residual finding that materially
  contradicts the intended security property and should be addressed before relying on the on-chain
  jackpot-custody guarantee.
- Remaining items (R-2 dead G-12 fallback, R-3 allowance reset, R-4 dust griefing, plus a dead
  branch) are Low/Informational with no independent High/Medium exploit.
