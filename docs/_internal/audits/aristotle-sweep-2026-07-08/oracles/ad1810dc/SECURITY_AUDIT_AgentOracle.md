# Security Audit — `AgentOracle.sol`

**Scope:** `AgentOracle.sol` only (omnichain agent-lane price oracle: Uniswap V4/V3/V2 TWAP
+ Chainlink + LayerZero broadcast/receive).
**Focus areas (as requested):** stale-data handling, cross-chain validation, privileged setters.
**Method:** manual review of the full contract. Line references are approximate to the reviewed file.

The contract already carries fixes for several prior findings (H-01, H-4, H-5, M-1, M-3, M-5, M-8, L-3,
L-5). The issues below are ones that remain (or were introduced by those fixes).

---

## Severity summary

| ID | Severity | Area | Title |
|----|----------|------|-------|
| H-1 | **High** | stale-data / privileged setter | `setV4Pool` keeps stale observations when only the pool key changes |
| M-1 | **Medium** | stale-data | `_sequencerIsUp` lacks grace period and misuses staleness on a status feed |
| M-2 | **Medium** | privileged setter | `updateAssetPrice` direct setter has no cooldown / sequencer / freshness guard |
| M-3 | **Medium** | stale-data (DoS) | Permissionless `recordV2Observation` can grief the V2 TWAP lane |
| M-4 | **Medium** | cross-chain | `_lzReceive` applies neither the deviation cap nor an absolute sanity bound |
| L-1 | Low | stale-data / cross-chain | Broadcast does not require the price to be fresh |
| L-2 | Low | cross-chain | `_lzReceive` lets the hub overwrite `assetSymbol` arbitrarily |
| L-3 | Low | privileged / fees | `_payNative` spends contract balance, not `msg.value` |
| L-4 | Low | stale-data | `_sequencerIsUp` reads the feed without `try/catch` (reverts brick manual updates) |
| I-1 | Info | stale-data | `(0,0)` sentinel return contract must be enforced by consumers |

---

## H-1 — `setV4Pool` retains stale observations when the pool key changes (High)

**Where:** `setV4Pool` (~line 400).

The M-5 fix gates the ring-buffer reset on whether the **PoolManager address** changed:

```solidity
bool managerChanged = address(poolManager) != _poolManager;
...
if (managerChanged || observationState.cardinality == 0) {
    // initialize observations[0], reset observationState
}
```

In Uniswap **V4 there is a single canonical `PoolManager` per chain** — every pool is a `PoolKey`
inside that one singleton. Therefore, after the first configuration, `managerChanged` is essentially
**always false**. If the owner re-points the oracle to a *different pool* (new `assetPoolKey` and/or a
new `assetIsToken0`) while keeping the same manager — the normal case — the observation ring buffer is
**not** reset.

**Impact:** the next `recordSwapObservation` computes `movement = newTick - prevObs.prevTruncatedTick`
against the *old pool's* last tick and continues accumulating `tickCumulative` /
`tickCumulativeTruncated` from the old pool. For at least one full TWAP window the derived
`getAssetEthTWAP` / `getTWAPTick` values are corrupted (and the auto-tuner reacts to a spurious huge
capped movement). This silently corrupts the price consumed by slippage protection and lottery/prize
valuation. It is triggered by a routine admin operation with no attacker gate → high impact, medium
likelihood.

**Remediation:** reset the ring buffer whenever the pool *identity* changes, not just the manager:
```solidity
PoolId newId = _poolKey.toId();
bool poolChanged = (PoolId.unwrap(assetPoolKey.toId()) != PoolId.unwrap(newId))
                   || assetIsToken0 != _assetIsToken0
                   || address(poolManager) != _poolManager;
if (poolChanged || observationState.cardinality == 0) { /* reinitialize */ }
```
Also emit an event when the buffer is (re)initialized so off-chain monitors know a TWAP warmup began.

---

## M-1 — `_sequencerIsUp` lacks grace period and misuses staleness on a status feed (Medium)

**Where:** `_sequencerIsUp` (~line 1470).

