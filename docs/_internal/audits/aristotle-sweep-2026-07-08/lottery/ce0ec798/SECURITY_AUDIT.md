# Security Audit — Lottery / VRF / Randomness Subsystem

Scope (this subsystem only):

- `manager/LotteryManager4626.sol` (+ embedded `LotteryManager4626AdminModule`)
- `manager/VRFConsumer4626.sol`
- `randomness/RandomnessRouter.sol`, `DrandRandomnessSource.sol`, `ChainlinkVRFAdapter.sol`, `EIP2537Probe.sol`
- `vrf/ChainlinkVRFIntegratorV2_5.sol`
- `zk/LotteryAmoeRouter.sol`, `AmoePlonkVerifier.sol`, `IAmoePlonkVerifier.sol`

Focus areas: **randomness integrity**, **settlement safety**, **payout authorization**.

The report lists concrete exploit paths and remediations. Severity uses
Critical / High / Medium / Low / Informational. Trust assumptions that are
already documented in-code are still reported where the residual risk is a
cryptographic gap (not merely a liveness/availability assumption).

---

## Summary table

| # | Severity | Area | Component | Issue |
|---|----------|------|-----------|-------|
| H-1 | High | Randomness integrity | `DrandRandomnessSource` | `submitRound` never binds the round number to the real drand message; the keccak "commit" is self-referential, so a relayer can map any real beacon signature onto any round → chosen randomness |
| H-2 | High | Randomness / funds | `RandomnessRouter` + `ChainlinkVRFAdapter` + `VRFConsumer4626` | `acquireRequest` is permissionless and unrate-limited; when the adapter is an authorized local caller (the intended wiring) anyone can spam paid Chainlink VRF requests and drain the subscription |
| M-1 | Medium | Randomness integrity | `DrandRandomnessSource` | Randomness word = `keccak256(sig)` of a **public** beacon output; the outcome for any round is knowable off-chain before on-chain submission (grind/withhold) |
| M-2 | Medium | Payout authorization / settlement | `LotteryManager4626._payoutLocalJackpotInner` | A win on *any* lane pays out 69% of *every* active lane's jackpot reserve; a cheap entry on a junk coin, on win, drains unrelated coins' reserves (cross-lane blast radius) |
| M-3 | Medium | Settlement safety | `LotteryManager4626.applyDeferredVrf` | Owner-only deferred flush resets `requestTimestamp` (bypassing the CLM-02 staleness guard) and can selectively settle/withhold deferred entries whose outcome is already known |
| M-4 | Medium | Payout authorization | `LotteryAmoeRouter.setVerifier` / `setManager` | Verifier/manager are owner-swappable with no timelock; a compromised owner can install an accept-all verifier and mint arbitrary AMOE entries |
| M-5 | Medium | Randomness integrity (integration) | `RandomnessRouter` ↔ `LotteryManager4626` | The advertised "feed drand back through the existing callback" path does not exist without granting a keeper a privileged callback role; if wired, the weaker relayer-controlled randomness silently authorizes real payouts |
| L-1 | Low | Settlement safety | `LotteryManager4626` | `_deferredVrfRequestIds` is declared but never populated; there is no on-chain enumeration or user-callable flush, so deferred entries can be orphaned if events are missed |
| L-2 | Low | Randomness integrity | `VRFConsumer4626.rawFulfillRandomWords` | No `randomWords.length` guard before `randomWords[0]` (relies entirely on the coordinator) |
| I-1 | Info | Correctness | `DrandRandomnessSource` | Hard-coded `-G2` generator and `chainHash` are trust-critical; a wrong value silently disables verification liveness |
| I-2 | Info | Documentation | `IAmoePlonkVerifier` / `AmoePlonkVerifier` | Comments say "8 public inputs" while the code correctly uses 9 (all 9 are `checkField`-validated — verified) |

---

## H-1 — Drand round is not cryptographically bound to its message

**File:** `randomness/DrandRandomnessSource.sol`, `submitRound`.

**What the code does.** The pairing check verifies
`e(H(r), pk) · e(σ, −g2) == 1`, i.e. that `σ` is a valid BLS signature over the
G1 point `hashedRoundG1` under the pinned drand group key. `hashedRoundG1` is
**supplied by the relayer**. The only thing tying it to the round number is:

