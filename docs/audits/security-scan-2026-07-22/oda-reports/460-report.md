# Security Review — LotteryManager4626

**Audit target**: `contracts/shared/lottery/manager/LotteryManager4626.sol` (contains two contracts: `LotteryManager4626` and `LotteryManager4626AdminModule`, the latter reached via `delegatecall`) and `contracts/shared/lottery/manager/LotteryManager4626PricingLib.sol`.

**Source of truth**: `github.com/4626fun/4626`, tag `audit/oda-2026-07-22`, commit `423e0e3a607884de6e60bccd06f722a8aba770ee` (verified via `git rev-parse HEAD` on the audit clone).

**Job scope note**: The client's job description for this engagement ("probe only — LotteryManager4626 source pin ...") named only `LotteryManager4626`; scope was resolved to `LotteryManager4626.sol` (which contains both `LotteryManager4626` and its delegatecall companion `LotteryManager4626AdminModule` in one file) plus its directly-imported `LotteryManager4626PricingLib.sol` library (~3,278 LOC total). Other files in the same repo tree (VRF consumer, AMOE router, registry, vault modules, governance, strategies) are out of scope for this job and were not reviewed here.

**Methodology**: Three-phase review — (0) context building: a protocol map, access-control inventory, and threat catalog built by 3 parallel agents with no findings; (1) breadth: 8 domain-specialist agents (general, precision-math, access-control, bridges, oracles, assembly, DoS, ERC20) walking curated checklists; (2) depth: 12 attacker-mindset agents (9 single-specialty + 3 cross-lens gap-hunters), run **blind** to phase-1's findings, each independently reading the full source and the phase-0 map. All hunting agents ran on `opus` given the scope size. This reconciliation cross-checks both phases' raw output against each other and against the phase-0 inventory/catalog (coverage gate below).

**Confidence floor**: All findings below Low+ are reported; anything with confidence &lt; 50 or an incomplete exploit chain is listed under **Leads**, not scored as a finding.

---

## Reconciliation summary

- **Overlap** (found independently by both phases): 5 findings — including the Critical and the High.
- **Phase-1-only**: 10 findings (mostly DoS/liveness/config-hygiene items surfaced by the ethskills checklist agents).
- **Phase-2-only**: 2 findings — including a Medium (VRF pause/staleness ordering) independently verified by the orchestrator directly against source.
- **Re-examined leads**: several phase-2 leads on the same "non-Solana forwarder `sourceEventId==0` skips replay guard" issue converged with a phase-1 finding and are folded into it (kept, not demoted). A handful of narrower phase-2 leads (cross-lane prize-scope asymmetry in multi-vault mode, pre-arming boost-source instant window, a boost-scale constant mismatch) remain **Leads** — real code smells, but conditional on non-default configuration or additional out-of-scope assumptions, so not promoted to scored findings.
- **Coverage**: `Entrypoints: ~75 external/public functions across both contracts in the inventory, all examined. Threat-catalog rows: 7, 7 answered. Coverage holes closed this pass: 0` (every entrypoint and catalog row was already covered by phase 0/1/2; no fresh re-read was required in this reconciliation pass).

**The single most important result of this audit**: the Critical finding below (`adminModuleCall` → `payoutLocalJackpot`) was independently rediscovered, with a full concrete calldata-level proof of concept, by **16 of the 20 total sub-agents run across both phases** (4 of 8 phase-1 domain agents, and all 12 of 12 phase-2 attack agents, the latter entirely blind to each other and to phase 1). This is about as strong a convergence signal as this methodology can produce.

---

## Access-Control Inventory (condensed)

Full entrypoint-by-entrypoint table available on request; the load-bearing structure:

