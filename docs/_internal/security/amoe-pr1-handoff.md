# AMOE Linear Parity — PR 1 Audit Handoff

**Status:** Audit-blocking. PR 1 of the multi-PR AMOE Linear Parity rollout (Option B2).
**Scope:** `contracts/utilities/lottery/CreatorLotteryManager.sol` only.
**Companion contracts that DO NOT change in PR 1:** `LotteryAmoeRouter.sol`, `ILotteryAmoeConsumer` interface, all zkMetal circuit code.

---

## TL;DR

PR 1 does three things to the audited `CreatorLotteryManager.sol`:

1. **Linearizes the pre-boost win-chance formula.** The audited formula scaled
   `baseWinChance → maxWinChance` over $1 → $10K with `FullMath.mulDiv`. The new
   formula is a simple linear: `winChancePPM = swapValueUSD / 250_000`, capped
   at a new field `baseCeilingPPM`. The legacy `lotteryConfig.baseWinChance`
   slot is **retained** for storage layout / ABI parity but is no longer read.
2. **Adds an Alternative Method Of Entry (AMOE) path.** A new external
   function `processAmoeEntry(buyer, creatorCoin, pointsBurnedAsUSD)` is gated
   by a single-address allowlist (`authorizedAmoeRelayer`). It mirrors
   `processSwapLottery`'s boost flow exactly — same `_applyBoost`, same VRF
   dispatch, same cap behavior — so AMOE entries get full ve4626 personal +
   vault gauge boost parity (Option B2).
3. **Adds two admin setters and one invariant.** `setAuthorizedAmoeRelayer` and
   `setBaseCeilingPPM`, plus a guard in `setLotteryConfig` that rejects any
   `_maxWinChance < baseCeilingPPM` to keep the post-boost cap ≥ pre-boost
   ceiling.

---

## Trust assumptions (PR 1)

PR 1 trusts the off-chain `authorizedAmoeRelayer` key for two things:

1. **Points-to-USD conversion.** The relayer computes
   `pointsBurnedAsUSD = burnedPoints / 100` (1 point = 1 cent / $0.01) before
   calling the contract.