```solidity
bytes32 expected = keccak256(abi.encodePacked(roundBE, hashedRoundG1));
if (expected != hashedRoundCommit) revert InvalidRoundCommit();
```

This commit is **self-referential**: the relayer chooses both `hashedRoundG1`
and `hashedRoundCommit`, so it always matches. Nothing on-chain checks that
`hashedRoundG1 == hashToCurve(SHA256(round))` (the code comments acknowledge
hash-to-curve is not reproduced on-chain).

**Exploit path.** drand beacon values are all public. A relayer takes a *real*
signature `σ_R` for the *real* message point `M_R` of some actual round `R`, then
calls `submitRound(round = R', sigG1 = σ_R, hashedRoundG1 = M_R, commit = keccak(R'‖M_R))`.
The pairing passes (σ_R is genuinely valid over M_R), and the contract records
`randomWordOf[R'] = keccak256(σ_R)`. The relayer has thus placed a *known*
random word onto an arbitrary round index of its choosing. Because it can pick
which real beacon value lands on which round, it fully controls the "random"
outcome of any round a consumer might settle on. This is strictly stronger than
the documented "trust the relayer for liveness" assumption — it is outcome
selection, not just censorship.

**Remediation.**
- Preferred: verify `hashToCurve` for the round on-chain (EIP-2537 `MAP_FP_TO_G1`
  + the RFC-9380 expand_message steps), or verify a succinct proof that
  `hashedRoundG1 = HashToCurve(SHA256(round))`, so `H(r)` cannot be attacker-chosen.
- Interim: require N-of-M independent relayers to submit identical
  `(round, word)` and settle on the majority (the `MultiRelayerDrandSource`
  TODO), and/or restrict this source to non-settlement use until the binding is
  cryptographic. The current single-relayer + self-commit design should not be
  used to authorize payouts.

---

## H-2 — Permissionless `acquireRequest` can drain the VRF subscription

**Files:** `randomness/RandomnessRouter.sol` (`acquireRequest`),
`randomness/ChainlinkVRFAdapter.sol` (`request`),
`manager/VRFConsumer4626.sol` (`_requestRandomWordsLocal`).

**What the code does.** `RandomnessRouter.acquireRequest(creatorCoin)` has **no
caller restriction** (only `nonReentrant`). It resolves the source and
low-level-calls `request()`. For a Chainlink source this reaches
`ChainlinkVRFAdapter.request() → VRFConsumer4626.requestRandomWords()`, which
issues a **paid** `vrfCoordinator.requestRandomWords(...)`. `requestRandomWords`
on the consumer only gates on `authorizedLocalCallers[msg.sender]` — and the
intended wiring makes the adapter an authorized local caller. The consumer
applies **no rate limit** on the local-request path (rate limiting only exists
on the cross-chain `_lzReceive` path).

**Exploit path.** Once the adapter is authorized, any address calls
`acquireRequest` in a loop. Each call bills the Chainlink VRF subscription
(LINK/native). An attacker drains the subscription with no cost beyond gas,
causing denial of settlement for the whole lottery (griefing + fund drain).

**Remediation.**
- Add an explicit keeper allowlist / `onlyOwner`-managed authorization to
  `acquireRequest` (and `readPull` if applicable), mirroring the
  `authorizedLocalCallers` model.
- Add a per-caller / per-window rate limit on the consumer local-request path
  (the cross-chain path already has one via `_consumeRateLimit`).
- Consider requiring the caller to fund the request fee rather than sponsoring
  it from a shared subscription.

---

## M-1 — Drand randomness is publicly predictable before submission

**File:** `randomness/DrandRandomnessSource.sol` (`submitRound`, `randomWord`).

The word is `uint256(keccak256(sigG1))` where `sigG1` is the public drand beacon
signature for the round. Anyone watching the League-of-Entropy beacon computes
the exact word the moment the round is published — before it is posted on-chain.
`roundAt(block.timestamp)` maps to the *current* round, whose value is already
public. Any consumer that settles on the current/past round lets an entrant (or
the relayer) know the outcome in advance and act on it (decide whether/when to
submit, or which round to reference). Combined with H-1 this compounds.

