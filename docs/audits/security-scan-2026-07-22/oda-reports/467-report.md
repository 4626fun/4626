# Security Review — CreatorGaugeController

**Audit target** (1 file, ~1319 LOC):
- `contracts/creator/revenue/CreatorGaugeController.sol`

**Source of truth**: `github.com/4626fun/4626`, tag `audit/oda-2026-07-22`, commit `423e0e3a607884de6e60bccd06f722a8aba770ee`.

**Job scope note**: Per the client's brief, the audit target is the creator-coin fee-collection, WETH-swap, and distribution hub. It receives fees directly in ShareOFT, as LayerZero-bridged ShareOFT, and as native/WETH; swaps WETH for the creator coin via Uniswap V3; and splits proceeds across burn, lottery jackpot, voter rewards, and (currently disabled) creator treasury. Its calling counterpart `LotteryManager4626` was audited separately in job 460; its dependencies `CreatorOVaultWrapper` and `CreatorShareOFT` were read only to verify specific cross-contract claims below and were not independently audited end-to-end.

**Methodology**: Three-phase review — (0) context building: a protocol map, access-control inventory, and threat catalog built by 3 parallel agents with no findings; (1) breadth: 6 domain-specialist agents (general, precision-math, access-control, defi-amm, oracles, dos) walking curated checklists; (2) depth: 12 attacker-mindset agents (9 single-specialty + 3 cross-lens gap-hunters), run **blind** to phase-1's findings (one agent's first attempt was invalidated by a tool-name collision and was successfully re-run), each independently reading the full source and the phase-0 map. All hunting agents ran on `opus` given the scope. This reconciliation cross-checks both phases' raw output against each other and against the phase-0 inventory/catalog, and independently re-verifies every file:line citation and the strongest finding's full exploit chain against source.

**Confidence floor**: All findings Low+ are reported; items resting on an unconfirmed precondition (most commonly: behavior of the out-of-scope `LotteryManager4626`/wrapper/vault/oracle/distributor dependencies) are explicitly flagged as such within their own finding rather than silently omitted or promoted.

---

## Reconciliation summary

- **Overlap**: the lottery-manager no-revocation-during-timelock gap (phase-1 access-control; independently corroborated by pashov access-control, trust-gap, execution-trace agents), the non-degrading vault/wrapper burn call (phase-1 dos/general; independently corroborated by pashov boundary, flow-gap agents — flow-gap escalated this from a conditional lead to a fully-proven, always-reachable trigger), the oracle-only slippage protection with `sqrtPriceLimitX96=0` (phase-1 defi-amm/oracles; corroborated by pashov boundary), and the wrapper return-value trust gap (phase-1 general; corroborated by pashov general, periphery, execution-trace, invariant, first-principles, numerical-gap).
- **Phase-2-only, newly discovered and independently verified against source by the orchestrator**: a fully-proven, always-reachable DoS where bridged (LayerZero-`_credit`-minted) ShareOFT can never be unwrapped for the OFT-lane burn slice, permanently bricking distribution and fee intake for bridged-fee-heavy gauges (flow-gap agent, promoted to Finding 1).
- **Phase-1-only**: the oracle TWAP floor / no absolute price band (Medium), the `distributionInterval` overflow footgun (Low), `setSwapConfig`'s unchecked fee tier (Low).
- **Positive verification result**: the `accountedOFTBalance == pendingFees + jackpotReserve` invariant was independently proven to hold across every code path by multiple agents in both phases (phase-1 general/precision-math, phase-2 boundary) — no fund-loss divergence exists in the ledger itself. `payJackpot`'s access gate, the emergency-withdraw timelock/cancel lifecycle, and every timelock boundary condition were also traced and confirmed correct.
- **Coverage**: `Entrypoints: ~35 external/public functions in inventory, all examined by ≥1 domain agent and ≥1 blind attack agent. Threat-catalog rows: 6, 6 answered. Coverage holes closed this pass: 0.`

