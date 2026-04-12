# Docs Perspective Pruning Matrix (2026-04-11)

## Objective

Reduce public docs noise while keeping persona-first discoverability stable.

## Decision Matrix

| Section | Decision | Notes |
| --- | --- | --- |
| `users/*` | Keep public | Core onboarding and troubleshooting lane. |
| `creators/*` | Keep public | Core creator launch/operator lane. |
| `developers/*` | Keep public (trimmed) | Keep as concise hub, avoid long embedded runbooks. |
| `protocols/*` | Keep public | Protocol integration lane remains canonical. |
| `operators/*` | Keep public | Production operations lane remains canonical. |
| `security/*` | Keep public | Trust section is first-class public surface. |
| `audits/*` | Keep public (curated) | Keep externally relevant audits; move process worksheets internal. |
| `overview/*` | Keep public (minimal) | Keep as secondary narrative index; not primary nav lane. |
| `compressions/*` | Keep public (minimal) | Keep system-model framing; remove duplicate reading-order page from public output. |
| `primitives/*` | Keep public (minimal) | Keep conceptual docs; move internal test matrix doc out of public output. |
| `plans/*` | Internal only | Already excluded from public sync. |
| `docs/_internal/*` | Internal only | Explicitly excluded from public sync. |

## Files moved to internal in this pass

- `docs/audits/github-supply-chain-setup.md` -> `docs/_internal/audits/github-supply-chain-setup.md`
- `docs/audits/internal-monorepo-audit-2026-03-30.md` -> `docs/_internal/audits/internal-monorepo-audit-2026-03-30.md`
- `docs/audits/npm-advisories-triage.md` -> `docs/_internal/audits/npm-advisories-triage.md`
- `docs/audits/production-parity-checklist.md` -> `docs/_internal/audits/production-parity-checklist.md`
- `docs/compressions/reading-order.md` -> `docs/_internal/compressions/reading-order.md`
- `docs/primitives/game-loop/lottery-amoe-test-matrix.md` -> `docs/_internal/primitives/game-loop/lottery-amoe-test-matrix.md`

## Redirect coverage added

- `/audits/github-supply-chain-setup` -> `/audits`
- `/audits/internal-monorepo-audit-2026-03-30` -> `/audits`
- `/audits/npm-advisories-triage` -> `/audits`
- `/audits/production-parity-checklist` -> `/audits`
- `/compressions/reading-order` -> `/compressions`
- `/primitives/game-loop/lottery-amoe-test-matrix` -> `/primitives/game-loop/lottery`

## Next pruning batch candidates

- Evaluate `overview/*` for consolidation into one canonical overview page plus redirects.
- Review old release notes (`operations/deployment/releases/*`) for archival policy (for example: keep current + previous major, archive older).
- Audit `guides/*` for duplicate launch/deploy wording and collapse repeated content into one source page with contextual links from lane hubs.
