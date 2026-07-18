# Security Review — 4626 LotteryManager + VRF + AMOE Stack (Job 426)

## Scope & Target

| | |
|---|---|
| **Client target** | LotteryManager4626.sol, LotteryManager4626PricingLib.sol, VRFConsumer4626.sol, LotteryAmoeRouter.sol, ChainlinkVRFIntegratorV2_5.sol — `contracts/shared/lottery/**` of the private monorepo `github.com/wenakita/4626` |
| **Source obtained via** | Client-supplied bundle `https://litter.catbox.moe/i28508.md` (GitHub repo confirmed private/404; per job description, `github.com/wenakita/CreatorVault` explicitly rejected as out of scope) |
| **Content pin** | SHA-256 of fetched bundle: `dbaba19bc1e564817c6f0aaa66954a3f5aa1348117f52686c27c892c025f4178` |
| **Live refs (client-supplied, informational only — not independently verified on-chain in this pass)** | LotteryManager `0xB45E68a5867935a5734E4185977F81c528006650` · VRFConsumer `0x98fb5e0af3120B32E2E03400B6E51d0bde433670` · AmoeRouter `0x630c3769Cf1D80c6cb8cCB7c011f5A76904C4C1e` (Base) |
| **LOC in scope** | ~5,021 across 5 files (4 concrete contracts + 1 library; `LotteryManager4626.sol` also contains a sibling `LotteryManager4626AdminModule`) |
| **Methodology** | Three-phase: Phase 0 context (protocol map + access-control inventory + threat catalog, opus) → Phase 1 breadth (7 ethskills domains, opus) → Phase 2 depth (12 pashov attacker agents, opus, blind to Phase 1) → Phase 3 hybrid reconciliation + coverage gate |
| **Confidence floor** | All findings Low severity and above are reported below; anything below confidence 50 is listed under **Leads** rather than as a scored finding |

**Prior-audit context (disclosure, not a finding):** this codebase carries dozens of inline `FIX:`/audit-tag comments (e.g. `CLM-0x`, `VRFC-0x`, `M-05`, `H-02`) indicating it has already been through prior remediation rounds. This review is a fully independent pass — every finding below was re-derived from this job's own Phase 0 map and Phase 1/2 hunting agents, not extracted from those prior tags.

---

## Reconciliation Summary

**Overlap:** 3 root causes independently found by both Phase 1 and Phase 2 (forwarder-origin trust gap; deferred-VRF-while-paused no-settle; the general cross-chain-no-retry pattern). **Phase-1-only:** 11 items (centralization/timelock cluster, AMOE signature/replay items, ownership hygiene, DoS/loop items). **Phase-2-only:** 9 items (winner-callback atomicity break, `_payNative` gap, grace-period/timeout mismatch, several numerical/trust leads). **Re-examined leads kept:** all Phase-2 leads that named a concrete out-of-scope dependency were kept as leads rather than promoted, per the confidence floor; **demoted:** 3 Phase-2 items rejected under Gate 3 (pure compromised-owner scenarios with no unprivileged amplifier — folded into the Finding 3 centralization cluster instead of standing alone). **Coverage holes closed this pass: 2** (owner-only gas-limit setters `setCallbackGasLimit`/`setCallbackOptions`, and the plain `withdraw()` functions on `VRFConsumer4626`/`ChainlinkVRFIntegratorV2_5` — neither phase had explicitly examined these; targeted re-read in Phase 3 found no issue in either, see Coverage Gate below).

---

## Access-Control Inventory (condensed)

Full per-function table available in the Phase-0 working map; key structure:

