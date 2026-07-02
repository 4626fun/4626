# Remediation Tracker — July 1, 2026 Audit

Maps each audit finding to fix status. **Fixed** = merged in this pass; **Partial** = mitigated but follow-up recommended; **Deferred** = operational / design / test-only.

---

## High

| ID | Title | Status | Fix |
|----|-------|--------|-----|
| H-01 | `report()` treats full NAV as profit when baseline is zero but shares remain | **Fixed** | `CreatorOVaultCoreModule.sol` — reset baseline with zero profit when `previousTotalAssets == 0 && _totalSupply > 0` |
| H-02 | Owner can cherry-pick deferred VRF outcomes while paused | **Fixed** | Admin-module `unpause()` FIFO-flushes via `applyDeferredVrf()`; `processPendingVrfResult` removed |
| H-03 | Emergency vote reset → stale bribe over-claim | **Fixed** | `VaultGaugeVoting.sol` — `getUserVoteWeightAtEpoch` returns 0 when vote generation ≠ epoch reset generation |
| H-04 | `getPastVotes` / clock unit mismatch | **Fixed** | `ve4626.sol` — timestamp `clock()` + per-user lock checkpoints; `getPastVotes` / `votingPowerAt` binary-search historical lock amount/end |
| H-05 | Permissionless `CreatorLinearVesting.seed()` griefing | **Fixed** | `CreatorLinearVesting.sol` — `seeder` immutable; `DeploymentBatcher.sol` — atomic `seed()` after funding |
| H-06 | Remote `MSG_TYPE_LOTTERY_ENTRY` not handled on hub ShareOFT | **Fixed** | `CreatorShareOFT.sol` — forward to `receiveRemoteLotteryEntry`; `CreatorLotteryManager.sol` — hub forwarder allowlist |
| H-07 | `PayoutRouter.emergencyWithdraw` drains routed revenue | **Partial** | `PayoutRouter.sol` — blocks withdraw of `creatorCoin` / `shareOFT`. Ops gate: `verifyPayoutRouterProductionReadiness()` (`frontend/server/_lib/onchain/payoutRouterProductionReadiness.ts`) flags EOA owners. **Remaining:** transfer production owner to multisig/timelock |

---

## Medium

| ID | Title | Status | Fix |
|----|-------|--------|-----|
| M-01 | Gauge `emergencyWithdraw` bypasses jackpot custody | **Fixed** | `CreatorGaugeController.sol` — `JackpotReserveProtected` when `jackpotReserve > 0` |
| M-02 | Concurrent lottery wins over-commit reserve | **Fixed** | `CreatorLotteryManager.sol` sizes payouts via `availableJackpotReserve()`; `CreatorGaugeController.payJackpot()` fail-closed on insufficient `jackpotReserve` |
| M-03 | `injectCapital` skips report baseline | **Fixed** | `CreatorOVaultCoreModule.sol` — `_increaseReportBaselineForPrincipalInflow(amount)` |
| M-04 | Operator bitmask never enforced | **Fixed** | `CreatorOVaultCoreModule.sol` — `_enforceOperatorPermIfGranted()` on deposit/mint/withdraw/redeem/queue/injectCapital |
| M-05 | `maxWithdraw` overstates strategy-bound liquidity | **Fixed** | `CreatorOVaultLiquidityLib.maxInstantWithdrawAssets()` caps `maxWithdraw` / `maxRedeem` |
| M-06 | Impairment Suspect mode allows queued claims | **Fixed** | `CreatorOVaultCoreModule.sol` — `claimQueuedWithdrawal` requires `vaultMode == Normal` |
| M-07 | No Base sequencer uptime check on oracle | **Fixed** | `CreatorOracle.sol` — optional `sequencerUptimeFeed` + `_sequencerIsUp()` guards on ETH price / TWAP paths |
| M-08 | Auto TWAP omits `answeredInRound` | **Fixed** | `CreatorOracle.sol` — `_updatePriceFromTWAP()` guard added |
| M-09 | `notifyRewards` failure bricks fee distribution | **Fixed** | `CreatorGaugeController.sol` — try/catch with treasury/jackpot fallback |
| M-10 | Zero mesh peers disable compose auth | **Fixed** | `OVaultHubComposer.sol` — require non-zero peers at configure + validate on compose |
| M-11 | Solana relay marks tx consumed before success | **Fixed** | `SolanaBridgeAdapter.sol` — mark `processedSolanaTxs` only after successful lottery call |
| M-12 | Stuck tokens in composer / hub pending fees | **Partial** | `OVaultHubComposer.sol` — `composeRescueEnabled`, `composeReservedBalances`, guarded `rescueERC20`. **Remaining:** full liability ledger before rescue |
| M-13 | Remote Solana NAV vs Base withdraw | **Not applicable** | ShareOFT mesh at finalize; no Phase-3 Solana vault strategy |
| M-14 | `sweepStaleEpochRewards` centralization | **Partial** | `VoterRewardsDistributor.sol` — `StaleEpochSwept` event includes `graceEpochs`; NatSpec documents grace window. **Remaining:** governance timelock (operational) |
| M-15 | Boost timelock not armed by default | **Partial** | Ops gate: `verifyLotteryProductionReadiness()` + post-deploy `armBoostSourceTimelock()` before traffic |
| M-16 | Activation batcher missing registry validation | **Fixed** | `VaultActivationBatcher.sol` — `_validateRegistryRouting()` in `_executeActivateAndLaunch` (all 6 entrypoints) |
| M-17 | Registry factories / hot-swappable modules | **Partial** | `DeploymentBatcher.sol` — optional `approvedPhaseModuleCodehashes`; `CreatorRegistry.sol` — optional `approvedFactoryCodehashes`. **Remaining:** seed allowlists at deploy (operational) |
| M-18 | `ERC4626StrategyAdapter` silent deposit failure | **Fixed** | Revert `InnerDepositFailed` when inner 4626 deposit fails |