**The single most important structural fact of this audit**: this contract's fee-distribution pipeline has exactly one non-degrading external dependency — the OFT-lane burn step's `wrapper.unwrap()` call — and that dependency is now proven, not merely suspected, to revert deterministically whenever the pending OFT fee slice traces back to LayerZero-bridged tokens rather than locally-`wrap()`-ed ones. Every other Medium+ finding is either a direct consequence of this same non-degrading-call pattern (the boundary agent's cross-lane cooldown collision) or an independent, unrelated gap in the admin/oracle/timelock surface.

---

## Access-Control Inventory (condensed)

- **Fee intake is fully permissionless**: `receiveFees`, `deposit`, `receiveBridgedFees`, `receiveWETHFees`, `receive()` — all ERC20 intakes use balance-delta accounting (credit only what actually arrived); no over-credit path found.
- **`processWETHFees()`**: owner/`wethFeeKeeper` may process the entire `pendingWETHFees` uncapped; any other caller is capped at `maxPermissionlessWethProcess` (default 0 = disabled). No interval/cooldown gate on this entrypoint itself (see Finding 3).
- **`distribute()`**: permissionless, gated by `pendingFees > 0` and `distributionInterval`. **`forceDistribute()`**: `onlyOwner`, bypasses the interval check.
- **`payJackpot(winner, amount)`**: gated by `msg.sender == address(lotteryManager)`, bounded by `amount <= jackpotReserve` — **verified correct** directly against source; equality-at-boundary (full drain) is intended, not a bug.
- **All config setters + `forceDistribute` + emergency-withdraw/lottery-manager-update lifecycles**: `onlyOwner`. `renounceOwnership()` is overridden to always revert.
- **Two timelocks, both 1 day**: (a) lottery-manager reassignment — first set instant, every subsequent change queues; **the incumbent manager keeps full `payJackpot` authority throughout the entire pending window, with no revoke/cancel function** (Finding 2). (b) emergency withdraw — queue → 1-day delay → execute, with an explicit cancel function.
- **Emergency-withdraw asset protections**: ShareOFT blocked entirely while `jackpotReserve > 0 || pendingFees > 0`; WETH capped at the surplus above `pendingWETHFees`; any other token unrestricted (owner-trusted, timelocked only).
- **No unguarded (arbitrary-caller) entrypoint lacks a meaningful safeguard**: every permissionless state-changing function is either balance-delta-accounted or bps-fixed/interval-gated — no path lets an arbitrary caller redirect value to themselves directly.

---

## Threat Model

| Actor | Reachable entrypoint | Potential gain | Status |
|---|---|---|---|
| Any unprivileged caller | `receiveFees`/`deposit`/`receiveBridgedFees`/`receiveWETHFees`/`receive()` | None directly | Invariant holds — balance-delta accounting confirmed on every intake path |
| Any unprivileged caller | `receiveBridgedFees()` → auto-`_distribute()` | Trigger, not redirect: permanently bricks the OFT distribution pipeline for bridged-heavy gauges | **Addressed by Finding 1** |
| Any unprivileged caller | `processWETHFees()` when `maxPermissionlessWethProcess > 0` | Chop pending WETH into repeated cap-sized swaps, each sandwich-able up to the oracle-TWAP slippage band | **Addressed by Finding 3** |
| Any unprivileged caller | `distribute()` | Trigger distribution at a caller-chosen moment only (fixed bps split) | Invariant holds — immutable constants prevent redirection |
| Compromised/buggy registered `lotteryManager` | `payJackpot(winner, amount)` | Drain `jackpotReserve`, bounded by reserve balance | By design; **owner's ability to react is addressed by Finding 2** |
| Owner (trusted) | `executeEmergencyWithdraw` on any non-ShareOFT/non-WETH token | Sweep arbitrary tokens, 1-day timelock only | Accepted trust model — flagged as an asymmetry (Leads) |
| Owner (trusted) | `setLotteryManager` → 1-day pending window | Old manager retains full `payJackpot` authority for the entire window | **Addressed by Finding 2** |

---

## Findings

### [1] Bridged (LayerZero-minted) ShareOFT can never be unwrapped for the OFT-lane burn slice — a fully-proven, always-reachable DoS on fee distribution and intake
**Severity**: High
**Origin**: `[phase2 only]` — pashov flow-gap agent; independently re-verified line-by-line by the orchestrator directly against `CreatorGaugeController.sol`, `CreatorOVaultWrapper.sol`, and `CreatorShareOFT.sol` source. Escalates phase-1 Finding [P1-4] (which had only proven the structural "no try/catch" gap, with the trigger condition left at lead-strength) to a fully-confirmed, concretely-reproducible root cause.
**Location**: `CreatorGaugeController._burnShareOftSlice()` (lines 774-786, `wrapper.unwrap()` call at line 779, no try/catch); `CreatorGaugeController.receiveBridgedFees()` (405-424, auto-`_distribute()` at 421-423); `CreatorOVaultWrapper._unwrapInternal` guards `InsufficientLocked`/`BurnExceedsTotalMinted` (wrapper lines 559-560), backed only by `totalLocked`/`totalMinted` which are incremented **only** inside `wrap()` (wrapper lines 516/525); `CreatorShareOFT.sol` line 480 comment confirming "LayerZero `_credit` paths are unaffected" by `_assertMintBacking` (which guards only the wrapper's own `mint()` path, not LayerZero's `_credit`).

**Description**: `receiveBridgedFees()` is permissionless and sweeps any ShareOFT balance in excess of `accountedOFTBalance` into `pendingFees` — this surplus arises when a remote-chain `CreatorShareOFT` flushes fees via LayerZero, which mints ShareOFT directly to this contract through the OFT base's `_credit()` path. That mint **never** touches `CreatorOVaultWrapper.totalLocked`/`totalMinted` — those counters are only advanced when *this* contract itself calls `wrapper.wrap()` (the WETH lane's vault-shares → ShareOFT step). Once enough pending OFT fees accumulate (`pendingFees >= distributionThreshold && block.timestamp >= lastDistribution + distributionInterval`), `receiveBridgedFees()` auto-calls `_distribute()` → `_distributeInternal()` → `_burnShareOftSlice(toBurnOft)`, which calls `wrapper.unwrap(toBurnOft)` with **no try/catch** (line 779) — in contrast to the voter lane's `_routeVoterShareOft`, which wraps its external call in try/catch and degrades gracefully to a treasury/jackpot fallback on failure. `wrapper.unwrap()` reverts with `InsufficientLocked`/`BurnExceedsTotalMinted` whenever `totalLocked`/`totalMinted` cannot back the requested unwrap amount — which is exactly the case for a burn slice sourced from bridged fees, since no corresponding `wrap()` call ever raised those counters. The revert propagates uncaught, so the entire `receiveBridgedFees()` transaction reverts, rolling back its own `pendingFees += bridgedAmount` accounting — meaning **every subsequent call to `receiveBridgedFees()` hits the identical failure** once the threshold/interval condition is met, permanently blocking both distribution and further bridged-fee intake for that gauge. The four fee-split bps constants (`burnShareBps`, `lotteryShareBps`, `creatorShareBps`, `protocolShareBps`, lines 163-169) are `constant`, not owner-adjustable — there is no config-level escape hatch to zero out the burn slice once this condition is hit. The only path out is enough local `wrap()` activity (i.e., WETH-lane processing) to raise `totalLocked`/`totalMinted` above the stuck burn slice — which does not happen for a gauge whose fee volume is predominantly bridged (the intended steady state for any non-hub/remote-chain-heavy deployment per this protocol's own cross-chain design), or at bootstrap before any local wrap has occurred.

