# GitHub Actions cost posture (2026-07)

## Goals

1. Keep **merge-blocking** signal for non-draft PRs that change code.
2. Avoid full monorepo CI on docs-only, draft, or frontend-only PRs.
3. Keep **secrets scanning** (gitleaks) on non-draft PRs.

Billing lockout still disables Actions entirely until the org invoice is settled.

## Tests workflow

| Lane | PR (non-draft) | Main / manual |
|------|----------------|---------------|
| Path detect | 1 shallow job | force-all |
| Forge | Path-filtered; no Rebalance.* | Same |
| Frontend | lint + typecheck + guards | + full vitest |
| KPR reallocator | Only if `kpr/**` changes; **no Foundry** | Same |
| Draft PRs | Heavy jobs skipped | n/a |
| Pure docs | `paths-ignore` | paths-ignore |

EIP-170: `scripts/check-eip170-size-gate.mjs` (allowlisted known OFT/oracle debt).

## Schedules

| Workflow | Cadence |
|----------|---------|
| AlfaClub auth-health | **Weekly Mon** 14:17 UTC + manual |
| Control-plane stuck scan | **Weekly Mon** 14:23 UTC + manual |
| Security heavy (audit / Semgrep / Slither / full gitleaks) | **Weekly Mon** 07:13 UTC + manual |
| ACP market news | **Manual only** |

## Security (PR vs heavy)

- **Non-draft PR / push:** incremental gitleaks only.
- **Weekly + manual:** pnpm audit, Semgrep, full Slither, full-history gitleaks.

## Accessibility

- **PR:** jsx-a11y ESLint only (no Playwright).
- **Main / manual:** Playwright + axe smoke.

## Dependabot

- Monthly (not weekly) for npm/bun/actions.
- Grouped minor/patch where possible.
- Lower open-PR limits; fewer bun ecosystems (one `kpr-workflows` entry).

## Other

- Docs Drift: docs-pipeline paths; submodules only for contract docs regen.
- ZK: path-filtered push; concurrency cancel.
- Orphan / dependency-review: path-filtered.
- Legacy AlfaClub pnpm deploy: manual only.
- Builder-codes / eliza: concurrency; no Foundry submodules where unused.

## After billing is restored

1. Set **Actions spending limit** in org Billing.
2. Confirm Tests on next non-docs, non-draft PR.
3. Local size gate: `FOUNDRY_PROFILE=ci node scripts/check-eip170-size-gate.mjs`.