- **Delegatecall admin split, not a proxy.** `LotteryManager4626` deploys an immutable sibling `LotteryManager4626AdminModule` in its constructor. ~30 admin setters on main are argument-ignoring stubs that `delegatecall` into the module; the module's copies carry `onlyDelegateCall onlyOwner`. Verified slot-for-slot storage-mirror consistency by 3 independent agents (general/bridges/access-control) — correct today; nothing on-chain enforces it for future edits.
- **Fully unguarded, state-changing, arbitrary-caller entrypoints:** `VRFConsumer4626.retryLocalCallback`, `VRFConsumer4626.updateLocalPrice`, `VRFConsumer4626.fundContract`, `ChainlinkVRFIntegratorV2_5.cleanupExpiredRequests` (capped 256/batch), `LotteryAmoeRouter.submitAmoeEntryZK` (gated by PLONK proof + 3 nullifier maps instead of `msg.sender`) — all confirmed, across both phases, to be guard-by-state in a way that cannot be abused to forge outcomes or grief beyond the caller's own gas.
- **Ownership:** every `owner` across all 4 contracts is single-step (no `Ownable2Step`); Router uses a custom single-step `setOwner`.
- **Timelocks (inconsistent coverage — see Finding 3):** VRF coordinator (2d), local VRF consumer (2d), AMOE relayer on manager (2d), boost manager/gauge voting (24h, one-way "arm" gate), Router verifier/manager (1d) — all instant-while-unset. **No timelock at all** on: `setAuthorizedSwapContract`, `rewardPercentage`/`setLotteryConfig`, `setVRFIntegrator`, or AMOE allowlist/points-ledger root publication.

## Threat Model (condensed)

| Actor | Reach | Gain | Invariant | Status |
|---|---|---|---|---|
| Any address | `retryLocalCallback`, `cleanupExpiredRequests` | timing only | request-state-gated idempotency | **Invariant holds** — confirmed by 3 independent agents |
| Any address w/ valid PLONK proof | `submitAmoeEntryZK` | one entry per proof | nullifier uniqueness + proof soundness | **Invariant holds** on-chain; proof/circuit soundness itself out of scope |
| Authorized swap contract | `processSwapLottery` | inflate win chance via self-report | registry only lists honest contracts | Trust-bounded (by design) |
| Hub ShareOFT forwarder | `receiveRemoteLotteryEntry` | spoof origin, replay entries | forwarder faithfully preserves LZ origin | **Invariant does NOT hold on-chain** — see **Finding 2** |
| AMOE publisher key | `setAllowlistRoot`/`setPointsLedgerRoot` | mint attacker-controlled entries | publisher key integrity + timelock | **No timelock** — see **Finding 3** |
| Owner (any of 4 contracts) | all `onlyOwner` surfaces | redirect trust roots / drain via authorized swap contract + reward% | timelocks + pause-gated emergency withdraw | **Partial** — asymmetric timelock coverage, see **Finding 3** |
| Chainlink VRF coordinator | `rawFulfillRandomWords` | control response timing only | grace-period/timeout fail-closed | **Invariant holds** |
| — (no attacker; ordinary operation) | cross-chain settlement path | legitimate winner's own payout | settlement must be atomic and retryable on failure | **Invariant does NOT hold** — see **Finding 1** |

