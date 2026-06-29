---
title: CI/CD analysis lane
sidebar_label: c1a231e1…
sidebar_position: 99
hide_table_of_contents: true
last_updated: '2026-06-28'
audience:
  - developers
  - protocols
stage: use
owner: docs-team
last_reviewed: '2026-06-28'
status: current
---
<div class="audit-transcript-meta">
[← Source sessions](/audits/fable/key-sessions) · [Transcript archive](/audits/fable/transcripts) · [Executive summary](/audits/fable/findings-summary)
</div>
# CI/CD analysis lane
| Field | Value |
| --- | --- |
| Session ID | `c1a231e1-de11-411d-9fae-9dd6981163e4` |
| Parent session | `0a513245-3ae2-4076-a9b0-bc1de524c38f` |
| Review model | Cursor Fable 5 (`claude-fable-5-thinking-high`) |
:::note Appendix record
Readable export of an agent-assisted review session. Tool outputs and system context blocks are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## User

You are doing the CI/CD + supply-chain pass of a full-codebase review of the 4626 monorepo at /home/akitav2/projects/4626. READ-ONLY: do not modify files.

Review ALL workflow files in .github/workflows/ (about 17: accessibility.yml, acp-daily-market-news.yml, alfaclub-auth-health-monitor.yml, alfaclub-preflight.yml, builder-codes-guardrails.yml, cloudflare-alfaclub-proxy-deploy.yml, control-plane-stuck-scan.yml, dependency-review.yml, deploy-alfaclub-proxy.yml, docs.yml, eliza-runtime-guardrails.yml, env-example-address-check.yml, orphan-guard.yml, protocol-assets.yml, security-scanning.yml, test.yml, zk-pipeline-guards.yml).

For each workflow report: trigger, what it runs, whether it has an explicit least-privilege `permissions:` block, whether it uses secrets, whether it's safe for fork PRs (pull_request_target usage? secrets exposed to untrusted code?), whether actions are pinned (SHA vs tag), and whether it blocks merges.

Then answer concretely with file:line evidence:
1. Does CI run the full canonical gate set (frontend lint/typecheck/test, forge test, guards: schema, canonical-csw, boundaries, kpr typecheck)? What's missing from test.yml?
2. Any workflow with write-permissions + untrusted input (script injection via github.event context interpolated into run: blocks)?
3. Are deployments (cloudflare proxy deploys, protocol-assets) restricted to trusted branches/actors?
4. Is dependency caching keyed correctly to lockfiles?
5. Is security-scanning.yml actually blocking (Semgrep blocking per docs) and is gitleaks configured sanely (also read gitleaks.toml at repo root for overly broad allowlists)?
6. dependency-review.yml configuration (severity threshold, scopes).
7. Root package.json + frontend/package.json dependency posture: huge overrides pin list, patched elliptic, any suspicious install scripts (check pnpm.onlyBuiltDependencies in frontend/package.json), deprecated packages.
8. Any cron-scheduled workflow that could fail silently (no alerting)?

Return findings sorted by severity with file:line citations, plus a list of verified-sound items. Thoroughness: very thorough.

## Assistant

Starting a read-only CI/CD and supply-chain review: I'll read every workflow under `.github/workflows/` and the related config files you listed.

[REDACTED]

*Tools invoked:* UpdateCurrentStep, Glob, Read, Read, Grep

## Assistant

[REDACTED]

*Tools invoked:* Read, Read, Read, Read, Read, Read, Read, Read, Read

## Assistant

[REDACTED]

*Tools invoked:* Read, Read, Read, Read, Read, Read, Read, Read, Grep

## Assistant

[REDACTED]

*Tools invoked:* Grep, Grep, Read, Grep, Grep

## Assistant

[REDACTED]

*Tools invoked:* Read, Read, Read, Glob, Grep, Read

## Assistant

[REDACTED]

*Tools invoked:* Grep, Grep, Read, Grep, Read

## Assistant

[REDACTED]

*Tools invoked:* Read, Grep, Grep, Grep, Read

## Assistant

[REDACTED]

*Tools invoked:* Glob, Grep, Read

## Assistant

[REDACTED]

*Tools invoked:* Glob, Grep

## Assistant

[REDACTED]

*Tools invoked:* Read, Grep

## Assistant