**Proof of Concept**: Hub gauge, freshly deployed: `wrapper.totalMinted = 0`, `wrapper.totalLocked = 0` (no local wraps yet). A remote-chain `CreatorShareOFT` flushes fees; LayerZero's `_credit` mints 100e18 ShareOFT directly to the gauge. Anyone calls `receiveBridgedFees()`: `balance(100e18) > accounted(0)` → `pendingFees = 100e18`, `accountedOFTBalance = 100e18`. Once `distributionThreshold`/`distributionInterval` are met, the same call (or a later `distribute()`) triggers `_distributeInternal()`: `toBurnOft = 100e18 - 69e18 (lottery) - 21.39e18 (voters) - 0 (creator) = 9.61e18`. `_burnShareOftSlice(9.61e18)` → `wrapper.unwrap(9.61e18)` → `_unwrapInternal`: `vaultSharesBeforeFee = 9.61e18 × 1000`; `totalLocked(0) < that` → reverts `InsufficientLocked` (and independently, `9.61e18 > totalMinted(0)` → `BurnExceedsTotalMinted`). The entire `distribute()`/`receiveBridgedFees()` call reverts; the 100e18 in bridged fees is stuck, and every future call attempting to cross the threshold/interval condition fails identically.

**Recommendation**: Wrap the `wrapper.unwrap()` + `vault.burnSharesForPriceIncrease()` step in `_burnShareOftSlice` in try/catch, mirroring `_routeVoterShareOft`'s existing graceful-degradation pattern — on failure, route the un-unwrappable burn slice to a fallback (fold into jackpot/treasury, or simply skip the burn and carry the slice forward) rather than letting it revert the whole distribution. Separately, consider whether the OFT lane should track "locally-backed" vs. "bridged-only" ShareOFT distinctly, since only the former can ever be burned via this wrapper.

