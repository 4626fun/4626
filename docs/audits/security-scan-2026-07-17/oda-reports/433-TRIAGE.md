# ODA job 433 — ve4626 suite triage (2026-07-18)

**Scope:** `ve4626.sol` · `ve4626GaugeVoting.sol` · `ve4626BoostManager.sol` · `ve4626Utility.sol` · `BribeDepot4626.sol`  
**Track:** https://onedollaraudit.com/audit/433

| ID | Sev | One-liner | Disposition |
|----|-----|-----------|-------------|
| **F1** | Medium | Capacity double-use: vote then forfeit ve33 → claim veLottery | **Fixed** — `utility.setGaugeVoting` + block `forfeitVe33`/`forfeitAll` while `hasVotedThisEpoch` |
| **F2** | Medium | Seasoning bypass via `increaseLock`/`extendLock` | **Fixed** — reset `Lock.start` on both |
| **F3** | High | `emergencyResetAllVotes` in freeze strands bribes | **Fixed** — revert `EmergencyResetInFreezeWindow` |
| **F4** | Medium | Instant `setUtility` / `setBoostManager` vs timelocked boost params | Open / ops |
| **F5** | Medium | No Ownable2Step across suite | Open / backlog |
| **F6** | Medium | Bribe claim vs frozen `totalBribes` balance | Open — follow-up |
| **F7–F14** | Low | Various hygiene / DOS / checkpoint | Backlog |

## Note
Job **425** (v1) had no source; this v2 litterbox job supersedes it.
