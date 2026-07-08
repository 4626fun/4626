# Security Review & Audit

**Scope**

| File | LoC | Purpose |
|------|-----|---------|
| `CreatorOracle.sol` | 1425 | Omnichain price oracle (V4 custom TWAP + V3 TWAP + Chainlink + LayerZero broadcast) |
| `CreatorGaugeController.sol` | 1182 | Per-creator `tradeFeeCollector`; splits ShareOFT / WETH fees into burn / lottery / voter lanes |
| `Registry4626.sol` | 1072 | Registry for 4626 deployments, cross-chain OFT peers, chain/LZ config |
| `CreatorPayoutRouter.sol` | 453 | Routes external-earnings revenue into vault-share burns (V3 path + allowlisted external swaps) |
| `VaultShareBurnStream.sol` | 327 | Owner-less contract that burns vault shares linearly over weekly epochs |
| `LinearVesting4626.sol` | 104 | Minimal linear vesting wallet |
| `CreatorCoinPolicyController.sol` | 80 | Protocol-owned policy controller for CreatorCoin admin actions |

**Methodology.** Manual line-by-line review focused on access control, arithmetic/accounting invariants, reentrancy,
oracle-manipulation and price-integrity, external-call safety, cross-chain message handling, and centralization.
The code already contains many `FIX:` markers from prior audit rounds; this review is a fresh pass and reports
issues that appear to remain.

**Severity key.** Critical = direct loss/theft of funds; High = loss under plausible conditions or protocol
break; Medium = conditional loss / DoS / accounting corruption; Low = limited impact or requires trusted-role
compromise; Informational = hygiene / defense-in-depth.

> Disclaimer: this is a best-effort manual review, not a guarantee of absence of vulnerabilities. It does not cover
> the many external contracts these files depend on (the vault `burnSharesForPriceIncrease`, wrapper `wrap/unwrap`,
> ShareOFT, LayerZero stack, Uniswap V3/V4, Chainlink), whose behaviour is assumed but not provided.

---

## Findings summary

| ID | Severity | Contract | Title |
|----|----------|----------|-------|
| M-1 | Medium | CreatorOracle | `_sequencerIsUp` applies a 2h staleness check to the L2 sequencer feed → fail-closed DoS after normal uptime |
| M-2 | Medium | VaultShareBurnStream | Failed burns are double-counted: `failedBurnAccumulator` shares are also re-queued as "unaccounted" |
| L-1 | Low | CreatorOracle | Sequencer uptime check has no post-recovery grace period |
| L-2 | Low | VaultShareBurnStream | Authorization/recovery are bootstrapped only via `msg.sender == vault`; fragile integration assumption |
| L-3 | Low | CreatorPayoutRouter | `convertViaExternalAndQueue` grants keeper an arbitrary-calldata call to allowlisted targets |
| L-4 | Low | CreatorGaugeController / CreatorPayoutRouter | Owner `emergencyWithdraw` can drain non-protected tokens (centralization) |
| L-5 | Low | LinearVesting4626 | Pre-`seed()` releases use live balance; early release before seeding under-allocates the schedule |
| I-1 | Info | VaultShareBurnStream | `StreamDripped` / event emitted with `burnedNow` even when the burn reverted |
| I-2 | Info | CreatorOracle | `tickToPrice` full-range precision is at the uint256 boundary at extreme ticks |
| I-3 | Info | Registry4626 | `setLzConfig` keys config by `uint16` chainId while all other paths use `uint256` |
| I-4 | Info | LinearVesting4626 | `seed()` reverts with `ZeroDuration()` on an empty-balance seed (wrong error) |
| I-5 | Info | Multiple | Broad owner/keeper powers; document trust model and place behind timelock/multisig |

---

## Medium

### M-1 — `_sequencerIsUp` mis-applies a staleness check to the L2 sequencer uptime feed (fail-closed DoS)

`CreatorOracle._sequencerIsUp()`:

```solidity
(, int256 answer,, uint256 updatedAt,) = IChainlinkFeed(feed).latestRoundData();
if (updatedAt > block.timestamp) return false;
if (block.timestamp - updatedAt > MAX_STALENESS) return false; // MAX_STALENESS = 2 hours
return answer == 0;
```

The Chainlink **L2 Sequencer Uptime feed** only produces a new round when the sequencer *status changes*
(up↔down). During normal operation the sequencer stays up for days/weeks, so `updatedAt` (the timestamp of the
last status transition) is legitimately far in the past. Applying a 2-hour `MAX_STALENESS` bound to it means that
**once the sequencer has been continuously up for more than 2 hours, `_sequencerIsUp()` returns `false`** and the
oracle treats a perfectly healthy chain as "sequencer down".

Impact (only when `sequencerUptimeFeed` is configured — it is optional and zero disables the guard):
- `getEthPrice()` returns `(0,0)`.
- `updateAssetPriceFromTWAP()` reverts `SequencerDown`.
- `_updatePriceFromTWAP()` (auto path) silently returns → prices stop auto-updating.
- `_convertQuoteToUsd18()` reverts `SequencerDown`, breaking `updateAssetPriceFromV3TWAP`.

