# 🔐 Security Review — 4626 Lottery Stack (LotteryManager4626 / VRF / AMOE zk router)

## Scope

|  |  |
|---|---|
| **Source of truth** | `github.com/4626fun/4626`, branch `audit/oda-v1200-greenfield-candidate` |
| **Commit reviewed** | `82688294f7765f20f7763175aa566e046eca95af` (pinned per client instructions) |
| **Directory** | `contracts/shared/lottery/` (manager, VRF, zk/AMOE router) |
| **Files reviewed** | `manager/LotteryManager4626.sol` · `manager/LotteryManager4626PricingLib.sol`<br>`manager/VRFConsumer4626.sol` · `vrf/ChainlinkVRFIntegratorV2_5.sol`<br>`zk/LotteryAmoeRouter.sol` · `zk/AmoePlonkVerifier.sol` · `zk/IAmoePlonkVerifier.sol` |
| **Size** | ~6,700 LOC across 7 files (2 contracts in the manager file — `LotteryManager4626` and `LotteryManager4626AdminModule`, linked by delegatecall) |
| **Methodology** | 3-phase: (0) context — protocol map + access-control inventory + threat catalog; (1) breadth — 8 parallel domain checklists (evm-audit-general, precision-math, oracles, bridges, access-control, assembly, dos, erc4626-adapted); (2) depth — 12 parallel attacker-mindset agents (9 specialty + 3 gap-hunter), run blind to phase-1 output; (3) this reconciliation, cross-verified against source by the orchestrator. All hunting-phase agents ran on Claude Opus given scope size. |
| **Prior context** | Client noted a prior full audit (2026-07-22 @ `423e0e3`) with P0 remediations landed in PR #757 / commit `413f060` for this v1.20.0 "no-legacy greenfield" candidate, and a prior ODA job (#461) on an overlapping scope. Per engagement terms, this review is a fully independent pass — no prior report was consulted; every finding below comes from this job's own phase 0/1/2 agents. |
| **Confidence threshold** | 50 (findings below 50 are recorded as Leads, not scored findings) |

---

## Reconciliation Summary

`Overlap (both phases): 6 · Phase-1-only: 12 · Phase-2-only: 3 · Multi-agent-convergence promotions: 2 (relayer censorship, AMOE consumer callback) · Re-examined leads kept: 19, demoted to leads-only: ~14 · Coverage holes closed this pass: 0`

