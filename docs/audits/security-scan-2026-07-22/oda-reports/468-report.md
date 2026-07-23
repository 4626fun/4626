# 🔐 Security Review — ve4626 Governance + Bribes (Curve-style vote-escrow, gauge voting, boost, bribe depot)

**Target**: `contracts/shared/governance/{ve4626.sol, ve4626GaugeVoting.sol, ve4626BoostManager.sol, ve4626Utility.sol, bribes/BribeDepot4626.sol}`
**Repo**: `github.com/4626fun/4626` — tag `audit/oda-2026-07-22`
**Commit (pinned)**: `423e0e3a607884de6e60bccd06f722a8aba770ee`
**Out of scope (explicit)**: `github.com/wenakita/CreatorVault`, private `wenakita/4626` — confirmed no cross-contamination from these in the audited files.
**Methodology**: three-phase hybrid audit — Phase 0 (context: protocol map, access-control inventory, threat catalog, opus) → Phase 1 (breadth: 8 domain checklist agents, opus) → Phase 2 (depth: 12 attacker-mindset agents, opus, blind to Phase 1 findings) → Phase 3 (reconciliation + coverage gate, this document).

---

## Reconciliation Summary

**Overlap: 12 · Phase-1-only: 17 · Phase-2-only: 4 · Re-examined leads kept: 4, demoted: 1 · Coverage holes closed: 0**

- 40 raw findings/leads from 8 Phase-1 domain agents deduped to 29 unique (Contract, function, bug-class) items.
- ~40 raw findings/leads from 12 Phase-2 attacker agents (blind) deduped to 16 unique items (3 promoted findings + 13 leads).
- Cross-phase merge: 12 Phase-2 items independently converged on Phase-1 items (strong corroboration — some items were found by 6–10 independent agents across both phases). 4 Phase-2 items were genuinely new and were each targeted-re-read against source to confirm before inclusion (all 4 confirmed and kept). 1 Phase-2 lead (`calculateBoost` "legacy" boost with no position clamp) was demoted on re-read: its own natspec (ve4626BoostManager.sol:144-147) explicitly documents it as UI-only/legacy and states the real consumer must use `calculateBoostForPosition` — this is by-design, not a defect.
- **Confidence floor**: findings below confidence 50 are listed as Leads, not Findings. Two headline items (governance-reset timing, quorum-supply staleness) carry full numeric proofs and are reported as Findings at confidence 65–90; the remainder of the corroborated items are dust-bounded, self-recoverable, or contingent on out-of-scope/future integrations and are reported as Leads for transparency.
- **Coverage gate**: 43/43 external/public state-changing entrypoints in source addressed (examined by ≥1 phase, or explicitly noted clean). All threat-catalog rows answered. 0 coverage holes required a first-time re-read in this reconciliation pass (both phases already covered the full surface independently).

No Critical or High severity findings. **3 Medium**, **19 Low**, **10 Info/positive-confirmation** items below.

---

## Access-Control Inventory (from Phase 0)

43 external/public state-changing functions across 5 files. All privilege is single-owner OZ `Ownable` (5 independent owner slots, one per contract) plus one hardcoded non-owner check (`ve4626BoostManager.updateBalanceTracking` requires `msg.sender == address(ve4626)`). No `AccessControl`/roles anywhere.

| Surface | Detail |
|---|---|
| Timelocked (48h, first-set-instant-then-timelocked) | `ve4626.boostManager`, `ve4626GaugeVoting.utility`, `ve4626BoostManager.utility` + boost params |
| Instant, no timelock | `setVault`, all whitelist/registry setters, `setMinVotingPower`, `setRolloverGraceEpochs`, `setGaugeVoting`, `setAutoClaimVeLottery` |
| Permissionless, arbitrary-target | `ve4626.burnExpiredLock(user)`, `ve4626Utility.sync(user)`, `BribeDepot4626.rolloverZeroVoteEpoch(epoch,token)`, `ve4626GaugeVoting.checkpoint()` |
| Owner-only, high-impact | `emergencyResetAllVotes`, `rolloverExpiredEpoch`, `executeBoostManagerUpdate`/`executeUtilityUpdate` (×2), `executeBoostParameterUpdate` |
| Ownership transfer | Single-step `Ownable` on all 5 contracts (no `Ownable2Step`) |

Full per-function table: see Phase-0 appendix (`appendix-access-control.md`, retained in the audit working directory).

## Threat Model (from Phase 0, resolved)