**Remediation.** For lottery settlement, only ever consume a round whose beacon
value was **not yet published at the time the entry/commitment was fixed**
(commit-to-future-round), and enforce that binding on-chain (store the target
round at request time; refuse words for rounds ≤ the request round). Prefer
Chainlink VRF as the settlement source for anything value-bearing.

---

## M-2 — A single win drains 69% of every lane's jackpot reserve (cross-lane blast radius)

**File:** `manager/LotteryManager4626.sol` (`_processWin` → `_payoutLocalJackpotInner`).

On a win, the code iterates the active token registry and, for each active lane,
pays `availableJackpotReserve * payoutBps / 10_000` to the winner, with
`payoutBps = lotteryConfig.rewardPercentage = 6900` (69%). The triggering coin is
irrelevant to which reserves are tapped — **a win on lane A pays from the
reserves of B, C, …** as well.

**Exploit path / risk.** An entrant only needs to win *somewhere* to receive 69%
of *every* active lane's reserve. A creator of a low-value coin can enter cheap
lotteries (min $1) and, on any win, siphon the majority of unrelated, valuable
coins' reserves. Even where the per-entry probability is small, the payout scope
is the entire mesh, and `maxWinChance` may be configured up to 150,000 PPM (15%)
with boosts, shrinking the break-even. This is a settlement/authorization-scope
concern: winning entitlement on one lane authorizes withdrawal from all lanes.

**Remediation.**
- Restrict a win to the triggering lane's reserve (or a bounded, explicitly
  opted-in subset), or scale each lane's contribution by that lane's own
  entry/fee activity rather than paying a flat 69% of every reserve on every win.
- Reconsider paying 69% of the *remaining* reserve per single win (it makes the
  first winner in a period capture the majority); a fixed/√-decaying prize or a
  per-period cap bounds the blast radius.

---

## M-3 — Owner-controlled deferred settlement bypasses staleness and enables selective settlement

**File:** `manager/LotteryManager4626.sol` (`_processVRFResult` defer branch,
`applyDeferredVrf`).

While paused, `_processVRFResult` stores the already-final random word in
`pendingRandomWord`. `applyDeferredVrf` (owner-only) then does:

```solidity
vrfRequests[requestId].requestTimestamp = block.timestamp;
_processVRFResult(requestId, randomWords);
```

Resetting `requestTimestamp` to `now` means the CLM-02 grace-period guard
(`block.timestamp > requestTimestamp + vrfResultGracePeriod`) can never fire for
deferred entries. Because the stored word and stored `effectiveWinChancePPM`
fully determine win/loss, the owner **knows each deferred entry's result** and
can choose which to settle and which to leave un-flushed indefinitely (there is
no user-callable settlement path). This is a centralized selective-settlement /
censorship surface over already-decided outcomes.

**Remediation.**
- Do not overwrite `requestTimestamp`; instead exempt genuinely-deferred entries
  from staleness by tracking the *defer* time and the *original* request time
  separately, and honor the original staleness window.
- Provide a permissionless `flushDeferredVrf(requestId)` so users/keepers can
  settle their own deferred entries after unpause, removing owner discretion.

---

## M-4 — AMOE verifier/manager are hot-swappable without timelock

**File:** `zk/LotteryAmoeRouter.sol` (`setVerifier`, `setManager`, `setConsumer`).

