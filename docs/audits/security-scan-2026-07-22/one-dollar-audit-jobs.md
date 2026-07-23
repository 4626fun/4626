# One Dollar Audit jobs — 2026-07-22 re-audit

Paid from `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` via x402 ($1 USDC each on Base).
Source pin: [`4626fun/4626` @ `audit/oda-2026-07-22`](https://github.com/4626fun/4626/tree/audit/oda-2026-07-22/contracts) (commit `423e0e3`).
Poll: `curl -sL https://www.onedollaraudit.com/api/jobs/<jobId>`
Do **not** re-pay to re-check — persist these IDs.

## Core-8

| System | Job ID | Track | Status |
|--------|--------|-------|--------|
| Lottery stack | 461 | https://onedollaraudit.com/audit/461 | commissioned |
| CreatorOVault + CoreModule | 462 | https://onedollaraudit.com/audit/462 | commissioned |
| CreatorShareOFT + Wrapper | 463 | https://onedollaraudit.com/audit/463 | commissioned |
| DeploymentBatcher | 464 | https://onedollaraudit.com/audit/464 | commissioned |
| Registry4626 | 465 | https://onedollaraudit.com/audit/465 | commissioned |
| Charm + Ajna strategies | 466 | https://onedollaraudit.com/audit/466 | commissioned |
| CreatorGaugeController | 467 | https://onedollaraudit.com/audit/467 | commissioned |
| ve4626 + bribes | 468 | https://onedollaraudit.com/audit/468 | commissioned |

## Accidental probe

| Note | Job ID | Track |
|------|--------|-------|
| Weak diag description (Node 18 crypto fail then Node 22 probe). Not a core-8 substitute. | 460 | https://onedollaraudit.com/audit/460 |

**Spend:** $9.00 USDC (8 core + 1 probe).

## Poll cheat-sheet

```bash
for id in 461 462 463 464 465 466 467 468; do
  echo -n "$id "; curl -sL "https://www.onedollaraudit.com/api/jobs/$id" | jq -r .status
done
```

## Triage

See [TRIAGE.md](./TRIAGE.md). Jobs **462/463** still `in_progress` at last poll; reports archived under `oda-reports/` for completed jobs.

## Remediated pin (do not overwrite 423e0e3)

New review jobs should pin [`4626fun/4626` @ `audit/oda-2026-07-23-remediated`](https://github.com/4626fun/4626/tree/audit/oda-2026-07-23-remediated/contracts) (`413f060`). Historical jobs 461–468 / 480–481 remain tied to `423e0e3`.
