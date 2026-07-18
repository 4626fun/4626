# ODA job 422 — Registry4626 triage (2026-07-18)

**Scope:** Correct path `contracts/shared/core/Registry4626.sol` (not CreatorVault).  
**Track:** https://onedollaraudit.com/audit/422

| ID | Sev | One-liner | Status vs this branch |
|----|-----|-----------|------------------------|
| F2 | Medium | `setAgentIntegrationMeta` no one-shot | **Fixed** by SCAN-M3 on #718 |
| F1 | Medium | Missing reverse-map conflict on setVault/wrapper/oracle/gauge | **Fixed** — see [430-TRIAGE.md](./430-TRIAGE.md) F1 |
| F3 | Medium | Remote OFT peer setters lack one-shot/rebind | **Fixed** — 430-F8 |
| F4 | Medium | Remote reverse-map wipe when one OFT serves multiple EIDs | **Fixed** — 430-F2 |
| F5–F10 | Low | eid==0, stale eid map, Ownable renounce, factory deauth, wallet squat, unbounded getters | **Partial** — eid==0 / stale eid / renounce closed in 430; remainder backlog |

Closed by Registry4626 hardening on the ODA-430 follow-up branch.