2. **Eligibility filtering.** The relayer enforces the AMOE eligibility view
   (excludes `has_creator_coin` and `referral_*` action families per Option B2
   server-side bifurcation merged in PR 0 / PR #394).

**This is intentional and limited to PR 1.** PR 4 (deferred) will move the
points-to-USD trust into a zkMetal Groth16 circuit by binding `pointsBurned`
as a public input, removing the need to trust the relayer key for that field.
The eligibility filter is expected to remain off-chain.

**Defense-in-depth:** The contract still enforces
`pointsBurnedAsUSD >= lotteryConfig.minSwapAmount` on-chain so a relayer key
compromise cannot create dust entries that bypass the floor.

**Failure mode if relayer key compromised:**

- Attacker can mint AMOE entries up to the `baseCeilingPPM` (4% pre-boost)
  for any `pointsBurnedAsUSD` value, capped at $10K-equivalent.
- Attacker **cannot** exceed `lotteryConfig.maxWinChance` (15% absolute) per
  entry — `_applyBoost`'s cap is unchanged.
- Mitigation: `setAuthorizedAmoeRelayer(address(0))` disables AMOE entirely
  (atomic kill-switch).

---

## Storage layout

Both contracts (`CreatorLotteryManager` and `CreatorLotteryManagerAdminModule`)
share a delegatecall-driven storage layout. The audited storage was identical
slot-for-slot. PR 1 appends two new fields **at the end** of both contracts in
the same order:

```
slot N+0   uint256 baseCeilingPPM       (default 40_000)
slot N+1   address authorizedAmoeRelayer (default address(0))
```

Both contracts have an explicit comment block (`// STATE — AMOE LINEAR PARITY`)
demarcating the new tail. Any future state must be appended after these and
mirrored in both contracts.

The `_self` immutable in the AdminModule appears AFTER the new state vars in
the source, but immutables consume no storage slots, so the layout invariant
is preserved.

---

## Linearization (semantic change)

| Swap value | Old PPM (before boost)        | New PPM (before boost) |
|------------|-------------------------------|------------------------|
| $1         | `baseWinChance` = 40 (0.004%) | 4 (0.0004%)            |
| $10        | ~149                          | 40 (0.004%)            |
| $100       | ~1_540                        | 400 (0.04%)            |
| $1_000     | ~15_026                       | 4_000 (0.4%)           |
| $10_000    | `maxWinChance` = 150_000 (15%) | `baseCeilingPPM` = 40_000 (4%) |
| $100_000   | (capped) 150_000              | (capped) 40_000        |

**Important:** the old `maxWinChance` (150_000) was both the post-boost cap
**and** what `calculateWinChance` returned at saturation. The new formula
reaches only 40_000 PPM (4%) at saturation, leaving the 40_000 → 150_000
range entirely as ve4626 / vault-gauge boost headroom. This matches the
locked spec ("base ceiling = 4%, absolute cap = 15% with boosts").

**At-or-below `minSwapAmount`** the new formula returns 0 (was: returned
`baseWinChance`). This is a deliberate tightening — the floor was previously
also the minimum entry, so `processSwapLottery` rejected sub-floor swaps
before reaching `calculateWinChance`. Behavior at the call-site is unchanged.

---

## Boost flow (unchanged — verified)

The `_applyBoost` function is **bytecode-identical** to the audited version.
Both `processSwapLottery` and `processAmoeEntry` call a new internal helper
`_boostAndDispatchVRF` that wraps the audited boost + VRF dispatch logic. The
helper was extracted purely to keep the contract under EIP-170 (24,576 bytes)
without duplicating ~30 lines across the two entry paths. See the size-gate
section below.

The post-boost cap is enforced inside `_applyBoost` as before:

```
if (boostedWinChance > lotteryConfig.maxWinChance) {
    boostedWinChance = lotteryConfig.maxWinChance;
}
```

---

## Admin invariants

`setLotteryConfig` now rejects `_maxWinChance < baseCeilingPPM` (when
`baseCeilingPPM > 0`). This prevents an admin error from inverting the
relationship `pre-boost ceiling ≤ post-boost cap`.

`setBaseCeilingPPM` enforces:

- `_ceilingPPM > 0` (zero would brick `processSwapLottery` and
  `processAmoeEntry`)
- `_ceilingPPM ≤ lotteryConfig.maxWinChance`
- `_ceilingPPM ≤ 100_000` (10% — hard sanity cap; any future raise requires
  an explicit re-audit)

`setAuthorizedAmoeRelayer` permits `address(0)` as a kill-switch.

---

## Re-entrancy and pause

`processAmoeEntry` carries the same modifiers as `processSwapLottery`:

- `nonReentrant` (from the audited `ReentrancyGuard`)
- `whenNotPaused` (from the audited `Pausable`)

There is no payable surface on AMOE — the function does not accept ETH and
the cross-chain VRF path receives `callerFeeValue = 0`, so any non-zero
sponsorship is drawn from the existing `vrfSponsorshipPolicy` budget, which is
unchanged.

---

## EIP-170 size gate

The audited contract was 24,576 bytes runtime — at the EIP-170 limit. PR 1
adds ~250 bytes of new logic (AMOE function + setters + state reads). To stay
under the gate enforced in `.github/workflows/test.yml`:

- The `_boostAndDispatchVRF` helper was extracted (saves ~430 bytes by
  deduplicating boost + VRF dispatch across the two entry paths).
- A separate `AmoeEntryRecorded` event was deliberately not added; AMOE
  entries emit the existing `LotteryEntryCreated` event with identical
  shape. Off-chain indexers can disambiguate by tracking
  `authorizedAmoeRelayer` calls (PR 4 will add an AMOE-specific event once
  zkMetal binding lands and we have headroom).

Final size: **24,367 bytes (209 bytes under EIP-170)**.

---

## Test coverage (PR 1)

`test/CreatorLotteryManager.AmoeLinearParity.t.sol` adds 27 tests:

- Linear odds boundaries: $1 → 4 PPM, $10 → 40, $100 → 400, $1K → 4_000,
  $10K → 40_000, >$10K saturated.
- Floor: `< minSwapAmount` returns 0.
- `setBaseCeilingPPM` rejects 0, > maxWinChance, > 100_000 sanity cap.
- `processAmoeEntry`: relayer-only, reverts on zero buyer/creator/points,
  silent-skip on inactive creator and below floor, happy path creates entry.
- Boost parity: AMOE and paid path produce **identical** boosted PPM at
  saturated USD value with same buyer + vault + boost configuration.
- Absolute cap: gauge boost + 5x personal boost capped at 150_000 PPM.
- `setLotteryConfig`: rejects `_maxWinChance < baseCeilingPPM`.

All 27 PR 1 tests + all 30 pre-existing CreatorLotteryManager tests pass
(6 in PauseGuards updated to assert the new linear constants).

---

## Out of scope for PR 1

- `LotteryAmoeRouter.sol`: untouched. Existing ECDSA + zkMetal submission
  paths continue to call the optional `consumer.recordAmoeEntry` fan-out for
  off-chain accounting only. No on-chain wiring to `processAmoeEntry`
  yet — the relayer calls `processAmoeEntry` directly in PR 2.
- `ILotteryAmoeConsumer` interface: untouched.
- Server-side variable points amount + frontend "Free entries available" UI:
  PR 2.
- zkMetal-bound `pointsBurned`: PR 4.

---

## Sweepstakes counsel review

Per the carry-forward note from PR 0: sweepstakes counsel review is still
required before mainnet. Topics that need sign-off:

- AMOE boost parity defense (ve4626 = parallel product, not extra paid odds)
- State registration thresholds (FL/NY/RI for >$5K prize)
- Official Rules text (free entry method, odds disclosure, no purchase
  necessary statement, void-where-prohibited)

PR 1 does not block legal review — it ships the on-chain primitive that
parity-claim depends on, but mainnet activation gates on counsel approval
and the eventual `setAuthorizedAmoeRelayer(<approved-relayer>)` admin call.

---

## Post-deploy migration (mainnet)

1. Deploy upgraded `CreatorLotteryManager` (storage-layout-compatible).
2. Owner calls `setBaseCeilingPPM(40_000)` — this is the default in the
   constructor for fresh deploys but must be set explicitly on upgrades.
3. Owner verifies `lotteryConfig.maxWinChance == 150_000` (unchanged from
   audited config).
4. **Relayer remains `address(0)` until counsel sign-off.** AMOE entries
   revert with `Unauthorized` until the relayer is set.
5. After counsel sign-off: `setAuthorizedAmoeRelayer(<deployed-relayer>)`.
6. Server PR 2 (`lotteryAmoe.ts` + `_amoeSubmit.ts`) ships variable points
   amount and on-chain submission.
7. Frontend PR 2 ships the "Free entries available" UI.

---

## Diff summary

| File                                                   | Lines added | Lines removed |
|--------------------------------------------------------|-------------|---------------|
| `contracts/utilities/lottery/CreatorLotteryManager.sol`| ~190        | ~25           |
| `test/CreatorLotteryManager.AmoeLinearParity.t.sol`    | ~420        | 0             |
| `test/CreatorLotteryManager.PauseGuards.t.sol`         | ~12         | ~6            |
| `docs/security/amoe-pr1-handoff.md` (this file)        | new         | —             |

No changes to `LotteryAmoeRouter.sol`, `ILotteryAmoeConsumer`, server,
frontend, or zk circuits in PR 1.
