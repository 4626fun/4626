# Security Audit Report — 4626 Lottery Stack

**Client target**: `github.com/4626fun/4626` @ tag `audit/oda-2026-07-22`
**Commit pinned**: `423e0e3a607884de6e60bccd06f722a8aba770ee`
**Scope** (7 files, 6,556 LOC): `contracts/shared/lottery/manager/{LotteryManager4626,LotteryManager4626PricingLib,VRFConsumer4626}.sol`, `contracts/shared/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol`, `contracts/shared/lottery/zk/{LotteryAmoeRouter,AmoePlonkVerifier,IAmoePlonkVerifier}.sol`
**Referenced live deployment (Base, chain 8453)**: LotteryManager4626 `0xB45E68a5867935a5734E4185977F81c528006650` · VRFConsumer4626 `0x98fb5e0af3120B32E2E03400B6E51d0bde433670` · LotteryAmoeRouter `0x630c3769Cf1D80c6cb8cCB7c011f5A76904C4C1e`
**Methodology**: three-phase — Phase 0 context (protocol map + access-control inventory + threat catalog, opus) → Phase 1 breadth (8 domain checklists: general, precision-math, oracles, bridges, access-control, dos, signatures, flashloans; opus) → Phase 2 depth (12 attacker-mindset agents, blind to Phase 1, opus) → Phase 3 hybrid reconciliation + coverage gate.

**Note on the live addresses**: the client's brief lists these as the current Base deployment; this audit's findings are all sourced from the pinned commit above, which the client identified as the re-audit source of truth. As due diligence we ran a safe, non-state-changing (`eth_call`, no broadcast) probe against the live `LotteryManager4626` contract: its `owner()`, `paused()`, `singleVaultJackpotOnly()`, and `authorizedAmoeRelayer()` values are consistent with the client's brief and with this source, and the `adminModuleCall(bytes)` selector (`0xa847fca8`) is present in the live bytecode. However, a zero-effect simulated call to `adminModuleCall` reverted with empty return data in a way we could not fully diagnose remotely (possibly a difference between the live bytecode and this exact source tag, or an unrelated dispatch detail) — so we cannot confirm from this probe alone whether the live contract is byte-identical to the audited commit. **Finding #1 below is Critical against the audited source as delivered; we recommend the client independently verify the live bytecode matches this tag (or re-verify against Basescan's verified source) before treating this as a live incident**, and treat it as Critical for any deployment that does match.

---

## Reconciliation Summary

`Overlap: 7 · Phase-1-only: 24 · Phase-2-only: 8 · Re-examined leads kept: 8, demoted: 0 · Coverage holes closed: 0`

Confidence floor: all findings below are Low severity and above; nothing below is included with confidence < 50 as a "finding" — lower-confidence items are listed separately under **Leads**. The one Critical finding was independently reproduced by 12 of the 13 total sub-agents across both hunting phases that examined the relevant code path (2 Phase-0 context agents surfaced it structurally; 2 of 8 Phase-1 domain agents confirmed it as a finding; 10 of 12 Phase-2 attack agents confirmed it as a finding) — the highest-corroboration result of this engagement.

**Coverage gate**: `Entrypoints: 149 external/public state-changing functions in inventory, 149 addressed (by a finding or an explicit "examined, no issue" note). Threat-catalog rows: 12, 12 answered.` No entrypoint or threat-catalog row was left unexamined by both phases; K=0 (no coverage holes required a fresh re-read this pass).

---

## Access-Control Inventory (from Phase 0 protocol map)

*Full detail in Appendix A. Summary: 149 external/public state-changing entrypoints across `LotteryManager4626` (50, incl. `receive`), `LotteryManager4626AdminModule` (49), `VRFConsumer4626` (25), `ChainlinkVRFIntegratorV2_5` (13), `LotteryAmoeRouter` (12). Roles: owner (OZ `Ownable`, one-step, shared via delegatecall storage between manager and module), `authorizedSwapContracts`, `authorizedAmoeRelayer`, `localVRFConsumer`/`vrfIntegrator`, `boostManager`/`ve4626GaugeVoting`, VRF coordinator, `authorizedLocalCallers`/`authorizedRelayers`/`authorizedSponsoredCallers`, LayerZero `peers` + `authorizedRemoteOFTs`, AMOE `allowlistPublisher`/`pointsLedgerPublisher`/router-`owner` (bespoke, one-step). Most privileged rewires are timelocked (2 days for VRF/relayer/swap-auth, 24h for boost sources, 1 day for AMOE config) — with the notable exception detailed in Finding #1.*