---

## Low (selected fixes)

| ID | Title | Status | Fix |
|----|-------|--------|-----|
| L-01 | `setLotteryManager(0)` bricks payouts | **Fixed** | `CreatorGaugeController.sol` — zero-address check |
| L-02 | Bribe claim marks `claimed` on zero payout | **Fixed** | `BribeDepot.sol` — revert when `amount == 0 && userWeight > 0` |
| L-03 | Lottery `_lzReceive` missing `nonReentrant` | **Deferred** | Omitted to preserve EIP-170 headroom (24,568 B); low compose reentrancy risk |
| L-04 | Exact fee only on lottery submit | **Fixed** | `CreatorShareOFT.sol` — refund overpay on `submitPendingLotteryEntry` |
| L-05 | `impairmentGuardian` unused | **Fixed** | `CreatorOVault.sol` — `impairmentGuardian` added to `onlyEmergencyAuthorized` |
| L-06 | `CCALaunchStrategy.setFeeRecipient` repointable | **Fixed** | `CCALaunchStrategyConfigModule.sol` — `lockFeeRecipient()` after first launch |
| L-07 | `extendLock` on expired locks | **Fixed** | `ve4626.sol` — NatSpec documents intentional revive behavior |

---

## Informational / Gas

Documented in [audit-report.md](./audit-report.md). No code changes required unless noted in product backlog (modulo bias, default `usdMultiplierBps`, dead constants, unbounded view loops).

---

## Post-deploy checklist (required for H-06)

After hub ShareOFT deploy / upgrade:

1. Call `CreatorLotteryManager.setAuthorizedHubShareOftForwarder(hubShareOFT, true)` for each hub ShareOFT that receives remote lottery entries.
2. Confirm remote chains still peer to hub ShareOFT (unchanged wiring).
3. End-to-end test: remote `submitPendingLotteryEntry` → hub lottery VRF request.
4. Smoke: pause → defer VRF callback → `unpause()` → verify FIFO settlement (no manual per-request processing).

### Before enabling production lottery traffic

5. Call `armBoostSourceTimelock()` on the lottery manager (**M-15**).
6. Confirm `PayoutRouter` owner is multisig/timelock, not a hot EOA (**H-07**). Run `verifyPayoutRouterProductionReadiness()`.
7. Run `verifyLotteryProductionReadiness()` (`frontend/server/_lib/lottery/lotteryProductionReadiness.ts`) with required hub ShareOFT addresses — must report zero critical violations.

### M-17 — module / factory codehash pins (ops)

After deploying audited module or factory bytecode, call `approvePhaseModuleCodehash(module, codehash)` on the batcher and/or `approveFactoryCodehash(factory, codehash)` on `CreatorRegistry` before authorizing hot swaps.

### ABI note (2026-07-02 size trim)

- **`getGlobalStats()` removed** — indexers and API clients should read public `totalLotteryEntries`, `totalWinners`, `totalRewardsPaid`.
- **`processPendingVrfResult()` removed** — deferred VRF is flushed automatically on `unpause()`.

---

## Recommended tests to add

```bash
forge test --match-contract CreatorOVaultReportTest
forge test --match-contract CreatorLotteryManagerPauseGuardsTest
forge test --match-contract BribesTest
forge test --match-contract CreatorLinearVestingSeedAuthTest
forge test --match-contract CreatorShareOFTRemoteLotteryFundingTest
forge test --match-contract VaultActivationBatcherRegistryValidationTest
forge test --match-contract Ve4626PastVotesCheckpointsTest
forge test --match-contract CreatorGaugeControllerJackpotReservationTest
forge test --match-contract CreatorOVaultOperatorAndMaxWithdrawTest
forge test --match-contract CreatorOracleSequencerFeedTest
forge test --match-contract CreatorLotteryManagerSizeLimitTest
pnpm -C frontend exec vitest run server/_lib/onchain/payoutRouterProductionReadiness.test.ts
```

**Status (2026-07-02):** New audit regression suites above pass. `CreatorLotteryManager` runtime **24,568 B** (8 B under EIP-170). Full `forge test`: **1067 passed, 4 failed, 1 skipped** — failures are pre-existing in `DeploymentBatcherThreeWaySplitTest` (`Phase1StateNotStuck` reset-path tests, unrelated to this audit pass).

Suggested cases (implemented):

- `report()` with `totalAssetsAtLastReport == 0`, `_totalSupply > 0` → zero profit, baseline reset
- `emergencyResetAllVotes` → stale voter cannot claim until re-vote restores generation
- Pause → multiple VRF deferrals → `unpause()` settles all FIFO
- Remote `submitPendingLotteryEntry` accepts native overpay (exact underpay still reverts)
- Permissionless `seed()` reverts; seeder `seed()` succeeds after transfer
- Gauge second `payJackpot` reverts when reserve exhausted (M-02)
- Operator with deposit-only grant cannot withdraw (M-04)
- `maxWithdraw` capped below total assets when idle reserve is low (M-05)
- Sequencer feed down/stale → `getEthPrice()` returns zero (M-07)

## Deploy blocker (post-audit)

| Item | Detail |
|------|--------|
| ~~`CreatorLotteryManager` runtime size~~ | **Resolved 2026-07-02** — 24,568 B (8 B under EIP-170). M-02 uses `availableJackpotReserve()` + fail-closed `payJackpot` without separate reserve calls (size-safe). |
