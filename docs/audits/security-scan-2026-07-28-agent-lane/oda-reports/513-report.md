# 🔐 Security Review — AgentOracle (4626 Agent Lane Oracle)

---

## Scope

|                                  |                                                        |
| -------------------------------- | ------------------------------------------------------ |
| **Target**                       | `github.com/4626fun/4626` @ tag `audit/oda-2026-07-28-oracles` |
| **Commit (pinned)**               | `c19bc8e12a02d11bdcfca72cff9d38362bc07291` |
| **Files reviewed**               | `contracts/agent/oracles/AgentOracle.sol` (1539 lines)<br>`contracts/shared/interfaces/oracles/IOracle4626.sol` (97 lines) |
| **Explicitly out of scope**      | `contracts/creator/oracles/CreatorOracle.sol` (sibling lane oracle — read only for parity comparison, never audited as a target); `contracts/agent/revenue/AgentGaugeController.sol` and `contracts/shared/strategies/univ3/CharmStrategy4626.sol` (downstream consumers — read only to verify concrete impact of findings rooted in the two in-scope files) |
| **Methodology**                  | Three-phase: (0) context — protocol map, access-control inventory, threat catalog; (1) breadth — 7 ethskills domain checklists (general, precision-math, oracles, bridges, defi-amm, access-control, chain-specific); (2) depth — 12 pashov attacker-mindset agents, run blind to phase-1 findings; (3) hybrid reconciliation across both phases |
| **Confidence threshold (1-100)** | 50 |

**Prior-audit note:** In-code comments (`FIX: H-01/4626-293`, `H-4`, `H-5`, `M-3`, `M-8`, `L-3`) indicate this file has already been through at least one prior audit round whose fixes are reflected in the current source. This review is a fresh, independent pass — every finding below comes from this engagement's own protocol map, breadth checklists, and depth attack agents, not from reading the prior audit's conclusions.

---

## Reconciliation Summary

`Overlap (both phases): 5 · Phase-1-only: 15 · Phase-2-only: 6 · Re-examined leads kept: 21, demoted: 0 · Coverage holes closed this pass: 0`

Phase 1 (7 domain agents) produced 21 synthesized findings/notes. Phase 2 (12 blind attacker agents) produced 7 confirmed findings plus a leads pool. Two Phase-2 findings (`PG-02`, the `_lzReceive` deviation-cap break, and `PG-05`, the V3-lane sequencer-guard gap) independently rediscovered Phase-1 findings (`P1-01`, `P1-06`) — those are merged below and tagged `[both]`, with Phase 2's concrete numeric proofs (a demonstrated 1,000,000× single-message jump; a demonstrated ~96× TWAP-amplification factor) elevating their confidence and, in one case, severity. `P1-03` (sequencer guard missing on the read path) was independently corroborated by Phase 2's first-principles agent as a lead — also tagged `[both]`. The remaining Phase-1 findings address surface Phase 2's 12-agent attack panel didn't happen to converge on (bridges/access-control/precision-math specifics); the remaining Phase-2 findings (`PG-01`, `PG-03`, `PG-04`, `PG-06`, `PG-07`) are novel discoveries from the attacker-mindset pass, most notably `PG-01`, which was verified by the orchestrator directly against the actual downstream consumer contract rather than taken on the sub-agent's word.

**Coverage gate:** 27 external/public state-changing or trust-relevant entrypoints in the Access-Control Inventory below; all 27 map to at least one finding or an explicit "examined, no issue" note. All 7 threat-catalog rows are answered. No entrypoint required a fresh Turn-3 re-read to close a coverage hole — both phases' 19 agents already covered the full surface.

**Confidence floor:** every item below scored ≥50 is listed as a Finding with a severity; everything below 50 is listed under Leads (plausible, not confirmed).

---

## Findings

### [95] **1. AgentOracle's dead `getAssetEthTWAP` permanently and unconditionally bricks `AgentGaugeController`'s WETH-fee buyback route**

`AgentOracle.getAssetEthTWAP` · Severity: **High** · Confidence: 95 · Origin: `[phase2: periphery]`, orchestrator-verified against downstream consumer

**Description**
`AgentOracle.getAssetEthTWAP` (declared live by `IOracle4626`) reverts unconditionally as its first statement, so `AgentGaugeController._calculateMinOutput`'s try/catch around it always hits the `catch` and returns 0, which unconditionally trips `revert MinOutputUnavailable()` in `_processWETHFeesWithRoute` — the only live WETH-fee-processing entrypoint (the legacy `processWETHFees()` is itself a dead stub) — regardless of the `useOracleSlippage` toggle, permanently disabling the agent lane's revenue buyback mechanism.

**Fix**

```diff
- function getAssetEthTWAP(uint32 duration) public view returns (uint256 price) {
-     revert V4NotConfigured();
-     int24 twapTick = getTWAPTick(duration);
-     price = tickToPrice(twapTick);
- }
+ // Implement asset-per-ETH for the agent lane via the live V2/V3 lane composed
+ // with the ETH/USD Chainlink feed, OR mark this member optional on IOracle4626
+ // and change AgentGaugeController to treat "oracle unavailable" (not just
+ // useOracleSlippage=false) as a valid reason to skip the oracle floor rather
+ // than hard-fail whenever oracleMin==0 regardless of cause.
```