---

### [2] No kill-switch to revoke a compromised lottery manager during the 1-day rewire timelock; the jackpot reserve has zero protection during that window
**Severity**: Medium
**Origin**: `[both]` — phase-1 access-control; independently corroborated by pashov access-control, trust-gap, and execution-trace agents.
**Location**: `setLotteryManager()`/`executeLotteryManagerUpdate()` (913-935); interaction with `payJackpot()` (854) and `executeEmergencyWithdraw()` (1298-1300).

**Description**: After the first assignment, every `lotteryManager` change queues `pendingLotteryManager` and requires a 1-day wait before `executeLotteryManagerUpdate()` swaps it in. Throughout that entire window, the **current** `lotteryManager` retains unchanged, full `payJackpot(winner, amount)` authority — it is never revoked, and there is no cancel function for this specific timelock (unlike the emergency-withdraw one). If the owner discovers the registered manager is compromised, there is no fast path to protect funds: `executeEmergencyWithdraw` refuses to move ShareOFT while `jackpotReserve > 0` (line 1298), and no other function reduces `jackpotReserve`. The owner cannot even instantly point `lotteryManager` at a dead address — all changes after the first are timelocked. This is the inverse of what the timelock is presumably meant to protect against (a malicious owner instantly rewiring to drain) — it simultaneously removes the owner's only fast defense against a *bad manager*.

**Proof of Concept**: Manager `M1` is live with `jackpotReserve = X`. Owner discovers `M1` is compromised and calls `setLotteryManager(M2)` — this only queues `M2` (1-day delay); `lotteryManager` remains `M1`, fully authorized. Before the delay elapses, `M1` calls `payJackpot(attacker, X)`, draining the full reserve. The owner cannot front-run this: `executeEmergencyWithdraw` reverts `JackpotReserveProtected` while `jackpotReserve > 0`, and there is no revoke/cancel mechanism for the lottery-manager assignment itself.

**Recommendation**: Add an owner-only instant *revoke* that sets `lotteryManager = address(0)` (disabling `payJackpot` immediately), keeping the 1-day timelock only on *assigning* a new manager. Add a `cancelLotteryManagerUpdate()` for symmetry with the emergency-withdraw lifecycle.

---

