# pnpm audit triage (4626)

Rolling notes for lockfiles under **root**, **frontend**, **cre**, and **apps/docs-site**. CI summary: [.github/workflows/security-scanning.yml](https://github.com/wenakita/4626/blob/main/.github/workflows/security-scanning.yml) `dependency-audit` job.

Local sweep: `pnpm security:local` at repo root ([scripts/security-audit-local.sh](https://github.com/wenakita/4626/blob/main/scripts/security-audit-local.sh)).

---

## Root — [pnpm-lock.yaml](https://github.com/wenakita/4626/blob/main/pnpm-lock.yaml)

### Remediation applied

| Issue | Mitigation |
|-------|------------|
| **yaml** (moderate, nested collection DoS) | `overrides` + `pnpm.overrides` → **2.8.3** (LayerZero / patch-package transitive). |
| **elliptic** | **patchedDependencies** `patches/elliptic@6.6.1.patch` (EC signing hardening); advisory GHSA-848j still flags **≤6.6.1** because npm lists **no fixed version** (`<0.0.0`). |
| **serialize-javascript** | Override **7.0.5** (mocha chain; ≥7.0.5 patches GHSA-qj8w). |
| **picomatch** | `pnpm.overrides`: `picomatch@2` → **2.3.2**, `picomatch@4` → **4.0.4** (ReDoS / glob matching advisories). |
| **brace-expansion** | Override **5.0.5** (GHSA-f886; ≥5.0.5). |

### Remaining (`pnpm audit`)

| Severity | Package | Notes |
|----------|---------|--------|
| Low | **elliptic** | Via LayerZero V2 tooling (`@layerzerolabs/oapp-evm` → `ethers@5` → `@ethersproject/signing-key`). **No patched release** on npm for GHSA-848j; custom patch mitigates a separate signing issue. **Risk acceptance (time-boxed):** accepted through **2026-07-31** with monthly review. Tracking issue: [#227](https://github.com/wenakita/4626/issues/227). Next review due: **2026-05-15**. In GitHub **Dependabot**, dismiss with reason *“No fixed version; LZ V2 tooling; runtime does not execute ethers v5.”* |

---

## Frontend — [frontend/pnpm-lock.yaml](https://github.com/wenakita/4626/blob/main/frontend/pnpm-lock.yaml)

### Remediation applied

| Issue | Mitigation |
|-------|------------|
| **handlebars** (multiple CVEs, previously **critical**) | `pnpm.overrides.handlebars` → **4.7.9** (dev-only via `@elizaos/core`). |
| **happy-dom** (high, test env) | Bumped devDependency to **^20.8.9**. |
| **yaml** (typedoc chain, moderate) | `pnpm.overrides.yaml` → **2.8.3**. |
| **elliptic** | **patchedDependencies** `frontend/patches/elliptic@6.6.1.patch` + `pnpm.overrides.elliptic` → **6.6.1**. Same GHSA-848j / Dependabot dismiss note as root. |
| **serialize-javascript** | Override **7.0.5** (align with root tooling). |
| **picomatch** | `picomatch@2` → **2.3.2**, `picomatch@4` → **4.0.4**. |
| **brace-expansion** | **5.0.5**. |
| **follow-redirects** | `pnpm.overrides.follow-redirects` → **1.16.0** (fixes GHSA-r4q5-vmmm-2653 custom auth header leak on cross-domain redirects). |

### Current status (2026-04-09)

- `vite` resolved to `7.3.2` (fixes reported moderate/high Vite advisories on `7.3.1`).
- `hono` override updated to `4.12.12` (fixes moderated advisories from `porto` chain).
- Remaining advisory: `elliptic` low only (same no-upstream-fix state as root, tracked in [#227](https://github.com/wenakita/4626/issues/227)).

---

## CRE — [cre/pnpm-lock.yaml](https://github.com/wenakita/4626/blob/main/cre/pnpm-lock.yaml)

| Issue | Mitigation |
|-------|------------|
| **path-to-regexp** (high, express <0.1.13) | `express>path-to-regexp` → **0.1.13** in `overrides` + `pnpm.overrides` (Meteora → express chain). |

### Current status (2026-04-09)

- Upgraded `vitest` to `3.2.4`, which moved transitive `vite` to `7.3.2`.
- `pnpm -C cre audit` is clean.

---

## Docs site — [apps/docs-site/pnpm-lock.yaml](https://github.com/wenakita/4626/blob/main/apps/docs-site/pnpm-lock.yaml)

| Issue | Mitigation |
|-------|------------|
| **path-to-regexp** | `express>path-to-regexp` → **0.1.13** (Docusaurus → webpack-dev-server → express). |
| **serialize-javascript** | **7.0.5** (was 7.0.3). |
| **picomatch** | `picomatch@2` → **2.3.2**, `picomatch@4` → **4.0.4** (fast-glob). |
| **brace-expansion** | **5.0.5**. |
| **follow-redirects** | `pnpm.overrides.follow-redirects` → **1.16.0** (fixes GHSA-r4q5-vmmm-2653). |

---

## Dependabot alerts snapshot (2026-04-14)

| Alert | Status | Resolution / Rationale |
|-------|--------|------------------------|
| [#180](https://github.com/wenakita/4626/security/dependabot/180) `follow-redirects` in `frontend/pnpm-lock.yaml` | **Fixed in repo** | Override and lockfile updated to `follow-redirects@1.16.0` (patched range starts at 1.16.0). |
| [#179](https://github.com/wenakita/4626/security/dependabot/179) `follow-redirects` in `apps/docs-site/pnpm-lock.yaml` | **Fixed in repo** | Override and lockfile updated to `follow-redirects@1.16.0`. |
| [#178](https://github.com/wenakita/4626/security/dependabot/178) `rand` in `tools/vanity-salt-grinder/Cargo.lock` | **Time-boxed risk acceptance** | Transitive constraint from `ethers-core v2.0.14` requires `rand ^0.8`; forcing `0.9.4` fails dependency resolution. Accepted through **2026-07-31**; next review **2026-05-15**. |
| [#177](https://github.com/wenakita/4626/security/dependabot/177) `rand` in `programs/creator-share-hook/Cargo.lock` | **Time-boxed risk acceptance** | Transitive constraint from `solana-zk-sdk v4.0.0` requires `rand ^0.8.5`; forcing `0.9.4` fails dependency resolution. Accepted through **2026-07-31**; next review **2026-05-15**. |

---

## Process

1. After dependency work: `pnpm install` at root, `pnpm --dir frontend install`, `pnpm --dir cre install`, `pnpm --dir apps/docs-site install`; re-run each `pnpm audit`.
2. Prefer **overrides** only when resolution is semver-safe for the whole tree; run `pnpm --dir frontend test` and `forge test` after changes.
3. CI **dependency-audit** posts a summary; it does not block merges until you tighten policy.
4. **Dependency Review** (`.github/workflows/dependency-review.yml`) fails PRs that introduce **high/critical** issues in **runtime and development** scopes per GitHub’s advisory diff—separate from `pnpm audit` text output. Repo setup: [github-supply-chain-setup.md](./github-supply-chain-setup.md).
