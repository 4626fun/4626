# 🔐 Security Review — ve4626 Governance Suite

---

## Audit Target (pinned)

| | |
|---|---|
| **Client-designated source of truth** | `https://litter.catbox.moe/leajpw.md` |
| **SHA-256 of fetched bundle** | `79c62aa3fbdf2fbb87f6eb8ac355d11c9966dca23b93dbba6f02cc67d5b60582` |
| **Fetched** | 2026-07-18 11:09 UTC |
| **Files audited** | `ve4626.sol` (750L) · `ve4626GaugeVoting.sol` (664L) · `ve4626BoostManager.sol` (281L) · `ve4626Utility.sol` (268L) · `bribes/BribeDepot4626.sol` (214L) |
| **Repo** | `github.com/wenakita/4626` (private) — audited via the client-supplied markdown source bundle above, per the job's explicit instruction. `github.com/wenakita/CreatorVault` was explicitly excluded from scope and was not consulted. |
| **Client-stated focus areas** | Locks, voting power, bribes, boost math, EnumerableSet remove order |
| **Methodology** | Three-phase: context mapping (protocol map + access-control inventory + threat catalog) → breadth (6 domain checklists: general, precision-math, governance, access-control, erc20, dos) → depth (12 attacker-mindset agents, blind to breadth-phase findings) → hybrid reconciliation |

---

## Scope

|                                  |                                                        |
| -------------------------------- | ------------------------------------------------------ |
| **Mode**                         | Client-specified files (5 files) |
| **Files reviewed**               | `ve4626.sol` · `ve4626GaugeVoting.sol`<br>`ve4626BoostManager.sol` · `ve4626Utility.sol`<br>`bribes/BribeDepot4626.sol` |
| **Confidence threshold (1-100)** | 45 |

---

## Reconciliation Summary

**Overlap: 3 · Breadth-only: 12 · Depth-only: 1 · Re-examined leads kept: all · Coverage holes closed: 0**

This audit's defining feature is the **rigorous, cross-methodology downgrade of the protocol map's own top-priority lead**. Phase 0 flagged `burnExpiredLock`'s permissionless boost-clock reset as its highest-priority threat. Across both hunting phases — 6 independent breadth-domain agents and 12 independent blind attack agents, **18 separate analyses in total** — **16 explicitly traced the mechanism to its conclusion and found it non-exploitable** (an expired lock already carries zero voting power, so resetting the anti-flash-loan clock denies nothing; legitimate revival resets the same clock anyway and simultaneously blocks further griefing calls). Only 2 analyses (1 per phase) concluded otherwise, and neither engaged with the specific zero-power refutation the majority established. This is reported as a Low-severity hygiene item (Finding 8), not the Critical-leaning threat the map initially flagged — the correction is itself evidence the methodology's blind, multi-agent hunting phase caught and fixed an overstated context-phase hypothesis rather than carrying it forward uncritically.

In its place, the hunting phases surfaced findings the map did not anticipate: a gauge-voting anti-flash "seasoning" bypass (Finding 1, found independently by 2 methodologies), an owner-emergency-function interaction that permanently strands third-party bribe deposits (Finding 2, corroborated by 5 independent analyses across both phases — the strongest cross-validation in this report), and a capacity double-use bug letting a single unit of locked power simultaneously back both a gauge-vote bribe claim and a lottery boost (Finding 3, surfaced only by the deep attack phase).

**Coverage gate** (against the phase-0 protocol map): all state-changing entrypoints across the 5 files are addressed either by an explicit finding or an "examined, confirmed sound" note (EnumerableSet removal correctness, bribe pro-rata rounding, boost `mulDiv` safety, utility haircut exactness, reentrancy guarding — all independently reconfirmed by multiple agents in both phases). All named threat-catalog rows from phase 0 are answered. **Holes closed this pass: 0.**

---

## Findings