### [3] Uniswap swap execution has no router-side price limit (`sqrtPriceLimitX96=0`); the oracle-TWAP slippage band is a fully extractable MEV budget, worsened by permissionless processing and by the lack of any interval gate on the permissionless entrypoint
**Severity**: Medium
**Origin**: `[both]` — phase-1 defi-amm/oracles; independently corroborated and sharpened by pashov boundary agent (which confirmed `processWETHFees()` itself has no cooldown, unlike its auto-triggered sibling).
**Location**: `_processWETHFees()` (508-563, `sqrtPriceLimitX96=0` at line 524), `_calculateMinOutput()` (570-598), `processWETHFees()`/`_wethAmountToProcessForCaller()` (489-506, confirmed via direct Read: no interval/cooldown check anywhere in this call path).

**Description**: Every WETH→creator-coin swap hardcodes `sqrtPriceLimitX96 = 0`, disabling Uniswap's own execution-price ceiling (an intentional tradeoff per an in-code comment, avoiding partial-fill griefing). The only remaining protection is `amountOutMinimum`, derived from an oracle TWAP with a `swapSlippageBps` tolerance (default 100 bps, owner-cappable to 1000 bps). This lets an attacker push the pool price until the realized output equals exactly `minOut`, extracting the slippage band as MEV — profitable whenever `swapSlippageBps > 2 × poolFeeTier`. Separately, and confirmed directly against source: `receiveWETHFees`'s auto-process path gates on `block.timestamp >= lastWethDistribution + distributionInterval`, but the direct `processWETHFees()` entrypoint has **no equivalent interval check** and never reads/writes `lastWethDistribution`. When `maxPermissionlessWethProcess > 0`, an unprivileged caller can invoke `processWETHFees()` repeatedly in consecutive blocks, chopping pending WETH into many back-to-back cap-sized swaps, each individually sandwich-able up to the slippage tolerance — turning a single passive sandwich surface into a repeatable, attacker-timed extraction loop. Both issues are gated by the owner enabling `maxPermissionlessWethProcess`/`autoProcessWethFees` (disabled by default).

**Proof of Concept**: With `swapSlippageBps=100` and fee tier 3000 (0.3%): searcher front-runs to push the creator-coin price until the protocol's realized swap output falls to exactly `minOut` (nothing stops it earlier) → protocol swap executes at the degraded price → searcher back-runs to sell, netting `≈ (swapSlippageBps - 2×feeTier)` of the swapped amount. With permissionless processing enabled, the same caller can also self-trigger this repeatedly rather than waiting for organic keeper calls, since `processWETHFees()` has no per-caller or global cooldown.

**Recommendation**: Re-enable a real `sqrtPriceLimitX96` derived from the oracle price, or restrict permissionless processing to a cooldown-gated cadence matching the auto-process path's `distributionInterval` semantics; lower `swapSlippageBps` as far as liquidity allows if permissionless processing remains enabled.

---

### [4] No absolute sanity bound on the oracle TWAP price beyond a bare `!= 0` check; the 60-second minimum TWAP window is manipulable on a thin pool
**Severity**: Medium
**Origin**: `[phase1 only]` — ethskills oracles.
**Location**: `_calculateMinOutput()` (586-597), `setOracleConfig()` (1019-1024, bounds `[60, 7200]` seconds).

**Description**: The only validation applied to the oracle's TWAP price is `if (creatorPerEth == 0) return 0` — any nonzero value, however extreme, is accepted with no floor/ceiling and no cross-check against the oracle's own independently-available USD reading. `oracleTwapDuration` can be configured as low as 60 seconds, well below prudent TWAP windows for a newly-launched, thin-liquidity creator-coin pool. A manipulated-low-but-"fresh" TWAP collapses `minOut` toward (but not exactly) zero, evading the `MinOutputUnavailable` fail-closed check while combining with Finding 3's missing price limit to extract more than the nominal slippage band.

**Proof of Concept**: Lead-strength — the manipulation mechanics live inside the external `IOracle4626` implementation (out of scope). Confirmed in-scope: no absolute price band exists on the consumed value, and the 60-second floor is owner-configurable and far below prudent TWAP windows for thin pools.