```solidity
(, int256 answer,, uint256 updatedAt,) = IChainlinkFeed(feed).latestRoundData();
if (updatedAt > block.timestamp) return false;
if (block.timestamp - updatedAt > MAX_STALENESS) return false;   // (a)
return answer == 0;                                              // (b)
```

Two problems:

1. **No grace-period check.** The canonical Chainlink L2 sequencer-uptime pattern also reads
   `startedAt` and requires `block.timestamp - startedAt > GRACE_PERIOD` (typically 3600s). Immediately
   after the sequencer restarts, L2 state (including the V4/V3/V2 pools this oracle reads) can be stale
   or manipulable. As written, the oracle trusts pool state the instant `answer == 0`, defeating the
   purpose of the guard.

2. **Staleness applied to a status feed (a).** Sequencer-uptime feeds only publish a new round on a
   **status change**, so `updatedAt` can legitimately be many hours/days old while the sequencer is
   perfectly healthy. Check (a) then returns `false` ("down") and **blocks every manual update path**
   (`updateAssetPriceFromTWAP`, `updateAssetPriceFromV3TWAP`, `_convertQuoteToUsd18`) → self-inflicted
   DoS. `MAX_STALENESS` is the wrong bound for this feed.

**Remediation:** drop check (a) for the sequencer feed; add the grace-period check instead:
```solidity
(, int256 answer, uint256 startedAt, ,) = IChainlinkFeed(feed).latestRoundData();
if (answer != 0) return false;              // 1 == down
if (block.timestamp - startedAt < GRACE_PERIOD) return false;
return true;
```

---

## M-2 — Direct `updateAssetPrice` setter lacks cooldown / sequencer / freshness (Medium)

**Where:** `updateAssetPrice` (~line 655).

The direct privileged setter enforces `>0`, `OracleNotInitialized`, and the 20% per-call deviation cap
(H-4 fix), but — unlike the TWAP paths — it does **not** enforce `priceUpdateCooldown` and does **not**
check the sequencer. A compromised or buggy `isPriceUpdater` (or a rushed owner) can therefore move the
stored price by `MAX_PRICE_DEVIATION` (20%) **every transaction, with no rate limit**, walking the
oracle arbitrarily far within a handful of blocks, and can do so while the sequencer state is stale.
This is the weakest of the write paths and the most attractive target if an updater key leaks.

**Remediation:** apply the same `priceUpdateCooldown` gate and `_sequencerIsUp()` check used by
`updateAssetPriceFromTWAP`. Consider also a per-window cumulative deviation cap (not just per-call) if
updater keys are considered a realistic threat.

---

## M-3 — Permissionless `recordV2Observation` can grief the V2 TWAP lane (Medium)

**Where:** `recordV2Observation` (~line 530) and `getV2AssetQuoteTWAP` (~line 1130).

The V2 lane stores a **single** baseline `(v2PriceCumulativeLast, v2ObservationTimestamp)` and
`recordV2Observation()` is **permissionless**; each call overwrites the baseline with the current
cumulative/timestamp. `getV2AssetQuoteTWAP` requires
`timeElapsed = currentTs - v2ObservationTimestamp >= duration (>= 1800s)`.

An attacker who calls `recordV2Observation()` every block keeps `v2ObservationTimestamp ≈ now`, so
`timeElapsed` never reaches `duration` and `getV2AssetQuoteTWAP` / the V2 branch of
`updateAssetPriceFromTWAP` **permanently revert `NeedMoreObservations`** — a cheap, indefinite DoS of the
V2 pricing lane. The single-slot design also lets the attacker choose exactly when the baseline snapshot
is taken.

**Remediation:** either (i) restrict `recordV2Observation` to `isSwapRecorder`/authorized callers, or
(ii) keep a rolling pair of observations and never discard the older snapshot needed for the window
(only advance once `timeElapsed >= duration`), so a caller cannot reset the usable window.

---

## M-4 — `_lzReceive` applies neither the deviation cap nor an absolute sanity bound (Medium)

**Where:** `_lzReceive` (~line 1420).

