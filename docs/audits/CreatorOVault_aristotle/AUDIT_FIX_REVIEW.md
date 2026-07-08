# Fix Review — CreatorOVault stack (`ARISTOTLE_SUMMARY.md` / `AUDIT_REPORT.md`)

Re-review of the current source against the findings in this directory's
`ARISTOTLE_SUMMARY.md` and `AUDIT_REPORT.md`. Reconciled against live source
(not the frozen snapshot files also in this directory), including uncommitted
working-tree changes.

| ID | Severity | Status | Notes |
|----|----------|--------|-------|
| H-1 | High | ✅ Fixed | `claimQueuedWithdrawal`/`queueWithdrawal` now use uncapped `convertToAssets` instead of reservation-capped `previewRedeem` |
| M-1 | Medium | ✅ Fixed | `OVaultModuleConstants.MODULE_STORAGE_VERSION` + `scripts/check-ovault-module-storage-layout.mjs` CI guard + committed snapshot |
| M-2 | Medium | ✅ Fixed | Trip/clear authority narrowed to owner + `impairmentGuardian`; permissionless `clearStaleImpairmentTrip` bounds Suspect mode to `maxImpairmentTripDuration` (default 14d, 3–30d configurable range) |
| M-3 | Medium | ✅ Fixed | `riskConfigDelay` now defaults to `MIN_RISK_CONFIG_DELAY` (1 day) instead of `0` |
| M-4 | Medium | ✅ Fixed | `buyDebt` now unconditionally reverts with `DebtPurchaseDisabled` |
| L-1 | Low | ✅ Fixed | `CreatorShareOFT.burn`'s `owner()` allowance exemption removed — only the vault remains exempt |
| L-2 / other LOW/INFO | Low/Info | ⚠️ Mostly unchanged | See below |

---

## Fixed

### H-1 — queued-withdrawal underpayment — ✅ Fixed
`queueWithdrawal` and `claimQueuedWithdrawal` in `CreatorOVaultCoreModule.sol`
now call `IERC4626(address(this)).convertToAssets(shares)` instead of
`previewRedeem(shares)`. `previewRedeem`'s reservation cap (meant for
synchronous `redeem()`/`withdraw()` callers who must compete for
already-queued liquidity) was incorrectly also capping settlement of a
claimant's *own* already-queued shares, which are not competing for
anything — they were already carved out at queue time. Regression test:
`test_claimQueuedWithdrawal_fullQueuePaysFullEntitlement` in
`test/CreatorOVault.Report.t.sol`.

### M-1 — manual storage-layout version hash — ✅ Fixed
`contracts/shared/vault/modules/OVaultModuleConstants.sol` centralizes
`MODULE_STORAGE_VERSION` (now `v4`) and `SECONDS_PER_YEAR`, consumed by
`CreatorOVault.sol` and all three delegatecall modules. CI-runnable
`scripts/check-ovault-module-storage-layout.mjs` diffs `forge inspect
storage-layout` across all four contracts and fails if they diverge, or if
the layout changed without a matching `MODULE_STORAGE_VERSION` bump +
snapshot update (`scripts/data/ovault-module-storage-layout.snapshot.json`).

### M-2 — Suspect mode: broad trigger authority, no deadline — ✅ Fixed
Two independent hardenings, both required per the original recommendation:

1. **Authority narrowed.** `tripImpairment`/`clearImpairmentTrip` are gated by
   `onlyImpairmentAuthorized` (`owner()` or `impairmentGuardian` only) at the
   vault level — not the broader role set the audit flagged.
