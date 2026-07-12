# ve4626 / LotteryManager4626 residual audit

Date: 2026-07-11  
Scope: source, tests, deployment tooling, and operating docs only. No live write was authorized or performed.

## Launch verdict

**Safe to keep boost unwired for main launch: YES.**

Live Base `LotteryManager4626` remains `0xB68F359e01626Ec5d15C624037311C70DacAba43` with:

- `boostManager() == address(0)`
- `vaultGaugeVoting() == address(0)`
- `singleVaultJackpotOnly() == true`
- `deferredVrfQueueLength() == 0`
- runtime codehash `0xd91321d7d9621cf6a65cdd68ab933383049cc270d9f8334256bb89d393652f9d`

The one-way boost-source timelock remains unarmed. Solana `relay_entries` remains disabled by launch policy.

## Findings

| ID | Severity | Status | Surface | Live impact now | Finding / disposition |
|---|---|---|---|---|---|
| VLR-01 | P1 | Fixed | `ve4626BoostManager.sol:145` | None; source is unwired | `lastBalanceUpdateBlock == 0` previously passed the hold gate once chain height exceeded `MIN_HOLDING_BLOCKS`. Eligibility now requires a non-zero checkpoint and the full block delay. |
| VLR-02 | P1 | Fixed | `ve4626BoostManager.sol:264` | None; source is unwired | Raw `veLotteryToken` / raw ve fallback could bypass the rights split or retain stale power. Personal boost now requires `ve4626Utility.effectiveVeLotteryOf`; `Ve` remains live `getTotalVotingPower()`. |
| VLR-03 | P1 | Fixed | `ve4626GaugeVoting.sol:252` | None; gauge is unwired | Missing utility previously fell back to raw ve33 or projected ve power. `vote()` now fails closed unless utility is configured. |
| VLR-04 | P1 | Fixed | `deployPhase2Invariants.ts:422` | Could block main-launch vault finalize | Deploy Phase 2 incorrectly required the one-way boost timelock to be armed. The caller now explicitly permits the intentional boost-off/unarmed launch mode; boost-enabled readiness keeps the helper's strict default. |
| VLR-05 | P0 | Fixed | legacy `script/*.s.sol` | Operator-only; dangerous if broadcast | Old CREATE2, operational wiring, CoreInfra V2, and Tier1 scripts retained wrong registry/LM epochs. They now revert before reading a key or starting broadcast. |
| VLR-06 | P1 | Fixed | `DeployRewardsEcosystem.s.sol` | Phase-2 rewards only | Defaults pointed to v1.14.1 and deployment directly activated LM sources. Defaults now target v1.18.0 and the script deploys/internal-wires only; LM activation is a separate change window. |
| VLR-07 | P1 | Fixed | V1180 post-broadcast/Vercel sync | Operator-only | Default LM was the superseded `0xbE87…`; active defaults now use `0xB68F…`, and `CREATOR_LOTTERY_MANAGER` is removed from active sync. |
| VLR-08 | P2 | Fixed | canary/governance docs | None | Phase 3 docs applied raw boost to the whole trade and used `veChance`. They now show the D3 coverage blend, `veLottery`, and feasible arm/propose/wait/commit ordering. |
| VLR-09 | P2 | Fixed | Forge tests | None | Added exact nested-floor, untracked hold, missing utility, boost-off, revert fallback, oracle post-window, disabled guard, and two-vault gauge-budget assertions. |
| VLR-10 | P2 | Open | live source publication | None identified | Repository deployment provenance and read-only live state identify the remediation deployment. Independent explorer bytecode verification could not be completed because BaseScan rejected free API access and Blockscout reports the source as unverified. Publish/verify source before Phase-3 activation. |
| VLR-11 | P3 | Open | governance interfaces | None | Several local `Ive4626` interfaces remain duplicated. Consolidation is deferred because it is not needed to close boost correctness and would broaden this fix. |
| VLR-12 | Deferred | v2 | definition of `l` | None | v1 keeps `l = min(covered creator Share USD, swap USD)`. True Curve/Hermes proportion matching needs user-attributable in-range CREATOR/ETH CL liquidity and is not silently substituted here. |

## Audit checklist answers

