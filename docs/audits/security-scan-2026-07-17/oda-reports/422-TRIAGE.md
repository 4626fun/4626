# ODA job 422 — Registry4626 triage (2026-07-18)

**Scope:** Correct path `contracts/shared/core/Registry4626.sol` (not CreatorVault).  
**Track:** https://onedollaraudit.com/audit/422

| ID | Sev | One-liner | Status vs this branch |
|----|-----|-----------|------------------------|
| F2 | Medium | `setAgentIntegrationMeta` no one-shot | **Fixed** by SCAN-M3 on #718 |
| F1 | Medium | Missing reverse-map conflict on setVault/wrapper/oracle/gauge | **Open** — follow-up PR |
| F3 | Medium | Remote OFT peer setters lack one-shot/rebind | **Open** — follow-up |
| F4 | Medium | Remote reverse-map wipe when one OFT serves multiple EIDs | **Open** — follow-up |
| F5–F10 | Low | eid==0, stale eid map, Ownable renounce, factory deauth, wallet squat, unbounded getters | **Open** — backlog |

Do not block merge of SCAN patches on F1/F3/F4 — ship #718, then open a registry hardening PR.