Verified independently by the orchestrator: `AgentGaugeController.sol:566-582` (`_calculateMinOutput`), `:508-509` (unconditional `revert MinOutputUnavailable()` on `oracleMin==0`), `:139` (`useOracleSlippage` defaults `true`), `:458-459` (legacy entrypoint is a dead stub — confirms `processWETHFeesWithRoute` is the only live path). Root cause: `AgentOracle.sol:906-910`; `IOracle4626.sol:35`.

---

### [90] **2. `_lzReceive`'s remote deviation-cap logic fails in both directions — stale remotes accept unbounded jumps, fresh remotes silently store a fabricated value marked "fresh"**

`AgentOracle._lzReceive` · Severity: **High** · Confidence: 90 · Origin: `[both]` — Phase 1 bridges/oracles (`P1-01`), Phase 2 trust-gap/flow-gap/invariant/access-control/economic-security/first-principles/numerical-gap/execution-trace (`PG-02`)

**Description**
The 20% deviation clamp at `_lzReceive:1350` only applies while the remote is locally fresh (`<=MAX_STALENESS`). A stale remote — the normal steady state for any chain not broadcast to every cooldown interval — accepts an authenticated hub price **raw**, bounded only by `MAX_INITIAL_PRICE_USD` (a demonstrated 1,000,000× single-message jump is possible with concrete numbers). Separately, when the remote *is* fresh, the code stores a locally-fabricated clamped intermediate (`oldP ± 20%`) but stamps it with the hub's fresh timestamp — `isPriceFresh()` cannot distinguish this materially-wrong value from a verified-accurate one, and because every local remote write path reverts `HubOnly`, nothing on the remote can self-correct short of another broadcast.

**Fix**

```diff
  if (assetPriceUSD > 0) {
      uint256 oldP = uint256(assetPriceUSD);
      uint256 newP = uint256(price);
      uint256 deviation = oldP > newP ? ((oldP - newP) * 1e18) / oldP : ((newP - oldP) * 1e18) / oldP;
      if (deviation > MAX_PRICE_DEVIATION) {
-         // If we are still fresh, keep strict deviation guard.
-         // If already stale, accept authenticated hub price to recover liveness.
-         if (block.timestamp - assetPriceTimestamp <= MAX_STALENESS) {
-             uint256 maxStep = Math.mulDiv(oldP, MAX_PRICE_DEVIATION, 1e18);
-             if (maxStep == 0) maxStep = 1;
-             if (newP > oldP) {
-                 newP = oldP + maxStep;
-             } else {
-                 newP = oldP > maxStep ? oldP - maxStep : 1;
-             }
-             price = int256(newP);
-             emit RemotePriceUpdateSkipped(origin.srcEid, price, safeTimestamp, "deviation_clamped");
-         }
+         // Apply the step-wise clamp unconditionally — stale or fresh — so no
+         // single message can move the remote more than one MAX_PRICE_DEVIATION
+         // step. Recovery from genuine staleness then happens gradually across
+         // subsequent broadcasts instead of in one unclamped leap. Large
+         // corrections should go through the explicit, owner-gated
+         // forceSyncRemotePrice instead of silently inside _lzReceive.
+         uint256 maxStep = Math.mulDiv(oldP, MAX_PRICE_DEVIATION, 1e18);
+         if (maxStep == 0) maxStep = 1;
+         if (newP > oldP) {
+             newP = oldP + maxStep;
+         } else {
+             newP = oldP > maxStep ? oldP - maxStep : 1;
+         }
+         price = int256(newP);
+         emit AssetPriceClamped(origin.srcEid, price, safeTimestamp);
      }
  }
```

Concrete proof (stale branch): remote at `$1`, stale >2h; hub broadcasts `price=1,000,000e18`; every guard before the clamp check passes; the freshness gate at `_lzReceive:1350` is false → clamp skipped entirely → remote jumps 1,000,000× in one message. Concrete proof (fresh branch): remote at `$1` fresh; hub reaches `$1.50` legitimately; remote stores `$1.20` stamped as fresh, and nothing short of another broadcast can correct it. `AgentOracle.sol:1343-1367`.

---

### [85] **3. V2 TWAP lane: unbounded averaging window lets idle-pair extrapolation amplify a small manipulation past the 20% cap, and independently reports stale multi-day averages as fresh**

`AgentOracle.getV2AssetQuoteTWAP` / `_currentV2CumulativeAssetPerQuote` · Severity: **High** · Confidence: 85 · Origin: `[phase2: numerical-gap, economic-security]` (`PG-03`), corroborated as leads by boundary/execution-trace/flow-gap/invariant