**Coverage gate** (against the phase-0 protocol map's access-control inventory and threat catalog): `Entrypoints: ~120 external/public functions enumerated in the phase-0 inventory (full table in Appendix), all privileged/value-moving ones cross-checked by ≥2 independent agents across phases (esp. evm-audit-access-control, evm-audit-general, and the phase-2 access-control/execution-trace/asymmetry agents, each of which independently re-derived the full LM↔AM delegatecall routing table). 12 threat-catalog rows, 12 answered — see Threat Model below. Holes closed this pass: 0 (both phases already independently examined every threat-catalog row, including the "owner" row that ultimately produced Finding #1 — no entrypoint or threat row was left unexamined by either phase).`

The single most significant structural fact this audit surfaces: **the same root-cause defect (`adminModuleCall` → `payoutLocalJackpot`) was independently rediscovered by 2 of 8 phase-1 domain agents and 5 of 12 phase-2 attacker agents, working blind to each other.** That level of independent convergence is strong evidence this is a real, high-priority defect rather than a false positive, and it is the top finding below.

---

## Findings

[90] **1. Owner-only `adminModuleCall` reaches `payoutLocalJackpot`, which has no independent access guard — drains gauge jackpot reserves with no VRF win, no pause, no timelock**

`LotteryManager4626.adminModuleCall` / `LotteryManager4626AdminModule.payoutLocalJackpot` · Confidence: 90 · `[both: phase1 evm-audit-general/evm-audit-access-control; phase2 5/12 agents]`

**Description**
`adminModuleCall` (owner-only, `manager/LotteryManager4626.sol:2047`) forwards *arbitrary* calldata via `_adminModule.delegatecall(data)` with no selector filter, and `payoutLocalJackpot` (`manager/LotteryManager4626.sol:2542`) is guarded only by `onlyDelegateCall` (`address(this) != _self`) — **not** `onlyOwner` — on the mistaken assumption (stated in its own doc comment) that it is reachable solely through the internal VRF-win self-call path. It is not: the owner can call `adminModuleCall(abi.encodeWithSelector(payoutLocalJackpot.selector, anyActiveCoin, chosenRecipient, uint16(10000)))` and pay up to 100% of any gauge's `availableJackpotReserve()` to an arbitrary address, instantly, with no randomness, no pause requirement, and none of the 2-day timelocks the rest of the codebase relies on to gate exactly this kind of privileged fund movement.

```solidity
// manager/LotteryManager4626.sol:2047-2054
function adminModuleCall(bytes calldata data) external onlyOwner {
    (bool ok, bytes memory ret) = _adminModule.delegatecall(data);
    ...
}
// manager/LotteryManager4626.sol:2542-2548
function payoutLocalJackpot(address triggeringCoin, address winner, uint16 payoutBps)
    external
    onlyDelegateCall                          // <-- no onlyOwner; sole guard
    returns (uint256 totalSharesPaid)
{
    if (winner == address(0)) revert ZeroAddress();
    if (uint256(payoutBps) > BASIS_POINTS) revert InvalidAmount();   // allows 10000 = 100%
```
`payTriggeringVaultJackpot` (`manager/LotteryManager4626.sol:2556-2606`) then computes `rewardShares = (jackpotShares * payoutBps) / BASIS_POINTS` against the gauge's live reserve and calls `gaugeController.payJackpot(winner, rewardShares)` — moving third-party (gauge/LP-funded) reserve funds, not the owner's own balance. With `singleVaultJackpotOnly=false` the same call drains every active gauge in one transaction.

This clears the audit methodology's admin-action gate specifically because the defect is an **access gap** — `onlyDelegateCall` is not a meaningful restriction for this function (it doesn't distinguish "delegatecall from the internal win path" from "delegatecall from anywhere else in this contract's own code"), so the access-control mechanism itself is the bug, not merely an intentionally powerful admin function being used as designed.

**Fix**
```diff
  function adminModuleCall(bytes calldata data) external onlyOwner {
+     bytes4 selector = bytes4(data);
+     if (selector == LotteryManager4626AdminModule.payoutLocalJackpot.selector) revert ForbiddenSelector();
      (bool ok, bytes memory ret) = _adminModule.delegatecall(data);
      ...
  }
```
Or, preferably, gate `payoutLocalJackpot` itself on a transient flag set only by the internal `_payoutLocalJackpot` path immediately before delegating and cleared after, so the function is verifiably reachable only from a genuine VRF win regardless of how `adminModuleCall` evolves.

---

[85] **2. Jackpot payout as a fixed percentage of the live pooled reserve — combined with win-chance scaling only on the entrant's own notional — gives every entrant positive expected value once the reserve is non-trivial, enabling systematic reserve extraction via repeated small entries**

`LotteryManager4626.calculateWinChance` / `LotteryManager4626AdminModule.payTriggeringVaultJackpot` · Confidence: 85 · `[phase2-only: evm-audit-economic-security]`

**Description**
Win probability is `p = min(swapValueUSD/250_000, baseCeilingPPM)/1e6` — a function of the entrant's *own* trade notional only (`manager/LotteryManager4626.sol:1086-1091`). Prize size is `0.69 × R`, where `R = gaugeController.availableJackpotReserve()` is the gauge's **standing** reserve at settlement time (`rewardPercentage: 6900` set at `manager/LotteryManager4626.sol:593`; consumed at `manager/LotteryManager4626.sol:2594`) — a function of aggregate protocol activity, not of the entrant's own contribution.