**Recommendation**: Raise the minimum `oracleTwapDuration` floor to at least 1800s. Add an absolute sanity band on the consumed price or a bounded-deviation cross-check against the oracle's independently-fetched USD price.

---

### [5] `distributionInterval` set near `type(uint256).max` causes an arithmetic-overflow revert, bricking all OFT fee intake and distribution
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills dos.
**Location**: `setDistributionInterval()` (1068, no upper bound); consumed via `lastDistribution + distributionInterval` in `_distribute()` (661), `receiveFees()` (370), `receiveBridgedFees()` (421), `receiveWETHFees()` (460), `canDistribute()` (1146).

**Description**: Once `lastDistribution` is nonzero, setting `distributionInterval` large enough that `lastDistribution + distributionInterval` overflows `uint256` causes that addition to revert (checked arithmetic). Because this expression appears in the unconditional auto-distribute check inside `receiveFees()`/`receiveBridgedFees()`, those permissionless intake functions revert on every call, freezing OFT intake entirely; `distribute()`/`canDistribute()` revert too. `forceDistribute()` survives (bypasses the interval check). Owner-only misconfiguration, not attacker-reachable.

**Proof of Concept**: After at least one distribution (`lastDistribution = T > 0`), owner calls `setDistributionInterval(type(uint256).max)`. Any subsequent `receiveFees(x)` evaluates `T + type(uint256).max`, panics, and reverts — freezing all OFT intake/distribution until the owner lowers the interval.

**Recommendation**: Cap `distributionInterval` to a sane maximum (e.g. 30 days), or compute the cooldown check in an overflow-immune form (e.g. `block.timestamp < lastDistribution || block.timestamp - lastDistribution < distributionInterval`).

---

### [6] `setSwapConfig` accepts any fee tier with no whitelist or pool-existence check
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills amm, general (independently, same finding).
**Location**: `setSwapConfig()` (972-977).

**Description**: Despite an in-code comment listing the standard Uniswap tiers (100/500/3000/10000), `setSwapConfig` enforces neither that set nor that a pool exists at the chosen tier. Setting an invalid/non-existent tier makes every subsequent `exactInputSingle` revert, halting the WETH-processing lane until the owner corrects it. Owner-only, no fund loss, latent config-hygiene risk.

**Recommendation**: Restrict the fee tier to the known-valid set, or verify pool existence in the setter.

---

## Leads / Info (lower-confidence or minor items — not scored as full findings)

