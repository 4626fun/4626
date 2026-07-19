# ODA job 423 — Charm + Ajna strategies triage (2026-07-18)

**Scope:** Correct — used litterbox bundle `https://litter.catbox.moe/dk42ob.md` (same as v2 job 431) after private-repo 404.  
**Track:** https://onedollaraudit.com/audit/423

| ID | Sev | One-liner | Merge gate? |
|----|-----|-----------|-------------|
| H-01 | High | `ERC4626StrategyAdapter.rescueTokens` can divert idle principal | **Fixed** on `cursor/oda-v2-followup-26cd` — ASSET rescue requires `to == vault` (+ zero-address guard); mirrors Charm `ownerEmergencyWithdraw` |
| M-01 | Medium | Stale oracle latches understated `lastTotalAssets` / phantom harvest profit | **Fixed** — harvest/deposit skip `lastTotalAssets` update when `!isValuationReady()` |
| M-02 | Medium | `emergencyWithdraw` required swap can brick exit | **Fixed** — best-effort `_swapUsdcToAssetSafe` |
| M-03 | Medium | Emergency exit never repays Ajna debt | **Partial** — best-effort `_repayAjnaDebtWithAsset` in emergencyWithdraw |
| M-04 | Medium | Idle USDC stranded when Charm shares are zero | **Fixed** — residual USDC forwarded to vault |
| M-05 | Medium | `setCharmVault` leaves stale unlimited approvals | **Fixed** — revoke old + approve new (mirror `setAjnaPool`) |
| M-06 | Medium | `AjnaERC4626Vault.maxRedeem` can exceed idle buffer | **Fixed** — shrink shares until `previewRedeem <= buffer` |
| M-07 | Medium | Valuation windows unbounded / stale snapshot still ready | **Fixed** — `MAX_VALUATION_WINDOWS = 3`; stale ⇒ not ready |
| M-08 | Medium | Admin can front-run live toll/tax changes | **Fixed** — `AjnaVaultAuth` 24h timelock after first `setToll`/`setTax` (`executeTollUpdate`/`executeTaxUpdate`) |
| M-09 | Medium | Charm spot `getTotalAmounts` composition unbounded vs TWAP | **Residual** — NAV stays oracle-priced for share accounting; composition haircut needs calibrated TWAP mocks |
| M-10 | Medium | Oracle withdraw sizing vs TWAP realization can brick exits | **Fixed** — `_realizableTotalAssets` + `_usdcToAssetValueRealizable` (min oracle/TWAP); `withdraw` caps to realizable |
| L-A | Lead→maybe High | Ajna `removeQuoteToken` LP vs quote-amount unit mismatch | Verify against live `IAjnaPool` ABI |

H-01 shipped with ODA 426 F1/F2 on the oda-v2-followup branch. M-08/M-10 shipped on `cursor/oda-audit-followthrough-26cd`.