**Description**
`_currentV2CumulativeAssetPerQuote` extrapolates the pair's cumulative by weighting the *current instantaneous spot price* over the entire elapsed gap since the pair's own last on-chain update. On an inactive pair, this gives a single-block spot nudge a lever arm proportional to `(idle gap / requested duration)`. Demonstrated: a 2-day idle gap against a 1800s duration gives a ~96× amplification factor — a 0.198% single-block spot nudge produces a 19.2% "TWAP" move that clears the 20% deviation cap, directly defeating the contract's own documented claim that "TWAP smooths out flash loan attacks." Independently, if the baseline is simply never refreshed, the realized window grows unboundedly and a stale, heavily-lagged multi-day average gets written and marked fully fresh.

**Fix**

```diff
  function _currentV2CumulativeAssetPerQuote() internal view returns (uint256 cumulativePrice, uint32 blockTimestamp) {
      IUniswapV2Pair pair = IUniswapV2Pair(v2Pair);
      blockTimestamp = uint32(block.timestamp % 2 ** 32);
      ...
      (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) = pair.getReserves();
+     // Reject extrapolation over an idle gap that is large relative to the pair's
+     // own last activity — an idle-gap-weighted instantaneous spot is not a TWAP.
+     // Require the pair to have updated recently enough that the extrapolated
+     // portion cannot dominate the reconstructed average.
      if (blockTimestampLast != blockTimestamp) {
          ...
      }
      ...
  }
```

and separately, in `getV2AssetQuoteTWAP`, cap the realized window (e.g. reject/require a fresh `recordV2Observation` once `timeElapsed` exceeds a bound such as `2× duration`) so a long-stale baseline cannot masquerade as a current TWAP. `AgentOracle.sol:1032-1051`, `:1056-1079`.

---

### [65] **4. Per-update 20% deviation cap bounds a single step, not the destination — a compromised `isPriceUpdater` can walk the price arbitrarily far, instantly if the cooldown is set to 0**

`AgentOracle.updateAssetPrice` / `updateAssetPriceFromTWAP` / `updateAssetPriceFromV3TWAP` · Severity: **Medium** · Confidence: 65 · Origin: `[phase2: math-precision, invariant]` (`PG-04`), corroborated as leads by access-control/first-principles

**Description**
The deviation check compares only against the immediately preceding stored value, so `n` repeated boundary-value calls compound geometrically (~10.7× in 13 calls / ~6.5 min at the default 30s cooldown; unbounded and instant within one transaction if the owner sets `priceUpdateCooldown=0`, which `setPriceUpdateCooldown` permits — it enforces only an upper bound). This directly defeats the H-4 fix's own documented purpose, which names a "compromised priceUpdater" as the exact threat the cap was built to contain. Demoted from High because the precondition is a compromised/malicious privileged key, not an unprivileged attacker.

**Fix**

```diff
  function setPriceUpdateCooldown(uint32 cooldown) external onlyOwner {
-     require(cooldown <= 300, "Max 5 minutes");
+     require(cooldown >= 30 && cooldown <= 300, "Cooldown out of range");
      priceUpdateCooldown = cooldown;
  }
```
Plus a cumulative/time-weighted movement bound (e.g. a rolling-window aggregate cap) in addition to the existing per-call cap, since a nonzero cooldown alone only slows a compromised-key walk, it doesn't bound its destination. `AgentOracle.sol:549-554`, `:1201-1206`, `:1242-1247`, `:484-487`.

---

### [80] **5. `getAssetUsdTWAP`/`_getQuoteAtTick` truncate to integer quote-token wei before scaling to 1e18 — material rounding error and silent-zero DoS for low-priced tokens quoted in low-decimal stables**

`AgentOracle.getAssetUsdTWAP` / `_getQuoteAtTick` · Severity: **Medium** · Confidence: 80 · Origin: `[phase1: precision-math]`

