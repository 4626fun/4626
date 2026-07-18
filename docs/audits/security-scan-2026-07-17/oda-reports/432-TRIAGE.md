# ODA job 432 — CreatorGaugeController (v2) triage (2026-07-18)

**Scope:** `contracts/creator/revenue/CreatorGaugeController.sol`  
**Track:** https://onedollaraudit.com/audit/432  
**Note:** Bundle matches the surface already audited/patched under **424**.

| ID | Sev | One-liner | Disposition |
|----|-----|-----------|-------------|
| **F1** | Medium | Instant `setLotteryManager` → drain jackpot | **Already fixed** — 424-M2 timelock + `executeLotteryManagerUpdate` |
| **F2** | Medium | Fallback slippage treats WETH/creator 1:1 | **Already fixed** — 424-M1 fail-closed / setter disabled |
| **F3** | Low-Med | Shared `lastDistribution` couples OFT/WETH | **Fixed** — same as 424-L4 (`lastWethDistribution`) |
| **F4** | Low-Med | `sqrtPriceLimitX96` vs average-price mismatch | **Already fixed** — 424-M3 passes `0` |
| **F5** | Low | Q192 overflow at extreme ratios | Open / backlog — extreme-price contingency |

No additional gauge code changes required on this branch beyond 424.
