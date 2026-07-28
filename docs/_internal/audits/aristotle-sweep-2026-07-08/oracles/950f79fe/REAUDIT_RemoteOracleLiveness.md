# AgentOracle — Post-Fix Re-Audit (Remote-Oracle Liveness Hardening)

**Target:** `AgentOracle.sol` (1676 LoC), `contract AgentOracle is OApp, IOracle4626`
**Scope of this pass:** Confirm that the prior *residual Medium* issues concentrated in the
cross-chain (remote) price path are closed by the "remote-oracle liveness hardening"
changes, and report **only remaining exploitable findings**.
**Focus area:** `_lzReceive` (L1468–1511) and the state it mutates
(`assetPriceUSD`, `assetPriceTimestamp`), plus the recovery paths
`forceSyncRemotePrice` (L732) and the consumer view `_getPrice` (L655).

---

## 1. Summary of the hardening under review

The remote receive path now performs, in order (L1474–1510):

1. **Origin authentication** — `origin.srcEid != BASE_EID` ⇒ `revert InvalidOriginEid`.
2. **Sign check** — `price <= 0` ⇒ `revert InvalidPrice`.
3. **Freshness clamp** — `safeTimestamp = min(timestamp, block.timestamp)` (kills future-dated
   timestamps / staleness-underflow).
4. **Out-of-order guard** — `safeTimestamp < assetPriceTimestamp` ⇒ `emit
   RemotePriceUpdateSkipped("out_of_order"); return;`.
5. **Upper bound** — `price > MAX_INITIAL_PRICE_USD` ⇒ `revert InvalidPrice`.
6. **Deviation guard with stale-recovery bypass** — if deviation `> MAX_PRICE_DEVIATION`
   **and** the stored price is still fresh (`block.timestamp - assetPriceTimestamp <=
   MAX_STALENESS`) ⇒ `emit RemotePriceUpdateSkipped("deviation_guard"); return;`.
   If already stale, the authenticated hub price is accepted to recover liveness.

## 2. Status of the prior residual Medium issues

| Prior residual issue | Status | Evidence |
|---|---|---|
| **Permanent remote liveness DoS** — a legitimate large move (or a dropped packet during a trend) made every subsequent broadcast fail the deviation guard forever, freezing the remote. | **Closed (permanent case).** Now downgraded to a *bounded* outage — see F-1. | Stale-recovery bypass (L1493–1498) guarantees the next authenticated hub price is accepted once `block.timestamp - assetPriceTimestamp > MAX_STALENESS`. |
| **Freshness spoofing / future-timestamp underflow** on remotes via a forged/late payload timestamp. | **Closed.** | `safeTimestamp` clamp (L1481) + out-of-order guard (L1484). Because both `min` operands are monotone non-decreasing, the stored timestamp is monotone and cannot be rolled back or inflated past receipt time. |
| **Replay / rollback of stale packets** re-lowering the stored price/timestamp. | **Closed.** | Out-of-order guard rejects any `safeTimestamp < assetPriceTimestamp` before any state write (L1484–1487). |
| **Owner recovery unusable during sustained packet loss.** | **Closed.** | `forceSyncRemotePrice` (L732) is remote-only, monotone (`_timestamp < assetPriceTimestamp` reverts), bounded by `MAX_INITIAL_PRICE_USD`, and rejects future timestamps. |

## 3. Remaining exploitable findings

### F-1 (Medium, partially mitigated) — Single dropped/censored packet during any >20 % cumulative move causes an up-to-`MAX_STALENESS` (2 h) remote price outage

**Where:** `_lzReceive` deviation guard, L1488–1499; consumer impact via `_getPrice`
(L655–663) and `getAssetPrice` / `getEthPrice`.

**Mechanism.** The hub advances price in ≤ `MAX_PRICE_DEVIATION` (20 %) steps
(`updateAssetPrice` L692, `_updatePriceFromTWAP` L1270). The remote deviation guard,
however, always compares the incoming price against the remote's **last accepted** value,
not against the hub's previous *broadcast*. If a single broadcast is lost or censored while
the price is trending:

* Remote anchor = `H0`. Broadcast `H1` (+20 %) is dropped.
* `H2` arrives: deviation vs `H0` ≈ 44 % > 20 % ⇒ skipped while fresh.
* `H3`, `H4`, … each deviate even more vs the stale `H0` anchor ⇒ all skipped.

The remote therefore rejects **every** subsequent update until its stored value ages past
`MAX_STALENESS` (L1495), at which point `_getPrice` has already been returning `(0,0)` for
the remainder of the window. Consumers (lottery USD valuation, gauge slippage guard) lose
pricing for up to ~2 h.

**Exploitability.** LayerZero packet loss/censorship of a *single* message is cheap, and
volatility (the exact condition that produces >20 % cumulative moves) is when correct
remote pricing matters most. No hub compromise is required; natural packet loss during a
trend reproduces it.

