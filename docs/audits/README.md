---
title: Audits
sidebar_position: 4
---

# Audits (4626)

Internal engineering and release-readiness notes. These are **not** a substitute for an external smart-contract audit.

| Doc | Purpose |
|-----|---------|
| [internal-monorepo-audit-2026-03-30.md](./internal-monorepo-audit-2026-03-30.md) | Layered audit pass: scope, automation results, trust-boundary map, CI pointers. |
| [npm-advisories-triage.md](./npm-advisories-triage.md) | Root + frontend `pnpm audit` mitigations and accepted residual risk. |
| [production-parity-checklist.md](./production-parity-checklist.md) | Pre-release worksheet: bytecode, env, keys, constants. |
| [github-supply-chain-setup.md](./github-supply-chain-setup.md) | Enable Dependency graph, optional branch protection, workflow policy reference. |
| [system.md](./system.md) | Protocol/system economic and governance review (long-form). |
| [ajna/](./ajna/) | Ajna adversarial audit, executive brief, and Q&A compendium. |
| [charm/](./charm/) | Charm V2 adversarial audit, executive brief, and master Q&A. |
| [codex/](./codex/) | Codex security review records and archival finding exports. |
| [token-image/](./token-image/) | Token-image renderer research and breakout analysis notes. |

**Automation**

- `.github/workflows/security-scanning.yml` — gitleaks (incremental), pnpm audit summaries (root, `frontend/`, `cre/`, `apps/docs-site/`), blocking Semgrep on `frontend/api` + `frontend/server/_lib` + `frontend/packages/server-core/src`, Slither (report-only).
- `.github/workflows/dependency-review.yml` — on PRs, blocks **new** **high** or **critical** vulnerabilities in **runtime and development** dependencies. Setup: [github-supply-chain-setup.md](./github-supply-chain-setup.md).
- `.github/workflows/test.yml` — Forge tests, frontend lint/typecheck/tests.
- `gitleaks.toml` — allowlists for vendored snapshots and test/doc noise.
- `slither.config.json` — `filter_paths` to reduce vendored noise in Slither reports.

**Local**

- `pnpm security:local` at repo root — `scripts/security-audit-local.sh`.

**Supply chain**

- [`.github/dependabot.yml`](../../.github/dependabot.yml) — weekly npm updates for `/`, `/frontend`, and `/cre`; weekly Bun updates for `cre/cre-workflows` packages that commit `bun.lock`; monthly GitHub Actions bumps.