[REDACTED]

*Tools invoked:* UpdateCurrentStep

## Assistant

# CI/CD + Supply-Chain Review (4626 monorepo)

Read-only review of all 17 workflows under `.github/workflows/`, plus `gitleaks.toml`, root/`frontend`/`kpr` `package.json`, and `docs/audits/README.md`.

---

## Findings by severity

### Critical

**1. Semgrep is documented as blocking but likely does not fail the job**

```217:227:.github/workflows/security-scanning.yml
      - name: Scan API handlers and shared server lib
        run: |
          docker run --rm -v "$GITHUB_WORKSPACE:/src" semgrep/semgrep:latest semgrep scan \
            --metrics=off \
            --timeout=5 \
            --config=p/typescript \
            --config=p/javascript \
            /src/frontend/api \
            /src/frontend/server/_lib \
            /src/frontend/packages/server-core/src \
            2>&1 | tee "$RUNNER_TEMP/semgrep.txt"
```

The scan step pipes to `tee` without `set -o pipefail`. On GitHub Actions’ default bash, the step exit code is `tee`’s (0), not Semgrep’s. There is no follow-up step that `exit 1` on findings—only a summary step (`if: always()`). **AGENTS.md and `docs/audits/README.md` claim blocking Semgrep; the workflow probably does not enforce that.**

**2. `control-plane-stuck-scan.yml` appears broken (wrong package manager / missing lockfile)**

```15:27:.github/workflows/control-plane-stuck-scan.yml
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - name: Run control-plane stuck scan
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          CONTROL_PLANE_STUCK_FAIL_ON_FOUND: '1'
          CONTROL_PLANE_ALERT_WEBHOOK_URL: ${{ secrets.CONTROL_PLANE_ALERT_WEBHOOK_URL }}
        run: npm run control-plane:stuck-scan
```

`frontend/` uses pnpm (`frontend/pnpm-lock.yaml`); there is **no** `frontend/package-lock.json`. The script is `tsx`-based (`frontend/package.json:76`). This cron job likely fails at `npm ci` every 30 minutes—**silent operational blind spot** unless someone watches Actions failures.

---

### High

**3. Duplicate Cloudflare AlfaClub proxy deploy on every `main` push to proxy paths**

Both workflows fire on the same paths and branch:

```4:9:.github/workflows/cloudflare-alfaclub-proxy-deploy.yml
  push:
    branches:
      - main
    paths:
      - alfaclub/infra/cloudflare-proxy/**
      - .github/workflows/cloudflare-alfaclub-proxy-deploy.yml
```

```4:8:.github/workflows/deploy-alfaclub-proxy.yml
  push:
    branches: [main]
    paths:
      - "alfaclub/infra/cloudflare-proxy/**"
      - ".github/workflows/deploy-alfaclub-proxy.yml"
```

One uses `cloudflare/wrangler-action@v3` (tag, not SHA); the other runs `pnpm exec wrangler deploy` with `@v4` actions. **Double deploy + inconsistent pinning/toolchain.**

**4. `test.yml` missing canonical gates from AGENTS.md**

Present in `api-tests` job: lint, typecheck, test, `guard:schema`, `guard:canonical-csw`, many other guards.

**Missing:**

| Gate | AGENTS.md / local script | In CI? |
|------|--------------------------|--------|
| `pnpm -C frontend guard:frontend-boundaries` | `frontend/package.json:118`, AGENTS.md | **No** |
| `pnpm -C kpr typecheck` | `kpr/package.json:8`, `security-audit-local.sh:9-11` | **No** (only partial KPR vitest in `strategy-reallocator-guards`) |
| `guard:sc-hygiene` | `security-audit-local.sh:53-65` | **No** |
| KPR workflow layout/typecheck scripts | `security-audit-local.sh:10-11` | **No** |

**5. `security-scanning.yml` `dependency-audit` omits `kpr/` lockfile**

```181:188:.github/workflows/security-scanning.yml
      - name: Root lockfile audit
        run: pnpm install --frozen-lockfile && pnpm audit --audit-level high ...
      - name: Frontend lockfile audit
        run: pnpm --dir frontend install --frozen-lockfile && pnpm --dir frontend audit ...
      - name: Docs site lockfile audit
        run: pnpm --dir apps/docs-site install --frozen-lockfile && pnpm --dir apps/docs-site audit ...
```