```solidity
// manager/LotteryManager4626.sol:1086-1091
winChancePPM = swapAmountUSD / 250_000;
if (winChancePPM > ceiling) { winChancePPM = ceiling; }   // ceiling = baseCeilingPPM, default 40_000 (4%)
// manager/LotteryManager4626.sol:2594 (payTriggeringVaultJackpot)
uint256 rewardShares = (jackpotShares * payoutBps) / BASIS_POINTS;   // jackpotShares = live reserve
```
Expected value per entry is `EV = (notional/250,000) × 0.69 × R`; cost is `≈ fee_rate × notional`. **Notional cancels out of the break-even condition**: `R* = fee_rate × 250,000 / 0.69`. At a 0.3% round-trip fee, `R* ≈ $1,087`; at 1%, `R* ≈ $3,623` — both far below any reserve level a live protocol will reach in normal operation. Once `R > R*`, *every* entry size is equally profitable in expectation, so an attacker can use many small, low-slippage round-trip swaps to keep effective cost near the nominal fee rate. `processSwapLottery` — the sole paid entry point — has **no per-buyer rate limit** on the default local-VRF path (the only per-buyer caps in source gate the sponsored *cross-chain* path only), so nothing besides gas and swap fees limits repetition.

Concrete trace: `R=$50,000`; repeated $100 round-trip swaps at 0.3% fee (~$0.30 cost each): `p=0.04%`, `EV = 0.0004 × 0.69 × 50,000 = $13.80` per entry against a $0.30 cost — over 45× the entry cost in expectation, repeatable until `R` is drained toward its ~$1,087 floor. The reserve — funded by the aggregate fees of organic traders — is structurally transferred to whoever runs the most repeated small entries, and can never sustain a meaningful jackpot.

**Fix**
This is a structural economic-design issue rather than a single-line guard fix. Recommended directions: fund each entry's potential prize from that entry's own fee contribution (pari-mutuel-style) rather than a shared standing pool; scale `payoutBps` inversely with the entrant's `winChancePPM` so `p × payout` is bounded per unit of fee paid; or cap total payout per unit time relative to reserve *inflow* rather than as a flat percentage of standing balance. Recommend a dedicated design review before mainnet launch.

---

[75] **3. A permissioned relayer can read the VRF outcome before deciding whether to relay it cross-chain, and can selectively withhold delivery of winning results until they are discarded as stale**

`VRFConsumer4626.relayPendingResponse` · Confidence: 75 · `[phase2-only, promoted via multi-agent convergence: 6/12 agents — periphery, trust-gap, flow-gap, invariant, first-principles, asymmetry]`

**Description**
Cross-chain VRF results are not auto-delivered — `_handleCrossChainResponse` only sets `pendingResponses[srcEid][sequence]=true`; a semi-trusted relayer (`owner() || authorizedRelayers`, `manager/VRFConsumer4626.sol:541`) must separately call `relayPendingResponse` to send the result. By that point `vrfRequests[id].randomWord` is already public, so the relayer can compute win/lose before choosing to relay, and can withhold delivery of winning entries past the hub's grace period or the spoke's request timeout so they are discarded as unfulfilled losses with no refund or replay path. This does not require any guard-bypass — it is an omission (choosing not to call a function), so it clears the audit's trusted-role gate as a general demotion rather than the stricter admin-malice-reject rule, and 6 independently-converging agents promote it to a scored finding per this methodology's convergence rule.

**Fix**
Consider making result relay permissionless (the caller already funds and is refunded the LZ fee), removing the relayer's unilateral power to choose which outcomes get delivered.

---

[70] **4. Hub VRF grace period (30 min) is shorter than the spoke's request keep-alive (1 hour) — an honest but slow cross-chain relay silently voids a legitimate win**

`LotteryManager4626._processVRFResult` / `ChainlinkVRFIntegratorV2_5.requestTimeout` · Confidence: 70 · `[phase2-only: evm-audit-invariant, evm-audit-execution-trace]`

**Description**
`_processVRFResult` (`manager/LotteryManager4626.sol:1018-1022`) discards and deletes any result arriving `> requestTimestamp + vrfResultGracePeriod` (default 30 minutes), while the spoke's `ChainlinkVRFIntegratorV2_5.requestTimeout` (default 1 hour) will happily keep relaying a request for up to twice that long. No malicious actor is required — an honest relay taking 31–59 minutes under normal network congestion or manual-relay latency arrives at the hub after the grace period has already elapsed and is discarded as stale even though the win was genuinely decided by honest randomness. The already-spent VRF fee and the entrant's win are both lost with no refund.