**Description**
`getAssetUsdTWAP` quotes exactly one agent token and receives an *integer* quote-token-wei amount from `_getQuoteAtTick`, truncated before the later 1e18 scale-up — fixing granularity at `$1e-6` for a 6-decimal quote (USDC, the NatSpec's own example) regardless of true price magnitude. At true price `$0.0000012345`, one wei of truncation is a ~19% understatement; at `$0.0000009`, the result truncates to exactly 0, reverting the V3 update path (`InvalidPrice`) and silently returning `$0` to any direct caller.

**Fix**

```diff
- uint256 quoteAmount = _getQuoteAtTick(twapTick, uint128(baseAmount), v3AgentToken, v3QuoteToken);
- if (v3QuoteDecimals < 18) {
-     priceUsd18 = quoteAmount * (10 ** uint256(18 - v3QuoteDecimals));
- }
+ // Fold the 1e18 scale-up into the same mulDiv used inside _getQuoteAtTick so
+ // truncation happens at 1e18 granularity, not quote-wei granularity.
```
`AgentOracle.sol:944-962`, `:1008-1026`.

---

### [75] **6. Consumer-facing reads (`getAssetPrice`/`isPriceFresh`) never check the L2 sequencer-uptime feed — a frozen pre-downtime price reads as "fresh" throughout the recovery grace window**

`AgentOracle._getPrice` / `isPriceFresh` · Severity: **Medium** · Confidence: 75 · Origin: `[both]` — Phase 1 chain-specific (`P1-03`), Phase 2 first-principles corroboration (lead)

**Description**
The sequencer guard gates writes (and `getEthPrice`) but not `_getPrice`/`getAssetPrice`/`isPriceFresh` — the actual read surface the map identifies as consumed by GaugeController/Lottery/Vault. When an L2 sequencer halts, no writes occur so `assetPriceTimestamp` freezes; once it recovers, writes correctly stay blocked for the `SEQUENCER_GRACE_PERIOD`, but reads never consult the guard, so consumers see the frozen pre-downtime price as fresh for up to `MAX_STALENESS` after the freeze began.

**Fix**

```diff
  function _getPrice() internal view returns (int256 price, uint256 timestamp) {
+     if (!_sequencerIsUp()) return (0, 0);
      if (assetPriceUSD > 0 && assetPriceTimestamp > 0) {
          if (block.timestamp - assetPriceTimestamp < MAX_STALENESS) {
              return (assetPriceUSD, assetPriceTimestamp);
          }
      }
      return (0, 0);
  }
```
`AgentOracle.sol:517-524`, `:1407-1409`.

---

### [70] **7. Single global `MAX_STALENESS` (2h) applied to Chainlink feeds with materially different real heartbeats**

`AgentOracle._readFeedPrice18` · Severity: **Medium** · Confidence: 70 · Origin: `[phase1: oracles]`

**Description**
One constant gates both `chainlinkFeed` (ETH/USD) and `quoteUsdFeed` (an arbitrary lane quote token), regardless of that feed's actual heartbeat — chronically DoS'ing update paths for a slower-heartbeat feed even while healthy, or accepting a faster-heartbeat feed's stall as "fresh" for up to 2 hours.

**Fix**

```diff
- if (block.timestamp - roundUpdatedAt > MAX_STALENESS) return (0, roundUpdatedAt, false);
+ // Compare against a per-feed heartbeat set alongside the feed address in its
+ // setter, instead of one global MAX_STALENESS constant.
```
`AgentOracle.sol:1481`.

---

### [65] **8. `getV3TWAPTick`/`getAssetUsdTWAP`/`getV2AssetQuoteTWAP`/`getAjnaBucketFromV3TWAP` public getters enforce no `MIN_TWAP_DURATION` floor**

Multiple public view getters · Severity: **Medium** · Confidence: 65 · Origin: `[both]` — Phase 1 general/defi-amm (`P1-15`), Phase 2 near-universal multi-agent convergence (math-precision, economic-security, periphery, invariant, asymmetry, boundary, numerical-gap, flow-gap)

**Description**
The state-changing writers enforce `duration >= MIN_TWAP_DURATION`; the public getters reject only `duration==0`. A consumer calling `getAssetUsdTWAP(1)` gets a near-spot, single-block-manipulable price. `getAjnaBucketFromV3TWAP` is itself declared in `IOracle4626` as an integration point. The one confirmed live consumer (`CharmStrategy4626`, verified by the periphery agent) currently passes only the safe `DEFAULT_TWAP_DURATION`, so no live exploit exists today — this is a composability risk for any future/other consumer, not a demonstrated present-tense loss.

**Fix**

```diff
  function getV3TWAPTick(uint32 duration) public view returns (int24 twapTick) {
      if (!v3PoolConfigured) revert V3NotConfigured();
-     if (duration == 0) revert InvalidDuration();
+     if (duration < MIN_TWAP_DURATION) revert InvalidDuration();
```
`AgentOracle.sol:920`, `:944`, `:996`, `:1032`.

---

### [70] **9. `_sequencerIsUp`'s Chainlink call is not wrapped in try/catch, unlike every other feed read in the contract**

`AgentOracle._sequencerIsUp` · Severity: **Low** · Confidence: 70 · Origin: `[both]` — Phase 1 general/oracles (`P1-05`), Phase 2 leads (boundary, numerical-gap)

**Description**
`_readFeedPrice18` wraps its Chainlink calls in try/catch and fails open to `ok=false`; `_sequencerIsUp` calls its feed directly. A reverting/misconfigured `sequencerUptimeFeed` hard-reverts every gated caller instead of failing closed gracefully.

**Fix**
```diff
- (, int256 answer, uint256 startedAt, uint256 updatedAt,) = IChainlinkFeed(feed).latestRoundData();
+ try IChainlinkFeed(feed).latestRoundData() returns (uint80, int256 answer, uint256 startedAt, uint256 updatedAt, uint80) {
+     ...
+ } catch { return false; }
```
`AgentOracle.sol:1412-1422`.

---

### [70] **10. `updateAssetPriceFromV3TWAP` can execute during sequencer downtime/grace period when the V3 lane uses a plain USD-stable quote**

`AgentOracle.updateAssetPriceFromV3TWAP` · Severity: **Low** · Confidence: 70 · Origin: `[both]` — Phase 1 chain-specific (`P1-06`), Phase 2 asymmetry (`PG-05`)

**Description**
The only sequencer check on this path lives inside `_convertQuoteToUsd18`, bypassed by its early return whenever the quote token is a plain USD stable with no `quoteUsdFeed`/`referenceQuoteToken` pinned — unlike the sibling `updateAssetPrice`/`updateAssetPriceFromTWAP`, both of which check unconditionally.

**Fix**
```diff
  function updateAssetPriceFromV3TWAP(uint32 twapDuration) external {
      if (block.chainid != BASE_CHAIN_ID) revert HubOnly();
      if (msg.sender != owner() && !isPriceUpdater[msg.sender]) revert Unauthorized();
      if (!v3PoolConfigured) revert V3NotConfigured();
+     if (!_sequencerIsUp()) revert SequencerDown();
```
`AgentOracle.sol:1222-1253`, `:1435-1453`.

---

### [65] **11. `recordV2Observation` lets a lower-trust `isSwapRecorder` permanently deny the V2 TWAP update lane**

`AgentOracle.recordV2Observation` · Severity: **Low** · Confidence: 65 · Origin: `[phase2: access-control]` (`PG-06`)

**Description**
A recorder can repeatedly reset `v2ObservationTimestamp` faster than `MIN_TWAP_DURATION`, permanently blocking `getV2AssetQuoteTWAP`'s `timeElapsed < duration` check from ever clearing. Bounded impact: the V3 lane and direct `updateAssetPrice` remain fully available.

**Fix**
```diff
  function recordV2Observation() external {
      if (!v2PairConfigured) revert V2NotConfigured();
      if (msg.sender != owner() && !isSwapRecorder[msg.sender]) revert Unauthorized();
+     if (v2ObservationTimestamp != 0 && block.timestamp - v2ObservationTimestamp < MIN_TWAP_DURATION) return;
```
`AgentOracle.sol:450-457`.

---

### [55] **12. `_lzReceive` performs no in-file `origin.sender` check — relies entirely on the (unvendored) OApp base's peer table, unlike sibling contracts in the same repo**

`AgentOracle._lzReceive` · Severity: **Low** · Confidence: 55 · Origin: `[phase1: bridges]`

**Description**
Only `origin.srcEid` is checked in-file. Sibling contracts (`AgentShareOFT.sol`, `ChainlinkVRFIntegratorV2_5.sol`, `VRFConsumer4626.sol`) explicitly re-assert `origin.sender == peers[srcEid]` in-file; this contract does not, giving it less in-file defense-in-depth than the repo's own convention.

**Fix**
```diff
  function _lzReceive(Origin calldata origin, bytes32, bytes calldata payload, address, bytes calldata) internal override {
      if (origin.srcEid != BASE_EID) revert InvalidOriginEid(origin.srcEid);
+     if (origin.sender != peers[origin.srcEid]) revert Unauthorized();
```
`AgentOracle.sol:1316-1322`.

---

### [55] **13. Owner-key centralization: single-step `Ownable`, no timelock on pipeline setters, no pause, uncapped `forceSyncRemotePrice`**

Multiple `onlyOwner` functions · Severity: **Low** · Confidence: 55 · Origin: `[phase1: access-control]`

**Description**
Plain single-step `Ownable` (a fat-fingered transfer or a pre-init `renounceOwnership` permanently bricks the hub); no timelock on any pipeline setter; `forceSyncRemotePrice` sets a remote's price to any value bounded only by `MAX_INITIAL_PRICE_USD` with no deviation cap; no pause mechanism to freeze reads during an incident.

**Fix:** Adopt `Ownable2Step`; add a timelock to pipeline setters; add a guardian-pausable read path. `AgentOracle.sol:5`, `:302`, `:594-607`.

---

### [55] **14. `lockReferenceQuoteToken` is an irreversible latch with no validation that a lane is actually configured against the token being locked**

`AgentOracle.lockReferenceQuoteToken` · Severity: **Low** · Confidence: 55 · Origin: `[phase1: access-control]`

**Description**
The only precondition is `referenceQuoteToken != address(0)` — a typo'd address, once locked, can never be corrected, permanently preventing both `setV3Pool` and `setV2Pair` from ever being configured with the correct quote token again.

**Fix**
```diff
  function lockReferenceQuoteToken() external onlyOwner {
      if (referenceQuoteToken == address(0)) revert ReferenceQuoteTokenUnset();
+     require(v3QuoteToken == referenceQuoteToken || v2QuoteToken == referenceQuoteToken, "no lane matches");
      referenceQuoteTokenLocked = true;
```
`AgentOracle.sol:352-356`.

---

### [55] **15. `setV3Pool`/`setV2Pair` validate pool/pair genuineness only by `token0()/token1()` match — no factory, liquidity, or cardinality check**

`AgentOracle.setV3Pool` / `setV2Pair` · Severity: **Low** · Confidence: 55 · Origin: `[phase1: defi-amm, oracles]`

**Description**
A contract that answers `token0()/token1()` correctly but returns arbitrary `observe()`/reserves data would be accepted. Bounded by: `observe()` fails closed with no try/catch on a thin/fresh pool; V2 baseline is correctly re-snapshotted on every `setV2Pair`; both write paths remain 20%-capped.

**Fix:** Add a minimum-cardinality assertion (V3) and/or minimum-liquidity check at config time, or document pool genuineness/depth as an explicit operational requirement. `AgentOracle.sol:370-401`, `:410-444`.

---

### [50] **16. `broadcastAssetPriceWithFees` has no `HubOnly` guard and is an atomic all-or-nothing multicast**

`AgentOracle.broadcastAssetPriceWithFees` · Severity: **Low** · Confidence: 50 · Origin: `[phase1: bridges]`

**Description**
Unlike every other write path, this function doesn't check `block.chainid == BASE_CHAIN_ID` (low materiality — remote-originated broadcasts are dropped by receivers' EID check). Separately, one destination's fee mismatch reverts the entire multicast despite the docstring's partial-failure framing.