- **`wrapper.wrap()`/`wrapper.unwrap()` return values are trusted directly into `accountedOFTBalance` with no balance-delta verification**, unlike every ERC20 intake path. If the wrapper ever returns a value diverging by even 1 wei from the ShareOFT actually minted/burned, a three-way seam emerges: the drift compounds into `jackpotReserve`/`accountedOFTBalance`, and combined with `payJackpot`'s exact-transfer semantics and `executeEmergencyWithdraw`'s `jackpotReserve > 0` block, could **permanently** brick both jackpot payout and emergency rescue for the stuck difference. `[phase1: general; phase2: general, periphery, execution-trace, invariant, first-principles, numerical-gap]`. Partially cleared: the pashov boundary agent traced every mutation of `jackpotReserve`/`pendingFees`/`accountedOFTBalance` this file performs and confirmed the invariant holds *exactly* under correct wrapper behavior — this lead's exposure is conditioned entirely on the wrapper (audited separately) ever misreporting, which was not confirmed or refuted here.
- **A same-block WETH-lane `wrap()` and OFT-lane `unwrap()` collide via `CreatorOVaultWrapper`'s 1-block withdraw cooldown**, which is bypassed only for whitelisted addresses — confirmed the deployment batcher whitelists the wrapper's `payoutRouter` but never the gauge controller itself. If a permissionless WETH-lane process and an OFT-lane distribute land in the same block, the unwrap reverts `WrapperWithdrawTooSoon`, reverting `distribute()`/`forceDistribute()`/auto-distribute-in-`receiveFees` (and thus the fee-collecting buy transaction that triggered it). Griefable when permissionless WETH processing is enabled; otherwise a latent same-block keeper-collision bug. `[phase2: boundary]`
- **Small WETH batches whose swap output produces a sub-1000-vault-share voter slice can revert the entire `_processWETHFees()`** via the wrapper's `AmountTooSmallToNormalize` guard on `wrap()`, not caught by try/catch. Bounded impact — fees stay pending until larger amounts accumulate. `[phase2: flow-gap]`
- **`_routeVoterShareOft`'s `spent = balanceBefore - balanceAfter` accounting assumes the voter-rewards distributor pulls its ShareOFT synchronously.** If the distributor instead uses a deferred/claim-based pull, `spent` reads 0, the full `toVoters` reroutes to `protocolTreasury`/jackpot, and the approval is reset to 0 — the distributor is left with a recorded-but-unbacked reward while the tokens went elsewhere. Depends on the out-of-scope distributor's implementation. `[phase1: general; phase2: flow-gap]`
- **Security-critical setters (`setOracle`, `setVault`, `setWrapper`, `setve4626VoterRewardsDistributor`, `setSwapConfig`, `setOracleConfig`) have no timelock**, unlike the lottery-manager and emergency-withdraw paths — an asymmetry worth flagging even though all are owner-only by design. `[phase1: access-control]`
- **One-step `Ownable`** (no `Ownable2Step`) — operator-error risk, not a hijack window. `[phase1: access-control]`
- **Owner can sweep unreconciled bridged/donated ShareOFT via `executeEmergencyWithdraw`** when `jackpotReserve`/`pendingFees` are both zero but real balance is nonzero (e.g. unswept LayerZero-minted fees) — mitigated by the 1-day timelock and by anyone being able to front-run the execute with a permissionless `receiveBridgedFees()` call. `[phase1: general]`
- **Dead code confirmed inert**: the unreachable `PendingOftFeesProtected` check in `executeEmergencyWithdraw` (already covered by the preceding `JackpotReserveProtected` check), the unused `_sqrtPriceLimitX96` helper, `ve4626GaugeVoting` (write-only, never read), and `ILotteryManager4626.addToJackpot` (never called). `[phase1: general; phase2: asymmetry]`
- **Fee-split residual asymmetry between the two distribution lanes** (OFT lane routes rounding dust to burn; WETH lane routes it to voters) — verified both lanes sum exactly to their input with no loss/double-count; the only effect is which slice absorbs sub-wei dust. `[phase1: general, precision-math]`
- **`receive()` and `executeEmergencyWithdraw()` lack `nonReentrant`** — traced and confirmed not exploitable (reentry into `receive()` only increments an isolated counter; `executeEmergencyWithdraw` follows CEI and is `onlyOwner`). Defense-in-depth only. `[phase1: general]`
- **Hardcoded `1e18` scaling in `_calculateMinOutput` assumes an 18-decimal creator coin** with no `decimals()` validation in `setCreatorCoin()` — internally consistent under the intended convention; a non-18-decimal coin fails closed (DoS via reverting swaps) rather than fails open. `[phase1: precision-math, oracles]`

## Completeness

Every unique (Contract, function) flagged by any of the 3 phase-0 + 6 phase-1 + 13 phase-2 sub-agents appears above, either as a numbered finding or in the Leads/Info section. `Coverage: 6 entrypoints/threat-catalog rows in inventory, 6 addressed. Coverage holes closed this pass: 0.` The central phase-0 open question (whether the OFT-lane burn slice can ever fail to unwrap) was resolved definitively by Finding 1 — it always fails for bridged-only backing, not merely under some unconfirmed precondition.

> ⚠️ This review was performed by AI auditor agents. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Findings 1 and the wrapper-return-value Lead depend in part on the exact behavior of `CreatorOVaultWrapper`/`CreatorShareOFT` (read here only to verify specific cross-contract claims, not independently audited end-to-end), and Finding 2's severity depends on `LotteryManager4626` (audited separately in job 460). Independent verification against those deployed contracts together with this one is recommended before relying on this report alone.