Related fragility (recorded as Leads, not separately scored — see below): the same `requestTimestamp`-refresh mechanism that fixes this for *paused-and-deferred* results (`_settleDeferredVrfAt`, `manager/LotteryManager4626.sol:945`) can, in the opposite direction, overflow the 128-deep deferred queue (discarding legitimate wins that never got the refresh) or resurrect results that should have been correctly discarded as stale (undermining the same anti-selective-delivery intent from the other side). Both require an owner-initiated pause as a precondition and are demoted to leads accordingly, but they point at the same fragility cluster as this finding and are worth fixing together.

**Fix**
Align the hub's `vrfResultGracePeriod` with (or make it configurably ≥) the spoke's `requestTimeout`, closing the window where an honest slow relay is silently treated as stale.

---

[55] **5. AMOE router's optional legacy `consumer.recordAmoeEntry` callback is unisolated — a misconfigured consumer bricks the entire ZK AMOE entry path**

`LotteryAmoeRouter.submitAmoeEntryZK` · Confidence: 55 · `[both: phase1 evm-audit-dos/evm-audit-general; phase2 evm-audit-periphery/first-principles/invariant/flow-gap — 6 agents total]`

**Description**
After the manager fan-out succeeds (entry created, VRF dispatched, nullifiers burned), the router calls the optional legacy `consumer.recordAmoeEntry(...)` with no `try/catch` (`zk/LotteryAmoeRouter.sol:483-485`):
```solidity
if (address(consumer) != address(0)) {
    consumer.recordAmoeEntry(buyer, creatorCoin, epoch, entryId);
}
```
A reverting or misconfigured `consumer` (owner-set, no timelock, defaults to `address(0)`/skipped) reverts the entire transaction, rolling back the already-successful manager fan-out and nullifier burns and bricking every subsequent valid proof submission until the owner clears the setting. This is an owner-configuration risk affecting unprivileged AMOE submitters, not the owner, so it stands as its own finding rather than falling under the admin-malice gate.

**Fix**
```diff
  if (address(consumer) != address(0)) {
-     consumer.recordAmoeEntry(buyer, creatorCoin, epoch, entryId);
+     try consumer.recordAmoeEntry(buyer, creatorCoin, epoch, entryId) {} catch {}
  }
```

---

[50] **6. Oracle deviation circuit-breaker is silently disabled once the reference price for a lane goes stale (bootstrap/re-bootstrap gap)**

`LotteryManager4626PricingLib.calculateTokenUSD` · Confidence: 50 · `[both: phase1 evm-audit-oracles/evm-audit-precision-math; phase2 evm-audit-math-precision/economic-security/periphery/first-principles — corroborated widely as a lead]`

**Description**
The deviation check (`oracleMaxDeviationBps`/`oracleDeviationWindow`, default 30 min) only runs while `block.timestamp - lastAcceptedPriceTimestamp[token] <= oracleDeviationWindow` (`manager/LotteryManager4626PricingLib.sol:110-118`). Any lane with a gap longer than 30 minutes between entries re-bootstraps with **no** deviation check — only staleness still applies — and the accepted (possibly manipulated) price becomes the new reference. Impact is bounded by the win-chance ceiling (4% pre-boost / 15% post-boost) and requires the out-of-scope oracle to actually misreport, so this is reported at Low/Medium confidence as a defense-in-depth gap rather than a proven fund-loss path.

**Fix**
Apply the deviation check against the last reference regardless of its age (widening the allowed band as elapsed time grows) instead of disabling it outright past the window; refresh the reference on the AMOE path as well (currently only the paid path does).

---

## Findings List