| Actor → Entrypoint → Asset | Resolution |
|---|---|
| Any address → `burnExpiredLock`/`sync`/`rolloverZeroVoteEpoch` → third-party state | Invariant holds for burn/sync (bounded to genuinely-unbacked/expired state); `rolloverZeroVoteEpoch` redirection risk → **Finding L5** |
| Voter → `vote()` reentrancy via state-changing `utility.sync` → double-counted power | Invariant holds — independent `nonReentrant` guards on both contracts, verified by 3+ Phase-2 agents |
| Owner (any timelock contract) → first-set-instant bootstrap → bypass 48h delay | Invariant holds for the delay itself; transparency gap only → **Finding (Lead) timelock re-arm** |
| Voter → weight normalization/dust routing → disproportionate vault credit | Invariant holds — sum-preserving, verified by precision-math agent |
| Any bribe-token address → `bribe()` → hostile token accounting | Invariant holds — balance-delta accounting, `nonReentrant` |
| Claimant → `claim()` after `emergencyResetAllVotes` → stale-weight claim | Invariant holds for the bribe-claim path (generation-gated); the *reset itself* has a timing flaw → **Finding #1 (Medium)** |
| LotteryManager4626 (external) → `calculateBoostForPosition` → out-of-bounds boost | Invariant holds — hard-clamped `[1x, maxBoost]` regardless of caller-supplied USD inputs, verified by 4+ agents including adversarial extremes |
| Owner → `rolloverExpiredEpoch` → confiscate late claims | Documented tradeoff, grace-floor bounded → **Finding L9** |
| Owner (any) → instant eligibility/parameter setters → reshape outcomes with no notice | → **Finding #2 (Medium)** |
| Owner → `ve4626Utility` constructor → utility-token ownership handoff | → **Finding #3 (Medium)** |

---

## Findings

### Medium

**[M-1] `emergencyResetAllVotes` shares an identical cutoff with the vote-freeze window — owner reset leaves ~1 second, not the documented window, for voters to re-cast**

`ve4626GaugeVoting.emergencyResetAllVotes()` / `vote()` · Confidence: 90 · `[both — Phase 1: governance-1; Phase 2: trust-gap agent, verified]`

**Description**: The reset guard and the vote guard use the identical cutoff expression:
```solidity
// L289 (vote):
if (epochEnd > block.timestamp && epochEnd - block.timestamp <= VOTE_FREEZE_WINDOW) { ... }
// L688 (emergencyResetAllVotes):
if (epochEnd > block.timestamp && epochEnd - block.timestamp <= VOTE_FREEZE_WINDOW) { ... }
```
The ODA-433-F3 design intent (per the code's own comments) is that the owner must reset *before* the freeze window so voters have a chance to re-cast before the epoch closes. Because both guards trip at the exact same instant, the latest legal reset timestamp is the same timestamp voting freezes at — the enforced re-cast margin is ~1 second, not the intended `VOTE_FREEZE_WINDOW` (1 hour). An owner (or any unprivileged racer, satisfying Gate 3's "race" amplifier) can reset at `epochEnd - VOTE_FREEZE_WINDOW - 1` and cast a replacement vote one second later while the epoch's other voters have no practical chance to react — reshaping the epoch's live gauge probability (`getVaultProbabilityBoostPPM` reads current-epoch weights) and redirecting the other voters' bribe entitlements (their `getUserVoteWeightAtEpoch` now reads 0 due to the generation bump) to whoever re-votes in the window. Bribes stranded from the reset voters are later sweepable into a future epoch via the permissionless `rolloverZeroVoteEpoch`.

**Proof of Concept**: Users A and B vote vault V (weight 100 each) in epoch E; a briber deposits 1000 USDC for V. At `block.timestamp = epochEnd - 3601` (1 second before the freeze boundary, `VOTE_FREEZE_WINDOW = 1 hours = 3600`), owner calls `emergencyResetAllVotes()` — passes (`3601 > 3600`). One second later, at `epochEnd - 3600`, a party with an eligible lock calls `vote([V],[w])` — this is the exact same boundary at which `vote()` itself would revert `VoteFreezeWindow` one second later, so it is the *last possible* re-vote. A and B, with no realistic reaction time, never re-cast. At epoch close: `getUserVoteWeightAtEpoch(E,{A,B},V) = 0` (stale generation), `getUserVoteWeightAtEpoch(E,C,V) = w`. C claims the entire 1000 USDC bribe pool.

**Recommendation**:
```diff
- if (epochEnd > block.timestamp && epochEnd - block.timestamp <= VOTE_FREEZE_WINDOW) revert EmergencyResetInFreezeWindow();
+ if (epochEnd > block.timestamp && epochEnd - block.timestamp <= 2 * VOTE_FREEZE_WINDOW) revert EmergencyResetInFreezeWindow();
```
Banning reset in the last `2 * VOTE_FREEZE_WINDOW` guarantees voters a full un-frozen `VOTE_FREEZE_WINDOW` to react and re-cast after any reset.

---

**[M-2] Vote/bribe eligibility and boost parameters are instantly owner-settable — inconsistent with the 48h-timelocked dependency-pointer pattern used elsewhere**

