# Remediation Tracker — July 1, 2026 Audit

Maps each audit finding to fix status. **Fixed** = merged in this pass; **Partial** = mitigated but follow-up recommended; **Deferred** = operational / design / test-only.

---

## High

| ID | Title | Status | Fix |
|----|-------|--------|-----|
| H-01 | `report()` treats full NAV as profit when baseline is zero but shares remain | **Fixed** | `CreatorOVaultCoreModule.sol` — reset baseline with zero profit when `previousTotalAssets == 0 && _totalSupply > 0` |
| H-02 | Owner can cherry-pick deferred VRF outcomes while paused | **Fixed** | `CreatorLotteryManager.sol` — `_deferredVrfRequestIds` queue; `unpause()` calls `_processAllDeferredVrfResults()` FIFO |
| H-03 | Emergency vote reset → stale bribe over-claim | **Fixed** | `VaultGaugeVoting.sol` — `getUserVoteWeightAtEpoch` returns 0 when vote generation ≠ epoch reset generation |
| H-04 | `getPastVotes` / clock unit mismatch | **Partial** | `ve4626.sol` — `clock()` / `CLOCK_MODE()` set to timestamp mode. **Remaining:** historical lock checkpoints (still reads current lock state at past timepoint) |
| H-05 | Permissionless `CreatorLinearVesting.seed()` griefing | **Fixed** | `CreatorLinearVesting.sol` — `seeder` immutable; `DeploymentBatcher.sol` — atomic `seed()` after funding |
| H-06 | Remote `MSG_TYPE_LOTTERY_ENTRY` not handled on hub ShareOFT | **Fixed** | `CreatorShareOFT.sol` — forward to `receiveRemoteLotteryEntry`; `CreatorLotteryManager.sol` — hub forwarder allowlist |
| H-07 | `PayoutRouter.emergencyWithdraw` drains routed revenue | **Partial** | `PayoutRouter.sol` — blocks withdraw of `creatorCoin` / `shareOFT`. **Remaining:** timelock/multisig on owner (operational) |

---

## Medium

| ID | Title | Status | Fix |
|----|-------|--------|-----|
| M-01 | Gauge `emergencyWithdraw` bypasses jackpot custody | **Fixed** | `CreatorGaugeController.sol` — `JackpotReserveProtected` when `jackpotReserve > 0` |
| M-02 | Concurrent lottery wins over-commit reserve | **Deferred** | Requires reserve-at-request or per-gauge mutex — design change; document race in ops runbook |
| M-03 | `injectCapital` skips report baseline | **Fixed** | `CreatorOVaultCoreModule.sol` — `_increaseReportBaselineForPrincipalInflow(amount)` |
| M-04 | Operator bitmask never enforced | **Deferred** | Enforce `isAuthorizedOperator` in core paths or remove dead API — product decision |
| M-05 | `maxWithdraw` overstates strategy-bound liquidity | **Deferred** | Cap by liquidity snapshot in `CreatorOVaultLiquidityLib` — ERC-4626 composability follow-up |
| M-06 | Impairment Suspect mode allows queued claims | **Fixed** | `CreatorOVaultCoreModule.sol` — `claimQueuedWithdrawal` requires `vaultMode == Normal` |
| M-07 | No Base sequencer uptime check on oracle | **Deferred** | Integrate Base sequencer feed in `CreatorOracle.sol` — needs feed address + env |
| M-08 | Auto TWAP omits `answeredInRound` | **Fixed** | `CreatorOracle.sol` — `_updatePriceFromTWAP()` guard added |
| M-09 | `notifyRewards` failure bricks fee distribution | **Fixed** | `CreatorGaugeController.sol` — try/catch with treasury/jackpot fallback |
| M-10 | Zero mesh peers disable compose auth | **Fixed** | `OVaultHubComposer.sol` — require non-zero peers at configure + validate on compose |
| M-11 | Solana relay marks tx consumed before success | **Fixed** | `SolanaBridgeAdapter.sol` — mark `processedSolanaTxs` only after successful lottery call |
| M-12 | Stuck tokens in composer / hub pending fees | **Partial** | `OVaultHubComposer.sol` — `rescueERC20`; `CreatorShareOFT.sol` — `flushPendingFeesToGauge()`. **Remaining:** liability tracking before rescue |
| M-13 | `SolanaStrategy` remote NAV vs Base withdraw | **Deferred** | Cap `remoteNav` by reconciled bridge receipts — keeper policy + tests |
| M-14 | `sweepStaleEpochRewards` centralization | **Deferred** | Document grace window; consider governance timelock (operational) |
| M-15 | Boost timelock not armed by default | **Deferred** | Deploy script must call `armBoostSourceTimelock()` before traffic |
| M-16 | Activation batcher missing registry validation | **Deferred** | Add registry checks to all `VaultActivationBatcher` entrypoints |
| M-17 | Registry factories / hot-swappable modules | **Deferred** | Timelock + codehash allowlist — operational |
| M-18 | `ERC4626StrategyAdapter` silent deposit failure | **Fixed** | Revert `InnerDepositFailed` when inner 4626 deposit fails |

