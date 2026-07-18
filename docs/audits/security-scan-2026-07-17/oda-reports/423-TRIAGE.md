# ODA job 423 — Charm + Ajna strategies triage (2026-07-18)

**Scope:** Correct — used litterbox bundle `https://litter.catbox.moe/dk42ob.md` (same as v2 job 431) after private-repo 404.  
**Track:** https://onedollaraudit.com/audit/423

| ID | Sev | One-liner | Merge gate? |
|----|-----|-----------|-------------|
| H-01 | High | `ERC4626StrategyAdapter.rescueTokens` can divert idle principal | **Fixed** on `cursor/oda-v2-followup-26cd` — ASSET rescue requires `to == vault` (+ zero-address guard); mirrors Charm `ownerEmergencyWithdraw` |
| M-01…M-10 | Medium | Charm valuation/emergency/Ajna redeem/drift/fees/TWAP | Follow-up after H-01 |
| L-A | Lead→maybe High | Ajna `removeQuoteToken` LP vs quote-amount unit mismatch | Verify against live `IAjnaPool` ABI |

H-01 shipped with ODA 426 F1/F2 on the oda-v2-followup branch.
