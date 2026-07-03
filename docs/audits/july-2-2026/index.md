# 4626 Final Pre-Launch Audit — Index

- **Report ID:** 4626-FABLE-2026-07-FINAL
- **Date:** 2026-07-02
- **Scope:** Full-stack read-only security + release-readiness audit before AKITA canary vault deploy on **v1.15.0** (Base vault Phases 1–4) and Phase 5 (async Solana/Meteora).
- **Repository:** `wenakita/4626` (`main` @ `b221a3a41`)
- **Prior audits diffed:** [`docs/audits/july-1-2026/`](../july-1-2026/audit-report.md) (Solidity), [`docs/audits/july-1-2026/remediation.md`](../july-1-2026/remediation.md), [`docs/audits/fable/full-repo-review-2026-06.md`](../fable/full-repo-review-2026-06.md).

## Deliverables

- [audit-report.md](./audit-report.md) — findings by severity, with file:line, exploit path, recommendation.
- [remediation.md](./remediation.md) — findings → Fixed / Partial / Deferred / Not applicable.
- [delta-vs-july-1.md](./delta-vs-july-1.md) — re-verification of every July 1 High + partial Medium, with regressions and new issues.

## Baseline validation (run 2026-07-02, exact results)

| # | Command | Exit | Result |
|---|---------|------|--------|
| 1 | `forge build` | 0 | PASS — 443 files compiled (Solc 0.8.30). Two submodule revision-mismatch warnings (`acp-cli`, `dgclaw-skill`), non-fatal. |
| 2 | `forge build --sizes` | 1 | **FAIL exit code** — build/sizes emit fine, but the command returns 1 because test **harness** contracts exceed EIP-170: `CreatorLotteryManagerHarness` (-250 B), `CreatorLotteryManagerPauseHarness` (-172 B). No **production** contract is over limit (see below). |
| 3 | `forge test` | 1 | **FAIL** — 1032 passed, **5 failed**, 1 skipped (150 suites). Failures: 4× `DeploymentBatcherThreeWaySplitTest` reset-path + 1× `SeedCreatorRegistryConfigTest`. Both root-caused as test-only staleness (see F-14, F-15). |
| 4 | `pnpm -C frontend lint` | 0 | PASS — 0 warnings, 0 errors. |
| 5 | `pnpm -C frontend typecheck` | 0 | PASS — 0 errors. |
| 6 | `pnpm -C frontend test` | 1 | **FAIL** — 30 failed / 8853 passed / 2 skipped (7 files). Root causes: vitest `@4626/server-core` mock drift (rate-limit config) + deploy-session mock/handler drift after v1.15.0 refactor (see F-12). |
| 7 | `pnpm -C frontend guard:canonical-csw` | 0 | PASS. |
| 8 | `pnpm -C frontend guard:schema` | 0 | PASS — no raw DDL in server production code. |
| 9 | `pnpm -C kpr typecheck` | 2 | **FAIL** — `actions/keepr-solana-winner-relay.action.ts:227` TS2339: `Property 'args' does not exist on type 'Log<...>'`. Regresses the documented "KPR baseline clean" launch gate (see F-13). |
| 10 | `./test/current-release-target-guard.sh` | 0 | PASS — "current split Phase-1 release target guard passed"; pins v1.15.0 + DeploymentBatcher `0x17163e67…6D33`. |

### Production contract EIP-170 headroom (from `forge build --sizes`)

| Contract | Runtime (B) | Margin (B) |
|----------|-------------|------------|
| `CreatorLotteryManager` | 24,568 | **8** |
| `CreatorShareOFT` | 23,854 | 722 |
| `CreatorOVault` | 23,179 | 1,397 |
| `CreatorRegistry` | 21,213 | 3,363 |
| `CreatorOVaultCoreModule` | 20,131 | 4,445 |
| `DeploymentBatcher` (shell) | 17,876 | 6,700 |

No production contract exceeds 24,576 B. `CreatorLotteryManager` remains 8 B under the hard limit — any further change to that contract forces a redeploy/refactor.

## Findings summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 6 |
| Medium | 14 |
| Low | 12 |
| Informational | 6 |

## Overall risk rating

- **Pre-remediation (current `main`):** **HIGH** — driven by one Critical (Solana hook entry forgery, currently fenced by paused relay), two RED CI gates (`pnpm -C frontend test`, `pnpm -C kpr typecheck`) that contradict documented baselines, and several deploy/keeper trust-boundary gaps that are enforced only in one of multiple write paths.
- **Post-remediation (if release-readiness verdict actions are completed):** **MEDIUM-LOW** for the Base vault (Phases 1–4); **HIGH** for Phase 5 Solana until the transfer-hook authentication findings (C-01 / F-04 / F-05 Solana) are fixed.

See the [release-readiness verdict](./audit-report.md#release-readiness-verdict) at the end of the audit report.
