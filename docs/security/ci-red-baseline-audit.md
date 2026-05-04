# CI Red Baseline Audit (2026-05-01)

> Status: pre-existing on every branch including `main` (verified via fuzz seed cross-check on PR #469's pure-TS branch). **No regressions.** This is a triage doc to pick a remediation path per finding family.

## Status Update — 2026-05-04

The Forge failure baseline in this document has been remediated. Local validation now passes with:

- `forge build`
- `forge test -vv` — 761 passed, 0 failed, 0 skipped

The remaining CI-red topics in this audit are Slither high-impact triage and historical Gitleaks rotation/purge work.

## Summary

| Family | Count | Blocking? | Recommendation |
|---|---|---:|---|
| Forge `test` failures | 0 / 761 | No | Resolved 2026-05-04; keep full Forge suite as release gate |
| Slither high-impact findings | **128** | Yes (`fail-none` then post-filter on High) | Mostly suppress with documented rationale |
| Gitleaks (full history) | **25** (was 26) | Yes | Partial: 1 family allowlisted in this PR; 24 historical findings need separate rotate/purge response |
| `pnpm typecheck` | clean | — | — |
| Vercel preview | submodule drift | No (advisory) | Already known, ignore |

---

## 1. Forge test failures (resolved 2026-05-04)

Status: resolved. The full suite now passes locally (`761 passed, 0 failed, 0 skipped`).

Resolution notes:

- Added missing Base-chain fixture setup and LayerZero peer setup where tests relied on Base-only guards.
- Bootstrapped CreatorOracle fixtures against the current owner-only first-price invariant and updated stale broadcast/ring-buffer assumptions.
- Updated VaultGaugeVoting tests to match the no-votes-no-boost invariant.
- Fixed real wrapper cooldown coverage for advanced `wrap()` / `unwrap()` paths.
- Fixed hostile strategy withdrawal accounting so negative idle-balance deltas increase the remaining deficit before the queue tries the next strategy.
- Updated M09 and reentrancy harness expectations to match EVM rollback semantics.

Historical triage notes below are kept for audit context.

Running `forge test --no-match-path 'lib/**'`: **29 fails / 693 passes**. Grouped by root cause:

### A. `Base only` chain-id guard in `setUp` (10)
Tests have `setUp()` that asserts the test EVM is on Base mainnet (`block.chainid == 8453`). They were written for forked-Base CI but the local sandbox has chain id `31337`.

| Suite | Count |
|---|---:|
| `DeploymentBatcher.*` | 8 |
| `CreatorGaugeController` | 1 |
| `DeploymentBatcher.Permit2` | 1 |

**Fix:** add `vm.chainId(8453);` at the top of each `setUp()` OR extract a shared `BaseForkSetup` modifier. Low risk — these are guards, not assertions about deployed state.

### B. Oracle / config not initialized in `setUp` (3)
`CreatorOracle.{BroadcastCreatorPrice,RingBuffer,TwapSafety}` revert with `OracleNotInitialized()` / `Invalid range`. The tests rely on a pre-deployed oracle that the fixture doesn't currently bootstrap.

**Fix:** initialize the oracle inside the test fixture (call `setCreatorPrice`/`pushObservation` before assertions). Medium effort.

### C. M08 cooldown + M09 strategy-withdraw resilience (3)
- `test_M08_propagation_isMonotonicMax` — assertion `0 <= 0` failure (likely off-by-one after a cooldown-clock change)
- `test_M08_transferToFreshAddress_inheritsCooldown` — `0 != 1` (cooldown didn't propagate)
- `test_PartialThenRevert_ReturnsMeasuredDelta` — strategy returned 0 instead of measured delta (250e18)

**Fix:** investigate. M08/M09 are non-trivial — they look like real product/test drift that needs a Solidity dev pass. Recommend a dedicated PR.

### D. VaultGaugeVoting probability-boost cap (2)
Both fail with `0 != 35000` and `0 != 13884`. Looks like the boost calculation now returns 0 for the equal-split / no-votes cases (likely a guard-clause regression).

**Fix:** look at recent edits to `VaultGaugeVoting.sol` — probably a 1-line gate that needs to be relaxed or a fixture fix.

### E. HostileWithdraw fuzz counterexamples (4)
- `testFuzz_coinBalance_syncedAfterHostileLeg` — counterexample `args=[6990]` → `InsufficientBalance()`
- `testFuzz_userWithdraw_doesNotBrickWhenStrategyLiesWithNegativeDelta` — counterexample `args=[2^256-2]` → same
- `test_userWithdraw_succeedsWhenHostileRevertsWithoutDraining` — `0 != 1`
- `test_revertBranch_observesZeroDelta_andUserWithdrawSucceeds` — `0 != 1`

The fuzz seed reproduces deterministically — same `forge` config + same shrunk inputs landed on PR #469's pure-TS branch, so this is environmental, not a regression from any specific PR.

**Fix:** these are real product invariants. Either (a) add `vm.assume` to bound inputs to the regime the contract was designed for, or (b) treat the counterexamples as genuine bugs and fix the strategy. Needs Solidity expertise.

### F. ChainlinkVRF NoPeer(30184) (2)
`test_QuoteFee_*` revert with `NoPeer(30184)` — LayerZero peer for chain 30184 not registered in fixture.

**Fix:** add `setPeer(30184, ...)` to the fixture. Low risk.

### G. SeedCreatorRegistry address mismatch (1)
`testSeedScriptAuthorizesLiveFactoryAndBatchers` — expected `0x32403…` got `0xcDbE…`. Live address constants drifted vs. what the seed script computes.

**Fix:** regenerate expected addresses from current factory bytecode. 5-minute fix.

### H. CreatorOVault transfer accounting (1)
`test_withdraw_revertsWhenStrategyWithdrawReverts_underStrictUnwindPolicy` — "next call did not revert as expected". Strict-unwind policy may have been relaxed.

**Fix:** verify intended behavior with the spec; either fix product or the test.

### I. ZK pipeline (2)
- `test_submitAmoeEntry_acceptsDeadlineAtBufferBoundary` — `NotPublisher()` (test missing `setPublisher` setup)
- `test_acquireRequest_blocksReentry` — "reentrant call was never attempted" (the reentrancy harness no longer triggers; likely a guard moved earlier)

**Fix:** small fixture / harness updates. Low effort.

### Prioritization
| Priority | Buckets | Action |
|---|---|---|
| **P0** (fix this sprint) | A (chain id), F (LayerZero peer), G (Seed addr), I.1 (publisher setup) | Trivial fixture fixes, ~1-2 hours total |
| **P1** | B (oracle init), I.2 (reentry harness) | 1-2 hours |
| **P2** | C, D, E, H | Real product/test investigation; one PR per family |

---

## 2. Slither high-impact findings (128)

Histogram by detector:

| Count | Detector | Confidence |
|---:|---|---|
| 60 | `uninitialized-state` | High |
| 29 | `reentrancy-balance` | Medium |
| 15 | `incorrect-return` | Medium |
| 7 | `incorrect-shift` | High |
| 3 | `weak-prng` | Medium |
| 3 | `reentrancy-eth` | Medium |
| 3 | `incorrect-exp` | Medium |
| 3 | `controlled-delegatecall` | Medium |
| 2 | `encode-packed-collision` | High |
| 2 | `arbitrary-send-erc20` | High |
| 1 | `msg-value-loop` | Medium |

### Triage approach
Most of these are likely false positives in this codebase based on prior reviews:

- **uninitialized-state (60)** — almost always immutables / constants Slither can't statically resolve, or storage slots that get bootstrapped via `initialize()` in proxy patterns. Audit each, then add a `// slither-disable-next-line uninitialized-state` with a 1-sentence justification.
- **reentrancy-balance / reentrancy-eth (32)** — the codebase uses OpenZeppelin `ReentrancyGuard`/`nonReentrant` extensively (e.g., `VaultShareBurnStream`, `CCALaunchStrategy`, `CreatorVRFConsumerV2_5`). Slither can't always see across the modifier. Suppress with rationale when `nonReentrant` is present; investigate otherwise.
- **incorrect-return / incorrect-shift / incorrect-exp** — these are usually real bugs when they appear; need per-occurrence triage.
- **weak-prng (3)** — VRF callbacks; suppress (the entropy comes from Chainlink, not from `block.timestamp`).
- **controlled-delegatecall (3)** — multicall patterns or EIP-7702-ish flows; verify the target is bounded by access control.
- **encode-packed-collision (2)** — review carefully. Real risk when used with multiple dynamic-length args.
- **arbitrary-send-erc20 (2)** — review carefully. These should never ship.
- **msg-value-loop (1)** — common false positive; verify each loop iteration handles ETH idempotently.

### Recommendation
1. **Sprint task:** triage all 128 findings into `keep-and-fix` vs `slither-disable-next-line` with rationale comments.
2. **CI side:** keep the current "fail on High" gate; don't relax it. Each suppression must include a `// slither-disable-…` comment that explains *why*. This makes the gate meaningful again.

Concrete next step for whoever picks this up: extract the JSON artifact (`gh run download <run_id> -n slither-report` from the security-scanning workflow) and write a checklist.

---

## 3. Gitleaks (full history)

**Status after this PR:** 26 → 25. The `cre/secrets.example.env` family is now allowlisted (this PR's `gitleaks.toml` change). 25 historical findings remain — most in files that no longer exist on `main`, but several look like real keys committed in early commits and need rotation, not just allowlisting.

### Remaining inventory (full-history walk)

Grouped by likely real-secret status:

#### A. Likely real secrets (need rotation + purge — NOT in scope of this PR)

| File | Commit | Type | Notes |
|---|---|---|---|
| `frontend/.env.production` | `9a6b9bb` (2025-10-18) | `VITE_ALCHEMY_API_KEY` | UUID-format Alchemy key. **Rotate in Alchemy console.** |
| `frontend/.env.production` (`.backup`, `.vars`) | `b393633` | `VERCEL_OIDC_TOKEN` (JWT), `VITE_ETHERSCAN_API_KEY` | OIDC tokens are short-lived; Etherscan key needs rotation. |
| `frontend/abis/frontend/.env.*` | `fcf7532` | Same as above (duplicate copy under `abis/`) | Same rotation. |
| `telegram-bot/.env.example` | `5469301` | `TELEGRAM_BOT_TOKEN` | If real, rotate via BotFather. If placeholder, allowlist. |
| `.env.deployment.template` + `deploy.sh` | `cdb31cd` | `PRIVATE_KEY` literal | Inspect — if it's the placeholder string `0xYOUR_KEY` flavor, allowlist; if hex, **rotate immediately**. |
| `bAlanciaga-master/{DEPLOYMENT.md,EAGLE_…md,src/utils/{setting,tokenList}.ts}` | `201cd02`, `7f109d8` | `VITE_ALCHEMY_API_KEY`, `pinataGatewayToken` | Old reference codebase; verify they were never live keys. |

All of these except the bAlanciaga set are deleted on current `main` but still in git history.

#### B. Likely false positives (high-entropy strings that aren't secrets)

| File | RuleID | What it really is |
|---|---|---|
| `docs/llms/developers-ethos-network.md` | `generic-api-key` | Firebase Storage URL token in an `<img>` tag |
| `circuits/amoe/ceremony/v2/ceremony_transcript_v2.txt` ×4 | `generic-api-key` | zkey SHA-256 hashes (these are *intended* to be public) |
| `docs/_internal/audits/internal-monorepo-audit-2026-03-30.md` | `generic-api-key` | Matched on the literal text "REDACTED gates" — false positive on prose |
| `docs/hackathon/evidence/cre-runtime-indexer-block-local-simulation.md` | `generic-api-key` | UUID `idempotencyKey` example in a runbook |
| `docs/LAYERZERO_SOLANA_SETUP.md` | `generic-api-key` | SPL token mint address (public, not a secret) |

All five still exist on `main` and should be allowlisted by path or stopword.

### What this PR does

Adds path-allowlist entries to `gitleaks.toml` for the `cre/secrets.example.env` family — both global `[allowlist]` and rule-scoped `generic-api-key` paths, plus a broader `[A-Za-z0-9_-]+\.example\.env$` pattern so any future `*.example.env` file is automatically covered. This drops the count from 26 → 25 and is verifiable via the artifact attached to the failed run.

### What it does NOT do (follow-up work)

1. **Secret rotation** — the Alchemy key, Vercel OIDC token, Etherscan key, and (possibly) the `cdb31cd` PRIVATE_KEY all need to be rotated by whoever owns those accounts. This is out of scope for a CI-config PR.
2. **Allowlisting the false-positive family (B)** — should be a small follow-up PR adding path allowlists for `circuits/**/*.txt`, `docs/**/*.md` (or specific stopword regexes for hash-like strings inside markdown). Worth doing carefully to avoid hiding real secrets in docs.
3. **History purge (`git filter-repo`)** — only worth doing after rotation is complete, and only for the most sensitive entries. Not free: every fork/clone needs to re-pull.

Once (1) and (2) are done, gitleaks-full-history can become a hard CI gate.

### Original incorrect summary

A prior version of this doc said "26 findings, all in `cre/secrets.example.env`." That was a misread — `cre/secrets.example.env` was the largest single family but not the only one. Corrected above with the full breakdown from the failed `Gitleaks (full history)` run on PR #476.

---

## 4. Vercel preview

Failure cause: `lib/liquidity-launcher` submodule appears "dirty" because the submodule itself has uncommitted state in CI checkouts. This has been documented as known noise. **No action.**

---

## 5. Prioritized work plan

### Sprint A — quick wins (~½ day)
- Fix Forge buckets A / F / G / I.1 (≤2h total)
- Allowlist `cre/secrets.example.env` in `gitleaks.toml` ← **done in this PR**
- Allowlist gitleaks false-positive family B (docs/circuits) — follow-up PR
- Fix Forge bucket B / I.2 (oracle / reentry harness)

This clears ~14 Forge tests (a/b/f/g/i = 14 tests) and ~5 false-positive Gitleaks findings.

### Sprint A.5 — secret rotation (out-of-band, not a code PR)
- Rotate Alchemy API key `80aff713-…` (commit `9a6b9bb`)
- Verify Vercel OIDC token (commit `b393633`) — likely already expired
- Rotate Etherscan API key (commit `b393633`)
- Inspect `cdb31cd:.env.deployment.template` — rotate any real PRIVATE_KEY
- After rotation, optional `git filter-repo` to purge history

### Sprint B — medium effort (~2-3 days)
- Slither triage pass: classify all 128 → suppress-with-rationale or fix
- Forge buckets C, D, E, H (one PR per family)

### Sprint C — ongoing
- Add a CI dashboard so the count never regresses silently.

---

## Verification commands

```bash
# Forge full re-run
cd /home/user/workspace/wenakita4626
export PATH="/home/user/.foundry/bin:$PATH"
forge test --no-match-path 'lib/**'

# Slither high-impact summary
gh api repos/wenakita/4626/actions/jobs/<job_id>/logs \
  | grep "impact=High" | sed 's/.*- //' | sort | uniq -c | sort -rn

# Gitleaks reproduction (if you have gitleaks installed locally)
gitleaks detect --config gitleaks.toml --redact --report-format json --no-banner
```
