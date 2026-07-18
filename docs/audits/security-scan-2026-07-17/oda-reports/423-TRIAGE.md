# ODA job 423 — Charm + Ajna strategies triage (2026-07-18)

**Scope:** Correct — used litterbox bundle `https://litter.catbox.moe/dk42ob.md` (same as v2 job 431) after private-repo 404.  
**Track:** https://onedollaraudit.com/audit/423

| ID | Sev | One-liner | Merge gate? |
|----|-----|-----------|-------------|
| H-01 | High | `ERC4626StrategyAdapter.rescueTokens` can divert idle principal | **No** for #718 — separate strategy PR; verify vs current `rescueTokens` before patching |
| M-01…M-10 | Medium | Charm valuation/emergency/Ajna redeem/drift/fees/TWAP | Follow-up after H-01 triage |
| L-A | Lead→maybe High | Ajna `removeQuoteToken` LP vs quote-amount unit mismatch | Verify against live `IAjnaPool` ABI |

#718 SCAN patches do not touch strategy adapters; merge SCAN work first, then strategy ODA fixes.