- **User-facing, gated**: `processSwapLottery` (`onlyAuthorizedSwapContract`), `processAmoeEntry` (`msg.sender == authorizedAmoeRelayer`), `receiveRandomWords` ×2 (sender-pinned to `localVRFConsumer`/`vrfIntegrator`), `receiveRemoteLotteryEntry` (double-gated: hub forwarder allowlist + remote-OFT origin allowlist), `_lzReceive` (remote-OFT allowlist + LZ peer check), `applyDeferredVrf`/`processDeferredVrfBatch` (owner-only).
- **Admin surface**: ~35 thin stubs in `LotteryManager4626` whose body is only `_delegateAdmin()` (no modifier on the stub itself — the real guard lives in `LotteryManager4626AdminModule`, reached via `delegatecall`, where every function is `onlyDelegateCall onlyOwner` — **except one**, see Finding 1). A second, generic dispatcher `adminModuleCall(bytes)` forwards **arbitrary caller-supplied calldata** to the same module with **no modifier at all**.
- **Roles**: `owner` (single-step `Ownable`, root of all administration); `authorizedSwapContracts`/`authorizedAmoeRelayer`/`localVRFConsumer`/`vrfIntegrator` (bootstrap-instant-while-unset, 2-day timelocked rotation thereafter); `boostManager`/`ve4626GaugeVoting` (instant legacy setter until a one-way `armBoostSourceTimelock()`, then 24h propose→commit, plus an always-available instant kill-switch); `authorizedHubShareOftForwarders`/`authorizedRemoteOFTs` (owner-only, no timelock).
- **Unguarded state-changing entrypoints reachable by anyone**: `receive()` (funds the sponsorship balance, benign); and, structurally, every admin stub (all but one revert downstream at the module's `onlyOwner` for a non-owner caller — the one exception is Finding 1).

## Threat Model

| Actor | Reachable entrypoint | Potential gain | Status |
|---|---|---|---|
| Arbitrary unprivileged caller | `adminModuleCall` → module `payoutLocalJackpot` | Up to 100% of any/every vault's jackpot reserve, no win required | **Addressed by Finding 1 (Critical)** |
| Arbitrary unprivileged caller | Any other admin stub via `adminModuleCall`/`_delegateAdmin` | None beyond what `onlyOwner` already blocks | Invariant holds — independently re-verified by 5+ phase-2 agents individually diffing every module function's guard |
| Compromised/malicious `localVRFConsumer` or `vrfIntegrator` | `receiveRandomWords` (either overload) | Controls win/loss outcome for existing requests only, cannot fabricate request params | Invariant holds — sender-pinning + settle-once-before-payout verified |
| Malicious/compromised registry-listed vault or gauge | Hostile return values from registry lookups | Mis-reported reserve/redirected payout at gauge's own discretion | Out of this file's scope (registry `immutable`, trusted); per-gauge failure isolated via try/catch |
| Owner (trusted, broad by design) | Non-timelocked config, `emergencyWithdraw` (`whenPaused`, recipient pinned to `owner()`) | Broad instant control | By design; centralization noted, not a finding beyond Findings 8/9 (ownership hygiene) |
| Malicious/buggy remote OFT or hub forwarder | `_lzReceive`, `receiveRemoteLotteryEntry` | Fabricated/duplicate entries | **Addressed by Finding 6** (non-Solana lanes lack the documented non-zero-`sourceEventId` enforcement) |
| Sponsorship-budget griefer | Repeated low-cost sponsored VRF/callback triggers | Exhaust epoch budget | Invariant holds — rate limits verified sound (increment-before-call, symmetric rollback) by 3+ agents across both phases |

---

## Findings

### [1] Unauthenticated jackpot drain: `adminModuleCall` forwards arbitrary calldata to `payoutLocalJackpot`, which has no owner/caller gate
**Severity**: Critical
**Origin**: `[both]` — found independently by 16/20 agents (ethskills: general, access-control, assembly, bridges; pashov: all 12 of 12).
**Location**: `LotteryManager4626.adminModuleCall(bytes)` (`LotteryManager4626.sol:1989-1999`) → `delegatecall` → `LotteryManager4626AdminModule.payoutLocalJackpot(address,address,uint16)` (`LotteryManager4626.sol:2461-2473`); `onlyDelegateCall` modifier (`LotteryManager4626.sol:2359-2362`).

**Description**: `adminModuleCall` carries no access modifier:
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
It copies caller-supplied calldata verbatim and `delegatecall`s the immutable admin module with it — any address can select any module function. The module's `payoutLocalJackpot` is guarded only by:
```solidity
modifier onlyDelegateCall() { if (address(this) == _self) revert OnlyDelegateCall(); _; }
function payoutLocalJackpot(address triggeringCoin, address winner, uint16 payoutBps)
    external onlyDelegateCall returns (uint256 totalSharesPaid) {
    if (winner == address(0)) revert ZeroAddress();
    if (uint256(payoutBps) > BASIS_POINTS) revert InvalidAmount();
    if (_payoutLock == 1) revert ReentrancyGuardReentrantCall();
    _payoutLock = 1;
    totalSharesPaid = payoutLocalJackpotInner(triggeringCoin, winner, payoutBps);
    _payoutLock = 0;
}
```
`onlyDelegateCall` checks only "did this arrive via delegatecall" — never who the caller is. Every one of the ~35 other module functions carries `onlyDelegateCall onlyOwner`; `payoutLocalJackpot` is the sole exception (independently re-verified function-by-function by five separate agents). Under delegatecall the module runs in the main contract's storage/identity context, so the downstream `ITradeFeeCollector4626(gauge).payJackpot(winner, ...)` call is seen by the gauge as coming from the manager itself — the authorized payout authority — so it succeeds. In default `singleVaultJackpotOnly = true` mode, one call pays `winner` up to 100% (`payoutBps ≤ 10000`) of the chosen active vault's `availableJackpotReserve()`; in multi-vault mode, one call sweeps up to 128 active vaults.

Additional consequences noted by multiple agents: this path bypasses **both** the protocol's own reward-percentage cap (`lotteryConfig.rewardPercentage`, normally ≤69% per the config) **and** its 2-day timelock on changing that cap — the attacker simply supplies `payoutBps` directly. There is also no `whenNotPaused` on this path, so the owner's `pause()` — the only other incident-response lever, and the gate on the `emergencyWithdraw` rescue — cannot stop an in-progress drain. Each call also emits the normal win events (`LotteryWon`, `CrossChainJackpotPaid`, `MultiTokenJackpotWon`) and increments the normal stats, so the drain is indistinguishable from a legitimate win in the event/stat stream.

**Proof of Concept** (calldata-level, independently reproduced by 2+ agents):
- Selectors: `adminModuleCall(bytes)` = `0xa847fca8`; `payoutLocalJackpot(address,address,uint16)` = `0x8a0bc866`.
- `attacker` calls `LotteryManager4626.adminModuleCall(abi.encodeWithSelector(0x8a0bc866, triggeringCoin, attacker, uint16(10000)))` where `triggeringCoin` is any active registry token with a funded gauge.
- No value, no VRF request, no swap, no entry, no owner key. `onlyDelegateCall` passes (call arrived via delegatecall); `winner != 0` and `payoutBps ≤ 10000` pass; `_payoutLock == 0` passes.
- `payTriggeringVaultJackpot` computes `rewardShares = availableJackpotReserve() * 10000 / 10000 = availableJackpotReserve()` and calls `gauge.payJackpot(attacker, rewardShares)` — the gauge sees `msg.sender == LotteryManager4626` (authorized) and transfers the full reserve to `attacker`.
- Repeatable per active token (single-vault mode) or in one call across up to 128 vaults (multi-vault mode); `_payoutLock` resets to 0 after each call, so this is repeatable indefinitely as reserves refill.

**Recommendation**: `payoutLocalJackpot` must never be reachable from the generic raw-calldata-forwarding surface. Two complementary changes:
1. Restrict `adminModuleCall` to `onlyOwner` (every function it is documented to reach — the ODA-426-F3 queue/execute/cancel/view helpers — is already `onlyOwner` inside the module; the legitimate payout uses the separate, typed `_payoutLocalJackpot()` internal delegatecall at L1770, not `adminModuleCall`, so this closes the hole without breaking any legitimate flow).
2. Defense-in-depth: have `LotteryManager4626._payoutLocalJackpot()` set a transient-storage sentinel immediately before its typed delegatecall (cleared after), and require that sentinel inside `payoutLocalJackpot`, so the function is only ever executable from the intended `_processWin → _payoutLocalJackpot` path regardless of how it's reached. Also consider re-adding `whenNotPaused` and enforcing `payoutBps <= lotteryConfig.rewardPercentage` at the module level as additional layers.

---

### [2] `return(0,0)` in the remote-entry replay guard bypasses the `nonReentrant` epilogue — permanent DoS of the entire contract
**Severity**: High
**Origin**: `[both]` — ethskills-assembly agent and pashov execution-trace agent, found independently and blind to each other; independently re-verified by the orchestrator directly against source.
**Location**: `_handleLotteryEntry()` (`LotteryManager4626.sol:1290-1299`, specifically the `if sload(sourceEventKey) { return(0, 0) }` at line 1297), reached from `receiveRemoteLotteryEntry()` (`LotteryManager4626.sol:972`, `external nonReentrant`).

**Description**: The replay-dedup block is raw inline assembly:
```solidity
if (sourceEventId != bytes32(0)) {
    assembly {
        mstore(0, sourceEventId)
        mstore(32, _processedRemoteLotterySourceEvents.slot)
        sourceEventKey := keccak256(0, 64)
        if sload(sourceEventKey) { return(0, 0) }   // raw EVM RETURN
    }
}
```
Inline-assembly `return(0,0)` executes the actual EVM `RETURN` opcode, halting the **entire current external call frame** — not a Solidity-level `return` from the internal function. `_handleLotteryEntry` is called internally from `receiveRemoteLotteryEntry`, which is `nonReentrant`. OpenZeppelin's guard sets `_status = ENTERED` on entry and resets it to `NOT_ENTERED` only in the modifier's epilogue, which runs *after* the function body returns normally. The raw `return(0,0)` skips that epilogue entirely, so `_status` is left permanently stuck at `ENTERED`. Every `nonReentrant`-guarded function then reverts forever: `processSwapLottery`, `processAmoeEntry`, both `receiveRandomWords` overloads, `applyDeferredVrf`, `processDeferredVrfBatch`, and `receiveRemoteLotteryEntry` itself — the entire user-facing and VRF-settlement surface is permanently bricked, with no recovery path (nothing else resets `_status`).

The trigger is exactly the scenario the guard exists to handle: a `sourceEventId` that has already been marked consumed (line 1352) arriving a second time — i.e. **LayerZero message redelivery**, which the code's own comments explicitly anticipate ("Solana exactly-once: consume the V3 digest ... Prevents LZ redelivery from requesting VRF later"). Message redelivery is normal, expected behavior in LZ-based systems (retryable payloads, executor retries), not a privileged or exotic precondition.

**Proof of Concept**:
1. A remote V3 entry with `sourceEventId = X` is processed normally through `receiveRemoteLotteryEntry` (via the authorized hub forwarder + authorized remote-OFT origin); line 1352 sets `_processedRemoteLotterySourceEvents[X] = 1`; the call completes normally and `nonReentrant` resets `_status` cleanly.
2. The same underlying message is redelivered — a normal LZ occurrence — and `receiveRemoteLotteryEntry` is called again with the same parameters.
3. `nonReentrant` sets `_status = ENTERED`; `_handleLotteryEntry` finds `sload(sourceEventKey) == 1` → `return(0,0)` halts the entire call frame immediately, **skipping** the `nonReentrant` epilogue.
4. `_status` is now permanently `ENTERED`. Every subsequent call to any `nonReentrant` function reverts with `ReentrancyGuardReentrantCall` forever. (The owner can still `pause()`/`emergencyWithdraw()` sponsorship-held native since those are not `nonReentrant`, so ETH is not trapped — but the lottery's entire user/VRF surface is dead permanently.)

**Recommendation**: Never use assembly `return`/`revert`/`stop` inside a function invoked (directly or transitively) under a Solidity modifier. Compute `sourceEventKey` in assembly, then perform the early-exit check and `return;` in plain Solidity so the `nonReentrant` epilogue always runs.

---

### [3] Oracle deviation circuit-breaker self-disables on inactivity, on first entry, and can be defeated by ratcheting within the window
**Severity**: Medium
**Origin**: `[both]` — ethskills (oracles, precision-math) and pashov (periphery, economic-security, numerical-gap), converged from 5 agents; the numerical-gap agent additionally produced a concrete ratchet-math proof.
**Location**: `LotteryManager4626PricingLib.calculateTokenUSD()` (`LotteryManager4626PricingLib.sol:87-99`); reference-update sites `LotteryManager4626.sol:708-711`, `LotteryManager4626.sol:1356-1360`.

**Description**: The deviation guard — the only defense against an anomalous/extreme oracle print, since there is no absolute price floor/ceiling beyond `>0` — runs only while `block.timestamp - lastAcceptedPriceTimestamp[token] <= oracleDeviationWindow` (default 30 min), and `lastAcceptedPriceTimestamp` is updated only when an entry is actually created. Two distinct bypasses were confirmed:
- **Window-elapsed bypass**: for any lane that hasn't produced an accepted entry within the window (a quiet token, or simply waiting out 30 minutes), the deviation check is skipped entirely and **any** `priceUSD > 0` is accepted unconditionally and installed as the new reference. Same for a token's first-ever entry (`lastPrice == 0`).
- **Ratchet bypass** (numerical-gap agent, concrete): with entries spaced *inside* the window and each step moving the price by exactly the deviation cap (e.g. 20% at `oracleMaxDeviationBps=2000`), every individual step passes the `> 2000 bps` check, so the reference can drift arbitrarily far (e.g. 6.19× after 10 steps of +20%) while the "circuit breaker" reads as continuously active. The guard bounds *per-step* deviation, not cumulative drift.

Since `swapValueUSD` drives `winChancePPM` (capped at `baseCeilingPPM`/`maxWinChance`), an attacker able to move or catch an extreme/drifted oracle print can push a swap's measured USD value up, saturating win-chance for a trivial real notional. Payout amount itself is decoupled from USD value (`rewardShares` derives only from `payoutBps`/gauge reserve, per Finding 1's mechanism and separately confirmed by the precision-math agent), so this is a probability/entry-integrity issue, not a direct payout-inflation bug — bounded by the win-chance cap but repeatable.

**Proof of Concept** (Lead-strength — requires influence over or an organic extreme reading from the out-of-scope `IOracle4626` feed): wait ≥30 min since token T's last accepted entry (or use a never-entered token); submit a trivial swap while T's oracle reports an inflated price; `calculateTokenUSD` takes no deviation branch and returns the inflated value; win-chance saturates toward the ceiling; the inflated price becomes the new stored reference. Alternatively, for an active lane, ratchet the price up in ≤20%-per-entry steps to drift the reference over multiple transactions without ever tripping the guard.

**Recommendation**: Key the deviation window off the oracle's own update timestamp (or an admin heartbeat), not lottery activity; don't skip the check on a token's first entry; add absolute per-token min/max price bounds independent of the window; bound cumulative drift over a rolling period, not just per-step deviation.

---

### [4] VRF result staleness check runs before the pause-deferral check, permanently losing a legitimate win if a callback arrives late during a pause
**Severity**: Medium
**Origin**: `[phase2 only]` — pashov flow-gap agent; independently verified by the orchestrator directly against source.
**Location**: `_processVRFResult()`, `LotteryManager4626.sol:1000-1024`.

**Description**:
```solidity
function _processVRFResult(uint256 requestId, uint256[] memory randomWords) internal {
    if (randomWords.length == 0) return;
    VRFRequest memory request = vrfRequests[requestId];
    if (request.user == address(0)) return;

    if (vrfResultGracePeriod > 0 && block.timestamp > request.requestTimestamp + vrfResultGracePeriod) {
        delete vrfRequests[requestId];
        emit StaleVRFResultDiscarded(requestId, request.requestTimestamp, vrfResultGracePeriod);
        return;
    }

    if (paused() && !_settlingDeferredVrf) {
        if (!hasPendingRandomWord[requestId]) {
            pendingRandomWord[requestId] = randomWords[0];
            hasPendingRandomWord[requestId] = true;
            _pushDeferredVrf(requestId);
            emit VrfResultDeferred(requestId, randomWords[0]);
        }
        return;
    }
    ...
```
The staleness-discard branch (line 1007) is evaluated **before** the pause-deferral branch (line 1016). The deferred-VRF queue's whole purpose is "no win is ever lost across a pause," and its flush path (`_settleDeferredVrfAt`) deliberately refreshes `requestTimestamp` to the current time specifically so an *already-queued* result isn't later discarded as stale. But that refresh only helps results that already reached the queue. A result whose **first arrival** happens while the contract is paused, at a point where `block.timestamp` already exceeds the *original* entry's `requestTimestamp + vrfResultGracePeriod` (default 30 minutes), is deleted and discarded before the pause branch is ever reached — it never enters the deferred queue and can never be recovered by any later flush.

**Proof of Concept**: Entry created at T=0 (`requestTimestamp=0`). Owner pauses at T=10min (a legitimate incident-response action). VRF provider's callback arrives at T=35min while still paused. `35min > 0 + 30min` (default grace period) → the staleness branch fires first: `delete vrfRequests[requestId]`, `StaleVRFResultDiscarded` emitted, function returns successfully (no revert, so the VRF provider does not know to retry). The pause-deferral branch is never reached. If that draw was a win, it is permanently lost with no path to settlement or compensation.

**Recommendation**: Evaluate the pause-deferral branch before the staleness-discard branch (or skip the staleness check entirely whenever `paused() && !_settlingDeferredVrf`), so any result arriving during a pause is always queued and gets its staleness clock refreshed on flush, regardless of how long it's been since the original entry.

---

### [5] Multi-vault jackpot payout loop runs up to ~640 external calls / 128 token transfers synchronously inside the VRF-settlement callback
**Severity**: Medium
**Origin**: `[phase1 only]` — ethskills-dos agent.
**Location**: `payoutLocalJackpotInner()` (`LotteryManager4626.sol:2529-2669`, loop at 2580-2647), reached via `receiveRandomWords` → `_processVRFResult` → `_processWin` → `_payoutLocalJackpot` (delegatecall bubbles revert, lines 1785-1789).

**Description**: In multi-vault mode (`singleVaultJackpotOnly=false`), a winning VRF settlement iterates up to `MAX_JACKPOT_PAYOUT_ITERATIONS` (128) active registry tokens — each doing 5 external calls (`isTokenActive`, `getVaultForToken`, `getGaugeControllerForToken`, `availableJackpotReserve`, `payJackpot`) — plus up to `MAX_JACKPOT_PAYOUT_SLOT_SCANS` (1024) slot scans, all synchronously inside the VRF callback. Per-gauge failures are try/caught, but nothing bounds the *aggregate* gas of the loop. If the VRF coordinator forwards a bounded gas stipend below the loop's worst-case cost, the callback can run out of gas; since the delegatecall bubbles that failure up through `receiveRandomWords`, settlement reverts, and a retried callback re-runs the same too-heavy loop. Once `vrfResultGracePeriod` (default 30 min) elapses on the un-settled request, it is discarded as stale (Finding 4's mechanism) with no payout — a permanent loss of that specific win. A registry needing ≥128 active vaults for the worst case to bite is a realistic long-run condition given the registry is append-only.

