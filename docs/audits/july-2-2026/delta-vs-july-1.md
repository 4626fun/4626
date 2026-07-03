# Delta vs July 1, 2026 Audit

- **Report ID:** 4626-FABLE-2026-07-FINAL
- **Method:** Every July 1 High (H-01…H-07) and every July 1 Partial Medium (M-12, M-14, M-15, M-17) re-read at the fixed code on `main` @ `b221a3a41` and graded. Grades: **VERIFIED FIXED** (fix present and correct at cited lines), **PARTIAL** (code fix present, operational follow-up outstanding), **REGRESSED** (fix reverted/broken), **REFUTED** (original finding not reproducible), **ALREADY-KNOWN** (previously tracked, re-confirmed).

---

## July 1 Highs — re-verification

| ID | Grade | Evidence (file:line) |
|----|-------|----------------------|
| H-01 — `report()` treats full NAV as profit when baseline zero but shares remain | **VERIFIED FIXED** | `contracts/vault/modules/CreatorOVaultCoreModule.sol:745-751` — `if (previousTotalAssets == 0 && _totalSupply > 0) { … return (0,0); }` resets baseline with zero profit. Principal inflow additive via `_increaseReportBaselineForPrincipalInflow` (`:896-898`), used on deposit/mint/injectCapital (`:354`, `:400`, `:929`). |
| H-02 — Owner cherry-picks deferred VRF while paused | **VERIFIED FIXED** | `contracts/utilities/lottery/CreatorLotteryManager.sol:863-868` defers into FIFO `_deferredVrfRequestIds`; admin `unpause()` (`:2564-2573`) flushes in order via `applyDeferredVrf`; `processPendingVrfResult` removed (grep: none). See net-new M2-07 (unbounded queue OOG). |
| H-03 — Emergency vote reset → stale bribe over-claim | **VERIFIED FIXED** | `contracts/governance/VaultGaugeVoting.sol:434-437` — `getUserVoteWeightAtEpoch` returns 0 when `_userVoteGeneration[epoch][user] != _epochResetGeneration[epoch]`; generation bumped on reset (`:503`), stamped on vote (`:266-267`). |
| H-04 — `getPastVotes` / clock unit mismatch | **VERIFIED FIXED** | `contracts/governance/ve4626.sol:527` timestamp `clock()`, `:531` `CLOCK_MODE`, `:537` `getPastVotes`; per-user `LockCheckpoint[]` (`:112-117`) written on all mutations (`:192,230,267,290`); `votingPowerAt` (`:377`) resolves historical lock. |
| H-05 — Permissionless `CreatorLinearVesting.seed()` griefing | **VERIFIED FIXED** | `contracts/utilities/vesting/CreatorLinearVesting.sol:38` immutable `seeder`; `seed()` (`:57-64`) reverts `NotSeeder`/`AlreadySeeded`. Batcher seeds atomically after funding (`DeploymentBatcher.sol:1119-1132`). |
| H-06 — Remote `MSG_TYPE_LOTTERY_ENTRY` not handled on hub ShareOFT | **VERIFIED FIXED** | `contracts/utilities/lottery/CreatorLotteryManager.sol:833-840` `receiveRemoteLotteryEntry` requires `authorizedHubShareOftForwarders[msg.sender]`; owner-gated setter (`:2576-2579`); hub ShareOFT forwards (`CreatorShareOFT.sol:893-897`). |
| H-07 — `PayoutRouter.emergencyWithdraw` drains routed revenue | **PARTIAL (unchanged)** | `contracts/utilities/routers/PayoutRouter.sol:306-319` reverts `ProtectedPayoutAsset` for `creatorCoin`/`shareOFT`. **Remaining:** owner still an EOA at deploy; `verifyPayoutRouterProductionReadiness()` exists but is **not wired into deploy** (new finding M2-03) — enforcement is operational only. Transfer owner to multisig before traffic. |

**Summary:** H-01…H-06 VERIFIED FIXED; H-07 PARTIAL (code correct, operational owner-transfer + un-wired production gate outstanding). No regressions among the Highs.

---

## July 1 Partial Mediums — re-verification

| ID | Grade | Evidence / remaining |
|----|-------|----------------------|
| M-12 — Stuck tokens in composer / hub pending fees | **PARTIAL (unchanged)** | `OVaultHubComposer.sol:141-148` `composeRescueEnabled` + `composeReservedBalances` guard rescue. Remaining: full liability ledger before rescue. No regression. |
| M-14 — `sweepStaleEpochRewards` centralization | **PARTIAL (unchanged)** | `VoterRewardsDistributor.sol` emits `StaleEpochSwept` with `graceEpochs`; governance timelock still operational-only. |
| M-15 — Boost timelock not armed by default | **PARTIAL (unchanged)** | `armBoostSourceTimelock()` (`CreatorLotteryManager.sol:2322`) present; `verifyLotteryProductionReadiness()` exists but **not wired into deploy** (M2-03). Must arm before traffic. |
| M-17 — Registry factories / hot-swappable modules codehash pins | **PARTIAL (worsened detail)** | Hot-swap setters validate (`DeploymentBatcher.sol:2290-2316`), but **initial `wireDeploymentHelpers` skips codehash validation** (new low L2-02, `:2274-2284`). Seed allowlist + validate on wire. |