Net effect: enabling the sequencer guard bricks all price updates a couple of hours after any sequencer state
change, which in turn stalls `CreatorGaugeController` WETH-fee processing (min-out becomes unavailable). This is a
functional / availability bug that fails *closed*, so it degrades liveness rather than causing theft — but it can
freeze the price pipeline indefinitely.

Recommendation: do **not** apply `MAX_STALENESS` to the sequencer feed. Only check the answer (`== 0` up / `== 1`
down) and, per Chainlink's reference implementation, a post-recovery grace period based on `startedAt` (see L-1).
Keep the freshness/heartbeat check for the *price* feeds (`chainlinkFeed`, `quoteUsdFeed`) only, which the code
already does separately in `_readFeedPrice18`.

### M-2 — Failed burns are double-counted between `failedBurnAccumulator` and the "unaccounted" sync path

In `VaultShareBurnStream._drip()`:

```solidity
burnedNow = burnableTotal - burnedActive;
burnedActive = burnableTotal;               // advanced BEFORE the burn is known to succeed
try IOVaultBurn(vault).burnSharesForPriceIncrease(burnedNow) {
} catch {
    failedBurnAccumulator += burnedNow;     // shares recorded as "to recover"
    ...
}
```

When the vault burn reverts (e.g. vault paused), `burnedActive` is still advanced and the shares are recorded in
`failedBurnAccumulator`, **but the shares physically remain in the contract's balance** (nothing was burned). The
"new share" accounting used everywhere else is:

```solidity
uint256 accounted = pendingShares + _remainingActive();   // does NOT include failedBurnAccumulator
if (bal > accounted) _queueSharesAfterRollover(bal - accounted);   // in syncUnaccounted / checkpoint
```

Because `accounted` ignores `failedBurnAccumulator`, the failed-burn shares show up as `bal - accounted > 0` and
the **permissionless** `syncUnaccounted()` / `checkpoint()` re-queue them into `pendingShares` for the next epoch.
The same shares are now tracked twice: once in `failedBurnAccumulator` (vault-only `recoverFailedBurns`) and once as
a fresh queued stream.

Consequences:
- The re-queued stream will burn those shares next epoch (correct once), leaving `failedBurnAccumulator` stale and
  non-decreasing. A later `recoverFailedBurns` then tries to burn shares that no longer exist →
  `burnSharesForPriceIncrease` reverts or over-burns.
- `failedBurnAccumulator` never returns to zero and, under repeated failures, monotonically approaches
  `MAX_FAILED_BURN_ACCUMULATOR (1e24)`, at which point `_drip()` starts reverting — a self-inflicted DoS of the
  whole streaming mechanism.

`checkpoint()` is the routine keeper entrypoint, so this is readily reached during any vault outage.

Recommendation: make the accounting aware of failed burns. Either include `failedBurnAccumulator` in `accounted`
(so those shares are not re-queued), or do not advance `burnedActive` for the failed portion (revert-free by
carrying a separate "pending failed" counter that both the drip and recovery paths consult), and decrement
`failedBurnAccumulator` whenever those shares are burned by any path.

---

## Low

### L-1 — Missing sequencer post-recovery grace period
`_sequencerIsUp()` returns `true` immediately once `answer == 0`, even in the first block after the sequencer
comes back online. Chainlink's reference pattern additionally requires `block.timestamp - startedAt > GRACE_PERIOD`
(≈ 1 hour) to avoid consuming thin/stale prices right after recovery. Add a grace-period check (and fix M-1 in the
same change).

### L-2 — Burn-stream authorization is bootstrapped only through `msg.sender == vault`
`VaultShareBurnStream.setAuthorizedQueuer` and `recoverFailedBurns` require `msg.sender == vault`. The contract is
deliberately owner-less, so the vault contract itself must expose functions that call these. That coupling is not
verifiable from the provided files. If the deployed vault cannot make these calls:
- No queuer can be authorized ⇒ `CreatorPayoutRouter._queueCreatorCoinDeposit` / `_unwrapShareOftAndQueue` revert
  (`queueShares` gated), breaking the whole payout→burn flow.
- `failedBurnAccumulator` can never be recovered (compounds M-2).

Also note `recoverFailedBurns` is *authorized* by `vault` but *executes* the burn as the burn-stream contract
(`this`), which is a different actor than the caller — confirm the vault's `burnSharesForPriceIncrease` burns from
`msg.sender`'s balance (i.e. the stream), not the caller's. Recommend documenting/anchoring these integration
invariants and adding a deployment-time self-test.

### L-3 — `convertViaExternalAndQueue` is an arbitrary call to allowlisted targets
`CreatorPayoutRouter._convertViaExternalAndQueue` performs `swapTarget.call(swapCallData)` with fully
caller-controlled `swapCallData`, after approving `spender` for `amountIn`. It is gated by `onlyOwnerOrKeeper` and
owner-managed `approvedExternalSwapTargets` / `approvedExternalSwapSpenders`, and bounded by the overspend check
and `minOut > 0` (output must arrive as ShareOFT). This meaningfully limits abuse, but a compromised **keeper**
can still repeatedly route the router's `tokenIn` balances through approved targets. Keep the target/spender
allowlist minimal (canonical routers only), never approve token contracts or the vault/wrapper as targets, and
consider a per-token/per-window spend cap. Treat the keeper key as privileged.

