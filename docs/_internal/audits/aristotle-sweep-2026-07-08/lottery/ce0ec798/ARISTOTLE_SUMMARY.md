# Summary of changes for run 40881a8f-1762-4d0a-a246-bbbcc4f1efc1
I audited the lottery/VRF/randomness subsystem (manager, VRFConsumer, randomness router + drand + Chainlink adapter, cross-chain VRF integrator, and the AMOE ZK router/PLONK verifier), focusing on randomness integrity, settlement safety, and payout authorization. The full report with concrete exploit paths and remediations is in `SECURITY_AUDIT.md`.

Key findings:

High
- H-1 (randomness integrity) `DrandRandomnessSource.submitRound`: the round number is never cryptographically bound to the drand message. The keccak "commit" is self-referential (relayer supplies both `hashedRoundG1` and the commit), and nothing checks `hashedRoundG1 == hashToCurve(SHA256(round))`. A relayer can take any real, public beacon signature and register its word under an arbitrary round → chosen randomness, not merely a liveness assumption. Fix: verify hash-to-curve on-chain, or require N-of-M relayer agreement; don't use it for settlement until bound.
- H-2 (randomness/funds) `RandomnessRouter.acquireRequest` is permissionless and unrate-limited; via `ChainlinkVRFAdapter.request` it triggers paid Chainlink VRF requests on `VRFConsumer4626` (which rate-limits only the cross-chain path). Once the adapter is an authorized local caller (the intended wiring), anyone can spam and drain the subscription. Fix: keeper allowlist + rate limiting.

Medium
- M-1 drand word = keccak of a public beacon signature → outcome predictable before on-chain submission (grind/withhold).
- M-2 `_payoutLocalJackpotInner` pays 69% of EVERY active lane's reserve on any single win regardless of the triggering coin — a cheap win on a junk coin drains unrelated coins' reserves (cross-lane blast radius).
- M-3 `applyDeferredVrf` (owner-only) resets `requestTimestamp`, bypassing the staleness guard, and lets the owner selectively settle/withhold deferred entries whose outcome is already fixed; no user-callable flush.
- M-4 `LotteryAmoeRouter.setVerifier`/`setManager` are owner-swappable with no timelock; a compromised owner can install an accept-all verifier and mint arbitrary AMOE entries.
- M-5 the advertised "feed drand back through the existing callback" path doesn't exist without granting a keeper a privileged callback role; if wired, the weaker relayer-controlled randomness silently authorizes payouts.

Low/Informational
- L-1 `_deferredVrfRequestIds` is declared but never populated (no enumerable/flushable deferred queue → orphan risk).
- L-2 no `randomWords.length` guard in `VRFConsumer4626.rawFulfillRandomWords`.
- I-1 trust-critical hard-coded drand `-G2` generator / chain params (add a deploy self-test).
- I-2 stale "8 public inputs" comments in the PLONK verifier (code correctly uses and `checkField`s all 9 — verified).

I also confirmed several controls are sound: the delegatecall admin-module storage layout matches, VRF callbacks are peer/sender-gated, `_processVRFResult` deletes the request before payout (no double-settlement) with reentrancy + payout locks, the AMOE ZK replay nullifiers are consumed before fan-out with atomic rollback, and the PLONK verifier validates all public inputs.

This was a review-only task, so no source files were modified other than adding the report.