Origin is validated (`origin.srcEid != BASE_EID` on top of OApp peer checks), price sign and timestamp
are sanitized, and out-of-order/rollback is rejected — good. However, the remote write is
`assetPriceUSD = price` with **no `MAX_PRICE_DEVIATION` check and no `MAX_INITIAL_PRICE_USD`-style
absolute bound**. The H-01 bootstrap protection and the deviation guard that protect every *local* write
path are entirely **absent on remote chains**.

This is partly by design (remotes trust the hub), but it means the security of every remote reduces
entirely to the hub key + LayerZero path, with no local circuit breaker. A single malicious/erroneous
hub broadcast (or a compromised hub updater walking the hub value 20%/tx) propagates unbounded values to
all remotes with zero local sanity limit.

**Remediation:** apply at least an absolute sanity bound (analogous to `MAX_INITIAL_PRICE_USD`) on the
received price, and consider an optional per-message deviation cap on remotes with an owner-controlled
"trust hub fully" override. At minimum, document the trust assumption explicitly at the call site.

---

## L-1 — Broadcast does not require the price to be fresh (Low)

`broadcastAssetPriceWithFees` (~line 1385) checks only `assetPriceUSD > 0`. It will happily broadcast a
value older than `MAX_STALENESS` (which `_getPrice()`/`isPriceFresh()` would treat as stale). Freshness
metadata does propagate (the hub timestamp is forwarded), so downstream `isPriceFresh` stays correct,
but this still spends LZ fees to push data the hub itself would report as stale.
**Remediation:** require `isPriceFresh()` before broadcasting.

## L-2 — `_lzReceive` lets the hub overwrite `assetSymbol` (Low)

Any non-empty `symbol` in the payload replaces `assetSymbol`. Identity/label confusion on remotes if the
hub (or a future hub bug) sends an unexpected symbol. Consider pinning the symbol or gating symbol
changes behind an explicit flag.

## L-3 — `_payNative` spends contract balance, not `msg.value` (Low)

`_payNative` (~line 1410) checks `address(this).balance < _nativeFee`. Any ETH held by the contract
(stranded refunds, donations) can be consumed toward LZ fees. `broadcastAssetPriceWithFees` mitigates
this with `require(msg.value >= totalFees)` and a remainder refund, but the override itself has no
accounting tie to `msg.value`. Keep an eye on invariants if new send paths are added.

## L-4 — `_sequencerIsUp` reads the feed without `try/catch` (Low)

Unlike `_readFeedPrice18`, `_sequencerIsUp` calls `latestRoundData()` directly. A reverting/misbehaving
sequencer feed bricks all manual update paths and `getEthPrice`. Wrap in `try/catch` and fail closed
deliberately.

## I-1 — `(0,0)` sentinel must be enforced by consumers (Info)

`_getPrice()` / `getAssetPrice()` / `getEthPrice()` return `(0, 0)` on stale/failure rather than
reverting. This is a reasonable fail-soft design, but any consumer that treats `0` as a valid price
(e.g., slippage math dividing by price) is a downstream footgun. Ensure GaugeController/Lottery/Vault
integrations explicitly reject `price == 0`. Consider documenting the sentinel contract prominently.

---

## Notes on things reviewed and found OK

- `_readFeedPrice18`: decimals bound (`>18` rejected), `answer<=0`, future-timestamp, `MAX_STALENESS`,
  and `answeredInRound < roundId` checks are all present and correct (fail-soft via tuple).
- `_lzReceive`: origin EID check + timestamp clamp + monotonic (anti-rollback) guard are sound.
- `initializeAssetPrice` / H-01 bootstrap gating across `updateAssetPrice*` paths is consistent on the
  hub side.
- `setV3Pool` / `setV2Pair`: token-ordering, decimals (`>18`), and `referenceQuoteToken` pinning checks
  are correct; deprecated `broadcastAssetPrice` is hard-reverted (M-3/M-01 fix).
- `_findObservationBefore` correctly traverses `cardinalityNext` (H-5 fix) newest→oldest.
- Full-precision `Math.mulDiv` used throughout `tickToPrice` / `_getQuoteAtTick`; no obvious overflow at
  tick bounds.