**Why only "partially mitigated".** The hardening removed the *permanent* freeze but the
recovery is gated on full staleness, so the failure mode is now a *guaranteed multi-hour
outage* rather than an indefinite one.

**Recommended remediation (pick one):**
* On a deviation-guard hit, **converge instead of drop**: move the stored price toward the
  candidate by at most `MAX_PRICE_DEVIATION` per accepted packet (bounded catch-up), so a
  trending series is tracked rather than rejected; or
* Gate recovery on a **much shorter** dedicated threshold (e.g. a few `priceUpdateCooldown`
  intervals) instead of the full `MAX_STALENESS`; or
* Compare the deviation against the **most recent received candidate**, persisting the last
  rejected candidate so a confirmed trend is admitted on the second observation.

### F-2 (Low → Medium under ordered execution) — Inconsistent revert-vs-skip lets a single out-of-range hub broadcast block the remote's inbound channel

**Where:** `_lzReceive` L1489 (`price > MAX_INITIAL_PRICE_USD` ⇒ `revert InvalidPrice`),
contrasted with the skip-and-`return` treatment of the out-of-order (L1485) and deviation
(L1496) rejections.

**Mechanism.** Steps 4 and 6 treat unwanted *payload content* as "skip, consume the nonce,
keep the channel healthy". Step 5 (and the `price <= 0` check at L1478) instead **revert on
payload content**. A revert in `_lzReceive` does not consume the nonce — the message stays
pending and will revert identically on every retry. Under ordered/blocking delivery this
**bricks all future price delivery** to that remote; even under lazy/unordered delivery it
permanently parks a stuck message and complicates operations. Because the value is bounded
only at the hub, any hub bug/broadcast that emits `price > 1e24` converts a one-off bad
value into a channel-level liveness DoS.

**Remediation.** For post-authentication *content* checks (`price <= 0`,
`price > MAX_INITIAL_PRICE_USD`), use the same `emit RemotePriceUpdateSkipped(...); return;`
pattern as the other guards. Reserve `revert` for the authentication check
(`origin.srcEid != BASE_EID`) only.

### F-3 (Low) — Stale-recovery bypass can latch an anomalous hub value that the deviation guard then defends against correction

**Where:** L1493–1498 (bypass) followed by the fresh-path deviation guard on the next packet.

**Mechanism.** Once the remote is stale, the deviation guard is disabled, so a *single*
anomalous but hub-authenticated price (e.g. a one-off TWAP artefact that passed the hub's
own guards, or an operational `forceSync`-style value) is accepted and immediately becomes
a **fresh** anchor. If the correct price is then >20 % away, the corrective broadcast is
rejected by the now-active deviation guard for up to `MAX_STALENESS`. This is the same
freeze mechanism as F-1 but seeded by a bad value rather than a dropped packet, and it
means the recovery path can install a value that the guard subsequently protects from being
fixed. Bounded to ~2 h and requires an anomalous hub value, hence Low, but it shares the
remediation with F-1 (convergence / shorter recovery threshold removes the latch).

## 4. Observations (not independently exploitable)

* **Remote deviation guard is defense-in-depth only.** On a remote chain the *only* writers
  of `assetPriceUSD` are the authenticated hub (`_lzReceive`) and the owner
  (`forceSyncRemotePrice`); there is no attacker-writable remote price path. The deviation
  guard therefore protects solely against a compromised/buggy hub, while carrying the
  liveness cost in F-1/F-3. Consider whether bounded step-convergence (which preserves the
  anti-manipulation intent *and* fixes the liveness fragility) is a strictly better trade.
* **`_getPrice` fail-closed behaviour is correct** (returns `(0,0)` when stale, L655–663),
  so F-1/F-3 degrade to "no price" rather than "wrong price" for compliant consumers — this
  is the right failure direction, and it is why the findings are liveness- rather than
  integrity-severity.
* **Sequencer guard is not applied in `_lzReceive`** (correct: the remote is consuming
  cross-chain data, not reading an L2 feed), while `_convertQuoteToUsd18` /
  `_updatePriceFromTWAP` do gate on `_sequencerIsUp` (L1583, L1257). No issue.

## 5. Verdict

The prior **residual Medium liveness issues on the remote path are closed in their
*permanent* form**: replay/rollback, freshness spoofing, and indefinite deviation-lock are
all addressed. What **remains exploitable** is a **bounded (≤ `MAX_STALENESS` ≈ 2 h) remote
pricing outage** reachable by a single dropped/censored packet during a >20 % move (F-1),
plus a channel-blocking inconsistency (F-2) and a value-latch edge case (F-3). All three
share a single root cause — the deviation guard **drops** rather than **converges** — and a
single fix (bounded step-wise convergence, or a much shorter dedicated recovery threshold)
closes all of them.
