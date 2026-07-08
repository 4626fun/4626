# Fix Review — `LotteryManager4626.sol`

Re-review of the current source against the findings in `AUDIT.md`.
**Short answer: not all of them are fixed.** The two most important issues
(H-1 and M-1) are fixed. Most of the remaining items are either unchanged
documented/centralization trade-offs or minor informational nits; one low
finding got a related partial hardening.

| ID | Severity | Status | Notes |
|----|----------|--------|-------|
| H-1 | High | ✅ Fixed | `unpause()` no longer flushes the queue |
| M-1 | Medium | ✅ Fixed | Staleness clock reset on replay |
| M-2 | Medium | ⚠️ Unchanged (by design) | Timelock still opt-in |
| M-3 | Medium | ❌ Not fixed | Paid path still trusts caller balance |
| M-4 | Medium | ❌ Not fixed (acknowledged) | Relayer still trusted |
| L-1 | Low | ❌ Not fixed | Constructor default still `10500` |
| L-2 | Low | ⚠️ Partial | Now `whenPaused` (CLM-12), core power remains |
| L-3 | Low | ⚠️ Moot | No guard added, but queue is now dead storage |
| L-4 | Low | ❌ Not fixed | `maxWinChance` bound still 20% |
| I-* | Info | ⚠️ Partial | Some events added; gaps remain |

---

## Fixed

### H-1 — `unpause()` gas-DoS — ✅ Fixed
The admin module's `unpause()` (line ~2562) now only calls `_unpause()`; the
unbounded `for` loop over `_deferredVrfRequestIds` is gone. Deferred results are
now settled one per transaction via the owner-only `applyDeferredVrf(requestId)`
(line ~811), each of which runs a single payout. There is no longer any single
transaction that iterates the whole queue, so the contract can no longer be
bricked in the paused state by a large queue. (Confirmed: the only remaining
loop in the file is `batchSetAuthorizedRemoteOFTs`, bounded by caller input.)

*Cleanup nit:* `_deferredVrfRequestIds` is now write-only — it is pushed on
deferral (line ~865) but never read or popped anywhere, so it is dead storage
that only grows. The comment on line ~277 ("drained in bounded pages after
unpause") no longer matches the code, since there is no page-drain function.
Consider removing the array and the comment, or adding the paginated drain the
comment describes.

### M-1 — Deferred wins discarded as stale after a long pause — ✅ Fixed
`applyDeferredVrf` now sets `vrfRequests[requestId].requestTimestamp =
block.timestamp` (line ~822) before re-invoking `_processVRFResult`, so the
grace-period staleness check is measured from replay time rather than the
original pre-pause request time. A pause longer than `vrfResultGracePeriod` no
longer voids randomness that arrived in good time.

---

## Not fixed / unchanged

### M-2 — Centralization — ⚠️ Unchanged (design/ops recommendation)
The boost-source timelock is still opt-in: `setBoostManager` /
`setVe4626GaugeVoting` remain instant until `armBoostSourceTimelock()` is called
(lines ~2290–2312). Owner still controls `pause`/`unpause` and
`emergencyWithdraw`. This is an operational recommendation (arm the timelock,
put the owner behind a multisig), not a code bug — status unchanged.

### M-3 — Paid path trusts caller-supplied share balance — ❌ Not fixed
`processSwapLottery` still takes `buyerCurrentShareBalance` as a parameter and
feeds it into `_calculateTokenUSD`/coverage (lines ~587, 624–626). It was not
switched to an on-chain `balanceOf` read (the AMOE path at line ~733 still does
read on-chain). Impact remains bounded (authorized swap contracts only, capped
at `maxWinChance`), so this is the documented trust boundary.

### M-4 — AMOE relayer trusted — ❌ Not fixed (acknowledged)
`processAmoeEntry` still trusts the single authorized relayer for points→USD.
This is the acknowledged PR1 trust assumption.

### L-1 — Constructor `usdMultiplierBps = 10500` — ❌ Not fixed
The constructor default is still `10500` (line ~533), i.e. odds inflated ~5%
until production calls `setLotteryConfig`. New guard: `setLotteryConfig` now
enforces `10_000 ≤ usdMultiplierBps ≤ 15_000` (line ~2484), but the launch-time
default is unchanged.

### L-2 — `emergencyWithdraw` — ⚠️ Partial (CLM-12)
`emergencyWithdraw` now carries `whenPaused` (line ~2571, "FIX: CLM-12"). This
restricts withdrawals to the paused state, but the owner can still `pause()`
then withdraw, so the underlying centralization concern remains.

### L-3 — `applyDeferredVrf` during pause duplicates queue entries — ⚠️ Moot
No `whenNotPaused` guard was added to `applyDeferredVrf`, so a call during pause
still re-defers and re-pushes. However, because `_deferredVrfRequestIds` is now
dead storage (never iterated), the duplication is harmless and no longer
compounds H-1.

### L-4 — `maxWinChance` bound — ❌ Not fixed
`setLotteryConfig` still allows `_maxWinChance` up to `200_000` PPM = 20%
(line ~2482), above the documented 15% policy cap. The default is `150_000`.

### Informational — ⚠️ Partial
- `setLocalVRFConsumer` now emits `VRFConsumerUpdated` (line ~2196) but still
  accepts `address(0)`.
- `setCallbackGasLimit` now emits `CallbackGasLimitUpdated` (line ~2553) but
  still has no lower bound (0 is accepted).
- `setUseLocalVRF` (line ~2218) still emits no event.
