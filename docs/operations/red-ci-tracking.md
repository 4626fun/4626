# Red CI Tracking — Production Readiness

_Last updated: 2026-04-26 (post-PR #383 / #384 hotfix cycle)._

This document tracks the long-tail of red checks on `main` that are **not** day-to-day code regressions. Each entry has a clear owner action so the board can be made green deliberately rather than via blanket allowlists.

## Summary

| Check | Status | Cause | Action |
|---|---|---|---|
| `Slither (Foundry, blocking on high impact)` | red on main | Same EIP-170 size error | PR #385 (CreatorShareOFT size) |
| `test` (forge build) | red on main | Same EIP-170 size error | PR #385 |
| `api-tests` (Jest job) | red across PRs | Unbounded `readJsonBody(req)` in new onboarding handler | PR #387 |
| `docs` (Drift) | red on main | Stale paths + false-positive in link checker | PR #386 |
| `Gitleaks (full history)` | red across PRs | 21 pre-existing committed secrets in git history | **See §1 below** |
| `Vercel` deploy | red | `info@akita.llc` not linked to a recognised GitHub account | **See §2 below** |

## 1. `Gitleaks (full history)` — 21 historical findings

`gitleaks detect` walks the entire git object database, so even **already-deleted** secrets remain visible until either (a) the history is rewritten or (b) the offending commits/fingerprints are added to `gitleaks.toml`'s allowlist.

### Inventory

Reproduce locally:

```bash
gitleaks detect --config gitleaks.toml --report-path /tmp/leaks.json
```

| Rule | File (path at time of commit) | Commit |
|---|---|---|
| `generic-api-key` | `docs/_internal/audits/internal-monorepo-audit-2026-03-30.md` | `04b38d6` |
| `generic-api-key` | `cre/secrets.example.env` (`CRE_ERC4337_OWNER_PRIVATE_KEY=`) | `0d3710c` |
| `jwt` + `generic-api-key` | `frontend/abis/frontend/.env.{backup,production,vars}` (`VERCEL_OIDC_TOKEN`, `VITE_ETHERSCAN_API_KEY`) | `fcf7532` |
| `jwt` + `generic-api-key` | `frontend/.env.{backup,production,vars}` (same secrets) | `b393633` |
| `generic-api-key` | `docs/LAYERZERO_SOLANA_SETUP.md` (`SPL Token`) | `ff76b06` |
| `generic-api-key` | `bAlanciaga-master/EAGLE_ETHEREUM_CONFIG_VERIFICATION.md` (`VITE_ALCHEMY_API_KEY`) | `201cd02` |
| `generic-api-key` | `bAlanciaga-master/DEPLOYMENT.md` (`VITE_ALCHEMY_API_KEY` x2) | `201cd02` |
| `generic-api-key` | `bAlanciaga-master/src/utils/{tokenList,setting}.ts` (`pinataGatewayToken=`) | `7f109d8` |
| `telegram-bot-api-token` | `telegram-bot/.env.example` (`TELEGRAM_BOT_TOKEN=`) | `5469301` |
| `generic-api-key` | `.env.deployment.template` (`PRIVATE_KEY=`) | `cdb31cd` |

Total: **21 findings across 8 distinct historical commits**.

### Required actions before declaring green

1. **Rotate every credential listed above.** Treat each one as compromised — anyone with read access to the repository (or a fork) can recover it.
   - `VERCEL_OIDC_TOKEN` — rotate via the Vercel project's "Tokens" tab.
   - `VITE_ETHERSCAN_API_KEY` — regenerate at <https://etherscan.io/myapikey>.
   - `VITE_ALCHEMY_API_KEY` — regenerate at <https://dashboard.alchemy.com/apps>.
   - `pinataGatewayToken` — regenerate at <https://app.pinata.cloud/keys>.
   - `TELEGRAM_BOT_TOKEN` — issue `/revoke` then `/token` to BotFather.
   - `CRE_ERC4337_OWNER_PRIVATE_KEY` and the `PRIVATE_KEY=` template — derive a new EOA, transfer any residual funds, and update deployment manifests.
2. **Decide remediation path:**
   - **Option A (preferred): commit-fingerprint allowlist.** Once each secret is rotated, add the gitleaks fingerprints to `gitleaks.toml`'s `[allowlist]` `commits = […]` list. This keeps the public-facing history intact and is reversible.
   - **Option B: history rewrite.** Use `git filter-repo --invert-paths --path …` to surgically remove the offending blobs, force-push the rewritten history, and require all collaborators to re-clone. This is irreversible and breaks every existing fork/PR.
3. **Re-enable the check as required.** After the chosen remediation, the `Gitleaks (full history)` job should pass with no allowlist drift.

### Why this is not blocking deploy hardening

- Every leaked secret has been (or is being) rotated, so the historical exposure is bounded and recovery from disclosure does not depend on hiding the bytes.
- The runtime CI surface is already protected by `Gitleaks (incremental)`, which scans only PR diffs and is currently green across all open PRs (#385, #386, #387).

## 2. `Vercel` deploy — account-linking issue

The Vercel integration fails with:

> The owner of `info@akita.llc` is not a member of the connected GitHub organisation.

This is **infrastructure configuration**, not a code defect:

- Either link `info@akita.llc` to a GitHub identity that has read access to `wenakita/4626`, **or**
- Re-connect the Vercel project under a maintainer account that already has access (e.g. `wenakita`).

Once the link is corrected, the deploy job will go green without any code change. Until then it should be treated as a **non-blocking** warning — the static frontend build itself succeeds (see PR comments from `Vercel Preview Comments`).

## Sequencing

1. **Land #385** → makes `test` and `Slither` green on main.
2. **Land #386** → makes `docs` (Drift) green on main.
3. **Land #387** → makes `api-tests` green on main.
4. **Schedule §1 secret-rotation sprint** before flipping `Gitleaks (full history)` to required.
5. **Re-link Vercel deploy account** at owner discretion.

After steps 1–3, `main` is green for every code-derived check. Steps 4–5 are operational and tracked here so they cannot silently regress the production-readiness bar.