**Proof of Concept**: Not independently exploitable by an unprivileged actor to steal funds — requires (a) owner-enabled multi-vault mode, (b) a large active registry, and (c) the out-of-scope VRF coordinator's gas-forwarding limit being below the loop's cost. Reported at Medium on the in-file, verified half: gas cost scales unboundedly up to 128 vaults on a callback hot path with no aggregate gas guard.

**Recommendation**: Do not perform multi-vault payout synchronously inside the VRF callback — separate "mark win" from "pay out" (a pull-style claim, or a bounded owner-triggered flush), or materially lower the active cap. At minimum, wrap the outer `_payoutLocalJackpot` delegatecall in a try/catch inside `_processWin` so an OOG/heavy payout cannot revert-and-strand the win settlement itself.

---

### [6] Non-Solana forwarder lanes don't enforce the documented non-zero `sourceEventId` replay invariant (and the replay key isn't namespaced by source chain)
**Severity**: Low
**Origin**: `[both]` — ethskills-bridges agent (both sub-issues), strongly corroborated by 5 pashov agents (asymmetry, first-principles, boundary, invariant, flow-gap) independently flagging the same code path as a Lead, blind to phase 1 and to each other.
**Location**: `receiveRemoteLotteryEntry()` (`LotteryManager4626.sol:972-992`); `_handleLotteryEntry()` (`LotteryManager4626.sol:1290-1299`, `1351-1353`).

