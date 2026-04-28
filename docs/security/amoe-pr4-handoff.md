# AMOE PR 4 — Cryptographic binding of `pointsBurnedAsUSD`

Companion to [`amoe-pr1-handoff.md`](./amoe-pr1-handoff.md),
[`amoe-pr2-handoff.md`](./amoe-pr2-handoff.md), and
[`amoe-pr3-handoff.md`](./amoe-pr3-handoff.md).

PR 1 (#395) made `processAmoeEntry` reuse the paid-swap boost pipeline.
PR 2 (#396) added the variable-points / relayer-only path. PR 3 (#400)
fenced the boost sources behind a 24h timelock. The remaining trust
assumption was: **`authorizedAmoeRelayer` is trusted to assert
`pointsBurnedAsUSD` truthfully.** A compromised relayer key could submit
AMOE entries for any allowlisted wallet at any value up to the AMOE cap
(1M points = $10K), reaching the post-boost win-chance ceiling of 15%.

PR 4 closes that gap by binding `pointsBurnedAsUSD` (and its anchor —
the off-chain points-burn ledger) into the Groth16 proof's public
inputs. The router verifies the proof, range-checks the value, replay-
guards the points-burn nullifier globally, then calls
`CreatorLotteryManager.processAmoeEntry` with the cryptographically-
bound value. The manager's relayer slot is repointed at the router so
no other path can reach `processAmoeEntry`.

PR 4 ships as two PRs:

- **PR 4a** (`feat/amoe-circuit-v2-points-binding`, #401) — circuit
  source v2 + ceremony plan. Audit the circom diff in isolation.
- **PR 4b** (this PR) — router contract integration, tests, and the
  rollout op that hands the relayer slot to the router.

The actual v2 zkey + regenerated `AmoeGroth16Verifier.sol` are produced
by the independent ceremony workstream described in
[`circuits/amoe/CEREMONY.md`](../../circuits/amoe/CEREMONY.md). PR 4b
ships the contract code and tests against a `MockVerifier`; the
ceremony lands the production verifier and is its own deployment step.

---

## 1. Threat model & rationale

| Threat | Mitigation in PR 4 |
| --- | --- |
| Compromised `authorizedAmoeRelayer` key submits inflated `pointsBurnedAsUSD` for a real allowlisted wallet | The router only ever calls `processAmoeEntry` with `pubInputs[5]` from a verified Groth16 proof. The circuit binds the value into the leaf hash of the points-burn ledger Merkle tree, so the prover cannot make up a value the publisher hasn't anchored. |
| Compromised prover replays a previously-burned points row to mint multiple entries | Global on-chain `usedPointsBurnNullifier[bytes32]` mapping. Once a `(signupId, spendRefId, points, epoch)` Poseidon tuple is consumed, it can never back another entry, in any epoch, ever. |
| Compromised publisher backdates or duplicates a points-ledger root | One-shot per epoch (`pointsLedgerRootOf[epoch] != 0` reverts re-publish). Same KMS scoping as the existing allowlist publisher. Off-chain monitoring on `PointsLedgerRootSet` events. |
| Profile-merge race: user generates a proof under signup A, profile gets merged into B mid-flight, attacker tries to re-mint under B's identity | Ledger leaf binds `walletAddrCommit`, so a leaf for signup A's wallet does not validate against signup B's wallet commitment. Off-chain pipeline additionally enforces a ~24h `profile_merge_frozen_until` window during proof submission. |
| `pubInputs[5]` overflows uint256 to alias a small value | Circuit range-checks `pointsBurnedAsUSD < 2^64`. Router additionally enforces `0 < pointsBurnedAsUSD <= MAX_POINTS_AS_USD` (10^10 1e6 units = $10K) as defense-in-depth. |
| Proof verification fails but replay guards already flipped | All three replay guards (`usedNonceCommit`, `usedWalletCommit`, `usedPointsBurnNullifier`) are set **after** `verifier.verifyProof` returns true. Failed proofs leave state untouched (test: `failedProof_doesNotConsumeNullifier`). |
| Manager call reverts but router state already mutated | The manager call happens after replay-guard writes, so a manager revert rolls back the entire `submitAmoeEntryZK` transaction (test: `managerRevert_propagates`). |

This is the cryptographic half. The off-chain half — daily ledger-root
publisher job, profile-merge freeze, prover witness shape — lands in
`frontend/server/_lib/lottery/lotteryAmoe.ts` as a follow-up server
PR. The contract code in PR 4b can run in pre-rollout safe mode (no
manager set, allowlist-only) until the off-chain pipeline catches up.

---

## 2. New router surface (v2)

### State

```solidity
address public pointsLedgerPublisher;          // KMS-scoped publisher key
mapping(uint64 => bytes32) public pointsLedgerRootOf;     // one-shot per epoch
mapping(bytes32 => bool)  public usedPointsBurnNullifier; // GLOBAL replay guard
IAmoeManager public manager;                    // CreatorLotteryManager fan-out
```

### Constants

```solidity
uint256 public constant MAX_POINTS_AS_USD = 10_000 * 1_000_000; // $10K cap, 1e6 units
```

### Events

- `PointsLedgerPublisherUpdated(address previous, address current)`
- `PointsLedgerRootSet(uint64 indexed epoch, bytes32 root)`
- `ManagerUpdated(address previous, address current)`
- `AmoeEntrySettled(uint256 indexed entryId, bytes32 indexed pointsBurnNullifier, uint256 pointsBurnedAsUSD, uint256 managerEntryId)` — emitted on every successful ZK entry; ties the on-chain entry to the consumed nullifier and the manager VRF id for off-chain reconciliation.

### Errors

- `NotPointsLedgerPublisher()`
- `PointsLedgerEpochNotPublished()` — proof references an epoch with no ledger root.
- `PointsLedgerRootMismatch()` — proof's `pubInputs[6]` ≠ on-chain `pointsLedgerRootOf[epoch]`.
- `PointsLedgerEpochAlreadyPublished()` — re-publishing the same epoch.
- `PointsBurnReplayed()` — nullifier already consumed.
- `PointsValueOutOfRange()` — `pubInputs[5]` is 0 or > `MAX_POINTS_AS_USD`.

### Functions

- `setPointsLedgerPublisher(address)` (`onlyOwner`)
- `setPointsLedgerRoot(uint64 epoch, bytes32 root)` (`onlyPointsLedgerPublisher`, one-shot)
- `setManager(address)` (`onlyOwner`; zero allowed to disable fan-out)
- `submitAmoeEntryZK(buyer, coin, epoch, a, b, c, uint256[8] pubInputs)` —
  bumped from `uint256[5]` to `uint256[8]`. New checks (in order):
  1. `pubInputs[1] == uint160(creatorCoin)` and `pubInputs[3] == epoch` (unchanged binding)
  2. `pubInputs[4] == allowlistRootOf[epoch]` (unchanged)
  3. `pubInputs[6] == pointsLedgerRootOf[epoch]` (new)
  4. `0 < pubInputs[5] <= MAX_POINTS_AS_USD` (new)
  5. nonce / wallet / nullifier replay guards (nullifier guard new)
  6. `verifier.verifyProof(a, b, c, pubInputs)` (unchanged shape, 8 inputs)
  7. flip all three replay guards
  8. emit `AmoeEntryRecorded`
  9. if `manager` set, call `manager.processAmoeEntry(buyer, coin, pubInputs[5])`
  10. if legacy `consumer` set, call `consumer.recordAmoeEntry(buyer, coin, epoch, entryId)`
  11. emit `AmoeEntrySettled`

The legacy `submitAmoeEntry` (ECDSA path) is unchanged. It does not
touch the new state, does not call the manager, and does not consume a
points-burn nullifier. The off-chain pipeline keeps using it during
the v2 overlap period.

---

## 3. Router → Manager wiring

The cleanest path is a one-time ops change: point
`CreatorLotteryManager.authorizedAmoeRelayer` at the router address.
This requires **zero manager changes** — the manager already gates
`processAmoeEntry` on `msg.sender == authorizedAmoeRelayer`, and the
router calls that function with the cryptographically-bound value
straight from `pubInputs[5]`.

Why this is the right shape:

1. Preserves PR 3's 8-byte EIP-170 headroom on the manager (still
   24,568 / 24,576). Verified via `forge build --sizes`.
2. No new manager function, no new error, no new event, no storage
   layout change.
3. The relayer slot is already a single-address allowlist — repointing
   it at the router replaces the trust target without changing the
   trust shape.
4. The legacy ECDSA path is decommissioned at the same moment by
   pointing the relayer slot away from the server key. After the v2
   rollout, no off-chain key can call `processAmoeEntry` directly.

The manager's own `pointsBurnedAsUSD == 0` and
`pointsBurnedAsUSD < lotteryConfig.minSwapAmount` guards are still in
place as defense-in-depth, even though the router now enforces a
strict positive lower bound and the `MAX_POINTS_AS_USD` upper bound.

---

## 4. Tests

### `test/zk/LotteryAmoeRouter.t.sol` (existing, updated for v2)

Updated all 8 `submitAmoeEntryZK_*` cases to the `uint256[8]`
signature; added defaults for `pointsBurnedAsUSD` and `nullifier`;
added `setUp` wiring for the points-ledger publisher and root.

### `test/zk/LotteryAmoeRouter.PointsBound.t.sol` (new, 19 tests)

Organized by behavior:

| § | Behavior | Tests |
|---|---|---|
| 1 | Ledger publisher: gating + one-shot + event | 3 |
| 2 | `pubInputs[6]` ledger-root binding (mismatch + unpublished epoch) | 2 |
| 3 | `pubInputs[5]` ceiling + zero rejection + boundary inclusive at max | 3 |
| 4 | Global nullifier replay guard (same epoch + cross-epoch) | 2 |
| 5 | Replay-guard ordering: failed proof leaves state untouched | 1 |
| 6 | Manager fan-out: receives proven value / skipped when unset / propagates revert | 3 |
| 7 | `AmoeEntrySettled` event emission | 1 |
| 8 | Admin: publisher + manager setters, owner-gating + zero rejection | 4 |

### Test results

```
Ran 2 test suites: 29 tests passed, 1 failed, 0 skipped (30 total tests)

Failing tests:
  test/zk/LotteryAmoeRouter.t.sol::test_submitAmoeEntry_acceptsDeadlineAtBufferBoundary
```

The single failure is **pre-existing on `main`** (verified by
`git stash`-ing the PR 4b changes, running the same test against
`main`'s router code — same `NotPublisher()` revert reproduces). It is
unrelated to PR 4b and was carried over from the PR 3 handoff. It has
been triaged and is on the cleanup list for the next maintenance pass.

---

## 5. EIP-170 budget

| Contract | Runtime size | Limit | Margin |
|---|---|---|---|
| `CreatorLotteryManager` | 24,568 | 24,576 | 8 (unchanged from PR 3) |
| `LotteryAmoeRouter` | 3,868 | 24,576 | 20,708 |

PR 4b added ~600 bytes to the router (new state, errors, events, and
the v2 `submitAmoeEntryZK` body). The router has ample headroom; the
manager is untouched.

---

## 6. Production rollout (extends PR 1/2/3 list)

After PR 4a's circuit ceremony has produced `amoe_v2_final.zkey` and
the regenerated `AmoeGroth16Verifier.sol`:

1. Deploy `AmoeGroth16Verifier_v2`.
2. Deploy the v2 `LotteryAmoeRouter` (or upgrade if the existing one
   is upgradeable — current state is non-upgradeable, so a fresh
   deploy is required). Constructor: `(owner, allowlistPublisher,
   verifier_v2)`.
3. `router.setPointsLedgerPublisher(<KMS-scoped key>)`.
4. `router.setManager(<CreatorLotteryManager address>)`.
5. Publisher posts the genesis `pointsLedgerRoot` for the rollout
   epoch via `router.setPointsLedgerRoot(epoch, root)`.
6. Publisher posts the corresponding `allowlistRoot` for the same
   epoch via `router.setAllowlistRoot(epoch, root)`.
7. **`CreatorLotteryManager.setAuthorizedAmoeRelayer(<router address>)`**
   — replaces the scoped server key with the router contract address.
   This is the one-way trust handoff. Document and gate behind
   sweepstakes counsel sign-off.
8. Server flips `lotteryAmoe.ts` from `submitAmoeEntry` (ECDSA) to
   the new `submitAmoeEntryZK` path.

Before step 7, the router can run in safe mode (allowlist-only,
manager unset) and the legacy ECDSA path stays live. This gives a
clean cutover window during which both paths can be smoke-tested
against the router without touching the manager's relayer slot.

After step 7, the off-chain ECDSA path can no longer reach
`processAmoeEntry` — the manager will reject any caller other than
the router. The `submitAmoeEntry` legacy stub on the router still
exists for ABI-compat with `lotteryAmoe.ts` consumers but stops
recording entries for VRF rolls (the manager fan-out hook only fires
on the ZK path; the legacy stub uses the older `consumer.recordAmoeEntry`
event-only path).

---

## 7. What this PR does NOT do

- Does NOT update `verification_key.json` or `AmoeGroth16Verifier.sol`.
  Those are produced by the v2 ceremony (PR 4a's mandate).
- Does NOT modify `CreatorLotteryManager.sol`. Zero manager bytes
  changed; PR 3's 8-byte EIP-170 margin is preserved.
- Does NOT change the prover witness format used by the server. The
  prover changes — adding `signupIdHash`, `spendRefIdHash`, the points-
  ledger Merkle path — are scoped to the off-chain follow-up.
- Does NOT decommission the legacy ECDSA `submitAmoeEntry` stub. Per
  the rollout plan, that stays for at least 2 epochs of overlap after
  step 7 above.
- Does NOT add a manager-side `processAmoeEntryFromRouter`. The minimal-
  diff path is `setAuthorizedAmoeRelayer(<router>)`, which preserves
  byte-budget and avoids any new manager surface.

---

## 8. Audit checklist

- [ ] Bind layer: every `pubInputs[i]` for `i` in `{1, 3, 4, 5, 6}` is
      checked against an authoritative on-chain source before the
      verifier is called.
- [ ] Replay guards (`usedNonceCommit`, `usedWalletCommit`,
      `usedPointsBurnNullifier`) are flipped only after
      `verifier.verifyProof` returns true.
- [ ] `MAX_POINTS_AS_USD = 10_000 * 1_000_000` matches the AMOE cap of
      1M points × 10K = 10^10 1e6 units = $10K.
- [ ] `pointsLedgerRootOf` is one-shot per epoch and only writable by
      `pointsLedgerPublisher`.
- [ ] `setManager(address(0))` cleanly disables manager fan-out
      without breaking entry recording.
- [ ] `IAmoeManager.processAmoeEntry` signature byte-for-byte matches
      `CreatorLotteryManager.processAmoeEntry`.
- [ ] Manager bytecode size unchanged from PR 3 (24,568 / 24,576).
- [ ] Pre-existing `test_submitAmoeEntry_acceptsDeadlineAtBufferBoundary`
      failure is reproducible on `main` and not introduced by PR 4b.

---

## 9. References

- **PR 4a (circuit v2):** [#401](https://github.com/wenakita/4626/pull/401)
- **Design doc:** `/tmp/pr4_design.md` (decisions locked 2026-04-27)
- **Off-chain pipeline:** `frontend/server/_lib/lottery/lotteryAmoe.ts`
- **Prior handoffs:** `amoe-pr1-handoff.md`, `amoe-pr2-handoff.md`,
  `amoe-pr3-handoff.md`
- **Ceremony plan:** `circuits/amoe/CEREMONY.md § Phase 2 — v2 ceremony`