`ve4626GaugeVoting.setVaultWhitelist`/`batchSetVaultWhitelist`/`setSurfaceRegistry`/`setUseSurfaceRegistry`/`setRegistry`/`setUseRegistryWhitelist`; `ve4626BoostManager.setMinVotingPower`/`setveLotteryToken`; `ve4626.setVault`; `BribeDepot4626.setRolloverGraceEpochs` · Confidence: 80 · `[Phase 1 only — access-control-3, governance-2]`

**Description**: The protocol applies a 48h timelock to `boostManager`/`utility` pointer rewiring and boost-parameter changes, but the functions that determine *which vaults are eligible for votes and bribes*, *which registry decides eligibility*, and *the boost-eligibility floor* are single-step, instant `Ownable` setters. Mid-epoch, the owner can delist a vault (its weight is burned from the budget per natspec), swap the entire eligibility source, or shift `minVotingPower` — with zero reaction window for users, on the same trust surface the timelock elsewhere protects.

**Proof of Concept**: Owner observes a lottery draw approaching and calls `setVaultWhitelist(rivalVault, false)` (or `setUseSurfaceRegistry(true)` pointing at an owner-controlled registry) instantly — `getVaultProbabilityBoostPPM(rivalVault)` returns 0 for the rest of the epoch, with no on-chain recourse for voters who backed it.

**Recommendation**: Apply the same 48h queue/execute timelock to eligibility-policy and boost-parameter setters, for consistency with the pointer-rewiring pattern already used for `boostManager`/`utility`.

---

**[M-3] `ve4626Utility` constructor hands ownership of the ve33/veLottery mint tokens to the same key that operates the rest of the protocol**

`ve4626Utility` constructor (deploys `ve33`/`veLottery`, sets minter to self, then `transferOwnership(owner_)` on both) · Confidence: 70 (contingent on out-of-scope `ve4626UtilityToken.setMinter` being owner-gated — plausible given the constructor calls it, but the token source is not in the audited scope) · `[Phase 1 only — access-control-1]`

**Description**: `ve33` drives gauge vote weight (and gates every `BribeDepot4626` bribe claim); `veLottery` drives lottery boost. Both tokens are owned by the protocol owner, the same key operating every other privileged function in scope. If the out-of-scope `ve4626UtilityToken` exposes an owner-gated `setMinter` (implied — the constructor itself calls `ve33.setMinter(address(this))`), a compromised or malicious owner could re-point the minter to itself and mint unlimited ve33/veLottery, manufacturing arbitrary gauge votes (draining every bribe pool) and arbitrary lottery boost, bypassing any ve-lock entirely.

**Proof of Concept**: Owner key compromised → attacker (as ve33 owner) calls `ve33.setMinter(attacker)` → `ve33.mint(attacker, huge)` → attacker claims the full bribe pool of every vault and forces `maxBoost`. Precondition: owner compromise + owner-gated `setMinter` in the out-of-scope token (plausible, not independently verified in this scope).

**Recommendation**: Do not transfer utility-token ownership to the operational owner key. Keep minter authority permanently bound to the Utility contract (renounce token ownership after `setMinter`, or make the minter immutable in the token), or place token ownership behind a separate, higher-security multisig/timelock.

---

### Low

**[L-1] `hasVotedThisEpoch` is not generation-aware — stays `true` after `emergencyResetAllVotes`, temporarily blocking ve33 forfeit**

`ve4626GaugeVoting.hasVotedThisEpoch()` (L532-535) / `ve4626Utility._requireNoActiveVoteEscrow()` · Confidence: 75 (lead-promoted: 7 independent agents across both phases converged on this exact defect) · `[both — Phase 1: general-3; Phase 2: access-control, execution-trace, invariant, periphery, flow-gap, first-principles, all independently]`

```solidity
function hasVotedThisEpoch(address user) external view returns (bool) {
    uint256 epoch = currentEpoch();
    return _epochUserVotedVaults[epoch][user].length() > 0;   // no generation check
}
```
Contrast the sibling `getUserVoteWeightAtEpoch` (L541-545), which *does* check `_userVoteGeneration[epoch][user] != _epochResetGeneration[epoch]`. `emergencyResetAllVotes` bumps the generation and zeroes vote-weight aggregates, but never clears the per-user `_epochUserVotedVaults` set, so a reset user's `hasVotedThisEpoch` stays `true`, causing `forfeitVe33`/`forfeitAll` to revert `ActiveVoteEscrow` for the rest of the epoch despite the user's vote weight being 0. Self-recoverable: calling `resetVotes()` first clears the per-user set.

**Recommendation**: Gate `hasVotedThisEpoch` on the same generation check `getUserVoteWeightAtEpoch` already uses.

---