1. **Math fidelity:** Yes. `tokenlessWorking = floor(0.4*l)`, then `floor(floor(0.6*L)*ve/Ve)`, cap `working` at `l`, and divide by `tokenlessWorking`.
2. **Edges:** `l==0`, `tokenlessWorking==0`, `Ve==0`, `ve==0`, no coverage, full coverage, and ve-share ≥ LP-share are behavior-tested.
3. **Covered floor:** No covered path returns below `10_000` BPS. `baseBoost != 10_000` is rejected.
4. **Ratio terminology:** Active source/docs distinguish `working/l` from `working/(0.4*l)`.
5. **LM blend:** Yes. `_applyBoost` computes `10_000 + floor((raw-10_000)*coverage/10_000)` and applies the absolute `maxWinChance` ceiling.
6. **Live remediation:** Read-only probes confirm the remediated LM state and codehash. The cutover script requires single-vault mode and zero boost sources. Explorer source publication remains VLR-10.
7. **Old constants/shims:** Active V1180 defaults are corrected; wrong-registry mutating scripts are fail-closed; the active `CREATOR_LOTTERY_MANAGER` sync shim is removed.
8. **Deprecated personal APIs:** LM's interface exposes only `calculateBoostForPosition`; it cannot fall back to `calculateBoost(user)` or lock-duration additive PPM.
9. **Lock asset:** `ve4626.lock` accepts immutable `wrappedShareOFT` (■4626) only.
10. **Rights split:** `veLottery` is the personal Curve lane; `ve33` is the gauge/fees/bribes lane.
11. **Inflation/double count:** Boost uses decay-safe `effectiveVeLotteryOf` over live total ve; gauge voting syncs and uses `effectiveVe33Of`. Raw fallback paths are closed.
12. **Gauge composition:** Gauge boost stays separate additive PPM, fixed at 69,420 system-wide and capped at 35,000 per vault before LM's absolute ceiling.
13. **Oracle D1:** Stale/bad/missing prices skip entry. Deviation is enforced only inside the configured window; post-window jumps are accepted. Zero max deviation or zero window disables that guard.
14. **Oracle failure policy:** Pricing failure returns zero USD and skips entry rather than reverting the lottery path.
15. **Source timelock:** Arm is one-way; propose/commit requires the arm and 24-hour delay; cancel clears pending state; emergency disable zeros both sources and pending proposals.
16. **Canary timing:** Docs require both sources zero and no arm through base-odds canary traffic.
17. **Release epoch:** Rewards, registry seed, Base deploy defaults, V1180 post-broadcast, and Vercel sync now point to v1.18.0 registry/LM/batcher truth.
18. **Regression coverage:** Concrete BPS, PPM, storage-reference, zero-access, and revert-selector assertions were added.
19. **Stale copy:** Active docs no longer teach a 0.4× penalty, 6.25× product boost, or 3.5× ve/LP requirement.
20. **Residual board:** Fixed, open, and v2-deferred items are recorded above.

## Later boost enablement checklist

Do not execute these steps during main launch.

1. Re-run all validation listed below and resolve VLR-10 by publishing/verifying source.
2. Deploy `ve4626`, `ve4626Utility`, `ve4626BoostManager`, and `ve4626GaugeVoting` with `DeployRewardsEcosystem`; verify it did not mutate LM.
3. Verify lock asset = ■4626, BoostManager utility = deployed utility, GaugeVoting utility = deployed utility, and `ve4626.boostManager` = deployed BoostManager.
4. Verify live LM still has both boost sources at zero and the source timelock is unarmed.
5. Freeze/review the final BoostManager and GaugeVoting addresses and owner controls.
6. Arm `armBoostSourceTimelock()` while both sources are still zero.
7. Propose both final source addresses. Record proposal events/effective timestamps.
8. Wait at least 24 hours; re-check codehashes, owners, utility pointers, caps, and pending addresses.
9. Commit both proposals. Confirm no pending proposal remains.
10. For pre-wiring locks, call `ve4626.checkpointBoostEligibility()` and wait all `MIN_HOLDING_BLOCKS`; lock mutations reset the clock.
11. Canary one account: no veLottery = 1.0×, partial match exact floor, full match ≤2.5×, partial coverage applies only partial uplift, gauge remains additive.
12. Keep Solana `relay_entries` disabled until its separate product/operations approval.
13. On any anomaly, call `disableBoostSources()` and verify both sources and pending proposals are zero.

## Validation record

Final successful gates:

- `forge test --match-contract LotteryManager4626` — 116 passed.
- `forge test --match-path test/ve4626BoostManager.t.sol` — 19 passed.
- `forge test --match-path test/ve4626.RightsSplitAndDualDecay.t.sol` — 25 passed.
- `forge test --match-path test/VaultGaugeVoting.t.sol` — 31 passed.
- `forge test --match-path test/RegistryDefaultScripts.t.sol` — 2 passed.
- `forge build` — exit 0; existing repository lint warnings and two dependency-revision warnings remain.
- `pnpm -C frontend exec vitest run server/_lib/deploy/deployPhase2Invariants.test.ts server/_lib/lottery/lotteryProductionReadiness.test.ts` — 7 passed.
- `pnpm -C frontend lint` — exit 0.
- `pnpm -C frontend typecheck` — exit 0.
- `pnpm -C frontend guard:registry4626-naming` — passed after retired sync aliases were removed.
- `bash test/current-release-target-guard.sh` — passed.
- `pnpm -C frontend ops:verify-lottery-canary-phase0` — boost/gauge zero, timelock unarmed, oracle guards correct, Solana relay `0`, blocker `null`.

Honest failed/intermediate gates:

- Initial boost/rights/gauge/Curve targeted runs failed while new fail-closed behavior and exact nested-floor expectation were being added; final reruns above pass.
- One combined Forge command failed with exit 2 because this Forge version does not permit repeated `--match-path`; each path was rerun separately and passed.
- The first naming-guard run failed on active retired aliases in `sync-v1180-vercel-env.sh` plus literal retired names in learned facts; both were corrected and the final guard passes.
- `forge verify-bytecode` could not independently match live source: BaseScan rejected free API access, and Base Blockscout reports the source as unverified. This is tracked as VLR-10, not reported as a passing gate.