**Fix:** Add the `HubOnly` check for consistency; either accept-and-document the atomicity or wrap each `_lzSend` for independent delivery. `AgentOracle.sol:1273-1304`.

---

### [70] **17. Contract's advertised manipulation-resistance (tick capping, auto-tuning) is entirely dead code**

`AgentOracle` header NatSpec vs. `_recordObservation`/`_updateCapFrequency`/`_autoTuneTickCap` · Severity: **Low** · Confidence: 70 · Origin: `[phase2: first-principles]` (`PG-07`), corroborates Phase 1's interface-mismatch note

**Description**
The header claims tick-capping and auto-tuning as manipulation-resistance mechanisms; both are 100% unreachable (`maxTicksPerObservation` never written by any live path). The live V2/V3 lanes never depended on this machinery, so no protection an integrator would have actually used is lost — but the documented security model overstates what's enforced, and `IOracle4626` still declares 6 methods (`setV4Pool`, `recordSwapObservation`, `getCurrentTick`, `getTWAPTick`, `tickToPrice`, `getAssetEthTWAP`) that this implementation always reverts on (see Finding 1 for the one confirmed live consequence).

**Fix:** Delete the dead V4/tick-cap subsystem and correct the header NatSpec, or split `IOracle4626` into a base the implementation actually satisfies plus an optional V4 extension. `AgentOracle.sol:28-32`, `:617-919` (assorted dead functions); `IOracle4626.sol:21,35,37,39,41,75`.