`setVerifier` is `onlyOwner` with no delay and no zero/ço de-shape checks beyond a
cast. A compromised or malicious owner installs an accept-all verifier, after
which `submitAmoeEntryZK` accepts arbitrary `pubInputs` (subject only to the
router's cheap range/root checks). Since the router is the manager's
`authorizedAmoeRelayer`, forged entries flow straight into `processAmoeEntry`
with attacker-chosen `pointsBurnedAsUSD` (up to `MAX_POINTS_AS_USD` = $10k) and
full boost parity, maximizing win probability. Payout is still probabilistic, but
the integrity of the entire ZK gate collapses to a single un-timelocked key.

**Remediation.** Put `setVerifier` (and ideally `setManager`) behind the same
timelock pattern already used for boost sources / the VRF coordinator
(`queue`/`execute` with a delay), and emit/monitor the change. Consider a
two-key (proposer/executor) split.

---

## M-5 — Router→Manager randomness feedback path is not actually wired (integration gap)

**Files:** `randomness/RandomnessRouter.sol` (doc + `acquire`/`readPull`),
`manager/LotteryManager4626.sol` (`receiveRandomWords` overloads).

The router documents that a keeper "feeds the chosen source's randomness back
into the lottery manager via the existing `onRandomWordsCallback` path." No such
permissionless path exists: the manager's two `receiveRandomWords` overloads
require `msg.sender == localVRFConsumer` or `== vrfIntegrator`. To feed drand
words in, ops must either (a) grant a keeper one of those privileged roles, or
(b) register a drand shim as `localVRFConsumer`. Either wiring silently places
the relayer-controlled, publicly-predictable drand randomness (H-1/M-1) in
authority over real payouts, while the code comments imply "zero diff to audited
code."

**Remediation.** Do not route drand (in its current form) into settlement. If a
pluggable source is desired, add an explicit, access-controlled and rate-limited
manager entrypoint that records the *target round committed at request time* and
validates the source/round binding, rather than trusting a keeper-fed word.

---

## L-1 — Dead `_deferredVrfRequestIds` / no enumerable deferred queue

`_deferredVrfRequestIds` is declared but never pushed to. There is no on-chain
list of deferred requests and no batch flush; recovery depends entirely on
off-chain indexing of `VrfResultDeferred` events. If those are missed, deferred
entries are effectively orphaned (no user can settle them). Either populate and
use the queue for a bounded batch flush, or remove the unused storage and
document the event-driven recovery requirement.

## L-2 — Missing length guard on VRF fulfillment

`VRFConsumer4626.rawFulfillRandomWords` reads `randomWords[0]` without checking
`randomWords.length > 0`. This is safe only because the Chainlink coordinator is
trusted and `numWords == 1`. Add a defensive `require(randomWords.length > 0)` /
`>= numWords`. (The manager's `_processVRFResult` does guard `length == 0`.)

## I-1 — Trust-critical hard-coded constants

`DrandRandomnessSource._negatedG2Generator()` and the pinned `chainHash` /
`genesisTime` / `period` are hard-coded. A wrong `-G2` value makes every pairing
fail (liveness DoS), not a forgery; still, add a one-time self-test at deploy
(pair a known good round) and document the provenance of the negated generator
bytes. `EIP2537Probe` is a good pattern to extend with a pairing self-check.

## I-2 — Public-input count comment mismatch (no security impact)

`IAmoePlonkVerifier` / `AmoePlonkVerifier` headers mention "8 public inputs"
while the signature and transcript use 9. Verified that the verifier
`checkField`s all 9 public signals (offsets 0…256) and includes 9 Lagrange
evaluations (`pEval_l1..l9`) and 9 transcript absorptions, so the extra-field /
non-canonical-encoding hardening is correct. Fix the stale comments only.

---

## Notes on things checked and found sound

- **Manager delegatecall admin module**: the main contract and
  `LotteryManager4626AdminModule` declare identical base-contract inheritance
  order and an identical appended storage layout (immutables `_adminModule` /
  `_self` consume no slots), so the delegatecall storage aliasing is consistent;
  `onlyDelegateCall` + `onlyOwner` gate every admin impl.
- **Double-settlement / replay**: `_processVRFResult` deletes the `vrfRequests`
  entry before payout; repeat callbacks no-op. Callbacks are `nonReentrant` and
  payout is additionally `_payoutLock`-guarded.
- **VRF callback authorization**: both manager `receiveRandomWords` overloads
  pin `msg.sender` to the configured consumer/integrator; the integrator and
  consumer `_lzReceive` pin the LayerZero peer.
- **AMOE ZK replay guards**: nonce, per-epoch wallet-credit, and global
  points-burn nullifiers are all consumed before external fan-out, and
  `ManagerDeclinedEntry` reverts atomically roll them back so entries are not
  silently burned.
- **PLONK verifier**: standard snarkjs PLONK structure with the documented extra
  `checkField` over all public inputs; modulo-bias in `randomWord % 1_000_000`
  is negligible.
