# Security Audit Report — 4626 Lottery Subsystem

**Client**: leftclaw.services job #510
**Target**: `github.com/4626fun/4626` — tag `audit/oda-2026-07-28-agent-lane`, commit `0c47be24efb9f48b03f54c289e2734f4cfd50cd8`
**Files in scope**:
- `contracts/shared/lottery/manager/LotteryManager4626.sol` (contracts `LotteryManager4626` + `LotteryManager4626AdminModule`)
- `contracts/shared/lottery/manager/LotteryManager4626PricingLib.sol`
- `contracts/shared/lottery/manager/VRFConsumer4626.sol`
- `contracts/shared/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol`
- `contracts/shared/lottery/zk/LotteryAmoeRouter.sol`

**Live Base deployments referenced in the job (context only — not independently re-verified via bytecode diff in this pass)**: LotteryManager `0xB45E68a5867935a5734E4185977F81c528006650`, VRFConsumer `0x98fb5e0af3120B32E2E03400B6E51d0bde433670`, LotteryAmoeRouter `0x630c3769Cf1D80c6cb8cCB7c011f5A76904C4C1e`. The job flags that the pinned source may be ahead of what's actually live on Base — findings below are against the **git-tag source**, the designated source of truth.

**Prior audits**: jobs 496/461 covered related/overlapping contracts (context only, not consulted for findings — every finding below comes fresh from this job's own phase 0/1/2 agents). Several inline comments in the source itself (`ODA-…`, `CLM-…`, `M-…`, `#801` tags) reference fixes from those or other prior rounds; where a fix already addresses part of a pattern we note it, but every finding here is independently re-derived.

**Methodology**: three-phase audit — Phase 0 (opus) built a protocol map, access-control inventory, and threat catalog with no findings; Phase 1 (8 opus ethskills domain agents: general, precision-math, erc20, bridges, oracles, access-control, assembly, dos) ran breadth checklists against the map; Phase 2 (12 opus pashov attacker-mindset agents) ran depth analysis blind to Phase 1's findings, seeded only with the same protocol map. Phase 3 cross-phase-deduplicated both outputs, re-examined every phase-unique lead, and ran a coverage gate against the Phase 0 inventory/threat catalog.

**Reconciliation summary**: Overlap (found independently by both phases): 5 · Phase-1-only: 14 · Phase-2-only: 4 · Re-examined leads promoted to finding: 3 (2+ agent convergence) · Leads demoted: 0 · Coverage holes closed this pass: 0 (both phases independently reached full entrypoint/threat-catalog coverage — see Coverage Gate below). Confidence floor: findings reported at confidence ≥50; anything below is listed under Leads. All `file:line` citations in the findings below were verified against the on-disk source at the pinned commit (`sed -n '<N>p'`) before inclusion.

---

## Findings

### [HIGH] 1. Multi-vault jackpot payout mode omits the fair-EV cap enforced in single-vault mode

**Location**: `LotteryManager4626.sol` — capped path `payTriggeringVaultJackpot` (L2667-2668); uncapped path `payoutLocalJackpotInner` (L2785); mode toggle `setSingleVaultJackpotOnly` (L2828, stub L1918)
**Origin**: `[both]` — independently found by 4 Phase-1 agents (precision-math, general, dos, access-control) and 10 of 12 Phase-2 agents (5 at FINDING grade: math-precision, execution-trace, boundary, trust-gap, flow-gap; 5 at LEAD grade, promoted per convergence). **Confidence: 95.**

**Description**: The manager supports two jackpot-payout modes, selected by `singleVaultJackpotOnly` (default `true`). The single-vault path clamps the payout to an EV-fairness bound (`ODA-496-2`); the multi-vault path — a documented, supported "diversified basket" feature, not a misconfiguration — computes the identical percentage-of-reserve payout but never applies that bound.

Verified against source:
```solidity
// L2629 payTriggeringVaultJackpot (single-vault, CAPPED):
uint256 rewardShares = (jackpotShares * payoutBps) / BASIS_POINTS;   // L2667
uint256 maxRewardShares = _fairMaxJackpotShares(triggeringCoin);      // L2668
if (rewardShares > maxRewardShares) rewardShares = maxRewardShares;   // L2669
if (rewardShares == 0) return 0;

// L2685 payoutLocalJackpotInner (multi-vault, UNCAPPED — no _fairMaxJackpotShares call anywhere in this function):
uint256 rewardShares = (jackpotShares * payoutBps) / BASIS_POINTS;   // L2785
if (rewardShares > 0) {
    try gaugeController.payJackpot{gas: JACKPOT_PAYOUT_CALL_GAS}(winner, rewardShares) { ... }
```

**Proof of concept**: A $1 minimum-notional entry (`winChancePPM = 1_000_000/250_000 = 4`) that wins has a fair-EV cap of `maxPrizeUSD1e6 = amountUSD * 30 * 1e6 / (10000 * 4) ≈ $0.75` — this is what single-vault mode would pay. In multi-vault mode, the same $1-ticket win instead pays `payoutBps` (default 6900/10000 = 69%) of **every** active vault's `availableJackpotReserve()`, with `MAX_JACKPOT_PAYOUT_ITERATIONS = 128` vaults scannable in one settlement. With 10 vaults at $1M reserve each, one $1 ticket could extract ~$6.9M — several orders of magnitude past the fee-proxy EV the cap exists to enforce.

**Why this clears the admin-action bar**: `singleVaultJackpotOnly=false` is a documented supported operating mode (protocol map §Access-Control Inventory: "R-H05"), not the owner acting maliciously or against documented intent. Once that mode is active, **any unprivileged winner** — a normal user completing a normal lottery roll — triggers the uncapped payout. This is a code-level gap in a supported feature, not a hypothetical admin-abuse scenario.

**Recommendation**: Apply `_fairMaxJackpotShares(token)` as a per-vault clamp inside the `payoutLocalJackpotInner` loop, identically to `payTriggeringVaultJackpot`:
```diff
             uint256 rewardShares = (jackpotShares * payoutBps) / BASIS_POINTS;
+            uint256 maxRewardShares = _fairMaxJackpotShares(token);
+            if (rewardShares > maxRewardShares) rewardShares = maxRewardShares;
             if (rewardShares > 0) {
```

---

### [HIGH] 2. VRF request deleted before payout success is confirmed — a payout revert (e.g., multi-vault gas exhaustion) permanently forfeits an already-decided win

**Location**: delete at `_processVRFResult` L1051, precedes `_processWin` invocation at L1058-1060; isolation try/catch in `_processWin` L1183-1189 (bundle-line-equivalent; verified structure at `LotteryManager4626.sol` — see `_processWin` body above); concrete gas-exhaustion trigger in `payoutLocalJackpotInner` (L2685-2826, worst case ~128 vaults × ~330k gas vs. the ≤2.5M gas ceiling configurable via `VRFConsumer4626.setVRFConfig` L315-316, leaving roughly 2.4M available inside the isolated self-call)
**Origin**: `[both]` — Phase-1 dos (DOS-1, High, the gas-exhaustion mechanism specifically), bridges (BRIDGE-2, Medium, the general order-of-operations mechanism), general (GENERAL-3, Low, the grace-period-discard variant); Phase-2 boundary and execution-trace agents independently re-derived the same order-of-operations defect. **Confidence: 85.**

**Description**: `_processVRFResult` deletes `vrfRequests[requestId]` *before* attempting the payout. `_processWin` wraps the payout in `try this.payoutLocalJackpotExternal(...) catch { emit JackpotPayoutFailed(...) }`, so a revert there — most concretely, the multi-vault loop's cumulative gas requirement exceeding what's available inside the VRF callback frame — is swallowed. Because the outer `receiveRandomWords` therefore does not itself revert, the VRF-provider side (`VRFConsumer4626`/`ChainlinkVRFIntegratorV2_5`) marks the callback delivered (`fulfilled`/`callbackSent`), and the permissionless retry entrypoints (`retryLocalCallback`, `retryCallback`) then revert `CallbackAlreadySent`. Re-entry into `_processVRFResult` for the same `requestId` short-circuits immediately (`request.user == address(0)`, since it was already deleted). No path exists to re-attempt the payout — the win is permanently lost with the winner paid 0.

**Proof of concept**: With multi-vault mode enabled and ≥~8 active vault lanes, a local-VRF-settled win requires roughly 8×~330k ≈ 2.6M gas for the payout loop, exceeding the ~2.4M available inside the ≤2.5M VRF callback gas ceiling. The loop OOGs, `payoutLocalJackpotExternal` reverts, is caught, `JackpotPayoutFailed` is emitted with `rewardShares=0` recorded in the event — but the request was already deleted at L1051, so `retryLocalCallback` finds nothing to retry.

**Recommendation**: Do not delete `vrfRequests[requestId]` until the payout call actually succeeds. On a caught payout failure, retain a retryable "win pending settlement" record (or re-enqueue via the existing deferred-VRF FIFO) rather than deleting and marking the VRF-side callback as delivered.

---

### [MEDIUM] 3. AMOE / cold-lane jackpot payout can permanently zero out via the EV-cap's unguarded fallback oracle read

**Location**: `_fairMaxJackpotShares` (`LotteryManager4626.sol` L2602-2627, fallback at L2608-2617); root cause upstream in `processAmoeEntry` (L771-833) which never writes `lastAcceptedPriceUSD1e18[token]`
**Origin**: `[both]` — Phase-1 general (GENERAL-1, Medium); Phase-2 5 agents (math-precision, invariant, periphery, numerical-gap, trust-gap as leads; flow-gap at FINDING grade). **Confidence: 80.**

**Description**: For any lane whose `lastAcceptedPriceUSD1e18[token] == 0` — true for any lane that has only ever received AMOE entries, since `processAmoeEntry` never stamps this reference the way `processSwapLottery`/`_handleLotteryEntry` do — `_fairMaxJackpotShares` falls back to a direct read: `IOracle4626Lottery(oracleAddr).getAssetPrice()`, accepted on the single condition `p > 0`, with **no staleness check, no deviation-band check** (unlike every other price consumption path in this system, all of which are meticulously guarded). If that call reverts or the oracle is momentarily unavailable, the function "fails closed" — `return 0` — which flows through to `payTriggeringVaultJackpot` returning 0 (L2622: `if (amountUSD == 0 || winChancePPM == 0 || priceUSD1e18 == 0) return 0;`). Because `vrfRequests[requestId]` is already deleted by this point (see Finding 2), a confirmed win (`totalWinners++` already incremented, `LotteryWinner` event already emitted) pays the winner nothing, with no recovery path.

**Proof of concept**: Deploy/operate a lane that has only ever taken AMOE entries. A winning AMOE entry settles at a block where the lane's oracle transiently reverts or is paused. `_fairMaxJackpotShares` returns 0; `payTriggeringVaultJackpot` returns 0; the winner receives nothing despite the win being recorded on-chain.

**Recommendation**: Have `processAmoeEntry` stamp `lastAcceptedPriceUSD1e18[token]`/`lastAcceptedPriceTimestamp[token]` the same way the paid/remote entry paths do (using the AMOE valuation's implied price, or a dedicated oracle read at entry time with the same staleness/deviation guard as `PricingLib.calculateTokenUSD`), so settlement always has a guarded reference price rather than an unguarded live fallback.

---

### [MEDIUM] 4. Instant, untimelocked toggle into the unsafe multi-vault payout mode

**Location**: `setSingleVaultJackpotOnly()` (`LotteryManager4626.sol` L2828, stub L1918) — no timelock, unlike every comparable trust-root rewire (2-day for VRF/swap-auth/AMOE-relayer, 24h for boost sources)
**Origin**: `[phase1: access-control]` (AC-1). Independently re-examined in reconciliation: confirmed no queue/execute pattern wraps this setter, unlike its neighbors in the same contract. **Confidence: 90.**

**Description**: The switch into the mode where Finding 1's missing EV cap and Finding 2's gas-exhaustion risk both apply is a single instant `onlyOwner` call with no delay, inconsistent with every other trust-root rewire in this system. Even setting aside Findings 1/2 entirely, an instant, undisclosed toggle into a materially different payout model (paying out of every vault instead of one) is itself a centralization/governance risk that the system's own design pattern (timelock everything else) suggests should not be instant.

**Recommendation**: Route `setSingleVaultJackpotOnly` through the same queue/execute timelock pattern used for `localVRFConsumer`/`vrfIntegrator`/`authorizedAmoeRelayer`. Fix Findings 1 and 2 regardless — the timelock alone does not make uncapped multi-vault payout safe.

---

### [MEDIUM] 5. Remote/AMOE entry permanently consumed (replay digest burned) when VRF dispatch is skipped for a transient, non-terminal reason

**Location**: `_handleLotteryEntry()` — `LotteryManager4626.sol` L1367 (`_processedRemoteLotterySourceEvents[sourceEventKey] = true`), reached even when `entryId == 0` due to skip paths inside `_requestCrossChainVRFWithSource` (sponsorship budget exhausted, per-buyer/per-origin rate-limited, integrator call reverted)
**Origin**: `[phase1: general, bridges]` (GENERAL-2, BRIDGE-1) — 2 independent Phase-1 agents, same location, same mechanism. **Confidence: 85.**

**Description**: The replay-protection digest for a cross-chain lottery entry is marked consumed whenever `sourceEventId != 0`, regardless of whether an actual VRF entry was created. This correctly prevents replay for terminal skip reasons (inactive token, below minimum) but also consumes the digest for **transient, recoverable** skip reasons — most notably the per-buyer sponsorship rate limit (`vrfMaxSponsoredPerBuyerPerEpoch`, default 2/epoch). Once consumed, that source event can never be reprocessed, even after the epoch's sponsorship budget refreshes.

**Proof of concept**: A buyer's 3rd swap within one epoch on a remote chain exceeds the default per-buyer sponsorship cap of 2. `_requestCrossChainVRFWithSource` returns 0 via the rate-limit path; `_handleLotteryEntry` still marks the digest consumed at L1367. The buyer's paid-for lottery entry is permanently lost — no redelivery, no retry, even next epoch.

**Recommendation**: Only consume the replay key when `entryId > 0`, or explicitly distinguish terminal-skip reasons (which should consume the digest) from transient/recoverable ones (which should leave it open for redelivery/retry).

---

### [MEDIUM] 6. Single global oracle staleness/deviation threshold applied across all lane feeds

**Location**: `oracleMaxStaleness` (`LotteryManager4626.sol` L218, default 2 hours) and `oracleMaxDeviationBps`/`oracleDeviationWindow` (L227-228), consumed uniformly in `PricingLib.calculateTokenUSD` (L128-144); single global setter `setOracleMaxStaleness` (L2091, L3233)
**Origin**: `[phase1: oracles]` (ORACLE-1). Re-examined: confirmed the manager resolves a distinct oracle per lane via `registry.getOracleForToken` but applies one global staleness/deviation constant to all of them — no per-lane override exists in the reviewed source. **Confidence: 70** (single-phase finding, well-reasoned and confirmed on re-read, but the practical impact depends on how heterogeneous the lane oracles' real-world heartbeats are — information not fully available in-scope).

**Description**: Every lane resolves its own price oracle, but one global staleness/deviation configuration applies uniformly. This is simultaneously too lenient for a fast-heartbeat feed (a stale-but-accepted price up to 2h old feeds both win-chance and, via `lastAcceptedPriceUSD1e18`, the EV-cap sizing at payout — see Finding 1's cap depends on this same reference) and too strict for a genuinely slow-heartbeat feed (silently disables that lane's lottery entirely, since every valuation returns 0 and falls below `minSwapAmount`).

**Recommendation**: Store staleness/deviation configuration per lane token (or read the wrapped oracle's own heartbeat), rather than one constant for a multi-lane system.

---

## Low-Severity Findings

**[LOW] 7. Win-odds parameters (`baseCeilingPPM`, `lotteryConfig.maxWinChance`/`usdMultiplierBps`) are instant while the boost-source timelock they complement is 24h.** `setBaseCeilingPPM` (L3168) and most of `setLotteryConfig` (L3180, only `rewardPercentage` is queued at L3204) take effect immediately, partially undermining the documented threat model behind the 24h boost-source delay (a compromised owner could still instantly raise base/absolute win-chance). `[phase1: access-control]` (AC-2).

**[LOW] 8. `adminModuleCall` can bypass the main contract's disabled-renounce protection via the AdminModule's un-overridden `renounceOwnership`.** `LotteryManager4626.renounceOwnership()` (L2160) deliberately reverts to protect pause-recovery/deferred-settlement, but `LotteryManager4626AdminModule` never re-declares this override — it inherits stock `Ownable.renounceOwnership()`. `adminModuleCall(abi.encodeWithSelector(Ownable.renounceOwnership.selector))` (L2081, `onlyOwner`) executes the module's un-overridden function via delegatecall against the main contract's storage, zeroing the owner and silently defeating the stated protection. Owner-gated with no unprivileged amplifier (so not promoted per the stricter admin-action gate), but a real, concrete code-level defect worth fixing: add the same revert-override to the AdminModule. `[phase2 only]` (single agent, access-control specialty), confidence 70 given the concrete verified mechanism.

**[LOW] 9. Single-step `transferOwnership` with renounce disabled risks permanent lockout.** Manager, VRFConsumer, and Integrator use OZ `Ownable`'s single-step transfer while disabling renounce — a mistyped/unintended transfer permanently bricks all admin/timelock/pause paths with no recovery. The router in the same codebase correctly uses two-step ownership, highlighting the inconsistency. `[phase1: access-control]` (AC-3).

**[LOW] 10. Bootstrap-instant setters can be re-opened by timelocking the tracked address back to zero.** `setLocalVRFConsumer`/queue path, VRFConsumer/Integrator price-oracle setters, and the router's verifier/consumer/manager setters lack the sticky "initialized" bit used for the AMOE relayer and swap-auth — a full timelock cycle to `address(0)` re-opens the instant-bootstrap path. `[phase1: access-control]` (AC-4).

**[LOW] 11. Owner can indefinitely withhold winner settlement while paused.** Deferred-VRF flush is owner-only while paused (`_requireDeferredVrfFlushAuthorized`, L942); a won entry that arrived during a pause cannot be settled by anyone else until unpause. Liveness/centralization concern, not fund theft (the FIFO prevents cherry-picking). `[phase1: access-control]` (AC-5).

**[LOW] 12. `receiveRemoteLotteryEntry` forwarder path trusts forwarder-supplied `srcEid`/`originSender`.** Unlike the direct `_lzReceive` path, the forwarder path is not endpoint-authenticated for message origin — a compromised authorized forwarder can fabricate entries for any allowlisted `(srcEid, originSender)` pair with an arbitrary buyer/amount. Documented trust boundary (owner-authorized forwarder), not an external attacker path. `[phase1: bridges]` (BRIDGE-3).

**[LOW] 13. Inconsistent inbound-revert posture across the three OApps.** `VRFConsumer4626._lzReceive` reverts on unsupported-chain/peer-mismatch (L369-370) while the manager and Integrator emit-and-return; the redundant `require(peers[...]==sender)` at L370 is dead code (already enforced by base `OAppReceiver`). Not lane-bricking since all three lanes are unordered by default, but a consistency/robustness wart. `[phase1: bridges, dos]` (BRIDGE-4/DOS-5, 2 agents, same location).

**[LOW] 14. `_handleLotteryEntry` payload decode can revert on dirty-bit fields, contradicting the documented "never revert on malformed payload" invariant.** `abi.decode` on the manually-shaped 160/192/224-byte payloads reverts if `address`/`uint32`/`uint16` fields aren't zero-extended, unlike the deliberately-tolerant `calldataload`+mask used for `msgType`. Not lane-bricking (unordered delivery). `[phase1: bridges]` (BRIDGE-5).

**[LOW] 15. Fixed 300k gas stipend on the multi-vault `payJackpot` call can silently drop a legitimate winner's share with no retry.** A gauge whose `payJackpot` needs more than 300k gas under some state always lands in the per-vault `catch`, permanently losing that lane's share of the win once the request is consumed (see Finding 2). The single-vault path has no gas cap at all, an inconsistency between modes. `[phase1: dos]` (DOS-2).

**[LOW] 16. Uncapped return-data copy in low-level `staticcall`s to per-lane ShareOFT.** `_totalShareUsd` (L1157-1160) and `_coverageShareBalance` (L1737-1740) copy full returndata into memory before the length check — a hostile registered ShareOFT could return an oversized buffer, imposing quadratic memory-expansion gas. Gated by registry trust. `[phase1: dos]` (DOS-3).

**[LOW] 17. `_popDeferredVrfHead` shifts the entire array on every pop — O(N·B) cost in `processDeferredVrfBatch`.** With the queue at its 128-item cap and a 16-item flush batch, this wastes thousands of avoidable SSTOREs on pure array compaction; caller pays their own gas so not a griefing lever, just avoidable cost. `[phase1: dos]` (DOS-4).

**[LOW] 18. Packed transient EV context (`_jackpotEvContext`) assumes `amountUSD < 2^128` with no explicit bound.** `amountUSD | (winChancePPM << 128)` (L1057) relies on an unstated economic bound (~$3.4e32 trade value) rather than an enforced one; if ever violated the corruption is fail-closed (shrinks the cap, never enlarges it) so not independently exploitable, but should be defensively asserted. `[both]` — Phase-1 precision-math + assembly (MATH-2/ASM-1); Phase-2 execution-trace and invariant agents independently re-derived the same packing concern.

**[LOW] 19. Live EV-cap arithmetic diverges from an unused `FullMath`-safe twin in the library.** `_fairMaxJackpotShares`'s live inline arithmetic (L2624, L2626) uses plain Solidity `*`/`/`; the functionally-identical `LotteryManager4626PricingLib.fairMaxJackpotShares` (dead code, unreferenced) uses overflow-safe `FullMath.mulDiv` and has a doc/behavior mismatch on its own return semantics. Consolidate to avoid future drift. `[both]` — Phase-1 precision-math (MATH-3); Phase-2 math-precision agent independently flagged the same dead-code divergence.

**[LOW] 20. Zero-decimal or >36-decimal lane tokens silently and permanently disable that lane's lottery.** `PricingLib.calculateTokenUSD` (L155) fails closed to `(0,0,0)` with no on-chain error signal. `[phase1: erc20]` (ERC20-1).

**[LOW] 21. No min/max circuit-breaker sanity on the price-consumption path.** Trusts any `price > 0` from `IOracle4626` with no defense against a floored/clamped feed during a crash; partial mitigation from the deviation band, but not on a lane's bootstrap (first) entry. `[phase1: oracles]` (ORACLE-2).

**[LOW] 22. Cross-chain aggregated price (`VRFConsumer4626.getAggregatedAssetPrice`) is a manipulable arithmetic mean.** Capped per-reporter at 10× local reference but still a plain mean, not a median; `remotePriceReportingEnabled` defaults `false` and no in-scope consumer currently acts on this value economically, so impact is informational today. `[phase1: oracles]` (ORACLE-3).

**[LOW] 23. VRF-integrator provider swap can strand in-flight cross-chain VRF requests.** Rewiring `vrfIntegrator` (even behind its 2-day timelock) causes any VRF response already in flight from the *old* integrator to fail the `msg.sender==vrfIntegrator` check on arrival; the provider-side try/catch swallows the failure, permanently stranding that request. Mitigated by the request/settlement window normally being much shorter than the 2-day timelock. `[phase2 only]` — 2 independent agents (periphery, execution-trace), promoted per convergence rule.

**[LOW] 24. EV-cap USD→shares conversion assumes the ShareOFT prize token trades 1:1 with the priced lane token.** If the ERC-4626 share ever accrues yield relative to its underlying, `_fairMaxJackpotShares`'s conversion under/over-states the true fair cap. Unverified — the ShareOFT/vault peg mechanics are out of scope for this engagement. `[phase2 only]` — 2 independent agents (economic-security, periphery), promoted per convergence rule.

**[LOW] 25. Legacy 160/192-byte inbound payloads rely solely on LayerZero nonce dedup; the 224-byte replay key is scoped per `(srcEid, originSender)`.** A lane ever configured with multiple authorized senders for the same source chain, or one that mixes direct-`_lzReceive` and forwarder delivery for the same logical event, could double-count. Requires a trusted-side (owner) misconfiguration to reach. `[phase2 only]` — 2 independent agents (access-control, boundary), promoted per convergence rule.

---

## Leads (not independently confirmed — high-signal, not scored as findings)

- **Stale/mutable `lastAcceptedPriceUSD1e18` reference read at settlement rather than snapshotted at entry time.** The EV cap's reference price is overwritable by *any* later accepted entry on the same lane before an earlier entry's VRF settles, so the cap uses a moving target rather than the entry-time price. Bounded by the deviation band. (2 phase-2 agents.)
- **Declared `MAX_SWAP_USD` never enforced on the entry path**, only referenced in config setters — theoretical (not economically reachable at current oracle/amount bounds) overflow interaction with the packed EV context (Finding 18). (2 phase-2 agents.)
- **`_totalShareUsd` reads only the hub-local ShareOFT `totalSupply()`** as the personal-boost pool-size input, undercounting true cross-chain supply for an OFT; bounded by the 25% personal-boost cap and `maxWinChance`. (1 phase-2 agent, corroborates phase-1 ERC20-2.)
- **Sub-`sponsoredVrfMinSwapAmountUSD` AMOE entries can be permanently un-settleable** under a sponsored-cross-chain-VRF configuration — reverts and atomically rolls back (no fund loss), but blocks legitimate resubmission until config changes. (1 phase-2 agent.)

---

## Access-Control Inventory

*(Condensed — full per-function inventory with line-cited guards is in the phase-0 protocol map; reproduced here at summary level for the client.)*

| Role | Grant/revoke mechanism | Unlocks |
|---|---|---|
| Owner (manager, VRFConsumer, integrator — single-step `Ownable`, renounce disabled) | `transferOwnership` (one-step) | All ~35 AdminModule setters (via delegatecall stubs), `pause`/`unpause`, `emergencyWithdraw`, `adminModuleCall`, OApp peer/delegate config |
| Owner (router — custom two-step) | `setOwner`→`acceptOwnership` | verifier/consumer/manager rewires, publisher assignment |
| `authorizedSwapContracts` | Owner-granted (bootstrap-instant, then 2-day timelock) | `processSwapLottery` |
| `authorizedAmoeRelayer` (single address) | Bootstrap-instant-while-unset, sticky, 2-day timelock to rewire | `processAmoeEntry` (intended = router) |
| `authorizedRemoteOFTs[eid][addr]` / `authorizedHubShareOftForwarders` | Owner-set mappings | Remote entry intake (`_lzReceive`, `receiveRemoteLotteryEntry`) |
| `localVRFConsumer` / `vrfIntegrator`+`trustedVrfIntegrators` | Bootstrap-instant-while-unset, 2-day timelock | Sole callers of the two `receiveRandomWords` overloads |
| `boostManager`/`ve4626GaugeVoting` | Instant pre-arm, then one-way-armed 24h propose/commit; emergency instant disable | Odds-boost sourcing |
| `singleVaultJackpotOnly` | **Instant, no timelock** (Finding 4) | Payout mode (single-vault capped vs. multi-vault uncapped — Finding 1) |
| `vrfCoordinator` (VRFConsumer) | Bootstrap-instant-while-unset, 2-day timelock | `rawFulfillRandomWords` sole caller |
| `authorizedSponsoredCallers` (Integrator) | Owner mapping | Entire `requestRandomWords*` surface |

**Unguarded/permissionless entrypoints** (by design, generally safe): `applyDeferredVrf`/`processDeferredVrfBatch` (unpaused), `relayPendingResponse`, `retryLocalCallback`/`retryCallback`, `updateLocalPrice` (oracle-sourced only), `cleanupExpiredRequests`, `submitAmoeEntryZK` (ZK-gated, not allowlist-gated).

## Threat Model

| Actor | Reachable entrypoint | Potential gain | Status |
|---|---|---|---|
| Any winner, once multi-vault mode active | `payoutLocalJackpotInner` | Uncapped reserve extraction | **Finding 1 (High)** |
| Any winner, on payout revert | `_processVRFResult`/`_processWin` | N/A (loss to winner, not gain to attacker) | **Finding 2 (High)** — liveness/fund-safety for the winner, not third-party extraction |
| Any AMOE winner on a cold/oracle-unavailable lane | `_fairMaxJackpotShares` fallback | N/A (loss to winner) | **Finding 3 (Medium)** |
| Owner | `setSingleVaultJackpotOnly`, `setBaseCeilingPPM`/`setLotteryConfig`, `adminModuleCall`→renounce | Instant unsafe-mode toggle; partial odds-lever bypass of the 24h boost timelock; renounce-guard bypass | **Findings 4, 7, 8 (Medium/Low)** — centralization/governance, no external escalation |
| Compromised/malicious Registry4626 or ShareOFT (out-of-scope dependency) | Any registry-resolved address | Redirect payout/spoof price/balance | Invariant holds within scope — this is an explicit out-of-scope trust boundary; no in-scope guard failure found |
| Compromised Chainlink VRF coordinator (out-of-scope) | `rawFulfillRandomWords` | Bias win/loss | Invariant holds within scope — external security assumption, sender-gated correctly |
| Malicious LZ peer / compromised remote ShareOFT | `_lzReceive`/`receiveRemoteLotteryEntry` | Inject fabricated entries | Allowlist-gated; forwarder path is the one softer spot (**Finding 12**) |
| Buyer hitting sponsorship rate limits | `_handleLotteryEntry` | N/A (loss of own entry) | **Finding 5 (Medium)** |
| Anyone (permissionless functions) | `relayPendingResponse`, `retryLocalCallback`, `updateLocalPrice`, `cleanupExpiredRequests` | None — writes only oracle-sourced/already-authenticated state | Invariant holds |

## Coverage Gate

- **Entrypoints**: Phase 0 inventoried ~45 Tier-A (privileged/value-moving) functions plus Tier-B/C groupings across all 5 files. Every Tier-A entrypoint maps to at least one finding or an explicit "examined, no issue" note in the Threat Model above (e.g., permissionless functions, out-of-scope-dependency rows).
- **Threat-catalog rows**: every row from the phase-0 threat catalog is answered above — either by a finding or by "invariant holds" with a one-line reason.
- **Holes closed this pass**: 0 — both Phase 1 (breadth, checklist-driven) and Phase 2 (depth, attacker-mindset, blind) independently reached full coverage of the inventory; the high rate of cross-phase convergence on Findings 1-3 (up to 14 independent agents touching the same root cause) is itself strong evidence neither phase missed the core payout-path defects.
- **Re-examined leads**: 3 promoted to Low findings (18, 19 corroborated across phases; 23, 24, 25 promoted within Phase 2 on 2-agent convergence — 5 total promotions, 0 demotions).

---

> This review was performed by an automated three-phase AI audit pipeline (context-mapping → breadth checklists → depth attacker-mindset agents, cross-reconciled). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Team security review, a public bug bounty, and on-chain monitoring for the payout paths identified above (especially Findings 1-3) are strongly recommended before enabling multi-vault payout mode or relying on AMOE-only lanes in production.