**Description**: Code comments state the manager requires "a V3 non-zero `sourceEventId` replay key for every forwarder lane (parity with Solana)," but enforcement (`if (srcEid == SOLANA_LZ_EID && sourceEventId == bytes32(0)) return;`, line 1290) only applies to Solana. Any other forwarder lane's 224-byte payload with `sourceEventId == 0` skips the entire replay-key block — no manager-level dedup is recorded, and (per the flow-gap agent) if VRF dispatch subsequently fails for a transient reason, the code still treats the opportunity as "processed" with no replay key ever written, so a legitimately-failed entry cannot be safely retried by redelivery either. Separately, even where a `sourceEventId` is present, the replay key is derived from the id alone (not mixed with `srcEid`), so two different source chains coincidentally reusing the same id value would collide in the shared consumed-set.

Both issues depend on trust-boundary conditions already named in the phase-0 threat catalog (a misbehaving/buggy authorized hub forwarder, or two lanes sharing an id-generation scheme) rather than being triggerable by a fully unprivileged party — hence Low, despite the multi-agent convergence.

**Proof of Concept**: Requires a misbehaving trusted forwarder (Low, not directly attacker-triggerable). Forwarder `F` calls `receiveRemoteLotteryEntry` twice with a valid 224-byte, `sourceEventId==0` payload for a non-Solana `srcEid` — both calls create a full entry/VRF request with no on-chain guard preventing the duplicate.