| # | Confidence | Title |
|---|---|---|
| 1 | [90] | Owner-only `adminModuleCall` reaches `payoutLocalJackpot` with no independent access guard |
| 2 | [85] | Fixed-percentage-of-reserve payout enables wash-trading reserve extraction |
| 3 | [75] | Relayer can selectively censor winning cross-chain VRF results |
| 4 | [70] | VRF grace-period/timeout mismatch silently voids legitimate slow-relayed wins |
| 5 | [55] | Unisolated AMOE `consumer` callback bricks the ZK AMOE path on misconfiguration |
| 6 | [50] | Oracle deviation-guard bootstrap/re-bootstrap bypass |

*(Below-threshold items — confidence < 50 — are recorded as Leads, not scored findings, per this report's confidence floor.)*

---

## Leads

_High-signal trails identified by ≥1 independent agent where the full exploit path could not be completed to scored-finding confidence, or where impact is self-limited to the owner's own risk. Not scored; description only._

- **`renounceOwnership` left callable on `VRFConsumer4626`/`ChainlinkVRFIntegratorV2_5`** — `VRFConsumer4626` / `ChainlinkVRFIntegratorV2_5` — Code smells: `manager/LotteryManager4626.sol:2125` deliberately disables renounce ("would permanently brick pause recovery"); VC/VI inherit OZ `Ownable`'s renounce unmodified. — Massive convergence (5+ agents both phases) but self-harm only (owner bricks their own contract's `withdraw`/config) — REJECTED as a scored finding per the audit methodology's "self-harm only" rule, retained as a best-practice recommendation: override to revert, matching LM.
- **`VRFConsumer4626.relayPendingResponse` LZ-fee buffer refund goes to `owner()`, not the paying relayer** — `manager/VRFConsumer4626.sol:598` (`_lzSend(..., payable(owner()))`) — the documented `≥fee`/refund-excess design (`manager/VRFConsumer4626.sol:552-554`) is partly defeated because the endpoint's own ~5% buffer refund is hardcoded to `owner()` rather than `msg.sender`. Bounded value leak affecting only a semi-trusted relayer.
- **VRF-provider rotation (`localVRFConsumer`/`vrfIntegrator`) strands in-flight requests dispatched under the old provider** — dispatch validates against a broader `trustedVrfIntegrators` set while the fulfillment callback checks only the single current address; after a (2-day-timelocked) rotation, old in-flight requests can never settle. Owner-action-gated precondition, single-agent lead.
- **Deferred-VRF queue overflow / resurrection asymmetry** — see Finding #4's related-fragility note; owner-pause-gated precondition on both directions.
- **AMOE buyer-binding compares only the low 160 bits of `pubInputs[8]`** — `zk/LotteryAmoeRouter.sol:409` vs. full-width `creatorCoin`/`epoch` bindings at lines 407-408 — flagged by 5+ agents across both phases; exploitability depends entirely on whether the out-of-scope PLONK circuit itself range-constrains the wallet-address signal to 160 bits. Recommend fixing to full-width comparison as defense-in-depth regardless.
- **AMOE relayer has no instant-revoke path** (only a 2-day queue-to-zero), unlike the swap-contract/boost-source siblings which support instant disable — owner-mitigable via full pause.
- **Deferred-VRF settlement is owner-only with no permissionless fallback or deadline** — an entrant whose win lands during a pause depends entirely on the owner eventually flushing the FIFO queue.
- **No L2 sequencer-uptime check** on Base hub oracle reads — impact bounded since price only steers win-chance (capped), never payout amount.
- **`VRFConsumer4626.getAggregatedAssetPrice` is an unweighted mean** authenticated only by LayerZero peer identity — no in-scope consumer of this value was found; flagged as a cross-boundary lead in case an out-of-scope system uses it economically.
- **Multi-vault jackpot payout mixes heterogeneous per-token share units** into single scalar `totalRewardsPaid`/`totalSharesPaid` totals — display/reporting integrity only, not fund-safety.
- **Multi-vault jackpot payout's gas caps don't bound the pre-loop `registry.getAllTokens()` copy or the aggregate external-call cost against the ~2.5M Chainlink VRF callback gas ceiling** — non-default mode; can cause a legitimate win's payout frame to OOG with no retry path (compounds with the related "win recorded, payout OOG, no retry" lead below).
- **A recorded win whose payout frame reverts (e.g. OOG) permanently loses the prize** — win counters are committed before the payout attempt; no retry mechanism exists (unlike the VRF-callback layer's `retryLocalCallback`/`retryCallback`).
- **Deferred-VRF FIFO queue uses an O(n) storage shift per pop**, making a full-queue drain O(n²) — owner-only gas inefficiency, bounded by the 128-item cap.
- **`_coverageShareBalance`'s "live cap" is not an independent flash-loan defense** — correctness depends entirely on the trusted swap contract supplying a true block-start balance snapshot; the cap composes with but doesn't replace that trust.
- **`AmoePlonkVerifier` fails open (accepts any proof) if ever deployed to a chain lacking the BN128 precompiles** — confirmed inert on Base/Ethereum-class chains; documentation-only risk for a Base-only deployment.
- **One-step ownership transfer across all owned contracts** (no `Ownable2Step`) — a single typo'd `transferOwnership`/`setOwner` call permanently loses admin capability with no accept-step to catch the error.
- **`_refreshSponsorshipEpoch` has divergent zero-handling** between the `LotteryManager4626` and `LotteryManager4626AdminModule` copies — currently dead code since `epochStart` is never zero post-construction, but a latent trap on the highest-fragility storage-mirror seam.
- **`ChainlinkVRFIntegratorV2_5._payNative` requires exact `msg.value`** while the request-time check implies `≥` is accepted — self-griefing only (revert, no fund loss; the in-protocol caller always sends the exact quote).
- **`LotteryManager4626PricingLib.calculateTokenUSD`'s overflow guard is asymmetric** (bounds `amount` but not `priceUSD1e18`), and the call site has no `try/catch` unlike the oracle read itself — requires an out-of-scope extreme oracle value; robustness/DoS lead only.

---

## Access-Control Inventory (from phase-0 context pass)

**Architecture:** `LotteryManager4626` (LM) holds an immutable `_adminModule` set at construction. Most LM admin setters are unguarded stubs whose body is only `_delegateAdmin()` → `_adminModule.delegatecall(msg.data)`; enforcement (`onlyOwner`) lives in `LotteryManager4626AdminModule` (AM), guarded `onlyDelegateCall onlyOwner` — except `payoutLocalJackpot`, which is the sole exception exploited by Finding #1. `adminModuleCall(bytes)` (LM, `onlyOwner` directly) is the only path to AM functions with no named LM stub. Storage layout is field-for-field mirrored between LM and AM — independently re-derived and confirmed consistent by 8+ agents across both phases.

| Privileged / value-moving entrypoint | Guard | Caller |
|---|---|---|
| `LM.processSwapLottery` | `onlyAuthorizedSwapContract` + `whenNotPaused` | authorized swap contract |
| `LM.processAmoeEntry` | `msg.sender == authorizedAmoeRelayer` | AMOE relayer only |
| `LM.receiveRandomWords` ×2 | `msg.sender == localVRFConsumer` / `== vrfIntegrator` | local VRF consumer / VRF integrator |
| `LM.receiveRemoteLotteryEntry` | dual: `authorizedHubShareOftForwarders[msg.sender]` AND `authorizedRemoteOFTs[srcEid][originSender]` | authorized hub ShareOFT forwarder |
| `LM.adminModuleCall` | `onlyOwner` | owner |
| AM `payoutLocalJackpot` | `onlyDelegateCall` **only** — see Finding #1 | intended: internal win path only; actual: also `adminModuleCall` |
| AM all other setters (~40 functions) | `onlyDelegateCall onlyOwner` (+ timelocks — 10 queue/execute/cancel or propose/commit/cancel triples enumerated in the phase-0 map) | owner |
| `VC.rawFulfillRandomWords` | `msg.sender == vrfCoordinator` | Chainlink VRF coordinator |
| `VC.relayPendingResponse` | `owner() \|\| authorizedRelayers` | owner/relayer — see Finding #3 |
| `VC.retryLocalCallback` / `VI.retryCallback` | none (permissionless), request-state gated | anyone |
| `VC.withdraw` / `VI.withdraw` | `onlyOwner` | owner |
| `RT.submitAmoeEntryZK` | none (permissionless), proof + root-pin + replay-map gated | anyone |
| `RT.setAllowlistRoot` / `setPointsLedgerRoot` | publisher-only, one-shot per epoch | allowlist/points-ledger publisher |
| All `_lzReceive` (LM/VC/VI) | LZ endpoint + peer/chain-allowlist check | LayerZero endpoint from an authorized peer |

**Ownership:** LM/VC/VI use OZ `Ownable` one-step `transferOwnership`; `LotteryAmoeRouter` uses a custom one-step `setOwner`. `renounceOwnership` is explicitly disabled on LM only (see Leads).

---

## Threat Model (from phase-0 context pass, each row marked addressed-by-finding or invariant-holds)

| Actor | Reaches | Could gain | Status |
|---|---|---|---|
| Unauthorized address | `processSwapLottery` | free entries | **Invariant holds** — allowlist-only guard confirmed sound by multiple agents |
| Unauthorized address | `processAmoeEntry` | free entries | **Invariant holds** — single-address guard confirmed sound |
| Compromised/malicious swap contract (allowlisted) | inflate `swapValueUSD`/coverage | raise win odds | **Partially addressed** — Finding #6 (oracle deviation gap), Lead (coverage-cap not independent) |
| Malicious/compromised AMOE relayer | arbitrary `pointsBurnedAsUSD` | same as above via non-swap path | **Invariant holds** — value bound mirrored at both layers |
| Anyone (permissionless) | `submitAmoeEntryZK` | mint entries without a real proof | **Invariant holds** — PLONK soundness + `checkField` + 3-nullifier replay set verified by dedicated assembly pass |
| Malicious/spoofed VRF coordinator (if misconfigured) | `rawFulfillRandomWords` | inject fake randomness | **Invariant holds** — owner-set + 2-day-timelocked, documented trust boundary |
| Malicious LayerZero peer (if `peers[]` misconfigured) | `_lzReceive` | inject fake cross-chain state | **Invariant holds** — peer + chain/hub-eid checks verified sound by dedicated bridges pass |
| Malicious/misconfigured `localVRFConsumer`/`vrfIntegrator` | `receiveRandomWords` | force outcomes | **Invariant holds** for forgery; **availability lead recorded** (provider-rotation stranding) |
| **Owner (trusted but powerful)** | all timelocked setters, `adminModuleCall`, deferred-VRF flush | **rug boost sources instantly, drain jackpot reserves via `adminModuleCall`→`payoutLocalJackpot` bypassing every timelock** | **Addressed by Finding #1** — this row is the exact threat this audit's top finding closes |
| Anyone (permissionless) | retry/cleanup/`updateLocalPrice`/`fundContract` | griefing | **Invariant holds** — dedicated DoS pass found only bounded, owner-cost-only gas inefficiencies |
| Registry-controlled addresses | oracle/vault/gauge/shareOFT lookups | redirect payouts/pricing if registry compromised | **Documented external trust boundary** — registry contents are out of scope |
| Reentrant callee (gauge `payJackpot`, callback receivers) | payout/callback paths | double-payout, drain via reentry | **Invariant holds** — `_payoutLock` + `nonReentrant` + self-call isolation verified sound by multiple agents |

`Coverage: 12 threat-catalog rows, 12 answered. Holes closed this pass: 0.`

---

> This review was performed by an AI-orchestrated multi-agent audit pipeline (context-building → breadth checklist sweep → depth attacker-mindset hunting → cross-phase reconciliation), commissioned via the leftclaw.services job marketplace. AI analysis can never verify the complete absence of vulnerabilities, and no guarantee of security is given. A human security review, a public bug bounty, and on-chain monitoring are strongly recommended before or alongside mainnet deployment — particularly given Finding #1 (owner-drain access gap) and Finding #2 (jackpot economic design), both of which warrant direct engineering discussion rather than a purely mechanical patch.