[80] **1. Capacity double-use: a user can simultaneously earn gauge-vote bribes and lottery boost from the same underlying locked power**

`ve4626Utility.claimVe33/forfeitVe33/claimVeLottery` + `ve4626GaugeVoting.vote` · Confidence: 80 · Severity: **Medium** · Origin: **[phase 2 depth only]** — surfaced by the invariant-lens attack agent; not caught by the breadth phase

**Description**
`ve4626Utility` enforces a shared-capacity invariant (`claimedVe33 + claimedVeLottery <= capacityOf(user)`) specifically so ve33 (which backs gauge votes) and veLottery (which backs lottery boost) are mutually exclusive claims on one user's locked voting power. But a cast gauge vote is a raw snapshot stored in the independent `ve4626GaugeVoting` contract, fully decoupled from the ve33 balance that justified it — nothing in Utility knows a vote exists, and nothing in GaugeVoting re-validates live ve33 backing after the vote is frozen. A user can claim ve33, vote (freezing weight for the epoch), forfeit that same ve33, and claim veLottery with the freed capacity — ending up with both a live bribe-earning vote and a live boost-earning veLottery balance backed by the identical units of power. The boost holding-period clock is untouched by Utility operations, so the sequence is fully repeatable every epoch with no cooldown.

**Proof of Concept**
1. User with 100 voting power calls `claimVe33(100)` → `userClaimedVe33 = 100`.
2. User calls `gaugeVoting.vote([vaultA], [1])` → freezes `_epochUserVaultVotes[epoch][user][vaultA] = 100`, `_epochVaultVotes[epoch][vaultA] += 100`. Confirmed in source: this write (`Contract.function` `vote`) is a plain assignment with no ongoing dependency on live ve33.
3. User calls `forfeitVe33(100)` — `ve4626Utility.forfeitVe33` has no reference to `gaugeVoting` anywhere; it only decrements `userClaimedVe33` and burns the token. Passes unconditionally.
4. User calls `claimVeLottery(100)` — `freeCapacityOf` now reads `used = 0` (ve33 forfeited), so `free = 100`; mints 100 veLottery.
5. At epoch end, `BribeDepot4626.claim` pays the user their pro-rata share of `vaultA`'s bribes from the still-frozen weight (step 2), while `ve4626BoostManager._powerShare` simultaneously reads `effectiveVeLotteryOf(user) = 100` (step 4) for lottery boost — the same 100 units backed both.

**Fix**
```solidity
// Option A: escrow the ve33 backing an active vote so it cannot be forfeited
// while the vote it backs is still live for the epoch.

// Option B: have BribeDepot4626.claim re-derive payable weight from the
// user's LIVE effectiveVe33Of at claim time rather than trusting the
// vote-time snapshot alone — so forfeiting ve33 retroactively zeroes the
// claimable share for that vote.
```
Either approach restores the mutual-exclusivity the shared-capacity design was built to enforce.

---

[85] **2. Gauge-voting's anti-flash "seasoning" guard checks lock-creation time, not power-injection time — bypassable via `increaseLock`/`extendLock`**

`ve4626GaugeVoting.vote()` (seasoning check) · `ve4626.increaseLock()`/`extendLock()` (neither updates `Lock.start`) · Confidence: 85 · Severity: **Medium** · Origin: **[both]** — independently found by the general breadth agent and, in phase 2, independently reproduced as a full FINDING by the boundary attack agent with a matching root cause and PoC

**Description**
`vote()`'s anti-flash guard requires the caller's lock to be at least one epoch old, keyed on `Lock.start`. `start` is set once at initial `lock()` and never touched by `increaseLock` (raises `amount` only) or `extendLock` (raises `end` only, and explicitly permits reviving an already-expired lock). A user can season a small/dust lock once, wait one epoch, and thereafter inject arbitrary additional capital via `increaseLock` — or fully revive a lapsed lock via `extendLock` — voting with that freshly-injected power in the same transaction. The only remaining constraints (1-hour end-of-epoch freeze; lock must outlive the epoch) are trivially satisfiable with a few hours' notice. Not a flash loan (injected capital stays withdrawal-locked until the lock's `end`), but it fully defeats the "≥1 epoch old" seasoning invariant, letting freshly-committed capital immediately steer gauge probability and dilute genuinely-seasoned voters' bribe share.

