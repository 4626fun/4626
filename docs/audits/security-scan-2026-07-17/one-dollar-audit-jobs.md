# One Dollar Audit jobs

Paid from `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` ($1 USDC each via x402).  
Poll: `curl -sL https://www.onedollaraudit.com/api/jobs/<jobId>`  
Do **not** re-pay to re-check — persist these IDs.

## Important: v1 jobs 418–425 are wrong-scope / unusable

`github.com/wenakita/4626` is **private** (HTTP 404 to the auditor). Job **419**
explicitly fell back to legacy public `github.com/wenakita/CreatorVault`
(`contracts/vault/CreatorOVault.sol` @ `971da642`, Jan 2026) — not the current
monorepo (`contracts/creator/vault/...` + modules). Artifact saved under
`oda-reports/419-WRONG-SCOPE-*`. Jobs **420** and **421** also completed against
CreatorVault (`ShareOFT` / `CreatorVaultDeployer`) — see
`oda-reports/420-WRONG-SCOPE-*` and `oda-reports/421-WRONG-SCOPE-*`. Treat
**418–425** as spent/wrong unless a report proves it fetched the litterbox
bundles below.

## v2 jobs (source bundles) — commissioned 2026-07-18

Source of truth: temporary public markdown bundles (litterbox, 72h) built from
this checkout. Descriptions instruct the auditor **not** to use CreatorVault.

| System | Job ID | Source bundle | Track | Status (2026-07-18) |
|--------|--------|---------------|-------|---------------------|
| Lottery | 426 | https://litter.catbox.moe/i28508.md | https://onedollaraudit.com/audit/426 | **complete** — [426-TRIAGE.md](./oda-reports/426-TRIAGE.md) |
| CreatorOVault + CoreModule | 427 | https://litter.catbox.moe/porq6l.md | https://onedollaraudit.com/audit/427 | in_progress |
| CreatorShareOFT + wrapper | 428 | https://litter.catbox.moe/8guk8b.md | https://onedollaraudit.com/audit/428 | in_progress |
| DeploymentBatcher | 429 | https://litter.catbox.moe/lrsfsn.md | https://onedollaraudit.com/audit/429 | pending |
| Registry4626 | 430 | https://litter.catbox.moe/d8goxq.md | https://onedollaraudit.com/audit/430 | pending |
| Charm + Ajna strategies | 431 | https://litter.catbox.moe/dk42ob.md | https://onedollaraudit.com/audit/431 | pending (note: v1 **423** already used this bundle) |
| CreatorGaugeController | 432 | https://litter.catbox.moe/8q3r8g.md | https://onedollaraudit.com/audit/432 | pending |
| ve4626 + bribes | 433 | https://litter.catbox.moe/leajpw.md | https://onedollaraudit.com/audit/433 | pending |

Next-review menu: [NEXT_REVIEWS.md](./NEXT_REVIEWS.md).

When `status: complete`, confirm the report scope names `contracts/creator/...`
or `contracts/shared/...` (not `CreatorVault` / `contracts/vault/CreatorOVault.sol`),
then archive under `oda-reports/`.

## Early usable v1 completions (partial)

Despite private-repo 404, two v1 jobs produced **usable** reviews:

| Job | System | Why usable | Triage |
|-----|--------|------------|--------|
| **422** | Registry4626 | Audited `contracts/shared/core/Registry4626.sol` path | [422-TRIAGE.md](./oda-reports/422-TRIAGE.md) — F2 = SCAN-M3 (fixed); F1/F3/F4 open follow-up |
| **423** | Charm + Ajna | Fell back to litterbox bundle `dk42ob.md` (same as v2 #431) | [423-TRIAGE.md](./oda-reports/423-TRIAGE.md) — H-01 fixed on oda-v2-followup; M-01…M-10 open |

Still prefer v2 jobs **426–433** for lottery/vault/batcher/gauge/ve when they complete.
