# Re-audit — `AgentOracle._lzReceive` (bounded convergence + non-reverting payload validation)

**Scope.** `_lzReceive` (AgentOracle.sol L1468–1527) and its immediate dependencies
(`assetPriceUSD`, `assetPriceTimestamp`, `_getPrice`, constants `MAX_PRICE_DEVIATION`,
`MAX_STALENESS`, `MAX_INITIAL_PRICE_USD`). LayerZero V2 OApp. This is a *targeted*
re-audit of the two changes named in the request, not a full-contract audit.

## Verdict

The two targeted fixes are implemented correctly. **No residual Medium-severity issue
was found in the convergence logic or the semantic payload-validation paths.** One
boundary gap relative to the literal "non-reverting payload validation" invariant, plus
two Low/Informational items, are listed below.

## 1. Non-reverting semantic validation — CONFIRMED

The three semantic rejection paths now `emit RemotePriceUpdateSkipped(...)` and `return`
instead of reverting, so a well-formed-but-degenerate authenticated packet can no longer
brick the receive lane:

- `price <= 0`            → skip `"invalid_non_positive"` (L1478–1481)
- out-of-order timestamp  → skip `"out_of_order"`        (L1487–1490)
- `price > MAX_INITIAL_PRICE_USD` → skip `"invalid_out_of_bounds"` (L1491–1493)

Correctness checks that pass:
- Origin authentication (`origin.srcEid != BASE_EID → revert`, L1474) is retained; this is
  an *intentional* revert on a foreign EID and is out of scope of the "payload validation"
  fix (it is origin authentication, and such a packet should never pass OApp peer checks).
- Future-timestamp underflow is prevented by clamping `safeTimestamp = min(timestamp, block.timestamp)`
  (L1484) before it feeds any `block.timestamp - assetPriceTimestamp` staleness math.
- Monotonicity uses `<` (L1487), so equal-timestamp re-broadcasts are still accepted — this
  is required for convergence to progress across repeated identical-timestamp hub packets.

## 2. Bounded convergence — CONFIRMED

When `deviation > MAX_PRICE_DEVIATION` and the remote is still fresh
(`block.timestamp - assetPriceTimestamp <= MAX_STALENESS`), the price is clamped to
`oldP ± maxStep`, `maxStep = mulDiv(oldP, MAX_PRICE_DEVIATION, 1e18)` (L1503–1514).

- No division-by-zero: the whole block is guarded by `assetPriceUSD > 0`, so `oldP > 0`.
- No underflow: downward step uses `oldP > maxStep ? oldP - maxStep : 1`.
- No stall: `if (maxStep == 0) maxStep = 1` floors the step for very small `oldP`.
- Convergence is geometric (relative step) and terminates once within the deviation band;
  when stale, the full authenticated hub price is accepted for liveness recovery.
  This matches the intended "keep bounded while fresh, jump to recover when stale" design.

## Residual findings

### F-1 (Low; the one gap vs. the stated invariant) — `abi.decode` can still revert
`abi.decode(payload, (int256, uint256, string))` (L1476) runs *before* and *outside* the
non-reverting validation. A **structurally** malformed authenticated payload (truncated
bytes, or a future hub re-encoding / peer misconfiguration) reverts `_lzReceive`. The fix
covers *semantic* validity but not *structural* decodability, so the invariant
"no authenticated payload can revert `_lzReceive`" is not fully achieved.
Likelihood is low under the current single-trusted-peer model (only `BASE_EID` reaches
here and the hub always encodes the 3-tuple in `broadcastAssetPriceWithFees`, L1443), so I
rate it **Low**, not Medium. If a strict non-revert guarantee is desired, decode via an
external self-call wrapped in `try/catch` (or length-validate first) and emit-skip on failure.

### F-2 (Informational) — misleading event on an applied update
The fresh+high-deviation path applies a clamped update yet emits
`RemotePriceUpdateSkipped(..., "deviation_clamped")` (L1513) **and** the terminal
`AssetPriceReceived(...)` (L1526). Off-chain consumers that treat `RemotePriceUpdateSkipped`
as "state unchanged" will be misled (both fire for one applied write). Suggest a distinct
`RemotePriceClamped` event, or don't emit the skip event when state actually changes.

### F-3 (Informational / accepted design) — fresh-but-lagging value during large moves
During a genuine >20% hub move with fresh remote state, the remote reports a *fresh*
(recent-timestamp) but *lagging* clamped price until either another broadcast lands (one
step each) or `MAX_STALENESS` elapses and the next packet jumps to full price. `_getPrice()`
(L655) gates only on time-staleness, not clamp-lag, so it serves the clamped value as valid.
This is inherent to any deviation cap (the hub's own `updateAssetPrice` behaves identically)
and is bounded, so it is acceptable — worth documenting for integrators (lottery/gauge).

## Non-issues verified
- No reentrancy: `_lzReceive` performs no external calls.
- Replay: handled by the LayerZero endpoint nonce; the timestamp guard only adds
  freshness-rollback protection on top.
- Arithmetic: deviation and step computations are underflow/overflow- and div-by-zero-safe
  as noted above.

## Scope caveat
This sign-off covers `_lzReceive` and the two named changes only. It is not a statement
about the rest of `AgentOracle.sol` (TWAP/tick-cap, Chainlink/sequencer, broadcast fees),
which were not re-reviewed here.