---

### [50] **18. Unbounded `string symbol` in the cross-chain payload — no length guard before storage write**

`AgentOracle._lzReceive` · Severity: **Low** · Confidence: 50 · Origin: `[phase1: bridges]`

**Description**
A compromised hub broadcaster could set a very large symbol, forcing large calldata/decode/SSTORE cost on every remote, potentially exceeding executor-provisioned gas (LZ V2 gas limits from options are off-chain-agreed, not on-chain-enforced).

**Fix:** Bound accepted symbol length before the write (e.g. skip the symbol update if it exceeds a small cap). `AgentOracle.sol:1324`, `:1370-1372`.

---

### [50] **19. No Chainlink `minAnswer`/`maxAnswer` circuit-breaker check**

`AgentOracle._readFeedPrice18` · Severity: **Low** · Confidence: 50 · Origin: `[phase1: oracles]`

**Description**
During a black-swan de-peg, an aggregator can clamp and report `minAnswer`/`maxAnswer` as a fresh, in-range value — passing every existing check. Most relevant to `quoteUsdFeed` for a smaller/exotic quote token.

**Fix:** Read and enforce the aggregator's `minAnswer`/`maxAnswer` bounds. `AgentOracle.sol:1463-1499`.

---

### [50] **20. `MAX_INITIAL_PRICE_USD` (1,000,000e18) bootstrap bound is cosmetic for realistically low-priced tokens**

`AgentOracle.initializeAssetPrice` / `forceSyncRemotePrice` · Severity: **Low** · Confidence: 50 · Origin: `[phase1: oracles]`

**Description**
For a genuinely cents-priced agent token, the ceiling permits anchoring anywhere across many orders of magnitude above true value — it prevents only absurd/overflow-adjacent inputs, not a meaningfully wrong anchor.

**Fix:** Document as a fat-finger guard only, or derive the bound from the configured TWAP source at init time. `AgentOracle.sol:576-586`, `:594-607`.

---

Findings List