`docs/audits/README.md:29` says audits include `kpr/`; **the workflow does not.**

**6. Several workflows use unpinned `@v3`/`@v4` actions (supply-chain drift)**

| File | Unpinned |
|------|----------|
| `control-plane-stuck-scan.yml:15-16` | `actions/checkout@v4`, `actions/setup-node@v4` |
| `orphan-guard.yml:18` | `actions/checkout@v4` |
| `env-example-address-check.yml:24` | `actions/checkout@v4` |
| `deploy-alfaclub-proxy.yml:23-30` | `checkout@v4`, `pnpm/action-setup@v4`, `setup-node@v4` |
| `cloudflare-alfaclub-proxy-deploy.yml:28` | `cloudflare/wrangler-action@v3` |

Majority of workflows (test, security-scanning, docs, etc.) **do** pin SHAs—good baseline, inconsistent enforcement.

**7. Unpinned runtime dependencies in security jobs**

- Semgrep: `semgrep/semgrep:latest` (`security-scanning.yml:215`)
- Slither: `pip install slither-analyzer` (no version pin, `security-scanning.yml:270`)
- ACP cron: `npm i -g @virtuals-protocol/acp-cli` (`acp-daily-market-news.yml:44`)

---

### Medium

**8. `gitleaks.toml` global allowlist is broad; tracked env backups exempted**

Global path exemptions include entire trees and legacy env files:

```12:28:gitleaks.toml
paths = [
  '''^design/audit-source-snapshots/''',
  ...
  '''^bAlanciaga-master/''',
]
```

Rule-scoped `generic-api-key` also exempts **tracked** (not just example) env backups:

```89:94:gitleaks.toml
  '''^frontend/\.env\.backup$''',
  '''^frontend/\.env\.production$''',
  '''^frontend/\.env\.vars$''',
```

Provider-specific detectors still apply per comments, but **any secret matching only `generic-api-key` in those paths is invisible**. The `bAlanciaga-master/` global exemption disables **all** detectors for that tree.

**9. `docs/audits/README.md` stale vs actual Slither behavior**

README says Slither is “report-only” (`docs/audits/README.md:29`), but `security-scanning.yml:283-298` **fails on high-impact findings** on `main`/`master` PRs and pushes. Documentation drift risks wrong merge assumptions.

**10. `test.yml` jobs without explicit `permissions:`**

`test.yml`, `docs.yml`, `builder-codes-guardrails.yml`, `orphan-guard.yml`, `accessibility.yml`, `env-example-address-check.yml`, `protocol-assets.yml`, `control-plane-stuck-scan.yml` lack `permissions:` blocks. Repo default may be read-only for `GITHUB_TOKEN`, but **least-privilege is not explicit** (contrast `security-scanning.yml:17-18`, `dependency-review.yml:10-11`).

**11. `test-summary` job re-runs full `forge test` on every PR/push**

```251:257:.github/workflows/test.yml
      - name: Run all tests and generate summary
        run: |
          ...
          forge test --summary 2>&1 | tee test_output.txt
```

Redundant with `test` job (`test.yml:80-81`); failure **does** block. Wastes CI minutes, not a security defect.

**12. `zk-pipeline-guards.yml` `workflow_dispatch` passes inputs to shell unquoted**

```88:91:.github/workflows/zk-pipeline-guards.yml
          amoe/tools/ci/check_manager_amoe_surface.sh \
            "${{ github.event.inputs.manager_address }}" \
            "${{ github.event.inputs.manager_rpc }}"
```

`workflow_dispatch` only—maintainer-trusted. Quoting is present; low practical injection risk unless a maintainer dispatches malicious input.

---

### Low / informational

**13. Non-blocking jobs (intentional)**

- `accessibility.yml:18` — `continue-on-error` unless `vars.A11Y_CI_BLOCKING=true`
- `test.yml:78` — CLM size warn guard `continue-on-error: true`
- `test.yml:288` — coverage `continue-on-error: true`
- `dependency-review.yml:66-73` — skips with `::notice` when Dependency Review API unavailable (private repo without GHAS)

**14. `slither-launch-gate` weakens forge size check on `launch/*` only**