**[L-2] `getPastTotalSupply` is frozen at the last lock mutation while `getPastVotes` decays continuously to the query timestamp — quorum denominator can disagree with the sum of votes**

`ve4626.getPastTotalSupply()` (L746-769) vs `getPastVotes()` (L733-739) · Confidence: 65 · `[Phase 2 only — invariant agent, verified via re-read]`

**Description**: `getPastVotes(user, t)` recomputes `amount·(end-t)/MAX` decayed exactly to `t` via `_votingPowerAt`. `getPastTotalSupply(t)` instead binary-searches `_totalSupplyCheckpoints` and returns `_totalSupplyCheckpoints[lo-1].supply` verbatim (confirmed at ve4626.sol:767-768) — the raw value checkpointed at the last lock *mutation*, never decayed forward through quiet periods to `t`. Ironically, the code's own comment (L741-745) states this function was fixed (H-06, superseding G-07) specifically to prevent quorum manipulation via lock changes between snapshot and vote — but the fix left a continuous-vs-stepwise mismatch between the two historical accessors.

**Proof of Concept**: Single locker, `amount=1e18`, 4-year lock, no further mutations after creation at `t0`. `_totalVotingSupply` is checkpointed once = `1e18` at `t0`. At `t1 = t0 + 2 years` (no intervening mutation): `getPastVotes(user, t1) = 1e18 * 0.5 = 0.5e18`, but `getPastTotalSupply(t1) = 1e18` (frozen at `t0`). The sole voter, holding 100% of real voting power, reads as only 50% of the reported total — any quorum threshold above 50% becomes unreachable even with unanimous turnout. Direction is conservative (denominator over-stated, never under-stated relative to the true decayed total), so it cannot force a proposal through with insufficient real support — only block legitimate ones. **No in-repo Governor consumes this yet** — the ERC20Votes surface (`clock`, `CLOCK_MODE`, `permit`) is explicitly built to serve a future external one, so impact is real and provable but contingent on that future integration.

**Recommendation**: Apply the same forward Curve-decay walk (`_decayStateAt`) to the checkpointed supply, decaying it from the checkpoint's timestamp to the queried `timepoint`, so the denominator decays identically to the per-user numerator.

---

**[L-3] `increaseLock` never burns when recalculated power is lower than the stale minted balance**

`ve4626.increaseLock()` (L298-301) · Confidence: 70 · `[both — Phase 1: general-1, defi-staking-1; Phase 2: economic-security, periphery, first-principles, asymmetry, boundary]`

`extendLock` adjusts the ve ERC20 balance in both directions (L257-262: mint OR burn). `increaseLock` only mints (L298-300, confirmed no `else` branch): a small top-up made long after the original lock, where the shrinking remaining duration makes `newVotingPower < oldPower`, leaves `balanceOf` inflated above true decayed power. The dual-decay checkpoint (`_checkpointUserSlope`) is updated correctly regardless — only the raw ERC20 `balanceOf`/current `getVotes` diverges. No in-scope consumer reads raw `balanceOf` for power math.

**Recommendation**:
```diff
  if (newVotingPower > oldPower) {
      _mint(msg.sender, newVotingPower - oldPower);
+ } else if (newVotingPower < oldPower) {
+     _burn(msg.sender, oldPower - newVotingPower);
  }
```

---

**[L-4] `getVotes()`/delegation ignore the decay model; inconsistent with the overridden `getPastVotes()`**

`ve4626.sol` — inherited `getVotes`/`delegate`/`delegateBySig`; `getPastVotes()` override · Confidence: 60 · `[both — Phase 1: general-2, governance-3, defi-staking-1, signatures-2; Phase 2: boundary, execution-trace, periphery, first-principles, flow-gap, invariant]`

`getPastVotes` is overridden to resolve the account's *own* decayed lock (ignoring delegation entirely); current `getVotes()` is not overridden and returns the raw, non-decaying ERC20Votes checkpoint balance. `delegate()`/`delegateBySig()` remain callable but have no effect on any decayed-power view. No in-scope contract reads `getVotes`/delegation (all internal consumers use `getVotingPower`/`getTotalVotingPower`/`getPastVotes`), so impact is confined to external integrators/governors.

**Recommendation**: Override `getVotes` to match the decayed semantics of `getPastVotes`, or disable `delegate`/`delegateBySig`/`permit` (revert, matching the non-transferable design) and document that only `getVotingPower`/`getPastVotes` are authoritative.

---

**[L-5] `rolloverZeroVoteEpoch` lets a positioned voter redirect stranded/reset bribes to themselves**

`BribeDepot4626.bribe()`/`rolloverZeroVoteEpoch()` (L94-111, 154-177) interacting with `emergencyResetAllVotes` · Confidence: 55 · `[both — Phase 1: general-7, governance-6; Phase 2: trust-gap]`

