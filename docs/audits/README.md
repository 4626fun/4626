---
title: Audits
sidebar_position: 4
---

# Audits (4626)

Security and trust artifacts for the public docs audience. These are **not** a substitute for an external smart-contract audit.

| Doc | Purpose |
|-----|---------|
| [system.md](./system.md) | Protocol/system economic and governance review (long-form). |
| [ajna/](./ajna/) | Ajna adversarial audit, executive brief, and Q&A compendium. |
| [charm/](./charm/) | Charm V2 adversarial audit, executive brief, and master Q&A. |
| [codex/](./codex/) | Codex security review records and archival finding exports. |
| [token-image/](./token-image/) | Token-image renderer research and breakout analysis notes. |

Internal process runbooks (supply-chain setup, advisories triage, production parity checklists) are intentionally kept in the internal docs lane.

**Automation**

- `.github/workflows/security-scanning.yml` — gitleaks (incremental), pnpm audit summaries (root, `frontend/`, `cre/`, `apps/docs-site/`), blocking Semgrep on `frontend/api` + `frontend/server/_lib` + `frontend/packages/server-core/src`, Slither (report-only).
- `.github/workflows/dependency-review.yml` — on PRs, blocks **new** **high** or **critical** vulnerabilities in **runtime and development** dependencies.
- `.github/workflows/test.yml` — Forge tests, frontend lint/typecheck/tests.
- `gitleaks.toml` — allowlists for vendored snapshots and test/doc noise.
- `slither.config.json` — `filter_paths` to reduce vendored noise in Slither reports.

**Local**

- `pnpm security:local` at repo root — `scripts/security-audit-local.sh`.

**Supply chain**

- [`.github/dependabot.yml`](https://github.com/wenakita/4626/blob/main/.github/dependabot.yml) — weekly npm updates for `/`, `/frontend`, and `/cre`; weekly Bun updates for `cre/cre-workflows` packages that commit `bun.lock`; monthly GitHub Actions bumps.