```342:343:.github/workflows/security-scanning.yml
      - name: Forge build
        run: forge build --sizes || true
```

Launch branches still block on high Slither impact; EIP-170 gate is softened.

**15. Root `prepare` script runs husky**

```22:22:package.json
    "prepare": "husky || true",
```

No `postinstall`/`preinstall` in frontend; `onlyBuiltDependencies` limits native builds (`frontend/package.json:246-251`: esbuild, sharp, bufferutil, etc.)—**sane pnpm posture**.

**16. Large override + patch surface (managed, not suspicious)**

- Root + frontend duplicate security pins (axios, undici, ws, svix>uuid, elliptic, etc.)
- Patches: `elliptic@6.6.1` (EC sign bit-length fix), `@coinbase/wallet-sdk`, `viem`, `ox` (`frontend/package.json:300-305`)
- `svix>uuid: 10.0.0` override (AGENTS.md CJS compatibility)—appropriate

---

## Per-workflow matrix (all 17)

| Workflow | Trigger | Runs | `permissions:` | Secrets | Fork PR safe? | Actions pinned? | Blocks merge? |
|----------|---------|------|------------------|---------|---------------|-----------------|---------------|
| **test.yml** | PR/push `main`,`master` | Forge build+sizes, forge test, frontend guards/lint/typecheck/test, KPR subset tests, summaries, optional prod agent check | **No** | Test HMAC env only | Yes (no prod secrets) | **SHA** | **Yes** (except `coverage`, size-warn) |
| **security-scanning.yml** | PR/push, cron 07:13 UTC, dispatch | Gitleaks incr+full-history, pnpm audit×3, Semgrep, Slither+high gate, launch Slither | `contents: read` | None | Yes | **SHA** (gitleaks manual install) | **Yes** (Semgrep effectively **no**—see Critical #1) |
| **dependency-review.yml** | PR `main`,`master` | GH API availability probe; dependency-review-action | `contents: read` | `github.token` only | Yes | **SHA** | **Yes** if supported; else skipped |
| **accessibility.yml** | PR/push | lint:a11y, axe smoke | **No** | None | Yes | **SHA** | **Only if** `A11Y_CI_BLOCKING=true` |
| **docs.yml** | PR/push (path filters) | Docs drift, hygiene, regen check | **No** | None | Yes | **SHA** | **Yes** when docs-sensitive |
| **zk-pipeline-guards.yml** | PR (paths), push `main`, dispatch | AMOE patch guard, forge ZK tests, optional manager probe | `contents: read` | None | Yes | **SHA** | **Yes** |
| **builder-codes-guardrails.yml** | PR/push (paths) | Builder codes assert/verify/tests | **No** | Test secrets in env | Yes | **SHA** | **Yes** when triggered |
| **eliza-runtime-guardrails.yml** | PR (paths), dispatch | Railway/env grep, vitest guardrails | **No** | None | Yes | **SHA** | **Yes** when triggered |
| **env-example-address-check.yml** | PR (paths) | Allowlisted address scan | **No** | None | Yes | **Tag @v4** | **Yes** when triggered |
| **orphan-guard.yml** | PR/push `main`, dispatch | `check_no_orphan_addresses.sh` | **No** | None | Yes | **Tag @v4** | **Yes** |
| **protocol-assets.yml** | PR/push (paths) | `verify:protocol-assets` | **No** | None | Yes | **SHA** | **Yes** when triggered |
| **cloudflare-alfaclub-proxy-deploy.yml** | push `main` (paths), dispatch | Wrangler deploy | `contents: read` | `CLOUDFLARE_*` | N/A (not PR) | **Tag @v3** | N/A (deploy) |
| **deploy-alfaclub-proxy.yml** | push `main` (paths), dispatch | pnpm + wrangler deploy | job: `contents: read` | `CLOUDFLARE_*` | N/A | **Tag @v4** | N/A (deploy) |
| **alfaclub-preflight.yml** | **dispatch only** | forge build + alfaclub tests | `contents: read` | None | N/A | **SHA** | Manual |
| **alfaclub-auth-health-monitor.yml** | cron `*/5`, dispatch | Health probe script | `contents: read` | `ALFACLUB_HEALTH_CRON_SECRET` | N/A | **SHA** | Cron fail = alert |
| **acp-daily-market-news.yml** | cron 07:00/13:00 UTC, dispatch | ACP CLI runner | `contents: read` | `ACP_*` (4) | N/A | **SHA** | Cron fail visible |
| **control-plane-stuck-scan.yml** | cron `*/30`, dispatch | stuck-scan (broken install) | **No** | `DATABASE_URL`, webhook | N/A | **Tag @v4** | Likely always red |

**`pull_request_target`:** none found—**good for fork PR secret isolation**.

---

## Concrete answers

### 1. Does CI run the full canonical gate set? What’s missing from `test.yml`?

**In CI across workflows (not all in `test.yml`):**

| Gate | Where |
|------|-------|
| `pnpm -C frontend lint` | `test.yml:121` |
| `pnpm -C frontend typecheck` | `test.yml:145` |
| `pnpm -C frontend test` | `test.yml:148` |
| `forge test` | `test.yml:81` |
| `guard:schema` | `test.yml:112` |
| `guard:canonical-csw` | `test.yml:115` |
| `guard:server-core-boundary` | `test.yml:109` (extra) |

**Missing from `test.yml` (and mostly absent elsewhere):**

- `pnpm -C frontend guard:frontend-boundaries` — **not in any workflow**
- `pnpm -C kpr typecheck` — **not in any workflow**
- `guard:sc-hygiene` — local only (`security-audit-local.sh:53`)
- KPR `kpr-workflows` layout/typecheck scripts — local only (`security-audit-local.sh:10-11`)
- `pnpm -C kpr audit` — docs claim it; workflow audits root/frontend/docs-site only

Also split across `security-scanning.yml`: gitleaks, pnpm audit, Semgrep (broken gate), Slither.

### 2. Write permissions + untrusted input / script injection?

- **No `pull_request_target`** — fork PRs do not get maintainer secrets.
- **Deploy workflows** use secrets only on `push` to `main` or `workflow_dispatch` (trusted actors)—appropriate.
- **Interpolated `github.event` in `run:` blocks:**
  - `security-scanning.yml:68,73-78` — commit SHAs in gitleaks `--log-opts` (hex; low risk)
  - `docs.yml:81-84` — SHAs exported to env (low risk)
  - `zk-pipeline-guards.yml:90-91` — dispatch inputs (maintainer-only)
  - `acp-daily-market-news.yml:50-88` — dispatch inputs in bash (maintainer-only)
- **No workflow grants `permissions: write` explicitly** except implicit defaults; deploy uses Cloudflare tokens in env, not `GITHUB_TOKEN` writes.

### 3. Deployments restricted to trusted branches/actors?

**Yes for Cloudflare:**

- Both deploy workflows: `branches: [main]` only (`cloudflare-alfaclub-proxy-deploy.yml:5-6`, `deploy-alfaclub-proxy.yml:5`)
- `workflow_dispatch` requires repo write access
- `protocol-assets.yml` only **verifies** assets—no deploy

**No PR/fork path can deploy** (push to `main` is post-merge).

### 4. Dependency caching keyed to lockfiles?

| Job | Cache config | Correct? |
|-----|--------------|------------|
| `test.yml` `api-tests` | `cache-dependency-path: frontend/pnpm-lock.yaml` | Yes |
| `test.yml` `strategy-reallocator-guards` | `kpr/pnpm-lock.yaml` | Yes |
| `test.yml` `test`/others | `cache: pnpm` (default root `pnpm-lock.yaml`) | Yes for root install |
| `docs.yml` | root + frontend + docs-site lockfiles | Yes |
| `security-scanning.yml` dependency-audit | **No cache** (fresh install each job) | OK, slower |
| `control-plane-stuck-scan.yml` | `frontend/package-lock.json` | **Wrong—file missing** |

### 5. `security-scanning.yml` blocking? Gitleaks sane?

**Gitleaks — generally sound:**

- SHA-256 verified install (`security-scanning.yml:42-59`)
- Incremental + full-history jobs (`security-scanning.yml:21-163`)
- `permissions: contents: read`
- Rule-scoped test allowlists preserve provider detectors (`gitleaks.toml:42-58`)

**Caveats:** global `bAlanciaga-master/` exemption; tracked `.env.backup`/`.env.production` in rule-scoped paths (`gitleaks.toml:89-94`).

**Semgrep — not reliably blocking** (Critical #1).

**Slither — blocking on high impact** via separate Python step (`security-scanning.yml:283-298`), despite `| tee` on scan step.

**pnpm audit — blocking high+critical** for root, frontend, docs-site (`security-scanning.yml:177-188`).

### 6. `dependency-review.yml` configuration

```60:64:.github/workflows/dependency-review.yml
        with:
          fail-on-severity: high
          fail-on-scopes: runtime, development
          license-check: true
```

Availability gracefully skipped for private repos without GHAS (`dependency-review.yml:66-73`).

### 7. Dependency posture (root + frontend)

- **Heavy but intentional overrides** for known CVEs/transitive pins (axios, undici, ws, minimatch, tar, uuid/svix, OpenZeppelin alignment).
- **Patched `elliptic@6.6.1`** — deterministic-k truncation fix (`patches/elliptic@6.6.1.patch`).
- **`onlyBuiltDependencies`** whitelists native builds (`frontend/package.json:246-251`) — reduces surprise install scripts.
- **No `postinstall`/`preinstall`** in frontend package.json.
- **Vendor path:** `kpr` uses `bigint-buffer: file:./vendor/bigint-buffer` — vendored, not arbitrary script.
- **Dependabot** covers `/`, `/frontend`, `/kpr`, Bun workflow dirs, GitHub Actions monthly (`.github/dependabot.yml`).

### 8. Cron workflows — silent failure risk?

| Cron workflow | Alerting | Risk |
|---------------|----------|------|
| `alfaclub-auth-health-monitor.yml` | Failed run = documented alert (`alfaclub-auth-health-monitor.yml:8-11`) | Low if notifications on |
| `security-scanning.yml` gitleaks-full-history | Fails job | Low |
| `acp-daily-market-news.yml` | Fails job | Medium (must watch Actions) |
| `control-plane-stuck-scan.yml` | Webhook + `FAIL_ON_FOUND` | **High—likely broken install; chronic red or ignored** |

---

## Verified-sound items

1. **No `pull_request_target`** anywhere — fork PRs don’t receive maintainer secrets.
2. **SHA-pinned actions** on primary gates (`test.yml`, `security-scanning.yml`, `docs.yml`, `zk-pipeline-guards.yml`, etc.).
3. **`permissions: contents: read`** on security scanning, dependency review, several ops workflows.
4. **`--frozen-lockfile`** on pnpm installs in CI.
5. **`scripts/check-forbidden-tracked-files.sh`** at start of main test jobs (`test.yml:24,93`).
6. **Gitleaks tarball checksum verification** before install.
7. **Gitleaks full-history job** prevents allowlist regression (`security-scanning.yml:87-154`).
8. **EIP-170 blocking** via `forge build --skip test --sizes` (`test.yml:63`, `security-scanning.yml:278`).
9. **Deploy paths gated to `main` only** with path filters.
10. **Dependency review** high+ / runtime+development / license-check when API available.
11. **ZK AMOE patch guard** prevents snarkjs regression (`zk-pipeline-guards.yml`).
12. **`.env.example` address allowlist** prevents protocol address leaks (`env-example-address-check.yml`).
13. **`svix>uuid` pin** and **pnpm `onlyBuiltDependencies`** — aligned with documented supply-chain fixes.

---

## Recommended fixes (guidance only — Ask mode)

1. Add `set -o pipefail` before Semgrep `docker run | tee`, or drop the pipe; add an explicit findings gate step.
2. Rewrite `control-plane-stuck-scan.yml` to pnpm + `frontend/pnpm-lock.yaml` (mirror `alfaclub-auth-health-monitor.yml`).
3. Consolidate to one Cloudflare deploy workflow; pin wrangler-action by SHA.
4. Add `guard:frontend-boundaries` and `pnpm -C kpr typecheck` to `test.yml` `api-tests` job.
5. Add `pnpm -C kpr audit --audit-level high` to `security-scanning.yml`; update `docs/audits/README.md` for Slither/Semgrep truth.
6. Pin remaining `@v4`/`@v3` actions and Semgrep/Slither/ACP CLI versions.
7. Tighten `gitleaks.toml` global allowlist (shrink `bAlanciaga-master/`, reconsider tracked `.env.backup` paths).

[REDACTED]