**Recommendation**: Enforce non-zero `sourceEventId` for all forwarder lanes, not just Solana, and namespace the replay key by origin: `keccak256(abi.encode(srcEid, originSender, sourceEventId))`.

---

### [7] Hardcoded `1e18` / implicit 18-decimal assumption in USD conversion
**Severity**: Low
**Origin**: `[both]` — ethskills precision-math agent; independently found by pashov math-precision and periphery agents.
**Location**: `LotteryManager4626PricingLib.calculateTokenUSD()`, lines 83, 105, 111.

**Description**: `usd1e18 = FullMath.mulDiv(amount, priceUSD1e18, 1e18)` then `/1e12` is only dimensionally correct when the valued token has exactly 18 decimals and the oracle returns a 1e18-scaled USD price — neither is verified (`decimals()` is never queried on the token or the oracle). Today `tokenIn` always resolves to an 18-decimal ShareOFT, so the assumption currently holds; it silently breaks the moment a non-18-decimal lane token or a differently-scaled oracle is registered — a 6-decimal token would compute `usd1e6 = 0` (permanently blocking that lane's entries below `minSwapAmount`), while a 24-decimal token would inflate valuations by ~10^6× (pinning win-chance to the ceiling for dust swaps).

**Proof of Concept**: Not exploitable against the current registry; contingent on future token/oracle registration outside these two files.

**Recommendation**: Query and normalize by `IERC20Metadata(tokenIn).decimals()` and the oracle's declared scale before the `mulDiv`, or enforce/document an 18-decimal-only invariant at registration time.

---

### [8] Single-step `Ownable` (no two-step ownership transfer)
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills-access-control agent.
**Location**: `LotteryManager4626` / `LotteryManager4626AdminModule`, both inherit OZ `Ownable` (single-step).

**Description**: `owner` is the root of the entire admin/timelock surface. `transferOwnership` is single-step with no accept handshake — a mistaken address hands over (or permanently bricks) all administration in one irreversible call.

**Recommendation**: Use `Ownable2Step`.

---

### [9] Unguarded `renounceOwnership` can permanently freeze settlement
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills-access-control agent.
**Location**: inherited `Ownable.renounceOwnership()`, not overridden.

**Description**: Owner is required for `unpause()`, all timelock execute/cancel paths, `applyDeferredVrf`/`processDeferredVrfBatch` (the only way to flush deferred VRF results after a pause), and `disableBoostSources()`. An accidental or malicious renounce leaves the contract permanently unable to unpause or flush deferred wins if it is ever paused thereafter.

**Recommendation**: Override `renounceOwnership()` to revert, or restrict it to a state with no pending timelocks/deferred queue/pause.

---

### [10] Winner's jackpot is permanently forfeited if the payout token is paused/blacklisted at settlement (no re-claim)
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills-erc20 agent.
**Location**: `_processVRFResult()` line 1026 (settle-once delete) + `payTriggeringVaultJackpot()`/`payoutLocalJackpotInner()` try/catch around `payJackpot` (lines 2516-2526, 2634-2645).

**Description**: The VRF request is deleted (settle-once) independent of whether the subsequent `payJackpot` succeeds; a reverting transfer (e.g. winner blacklisted, or the ShareOFT paused, at the moment of settlement) is caught and only emits `JackpotPayoutFailed` — there is no escrow/re-claim path, so a legitimately-won prize is permanently lost with no recovery.

**Proof of Concept**: Lead-strength — settlement timing is VRF-driven, not attacker-controlled, and requires the deployed ShareOFT to have pause/blacklist mechanics (not confirmed from these two files).

**Recommendation**: On a caught payout failure, record the owed prize into a claimable-escrow mapping and expose a retry/claim entrypoint, rather than silently discarding it.

---

### [11] O(n) FIFO shift makes deferred-VRF batch drain O(n²)
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills-dos agent.
**Location**: `_popDeferredVrfHead()`, `LotteryManager4626.sol:935-945`, consumed by `processDeferredVrfBatch()`/`applyDeferredVrf()`.

**Description**: Popping the queue head shifts every remaining element left by one storage slot; draining a near-full (128-item) queue in one `processDeferredVrfBatch(16)` call does ~16×120 element-move operations on top of 16 settlements — an O(n²) pattern where a ring buffer would be O(1). Not attacker-triggerable (owner-only function); worst case is a very expensive owner tx, not fund loss, and the owner can always fall back to smaller batches.

**Recommendation**: Replace the shift-on-pop array with a `mapping(uint256=>uint256)` ring buffer plus head/tail indices.

---

### [12] Deferred-VRF queue-full reverts inbound VRF callback while paused
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills-dos agent.
**Location**: `_pushDeferredVrf()`, `LotteryManager4626.sol:930-933` (`revert DeferredVrfQueueFull`), called from `_processVRFResult()` under the paused-deferral branch.

**Description**: Once the deferred FIFO reaches `MAX_DEFERRED_VRF_QUEUE` (128) while paused, the next arriving VRF result's callback reverts uncaught. Whether the result is permanently lost or safely retried depends on the out-of-scope VRF coordinator's redelivery semantics.

**Recommendation**: Catch the full-queue condition in the paused branch and degrade gracefully (event + drop-oldest, or a soft-cap) rather than reverting the callback transaction.

---

### [13] Registry/`balanceOf` calls un-try/caught on the hot entry paths
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills-dos and ethskills-erc20 agents (same issue, different angles).
**Location**: `processSwapLottery()` lines 669/678 (`getTokenForShareOFT`, `isTokenActive`); `_handleLotteryEntry()` lines 1307/1309; `_coverageShareBalance()` line 1708 (`balanceOf`, unguarded, unlike the payout-path registry calls which are all try/caught).

**Description**: Unlike the payout path (every registry call try/caught), the swap and LZ-inbound entry paths call the immutable, trusted registry and a registered ShareOFT's `balanceOf` directly. A revert (e.g. a misbehaving/paused registered token) reverts the whole entry, and on the `_lzReceive` path this could stall that LZ lane's inbound nonce. Not attacker-triggerable since the registry/tokens involved are trusted/immutable, but a latent robustness gap vs. the defensive posture used elsewhere in the same file.

**Recommendation**: Wrap these hot-path calls in try/catch (default to "no entry"/"no coverage boost" on revert) for parity with the payout path and LZ-lane liveness.

---

### [14] Global `oracleMaxStaleness` applied uniformly to heterogeneous per-lane oracles
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills-oracles agent.
**Location**: `oracleMaxStaleness` (single protocol-wide var, line 214) consumed in `calculateTokenUSD`.

**Description**: One global staleness threshold (default 2h) is checked against every lane's oracle regardless of that oracle's actual update cadence, and the oracle's own freshness signal (used by a sibling consumer contract) is not consulted here.

**Recommendation**: Store staleness per token/oracle, or additionally consult the oracle's own freshness signal.

---

### [15] No absolute oracle price bounds beyond `>0`
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills-oracles agent.
**Location**: `calculateTokenUSD()`, line 83.

**Description**: The only price validation is strictly-positive; there is no `minAnswer`/`maxAnswer`-style absolute band independent of the (bypassable, see Finding 3) deviation window.

**Recommendation**: Add per-token absolute min/max price bounds as a circuit breaker independent of the deviation-window logic.

---

### [16] No L2 sequencer-uptime check (Base deployment)
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills-oracles agent.
**Location**: `calculateTokenUSD()` staleness block; no sequencer-feed check anywhere in scope.

**Description**: Deployed as a Base (OP-stack) hub with no Chainlink-style L2 sequencer-uptime feed/grace-period check; a sequencer restart could present a stale-but-"fresh-enough" price within the 2h staleness window. Impact is bounded (affects win-chance/odds, not collateral seizure).

**Recommendation**: Add a sequencer-uptime check with grace period, or explicitly document the accepted tolerance given the non-liquidation impact.

---

### [17] Asymmetric native-fee refund when the quoted VRF fee is exactly zero and the caller-funded request reverts
**Severity**: Low
**Origin**: `[phase2 only]` — pashov execution-trace agent.
**Location**: `_requestCrossChainVRFWithSource()`, `LotteryManager4626.sol:1501-1522`.

**Description**: In the inner `catch`, refund of caller-attached funds is gated on `useCallerFunds && nativeFee > 0`. If `quoteFee()` returns `nativeFee == 0` while the caller attached ETH (`useCallerFunds == true`), and the subsequent `requestRandomWordsPayable{value:0}` call reverts, neither the `useCallerFunds && nativeFee>0` branch nor the `else if (nativeFee>0)` branch executes, so the caller's attached native is never refunded and stays trapped in the contract. The success path correctly refunds for the same `nativeFee==0` case; only this failure path leaks.

**Proof of Concept**: Requires a zero-fee integrator quote coinciding with a request-call revert — a narrow, provider-dependent edge condition not independently reproduced end-to-end in this review.

**Recommendation**: Refund `callerFeeValue` unconditionally in this catch branch whenever `useCallerFunds` is true, regardless of the quoted `nativeFee` value.

---

## Leads

_Concrete code smells where the full exploit path could not be completed, or which depend on non-default configuration or out-of-scope assumptions. Not scored; flagged for manual follow-up._

- **Cross-lane prize-scope asymmetry in multi-vault mode** — `LotteryManager4626AdminModule.payoutLocalJackpotInner` — when the owner sets `singleVaultJackpotOnly=false`, a single winning entry on one (possibly the cheapest/lowest-notional) lane pays the winner a percentage of **every** active vault's reserve, while win-chance was priced solely off that one lane's swap value. A buyer could systematically farm win-chance on the cheapest lane while each win skims unrelated high-value lanes' jackpots. Gated behind an owner-controlled, non-default toggle; treat as a product/design question for the client rather than a code defect. `[pashov: trust-gap]`
- **Boost-source pre-arming instant-set window** — `LotteryManager4626AdminModule.setBoostManager`/`setve4626GaugeVoting` — before `armBoostSourceTimelock()` is called, these setters take effect instantly with no delay, so a compromised owner key could briefly point `boostManager`/`ve4626GaugeVoting` at a hostile contract that grants a chosen buyer maximal boost. The code already ships the mitigation (one-way arming + an always-available `disableBoostSources()` kill switch); this lead simply notes the pre-arming window has no on-chain safeguard beyond the owner key itself. `[pashov: trust-gap]`
- **`_scaleGaugeBoostBySwapSize` saturation constant decoupled from configurable `minSwapAmount`** — the boost ramp's "distance above minSwap for full boost" is a hardcoded `$9,999`, while `minSwapAmount` is owner-configurable up to `$1,000,000`. Raising `minSwapAmount` desynchronizes the intended saturation point from the actual floor; verified this can only ever *reduce* a user's boost (never inflate it), so no attacker-favorable direction was found, but it's a latent config-hygiene gap. `[pashov: numerical-gap]`
- **Orphaned deferred VRF word from a duplicate callback during a pause** — `_processVRFResult`/`_settleDeferredVrfAt` — if the same request ID's callback is delivered twice while paused, the second delivery's staleness check can fire against the un-refreshed original timestamp and delete the request struct while the already-enqueued pending word is left orphaned; on flush, the zeroed struct causes a silent no-op rather than a settlement. Reachability depends on whether the pinned VRF providers can ever redeliver the same request ID/sequence — not confirmed from these files. `[pashov: flow-gap]`
- **Transient VRF-dispatch failure permanently burns a remote entry's replay key** — `_handleLotteryEntry` — remote entries always pass `callerFeeValue=0`, so cross-chain VRF dispatch depends entirely on sponsorship; if sponsorship is unavailable or the integrator call transiently reverts, `entryId==0` but the `sourceEventId` replay key is still marked consumed ("including sponsorship/VRF skips" per the code's own comment), so a legitimate retry via LZ redelivery is rejected as a duplicate — converting a recoverable failure into a permanently lost entry for a buyer who already paid the cross-chain fee. `[pashov: flow-gap]`
- **Missing `LotteryEntryCreated` emission on the paid-swap path** — `processSwapLottery` never emits `LotteryEntryCreated`, unlike the AMOE and remote-entry paths which both do. Off-chain indexers relying on this event silently miss every hub paid-swap entry. Cosmetic/informational, no fund impact. `[pashov: asymmetry]`

