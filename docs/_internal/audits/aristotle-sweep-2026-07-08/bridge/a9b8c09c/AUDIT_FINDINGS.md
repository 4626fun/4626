# Security Audit — `SolanaBridgeAdapter.sol` (remaining sweep)

Scope: `SolanaBridgeAdapter.sol`, the shared Base↔Solana bridge adapter that
registers bridge tokens and routes bridge + CCA / lottery / fee actions on behalf
of Solana users via their deterministic Twin contracts.

The contract already carries inline `// FIX:` annotations for a previous round of
findings (H-1, H-2, H-06, M-1, M-6, I-2, L-1, L-4). This sweep covers what
remained open. Findings marked **[FIXED]** were patched inline in this pass
(look for the matching `// FIX:` tag in the source); findings marked
**[RECOMMENDATION]** are documented here with the suggested change but left
un-patched because a safe fix depends on external-contract behaviour that cannot
be confirmed from this file alone.

Severity uses the usual impact×likelihood scale (High / Medium / Low / Info).

---

## H-3 — Missing bid-ownership binding on CCA claim/exit (cross-Twin bid manipulation) **[FIXED]**

**Location:** `submitCCABidFromSolana`, `claimCCATokensFromSolana`,
`exitCCABidFromSolana`.

**Issue.** Every CCA bid is *submitted to the auction by this adapter*
(`ICCAuction(ccaAuction).submitBid{value: msg.value}(..., twinContract, ...)`),
so from the auction's point of view the caller is always the single adapter
address — the auction cannot distinguish between different users' Twins.

`claimCCATokensFromSolana` and `exitCCABidFromSolana` guard only with
`onlyTwin(solanaPubkey)` (caller is *some* valid Twin) plus the
`allowedCcaAuctions` check. Neither verifies that `bidId` was created by the
calling Twin. Consequently:

- An attacker who controls any valid Twin (i.e. their own Solana pubkey) can call
  `exitCCABidFromSolana(theirPubkey, auction, victimBidId)` or
  `claimCCATokensFromSolana(theirPubkey, auction, victimBidId)` for a bid owned by
  a different Twin.
- Because the auction sees the same adapter as the original submitter, an
  auction that authorises exit/claim by "submitter == msg.sender" (or that does
  not re-check ownership at all) will let the attacker force-exit or force-claim a
  victim's bid — griefing (loss of auction position, forced early exit / MEV) and,
  if the auction refunds to `msg.sender` (the adapter) rather than to the stored
  owner, ETH misdirection / funds stuck in the adapter.
- Conversely, an auction that authorises strictly by stored `owner == msg.sender`
  would make *every* legitimate claim/exit revert (adapter ≠ Twin) — a
  functional break. Either way the authorization must live in the adapter.

**Fix (applied).** Track `mapping(address auction => mapping(uint256 bidId => address twin)) public ccaBidOwner`,
set it to the submitting Twin in `submitCCABidFromSolana`, and require
`ccaBidOwner[auction][bidId] == msg.sender` in both `claimCCATokensFromSolana`
and `exitCCABidFromSolana` (new `NotBidOwner` error).

---

## M-2 — Batch-wide DoS via overflow in Solana-decimals scale-up **[FIXED]**

**Location:** `processLotteryEntryFromSolana`.

**Issue.** The per-entry `processSwapLottery` call is wrapped in `try/catch` so one
bad entry does not brick the batch (prior FIX: H-1). However the decimals scaling
that precedes it is **outside** the try/catch:

```solidity
amount18 = entry.amountSolanaUnits * (10 ** (baseDecimals - solDecimals));
```

A single entry with a large `amountSolanaUnits` and a wide decimal gap overflows
`uint256`, which reverts the *entire* transaction (all other entries in the batch
included) — defeating the isolation the try/catch was meant to provide. This is a
DoS on the keeper relay path.

**Fix (applied).** Compute `factor` first and `continue` (skip the entry) when
`entry.amountSolanaUnits > type(uint256).max / factor`, so a poisoned entry is
dropped instead of reverting the whole batch.

---

## M-3 — Excess ETH not refunded after CCA bid submission **[RECOMMENDATION]**

**Location:** `submitCCABidFromSolana` (and, by analogy, the `bridge*` paths that
forward `msg.value`).

**Issue.** `submitCCABidFromSolana` forwards the full `msg.value` to
`ICCAuction.submitBid`. If the auction consumes less than `msg.value` (partial
fill, price rounding) and refunds the remainder to `msg.sender`, that remainder is
returned to *the adapter*, not to the user's Twin. It then sits in the adapter and
is only recoverable by the owner via `emergencyWithdraw` — effectively a user
fund loss.