**Outcome-steering check (client's #1 named concern):** confirmed **safe**. `effectiveWinChancePPM` is snapshotted at VRF-request time and read as a pure storage value at settlement; no external function — including the two boost-source try/catch calls — can mutate a pending request's frozen win chance after the fact. Confirmed independently by the Phase-1 oracles agent and corroborated by Phase-2 agents.

**Oracle fail-closed check (client's other named concern):** confirmed **safe**. `PricingLib.calculateTokenUSD` returns `(0,0,0)` on every failure mode (bad registry/oracle, non-positive price, future timestamp, staleness, deviation breach), which falls below `minSwapAmount` and silently skips the entry — never proceeds on a bad price.

---

## Findings

[88] **1. Cross-chain VRF/winner-callback settlement has no retry path — a revert during settlement permanently and irrecoverably loses that entry, up to and including an already-executed jackpot payout**

`LotteryManager4626._sendWinnerCallback` (L1478) / `_processWin` (L1142) / `ChainlinkVRFIntegratorV2_5._lzReceive` · Confidence: 88 · `[both — phase1: general, dos (P1-M2); phase2: first-principles, flow-gap (independently converged)]`

**Description:** `_processWin` (L1142-1162) pays the winner via `_payoutLocalJackpot` (L1154) and then, if `sourceChainEid != 0`, calls `_sendWinnerCallback` (L1159) with **no try/catch around either call**. `_sendWinnerCallback` calls `_quote(dstEid, payload, options, false)` (L1484) completely unguarded — LayerZero's `_quote` reverts if `peers[dstEid]` is unset for that destination. Because nothing catches this, a revert here unwinds the entire enclosing transaction, **including the jackpot payout that already ran**, despite the code's own comment ("if insufficient gas, silently skip — payout already happened on hub", L1561) asserting the opposite. The forwarder entry path `receiveRemoteLotteryEntry` (L949) can create entries with a `sourceChainEid` the manager was **never given an LZ peer for** — that path never goes through the OApp base `_lzReceive`, so `peers[srcEid]` is never required for entries arriving that way (see Finding 2) — a fully plausible deployment gap, not an attack.

For a **local VRF** win, `VRFConsumer4626`'s try/catch around the manager callback catches the revert, leaving `callbackSent=false` so `retryLocalCallback` can retry — but every retry re-hits the same unset-peer revert, and once `vrfResultGracePeriod` (30 min default) elapses the request is discarded as stale (`StaleVRFResultDiscarded`, in `_processVRFResult` L964) — the win is lost. For a **cross-chain VRF** win, `ChainlinkVRFIntegratorV2_5._lzReceive` sets `request.fulfilled = true` **before** its try/catch around the manager callback and never rolls it back on a caught revert — there is no retry mechanism at all, so the loss is immediate and permanent.

The same root architectural gap independently explains Phase 1's finding that a full deferred-VRF queue (`DeferredVrfQueueFull`, `_pushDeferredVrf` L914) during an extended pause propagates the identical way into the integrator's catch block and is equally unrecoverable — both are instances of "the cross-chain path lacks the retry safety-net the local path has." **Amplification:** if the winning result was deferred during a pause, `_settleDeferredVrfAt` (L931) and its callers have no try/catch either, so one un-sendable cross-chain winner at the FIFO head can jam settlement of the entire deferred queue behind it until the peer is configured.

**Cross-cutting pattern note:** the same bug class — an unguarded `_quote()`/`_lzSend()` call inside a path with no subsequent recovery — also recurs in `VRFConsumer4626._quoteResponseFee`/`_handleCrossChainResponse` (flagged separately by the Phase-1 dos agent as Finding 15 below); a codebase-wide sweep for unguarded `_quote()`/`_lzSend()` calls inside VRF-critical paths is worth doing beyond this review's 5-file scope.

**Recommendation:** wrap the `_quote`/`_lzSend` pair in `_sendWinnerCallback` in a try/catch (e.g. via an external self-call) so a messaging-layer failure can never unwind the payout — emit `WinnerCallbackDropped` instead, mirroring the pattern already used elsewhere in the same function for rate-limit/sponsorship skips. Separately, give the cross-chain path a retry mechanism analogous to `retryLocalCallback` (track callback-delivery success independent of `fulfilled`), and/or avoid reverting inside `_processVRFResult` on deferred-queue-full (drop-and-emit past cap instead of revert).

```diff
- _sendWinnerCallback(sourceChainEid, user, token, localPayout);
+ try this.sendWinnerCallbackExternal(sourceChainEid, user, token, localPayout) {}
+ catch { emit WinnerCallbackDropped(sourceChainEid, user, token, localPayout, uint8(CallbackDropReason.SEND_FAILED)); }
```

---

[78] **2. Forwarder remote-entry path (`receiveRemoteLotteryEntry`) trusts caller-supplied LayerZero origin with no independent peer re-verification, and non-Solana lanes have no message-level replay guard on that path**

`LotteryManager4626.receiveRemoteLotteryEntry` (L949) / `_handleLotteryEntry` (L1199) · Confidence: 78 · `[both — phase1: bridges, access-control, general; phase2: access-control, invariant, periphery, asymmetry, trust-gap — 8 independent agents total, the single most corroborated observation in this audit]`

**Description:** The direct `_lzReceive` path (L1173) cryptographically verifies `authorizedRemoteOFTs[_origin.srcEid][_origin.sender]` (L1180) via the LZ endpoint's own `_origin` struct, and requires `msgType == MSG_TYPE_LOTTERY_ENTRY`. The forwarder path `receiveRemoteLotteryEntry` (L949-956) checks only `authorizedHubShareOftForwarders[msg.sender]` (L953), then forwards caller-supplied `srcEid`/`originSender`/`payload` straight into the shared `_handleLotteryEntry` (L1199), which re-verifies **neither** the peer **nor** the message type. `srcEid`/`originSender` drive the per-origin sponsorship rate-limit key, the Solana-only exactly-once dedup (`_processedRemoteLotterySourceEvents`, only checked when `sourceEventId != 0`, L1237-1242), and the destination of the eventual winner-callback (directly compounding Finding 1 above). Non-Solana lanes have **no message-level replay guard** on this path at all, so a redelivered or duplicated forwarder call can mint repeat entries and repeat VRF-sponsorship spend.

This exact mechanism was independently rediscovered by 8 of the audit's 19 total hunting agents (3 of 7 Phase-1 breadth agents, 5 of 12 Phase-2 depth agents) through entirely different lenses — access control, trust boundaries, execution asymmetry, and the LayerZero-specific bridges checklist all converged on the same finding. Every individual agent called it a LEAD (not a standalone FINDING) because the actual exploit requires the out-of-scope `IShareOFT4626` forwarder to misbehave or be compromised; per the pashov methodology's multi-agent-convergence rule (2+ agents flagging the same area promotes to a FINDING at confidence 75), it is promoted here.

**Recommendation:**
```diff
  function receiveRemoteLotteryEntry(uint32 srcEid, bytes32 originSender, bytes calldata payload) external nonReentrant {
      if (!authorizedHubShareOftForwarders[msg.sender]) revert Unauthorized();
+     if (!authorizedRemoteOFTs[srcEid][originSender]) revert Unauthorized();
      _requireNotPaused();
      _handleLotteryEntry(srcEid, originSender, payload);
  }
```
and add a message-level replay guard for non-Solana payloads (require and consume a non-zero per-message id, the way Solana's `sourceEventId` is consumed today).

---

[Medium, conf ~70] **3. Owner-controlled trust roots have inconsistent timelock coverage; the least-timelocked levers are the most fund-critical ones**

`LotteryManager4626AdminModule.setAuthorizedSwapContract` (L2320) / `setLotteryConfig` (L2888) / `LotteryAmoeRouter.setAllowlistRoot`/`setPointsLedgerRoot` (L321/L336) · `[phase1: access-control (P1-M3, P1-M4) — corroborated by phase2 leads rejected under Gate 3 for naming no unprivileged amplifier, folded in here rather than standing alone]`

**Description:** `setAuthorizedSwapContract` and reward-percentage changes (`setLotteryConfig`, allows up to 100% of reserve) are instant, no timelock. A compromised owner can authorize an attacker-controlled swap contract and set `rewardPercentage=100%` in one step, then have that contract repeatedly call `processSwapLottery` for a self-controlled buyer at the win-chance ceiling (15%), draining jackpot reserves over repeated entries — the 24h boost-source timelock (the code's one investment in this direction) does not cover this path and is itself opt-in (`armBoostSourceTimelock`, one-way, may never be engaged). Separately, `LotteryAmoeRouter`'s allowlist/points-ledger roots — the inputs that gate AMOE fund flow — have **no timelock at all**, unlike verifier/manager changes on the same contract (1-day timelock); a compromised publisher key can publish attacker-authored roots for an unpublished epoch and mint entries up to `MAX_POINTS_AS_USD` ($10k), feeding the same drain path.

Phase 2's independent attacker agents, reasoning blind to Phase 1, converged on the identical underlying pattern from two more angles — both correctly rejected as standalone pashov findings under Gate 3 (they require a compromised/malicious owner acting against documented intent with no unprivileged amplifier named) but corroborating and sharpening this cluster: (a) `setVRFIntegrator` (L2588) has **no timelock at all**, unlike `localVRFConsumer`'s 2-day timelock for the equivalent role on the local path — a swapped-in malicious integrator could supply attacker-chosen `randomWords[0]` and force wins; (b) `rewardPercentage` and `singleVaultJackpotOnly` are read **live at settlement** rather than snapshotted at entry time, so an owner can reshape the magnitude/scope of an already-determined pending win before it settles (most potent on the pause-deferred path, where the pending word is publicly visible in `pendingRandomWord`).

**Recommendation:** put `setAuthorizedSwapContract`, `rewardPercentage` changes, `setVRFIntegrator`, and AMOE root publication behind the same timelock pattern already used for `localVRFConsumer`/boost sources; consider an on-chain cap on `rewardPercentage` well below 100%; snapshot the payout percentage/scope at entry time alongside `effectiveWinChancePPM`.

---

[Low-Medium, conf ~70] **4. `processSwapLottery` never refunds attached `msg.value` on any of its 4 early-return "no entry" paths**

`LotteryManager4626.processSwapLottery` (L648) · Confidence: 70 · `[both — phase1: general, dos (noted); phase2: execution-trace, economic-security, asymmetry, boundary — 4 independent agents plus 2 phase-1 mentions]`

**Description:** `processSwapLottery` is `payable` (used in cross-chain-VRF mode, where the calling swap contract attaches the native LZ fee). Four branches return `0` before the fee is ever touched: unregistered token, inactive token, `swapValueUSD < minSwapAmount` (L678-680), and `!lotteryConfig.isActive` (L682-684). None call `_refundCallerFeeOrRevert`, unlike every skip branch inside `_requestCrossChainVRFWithSource` (L1355, L1359, L1441, L1460, L1470), which refunds on every failure. Concrete trace: caller attaches `0.001 ETH`; the oracle momentarily prices the trade at `$0.50 < MIN_SWAP_USD`; the function returns `0` at L678 and the `0.001 ETH` is retained in the contract, recoverable only by the owner via `emergencyWithdraw` (and only while paused). Reachable under ordinary operation whenever the hub runs in cross-chain-VRF mode — no attacker or admin action required, just an ordinary trade that happens to skip.

**Recommendation:**
```diff
-     if (swapValueUSD < lotteryConfig.minSwapAmount) { return 0; }
+     if (swapValueUSD < lotteryConfig.minSwapAmount) { if (msg.value > 0) _refundCallerFeeOrRevert(msg.value); return 0; }
```
(apply the same pattern to the other 3 early-return branches).

---

[Low, conf 65] **5. `VRFConsumer4626` never overrides `_payNative`, so `relayPendingResponse`'s documented "accept ≥ fee, refund excess" behavior is dead code**

`VRFConsumer4626.relayPendingResponse` (L538) / `_sendResponseToChain` (L581) · Confidence: 65 · `[phase2 only: execution-trace, invariant, math-precision, first-principles, boundary — 5 independent agents]`

**Description:** `relayPendingResponse` explicitly checks `msg.value < fee.nativeFee` (accepting `>=`) and computes an excess refund, per its own `FIX: VRFC-02/VRFC-04` comment. But `LotteryManager4626` and `ChainlinkVRFIntegratorV2_5` both override `_payNative` to accept `msg.value >= _nativeFee`; **`VRFConsumer4626` has no such override** (confirmed by direct grep across all 5 files — only these two other contracts define `_payNative`). `_sendResponseToChain` → `_lzSend` therefore runs LayerZero's default `_payNative`, which reverts unless `msg.value == _nativeFee` exactly. `_quoteResponseFee` additionally buffers the quote by ×1.05, so any relayer sending the buffered quote plus even 1 extra wei reverts before the refund logic runs — the "accept ≥, refund excess" design is unreachable. Severity capped Low because the relayer role is trusted and can always succeed by re-querying `quotePendingResponseFee` and paying the exact amount — no response is ever permanently unrelayable.

**Recommendation:**
```diff
+ function _payNative(uint256 _nativeFee) internal override returns (uint256 nativeFee) {
+     if (msg.value < _nativeFee) revert NotEnoughNative(msg.value);
+     return _nativeFee;
+ }
```

---

[Low-Medium, conf 58] **6. Deferred-VRF settlement while still paused re-enqueues to the FIFO tail instead of settling — misreports progress and can let an owner reorder pending winners**

`LotteryManager4626.processDeferredVrfBatch` (L889) / `_settleDeferredVrfAt` (L931) · Confidence: 58 · `[both — phase1: general, bridges; phase2: first-principles, flow-gap]`

**Description:** `_settleDeferredVrfAt` (L931) clears `hasPendingRandomWord[requestId]` then refreshes `requestTimestamp` and calls `_processVRFResult` (L964) — which, if `paused()` is still true, takes the pause-defer branch again and **re-enqueues the same request to the tail** of the FIFO (`_pushDeferredVrf`, L914) rather than settling it. `processDeferredVrfBatch`'s doc comment claims it works "while paused or unpaused," which is false while paused: it rotates the queue and still increments its returned `processed` count, misleadingly signaling progress. More materially, this defeats the documented anti-cherry-pick guarantee ("H-02: settlement is head-only so owners cannot cherry-pick wins") — an owner can repeatedly call this while paused to rotate an inconvenient head to the back, changing which pending winner settles first once unpaused, relevant when multiple deferred winners draw from the same finite shared jackpot reserve. No direct fund creation/destruction; impact is on settlement fairness/ordering.

**Recommendation:**
```diff
  function processDeferredVrfBatch(uint256 maxCount) external nonReentrant returns (uint256 processed) {
+     require(!paused(), "still paused");
```
(same guard on `applyDeferredVrf`).

---

[Low, contingent] **7. PricingLib hardcodes an 18-decimal token / 1e18 oracle scale, and conflates 1 vault share with 1 underlying lane coin**

`LotteryManager4626PricingLib.calculateTokenUSD` (L43) · `[both — near-universal convergence: 7+ of 19 total agents]`

**Description:** `usd1e18 = FullMath.mulDiv(amount, priceUSD1e18, 1e18)` then `usd1e6 = usd1e18 / 1e12` hardcodes an 18-decimal token and a 1e18-scaled oracle price, with no `decimals()` query anywhere, despite the parameter being documented as "native decimals." A 6-decimal lane token swapping a real $1 would compute `usd1e6 = 0`, silently disabling that lane's entries (fails closed, but as an unintended per-lane DoS rather than by design). Separately, when `tokenIn == shareOFT`, the same lane-coin oracle price is applied to a 4626 *share* amount, implicitly assuming a fixed 1:1 share:asset ratio — if the vault's share price has appreciated or depreciated, coverage/boost sizing is systematically off. Both are contingent on registry configuration (whether any non-18-decimal lane token, non-1e18 oracle, or divergent-share-price vault is ever registered) that cannot be determined from these 5 files alone.

**Recommendation:** query `IERC20Metadata(tokenIn).decimals()` and the oracle's declared scale explicitly, or hard-assert 18-decimals/1e18-scale at registration time; for the ShareOFT-valued-as-coin path, apply the vault's actual exchange rate rather than assuming 1:1.

---

## Additional Findings (Low / Informational)

**8. [Low, phase1 only]** AMOE PLONK proof binds no `block.chainid`/`address(this)` — a proof valid on one deployment could replay on another if the same root/epoch is ever published to more than one router. `LotteryAmoeRouter.sol` public-input vector (`submitAmoeEntryZK`).

**9. [Low, phase1 only]** No `Ownable2Step` anywhere across all 4 contracts; `renounceOwnership()` (unoverridden) would permanently disable pause/unpause, `emergencyWithdraw`, and deferred-VRF flush.

**10. [Low, phase1 only]** Legacy `LotteryAmoeRouter.submitAmoeEntry` performs **no on-chain signature verification at all** — the `signature` parameter is discarded; the only gate is `msg.sender == allowlistPublisher`. Blast radius limited today since this path never reaches `manager.processAmoeEntry`.

**11. [Low, phase1 only]** CEI gap in `submitAmoeEntryZK`: the three replay nullifiers are written *after* the external `verifier.verifyProof` call rather than before; theoretical reentry risk only if the (owner-settable, timelocked) verifier is ever non-`view`/malicious.

**12. [Low, both phases]** Multi-vault jackpot payout truncates a winner's payout to a 128-active-vault/1024-slot window when more active vaults exist than that; the unpaid remainder benefits future winners, not the truncated one (`payoutLocalJackpotInner`). Related: in multi-vault mode, `totalSharesPaid` sums share counts from *different* vault tokens into one scalar carried in the winner-callback — dimensionally meaningless once >1 token is involved, currently cosmetic only (real per-vault transfers are correct) but would misvalue any downstream consumer that treats it as a single-token amount.

**13. [Low, phase2 only]** Cross-chain VRF grace-period (manager, 30 min default) and request-timeout (integrator, 1h default) are independently configurable and not coupled — a response landing in the gap between them is relayed by the integrator but discarded as stale by the manager, permanently losing an already-paid-for entry with no refund.

**14. [Low, phase1 only]** An extended pause beyond `vrfResultGracePeriod` causes in-flight VRF results to be discarded as stale *before* they ever reach the deferred queue — fail-closed but a silent, permanent entry loss, compounding Finding 1's cross-chain case.

**15. [Low, phase1 only]** `VRFConsumer4626._quoteResponseFee`'s un-try/catch'd `_quote()` call inside the Chainlink VRF fulfillment callback (`rawFulfillRandomWords` → `_handleCrossChainResponse`) can revert and permanently lose randomness if the LZ endpoint quote fails — the same unguarded-`_quote()` bug class as Finding 1, at a second site.

**16. [Low, phase1 only]** Returndata-bombing/OOG exposure in the payout loop's per-vault `try/catch` calls and the unwrapped entry-path `IERC20(shareOFT).balanceOf` call — requires a compromised/misconfigured *registered* (trusted) gauge or share token.

**17. [Informational, phase2 only]** Cross-chain VRF request key omits the integrator's identity (`_crossChainVrfKey(sequence)`) — an owner `setVRFIntegrator` rotation with unsettled in-flight requests could, on a low-probability sequence-band collision, overwrite another user's pending entry.

**18. [Informational, phase2 only]** Solana-lane entries are marked "consumed" even when skipped for a transient reason (sponsorship budget exhausted, rate-limited) — the user already paid/burned on the source chain but the entry can never be retried; the code comment acknowledges this as an accepted tradeoff.

**19. [Informational, phase2 only]** Jackpot share payout has no post-transfer balance check — a fee-on-transfer or partially-honoring gauge/share token would silently under-pay while stats/callback report the full requested amount.

**20. [Informational, phase2 only]** `getTokenLotteryStats` (view) reads a different reserve getter (`getJackpotReserve()`) than the payout path (`availableJackpotReserve()`) — displayed jackpot size can diverge from what a win would actually pay; view-only, no on-chain decision depends on it.

**21. [Informational, phase2 only]** Two independently-maintained copies of `_refreshSponsorshipEpoch` (main contract vs. delegatecalled AdminModule) have already drifted — the module copy initializes `epochStart` on first use, the main copy doesn't — currently benign only because the constructor always seeds a nonzero `epochStart`.

**22. [Informational, phase2 only]** `_coverageShareBalance` may size a remote buyer's boost against hub-chain balances/total-supply rather than the origin chain's, for forwarder-based entries where `tokenIn` happens to have code at a CREATE2-parity address on the hub — direction/magnitude depends on out-of-scope registry/ShareOFT wiring.

**23. [Informational, both]** Miscellaneous: `rawFulfillRandomWords` reads `randomWords[0]` without a length check (trusted-coordinator-only); mixed pragma versions (`0.8.30` main vs `^0.8.20` others) — verify PUSH0 support on every deployment target; `getBoostSourceTimelockState` callable directly on the inert module address returns empty storage rather than main's; `_popDeferredVrfHead`'s O(n)-per-pop array shift is gas-inefficient but always makes forward progress.

## Findings Confirmed Safe (explicitly checked, no issue — listed per the coverage gate, not as findings)

- Win/lose outcome is not steerable via mutable shared state (VRF word-informed-steering pattern class ruled out).
- Oracle pricing fails closed on every failure mode.
- Boost-source try/catch fails toward the house (odds move down, never up) on revert.
- Delegatecall admin/module storage mirror is currently slot-correct (verified by 3 independent agents).
- AMOE nullifier ordering and rollback-on-decline are correct.
- `retryLocalCallback`/`cleanupExpiredRequests` cannot be abused to grief or pre-empt a legitimate result.
- Jackpot multi-vault payout loop is gas-bounded regardless of registry size (subject to Finding 12's completeness caveat).
- "Instant while unset" bootstrap role slots are not front-runnable (every bootstrap setter is itself `onlyOwner`).
- Owner-only `withdraw()` on `VRFConsumer4626`/`ChainlinkVRFIntegratorV2_5`, and owner-only `setCallbackGasLimit`/`setCallbackOptions`: **re-examined in this Phase-3 pass** (neither hunting phase had explicitly touched them) — both are standard owner-only functions with no third-party reachability; a misconfigured callback gas limit can only cause the *remote* side's message execution to under-run gas (out of scope, does not revert the hub-side payout per Finding 1's actual mechanism, which is specifically the `_quote()` call, not gas exhaustion). No issue found.

## Coverage Gate

- **Entrypoints:** ~140 external/public function declarations found via grep across the 5 files (interfaces included); every state-changing external/public function in the 4 concrete contracts is covered by the Phase-0 access-control inventory and is either addressed by a finding above or listed in "Confirmed Safe."
- **Threat-catalog rows:** 8 rows in the Phase-0 catalog, all 8 answered above (either by a finding or "invariant holds").
- **Coverage holes closed this pass: 2** — `setCallbackGasLimit`/`setCallbackOptions` and the plain `withdraw()` functions, neither examined by name in Phase 1 or Phase 2; both re-read in Phase 3 with no issue found (see above).
- Confidence floor used: Low and above reported as findings; below-50-confidence items are not present in this report (all Phase 2 leads that survived reconciliation cleared 50+ owing to concrete code citation, even where full exploitability depends on an out-of-scope dependency).

---

> This review was performed by an AI-orchestrated three-phase audit (context-building, checklist breadth, and blind attacker-mindset depth passes) as part of an automated audit pipeline. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human review, a bug bounty program, and on-chain monitoring are strongly recommended before mainnet deployment or before trusting this contract with material value.