---

## Also re-confirmed fixed (spot-checked)

- **M-01** `CreatorGaugeController.sol:275,1111-1115` `JackpotReserveProtected` on emergencyWithdraw. **VERIFIED FIXED.**
- **M-02** `CreatorGaugeController.sol:734-739` `payJackpot` fail-closed (`shares > jackpotReserve → InsufficientJackpot`). **VERIFIED FIXED.**
- **M-09** `CreatorGaugeController.sol:687-709` `notifyRewards` try/catch → treasury → jackpot fallback. **VERIFIED FIXED.**
- **L-01** `CreatorGaugeController.sol:788` `setLotteryManager` zero-check. **VERIFIED FIXED.**

---

## Regressions & new issues since July 1

### Test / gate regressions (new)

| Item | Grade | Detail |
|------|-------|--------|
| `pnpm -C frontend test` (30 fails) | **REGRESSED** vs documented "all passing" | Vitest `@4626/server-core` mock drift (rate-limit config) + deploy-session mock/handler drift after v1.15.0 refactor. New finding **H2-01**. |
| `pnpm -C kpr typecheck` (exit 2) | **REGRESSED** vs documented "clean baseline" | `keepr-solana-winner-relay.action.ts:227` `log.args` type error from uncommitted chunked-getLogs edit. New finding **H2-02**. |

### DeploymentBatcher reset-path test failures (4) — re-graded

- **Grade: ALREADY-KNOWN → root-caused as TEST-ONLY (not a contract bug).**
- July 1 remediation labeled these "pre-existing / claimed unrelated." This audit confirms the mechanism: the test hardcodes storage slots `PHASE1_SPLIT_STATES_SLOT = 6` and `PENDING_AUCTIONS_SLOT = 4` (`test/DeploymentBatcher.ThreeWaySplit.t.sol:65-66`), but `forge inspect DeploymentBatcher storage-layout` shows the actual slots are **7** (`phase1SplitStates`) and **5** (`pendingAuctions`) — shifted by the v1.15.0 additions (`approvedPhaseModuleCodehashes`, `vaultRolePolicyManager`/`Id`, `vaultAdminModule`).
- The `vm.store` pokes never hit the real mapping entries, so `resetPhase1State` correctly reverts `Phase1StateNotStuck` on genuinely-empty state. **The on-chain reset logic (`DeploymentBatcher.sol:2350-2359`) is coherent and fail-closed.**
- **Action:** update the two slot constants to 7/5 (or replace `vm.store` with real phase-1 deploy helpers). Test-only; not a launch blocker for contract safety, but it keeps `forge test` RED.

### SeedCreatorRegistry test failure (1) — new

- **Grade: NEW (test staleness / cutover-consistency signal).**
- `test/SeedCreatorRegistry.Config.t.sol:34-37` pins legacy v1.14.x addresses (`LIVE_VAULT_BATCHER = 0x660B251F…61c1`, registry `0xDD7B106a…`, factory `0xf4a4d70D…`, act-batcher `0x5EaFfa41…`). The seed harness now returns the v1.15.0 batcher `0x17163e67…6D33`, so `testSeedScriptAuthorizesLiveFactoryAndBatchers` fails on the batcher assertion.
- Note: the `creatorFactory` assertion passes against the **old** factory `0xf4a4d70D…`, i.e. the seed defaults appear **partially** migrated (batcher cut to v1.15.0, factory constant not). Reconcile the seed script/test constants against the v1.15.0 handoff (`CREATOR_FACTORY=0x26b74b1d…`, `CREATOR_REGISTRY=0x1eb9A364…`, `VAULT_ACTIVATION_BATCHER=0xB06d99c8…`) before seeding the live registry.

### New contract/frontend/Solana/ops findings

All net-new findings are catalogued in [audit-report.md](./audit-report.md): 1 Critical (C-01 Solana hook forgery), 6 High (incl. the two RED gates, deploy-status mutation, and the settled-truth doors), 14 Medium, 12 Low, 6 Informational. None is a regression of a July 1 **High/Medium** contract fix; the contract cutover introduced only operational/test debt (M2-07 unpause OOG edge, L2-01/L2-02/L2-03) rather than a permissionless exploit.