2. **Liveness bound added.** New `maxImpairmentTripDuration` (uint64, default
   `14 days`, owner-configurable within `[MIN_IMPAIRMENT_TRIP_DURATION (3d),
   MAX_IMPAIRMENT_TRIP_DURATION (30d)]` via `setMaxImpairmentTripDuration`).
   New **permissionless** `clearStaleImpairmentTrip(epochId)` — callable by
   anyone once `block.timestamp >= epoch.trippedAt + maxImpairmentTripDuration`
   — forces a still-`Tripped` epoch back to `Normal` (same reset as the
   authorized `clearImpairmentTrip`: root/claim surface zeroed,
   `strategyImpaired` cleared). This is a hard bound on Suspect-mode duration
   regardless of internal sub-state (applies even if a root has already been
   proposed and is sitting in/past its own challenge window), so a stuck,
   negligent, or compromised impairment authority can no longer freeze
   deposits/withdrawals indefinitely. Governance is expected to size
   `maxImpairmentTripDuration` comfortably longer than its expected
   propose+challenge+finalize turnaround.
   Storage: `maxImpairmentTripDuration` appended to both `CreatorOVault.sol`
   and `OVaultModuleStorage.sol` (storage-layout guard re-verified, M-1).
   Tests: `test/CreatorOVault.ImpairmentV1.t.sol` (`test_maxImpairmentTripDuration_*`,
   `test_setMaxImpairmentTripDuration_*`, `test_clearStaleImpairmentTrip_*`,
   `test_clearImpairmentTrip_authorized_stillWorksBeforeDeadline`).

### M-3 — `riskConfigDelay` defaults to `0` — ✅ Fixed
Constructor now sets `riskConfigDelay = MIN_RISK_CONFIG_DELAY` (1 day) instead
of leaving it at the zero-value default, so fee/risk changes are timelocked
from deployment without requiring a follow-up governance call. Regression:
`test_riskConfigDelay_defaultsToMinimumTimelock` in
`test/CreatorOVault.GovernanceV2.t.sol`. Fix regression caught and closed in
`test/vault/strategies/CreatorOVaultStrategies.MaxAssetsCap.t.sol` (needed
`vault.setRiskConfigDelay(0)` in `setUp()` since `setStrategyMaxAssets` is now
itself a scheduled risk-config change).

### M-4 — `buyDebt` value transfer with no returned claim — ✅ Fixed
`OVaultStrategiesModule.buyDebt` now unconditionally reverts with
`DebtPurchaseDisabled()` — the function is fully disabled rather than
partially mitigated. Regression:
`test_buyDebt_reverts_when_debtPurchase_is_disabled` in
`test/CreatorOVault.TransferAccounting.t.sol`.

### L-1 — owner can burn any holder's ShareOFT without allowance — ✅ Fixed
`CreatorShareOFT.burn` previously exempted both `vault` and `owner()` from
`_spendAllowance`, so the owner key alone could destroy any holder's shares
with no approval and no holder-side signal. The `owner()` branch of the
exemption is removed; `owner()` now goes through the same `_spendAllowance`
path as any other minter, so a holder's balance can only be burned by the
vault itself (trusted custodian — burns are part of normal
deposit/withdraw/unwrap accounting) or by an address the holder has
explicitly approved. New test file:
`test/CreatorShareOFT.BurnAllowance.t.sol` (owner-without-allowance reverts,
owner-with-allowance succeeds and decrements the allowance, vault stays
exempt, minter-without-allowance still reverts as a control case for the
pre-existing H-3 fix).

---

## Unchanged / not in this pass

### L-2 and other Low/Info items — ⚠️ Mostly unchanged
Duplicated/divergent limit-view paths, year-constant drift (partially
addressed by centralizing `SECONDS_PER_YEAR` in `OVaultModuleConstants.sol` as
part of the M-1 fix), fee-accounting edge cases, and remaining
centralization/disclosure items from the original report were not in scope
for this pass (M-2 and L-1 only, per explicit request). See
`AUDIT_REPORT.md` for the full original list before treating anything not
listed above as resolved.

### Out of scope for this reconciliation
`LotteryManager4626.sol` and the oracle-adjacent contracts
(`CreatorOracle`, `CreatorGaugeController`, `CreatorPayoutRouter`,
`Registry4626`, `LinearVesting4626`, `VaultShareBurnStream`) were under
active, concurrent, non-atomic edits by another process at review time and
were deliberately excluded from this pass to avoid auditing a moving target.
See `docs/audits/aristotle/lottery/` and `docs/audits/aristotle/oracle/` for
their separate audit artifacts.