### L-4 — Owner `emergencyWithdraw` can drain non-protected assets
`CreatorGaugeController.emergencyWithdraw` protects `shareOFT` only while `jackpotReserve > 0`; the owner can still
withdraw vault shares, WETH, creator coin, etc. `CreatorPayoutRouter.emergencyWithdraw` protects `creatorCoin` and
`shareOFT` but nothing else. These are by design ("emergency") but represent owner-drain centralization of
in-flight fee balances. Place owner behind a timelock/multisig and document.

### L-5 — Vesting pre-`seed()` behaviour
`LinearVesting4626.vestedAmount` uses live balance (`token.balanceOf + released`) until `seed()` is called. If
`release()` is invoked before `seed()`, tokens vest against the live balance, and a subsequent `seed()` records
`totalAllocation = remaining balance`, permanently dropping the already-released portion from the schedule
denominator. Enforce that `seed()` happens (atomically with funding) before any release, or compute
`totalAllocation` as `balance + released` inside `seed()`.

---

## Informational

- **I-1** `VaultShareBurnStream._drip` emits `StreamDripped(..., burnedNow, ...)` and `StreamCompleted` even when
  the underlying burn reverted and was diverted to `failedBurnAccumulator`. Off-chain monitors will over-report
  burned amounts. Emit a distinct signal (there is already `BurnFailed`) and/or exclude failed amounts from the
  "burned" fields.
- **I-2** `CreatorOracle.tickToPrice` / `_getQuoteAtTick` full-precision paths sit at the uint256 boundary at the
  extreme sqrt-ratio (near `MAX_SQRT_RATIO`), mirroring Uniswap's OracleLibrary. Real creator/ETH prices are far
  from the tick extremes, so this is not exploitable in practice; noted for completeness.
- **I-3** `Registry4626.setLzConfig(uint16 _chainId, ...)` narrows the chain id to `uint16` while `lzConfigs`,
  `chainIdToEid`, etc. are `uint256`/consistently wider elsewhere. Chains with id > 65535 cannot be configured via
  this function. Use `uint256` for consistency.
- **I-4** `LinearVesting4626.seed()` reverts with `ZeroDuration()` when balance is zero — a misleading error;
  introduce a dedicated `NothingToSeed()`/`ZeroBalance()` error.
- **I-5** General: owner and keeper roles across the suite have broad powers (oracle price bootstrap and updater
  set, gauge treasury/threshold config, registry factory authorization, router swap allowlists, emergency
  withdrawals). Recommend timelock + multisig for owner, documented keeper scope, and event monitoring.

---

## Positive observations

The codebase shows substantial prior hardening, which held up under this review:

- **Oracle price integrity:** owner-only, one-shot, bounded `initializeAssetPrice`; every subsequent path
  (`updateAssetPrice`, `updateAssetPriceFromTWAP`, `updateAssetPriceFromV3TWAP`, `_lzReceive`) enforces
  `MAX_PRICE_DEVIATION`; robust `_readFeedPrice18` (staleness, `answeredInRound` regression, feed decimals,
  reverting feeds); truncated-tick capping with auto-tuning for manipulation resistance.
- **Cross-chain safety:** `_lzReceive` accepts only `origin.srcEid == BASE_EID`, clamps future timestamps, and
  drops out-of-order updates; the buggy equal-split broadcast was replaced by a per-destination-fee variant with
  refund of the remainder.
- **Reentrancy:** `nonReentrant` on all state-mutating external entrypoints of the router, gauge and burn-stream;
  effects-before-interactions in the burn-stream recovery path and the vesting release.
- **Approvals:** consistent `forceApprove(..., 0)` reset around external swaps; `SafeERC20` throughout.
- **Burn-stream custody:** owner-less, no withdrawal function — shares can only leave via burning (modulo M-2's
  accounting concern).
- **Registry reverse-mapping hygiene:** conditional deletes guard against clobbering another token's mapping on
  address reuse; canonical-wallet 1:1 enforcement prevents attribution hijack; pagination provided for the
  unbounded token list.
- **MEV hardening in the gauge:** oracle-derived `minOut` plus a derived `sqrtPriceLimitX96`, real swap deadline
  window, and default-off permissionless WETH auto-processing.

---

## Note on the Lean project

The repository also contains a Lean 4 / Mathlib scaffold (`RequestProject/Main.lean`) that is currently an empty
stub with no specifications or theorems. No formal properties of the Solidity contracts are stated or proven there.
If desired, the invariants implicated above (e.g. the burn-stream share-conservation invariant
`balance == pendingShares + remainingActive + failedBurnAccumulator + burnedSucceeded`, or the fee-split
`burnShareBps + lotteryShareBps + creatorShareBps + protocolShareBps == MAX_BPS`) are good candidates for
formalization; this audit does not include such formalization.
