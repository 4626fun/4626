# One Dollar Audit jobs

Paid from `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` ($1 USDC each via x402).  
Poll: `curl -sL https://www.onedollaraudit.com/api/jobs/<jobId>`  
Do **not** re-pay to re-check — persist these IDs.

## Important: v1 jobs 418–421 / 425 mostly wrong-scope or unusable

`github.com/wenakita/4626` is **private** (HTTP 404 to the auditor). Job **419**
explicitly fell back to legacy public `github.com/wenakita/CreatorVault`
(`contracts/vault/CreatorOVault.sol` @ `971da642`, Jan 2026) — not the current
monorepo (`contracts/creator/vault/...` + modules). Artifact saved under
`oda-reports/419-WRONG-SCOPE-*`. Jobs **420** and **421** also completed against
CreatorVault (`ShareOFT` / `CreatorVaultDeployer`) — see
`oda-reports/420-WRONG-SCOPE-*` and `oda-reports/421-WRONG-SCOPE-*`.
**Exception:** job **424** correctly audited `CreatorGaugeController` (usable).
Job **425** completed with “source unavailable” (no litterbox in description).

## v2 jobs (source bundles) — commissioned 2026-07-18

Source of truth: temporary public markdown bundles (litterbox, 72h) built from
this checkout. Descriptions instruct the auditor **not** to use CreatorVault.

| System | Job ID | Source bundle | Track | Status (2026-07-18) |
|--------|--------|---------------|-------|---------------------|
| Lottery | 426 | https://litter.catbox.moe/i28508.md | https://onedollaraudit.com/audit/426 | **complete** — [426-TRIAGE.md](./oda-reports/426-TRIAGE.md) |
| CreatorOVault + CoreModule | 427 | https://litter.catbox.moe/porq6l.md | https://onedollaraudit.com/audit/427 | **complete** — [427-TRIAGE.md](./oda-reports/427-TRIAGE.md) (partial patch) |
| CreatorShareOFT + wrapper | 428 | https://litter.catbox.moe/8guk8b.md | https://onedollaraudit.com/audit/428 | **complete** — [428-TRIAGE.md](./oda-reports/428-TRIAGE.md) |
| DeploymentBatcher | 429 | https://litter.catbox.moe/lrsfsn.md | https://onedollaraudit.com/audit/429 | **complete** — [429-TRIAGE.md](./oda-reports/429-TRIAGE.md) |
| Registry4626 | 430 | https://litter.catbox.moe/d8goxq.md | https://onedollaraudit.com/audit/430 | **complete** — [430-TRIAGE.md](./oda-reports/430-TRIAGE.md) |
| Charm + Ajna strategies | 431 | https://litter.catbox.moe/dk42ob.md | https://onedollaraudit.com/audit/431 | in_progress (note: v1 **423** already used this bundle; M-01…M-07 patched) |
| CreatorGaugeController | 432 | https://litter.catbox.moe/8q3r8g.md | https://onedollaraudit.com/audit/432 | **complete** — [432-TRIAGE.md](./oda-reports/432-TRIAGE.md) (overlaps 424) |
| ve4626 + bribes | 433 | https://litter.catbox.moe/leajpw.md | https://onedollaraudit.com/audit/433 | **complete** — [433-TRIAGE.md](./oda-reports/433-TRIAGE.md) (F2/F3 patched; F1 open) |

Next-review menu: [NEXT_REVIEWS.md](./NEXT_REVIEWS.md).

When `status: complete`, confirm the report scope names `contracts/creator/...`
or `contracts/shared/...` (not `CreatorVault` / `contracts/vault/CreatorOVault.sol`),
then archive under `oda-reports/`.

## Early usable v1 completions (partial)

Despite private-repo 404, several v1 jobs produced **usable** reviews:

| Job | System | Why usable | Triage |
|-----|--------|------------|--------|
| **422** | Registry4626 | Audited `contracts/shared/core/Registry4626.sol` path | [422-TRIAGE.md](./oda-reports/422-TRIAGE.md) — F2 = SCAN-M3; F1/F3/F4 closed via 430 |
| **430** | Registry4626 (v2) | Same path, higher-confidence reverse-map / creator / remote-OFT | [430-TRIAGE.md](./oda-reports/430-TRIAGE.md) — High F1/F3 + Medium F2/F5/F8–F10 patched |
| **432** | CreatorGaugeController (v2) | Overlaps 424 | [432-TRIAGE.md](./oda-reports/432-TRIAGE.md) — no new code beyond 424 |
| **423** | Charm + Ajna | Fell back to litterbox bundle `dk42ob.md` (same as v2 #431) | [423-TRIAGE.md](./oda-reports/423-TRIAGE.md) — H-01 fixed on oda-v2-followup; M-01…M-10 open |
| **424** | CreatorGaugeController | Correct-scope single-file review | [424-TRIAGE.md](./oda-reports/424-TRIAGE.md) — M-1…M-3 + L-3/L-8/L-10 fixed |
| **425** | ve4626 | Source unavailable (private repo, no bundle) | No findings — wait for v2 **433** |

Still prefer v2 jobs **426–433** for lottery/vault/batcher/gauge/ve when they complete.