`bribe` records no depositor identity. Bribes for a vault that ends an epoch with zero vote weight (organically, or via owner reset per M-1) can only be recovered via the permissionless `rolloverZeroVoteEpoch`, which moves them into a *future* epoch's pool — never back to the original briber. Any address holding vote weight for that vault in the destination epoch, including the caller who triggers the rollover, can then claim a pro-rata share the original briber never intended for them. Owner-induced zero weight (via M-1's reset) is indistinguishable from organic zero weight to this permissionless check.

**Recommendation**: Record per-depositor contributions to enable a refund path, or make `rolloverZeroVoteEpoch` owner-only (matching `rolloverExpiredEpoch`), or explicitly document bribes as non-refundable/forfeit-to-future-voters.

---

**[L-6] Deflationary/rebasing bribe tokens can strand claimants and desync cross-epoch rollover accounting**

`BribeDepot4626.claim()` (L118-148, `InsufficientBribeBalance` at L140), `rolloverExpiredEpoch`/`rolloverZeroVoteEpoch` · Confidence: 55 · `[both — Phase 1: dos-2, governance-5; Phase 2: execution-trace]`

`bribe()` uses balance-delta accounting correctly, but `claim`'s computed pro-rata `amount` is checked against the depot's *global*, cross-epoch-shared `balanceOf(address(this))`, not a per-epoch-segregated balance, and reverts (rather than caps) on shortfall. A deflationary/rebasing/pausable bribe token deposited into one epoch can pad or starve claims in a different epoch, and rollover moves the *recorded* (not measured) remainder forward, compounding the mismatch. Griefing is self-funded by whoever deposits the malicious token.

**Recommendation**: Document/enforce a bribe-token allowlist restricted to standard non-rebasing, non-fee-on-transfer, non-pausable ERC20s, or switch to available-balance-capped, cursor-based pro-rata accounting.

---

**[L-7] Unbounded `_epochVotedVaults` growth can gas-DoS `emergencyResetAllVotes`**

`ve4626GaugeVoting.vote()` (L352, adds to `_epochVotedVaults[epoch]`, never pruned), `emergencyResetAllVotes()` (L693-699, unbounded iteration, unlike `checkpoint()`'s 52-cap) · Confidence: 40 (Lead-level; Phase 1's two agents disagreed on reachability — dos-1 rated Medium/attacker-reachable, governance-8 rated Info/unlikely under realistic whitelist size; re-examined here and kept as a Low lead given it requires either a large owner-set whitelist or many organic voters) · `[Phase 1 only — dos-1, governance-8]`

`_clearUserVotes` never removes entries from the global per-epoch voted-vault set; a single attacker can add up to `MAX_VAULTS_PER_VOTE` (10) fresh entries per cheap re-vote transaction. If the set grows large enough, iterating it in `emergencyResetAllVotes` can exceed the block gas limit, bricking the emergency escape hatch for that epoch — but only under a large whitelist or many distinct voted vaults, bounding real-world reachability.

**Recommendation**: Prune `_epochVotedVaults` entries when a vault's aggregate weight reaches zero, or make the reset bounded/paginated across multiple calls.

---

**[L-8] `BribeDepot4626.claim` transfers before marking `claimed` (CEI ordering)**

`BribeDepot4626.claim()` (L138-145) · Confidence: 30 (not exploitable under the current shared `nonReentrant` guard — defense-in-depth only) · `[Phase 1 only — governance-4, defi-staking-5]`

The bribe token is transferred before `claimed[...]=true`/`claimedAmount+=amount` are written. Currently safe: `claim`/`bribe`/`rolloverZeroVoteEpoch`/`rolloverExpiredEpoch` share one `nonReentrant` guard.

**Recommendation**: Set `claimed[...]=true` and increment `claimedAmount` before `safeTransfer`, for defense-in-depth against a future guard refactor.

---

**[L-9] No two-step ownership transfer on any of the 5 contracts**

All 5 files, plain OZ `Ownable` · Confidence: 40 · `[Phase 1 only — access-control-2]`

A `transferOwnership` to a mistyped/uncontrolled address is immediate and irrevocable. **Recommendation**: Use `Ownable2Step` across all 5 contracts.

---

**[L-10] `rolloverExpiredEpoch` lets the owner confiscate late claimants' unclaimed bribes after the grace window**

`BribeDepot4626.rolloverExpiredEpoch()` (L185-218) · Confidence: 35 (documented tradeoff, grace-floor bounded) · `[Phase 1 only — access-control-4]`

After `rolloverGraceEpochs` (floor `MIN_ROLLOVER_GRACE_EPOCHS = 2`, L53), the owner can roll a non-zero-vote epoch's unclaimed remainder forward, closing the source epoch — a legitimate but slow-to-claim voter permanently loses access. **Recommendation**: consider a longer/immutable grace floor, or a per-user pull-forward mechanism.