**Recommended fix.** Snapshot `address(this).balance` before the call and refund
any positive delta to `msg.sender` (the Twin) after it, e.g.

```solidity
uint256 balBefore = address(this).balance - msg.value;
bidId = ICCAuction(ccaAuction).submitBid{value: msg.value}(...);
uint256 refund = address(this).balance - balBefore;
if (refund > 0) {
    (bool ok, ) = msg.sender.call{value: refund}("");
    require(ok, "refund failed");
}
```

Left un-patched because whether the auction refunds at all, and to whom, cannot be
confirmed from this file; applying a naive `address(this).balance` sweep could
misattribute unrelated ETH. Confirm auction semantics before implementing.

---

## L-2 — No swap deadline; residual router/bridge allowance **[RECOMMENDATION]**

**Location:** `buyAndEnterLottery`, `buyAndEnterLotteryWithETH`,
`_prepareBridgeTransfer`, `receiveFeeFromSolana`.

- The Uniswap V4 swaps rely solely on `amountOutMinimum` for protection and pass
  no deadline (the router interface used here has none). A relayed/queued tx can
  execute much later at a stale but still-`amountOutMin`-satisfying price. If the
  integrated router supports a deadline, thread one through.
- `forceApprove(spender, amount)` is used before each external pull. If a
  downstream (router / bridge / gauge) pulls *less* than approved, a non-zero
  residual allowance remains. Standard exact-input routers pull the full amount,
  so impact is low, but resetting the allowance to `0` after the call
  (`forceApprove(spender, 0)`) removes the lingering approval on the adapter.

Severity Low: `amountOutMin` provides the primary economic guard and the adapter
holds no idle balances between calls.

---

## L-3 — Fee-on-transfer / rebasing lane tokens mis-accounted **[RECOMMENDATION]**

**Location:** `depositFromSolana`, `receiveFeeFromSolana`,
`buyAndEnterLottery`, `_prepareBridgeTransfer`.

Amounts are taken as the caller-supplied `amount` and then re-used verbatim for
`deposit` / `forceApprove` / `bridgeToken`, without measuring the balance actually
received. For a fee-on-transfer or rebasing token the received amount is smaller,
so the subsequent step over-states the amount and reverts (DoS) or, in edge cases,
approves more than held. If such tokens can ever be registered, measure
`balanceAfter - balanceBefore` and use that. Low likelihood given the intended
4626 asset set, but worth an explicit registration-time guard or a documented
assumption that only standard ERC20s are supported.

---

## Info

- **I-A — `deployWrappedToken` decimals trust.** Base and Solana decimals are both
  set to the caller-supplied `decimals` and assumed to match the token the factory
  deploys. If the factory could deploy with different decimals the scaling in
  `processLotteryEntryFromSolana` / `_toRemoteAmountExact` would be off. Consider
  reading decimals back from the deployed token via `IERC20Metadata`.
- **I-B — `bridgeSOLToSolana` hardcodes 9-decimal (lamport) conversion** and does
  not go through the registration/`_toRemoteAmountExact` path. Correct only while
  `SOL_ON_BASE` is exactly 9 decimals; documented, but brittle if the wrapped-SOL
  representation ever changes.
- **I-C — `receiveFeeFromSolana` has no replay guard** (unlike the lottery relay).
  This is acceptable: it moves *real* ShareOFT tokens out of the keeper Twin via
  `transferFrom`, so a "replay" simply forwards tokens the keeper actually holds
  and cannot mint value from nothing. No change recommended; noted for
  completeness.
- **I-D — Centralization.** `emergencyWithdraw`, registry/keeper/lottery-manager
  setters, and CCA allow-listing are all `onlyOwner`. `emergencyWithdraw` can move
  any token balance. This is the expected trusted-owner model; ensure the owner is
  a timelock/multisig.

---

## Summary

| ID  | Severity | Status          | Title |
|-----|----------|-----------------|-------|
| H-3 | High     | Fixed inline    | Missing CCA bid-ownership binding on claim/exit |
| M-2 | Medium   | Fixed inline    | Batch-wide DoS via overflow in decimals scale-up |
| M-3 | Medium   | Recommendation  | Excess ETH not refunded after CCA bid submission |
| L-2 | Low      | Recommendation  | No swap deadline; residual allowances |
| L-3 | Low      | Recommendation  | Fee-on-transfer / rebasing token mis-accounting |
| I-A..I-D | Info | Noted          | Wrapped-token decimals, SOL conversion, replay, centralization |

The two inline fixes (H-3, M-2) are self-contained and do not change any external
interface. The recommendations (M-3, L-2, L-3) require confirming behaviour of the
external CCA auction / router / token set before implementing and are therefore
documented rather than force-applied.
