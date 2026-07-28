# Summary of changes for run ee97ddae-55a3-4e4d-9d12-f49fe6730e5e
I audited the Creator payout/gauge subsystem — `CreatorGaugeController.sol`, `CreatorPayoutRouter.sol`, and `CreatorCoinPolicyController.sol` — focusing on access control, accounting, reentrancy, and external-call safety. The full write-up (with concrete exploit paths and remediations for each item) is in `SECURITY_AUDIT.md`.

Key findings:

- **H-1 (High) — `CreatorGaugeController.emergencyWithdraw`:** ShareOFT withdrawal is only blocked when `jackpotReserve > 0`, not when `pendingFees > 0`. In the window where a controller has received fees but not yet distributed (jackpotReserve == 0, pendingFees > 0), the owner can withdraw undistributed lottery/voter/burn fees. Worse, the withdraw decrements `accountedOFTBalance` but not `pendingFees`, so the next `_distributeInternal` runs `accountedOFTBalance -= pendingFees` on a now-smaller value → checked-arithmetic underflow → distribution is permanently bricked (also triggerable by an accidental emergency withdrawal). Fix: guard on `jackpotReserve > 0 || pendingFees > 0` (or only allow withdrawing the unaccounted surplus).

- **M-1 (Medium):** WETH fees are protected from withdrawal while `pendingWETHFees > 0`, but the only drain path is `_processWETHFees`, which reverts on any persistent swap failure — so misconfig/oracle outage can lock WETH permanently. Needs an accounting-consistent escape hatch.
- **M-2 (Medium):** `fallbackMinOutputBps` computes the CreatorCoin min-out as a fraction of the WETH input amount (assumes 1:1 price/decimals), which either bricks fallback swaps or provides no real slippage protection.
- **M-3 (Medium):** The voter-slice `notifyRewards` path credits `totalProtocolEarned` assuming the distributor pulls its approval; if it doesn't, the ShareOFT is left unaccounted and `receiveBridgedFees` re-sweeps it as "bridged fees," double-counting and re-distributing. Use balance-delta accounting / explicit transfer.
- **M-4 (Medium):** Centralization — `payJackpot` can send the whole reserve to an arbitrary address gated only by the owner-settable lottery manager, and the owner can repoint treasuries/oracle/vault/creatorCoin/fee tier with no timelock.
- **L-1/L-2 (Low):** `_sqrtPriceLimitX96` ignores token decimals (bound often clamped/meaningless, protection reduces to amountOutMinimum); unchecked `swapFeeTier` plus stale oracle can silently halt WETH processing (feeds M-1).
- **I-1/I-2 (Info):** standing unlimited approvals in the router; amount-based (not balance-delta) fee accounting would break under a fee-on-transfer/rebasing ShareOFT.

I also noted what is handled well: consistent `nonReentrant` usage and CEI ordering, the bridged-fee watermark, the hardened external-swap path in the router (allowlist + bounded approve/reset + overspend and min-out checks that block output redirection), the two-step ownership handoff in the policy controller, and the chain-id/bps constructor assertions.

The report is committed and pushed as `SECURITY_AUDIT.md`.