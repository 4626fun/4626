---
title: Audits
sidebar_position: 4
---

# Audits (4626)

Security and trust artifacts for the public docs audience. These are **not** a substitute for an external smart-contract audit.

| Doc | Purpose |
|-----|---------|
| [bug-audit-worksheet.md](./bug-audit-worksheet.md) | **Start here** for bug audits — lane order, file checklists, tests, regression signals. |
| [system.md](./system.md) | Protocol/system economic and governance review (long-form). |
| [ajna/](./ajna/) | Ajna adversarial audit, executive brief, and Q&A compendium. |
| [charm/](./charm/) | Charm V2 adversarial audit, executive brief, and master Q&A. |
| [codex/](./codex/) | Codex security review records and archival finding exports. |
| [4626/acceptances/M-38-M-39-foundry-halmos-invariant-evidence.md](./4626/acceptances/M-38-M-39-foundry-halmos-invariant-evidence.md) | Foundry invariant and Halmos symbolic-test evidence for M-38 / M-39 coverage-gap follow-up. |
| [x-ray/](./x-ray/) | Internal x-ray security review framework. Live contract audit checklist in `review-todo.md`. |
| [x-ray/contract-audit-pass-2026-06.md](./x-ray/contract-audit-pass-2026-06.md) | **June 2026 x-ray contract audit pass completed** ("for all" P0/P1 review + P2 tests + follow-ups). Full checklist execution, sizes/Slither/tests/invariants/Codex alignment. Follow-ups: hardened CLM size guard (with PR policy), SC hygiene in security-local (size + canonical terms), new deploy retry test, lint fixes, re-run verification (exit 0, clean). See updated `review-todo.md` (all [x]) and `docs/operations/contract-size-gate.md`. |
| [token-image/](./token-image/) | Token-image renderer research and breakout analysis notes. |

Internal process runbooks (supply-chain setup, advisories triage, production parity checklists) are intentionally kept in the internal docs lane.

**Automation**

- `.github/workflows/security-scanning.yml` — gitleaks (incremental), pnpm audit summaries (root, `frontend/`, `kpr/`, `apps/docs-site/`), blocking Semgrep on `frontend/api` + `frontend/server/_lib` + `frontend/packages/server-core/src`, Slither (report-only).
- `.github/workflows/security-scanning.yml` — launch branches (`launch/*`) also run a **blocking** Slither gate that fails on **high-impact** findings.
- `.github/workflows/dependency-review.yml` — on PRs, blocks **new** **high** or **critical** vulnerabilities in **runtime and development** dependencies.
- `.github/workflows/test.yml` — Forge tests, frontend lint/typecheck/tests, **strategy-reallocator-guards** (KPR pass-loop + Foundry rebalance wiring).
- `gitleaks.toml` — allowlists for vendored snapshots and test/doc noise.
- `slither.config.json` — `filter_paths` to reduce vendored noise in Slither reports.

**Local**

- `pnpm security:local` at repo root — `scripts/security-audit-local.sh`.

**Supply chain**

- [`.github/dependabot.yml`](https://github.com/wenakita/4626/blob/main/.github/dependabot.yml) — weekly npm updates for `/`, `/frontend`, and `/kpr`; weekly Bun updates for `kpr/kpr-workflows` packages that commit `bun.lock`; monthly GitHub Actions bumps.