---

## Low (selected fixes)

| ID | Title | Status | Fix |
|----|-------|--------|-----|
| L-01 | `setLotteryManager(0)` bricks payouts | **Fixed** | `CreatorGaugeController.sol` — zero-address check |
| L-02 | Bribe claim marks `claimed` on zero payout | **Fixed** | `BribeDepot.sol` — revert when `amount == 0 && userWeight > 0` |
| L-03 | Lottery `_lzReceive` missing `nonReentrant` | **Deferred** | Low risk; add in follow-up if compose reentrancy observed |
| L-04 | Exact fee only on lottery submit | **Fixed** | `CreatorShareOFT.sol` — refund overpay on `submitPendingLotteryEntry` |
| L-05 | `impairmentGuardian` unused | **Deferred** | Wire or remove in cleanup PR |
| L-06 | `CCALaunchStrategy.setFeeRecipient` repointable | **Deferred** | Immutabilize post-launch in follow-up |
| L-07 | `extendLock` on expired locks | **Deferred** | Document intentional revive behavior |

---

## Informational / Gas

Documented in [audit-report.md](./audit-report.md). No code changes required unless noted in product backlog (modulo bias, default `usdMultiplierBps`, dead constants, unbounded view loops).

---

## Post-deploy checklist (required for H-06)

After hub ShareOFT deploy / upgrade:

1. Call `CreatorLotteryManager.setAuthorizedHubShareOftForwarder(hubShareOFT, true)` for each hub ShareOFT that receives remote lottery entries.
2. Confirm remote chains still peer to hub ShareOFT (unchanged wiring).
3. End-to-end test: remote `submitPendingLotteryEntry` → hub lottery VRF request.

---

## Recommended tests to add

```bash
forge test --match-contract CreatorOVaultReportTest
forge test --match-contract CreatorLotteryManagerPauseGuardsTest
forge test --match-contract BribesTest
forge test --match-contract CreatorLinearVestingSeedAuthTest
forge test --match-contract CreatorShareOFTRemoteLotteryFundingTest
```

**Status (2026-07-02):** All of the above suites pass. `CreatorLotteryManager.SizeLimit.t.sol` still fails — see [index.md](./index.md) deploy-blocker note.

Suggested cases (implemented):

- `report()` with `totalAssetsAtLastReport == 0`, `_totalSupply > 0` → zero profit, baseline reset
- `emergencyResetAllVotes` → stale voter cannot claim until re-vote restores generation
- Pause → multiple VRF deferrals → `unpause()` settles all FIFO
- Remote `submitPendingLotteryEntry` accepts native overpay (exact underpay still reverts)
- Permissionless `seed()` reverts; seeder `seed()` succeeds after transfer

## Deploy blocker (post-audit)

| Item | Detail |
|------|--------|
| ~~`CreatorLotteryManager` runtime size~~ | **Resolved 2026-07-02** — 24,568 B (8 B under EIP-170). Admin-module `unpause()` FIFO-flushes via `applyDeferredVrf`; hub forwarder allowlist delegated. |