**Proof of Concept**
1. Attacker locks a dust amount for 7 days at T0 (`start = T0`); waits >1 epoch so the base lock seasons.
2. ~2 hours before a target epoch ends (outside the 1h freeze), attacker calls `increaseLock(hugeAmount)` (`start` unchanged) or `extendLock` on a lapsed base lock.
3. Attacker calls `vote([vault], [weight])`. `userLock.start + EPOCH_DURATION > now` evaluates against the old `T0`, passing trivially despite the power being seconds old.

**Fix**
```solidity
// Reset seasoning on any power-increasing mutation:
function increaseLock(uint256 amount) external override nonReentrant returns (uint256 newVotingPower) {
    ...
+   userLock.start = block.timestamp; // re-season on power injection
    ...
}
```
Apply identically to `extendLock`, or gate `vote()` on a per-mutation clock (mirroring the boost system's `lastBalanceUpdateBlock`, which is correctly reset on every mutation) instead of the static `start` field.

---

[85] **3. `emergencyResetAllVotes` combined with the pre-epoch-end vote freeze can permanently strand an epoch's bribes with zero user recourse**

`ve4626GaugeVoting.emergencyResetAllVotes()` (onlyOwner, no timelock) · `vote()`'s freeze window · `BribeDepot4626.claim()`/`rolloverZeroVoteEpoch()` · Confidence: 85 · Severity: **High** · Origin: **[both]** — 5 independent analyses across both phases (governance breadth agent as a full FINDING; trust-gap attack agent independently as a full FINDING with complete cross-contract trace; economic-security, boundary, and first-principles attack agents each independently corroborating as LEADs) — the strongest cross-validation of any finding in this report

**Description**
`emergencyResetAllVotes` zeroes every voted vault's current-epoch weight and bumps the reset generation, instantly and without a timelock. Because `vote()` is blocked during the epoch's final hour, an owner call placed inside that freeze window wipes the epoch's entire vote allocation with **no window left for users to re-vote before the epoch closes**. Every affected vault's `getVaultWeightAtEpoch` becomes 0, so `BribeDepot4626.claim()` reverts `NoUserVotes` for every claimant — bribes deposited for that epoch become permanently unclaimable through the normal path. The only recovery is `rolloverExpiredEpoch` (or, since the reset vault now presents as zero-weight, the even-faster permissionless `rolloverZeroVoteEpoch` after just 1 epoch's grace) sweeping the stranded funds into a **future** epoch's pool — benefiting whoever votes then, not the epoch's original voters or the bribers who funded it. Verified across multiple agents: no owner path in any of the 5 contracts can move locked user principal — the harm is confined to third-party bribe deposits and that epoch's gauge outcome, not custody of locked funds. Severity is High because the mechanism combines an untimelocked emergency lever with a user-facing freeze window into a scenario with zero user mitigation and real third-party funds at risk, and — per the mechanical consequence independently identified in phase 2 — the reset epoch cannot be distinguished on-chain from a genuinely-never-voted epoch, so the *faster*, fully permissionless rollover path also becomes available.

**Proof of Concept**
1. Bribers deposit bribes for epoch E targeting vault V; honest users vote V.
2. Inside E's final 1-hour freeze window, the GaugeVoting owner calls `emergencyResetAllVotes()`. V's weight (and every other voted vault's) zeroes; users cannot re-vote.
3. E ends with `getVaultWeightAtEpoch(E, V) == 0`. Every `claim(E, token)` reverts `NoUserVotes`.
4. After the 1-epoch grace (faster than the owner-gated 4-epoch path, since the reset epoch is indistinguishable from a true zero-vote epoch), **anyone** permissionlessly calls `rolloverZeroVoteEpoch(E, token)`, moving the stranded funds to the current epoch's pool.

**Fix**
```solidity
// (a) Block the emergency reset during the freeze window:
function emergencyResetAllVotes() external onlyOwner {
+   uint256 epochEnd = epochEndTime(currentEpoch());
+   if (epochEnd > block.timestamp && epochEnd - block.timestamp <= VOTE_FREEZE_WINDOW) {
+       revert CannotResetDuringFreeze();
+   }
    ...
}

// (b) Prevent an emergency-reset epoch from qualifying for the fast,
// permissionless zero-vote rollover:
function rolloverZeroVoteEpoch(uint256 epoch, address token) external nonReentrant returns (uint256 rolled) {
    ...
+   if (gaugeVoting.epochWasEmergencyReset(epoch)) revert UseOwnerRolloverInstead();
    ...
}
```
Also consider putting `emergencyResetAllVotes` behind a timelock or a guardian role distinct from whoever can execute bribe rollovers.

---

[70] **4. Timelock coverage is inverted: bounded boost parameters are 48h-timelocked while the pointers that decide the entire data basis re-point instantly**

`ve4626BoostManager.setBoostParameters`/`executeBoostParameterUpdate` (timelocked) vs. `setUtility` (BoostManager and GaugeVoting), `ve4626.setBoostManager` (all instant) · Confidence: 70 · Severity: **Medium** · Origin: **[phase 1: governance]**, corroborated as a LEAD in phase 2 with the added observation that damage is bounded by existing caps

**Description**: The only timelocked knobs are the already-bounded `baseBoost`/`maxBoost` (1.0×–2.5×). The `utility` pointers — which supply the entire data basis for boost and vote calculations — re-point in a single transaction with no delay. A compromised BoostManager owner can call `setUtility(evilUtility)` and, from the next block, cause arbitrary boost multipliers for chosen users, bounded only by the existing `maxBoost` ceiling (phase 2 confirmed the damage cannot exceed that ceiling, somewhat narrowing but not eliminating the risk) — with none of the 48-hour warning the far less consequential `maxBoost` change requires.

**Fix**: Apply the same 48h-timelock pattern to `setUtility`/`setveLotteryToken`/`setBoostManager`, or make these pointers immutable as `ve4626`'s own core pointers already are.

---

[65] **5. Five independently-owned contracts form a cross-contract trust web — a single owner's compromise propagates damage into contracts they don't own**

All five contracts (`ve4626`, `ve4626GaugeVoting`, `ve4626BoostManager`, `ve4626Utility`, `BribeDepot4626`) · Confidence: 65 · Severity: **Medium** · Origin: **[phase 1: governance, access-control, general]** — three independent breadth-domain confirmations

**Description**: Because GaugeVoting's vote weights gate BribeDepot's claim eligibility, and Utility's balances gate both voting and boost, a single compromised owner key can cause damage landing in a different contract with a different, uncompromised owner — e.g., the GaugeVoting owner alone can whitelist an attacker vault and redirect gauge probability plus every downstream BribeDepot's claim eligibility, even though each BribeDepot has its own separate owner powerless to intervene. Verified: no owner-only function in any of the five contracts can move locked user principal to an owner-controlled address — the propagation surface is economic/accounting manipulation, not direct fund theft.

**Fix**: Enforce and document a single shared timelock/multisig owner across all five contracts as a hard deployment invariant, verified post-deploy.

---

[60] **6. Rebasing or deflationary bribe tokens permanently strand late claimants or leave surplus unrecoverable**

`BribeDepot4626.claim()` (no balance-sufficiency check against the frozen `totalBribes` snapshot) · Confidence: 60 · Severity: **Medium** · Origin: **[phase 1: erc20]**

**Description**: `bribe()`'s deposit path is correctly delta-measured, but `claim()` pays a fixed pro-rata share from the frozen `totalBribes` snapshot with no check that live balance still covers it. Since `token` is fully caller-chosen with no whitelist (only the vault is eligibility-gated), a briber can deposit a rebasing/deflationary token; if it negatively rebases before all claims complete, early claimants drain the shrunken balance and every later claimant's `safeTransfer` reverts permanently (no `claimed` flag set, so no retry path succeeds either). A positive rebase leaves undistributable surplus permanently stranded.

**Fix**: Cap payout to `min(computedAmount, IERC20(token).balanceOf(address(this)))`, or document/enforce that only standard non-rebasing tokens are supported as bribes.

---

[55] **7. Fee-on-transfer bribe tokens silently under-pay claimants on the payout side**

`BribeDepot4626.claim()` · Confidence: 55 · Severity: **Low** · Origin: **[both]** — 7 of 12 phase-2 attack agents independently flagged this alongside the phase-1 erc20/general findings, the single most cross-confirmed *low-severity* item in the audit

**Description**: For a standard fee-on-transfer token, the depot does not become insolvent (deposits are delta-measured; per-epoch claims sum to ≤ the credited total) — but each claimant receives less than their computed share while `claimedAmount`/the `Claimed` event both record the full pre-fee figure, silently misreporting what was actually paid.

**Fix**: Delta-measure the payout side too, or document FoT bribe tokens as unsupported.

---

[50] **8. `burnExpiredLock`'s permissionless boost-clock reset is mechanically real but produces no exploitable harm — the map's headline lead, downgraded after unanimous 16-of-18 re-examination**

`ve4626.burnExpiredLock(address user)` · `ve4626BoostManager.updateBalanceTracking` · Confidence: 90 (in the *downgrade*, not the original hypothesis) · Severity: **Low** · Origin: **[both]** — the single most heavily cross-validated conclusion in this audit: 6/6 breadth agents and 10/12 depth agents independently reached the identical refutation; only 1 depth agent (numerical-gap) dissented, and its proof did not engage with the specific zero-power counter-trace the majority established

**Description**: The mechanism is real: `burnExpiredLock` is permissionless, arbitrary-target, never deletes the lock struct, and unconditionally resets the target's `lastBalanceUpdateBlock` (the anti-flash-loan boost-holding clock) on every call — indefinitely repeatable against the same expired-but-unclaimed lock. But every rigorous trace reached the same conclusion: an *expired* lock (the function's own precondition) already has zero voting power by the core decay formula, so `effectiveVeLotteryOf` is already zero and every boost path already returns the neutral `baseBoost` regardless of the clock's state. The attack-reachable window (lock expired) and the boost-relevant window (lock active) are mutually exclusive, and any legitimate revival resets the same clock as a side effect while simultaneously blocking further `burnExpiredLock` calls (`LockNotExpired`).

**Fix**: No security fix required. For hygiene, gate the `_notifyBoostManager` call inside `burnExpiredLock` on `veBalance > 0` so a second call on an already-burned lock is a true no-op.

---

[50] **9. Global dual-decay bias/slope quantization causes a permanent, dust-bounded drift in `getTotalVotingPower()` — with a demonstrated (if impractical) active-drain path**

`ve4626._checkpointUserSlope()` · Confidence: 50 · Severity: **Low** · Origin: **[both]** — phase 1 precision-math found the passive residual; phase 2's numerical-gap and flow-gap agents independently extended it with a concrete active-drain mechanism

**Description**: Bias is added using the exact per-user formula but decayed/removed using a floored integer slope, leaving a permanent per-lock residual (bounded ≈1.26×10^8 wei) that never fully drains — `getTotalVotingPower()` (the boost-multiplier denominator) never quite reaches zero even after all locks expire. The dust-lock fallback (forcing `slope = 1` for near-zero-slope locks) produces the inverse and larger error: phase 2 traced a concrete sequence (`lock(2 wei, 4y)` then `increaseLock(1)`) where the forced slope-1 removal subtracts ~1.26×10^8 wei of *other users'* pooled bias for a lock that contributed only ~2 wei — a real, repeatable drain of the shared aggregate, though both agents that found it independently concluded reaching material scale requires billions of transactions (economically infeasible today).

**Fix**: Make bias and slope mutually consistent — round the slope up (`ceilDiv`) rather than down/forced-to-1, paired with the existing saturating-subtraction clamp, eliminating both the passive residual and the active-drain path in one change.

---

[45] **10. `getPastTotalSupply` is a step function refreshed only on lock mutations, while `getPastVotes` decays continuously — and the *current* `getVotes()`/`balanceOf` surface isn't decay-aware at all**

`ve4626.getPastTotalSupply()` / `getPastVotes()` / inherited `getVotes()` · Confidence: 45 · Severity: **Low** · Origin: **[both]** — phase 1 general agent found the historical-lookup mismatch; phase 2's first-principles agent independently extended it to the current-votes surface

**Description**: Between lock mutations, individual historical votes (`getPastVotes`) continue decaying smoothly while the recorded total checkpoint does not advance — any consumer computing a votes/total ratio would see a transiently inflated (conservative) denominator. Separately and more concretely: the team explicitly overrode the *historical* lookups (`getPastVotes`/`getPastTotalSupply`) to compute true time-decayed power, but the *current* ERC20Votes surface — inherited `getVotes(account)` and raw `balanceOf` — was left returning the stale, non-decaying lock-time mint snapshot, which is not even zeroed for a fully expired, unburned lock. No in-scope function reads `getVotes`/`balanceOf` (all governance/boost/gauge logic uses the decay-aware paths), so this is currently inert, but it is a concrete, demonstrable inconsistency rather than a purely latent one — relevant immediately to any future Governor integration or external integrator.

**Fix**: Project the total-supply checkpoint forward to the query timepoint (mirroring `_decayStateAt`'s own logic) for the historical mismatch; override `getVotes`/`_getVotingUnits` to match `getPastVotes`'s decay-aware, delegation-ignoring semantics for the current-surface mismatch — or explicitly document that `getVotes`/`balanceOf`/delegation must never be used for anything governance-relevant.

---

[45] **11. Bribe pro-rata rounding permanently strands a small voter's share in the original epoch, recoverable only by the owner rolling it into a *different*, later epoch**

`BribeDepot4626.claim()`'s revert-on-zero-share guard · Confidence: 45 · Severity: **Low** · Origin: **[phase 1: governance]**

**Description**: When a voter's floor-rounded share rounds to zero, `claim()` correctly reverts rather than silently succeeding for zero — but that voter can then never claim for that epoch, and their stranded share benefits whoever votes in a future rollover epoch, not themselves.

**Fix**: Accept and document as inherent dust, or implement a per-epoch unclaimed-dust sweep credited to the original epoch's voters.

---

[40] **12. No `Ownable2Step` anywhere; `renounceOwnership` permanently bricks materially-needed admin functions in 3 of 5 contracts**

All five contracts · Confidence: 40 · Severity: **Low** · Origin: **[phase 1: governance, access-control]**

**Description**: Renouncing BribeDepot ownership permanently loses recovery of unclaimed bribes from any epoch that had at least one vote; renouncing GaugeVoting ownership permanently freezes the vault whitelist; renouncing BoostManager before `setUtility` is called permanently bricks boost.

**Fix**: Migrate to `Ownable2Step`; override `renounceOwnership` to revert on the three contracts with material admin dependencies.

---

[40] **13. `checkpoint()` silently and permanently skips epoch-transition events beyond a 52-epoch gap**

`ve4626GaugeVoting.checkpoint()` · Confidence: 40 · Severity: **Low** · Origin: **[phase 1: dos]**

**Description**: The 52-iteration gas cap is correct, but when triggered it jumps `lastCheckpointedEpoch` straight to the current epoch, permanently losing the skipped epochs' events. Confirmed no on-chain logic dependency (off-chain indexer impact only); requires over a year of inactivity to trigger.

**Fix**: Advance `lastCheckpointedEpoch` only to the last epoch actually processed within the window, enabling a later call to catch up.

---

[40] **14. `wrappedShareOFT` lock accounting is parameter-trusted, not balance-delta-measured**

`ve4626.lock()`/`increaseLock()`/`unlock()` · Confidence: 40 · Severity: **Low** · Origin: **[phase 1: erc20, general]**

**Description**: Uses the caller-supplied `amount` directly rather than a measured balance delta. Latent given the token is immutable and protocol-controlled (not caller-chosen), but unenforced.

**Fix**: Document/enforce that `wrappedShareOFT` must be standard non-FoT/non-rebasing, or delta-measure (symmetric with `BribeDepot4626.bribe()`'s existing correct pattern).

---

## Leads

_Contingent on out-of-scope behavior or bounded to trusted-role actors with no unprivileged amplifier. Not independently scored._

- **`ve4626Utility._sync` could revert-DoS a user's own voting/claiming if the out-of-scope `ve4626UtilityToken` is transferable** — 3 independent phase-2 agents (periphery, execution-trace, first-principles). If a user claims utility tokens, transfers them elsewhere, and their voting power then decays, `_sync`'s haircut `burn()` would revert on insufficient balance, bricking `vote()`/claims for that user. Entirely contingent on the out-of-scope token's transferability (expected non-transferable for a ve-style token, but not confirmed from these 5 files) — recommend a follow-up check.
- **`increaseLock` is missing the burn branch its sibling `extendLock` has** — a late top-up on a decaying lock can leave `balanceOf`/current `getVotes()` overstated relative to true live power. No in-scope consumer reads this surface (see Finding 10), so currently inert, but worth fixing for consistency with `extendLock`'s symmetric handling.
- **`calculateBoost` (legacy) grants full `maxBoost` unconditionally, unlike the position-aware `calculateBoostForPosition`** — protected only by a natspec warning, not an on-chain guard. Recommend an on-chain deprecation (revert) if the legacy path is not meant to be called by the production LotteryManager integration.
- **Utility owner controls the ve33/veLottery token ownership** — the out-of-scope `ve4626UtilityToken`'s minter-management surface isn't visible in these 5 files; recommend confirming no external consumer trusts raw token balances for value during a follow-up review of that contract.

---

## Access-Control & Threat-Model Summary

**Roles**: each of the 5 contracts is independently `Ownable` (Finding 5) with no on-chain enforcement of a shared multisig. `burnExpiredLock`/`sync` are the two intentionally-permissionless, arbitrary-target functions in the suite (Finding 8 and confirmed-benign respectively). `emergencyResetAllVotes` (Finding 3) and `setUtility`/`setBoostManager` (Finding 4) are the highest-leverage owner-only levers.

**Threat rows addressed**: cross-contract trust propagation → Finding 5; owner-emergency + timing interaction → Finding 3; permissionless arbitrary-target griefing → Finding 8 (refuted); capacity/invariant bypass by an ordinary user → Finding 1; anti-flash-loan bypass → Finding 2; arbitrary bribe-token risk → Findings 6–7.

---

> ⚠️ This review was performed by an AI-driven three-phase audit pipeline (context mapping → breadth checklist review → depth attacker-mindset review → hybrid reconciliation). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human security review, a public bug bounty program, and on-chain monitoring are strongly recommended, particularly given Finding 1 (capacity double-use) and Finding 3 (bribe-stranding) involve subtle cross-contract invariant interactions that a purely mechanical or single-pass review would likely miss — as this audit's own single-pass context phase in fact did.