---

**[L-11] `renounceOwnership` can permanently brick boost configuration, emergency reset, and rollover**

All 5 contracts (inherited `Ownable.renounceOwnership`) · Confidence: 30 · `[Phase 1 only — access-control-5]`

E.g. renouncing before `BoostManager.setUtility`/`executeUtilityUpdate` is ever executed permanently reverts all boost calculation (`UtilityNotConfigured`), with no fallback. **Recommendation**: override `renounceOwnership` to revert, given owner-critical operational functions with no alternative path exist.

---

**[L-12] Timelock "instant-set" branch is re-armable via a round-trip through `address(0)` — the delay itself holds, but the queued event doesn't name the eventual replacement**

`ve4626.setBoostManager`/`executeBoostManagerUpdate`; `ve4626GaugeVoting.setUtility`/`executeUtilityUpdate`; `ve4626BoostManager.setUtility`/`executeUtilityUpdate` · Confidence: 40 · `[both — Phase 1: access-control-6; Phase 2: periphery, with full re-arm trace]`

The instant branch is gated on `pointer == address(0)`, reachable only after the timelocked path zeroes the pointer — so the 48h delay is not bypassed. But to re-arm the instant path, the owner queues a set-to-zero, so the emitted `...UpdateQueued(address(0), ...)` event doesn't name the eventual malicious/new target the owner intends to instant-set right after. **Recommendation**: gate the instant branch on a one-time boolean set on first successful configuration (never cleared), rather than testing `== address(0)`, so all post-deploy changes go through queue+execute with the real target visible.

---

**[L-13] `ve4626Utility.setGaugeVoting` wiring is optional at the type level — two distinct mechanisms let one ve position double-back a vote and a veLottery claim**

`ve4626Utility.setGaugeVoting()`, `_requireNoActiveVoteEscrow()` · Confidence: 45 · `[both, two distinct mechanisms for the same function]`

**Mechanism A** (Phase 1 — access-control-7): the escrow no-ops entirely if `gaugeVoting` was never wired (`address(0)`), with no runtime enforcement that the wiring happened — only a natspec reminder on `setUtility`.
**Mechanism B** (Phase 2 — access-control, economic-security leads): even when wired, the escrow only checks the *current* epoch's `hasVotedThisEpoch` — once the epoch rolls over, the escrow releases even though the epoch's bribe claim (settled on the frozen weight) is still outstanding, letting a user forfeit ve33 and repurpose the freed capacity into veLottery in the next epoch.

**Recommendation (Option A — enforce wiring)**: make the gauge-voting wire mandatory before votes are escrow-relevant, or revert forfeits when `gaugeVoting` is unset and any epoch vote exists.
**Recommendation (Option B — cross-epoch, if intended as one-position-one-purpose)**: extend the escrow to also block forfeiture while an unclaimed bribe exists for any epoch the user voted in, not just the current epoch.

---

**[L-14] `extendLock` is missing the `MIN_LOCK_DURATION` floor that `lock()` enforces when reviving an expired lock**

`ve4626.extendLock()` (L239-244) · Confidence: 35 · `[Phase 2 only — asymmetry agent, verified via re-read]`

```solidity
function extendLock(uint256 newEnd) external override nonReentrant returns (uint256 newVotingPower) {
    Lock storage userLock = _locks[msg.sender];
    if (userLock.amount == 0) revert NoExistingLock();
    if (newEnd > block.timestamp + MAX_LOCK_DURATION) revert InvalidLockDuration();
    newEnd = _weekFloor(newEnd);
    if (newEnd <= userLock.end) revert LockDurationTooShort();
```
`lock()` enforces `lockEnd >= block.timestamp + MIN_LOCK_DURATION` (L206). `extendLock` only checks the upper bound and `newEnd > userLock.end` — since extend is explicitly allowed to revive expired locks (`userLock.end` may be in the past), a user can revive with `newEnd = weekFloor(now + <7 days)`, which passes both checks and yields a live lock shorter than the protocol's stated minimum. Downstream gates (gauge vote requires lock age ≥1 epoch via `start`; boost requires a 7-day holding period keyed off `lastBalanceUpdateBlock`, both reset to `now` on every lock mutation) appear to neutralize any resulting gain from this specific gap — rated a consistency violation, not a verified exploit path.

**Recommendation**:
```diff
  if (newEnd > block.timestamp + MAX_LOCK_DURATION) revert InvalidLockDuration();
+ if (newEnd < block.timestamp + MIN_LOCK_DURATION) revert InvalidLockDuration();
  newEnd = _weekFloor(newEnd);
```

---

**[L-15] Boost quote inflated by flooring the `tokenlessWorking` denominator**

