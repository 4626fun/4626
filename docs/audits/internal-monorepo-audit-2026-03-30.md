# Internal monorepo audit — 2026-03-30

**Index:** [docs/audits/README.md](./README.md)

Evidence captured from a clean workspace run. This document implements the layered audit plan (scope → automation → doc delta → trust boundaries → production parity checklist).

---

## 1. Scope, goal, and out-of-scope

| Decision | Choice |
|----------|--------|
| **Audit type** | **Combined**: (a) engineering hygiene and CI parity, (b) application/trust-boundary review aligned with [AGENTS.md](https://github.com/wenakita/4626/blob/main/AGENTS.md), (c) protocol/economic pointers via existing [system.md](./system.md) (no new formal verification). |
| **Timebox** | Single pass: automation + documentation synthesis + representative code pointers (not a full external security review). |
| **In scope** | First-party code under `contracts/` (root Forge project), `frontend/` (SPA + Vercel API), `cre/` workflows, documented ops constants in AGENTS.md. |
| **Out of scope** | Deep review of vendored `lib/**` submodules (treat as pinned third-party; only integrity noted). Full live bytecode diff against production (requires deploy artifacts and RPC; checklist only). Formal Slither/Semgrep campaigns (plan layer 4 optional tools). |

---

## 2. Layer 1 — Automated baseline (archived results)

Commands run: `2026-03-30` (workspace: `/home/akitav2/projects/4626`).

| Check | Command | Result |
|-------|---------|--------|
| Forge tests | `forge test --summary` | **Pass** (exit 0); full suite green. |
| Forge build | `forge build --sizes` | **Exit 1** — some contracts exceed EIP-170 runtime size (expected; matches CI `|| true` non-blocking behavior in [.github/workflows/test.yml](https://github.com/wenakita/4626/blob/main/.github/workflows/test.yml)). |
| Frontend tests | `pnpm -C frontend test --run` | **Pass** — 304 files, 1682 tests, ~101s. |
| ESLint | `pnpm -C frontend lint` | **Pass** (max-warnings 0). |
| TypeScript | `pnpm -C frontend typecheck` | **Pass** (app + node configs). |
| CRE workflows | `bash cre/cre-workflows/scripts/typecheck-workflows.sh` | **Pass** (all listed packages typecheck). |

**CI:** The `api-tests` job in [.github/workflows/test.yml](https://github.com/wenakita/4626/blob/main/.github/workflows/test.yml) runs `pnpm --dir frontend lint` and `typecheck` before Vitest. PR supply chain: [.github/workflows/dependency-review.yml](https://github.com/wenakita/4626/blob/main/.github/workflows/dependency-review.yml) (high+ vulns, runtime **and** development scopes; setup [github-supply-chain-setup.md](./github-supply-chain-setup.md)). Version bumps: [.github/dependabot.yml](https://github.com/wenakita/4626/blob/main/.github/dependabot.yml) (root, frontend, cre, Bun workflows, GitHub Actions).

### Dependency audit

| Lockfile | Command | Result |
|----------|---------|--------|
| Root | `pnpm audit` | **Reduced** after `yaml` override **2.8.3**; remaining items are mostly dev/transitive (`picomatch`, `brace-expansion`, `elliptic`). See [npm-advisories-triage.md](./npm-advisories-triage.md) root section. |
| Frontend | `pnpm audit` | **Reduced** after triage: handlebars override, `happy-dom` bump, `yaml` override — see current counts in [npm-advisories-triage.md](./npm-advisories-triage.md). |

**Action:** Track upstream fixes; prioritize critical/high in the **production** dependency graph; accept or document dev-only transitive risk (e.g. `picomatch` via ESLint / `@vercel/node`). **CI:** [.github/workflows/security-scanning.yml](https://github.com/wenakita/4626/blob/main/.github/workflows/security-scanning.yml) includes `dependency-audit` (report-only), **gitleaks** (incremental), **semgrep-api** (**blocking** on `frontend/api` + `frontend/server/_lib`), and **slither-contracts** (Foundry + `slither --fail-none`, **report-only** job). Slither uses root [slither.config.json](https://github.com/wenakita/4626/blob/main/slither.config.json) `filter_paths` to drop vendored `lib/` / `node_modules` noise from reports (~460 fewer findings vs unfiltered).

### Secret scan

| Tool | Result |
|------|--------|
| `gitleaks` | **CI:** [.github/workflows/security-scanning.yml](https://github.com/wenakita/4626/blob/main/.github/workflows/security-scanning.yml) runs the open-source `gitleaks` CLI on **incremental commit ranges** (PR `base..head`, push `before..after`, or single commit when `before` is all zeros). Config: [gitleaks.toml](https://github.com/wenakita/4626/blob/main/gitleaks.toml) (allowlists vendored snapshots, known doc/test noise). **Manual:** install [gitleaks](https://github.com/gitleaks/gitleaks) locally for full-history scans. |

### Submodule integrity

```
148a0e1c4d549a12e2e91cf03442345138377a5b lib/continuous-clearing-auction (v1.1.0-2-g148a0e1)
7117c90c8cf6c68e5acce4f09a6b24715cea4de6 lib/forge-std (v1.12.0)
a50af7b5cc2c79863587f4797d4478c1612605d1 lib/liquidity-launcher (v2.0.0-5-ga50af7b)
```

Record these SHAs in release notes when tagging deploys.

---

## 3. Layer 2 — Doc-driven delta checklist ([system.md](./system.md))

The system audit remains the authoritative protocol narrative. Below: **status vs current tree** without re-proving economics (requires dedicated review).

| Theme from system.md §14–15 | Delta / follow-up |
|-----------------------------|-------------------|
| `ve4626` total-power denominator / boost fairness | **Still open** — source-level concern; verify any post-doc code changes in `ve4626.sol` / `ve4626BoostManager.sol`. |
| `emergencyResetAllVotes` governance risk | **Still open** — confirm admin controls (multisig/timelock) in deployment policy. |
| Docs vs code (AMOE, `minVaultWeightBps`) | **Still open** — system.md flags absence in source; reconcile before claiming parity. |
| Bytecode / ABI parity | **Not verified this run** — execute Layer 5 for production tags. |
| Must-inspect checklist (§15) | **Still valid** — use as contract review script for any touch to listed files. |
| “Would I ship…” posture | **Unchanged** — operational hardening items in system.md remain the release gate, not CI green alone. |

**Related adversarial/Q&A docs** (read alongside system.md for subsystem depth): `docs/audits/ajna/master-qna.md`, `docs/audits/charm/master-qa.md`, `docs/operations/telegram-canonical-link-preservation.md` (app layer).

---

## 4. Layer 3 — Trust-boundary trace (AGENTS.md → code)

| Boundary rule (AGENTS.md) | Attacker model (short) | Implementation pointers | Residual risk |
|---------------------------|-------------------------|---------------------------|---------------|
| Deploy status / preflight **read-only**; no infra mutation as side effect | Malicious or buggy deploy UI triggers unintended onchain/offchain writes | Deploy session: `preflightOnly` path and rate limits in [frontend/api/_handlers/deploy/session/_create.ts](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts); Solana preflight wiring in [_status.ts](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_status.ts), [_continue.ts](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_continue.ts). | Preflight still depends on correct client flags and handler branching; review any new deploy endpoints for the same split. |
| Internal Solana mutation requires **machine auth**; no ambient session fallback for privileged setup | Stolen user session used to provision routes | `registerSolanaBridgeToken`: [readDeployAuthFromRequest](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deployAuth.ts) (session or SIWA agent); registration secret checks (`DEPLOY_SOLANA_REGISTRATION_SECRET`). CRE/keeper: `KEEPR_API_KEY` on [cre/keeper/_sweep.ts](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/keeper/_sweep.ts), [_markSettled.ts](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/keeper/_markSettled.ts), [_solanaReconcile.ts](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/keeper/_solanaReconcile.ts), [cre/vaults/_active.ts](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts), [keepr/actions/_updateStatus.ts](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/keepr/actions/_updateStatus.ts); status: [_solanaInfraStatus.ts](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/_solanaInfraStatus.ts). | `KEEPR_API_KEY` secrecy is critical; rotate on leak; ensure no route registers tokens without aligned auth + secrets. |
| Telegram Mini App link completion requires **fresh session proof** | Forged or replayed Telegram context | [miniAppAuth.ts](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts) (initData hash, replay keying); tests in [telegramMiniAppAuth.test.ts](https://github.com/wenakita/4626/blob/main/frontend/api/__tests__/telegramMiniAppAuth.test.ts), [telegramEndpoints.test.ts](https://github.com/wenakita/4626/blob/main/frontend/api/__tests__/telegramEndpoints.test.ts). | Depends on `TELEGRAM_BOT_TOKEN` and clock/skew policy; keep tests in sync with WebView behavior. |
| Link-start tokens **single-use / claim-bound** | Token replay across users | `createTelegramLinkStartToken` / `consumeTelegramActionToken` usage in [_webhook.runtime.ts](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/_webhook.runtime.ts) (e.g. vault deploy flows). | Audit any new callback paths for consume-on-success semantics. |
| Group-scoped Telegram actions **owner-scoped** | Non-owner mutates shared bot state | Enforced in callback/update handlers under [frontend/api/_handlers/telegram/webhook/](https://github.com/wenakita/4626/tree/main/frontend/api/_handlers/telegram/webhook/) (review diffs when adding group features). | Requires per-feature verification; not exhaustively proven in this pass. |

**Telegram canonical order** (email OTP, Privy sync, link persistence): see [docs/operations/telegram-canonical-link-preservation.md](../operations/telegram-canonical-link-preservation.md) and [frontend/docs/account-auth-invariants.md](/frontend/docs/account-auth-invariants).

---

## 5. Layer 5 — Production parity checklist (operational)

Worksheet copy: [production-parity-checklist.md](./production-parity-checklist.md).

Perform before high-stakes release or investor diligence:

1. **Bytecode** — Compare deployed contracts to artifact from tagged commit; reconcile proxies/implementation addresses.
2. **Environment** — `APP_ORIGIN`, `MARKETING_ORIGIN`, `CANONICAL_ORIGIN`, cron `CRON_SECRET`, LayerZero peers, VRF config match runbooks.
3. **Keys** — Protocol treasury Safe, adapter owner, `KEEPR_API_KEY`, Solana deployer (`SOLANA_PRIVATE_KEY` / upgrade authority per AGENTS.md).
4. **Documented constants** — e.g. Solana program ID `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU`, batcher/adapter addresses in AGENTS.md — confirm still current onchain.
5. **Submodule pins** — Match §2 SHAs to what was used for the deployed build.

---

## 6. Summary

- **Hygiene:** Forge tests pass; frontend lint/typecheck/tests pass; CRE workflow typecheck passes. `forge build --sizes` fails on EIP-170 (known).  
- **Supply chain:** Frontend audit count reduced (see [npm-advisories-triage.md](./npm-advisories-triage.md)); CI runs gitleaks, `pnpm audit` summary, and informational Semgrep on API/server lib.  
- **Protocol:** Defer to [system.md](./system.md) + §3 delta; no contradictions found in this automation-only pass.  
- **App trust boundaries:** Mapped to concrete handlers; machine-auth and Telegram proof paths are test-backed.  
- **Next hardening:** Follow [npm-advisories-triage.md](./npm-advisories-triage.md) for remaining dev transitive advisories; optionally make **Slither** or **pnpm audit** blocking after triage; execute production parity checklist (§5) against live deploy.
