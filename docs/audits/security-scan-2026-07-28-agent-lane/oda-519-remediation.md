# ODA-519 remediation — Charm + Ajna strategies

**Track:** https://onedollaraudit.com/audit/519  
**Report:** [oda-reports/519-report.md](./oda-reports/519-report.md)  
**Pin audited:** `audit/oda-2026-07-28-strategies-revenue` @ `f09a31a`

## Fixed

| ID | Sev | Fix |
|----|-----|-----|
| ODA-519-1 | High | `lpToAssets` voids LP only when `depositTime <= bankruptcyTime` (lender-scoped) |
| ODA-519-3 | High | `moveToBuffer` / `move` pass quote-token WAD (or `type(uint256).max`) into Ajna, not LP |
| ODA-519-5 | High | Pause blocks entries only — `withdraw`/`redeem`/`moveToBuffer`/`max*` remain available |
| ODA-519-6 | Med | First `setSwapper` instant for factory wiring; rotations are two-step `acceptSwapper` |
| ODA-519-7 | Med | Permissionless `syncValuation()`; owner `forceSyncValuation()` |
| ODA-519-8 | Med | `_syncValuationSnapshotBestEffort` refuses to re-anchor out-of-band PPS |
| ODA-519-11 | Med | Adapter NAV / PPS reads prefer `previewRedeem` (tax-aware) with `convertToAssets` fallback |
| ODA-519-12 | Med | Inner deposit soft-fails to idle (`InnerDepositDeferred`) + `maxDeposit` clamp |
| ODA-519-13 | Med | Charm deposit post-swap branch clamps ASSET leg to pairable USDC |
| ODA-519-14 | Med | `setSwapPool` validates code + token0/token1 against ASSET/USDC |
| ODA-519-15 | Med | Emergency drain re-reads `bucketLp` and counts residuals |
| ODA-519-16 | Low | `emergencyWithdraw` reports only post-repay transferred ASSET |
| ODA-519-17 | Med | Toll/tax armed at construction; queued fee updates expire after 7d (clear-without-apply) |
| ODA-519-18 | Low | `setValuationGuard` rejects bps `>= 10_000` |
| ODA-519-19 | Low | `move` untracks source before tracking destination |
| ODA-519-20 | Low | Ajna borrow limit index clamped / unavailable when sentinel would be 0 |
| ODA-519-21 | Low | `isCharmInRange` fails closed; half-open tick range; nested `slot0` try |

## Accepted / DESIGN / deferred (not code-fixed this pass)

| ID | Sev | Why |
|----|-----|-----|
| ODA-519-2 | High | Collateral reclaim needs `removeCollateral` path + pricing — deferred product work |
| ODA-519-4 | High | Charm LP NAV vs oracle sandwich — accepted DESIGN (spot composition intentional) |
| ODA-519-9 | Med | Self-referential Charm withdraw mins — DESIGN; sizing note tracked separately |
| ODA-519-10 | Med | Voluntary Ajna collateral reclaim without withdraw side-effect — deferred with #2 |
| Low/Info | Low | Ownable1Step, keeper set, buffer donation, decimals assumptions, FoT — ops/DESIGN |

## Tests

- `test/oda/ODA519_Remediations.t.sol`
- `test/AjnaVaultAuth.t.sol`
- `test/AjnaERC4626Vault.t.sol`
- `test/ERC4626StrategyAdapter.t.sol`
- `test/ERC4626StrategyAdapter.AjnaInnerVault.t.sol`
- `test/oda/ODA466_468_464_Remediations.t.sol` (`test_466_11`)
- `test/vault/CharmStrategy4626.Oracle.t.sol`

## Codex follow-up (PR review)

| Item | Fix |
|------|-----|
| Permissionless PPS ratchet via `syncValuation` | Heartbeat-only (timestamp); PPS advanced by ops / `forceSyncValuation` |
| Partial exit with zero quote → full drain | `ZeroQuoteAmount` revert; max-quote sentinel only on full exit |

