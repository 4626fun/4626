# Remediation: L-21 — `gitleaks.toml` broad test-path allowlist

- **Finding ID:** L-21
- **Linear:** 4626-369
- **Severity (reported):** Low
- **Confidence (reported):** Confirmed
- **Status:** **Fixed** — previous blanket path exemption replaced with a rule-scoped allowlist limited to the `generic-api-key` heuristic.
- **Source:** Phase 6 SEV-607

## Correction notice (Sprint 8 follow-up, 2026-04-23)

An earlier revision of this document (original title
"Acceptance: L-21 — `.gitleaks.toml` broad allowlist") closed this
finding as **moot** on the grounds that `.gitleaks.toml` did not exist
in the tree. **That was factually wrong.** Codex review on PR #329
(comment [r3129607573](https://github.com/wenakita/4626/pull/329#discussion_r3129607573))
correctly pointed out that the repository ships `gitleaks.toml`
(no leading dot — the filename gitleaks looks for when passed via
`--config`) and that `.github/workflows/security-scanning.yml`
invokes `gitleaks detect --config gitleaks.toml`. The prior acceptance
doc's claim that CI runs with "no `--config` flag and no project
allowlist" was incorrect.

The previous `gitleaks.toml` contained a top-level path allowlist
exempting `frontend/api/__tests__/` from **every** gitleaks detector,
exactly the condition L-21 flagged. This revision fixes the real
underlying config and re-closes the finding with a narrower scope.

## Reported issue

The repository's `gitleaks.toml` contained:

```toml
[allowlist]
paths = [
  # ...
  '''^frontend/api/__tests__/''',
  '''^frontend/src/.+\.test\.tsx?$''',
  '''^cre/tests/''',
  # ...
]
```

That top-level `[allowlist].paths` entry exempts the listed paths from
**all** gitleaks rules, including strict detectors like
`aws-access-token`, `github-pat`, `stripe-access-token`, and
`private-key`. A developer could commit a real `pk_live_*`,
`ghp_*`, `AKIA*`, or PEM-encoded private key into any test under
`frontend/api/__tests__/` and gitleaks would silently ignore it on
both pre-commit and CI runs.

## Fix

`gitleaks.toml` now splits the allowlist into two tiers:

1. **Global `[allowlist]`** — narrowed to cover only paths that cannot
   be edited without breaking vendored provenance: audit snapshots,
   `docs/vibeship/`, `docs/yearn/`, `deployment-vault-v3-final.json`,
   and the copy-pasted Moltbook skill decks. No test directories
   remain in the global list.
2. **Rule-scoped allowlist on `generic-api-key`** — the catch-all
   heuristic rule that was previously generating false positives on
   test fixture field names (`privyToken`, `bridgeToken`,
   `friendKeyContract`, `SOLANA_DEFAULT_BRIDGE_TOKEN`) is now the
   *only* rule that skips the test directories.

```toml
[[rules]]
id = "generic-api-key"
[rules.allowlist]
description = "Vitest fixture field names match generic-api-key heuristic but are not credentials"
paths = [
  '''^frontend/api/__tests__/''',
  '''^frontend/src/.+\.test\.tsx?$''',
  '''^frontend/server/.+\.test\.ts$''',
  '''^frontend/server/.+/__tests__/''',
  '''^cre/tests/''',
]
```

Every provider-specific detector (aws-access-token, github-pat,
stripe-access-token, slack-user-token, private-key, gcp-api-key,
twilio-api-key, etc.) still applies to those test paths. A real
credential will fail CI.

## Verification

Reproduced locally with gitleaks 8.30.0 (pinned version per Sprint 7
L-23 SHA-256 verification) on commit `HEAD`:

| Config variant | Total leaks | Leaks inside `*__tests__*` |
|---|---|---|
| Previous `gitleaks.toml` (broad path allowlist) | 21 | 0 (hidden) |
| Temporary no-allowlist | 86 | 66 |
| New scoped allowlist (this commit) | 18 | 0 (true-negatives) |

The 18 residual leaks are pre-existing hits in production code paths
(`.env.example`, `frontend/server/_lib/wallet/alfaclub.ts`, Foundry
deploy scripts, etc.) unrelated to L-21 and tracked separately for
remediation — the key invariant, "tests can no longer smuggle real
secrets past gitleaks", now holds.

Reproduction command:

```bash
gitleaks detect --source . --config gitleaks.toml --no-banner --redact --exit-code 0
```

## Where gitleaks is executed

Two workflows invoke gitleaks on every PR and push to `main`:

1. `.github/workflows/security-scanning.yml` — job `gitleaks`, pinned
   gitleaks 8.x downloaded from the official GitHub release tarball.
   SHA-256 verification was added in Sprint 7 L-23. Invoked with
   `--config gitleaks.toml`.
2. `.github/workflows/cre-workflows.yml` lines 99–114 — invoked
   without `--config`, which applies only the built-in default rules
   (no allowlist). Retained as a belt-and-braces second gate.

Additionally, Sprint 8 L-22 added a husky pre-commit hook
(`scripts/lint-staged-gitleaks.sh`) that runs `gitleaks protect
--staged` locally. That hook uses the repo `gitleaks.toml`, so the
same scoped allowlist applies on local commits.

## Regression prevention

- Any future PR that broadens the global `[allowlist].paths` to cover
  a test directory — reinstating the flaw L-21 flagged — is visible
  as a diff to `gitleaks.toml`.
- The `cre-workflows.yml` default-config invocation remains as a
  second independent check with no project allowlist.
- The pinned gitleaks version (Sprint 7 L-23) prevents a registry
  substitution from silently altering which paths the config
  targets.

## References

- Phase 6 SEV-607
- Codex PR comment: https://github.com/wenakita/4626/pull/329#discussion_r3129607573
- `.github/workflows/security-scanning.yml` (gitleaks job with `--config gitleaks.toml`)
- `.github/workflows/cre-workflows.yml` lines 99–114 (default-config run)
- Sprint 7 commit `20df147` — L-23 gitleaks SHA-256 verification
- Sprint 8 commit `395ae9b` + `scripts/lint-staged-gitleaks.sh` — pre-commit hook