## Verified-safe / Info (checked, no action required)

- **Delegatecall storage-layout parity** between `LotteryManager4626` and `LotteryManager4626AdminModule` was checked slot-by-slot by multiple agents across both phases and found consistent: both `_adminModule` and `_self` are `immutable` (no storage slot), and all appended fields declare in matching relative order across both contracts. Recommend a CI storage-layout diff (`forge inspect ... storage-layout`) to guard against future drift, but no current mismatch.
- Sponsorship budget/rate-limit accounting (`_consumeSponsorship`/`_refreshSponsorshipEpoch`/`_rollbackSponsoredSpend`) was independently verified sound (symmetric increment/rollback across every failure branch) by 3+ agents across both phases.
- Multi-vault jackpot payout cursor arithmetic tiles the append-only registry contiguously with no gaps/skips/reuse across calls — verified by 3+ agents.
- `totalSupply()`-based boost input is theoretically flash-mint-manipulable but only in a non-attacker-favorable direction (larger supply reduces boost) — `[ethskills: erc20]`.
- Fee-on-transfer/rebasing assumptions in coverage-balance and reward-accounting math are conservative-only (under-credit boost, never over-credit) — `[ethskills: erc20]`.
- Winner-callback gas limit is not validated against the remote handler's actual cost, but this is a best-effort UX notification only; the hub-side payout is authoritative and unaffected by a dropped callback — `[ethskills: bridges]`.

---

## Completeness

Every unique (Contract, function) raised by any of the 20 sub-agents across both phases appears above, either as a numbered finding or in the Leads/Info sections. `Entrypoints: ~75 in inventory, all examined. Threat-catalog rows: 7, 7 answered. Coverage holes closed this pass: 0.`

> ⚠️ This review was performed by AI auditor agents. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human review, a public bug bounty, and on-chain monitoring are strongly recommended before or alongside mainnet deployment at scale — particularly given Finding 1's severity.
