# Summary of changes for run ed4c2f3b-f574-4f0b-bfc4-0bc4235cbba6
I performed the requested post-fix re-audit of `AgentOracle.sol`, focused on the remote (cross-chain) price path after the remote-oracle liveness hardening. The full write-up is in `REAUDIT_RemoteOracleLiveness.md`.

Prior residual Medium issues — verified CLOSED (in their permanent form):
- Indefinite remote deviation-lock freeze → now bounded, thanks to the stale-recovery bypass in `_lzReceive`.
- Freshness spoofing / future-timestamp underflow → closed by the `safeTimestamp = min(timestamp, block.timestamp)` clamp plus the monotone out-of-order guard.
- Replay/rollback of stale packets → closed by the out-of-order guard (checked before any state write).
- Owner recovery during sustained packet loss → `forceSyncRemotePrice` is remote-only, monotone, bounded, and rejects future timestamps.

Remaining exploitable findings reported:
- F-1 (Medium, partially mitigated): A single dropped/censored LayerZero packet during any >20% cumulative price move makes the remote reject all subsequent updates until it fully ages out, causing an up-to-~2h (MAX_STALENESS) remote pricing outage. Root cause: the deviation guard compares against the remote's last-accepted value and drops rather than converges; recovery is gated on full staleness. The permanent freeze is fixed, but a guaranteed multi-hour outage remains, reachable cheaply during exactly the volatility when pricing matters.
- F-2 (Low→Medium under ordered delivery): Inconsistent handling in `_lzReceive` — the `price > MAX_INITIAL_PRICE_USD` (and `price <= 0`) checks revert on post-authentication payload content, whereas the out-of-order and deviation guards skip-and-return. A revert does not consume the LZ nonce, so one out-of-range hub broadcast can block the remote's inbound channel. Recommend skip-and-emit for content checks; reserve revert for the srcEid authentication check.
- F-3 (Low): The stale-recovery bypass can latch a single anomalous but hub-authenticated value as a fresh anchor, after which a >20% correction is rejected for up to ~2h.

All three findings share one root cause (the deviation guard drops instead of converging) and a single remediation — bounded step-wise convergence per accepted packet, or a much shorter dedicated recovery threshold — closes all of them. I also noted that on remotes the deviation guard is defense-in-depth only (no attacker-writable remote price path) and that `_getPrice` fails closed (returns (0,0) when stale), so these are liveness-severity rather than price-integrity issues.

Note: this is a Solidity security re-audit deliverable; the included Lean project is empty scaffolding with no theorem to formalize, so no Lean proof work was applicable. The report is committed and pushed.