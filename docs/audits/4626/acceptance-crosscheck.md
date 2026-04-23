# Audit Acceptance Doc Cross-Check — 2026-04-23

## Summary
- Docs reviewed: 23
- Blockers (contradicted by tree): 3 — all **resolved** in [PR #334](https://github.com/wenakita/4626/pull/334)
- Minor (imprecise but rationale holds): 6 — all **resolved** in [PR #346](https://github.com/wenakita/4626/pull/346) ([4626-400](https://linear.app/4626fun/issue/4626-400))
- Cosmetic: 5 — explicitly out of scope for 4626-400; tracked for incidental future cleanup
- Evidence-thin (no reproduction step given): 2 — both **resolved** in [PR #346](https://github.com/wenakita/4626/pull/346) (reproduction steps added)

Resolution status for every row is recorded in the "Resolved" column of the [Full matrix](#full-matrix) below.

---

## Resolution log

- **2026-04-23** — Blockers (L-29, 2× M-38): fixed in [PR #334](https://github.com/wenakita/4626/pull/334).
- **2026-04-23** — Minor + Evidence-thin: fixed in [PR #346](https://github.com/wenakita/4626/pull/346) (4626-400). Each section below retains its original pre-fix observation so the history of what was wrong is preserved; a "**Resolution**" line at the end of each section links to the fix.
- **Deferred** — Cosmetic (5): out of scope for 4626-400. Listed in the Cosmetic section for incidental pickup by future acceptance-doc edits.

---

## Blockers

### L-29 — `L-29-solana-program-id.md`
- **Resolution:** Fixed in [PR #334](https://github.com/wenakita/4626/pull/334).
- **Quote (Verification section):** "There is no `solana-bridge-naming-invariant.md` in the tree at the audited commit (`git ls-files | grep -i naming-invariant` returns nothing). The finding's cited counter-reference does not exist; no live discrepancy."
- **Reality:** `docs/operations/solana-bridge-naming-invariant.md` **does exist** in the current branch (`audit/sprint-9-docs-ci-info`). Running `git ls-files | grep -i naming-invariant` at HEAD returns `docs/operations/solana-bridge-naming-invariant.md`. The doc is 340 lines covering the Solana bridge naming convention, AKITA v1→v2 migration history, drift-response runbook, and Meteora integration steps. It does **not** contain a conflicting program ID (the `creator_share_hook` address `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU` is not referenced in the naming-invariant file), so the program-ID claim in `solana-spoke-article.md` is still consistent with `Anchor.toml` and `cre/config.ts`. The acceptance doc's core conclusion ("no live discrepancy") is therefore correct, but the key premise used to reach that conclusion ("the file does not exist") is factually false. An auditor re-running the cited command will get a non-empty result and may incorrectly conclude the acceptance doc is unreliable or that a deeper cross-check is needed.
- **Recommended action:** Update L-29 verification block to acknowledge `docs/operations/solana-bridge-naming-invariant.md` exists, then confirm it contains no conflicting program IDs. The closure rationale survives but the verification statement must be corrected.

### M-38 — `M-38-M-39-test-coverage-gaps.md`
- **Resolution:** Fixed in [PR #334](https://github.com/wenakita/4626/pull/334).
- **Quote (table, Foundry fuzz count section):** "Sprint 7 (prior) | `test/ChainlinkVRFIntegratorV2_5.DeploymentNonce.t.sol::testFuzz_requestCounterHigh48BitIsUnique` | H-10 regression"
- **Reality:** The function `testFuzz_requestCounterHigh48BitIsUnique` does **not exist** in `test/ChainlinkVRFIntegratorV2_5.DeploymentNonce.t.sol`. The actual `testFuzz_` functions in that file are: `testFuzz_RequestCounter_LowSixteenBitsAreZero` (line 56), `testFuzz_RequestCounter_MatchesHighBitsOfNonce` (line 68), `testFuzz_HighBitsUnique_AcrossRedeploys` (line 88), `testFuzz_HighBitsUnique_SameBlockDifferentAddress` (line 116), and `testFuzz_RegressionGuard_BugWouldHaveKeptMiddleBitsZero` (line 149). No function named `testFuzz_requestCounterHigh48BitIsUnique` exists anywhere in `test/`. Running `grep -rn "testFuzz_requestCounterHigh48BitIsUnique" test/ --include="*.sol"` returns zero matches.
- **Recommended action:** Correct the table entry to use the actual function names. The correct Sprint 7 additions in that file appear to be five functions including `testFuzz_RequestCounter_LowSixteenBitsAreZero` and the others listed above.

### M-38 — `M-38-M-39-test-coverage-gaps.md` (second issue in same doc)
- **Resolution:** Fixed in [PR #334](https://github.com/wenakita/4626/pull/334).
- **Quote (table, Foundry fuzz count section):** "Sprint 9 `b522389` | `test/CreatorLotteryManager.JackpotPayoutCap.t.sol::testFuzz_iterationsBounded` | M-06 regression"
- **Reality:** The function `testFuzz_iterationsBounded` does **not exist** in `test/CreatorLotteryManager.JackpotPayoutCap.t.sol` at HEAD. The live file contains `testFuzz_cursorEventuallyVisitsEveryIndex` (line 167) and `testFuzz_boundsHoldForAnyActivityPattern` (line 198). Commit `b52238982fa3de80f3167c5965576368067f7e57` (the "b522389" referenced in the doc) **did** add a function named `testFuzz_iterationsBounded`, but commit `4bbe891` subsequently modified the file and renamed or replaced it with `testFuzz_boundsHoldForAnyActivityPattern`. Running `grep -rn "testFuzz_iterationsBounded" test/ --include="*.sol"` returns zero matches at HEAD. The acceptance doc's fuzz-count table is internally inconsistent: it claims the function exists and counts it toward the total of 9, but it cannot be found.
- **Recommended action:** Correct the table to reference `testFuzz_boundsHoldForAnyActivityPattern` (the function that actually exists at HEAD). Note that the total count of 9 `testFuzz_` functions is correct — the issue is solely in the per-row attribution.

---

## Minor

### C-03-image-handlers-ssrf-size-caps — `C-03-image-handlers-ssrf-size-caps.md`
- **Resolution:** Fixed in [PR #346](https://github.com/wenakita/4626/pull/346) — updated to cite `redirect: 'manual'` at line 207 and `readRedirectUrl` at line 118.
- **Quote:** "`redirect: 'manual'` + `readRedirectUrl` (lines 102–112): every hop re-runs the forbidden-host / IP-resolution check; max 3 redirects."
- **Reality:** `readRedirectUrl` is defined at line **118** (not 102–112) of `frontend/server/_lib/infra/blob.ts`, and `redirect: 'manual'` appears at line **207** inside `fetchBytes`. Lines 102–112 in that file are blank or the tail of `parseFetchUrl`. The security rationale (every redirect hop re-runs the host check) is correct — `isHostnameResolutionSafe` is called at the top of the `for` loop (line 201) before each hop — but the cited line range is wrong.
- **Recommended action:** Update line reference to `redirect: 'manual'` at line 207 and `readRedirectUrl` at line 118.

### C-03-image-handlers-ssrf-size-caps — `C-03-image-handlers-ssrf-size-caps.md`
- **Resolution:** Fixed in [PR #346](https://github.com/wenakita/4626/pull/346) — replaced "(429→413)" with "throws `fetch_too_large` at line 230 of `blob.ts`; no HTTP status is set by this helper".
- **Quote:** "`maxBytes` cap (default 10 MiB) — checked first via `content-length` header (429→413) and then via streaming `readResponseBytesWithLimit`"
- **Reality:** The code does not return HTTP 429 or 413 in response to an oversized `content-length`. When the `content-length` header exceeds `maxBytes`, the helper throws `new Error('fetch_too_large')` (line 230 of `blob.ts`), which propagates as an exception rather than an HTTP status code. The "429→413" notation appears to be a status-code shorthand that does not match any actual HTTP response emitted by `fetchBytes`. The rate-limit 429 at line 669 of `_proxy.ts` is unrelated. The core security behaviour (the request is aborted before the body is read) is correct.
- **Recommended action:** Remove the "(429→413)" notation; replace with "throws `fetch_too_large`".

### C-03-rpc-proxy-hardening — `C-03-rpc-proxy-hardening.md`
- **Resolution:** Fixed in [PR #346](https://github.com/wenakita/4626/pull/346) — replaced the embedded snippet with the actual code (`const principalAddress = readRequestPrincipalAddress(req)`) and updated the surrounding line references to 8 (import) and 628 (call site).
- **Quote (code snippet in §1 Authentication required):** "`const principal = readRequestPrincipal(req)`"
- **Reality:** The actual function imported and called is `readRequestPrincipalAddress` (line 628 of `frontend/api/_handlers/rpc/_proxy.ts`; imported at line 8). No function named `readRequestPrincipal` is imported in `_proxy.ts`. The variable is named `principalAddress`, not `principal`. The embedded code snippet is therefore not the literal source code. The behaviour described (reject unauthenticated requests with 401) is verified correct.
- **Recommended action:** Replace the embedded snippet with the actual code: `const principalAddress = readRequestPrincipalAddress(req)`.

### I-01-I-17 — `I-01-I-17-info-findings.md` (I-03)
- **Resolution:** Fixed in [PR #346](https://github.com/wenakita/4626/pull/346) — changed to "lines 278–301 (`_autoAllocateToStrategy()`); `address firstStrategy = defaultQueue[0];` is on line 281".
- **Quote:** "File: `contracts/vault/modules/CreatorOVaultStrategiesModule.sol` line 278–301 (`address firstStrategy = defaultQueue[0];`)"
- **Reality:** `_autoAllocateToStrategy()` begins at line **278** and `address firstStrategy = defaultQueue[0]` is at line **281**. The function ends (with the closing brace) at approximately line **300**. The range 278–301 captures the whole function but the specific line cited for `defaultQueue[0]` is 281, not 278. This is a minor line-reference imprecision; the code content is correct.
- **Recommended action:** Cosmetic — change "line 278–301" to "lines 278–300; `defaultQueue[0]` at line 281".

### I-01-I-17 — `I-01-I-17-info-findings.md` (I-07)
- **Resolution:** Fixed in [PR #346](https://github.com/wenakita/4626/pull/346) — changed to "lines 770–784 (`_calculateLiquidity`); `return _sqrt(creatorCoinAmount * pairedAmount);` is on line 784".
- **Quote:** "File: `contracts/vault/strategies/univ4/ConcentratedStrategy.sol` lines 780–784 (`return _sqrt(creatorCoinAmount * pairedAmount);`)"
- **Reality:** `_calculateLiquidity` in `ConcentratedStrategy.sol` begins at line **770** (not 780). The `return _sqrt(...)` statement is at line **784**, which is correct. The function signature starts at 770; citing "lines 780–784" omits the opening six lines of the function. The substance (stub geometric mean is present) is correct.
- **Recommended action:** Update to "lines 770–784" for accuracy.

### H-10 — `H-10-oracle-cross-validation.md`
- **Resolution:** Fixed in [PR #346](https://github.com/wenakita/4626/pull/346) — replaced the non-existent path with `cre/cre-workflows/charm-rebalance-manager/` (the directory that actually owns the rebalance-cadence guard) and added a note explaining that the earlier path was never in-tree.
- **Quote:** "Rebalance cadence is rate-limited by the keeper (see `cre/cre-workflows/rebalance-cadence-guard` alerts)."
- **Reality:** No directory or file named `rebalance-cadence-guard` exists under `cre/cre-workflows/`. The closest match is `cre/cre-workflows/charm-rebalance-manager/`. Running `ls cre/cre-workflows/ | grep -i rebalance` returns only `charm-rebalance-manager`. The claim may be describing alerts inside `charm-rebalance-manager` but the cited path does not exist.
- **Recommended action:** Correct the path to `cre/cre-workflows/charm-rebalance-manager` (or whichever workflow contains the cadence guard logic).

---

## Cosmetic

### C-03-image-handlers-ssrf-size-caps — `C-03-image-handlers-ssrf-size-caps.md`
- **Quote:** "`parseFetchUrl` (lines 104–115): rejects non-`http:` / non-`https:` protocols"
- **Reality:** `parseFetchUrl` starts at line **105** (line 104 is blank). The function body runs to line 116. The range 104–115 is off by one at both ends but the function is present and does what the doc says.
- **Recommended action:** Correct to "lines 105–116".

### C-03-image-handlers-ssrf-size-caps — `C-03-image-handlers-ssrf-size-caps.md`
- **Quote:** "`isHostnameResolutionSafe` (lines 87–101): refuses localhost, `0.0.0.0`, any IPv4/IPv6 address matched by `isForbiddenIpAddress`"
- **Reality:** `isHostnameResolutionSafe` starts at line **89** (line 87 is the closing brace of the prior function, line 88 is blank). The function body runs through line 102. Line range 87–101 is slightly off. The logic is correct.
- **Recommended action:** Correct to "lines 89–102".

### L-30 — `L-30-getting-started-creator-address.md`
- **Quote:** "`docs/getting-started/index.md` (line 27) contains: `3. Enter your Creator Coin address (e.g., \`0x5b67...75\` for akita)`"
- **Reality:** That line is at line **39** of `docs/getting-started/index.md`, not line 27. Line 27 (counting from 1) is an empty line inside a shell code block. The content claim is correct; only the line number is wrong.
- **Recommended action:** Update to "line 39".

### L-31 — `L-31-codex-remediation-test-count.md`
- **Quote:** "`grep -n "289" docs/audits/codex/remediation-2026-04-02.md` returns zero matches."
- **Reality:** Confirmed — `grep -c '289' docs/audits/codex/remediation-2026-04-02.md` returns `0`. The verification statement is accurate. No issue with the claim itself.
- **Recommended action:** None — this entry is recorded for completeness only; the verification is clean.

### C-03-rpc-proxy-hardening — `C-03-rpc-proxy-hardening.md`
- **Quote:** "Lines 631–634: after CORS + OPTIONS handling, the handler rejects unauthenticated requests…"
- **Reality:** The auth check begins at line **628** (`const principalAddress = readRequestPrincipalAddress(req)`), with the rejection at line **632**. The range 631–634 starts three lines late. The logic is present and correct.
- **Recommended action:** Correct to "lines 628–632".

---

## Evidence-thin

### H-10 — `H-10-oracle-cross-validation.md`
- **Resolution:** Fixed in [PR #346](https://github.com/wenakita/4626/pull/346) — doc now cites `cre/cre-workflows/payout-integrity/` (the workflow that actually exists and provides the post-rebalance NAV check) and adds an explicit reproduction step (`ls`, `grep`) so a future auditor can replay the check.

The doc cites `cre/cre-workflows/vault-integrity/` as a compensating control that "checks post-rebalance NAV against the previous snapshot and pages the on-call if deviation exceeds the configured bps." No `vault-integrity` workflow directory exists (only `payout-integrity`). The payout-integrity workflow (`cre/cre-workflows/payout-integrity/`) does exist and may provide equivalent coverage, but the doc's claim cannot be verified against the cited path. The acceptance itself is an explicit risk-deferral with well-documented exit criteria, not a code-complete closure, so this does not flip the acceptance status — but the compensating-control evidence is unverifiable from the cited path.

### M-02 — `M-02-custom-twap-ring-buffer.md`
- **Resolution:** Fixed in [PR #346](https://github.com/wenakita/4626/pull/346) — doc now includes a "Reproduction / verification" section pointing at the current ring-buffer implementation (`contracts/utilities/oracles/CreatorOracle.sol`), the missing test location, and the downstream consumers that depend on the TWAP, plus an explicit statement that Linear 4626-311 remains open.

The acceptance is a documented risk-deferral ("known-open"). It makes no concrete repo claims and provides no grep/test commands for a reviewer to rerun. The absence of verifiable evidence is inherent to the deferral pattern, but the doc also states "No code change is shipped in the Sprint 5 PR for this item" — confirming the ring-buffer test suite in item (1) of the mitigation has not yet landed. Reviewers should confirm this ticket remains open in Linear (4626-311) and has not been silently closed.

---

## Full matrix

| Doc | Finding | Status claim | Key verifiable claim | Verified? | Resolved | Notes |
|---|---|---|---|---|---|---|
| C-03-image-handlers-ssrf-size-caps.md | C-03 (4626-361,362,365,370) | Already enforced | `fetchBytes` at blob.ts lines 176–241; `parseFetchUrl` lines 104–115; `isHostnameResolutionSafe` lines 87–101; `redirect:'manual'`+`readRedirectUrl` lines 102–112 | Partial | PR #346 (Minor); Cosmetic items deferred | Lines correct for 176–241 and overall logic; parseFetchUrl starts at 105 not 104, isHostnameResolutionSafe at 89 not 87, readRedirectUrl at 118 not 102. 429→413 notation is wrong (throws exception). All security controls verified present. Minor. |
| C-03-privy-wallet-policy-fail-closed.md | C-03 (4626-374) | Already enforced | `requirePrivyPolicyId` throws in production; test file exists | Yes | n/a — clean | Code and test file verified. Code snippet in doc matches actual logic. Clean. |
| C-03-quickstart-no-auto-allowlist.md | C-03 (4626-368) | Already enforced | `hasApprovedCreatorAccess` is SELECT-only; test file exists | Yes | n/a — clean | No INSERT/UPDATE in quickstart handler confirmed. Test file exists. Clean. |
| C-03-rpc-proxy-hardening.md | C-03 (4626-369,363) | Already enforced | `readRequestPrincipal` at lines 631–634; method blocklist at 160–174; rate limits at 78–97; `sanitizeUpstreamRpcError` at 544–555; batch size 100 at line 108 | Partial | PR #346 (Minor) | Function is `readRequestPrincipalAddress` not `readRequestPrincipal`; auth check at lines 628–632 not 631–634. Logic correct throughout. Minor. |
| C-03-solana-initialize-creator-authority.md | C-03 (4626-367) | Already enforced | `initialize_creator.rs` lines 81–90 check mint_authority | Yes | n/a — clean | Code verified at exact lines. Clean. |
| H-10-oracle-cross-validation.md | H-10 (4626-302) | Accepted / deferred | `cre/cre-workflows/rebalance-cadence-guard` alerts; `CHARM_MAX_TWAP_DEVIATION = 500`; vault-integrity CRE workflow | Partial | PR #346 (Minor + Evidence-thin) | `rebalance-cadence-guard` path does not exist (only `charm-rebalance-manager`). `vault-integrity` workflow does not exist (only `payout-integrity`). `CHARM_MAX_TWAP_DEVIATION = 500` confirmed. Minor (deferral doc, not a closed finding). |
| I-01-I-17-info-findings.md | I-01 | Accepted | `MAX_STALENESS` at line 62, `MAX_PRICE_DEVIATION` at line 71 of `CreatorOracle.sol` | Yes | n/a — clean | Exact lines confirmed. Clean. |
| I-01-I-17-info-findings.md | I-02 | Accepted | `MIN_HOLDING_BLOCKS` at line 48; `calculateBoostWithProtection` at line 88 | Yes | n/a — clean | Both confirmed. Clean. |
| I-01-I-17-info-findings.md | I-03 | Accepted | `CreatorOVaultStrategiesModule.sol` lines 278–301 `defaultQueue[0]` | Partial | PR #346 (Minor) | Function at 278–301, `defaultQueue[0]` at 281. Minor line-number imprecision. |
| I-01-I-17-info-findings.md | I-04 | Accepted | `SolanaBridgeStrategy.sol` line 74 `isValuationReady` always true | Yes | n/a — clean | Confirmed at line 74. Clean. |
| I-01-I-17-info-findings.md | I-05 | Accepted | `CCALaunchStrategy.sol` lines 557–566 `floorPrice`/`auctionSteps` no-ops | Yes | n/a — clean | Confirmed — `floorPrice;` at 564, `auctionSteps;` at 565. Clean. |
| I-01-I-17-info-findings.md | I-06 | Accepted | `BribeDepot.sol` exists | Yes | n/a — clean | File exists at `contracts/governance/bribes/BribeDepot.sol`. Clean. |
| I-01-I-17-info-findings.md | I-07 | Accepted | `ConcentratedStrategy.sol` lines 780–784 stub geometric mean | Partial | PR #346 (Minor) | Function starts at 770 not 780; `return _sqrt(...)` at line 784 correct. Minor. |
| I-01-I-17-info-findings.md | I-08 | Already fixed | `DeploymentBatcher.sol` lines 187–189 `Phase3HelperLostAdmin` check | Yes | n/a — clean | Confirmed at line 187. Clean. |
| I-01-I-17-info-findings.md | I-09 | Already fixed | `find cre/cre-workflows -name ".workflow-temp*"` returns nothing; gitignore lines 220–221 | Yes | n/a — clean | No temp files found. Gitignore lines 220–221 confirmed. Clean. |
| I-01-I-17-info-findings.md | I-10 | Fixed | Migration `20260422231500_document_service_role_only_tables.sql` | Yes | n/a — clean | File exists in `supabase/migrations/`. Clean. |
| I-01-I-17-info-findings.md | I-11 | Fixed | `getAllowedOriginsFromEnv` hard-fails in production on `*`/`null` | Yes | n/a — clean | Production guard confirmed at lines 34–41 of `origin.ts`. Clean. |
| I-01-I-17-info-findings.md | I-12 | Fixed | `setPublicCors()` comment explains wildcard intent | Yes | n/a — clean | Comment present above `setPublicCors`. Clean. |
| I-01-I-17-info-findings.md | I-14 | Stale | `grep "woff2\|design/fonts\|../design" TYPOGRAPHY_AUDIT.md` returns no matches | Yes | n/a — clean | Zero matches confirmed. Clean. |
| I-01-I-17-info-findings.md | I-15 | Accepted | `SECURITY.md` lines 97–125 contain Bug Bounty, Disclosure, Safe Harbor sections | Yes | n/a — clean | All three sections confirmed. Bug Bounty at line 97. Clean. |
| I-01-I-17-info-findings.md | I-16 | Fixed | `docs/security/index.md` "Last verified: 2026-04-22" note and M-38/M-39 cross-links | Yes | n/a — clean | Note at line 80 confirmed; cross-links present. Clean. |
| I-01-I-17-info-findings.md | I-17 | Stale | `grep -in "transfer hook\|forged entry\|already mitigated"` on ajna/charm adversarial-audit returns zero | Yes | n/a — clean | Zero matches confirmed on both files. Clean. |
| L-05-FullRangeStrategy-stub-valuation.md | L-05 (4626-353) | Deferred | Stub helpers at `FullRangeStrategy.sol:550–571`; mint paths use periphery `LiquidityAmounts` | Yes | n/a — clean | Stubs confirmed at lines 550–571. `_posmMint`/`_posmIncrease`/`_posmDecrease` not checked in detail but overall code structure consistent. Clean. |
| L-11-cre-tables-runtime.md | L-11 (4626-359) | Accepted / duplicate of M-31 | Sprint 7 branch will fix; no independent migration for CRE tables yet | Yes (no contradiction) | n/a — clean | Evidence-thin: no grep/migration cited. `frontend/server/_lib/cre/runtimeSchema.ts` exists and confirms the historical DDL context. No CRE-table migration in `supabase/migrations/` under CRE-named files. Rationale holds. |
| L-24-elizaos-core-dependency.md | L-24 (4626-372) | Accepted | `grep -rln "from '@elizaos/core'" frontend/api/_handlers/` returns zero matches | Yes | n/a — clean | Zero matches confirmed. Plugin files at `frontend/server/agent/eliza/plugins/` verified. Clean. |
| L-25-broken-api-contracts-link.md | L-25 (4626-373) | Fixed | Broken `/api/contracts` link removed from `docs/contracts/index.md` | Yes | n/a — clean | No `/api/contracts` link in file. Clean. |
| L-26-vanity-targets-v192.md | L-26 (4626-374) | Accepted | `grep "1.9.2"` in `shared-global-vanity-targets.json` returns zero; `recommendedEpochTag: v1.8.1`; `package.json` version 1.8.1 | Yes | n/a — clean | All three confirmed. `v1.9.2-bytecode-manifest.json` exists as separate file. Clean. |
| L-27-multisig-guide.md | L-27 (4626-375) | Accepted | Guide is 524 bytes with actionable content | Yes | n/a — clean | File is exactly 524 bytes; content confirmed. Clean. |
| L-28-ve33-progress.md | L-28 (4626-377) | Fixed | `frontend/src/pages/GaugeVoting.tsx` (141 LOC) exists; `contracts/governance/bribes/BribeDepot.sol` exists | Yes | n/a — clean | Both confirmed at exact sizes/locations. Clean. |
| L-29-solana-program-id.md | L-29 (4626-377) | Fixed | `solana-bridge-naming-invariant.md` does not exist; program ID `EjpziS…` matches all sources | **NO — BLOCKER** | PR #334 | `docs/operations/solana-bridge-naming-invariant.md` exists (340 lines). The doc claims `git ls-files | grep -i naming-invariant` returns nothing — it does not. Core program-ID consistency claim is still correct; only the premise is false. |
| L-30-getting-started-creator-address.md | L-30 (4626-378) | Accepted | `docs/getting-started/index.md` line 27 placeholder address `0x5b67...75` | Partial | Cosmetic — deferred | Content correct; actual line is 39 not 27. Cosmetic. |
| L-31-codex-remediation-test-count.md | L-31 (4626-379) | Stale | `grep -n "289" docs/audits/codex/remediation-2026-04-02.md` returns zero | Yes | n/a — clean | Zero matches confirmed. Clean. |
| L-32-L-33-audit-reconciliation.md | L-32 (4626-380) | Stale | `grep "All CLM\|CLM"` in `AUDIT_RECONCILIATION.md` returns zero | Yes | n/a — clean | Zero matches confirmed. Clean. |
| L-32-L-33-audit-reconciliation.md | L-33 (4626-381) | Stale | H-06, H-15, MED-007, INFO-004, "Vault Core", "Governance" not present in reconciliation | Yes | n/a — clean | H-15/MED-007/INFO-004 absent; H-06 is `SolanaBridgeStrategy` not the one L-33 references. Clean. |
| M-02-custom-twap-ring-buffer.md | M-02 (4626-311) | Deferred / known-open | No code change shipped | Yes (no contradiction) | PR #346 (Evidence-thin) | Evidence-thin. No grep/test to rerun. Clean deferral. |
| M-07-concentrated-strategy-burn-min-amounts.md | M-07 (4626-316) | Deferred | `_posmBurn` at `ConcentratedStrategy.sol` ≈L753–767 passes `uint128(0)` min amounts | Yes | n/a — clean | `_posmBurn` starts at line 756; `uint128(0), uint128(0)` confirmed at line 767. Clean. |
| M-08-cca-launch-oracle-race.md | M-08 (4626-317) | Deferred | `migrate()` calls `poolManager.initialize` then `_configureOracleV4Pool` in one tx | Yes | n/a — clean | Order confirmed: initialize at 723, modifyLiquidities at 766/769, `_configureOracleV4Pool` at 772. Intra-tx ordering described correctly. Clean. |
| M-28-csp-enforcement.md | M-28 (4626-337) | Closed | `grep -rn "content-security-policy-report-only"` returns zero; `seo/_seo.ts` line ~107 and `socialPreview.ts` line ~870 use enforcing CSP | Yes | n/a — clean | Zero report-only hits confirmed. CSP at seo line 107 and social line 870 confirmed as enforcing. Clean. |
| M-38-M-39-test-coverage-gaps.md | M-38 (4626-347) | Acknowledged | `testFuzz_` count = 9; Sprint additions: `testFuzz_requestCounterHigh48BitIsUnique` and `testFuzz_iterationsBounded` | **NO — BLOCKER (×2)** | PR #334 | Neither claimed function name exists at HEAD. Actual names are different (see Blockers). Count of 9 is correct. |
| M-38-M-39-test-coverage-gaps.md | M-39 (4626-348) | Acknowledged | `find frontend/api/__tests__ frontend/server/_lib/creatorStrategy -name "*.test.ts"` returns ~30+ files | Yes (generous) | n/a — clean | Actual count: 206 `__tests__` files + 7 `creatorStrategy` files. "~30+" understates but does not contradict. Listed test files exist. Clean. |