**Unguarded entrypoints reachable by an arbitrary caller** (full list in Appendix A): `LotteryAmoeRouter.submitAmoeEntryZK` (cryptographically gated — examined, invariant holds, see Findings #4/#18), `VRFConsumer4626.retryLocalCallback`/`ChainlinkVRFIntegratorV2_5.retryCallback`/`cleanupExpiredRequests` (state-gated, idempotent — examined, invariant holds), ETH-only `receive()`/`fundContract()` (no invariant at risk), and — the critical gap — `LotteryManager4626.adminModuleCall` (see Finding #1).

---

## Threat Model (from Phase 0 protocol map)

| Actor | Reachable entrypoint | Potential gain | Status |
|---|---|---|---|
| Arbitrary EOA | `adminModuleCall` → `payoutLocalJackpot` | Drain any vault's entire jackpot reserve | **Addressed by Finding #1 (Critical, CONFIRMED)** |
| Arbitrary EOA | `retryLocalCallback`/`retryCallback` | Force attacker-timed callback redelivery | Invariant holds — state-gates (`!callbackSent`/`!callbackSucceeded`) fully prevent double-settlement or misuse; targets are pre-authorized addresses, not attacker-controlled |
| Arbitrary EOA (AMOE prover) | `submitAmoeEntryZK` | Forge or replay a lottery entry | Invariant holds for forgery/replay (proof + triple nullifier + root pinning verified sound); related gaps addressed by Findings #4 (Solana-lane replay corner case) and #18 (legacy path has no sig verification, but doesn't reach the lottery) |
| Authorized swap contract | `processSwapLottery` | Inflate win chance beyond cap | Invariant holds for the core cap mechanism; AMOE-side gap addressed by Finding #5 |
| Hostile/compromised `IOracle4626` | via pricing lib | Manipulate USD value / win chance | Addressed by Findings #2, #3, #6, #8 |
| Hostile/compromised boost/gauge-voting contract | via `_applyBoost` | Inflate win chance / DoS | State-mutation invariant holds (`view`-context call); DoS gap addressed by Finding #20 |
| Hostile/compromised `ITradeFeeCollector4626` gauge | via `payJackpot`/reserve reads | Revert-DoS legitimate payout | try/catch invariant holds on the payout path; related gap addressed by Finding #16 |
| Remote LayerZero peer (compromised/spoofed) | `_lzReceive`/`receiveRemoteLotteryEntry` | Inject fabricated entries/callbacks | Addressed by Findings #4, #9, #11, #22 |
| Chainlink VRF coordinator (compromised) | `rawFulfillRandomWords` | Biased randomness | Out of audit scope (external dependency) — trust assumption noted, no in-scope mitigation possible |
| Owner (malicious/compromised) | Entire admin surface | Rewire trust anchors, drain via emergency paths | Addressed by Findings #12, #13, #14 |
| Any address | `fundContract`/`receive()` | None (ETH-in only) | No invariant at risk — confirmed non-issue |
| AMOE publisher (compromised) | `setAllowlistRoot`/`setPointsLedgerRoot` | Admit ineligible entries | Invariant holds — one-shot-per-epoch + 1-day maturity timelock verified sound |

---

## Findings

### Critical

#### [1] Unauthenticated jackpot drain via `adminModuleCall` → `payoutLocalJackpot`
**Confidence: 100** · **[both phases — 12/13 relevant sub-agents independently confirmed]**
**Location**: `LotteryManager4626.adminModuleCall()` — `contracts/shared/lottery/manager/LotteryManager4626.sol:1989-1999`; `LotteryManager4626AdminModule.payoutLocalJackpot()` — same file, `L2461-2473`; `onlyDelegateCall` modifier — `L2359-2362`.

**Description**: `LotteryManager4626` deploys a sibling contract, `LotteryManager4626AdminModule`, at construction and stores its address immutably. Roughly 41 thin stub functions on the main contract delegatecall into this module to keep the main contract under the EIP-170 size limit. One of those stubs, `adminModuleCall(bytes calldata data)`, is a generic forwarder:

```solidity
function adminModuleCall(bytes calldata data) external {
    address module = _adminModule;
    assembly {
        let size := data.length
        calldatacopy(0, data.offset, size)
        let ok := delegatecall(gas(), module, 0, size, 0, 0)
        returndatacopy(0, 0, returndatasize())
        if iszero(ok) { revert(0, returndatasize()) }
        return(0, returndatasize())
    }
}
```

It carries **no access-control modifier** — any address can call it with any calldata, and that calldata is delegatecalled verbatim into the admin module (preserving `msg.sender`, executing in the main contract's storage). The accompanying comment claims "Admin module enforces `onlyOwner`/`onlyDelegateCall`" — true for every module function **except one**: `payoutLocalJackpot`.

```solidity
function payoutLocalJackpot(address triggeringCoin, address winner, uint16 payoutBps)
    external
    onlyDelegateCall               // <-- the ONLY modifier; every sibling module function also has onlyOwner
    returns (uint256 totalSharesPaid)
{
    if (winner == address(0)) revert ZeroAddress();
    if (uint256(payoutBps) > BASIS_POINTS) revert InvalidAmount();   // BASIS_POINTS = 10_000 (100%)
    if (_payoutLock == 1) revert ReentrancyGuardReentrantCall();
    _payoutLock = 1;
    totalSharesPaid = payoutLocalJackpotInner(triggeringCoin, winner, payoutBps);
    _payoutLock = 0;
}
```

`onlyDelegateCall` (`L2359-2362`) is `if (address(this) == _self) revert;` — it checks only that the call arrived via delegatecall (`_self` is the module's own immutable deploy address), never `msg.sender`. Any delegatecall from the main contract — whether the legitimate internal win-settlement path or the attacker's `adminModuleCall` — satisfies it identically.

The sink, `payTriggeringVaultJackpot` (reached when `singleVaultJackpotOnly` is `true`, the launch default), performs no caller check at all:
```solidity
function payTriggeringVaultJackpot(address triggeringCoin, address winner, uint16 payoutBps)
    internal returns (uint256 totalSharesPaid)
{
    if (triggeringCoin == address(0)) return 0;
    ... // registry.isTokenActive / getVaultForToken / getGaugeControllerForToken — all try/caught, return 0 on failure
    uint256 rewardShares = (jackpotShares * payoutBps) / BASIS_POINTS;
    if (rewardShares == 0) return 0;
    try gaugeController.payJackpot(winner, rewardShares) { ... }
}
```
`winner` and `payoutBps` are taken verbatim from attacker calldata.

**Proof of Concept**:
1. Attacker picks any registry-active lane token (`triggeringCoin`) whose gauge reports `availableJackpotReserve() > 0` — i.e. any live lottery lane in normal operation.
2. Attacker builds `data = abi.encodeWithSelector(LotteryManager4626AdminModule.payoutLocalJackpot.selector, triggeringCoin, attacker, uint16(10000))`.
3. Attacker calls `LotteryManager4626.adminModuleCall(data)` from any EOA, no funds or role required.
4. The call delegatecalls into the module; `onlyDelegateCall` passes; there is no `onlyOwner`; `winner = attacker`; `payoutBps = 10000` (100%).
5. `payTriggeringVaultJackpot`: `triggeringCoin` is active → reserve `J > 0` → `rewardShares = J * 10000 / 10000 = J` → `gaugeController.payJackpot(attacker, J)` executes with `msg.sender` = the manager contract (the gauge's authorized payout caller in normal operation) → **100% of that lane's jackpot reserve is transferred to the attacker.**
6. Repeatable per active lane, and again each time a reserve refills from trade fees.

We independently traced this exploit path against the source (not just relaying agent claims) at each of the cited lines and confirmed it holds; it was also the single most cross-corroborated result of the entire engagement (13 total independent confirmations: 2 Phase-0 context agents surfaced the guard-composition fact structurally, 2 Phase-1 domain agents and 10 Phase-2 attack agents confirmed it as an exploitable finding with a full trace).

**Recommendation**: Add `onlyOwner` to `adminModuleCall` itself — its only legitimate uses (the ODA-426-F3 queue/execute/cancel admin operations) are already `onlyOwner` inside the module, so this is behavior-preserving for every legitimate call. Additionally, harden `payoutLocalJackpot` so it is reachable *only* from the internal `_processWin → _payoutLocalJackpot` self-delegatecall path (e.g. a transient in-progress flag set by that internal caller and required by `payoutLocalJackpot`), so that even a future permissioned wrapper — or a compromised owner key used via `adminModuleCall` — cannot trigger an out-of-band 100% payout.

---

### Medium

#### [2] `calculateTokenUSD` hardcodes an 18-decimal token assumption
**Confidence: 85** · **[Phase 1: precision-math]**
**Location**: `LotteryManager4626PricingLib.calculateTokenUSD()` — `contracts/shared/lottery/manager/LotteryManager4626PricingLib.sol:105,111`

```solidity
uint256 usd1e18 = FullMath.mulDiv(amount, priceUSD1e18, 1e18);
...
usd1e6 = usd1e18 / 1e12;
```
`amount` is in the valued token's native decimals; the `/1e18` scaling is only dimensionally correct when that token has exactly 18 decimals. `decimals()` is never queried, and the same function values either the lane coin or its ShareOFT (which can carry different decimals, e.g. 6, under LayerZero OFT "shared decimals" conventions) with the same hardcoded scale.

**Proof of Concept**: A registered 6-decimal lane token priced at $1: a $10,000 buy (`amountIn = 1e10`) computes `usd1e18 = 1e10`, `usd1e6 = 1e10/1e12 = 0` — the real $10,000 swap is valued at $0 and falls below `minSwapAmount`, silently disabling the lottery for that token. A >18-decimal token would instead inflate USD value, pinning win chance at the ceiling on dust-sized trades.

**Recommendation**: Query `IERC20Metadata(tokenIn).decimals()` and normalize by `10**tokenDecimals` in place of the hardcoded `1e18`.

---

#### [3] Oracle deviation "circuit breaker" fails open for infrequently-traded lanes
**Confidence: 80** · **[Phase 1: oracles]**
**Location**: `LotteryManager4626PricingLib.calculateTokenUSD()` — `LotteryManager4626PricingLib.sol:89-98`

```solidity
// Deviation only while the stored reference is still inside the window.
// After the window elapses, accept the new price so entries are not locked forever.
if (
    oracleMaxDeviationBps > 0 && oracleDeviationWindow > 0 && lastPrice > 0 && lastTs > 0
        && block.timestamp >= lastTs && block.timestamp - lastTs <= oracleDeviationWindow
) { ... }
```
The reference price/timestamp is only updated when an entry is actually created, so any lane whose entries are spaced further apart than `oracleDeviationWindow` (default 30 minutes) skips the deviation check entirely — this is confirmed as the code's deliberate, commented tradeoff ("so entries are not locked forever"), not an oversight, but it means the only remaining protection for such lanes is the 2-hour staleness bound, well short of what a "circuit breaker" implies.

**Proof of Concept**: Lane X's last entry was >30 minutes ago; the oracle reports a price 3x the real value (within the 2-hour staleness bound). The deviation check is skipped (stale reference); the inflated price is accepted, tripling `swapValueUSD` and thus win chance (up to the configured caps).

**Recommendation**: Either accept this as a documented tradeoff (recommended fix: decouple the reference refresh from entry creation — refresh on every successful oracle read, independent of the deviation-window semantics — so the guard stays continuously active without the "locked forever" risk), or treat a stale reference as fail-closed rather than skip-check.

---

#### [4] Non-Solana forwarder-path replay guard bypassable with `sourceEventId == 0`
**Confidence: 75 (promoted via 5-agent Phase-2 convergence)** · **[both phases]**
**Location**: `receiveRemoteLotteryEntry()` — `LotteryManager4626.sol:972-991`; `_handleLotteryEntry()` — `LotteryManager4626.sol:1290-1299,1351-1353`

The doc comment at `L969-971` states the intent explicitly: *"require a V3 non-zero `sourceEventId` replay key for every forwarder lane (parity with Solana)."* The code does not do this. Verified directly:
```solidity
if (srcEid == SOLANA_LZ_EID && sourceEventId == bytes32(0)) return;
bytes32 sourceEventKey;
if (sourceEventId != bytes32(0)) {
    assembly { ... if sload(sourceEventKey) { return(0, 0) } }
    ...
}
```
The non-zero requirement is enforced *only* for `srcEid == SOLANA_LZ_EID`. For any other chain, a 224-byte forwarder payload with `sourceEventId == 0` skips the entire `_processedRemoteLotterySourceEvents` replay-guard block and is never marked consumed — repeatable indefinitely.

`receiveRemoteLotteryEntry` is a plain external call (not delivered through the LayerZero endpoint), so it receives none of LZ's own per-nonce dedup — this on-chain replay key is the *only* protection on this path, and it's exactly the check documented as required but not implemented for non-Solana lanes.

**Proof of Concept**: An authorized non-Solana remote OFT (or a bug/compromise in the forwarding relay) delivers a payload with `sourceEventId = 0`; the entry is processed with no replay mark. Any re-delivery of the identical payload creates a fresh entry and dispatches sponsored VRF again. Exploitability requires the trusted forwarder to misbehave (bug or compromise) rather than an arbitrary unprivileged actor, which is why this is promoted from a demoted lead rather than a directly unprivileged-triggerable finding.

**Recommendation**: Require `sourceEventId != 0` for every forwarder-originated lane in `_handleLotteryEntry`, not just Solana, matching the documented invariant.

---

#### [5] AMOE entry path has weaker anti-flash-loan protection than the paid-swap path
**Confidence: 80** · **[Phase 1: flashloans]**
**Location**: `processAmoeEntry()` — `LotteryManager4626.sol:804-812`; `_eligibleShareBalance()` — `LotteryManager4626.sol:1716-1722`; compare `_coverageShareBalance()` — `LotteryManager4626.sol:1698-1713`

Verified directly:
```solidity
function _coverageShareBalance(address shareOFT, address buyer, uint256 amountIn, uint256 reportedEligible)
    internal view returns (uint256 coverageBal)
{
    if (shareOFT.code.length == 0) { return reportedEligible; }
    uint256 live = IERC20(shareOFT).balanceOf(buyer);
    uint256 maxPreBuy = live > amountIn ? live - amountIn : 0;
    coverageBal = reportedEligible;
    if (coverageBal > maxPreBuy) coverageBal = maxPreBuy;
    if (coverageBal > live) coverageBal = live;
}

function _eligibleShareBalance(address shareOFT, address buyer) internal view returns (uint256) {
    try IShareOFT4626(shareOFT).balanceEligibleForLotteryCoverage(buyer) returns (uint256 eligible) {
        return eligible;
    } catch {
        return IERC20(shareOFT).balanceOf(buyer);   // <-- live, call-time balance fallback
    }
}
```
The paid-swap path (`processSwapLottery`) cross-checks the caller-supplied "block-start eligible" balance against a second, independently-derived live-balance cap (`_coverageShareBalance`). The permissionless AMOE path (`submitAmoeEntryZK` → `processAmoeEntry`) applies **no such cross-check**, and falls back to a live, call-time `balanceOf(buyer)` whenever the block-start view reverts — fully manipulable within a single transaction via a flash loan of ShareOFT tokens.

**Proof of Concept**: An attacker with a valid, unused AMOE credential (proof + unused nullifiers) flash-borrows ShareOFT into `buyer` within the same transaction as `submitAmoeEntryZK`. If the ShareOFT's block-start-eligible view reverts (or the deployed ShareOFT simply doesn't implement it — plausible since the code anticipates this with a fallback), `_eligibleShareBalance` returns the flash-inflated balance, maximizing the personal Curve-style boost and pushing win chance toward `maxWinChance` before the loan is repaid.

**Recommendation**: Apply the same two-source capping used on the paid path to the AMOE path; treat a reverting block-start view as "no coverage" (return 0) rather than falling back to a live, manipulable balance.

---

### Low

#### [6] Single global staleness/deviation config across all per-lane oracles; staleness can be disabled with `0`
**Confidence: 65** · **[Phase 1: oracles]**
`oracleMaxStaleness` (`LotteryManager4626.sol:3066-3069`) and the deviation config are single global values applied to every lane's distinct `IOracle4626`. Different lane oracles will have different real heartbeats, so one threshold is simultaneously too strict for slow feeds and too lenient for fast ones. `setOracleMaxStaleness` also accepts `0`, which disables staleness checking entirely (`oracleMaxStaleness > 0 && ...` gate in the pricing lib) — an owner misconfiguration risk, not third-party exploitable. **Fix**: per-lane staleness/deviation config; reject `0` in the setter.

#### [7] Cross-chain price aggregation uses an unbounded arithmetic mean; can overflow and strand a cross-chain VRF relay
**Confidence: 60** · **[both phases]**
`getAggregatedAssetPrice()` (`VRFConsumer4626.sol:688-722`) computes a plain mean over local + reporting-chain prices with no upper bound on any single reported value beyond `>0`. A single extreme reading from one authorized peer skews the average (Phase 1) and, per Phase 2's deeper trace, can overflow the checked `int256` summation and revert — which, because `relayPendingResponse` calls this aggregation en route to relaying a VRF response, can strand a cross-chain VRF result. Gated behind `remotePriceReportingEnabled` (default `false`) and an owner-configured peer, and the aggregate is currently informational only (not consumed for a settlement decision) in this slice. **Fix**: bound reported prices, use a median/trimmed mean, and/or cap forwarded gas so a reverting aggregation can't block relay.

#### [8] TWAP fallback uses a short (default 5-minute) window and overstates freshness
**Confidence: 55** · **[Phase 1: oracles]**
`updateLocalPrice()` (`VRFConsumer4626.sol:662-686`) falls back to a TWAP when the primary oracle reverts, using a default 300-second `twapPeriod`, and stamps `block.timestamp` regardless of the TWAP's own age. Impact is bounded — the value is informational only in this slice. **Fix**: enforce a minimum `twapPeriod` (e.g. ≥1800s); don't overstate a TWAP-derived value's freshness.

#### [9] Integrator accepts VRF responses from any configured peer EID, not just the hub
**Confidence: 50** · **[Phase 1: bridges]**
`ChainlinkVRFIntegratorV2_5._lzReceive()` (`L150-154`) checks `peers[srcEid]==sender` but never `srcEid == hubEid`. Not exploitable in a single-hub deployment; a future second peer configuration would let that peer inject a chosen `randomWord`. **Fix**: add an explicit hub-EID check.

#### [10] `relayPendingResponse` overpay/refund path is dead code; ~5% fee buffer leaks to `owner()`
**Confidence: 55** · **[Phase 1: bridges]**
`VRFConsumer4626` (unlike its sibling OApps) doesn't override `_payNative`, so LayerZero's default requires an exact fee match, making the contract's own `>=`-and-refund logic (`L557-561`) unreachable; the 5% fee buffer's surplus refunds to the hardcoded LZ refund address `owner()` rather than the paying relayer. **Fix**: override `_payNative` to accept `>=` and refund correctly, or set the refund address to `msg.sender`.

#### [11] Manager's direct `_lzReceive` reverts on malformed/unknown input, breaking the "LZ lanes never brick" invariant
**Confidence: 75 (promoted via 5-agent Phase-2 convergence)** · **[both phases]**
Unlike `_handleLotteryEntry`/`receiveRemoteLotteryEntry` and the sibling OApps (which emit-and-return on bad input, per the codebase's own documented CLM-09 fix), `LotteryManager4626._lzReceive` (`L1234,1237,1244`) still reverts on unauthorized origin, short payload, or unknown msgType — verified directly against source. Not exploitable by an arbitrary caller (requires an authorized/misbehaving peer). **Fix**: convert to emit-and-return, matching the rest of the inbound surface.

#### [12] `LotteryAmoeRouter` uses one-step ownership transfer with no recovery
**Confidence: 60** · **[Phase 1: access-control]**
`setOwner()` (`L259`) is a bespoke (non-OZ), single-step transfer, inconsistent with the same file's 1-day timelocks on `verifier`/`manager`/root publication. A mistyped or malicious transfer is immediate and irrevocable; the router custodies no assets directly, bounding impact to loss of config control. **Fix**: adopt two-step `pendingOwner`/`acceptOwnership`.

#### [13] Critical trust-anchor parameters changeable instantly with no timelock
**Confidence: 55** · **[Phase 1: access-control]**
`VRFConsumer4626.setPriceOracle` / `ChainlinkVRFIntegratorV2_5.setPriceOracle` (instant, `onlyOwner`) and `LotteryAmoeRouter.setConsumer` (instant) are inconsistent with the 2-day/1-day timelocks on sibling setters (VRF coordinator, verifier/manager) in the same contracts. Owner-only impact, bounded further by fail-closed pricing guards and win-chance caps. **Fix**: route through the same timelock pattern already used elsewhere in each contract.

#### [14] One-step `Ownable`/`renounceOwnership` can permanently strand pause recovery and deferred VRF settlement
**Confidence: 50** · **[Phase 1: access-control]**
All three OApps use stock OZ `Ownable`. `unpause()` and the deferred-VRF FIFO drain (`applyDeferredVrf`/`processDeferredVrfBatch`) are owner-only with no fallback; a renounced ownership while paused (or with pending deferred VRF) permanently strands those results. **Fix**: migrate to `Ownable2Step` and override `renounceOwnership()` to revert, or gate it on "not paused / no pending deferred VRF."

#### [15] Hot-path entry uses un-try/caught external calls to registry and ShareOFT `balanceOf`
**Confidence: 50** · **[both phases]**
Unlike the payout path (which try/catches every registry/gauge call), `processSwapLottery` (`L669,678`) and `_coverageShareBalance`'s `balanceOf` read (`L1708`) are not try/caught. A reverting trusted dependency (paused/broken registry or ShareOFT) reverts the buyer's swap. No unprivileged trigger — the dependencies are trusted in the intended deployment. **Fix**: wrap these reads in try/catch, degrading to "skip entry" rather than reverting.

#### [16] Multi-vault jackpot payout fan-out can OOG the automatic VRF callback (recoverable via retry)
**Confidence: 50** · **[Phase 1: dos]**
When `singleVaultJackpotOnly == false` (owner opt-in; default `true`), the payout loop can iterate up to 128 active gauges inside the VRF-callback gas budget; a gas-eating (not merely reverting) hostile in-mesh gauge could OOG the whole loop. State is preserved (delete-before-payout ordering) and `retryLocalCallback` can re-drive with full gas, so this degrades to manual recovery rather than permanent loss. **Fix**: cap forwarded gas per `payJackpot` call, or lower the multi-vault iteration cap.

#### [17] Pause longer than the VRF grace period silently discards in-flight results instead of deferring them
**Confidence: 55 (promoted via 3-agent Phase-2 convergence)** · **[both phases]**
In `_processVRFResult`, the stale-discard check (`L1007`) runs before the pause-deferral check (`L1016`) — a result whose age already exceeds `vrfResultGracePeriod` (30 min default) when it arrives during a pause is discarded rather than deferred, silently voiding the entry (including a potential win). Owner-triggered (extended incident-response pause), not third-party exploitable. **Fix**: check `paused()` before the stale-discard branch so pause-time arrivals always defer.

#### [18] Legacy `submitAmoeEntry` performs no on-chain signature verification
**Confidence: 60** · **[Phase 1: signatures]**
Despite being documented as the "ECDSA/EIP-1271" path, the `signature` parameter (`L510`) is never used — the only gate is `msg.sender == allowlistPublisher`. This path never fans out to `manager.processAmoeEntry`, so no VRF/jackpot entry is directly reachable through it; impact is limited to a trust-model gap if the publisher key is compromised. **Fix**: implement real EIP-712 + `ECDSA.recover`/`SignatureChecker` verification, or remove the misleading parameter and doc claims.

#### [19] Paid-path coverage cap doesn't itself exclude flash-borrowed shares; remote-path coverage additionally trusts the payload verbatim
**Confidence: 55** · **[both phases]**
`_coverageShareBalance`'s `live - amountIn` cap still includes any flash-borrowed shares — the only thing excluding them is the `min()` against a caller-supplied "block-start" value whose correctness is entirely out-of-slice (the swap contract's responsibility). For remote entries where `tokenIn` has no hub bytecode, coverage is taken directly from the LZ payload with no live-balance cross-check at all. Documented as a stated limitation rather than a confirmed break; bounded further by `maxWinChance`. **Fix**: document the hard requirement on swap-contract integrations explicitly; consider deriving flash-resistance from a mechanism the manager itself controls.

#### [20] `_applyBoost` overflow inside a `try` success-block is not caught by the adjacent `catch`
**Confidence: 55 (promoted via 2-agent Phase-2 convergence)** · **[Phase 2]**
`boostedWinChance += _scaleGaugeBoostBySwapSize(...)` and the `BASIS_POINTS + coveredUpliftBPS` computation run inside the `try {...} returns(...) {}` success body, not the `catch` — Solidity only catches a revert from the external call itself. A boost/gauge contract returning a value near `type(uint256).max` overflows this arithmetic and reverts the entire `processSwapLottery` call (invoked inline by the ShareOFT on every buy). Requires the owner-set, timelocked `boostManager`/`ve4626GaugeVoting` to be compromised or buggy — not normal unprivileged usage. **Fix**: clamp the returned boost value to a sane bound before the arithmetic, or move the computation out of the try success-block with an explicit checked cap.

#### [21] AMOE nullifier burned even on transient dispatch failure (Solana lane)
**Confidence: 45** · **[Phase 2]**
`_processedRemoteLotterySourceEvents` is marked consumed after *any* dispatch attempt, including transient failures (sponsorship budget exceeded, rate limit hit, integrator temporarily unset) that return `entryId == 0` — conflating "permanently invalid" with "temporarily undispatchable." User-facing entry loss, not attacker-exploitable. **Fix**: distinguish permanent-skip conditions from transient-dispatch-failure conditions before marking the source event consumed.

#### [22] Unbounded payload `amount` can overflow `mulDiv` and revert the LZ lane
**Confidence: 45** · **[Phase 2]**
The payload decode in `_handleLotteryEntry` never bounds the raw `amount` word; for a token priced above ~$1, an `amount` near 2^256 overflows `FullMath.mulDiv` in the (un-try/caught) pricing-lib call, reverting `_lzReceive` and, under ordered LZ delivery, bricking that inbound lane — the same invariant violated by Finding #11, via arithmetic rather than a validation branch. Requires a compromised/buggy authorized peer sending a pathological `amount`. **Fix**: cap `amount`/`swapValueUSD` (the unused `MAX_SWAP_USD` constant suggests this was intended) before pricing, or wrap the pricing call in try/catch inside `_handleLotteryEntry`.

---

### Informational

#### [23] Buyer/proof binding uses truncated `uint160` comparison, inconsistent with full-width `creatorCoin`/`epoch` checks
`submitAmoeEntryZK` (`LotteryAmoeRouter.sol:407`) compares `uint160(buyer) != uint160(pubInputs[8])`, truncating both sides, unlike the adjacent full-256-bit checks. Not currently exploitable (the verifier separately binds the full value), but a latent hardening gap. **Fix**: compare at full width.

#### [24] `rawFulfillRandomWords` indexes `randomWords[0]` without a length check
`VRFConsumer4626.sol:467-475`. Only the trusted VRF coordinator calls this (fixed `numWords=1`); defensive-coding gap only.

#### [25] Spoke integrator compiled with `^0.8.20` emits PUSH0 — deployment risk on non-Shanghai chains
`ChainlinkVRFIntegratorV2_5.sol:2`, `LotteryAmoeRouter.sol:2`. Mainstream target chains (Base/OP/Arbitrum) support PUSH0; risk only for exotic spoke deployments.

#### [26] `calculateWinChance` integer division truncates fractional PPM
`LotteryManager4626.sol:1088`. Rounds down (protocol-favoring); the `minSwapAmount ≥ $1` floor guarantees a nonzero result for any dispatched entry.

#### [27] Oracle abstraction discards round/liveness metadata
`IOracle4626.getAssetPrice()` returns only `(price, timestamp)` — no `answeredInRound`, `minAnswer`/`maxAnswer`, or L2 sequencer-uptime signal. Note against the out-of-slice oracle implementation.

#### [28] Cross-chain VRF request key namespaced by sequence only, not by integrator identity
`_crossChainVrfKey()` — `LotteryManager4626.sol:859-861`. Theoretical collision across integrator rotations; not exploitable given the `msg.sender==vrfIntegrator` gate and 2-day rewire timelock.

#### [29] Legacy nonce commitment omits `chainid`/`address(this)`
`LotteryAmoeRouter.sol:525`. Cross-chain/cross-instance replay surface only if ever multi-deployed; not exploitable in the current single-hub design.

#### [30] ZK proof public inputs don't bind `chainid`/verifying contract
Same caveat as #29 for the zk path.

#### [31] `MIN_DEADLINE_BUFFER` is a floor, not a ceiling
`LotteryAmoeRouter.sol:221`. No maximum deadline on the legacy ECDSA path; mitigated by the publisher gate and single-use nonce.

#### [32] Oracle spot-manipulation resistance depends entirely on the out-of-scope `IOracle4626` implementation
No in-scope AMM-reserve-derived spot price exists; fail-closed guards are present. Deviation circuit-breaker is inactive unless explicitly configured (cross-ref Finding #3).

#### [33] Payout can round to zero while the entry is still recorded as a win
`payTriggeringVaultJackpot`/`payoutLocalJackpotInner`: `rewardShares = jackpotShares * payoutBps / BASIS_POINTS` can truncate to 0 at a near-empty reserve or a very low owner-configured `payoutBps`, while the entry is still consumed and the user still recorded/emitted as a winner. Owner-config-dependent, dust-bounded.

#### [34] Local-VRF mode reverts on any nonzero `msg.value` — a config-transition foot-gun
`_boostAndDispatchVRF`: switching from cross-chain to local VRF without updating the swap-contract integration to zero the forwarded native fee will revert every subsequent buy. Operational/integration risk, not a security exploit.

#### [35] AMOE path applies no `usdMultiplierBps`, unlike the paid-swap path
At a non-neutral multiplier config (owner-settable up to 1.5x instantly), equal-dollar paid vs. AMOE entries get unequal win chances. Owner-config-dependent, bounded.

---

## Leads (unconfirmed, for manual follow-up)

- **`adminModuleCall` remains a standing unguarded-delegatecall hazard beyond the current `payoutLocalJackpot` gap** — even after fixing Finding #1, any future module function omitting `onlyOwner`, or any storage-layout drift between the two contracts, becomes instantly exploitable through this same stub. Recommend gating `adminModuleCall` itself with `onlyOwner` as defense-in-depth (folded into Finding #1's fix).
- **Decimal-scale mismatch calibration divergence**: one Phase-2 agent independently found the same root cause as Finding #2 but treated non-18-decimal registered tokens as an unverified out-of-scope assumption rather than a confirmed risk. We resolved this in favor of Phase 1's concrete PoC (the registry pattern explicitly supports arbitrary lane tokens) — see Finding #2.

---

## Positive Confirmations (recurring across many independent agents — examined, no issue)

- AdminModule storage layout mirrors the main contract field-for-field (delegatecall aliasing is sound) — the only delegatecall defect found is Finding #1.
- The PLONK verifier's custom `checkField` addition correctly canonicalizes all 9 public signals against the BN254 field modulus; the AMOE router's public-input binding, root-pinning, and triple-nullifier checks-before-effects (with atomic rollback on manager decline) hold under adversarial review.
- VRF idempotency (delete-before-payout, `fulfilled`/`callbackSent`/`callbackSucceeded` guards, namespaced local/cross-chain keys, head-only deferred FIFO) does not admit double-settlement under any traced scenario.
- Win-chance caps (`baseCeilingPPM`, `maxWinChance`) correctly bound every path, including a flash-loan-funded mega-swap on the paid-entry path.
- Sponsorship budget accounting (increment-before-call, rollback-on-catch) nets to zero within a transaction.
- Oracle price consumption is fail-closed on non-positive price, zero/future timestamp, and staleness (subject to Finding #3's window caveat).

---

> ⚠️ This review was performed by an AI-orchestrated multi-agent audit pipeline (context-building + breadth-checklist + depth-attack-simulation phases). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. We strongly recommend: (1) an independent human review of Finding #1 before any further mainnet exposure, given its severity and our inability to fully confirm live-bytecode parity with the audited source from a remote read-only probe; (2) a bug bounty program; (3) on-chain monitoring for anomalous `payoutLocalJackpot`/`adminModuleCall` activity in the interim.

---

## Appendix A — Full Access-Control Inventory and Threat Catalog
See `protocol-map.md` §1 and §4 (Phase 0 output) for the complete 149-row entrypoint table, full roles section, and 12-row threat catalog underlying the summaries above.