| # | Confidence | Title |
|---|---|---|
| 1 | [95] | Dead `getAssetEthTWAP` bricks `AgentGaugeController`'s buyback route |
| 2 | [90] | `_lzReceive` deviation-cap fails in both directions (stale unbounded / fresh fabricated-as-fresh) |
| 3 | [85] | V2 TWAP unbounded window + idle-gap extrapolation amplification |
| 4 | [80] | V3 quote-wei truncation — precision loss / silent-zero DoS |
| 5 | [75] | Consumer reads ignore the sequencer guard |
| 6 | [70] | Single global `MAX_STALENESS` across differently-heartbeated feeds |
| 7 | [70] | `_sequencerIsUp` not try/catch'd |
| 8 | [70] | `updateAssetPriceFromV3TWAP` skips sequencer guard (USD-stable config) |
| 9 | [70] | Advertised manipulation-resistance (tick-cap/auto-tune) is dead code |
| 10 | [65] | Compounding deviation-cap bypass via repeated boundary-value updates |
| 11 | [65] | Public TWAP getters lack `MIN_TWAP_DURATION` floor |
| 12 | [65] | `recordV2Observation` griefing DoS of the V2 lane |
| 13 | [55] | `_lzReceive` no in-file `origin.sender` check |
| 14 | [55] | Owner-key centralization (single-step `Ownable`, no timelock, no pause) |
| 15 | [55] | `lockReferenceQuoteToken` irreversible latch, unvalidated |
| 16 | [55] | Pool/pair genuineness validated only by token address match |
| 17 | [50] | `broadcastAssetPriceWithFees` missing `HubOnly`, atomic multicast |
| 18 | [50] | Unbounded `string symbol` in cross-chain payload |
| 19 | [50] | No `minAnswer`/`maxAnswer` circuit breaker |
| 20 | [50] | `MAX_INITIAL_PRICE_USD` bootstrap bound cosmetic |

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path could not be completed to ≥50 confidence in this pass. Not scored._

- **Misleading `RemotePriceUpdateSkipped("deviation_clamped")` event** — `_lzReceive` — Code smells: event name says "Skipped" but the clamped price is actually written — off-chain monitors keyed on this event will misclassify a successful clamped update as a rejection.
- **`BASE_CHAIN_ID` (hardcoded) vs `BASE_EID` (registry-derived, owner-mutable) never cross-validated on-chain** — constructor — Code smells: a registry misconfiguration at deploy time for one chain's `AgentOracle` could desync that deployment's trusted inbound EID from the intended hub, silently, since `BASE_EID` doesn't affect the CREATE2 address.
- **V2 cumulative-price math omits `unchecked`, diverging from Uniswap V2's intentional-wraparound design** — `_currentV2CumulativeAssetPerQuote` / `getV2AssetQuoteTWAP` — Code smells: checked arithmetic reverts instead of wrapping at the `uint32` timestamp boundary (~year 2106); fail-closed DoS only, multi-decade trigger horizon.
- **CREATE2 "same address on every chain" claim is in tension with the per-chain-varying `_chainlinkFeed` constructor argument** — constructor NatSpec — Code smells: deployment-process risk, not a code bug; the current comment is misleading about what "same constructor args" actually requires.
- **Shared `quoteUsdFeed` consumed by both independently-configured V2 and V3 lanes** — `setV2Pair`/`setV3Pool`/`_convertQuoteToUsd18` — Code smells: consistency validated only when `referenceQuoteToken` is pinned; a lane configured before/without that pin is never cross-checked against the feed's actual denomination.
- **Equal-timestamp same-block hub updates + LayerZero unordered delivery could let an older packet overwrite a newer one on a remote** — `_lzReceive` out-of-order guard uses strict `<` — Code smells: requires `priceUpdateCooldown=0` (owner-permitted) and two same-block hub writes; narrow precondition.
- **`_lzReceive`'s stale-recovery freshness check keys off the hub's embedded timestamp, not local receipt time** — Code smells: a hub whose broadcast timestamps lag wall-clock could route remotes through the unclamped stale-recovery path even under otherwise-normal conditions; feeds into Finding 2's mechanism but the clock-source angle itself remains unconfirmed against real hub timestamp semantics.
- **`isPriceFresh()`/`_getPrice()` use strict `<` `MAX_STALENESS` while `_lzReceive`'s clamp branch uses `<=`** — Code smells: boundary inconsistency; the boundary agent's own analysis concluded worst-case impact is one extra clamped step, not exploitable for gain.
- **`recordV2Observation`'s NatSpec claims "Permissionless" but the function is owner/`isSwapRecorder`-gated** — doc/code mismatch only, fails more closed than documented, not a security gap.

---

## Access-Control Inventory

