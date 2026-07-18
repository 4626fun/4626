# ODA job 427 — CreatorOVault + CoreModule triage (correct scope)

**Status:** complete · **Track:** https://onedollaraudit.com/audit/427  
**Source:** litterbox `porq6l.md` — **usable**.

| ID | Sev | One-liner | Disposition |
|----|-----|-----------|-------------|
| **1** | High | Permissionless `challengeImpairmentRoot` → indefinite grief → stale-clear zeros claims | **Fixed** — ETH bond + per-epoch challenge cap (default 3) + `rejectImpairmentChallenge` (slash, keep root). `trippedAt` still not refreshed. |
| **2** | Medium | `queueWithdrawal` warm-slot bypasses large-withdrawal delay | **Fixed** — extend `unlockBlock = max(existing, now+delay)` on every addition |
| **3** | Medium | `claimImpairmentRecovery` vs transferable claim tokens | **Fixed / N/A** — `OVaultImpairmentClaims` soulbound (`ClaimTransferDisabled`) |
| **4** | Medium | `withdraw()` ignores queue liquidity reservation | **Fixed** — `withdraw`/`maxWithdraw` enforce reservation; `previewWithdraw` stays exact (no silent asset shrink) |
| **5** | Medium | Exits lack valuation-readiness gate | Open — product tradeoff (exit liveness vs stale NAV) |
| **7** | Medium | `notifyImpairmentRecovery` skips report-baseline decrease | **Fixed** — `_decreaseReportBaselineForPrincipalOutflow` on vault-asset branch |
| **8** | Low-Med | Withdraw loop pulls impaired strategies | **Fixed** — CreatorOVault local loop skips `strategyImpaired` (module already did) |
| **9** | Medium | Guardian in `onlyEmergencyAuthorized` can drain | **Fixed** — guardian removed from emergency drain; kept on `shutdownVault` via `onlyShutdownAuthorized` |
| **10–12** | Medium | acceptManagement visibility / other follow-ups | Open / follow-up |
| **6, 11, 13** | Low | Reservation burn edge, donation breaker, module version | Backlog |

## Suggested remaining
Valuation gate policy (F5); remaining 10–12; Ownable2Step backlog.