`ve4626BoostManager.calculateBoostForPosition()` (L192, 208-210) · Confidence: 30 · `[Phase 1 only — precision-math-1]`

`tokenlessWorking = floor(0.4·l)`; dividing by a floored divisor inflates the quoted boost slightly in the trader's favor, growing as `l` shrinks (negligible at realistic USD scaling, up to ~1-2.5% at small whole-unit `l`). Bounded within `[BOOST_PRECISION, maxBoost]` regardless. **Recommendation**: compute the ratio without the intermediate floor, or document a minimum-scale assumption for `l`.

---

**[L-16] Curve dual-decay bias/slope rounding leaves a permanent, safe-direction residual in the global voting-power total**

`ve4626._checkpointUserSlope()`/`_decayStateAt()` (L444-470) · Confidence: 25 (dust-bounded at any realistic scale) · `[both — Phase 1: precision-math-2, precision-math-3, defi-staking-2; Phase 2: math-precision, economic-security, invariant, first-principles, asymmetry, boundary, numerical-gap, flow-gap — 10 independent agents total, the most heavily corroborated item in the entire audit]`

Global bias is added using the exact formula `_calculateVotingPower = amount*(end-now)/MAX` (L370-376) but decayed/removed using a floored slope `_userSlopeOf = floor(amount/MAX)` (L382-386), forced to `1` for dust locks where the floor is 0 (L468). Because add ≥ (slope·duration), a small residual (< ~1.26e8 wei per lock, i.e. ~1.3e-10 tokens at 18 decimals) survives permanently after a lock fully expires — inflating the `Ve` boost denominator (shrinking everyone's boost share — safe direction) and inflating governance quorum denominators. The forced-slope-1 branch can also over-decay dust-lock contributions faster than their true rate, a symmetric-but-opposite-direction dust effect. Bounded to economically irrelevant amounts at any realistic scale (would require ~1e14+ dust-lock operations to move by a single token).

**Recommendation**: Derive the slope-change/removal from the same rounded basis used to add bias (Curve-style: derive `bias = slope*(end-now)` on both add and remove), or document as accepted drift.

---

**[L-17] `MIN_HOLDING_BLOCKS` hardcodes a block count as a time proxy**

`ve4626BoostManager.MIN_HOLDING_BLOCKS` (L56 area), `_holdingPeriodSatisfied()` · Confidence: 20 · `[Phase 1 only — general-4]`

`302_400` blocks, commented "~7 days on Base L2" — fixes the anti-flash holding window to Base's block time; redeploying elsewhere silently shrinks/extends the intended window. Not exploitable on Base as configured. **Recommendation**: derive from `block.timestamp` instead, or make it an owner-settable timelocked parameter.

---

**[L-18] `permit()` remains live on a non-transferable token — dead functionality, consumes nonces for no effect**

`ve4626.sol` — inherited `ERC20Permit.permit()` · Confidence: 20 · `[Phase 1 only — signatures-1]`

`permit()` sets allowances via internal `_approve`, bypassing the overridden public `approve` revert. The allowance is real but permanently unspendable — `transferFrom` reverts unconditionally, so non-transferability is confirmed NOT bypassed. Residual risk is integration confusion (a relying party burns a nonce for a phantom, unusable allowance). **Recommendation**: override `permit()` to revert as well, for a consistent surface.

---

**[L-19] Lock amount recorded as requested, not measured — fee-on-transfer/rebasing wrapped share would desync accounting**

`ve4626.lock()` (L209, 215-221), `increaseLock()` (L287-290), `unlock()` (L335) · Confidence: 25 (contingent on the immutable, presumed-standard lock token's actual behavior — not independently verifiable in this scope) · `[both — Phase 1: defi-staking-4; Phase 2: boundary, economic-security, execution-trace]`

Unlike `BribeDepot4626.bribe` (measured balance-delta), `lock`/`increaseLock` credit the requested transfer amount without measuring received delta. A fee-on-transfer/rebasing `wrappedShareOFT` would cause over-crediting relative to actual holdings, eventually breaking a later unlocker's transfer. **Recommendation**: use measured balance-delta accounting (as `bribe` already does), or explicitly document/enforce that `wrappedShareOFT` must be standard, non-FoT, non-rebasing (it is immutable and presumed to be the protocol's own standard vault-share wrapper).

---

### Info / Positive Confirmations

**[I-1]** 255-week Curve decay walk (`_decayStateAt`) truncates safely given `MAX_LOCK_DURATION` (~208.5 weeks) `< 255`; confirmed non-exploitable, one-time ~600k-gas cost only after ~5 years of total inactivity. `[both — general-5, dos-3; corroborated by numerical-gap, math-precision]`

**[I-2]** `vote()`'s dependency on `utility.sync`/`surfaceRegistry` (no try/catch) is an owner-controlled trust surface, not attacker-reachable; a misconfigured dependency causes protocol-wide voting DoS until owner re-wires. `[Phase 1 — dos-4]`

**[I-3]** `underlyingValue` (from `IVault.previewRedeem`, flash-manipulable) is stored but not consumed by any in-scope voting/boost math — informational only. `[Phase 1 — flashloans-3]`

**[I-4]** **Positive confirmation**: the lock-age vote gate and boost holding-period gate were both independently stress-tested for flash-loan bypass by multiple agents (flashloans, both Phase 1 and Phase 2) — confirmed robust. `extendLock`/`increaseLock` both re-season `start`/`lastBalanceUpdateBlock` to `now`, so reviving an expired lock or topping one up only ever delays eligibility, never shortcuts it. Combined with the 7-day minimum lock, expiry-gated `unlock`, and non-transferable ve, same-block flash-loan lock→vote and lock→boost are structurally impossible.

**[I-5]** `getTotalGaugeProbabilityBps` truncates 694.2 bps to 694 — pure display helper, no on-chain accounting depends on it. `[Phase 1 — precision-math-4]`

**[I-6]** `nonReentrant` is not the first modifier on `rolloverExpiredEpoch` (`onlyOwner nonReentrant`) — harmless since `onlyOwner` makes no external call. `[Phase 1 — general-6]`

**[I-7]** `getVaultProbabilityBoostPPM` exposes live, freely-mutable mid-epoch weights; if the out-of-scope `LotteryManager4626` reads this at draw time rather than a frozen snapshot, a large voter could vote immediately before a draw and reset after — unverifiable without visibility into the external consumer's read timing. `[Phase 1 — governance-7]`

**[I-8]** Permissionless `burnExpiredLock`/`sync` are repeatable (no idempotency guard) and reset the boost holding clock, but only reachable against already-expired (0-power) locks — gas/event-spam griefing only, no principal/power impact. `[both — defi-staking-3; invariant]`

**[I-9]** `ve4626Utility._sync`'s burn of ve33/veLottery is sized from internal `userClaimed*` accounting, not `balanceOf`; if the out-of-scope `ve4626UtilityToken` is transferable, a user who moves tokens away could self-DoS their own `sync`/`vote`/`claim`/`forfeit` calls — confirmed no vote/boost inflation is possible via such transfers (all power reads use the internal accounting, never `balanceOf`). `[Phase 2 only — math-precision, economic-security]`

**[I-10]** `getUserVotes` (view) returns stale, non-generation-checked per-user vote records after `emergencyResetAllVotes` — a UI/integrator-facing inconsistency distinct from L-1's `hasVotedThisEpoch`/escrow issue; the security-relevant path (`getUserVoteWeightAtEpoch`, bribe claims) is correctly generation-gated. `[Phase 2 only — invariant]`

**Verified clean, not a finding**: `ve4626BoostManager.calculateBoost`/`calculateBoostWithProtection` ("legacy") grant full `maxBoost` to any user above `minVotingPower` with no position-size clamp — but the function's own natspec (L144-147) explicitly documents this as "UI / legacy" and states "Lottery must use `calculateBoostForPosition`" — this is documented, by-design behavior, not a defect. A Phase 2 lead flagging this was demoted after re-read confirmed the natspec.

---

## Coverage Gate

- **Entrypoints**: 43/43 external/public state-changing functions in source addressed — every privileged/value-moving entrypoint maps to ≥1 finding above or an explicit "examined, no issue" note (Threat Model table).
- **Threat-catalog rows**: 10/10 answered (Threat Model table above).
- **Holes closed this pass**: 0 — both phases independently covered the full entrypoint/threat surface; this reconciliation pass performed 4 targeted re-reads (all against Phase-2-only leads, to confirm line numbers and correctness before promotion — L-2, L-14, I-9, I-10) and 1 demotion (the `calculateBoost` lead, confirmed by-design).

---

## Scope Note

`ve4626UtilityToken.sol` (imported and instantiated by `ve4626Utility`, deploying `ve33`/`veLottery`) is referenced throughout this audit but is **not** among the 5 files named in scope and is not present in this repo checkout — its `mint`/`burn`/`setMinter` access control is assumed, not independently verified (see M-3, I-9). `LotteryManager4626`, `IRegistry4626VaultWhitelist`, `IGaugeSurfaceRegistryForVoting`, and `BribesFactory4626` are likewise out-of-scope external dependencies whose correctness is assumed per the Phase 0 protocol map.

---

> ⚠️ This review was performed by an autonomous AI audit pipeline (3 context agents + 8 breadth agents + 12 depth agents, all opus, across 3 phases). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human review, a bug bounty program, and on-chain monitoring are strongly recommended before mainnet deployment of governance/bribe logic controlling third-party funds.