| Function | Guard (cited) | Who can call | State written | Moves value? |
|---|---|---|---|---|
| `constructor` | n/a (deploy) | deployer | `BASE_EID`, `chainlinkFeed`, `assetSymbol` | no |
| `setChainlinkFeed` | `onlyOwner`; zero-check | owner | `chainlinkFeed` | no |
| `setSequencerUptimeFeed` | `onlyOwner` | owner | `sequencerUptimeFeed` | no |
| `setReferenceQuoteToken` | `onlyOwner`; lock check | owner | `referenceQuoteToken` | no |
| `setQuoteUsdFeed` | `onlyOwner` | owner | `quoteUsdFeed` | no |
| `lockReferenceQuoteToken` | `onlyOwner`; unset check | owner | `referenceQuoteTokenLocked` | no |
| `setV4Pool` | `pure`, unconditional revert | nobody | none (dead) | no |
| `setV3Pool` | `onlyOwner` | owner | v3-lane config | no |
| `setV2Pair` | `onlyOwner` | owner | v2-lane config + snapshot | no |
| `recordV2Observation` | owner OR `isSwapRecorder` | owner/recorder | v2 baseline snapshot | no |
| `setSwapRecorder` | `onlyOwner`; zero-check | owner | `isSwapRecorder[·]` | no |
| `setPriceUpdater` | `onlyOwner`; zero-check | owner | `isPriceUpdater[·]` | no |
| `setPriceUpdateCooldown` | `onlyOwner`; `<=300` | owner | `priceUpdateCooldown` | no |
| `getEthPrice` | none (view) | anyone | none | no |
| `getAssetPrice` | none (view) | anyone | none | no |
| `updateAssetPrice` | Base-only + owner/updater | owner/updater, Base | price triple | no |
| `initializeAssetPrice` | `onlyOwner`; Base-only; one-shot | owner, Base, once | price triple | no |
| `forceSyncRemotePrice` | `onlyOwner`; remote-only | owner, non-Base | price triple | no |
| `recordSwapObservation` | unconditional revert | nobody | none (dead) | no |
| `updateAssetPriceFromTWAP` | Base-only + owner/updater | owner/updater, Base | price triple | no |
| `updateAssetPriceFromV3TWAP` | Base-only + owner/updater | owner/updater, Base | price triple | no |
| `broadcastAssetPriceWithFees` | owner/updater, payable | owner/updater | none (emits) | yes — native |
| `_lzReceive` | `origin.srcEid==BASE_EID` + endpoint/peer (base) | LayerZero endpoint, hub-origin only | price triple | no |
| `getObservationState`/`getTickCapState` | none (view) | anyone | none | no |
| `isPriceFresh` | none (view) | anyone | none | no |
| `getV3TWAPTick`/`getAssetUsdTWAP`/`getV2AssetQuoteTWAP`/`getAjnaBucketFromV3TWAP` | none beyond `duration!=0`/lane-configured (view) | anyone | none | no |
| `tickToAjnaBucket` | none (pure) | anyone | none | no |

**Roles:** Owner (`Ownable`, single-step, transfer mechanics external to this file) — every `onlyOwner` function plus implicit `owner()` authorization on the role-gated paths. `isPriceUpdater` (owner-toggled boolean) — hub price-write paths + broadcast. `isSwapRecorder` (owner-toggled boolean) — `recordV2Observation`. LayerZero endpoint + `BASE_EID` (immutable, set at construction) — sole trust anchors for `_lzReceive`.

**Unguarded list:** none — every reachable state-writer gates on owner/role/chain-id/message-origin. `setV4Pool`, `recordSwapObservation`, `_updatePriceFromTWAPExternal` are syntactically callable by anyone but revert unconditionally and write no state (see Finding 17).

---

## Threat Model

| Actor | Reaches | Could gain | Addressed by |
|---|---|---|---|
| LayerZero hub broadcaster (honest operation or compromised) | `_lzReceive` | Unbounded single-message price jump on stale remotes; fabricated-but-fresh value on fresh remotes | **Finding 2** |
| Compromised `isPriceUpdater` | `updateAssetPrice`/`updateAssetPriceFromTWAP`/`updateAssetPriceFromV3TWAP`/`broadcastAssetPriceWithFees` | Walk `assetPriceUSD` to any value via repeated boundary-value calls | **Finding 4** |
| Attacker manipulating an idle V2 pair | `getV2AssetQuoteTWAP` (via owner/updater's routine call, or directly if a consumer exposes it) | ~96×-amplified single-block manipulation clearing the 20% cap | **Finding 3** |
| Owner (single key, trusted by design) | Every `onlyOwner` setter + `initializeAssetPrice`/`forceSyncRemotePrice` | Unbounded remote price override; instant pipeline redirection | **Finding 13** — invariant holds only insofar as the owner key is honestly held; no on-chain control bounds a compromised owner beyond `MAX_INITIAL_PRICE_USD` |
| Owner supplying a malicious/thin pool | `setV3Pool`/`setV2Pair` (token0/1-matching only) | Arbitrary tick/cumulative feed into the pricing pipeline | **Finding 16** |
| Arbitrary caller of public TWAP getters | `getV3TWAPTick`/`getAssetUsdTWAP`/`getV2AssetQuoteTWAP` with unfloored `duration` | Near-spot, manipulable price handed to any consumer that doesn't itself floor the duration | **Finding 11** |
| Hostile/misconfigured `sequencerUptimeFeed` | `_sequencerIsUp` (un-try/catch'd) → every gated write + `getEthPrice`/`_convertQuoteToUsd18` | DoS of hub price production | **Finding 9** (and read-side gap in **Finding 5**) |
| `isSwapRecorder` (owner-appointed, lower trust) | `recordV2Observation` | Reset V2 TWAP baseline at a chosen moment / permanently deny the V2 lane | **Finding 12** |

---

> ⚠️ This review was performed by an AI-orchestrated three-phase audit pipeline (context mapping → breadth checklist agents → blind depth attack agents → hybrid reconciliation). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human review, a bug bounty program, and on-chain monitoring are strongly recommended, particularly given Finding 1 (a confirmed functional break in a downstream consumer contract) and Finding 2 (a confirmed break of the core cross-chain price-integrity invariant).
