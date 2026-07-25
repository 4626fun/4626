# One Dollar Audit jobs — 2026-07-25 v1.20.0 greenfield candidate

Paid from `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` via x402 ($1 USDC each on Base).
Source pin: [`4626fun/4626` @ `audit/oda-v1200-greenfield-candidate`](https://github.com/4626fun/4626/tree/audit/oda-v1200-greenfield-candidate/contracts) (public `ef1ca595340b02680c3b17f0011b27bece24b914`).
Private mirror: `wenakita/4626` @ `a16096d1e6d5a849dd35a2295eefaaf9ae3507a2` (remediation pin; commission was against public `82688294f`).
Poll: `curl -sL https://www.onedollaraudit.com/api/jobs/<jobId>`
Do **not** re-pay to re-check — persist these IDs.

## Targeted-5

| System | Job ID | Track | Status |
|--------|--------|-------|--------|
| DeploymentBatcher | 494 | https://onedollaraudit.com/audit/494 | commissioned (prior 464) |
| Registry4626 | 495 | https://onedollaraudit.com/audit/495 | commissioned (prior 465) |
| Lottery stack | 496 | https://onedollaraudit.com/audit/496 | commissioned (prior 461) |
| CreatorOVault + CoreModule | 497 | https://onedollaraudit.com/audit/497 | commissioned (prior 462/480) |
| CreatorShareOFT + Wrapper | 498 | https://onedollaraudit.com/audit/498 | commissioned (prior 463/481) |

**Spend:** $5.00 USDC. Results JSON: [oda-commission-results.json](./oda-commission-results.json).

## Poll cheat-sheet

```bash
for id in 494 495 496 497 498; do
  echo -n "$id "; curl -sL "https://www.onedollaraudit.com/api/jobs/$id" | jq -r .status
done
```
