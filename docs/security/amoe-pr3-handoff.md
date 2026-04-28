# AMOE PR 3 — Boost-source timelock (Option B)

Companion to [`amoe-pr1-handoff.md`](./amoe-pr1-handoff.md) and
[`amoe-pr2-handoff.md`](./amoe-pr2-handoff.md).

PR 1 (#395) made `CreatorLotteryManager.processAmoeEntry` reuse the same
`_applyBoost` pipeline as the paid path, so personal `ve4626` boost and
`vaultGaugeVoting` direction now apply to AMOE entries too. That made the
two off-chain/state contracts the lottery trusts — `boostManager` and
`vaultGaugeVoting` — strictly more powerful: they can tilt AMOE win chance
the same way they tilt paid-swap win chance, up to the absolute
`maxWinChance = 150_000` PPM cap.

PR 3 closes the obvious response: **a compromised owner key can no longer
swap in a malicious boost source instantly.** It introduces a 24-hour
propose/commit timelock on the two `set*` setters, plus an emergency
circuit breaker that zeroes both sources for incident response.

This is the on-chain half. There is no off-chain change.

---

## 1. Threat model & rationale

| Threat | Mitigation in PR 3 |
| --- | --- |
| Compromised owner key swaps `boostManager` to an attacker contract that returns `2.5x` boost + `69_000 PPM` for the attacker, ~0 for everyone else | 24h pending-then-effective window gives monitoring + counsel + multisig time to react via `cancelBoostManagerProposal` or `disableBoostSources`. |
| Same threat on `vaultGaugeVoting` (gauge-direction PPM up to `35_000 PPM` per source) | Symmetric `proposeVaultGaugeVoting` / `commitVaultGaugeVoting` / `cancelVaultGaugeVotingProposal`. |
| Already-committed malicious source is detected post-fact | `disableBoostSources()` zeroes both sources atomically with **no** timelock. Also clears any pending proposal so a queued malicious address cannot be committed after the breaker is pulled. |
| Owner forgets to re-arm or wants to change setter style | One-way arm: `armBoostSourceTimelock()` cannot be undone. The only unwind is `disableBoostSources()` to neutralize, then redeploy. |

### Why no per-source PPM cap (Option C dropped)

We initially considered a per-source PPM cap inside `_applyBoost` (e.g.
75_000 PPM per source). Investigation showed the honest worst-case
personal contribution at $10K + full coverage + 4yr lock is ≈ 129_000 PPM
— above the proposed cap. A per-source cap would silently truncate honest
users. Sources already self-cap (`MAX_VE_BOOST = 25_000 BPS`,
`maxProbBoost = 690 BPS`, `MAX_PER_VAULT_PPM = 35_000`) and
`lotteryConfig.maxWinChance = 150_000` is the absolute backstop. Per-source
cap is redundant and risky; not worth the bytecode and audit surface.

---

## 2. New on-chain surface

All functions are `external`, `onlyOwner`, and live on
`CreatorLotteryManager` (delegating to the admin module). Storage lives on
the main contract; admin module storage layout mirrors main exactly.

### Storage (slots 58–62)

```solidity
address internal _pendingBoostManager;                    // slot 58
uint256 internal _pendingBoostManagerEffectiveAt;         // slot 59
address internal _pendingVaultGaugeVoting;                // slot 60
uint256 internal _pendingVaultGaugeVotingEffectiveAt;     // slot 61
bool    internal _timelockArmed;                          // slot 62
```

Slots are `internal` (no auto-getter) to fit under EIP-170 — see §6.

### Constant

```solidity
uint256 internal constant BOOST_SOURCE_TIMELOCK = 24 hours;
```

Mirror exposed `public` on the admin module.

### Events

| Event | When |
| --- | --- |
| `BoostManagerProposed(previous, proposed, effectiveAt)` | `proposeBoostManager` records pending. |
| `BoostManagerProposalCancelled(cancelled)` | `cancelBoostManagerProposal` clears pending. |
| `BoostManagerUpdated(previous, newManager)` | Live `boostManager` flipped (post-arm via `commit`, pre-arm via legacy setter). |
| `VaultGaugeVotingProposed(previous, proposed, effectiveAt)` | Symmetric. |
| `VaultGaugeVotingProposalCancelled(cancelled)` | Symmetric. |
| `VaultGaugeVotingUpdated(previous, newGauge)` | Symmetric. |
| `BoostSourceTimelockArmed()` | One-way arm. |
| `BoostSourcesDisabled(prevBoostManager, prevVaultGaugeVoting)` | Emergency circuit breaker. |

### Errors

| Error | Reverted by |
| --- | --- |
| `TimelockNotArmed` | `proposeBoostManager` / `proposeVaultGaugeVoting` if owner has not armed yet. |
| `TimelockAlreadyArmed` | Second call to `armBoostSourceTimelock`. |
| `TimelockNotExpired` | `commitX` before `effectiveAt`. |
| `NoPendingProposal` | `commitX` / `cancelX` with no pending proposal. |
| `LegacySetterDisabled` | `setBoostManager` / `setVaultGaugeVoting` once timelock is armed. |

### External functions

```solidity
function armBoostSourceTimelock() external onlyOwner;       // one-way switch
function disableBoostSources() external onlyOwner;          // emergency, no delay

function proposeBoostManager(address newManager) external onlyOwner;     // requires armed
function commitBoostManager() external onlyOwner;                        // after 24h
function cancelBoostManagerProposal() external onlyOwner;                // during window

function proposeVaultGaugeVoting(address newGauge) external onlyOwner;   // requires armed
function commitVaultGaugeVoting() external onlyOwner;                    // after 24h
function cancelVaultGaugeVotingProposal() external onlyOwner;            // during window
```

A combined view exists on the admin module (not a main-contract stub —
see §6):

```solidity
function getBoostSourceTimelockState()
    external view
    returns (
        address pendingBoostMgr,
        uint256 boostMgrEffectiveAt,
        address pendingGauge,
        uint256 gaugeEffectiveAt,
        bool armed
    );
```

---

## 3. Lifecycle

### Pre-arm (operations bootstrap)

- `setBoostManager(addr)` and `setVaultGaugeVoting(addr)` work as before.
  No delay. Used by ops to plug in the real `ve4626BoostManager` and
  `VaultGaugeVoting` after deploy.
- `proposeBoostManager` / `proposeVaultGaugeVoting` revert with
  `TimelockNotArmed`.
- `disableBoostSources()` works without timelock — already a useful
  emergency tool even pre-arm.

### Arm (one-way)

`armBoostSourceTimelock()`:
- Reverts with `TimelockAlreadyArmed` on second call.
- Sets `_timelockArmed = true`. After this:
  - `setBoostManager` / `setVaultGaugeVoting` revert with `LegacySetterDisabled`.
  - The only path to change either source is propose → wait 24h → commit.
- `disableBoostSources` remains available regardless.

### Post-arm change

```
T   = propose*(addr)        // emits *Proposed; effectiveAt = now + 24h
T+24h commit*()              // emits *Updated; live source flipped
```

During the window the owner may:
- Re-propose with a different address — overwrites previous pending
  (effectiveAt resets to new propose time + 24h).
- Cancel via `cancel*Proposal` — clears pending without changing live source.

After commit, the pending slot is cleared. Owner can immediately propose
again (next change starts a fresh 24h window).

### Emergency

`disableBoostSources()`:
- Zeros both `boostManager` and `vaultGaugeVoting`.
- Clears any pending proposal so a queued malicious address can't be
  committed after the breaker is pulled.
- No timelock; no armed precondition.

After a `disableBoostSources` call the lottery still functions —
`_applyBoost` returns the pre-boost win chance unchanged when both source
addresses are zero (existing behavior; covered by the AMOE Linear Parity
suite).

---

## 4. Gating on legacy setters

Inside the admin-module impls, `setBoostManager` and `setVaultGaugeVoting`
both gain a single guard at the top:

```solidity
if (_timelockArmed) revert LegacySetterDisabled();
```

Both also now emit the symmetric `BoostManagerUpdated` /
`VaultGaugeVotingUpdated` event so off-chain indexers see one consistent
event regardless of whether the change went through the legacy or
timelocked path.

---

## 5. Tests

`test/CreatorLotteryManager.BoostSourceTimelock.t.sol` — 24 tests, all
green.

Coverage matrix:

| Area | Tests |
| --- | --- |
| Pre-arm: legacy setters work, propose reverts | 3 |
| Arming: flag flips & event, second-call revert, non-owner revert | 3 |
| Post-arm: legacy setters revert (`boostManager`, `vaultGaugeVoting`) | 2 |
| `boostManager` lifecycle: happy path, too-early commit, commit-without-proposal | 3 |
| Cancel: during window, without proposal | 2 |
| `vaultGaugeVoting` lifecycle: happy path, cancel | 2 |
| Re-proposal overwrites previous pending (effectiveAt resets) | 1 |
| Circuit breaker: zeros both + clears pending, works pre-arm, non-owner revert | 3 |
| Re-propose after commit | 1 |
| Non-owner gating on every PR 3 entry point | 4 |

Storage state is asserted via `vm.load` against the slot indices verified
through `forge inspect storageLayout` (slots 58–62 for the pending tuple
and armed flag, slots 9–10 for the live `boostManager` / `vaultGaugeVoting`).

Mocks are namespaced `*BSTL` (Boost Source Timelock) to avoid collision
with the `*Amoe` mocks in `CreatorLotteryManager.AmoeLinearParity.t.sol`.

---

## 6. EIP-170 budget

PR 1 shipped at 24,367 / 24,576. PR 3 added 8 new external functions on
the main-contract side (each delegating to the admin module) plus 5 new
state slots. First implementation overshot to 24,865 (-289).

Recovery measures, all preserved in the final code:

1. **Pending storage slots are `internal` with `_` prefix** — drops the
   five auto-generated public getters that Solidity emits for `public`
   state. Saved ~250 bytes.
2. **`BOOST_SOURCE_TIMELOCK` is `internal constant` on main**, `public
   constant` on the admin module. Off-chain consumers read it from the
   admin-module address; the main contract doesn't waste a getter.
3. **`getBoostSourceTimelockState` lives only on the admin module.**
   It exists as a single combined view (the five state fields plus
   `armed`) instead of five separate `public` slots, and it's reachable
   via static `delegatecall` from clients that already know the admin
   module's address. We tried adding a thin delegating stub on main but
   the abi.decode + tuple return cost ~280 bytes — well over budget — so
   the stub was removed. Tests use `vm.load` against the known slot
   indices.

Final size:

```
CreatorLotteryManager           24,568 / 24,576   (8 bytes headroom)
CreatorLotteryManagerAdminModule 14,500 / 24,576  (10,076 bytes headroom)
```

Note: the unrelated `CreatorShareOFT` contract is over EIP-170 by 59
bytes on `main` already — pre-existing condition, not introduced by PR 3.

---

## 7. Production rollout

Order of operations after PR 3 deploys (extends the PR 1 / PR 2 list):

1. `setBaseCeilingPPM(40_000)` (from PR 1)
2. `setLotteryConfig(_minSwapAmount=1_000_000, _rewardPercentage=6900,
   _isActive=true, _baseWinChance=40, _maxWinChance=150_000,
   _usdMultiplierBps=10_000)` (from PR 1 / PR 2)
3. `setBoostManager(<real ve4626BoostManager>)` — legacy setter, OK pre-arm.
4. `setVaultGaugeVoting(<real VaultGaugeVoting>)` — legacy setter, OK pre-arm.
5. `setAuthorizedAmoeRelayer(<scoped-key-address>)` — only after sweepstakes
   counsel sign-off.
6. **`armBoostSourceTimelock()`** — once 3 and 4 are confirmed correct on
   the deployed addresses. One-way; no undo.

Subsequent boost-source changes (post-arm) follow the
propose / 24h / commit pattern. The emergency circuit breaker
`disableBoostSources()` remains available indefinitely.

---

## 8. Auditor checklist

- Storage slot ordering identical between main contract and admin module
  (both append after `authorizedAmoeRelayer` at slot 57: 58/59/60/61/62 →
  pending boost mgr / its effectiveAt / pending gauge / its effectiveAt /
  armed flag). Verified via `forge inspect storageLayout`.
- Every `propose*` requires `_timelockArmed` and reverts otherwise.
- Every `commit*` requires `effectiveAt != 0` and `block.timestamp >= effectiveAt`.
- Every `cancel*` requires `effectiveAt != 0`.
- `armBoostSourceTimelock` reverts on second call (one-way).
- `disableBoostSources` works with or without `_timelockArmed` and
  clears any pending proposals.
- Legacy `setBoostManager` / `setVaultGaugeVoting` revert with
  `LegacySetterDisabled` once `_timelockArmed`.
- AMOE win-chance pipeline (`_applyBoost`) is **unchanged** in PR 3 —
  AMOE Linear Parity tests from PR 1 still green (verified).
- `lotteryConfig.maxWinChance = 150_000` remains the absolute cap on
  post-boost win chance — boost sources cannot exceed it.

---

## 9. Out of scope (still required pre-mainnet)

- Sweepstakes counsel sign-off (non-engineering).
- PR 4 (deferred): zkMetal Groth16 binding to remove relayer-key trust
  for `pointsBurnedAsUSD` claims.
