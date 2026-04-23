# I-01 … I-17 — Consolidated Informational Finding Dispositions

This acceptance document covers all Informational severity findings from the Phase-2/4/6/7 review (I-01 through I-17, Linear `4626-382` through `4626-398`, skipping `4626-394` which has no corresponding finding). Each finding is recorded with its current disposition. Commits in this sprint fix the items marked **Fixed**; the rest are documented acceptance with rationale and follow-up tracking.

---

## I-01 — `MAX_STALENESS` and `MAX_PRICE_DEVIATION` not configurable (Linear 4626-382)

- File: `contracts/utilities/oracles/CreatorOracle.sol` lines 62, 71
- Current code: `uint256 public constant MAX_STALENESS = 7200;` and `uint256 public constant MAX_PRICE_DEVIATION = 0.2e18;` are `public constant`.
- Disposition: **Accepted** for this sprint. Design intent is a uniform protocol-wide ceiling on staleness and deviation; per-token tuning introduces a governance surface (per-token admin function + per-token storage + upgrade migration) that is materially larger than the informational severity warrants.
- Follow-up: if post-launch monitoring shows stable-asset creators need tighter deviation or illiquid creators need wider staleness, reopen as a Medium and add governance setters guarded by min/max bounds (e.g. `MAX_STALENESS ∈ [600, 14_400]`, `MAX_PRICE_DEVIATION ∈ [0.05e18, 0.5e18]`).

## I-02 — `ve4626BoostManager.MIN_HOLDING_BLOCKS` flash-loan protection (Linear 4626-383)

- File: `contracts/governance/ve4626BoostManager.sol` line 48
- Current code: `uint256 public constant MIN_HOLDING_BLOCKS = 302_400;` and the reset condition lives in `calculateBoostWithProtection()` at line 88.
- Disposition: **Accepted**. Confidence in the finding body is "Plausible"; lock-extension UX is not known to be a pain point at current TVL. Reducing the reset to only trigger on veBalance decreases is a behavioural change that needs its own test matrix to prove it does not re-open a flash-loan inflation vector.
- Follow-up: reopen if user telemetry shows lock-extension activity is depressed, and implement the "decrease-only reset" variant with an invariant test that flash-loan-induced increases still cannot boost within the window.

## I-03 — `_autoAllocateToStrategy()` deploys only to `defaultQueue[0]` (Linear 4626-384)

- File: `contracts/vault/modules/CreatorOVaultStrategiesModule.sol` lines 278–301 (`_autoAllocateToStrategy()`); `address firstStrategy = defaultQueue[0];` is on line 281.
- Disposition: **Accepted — documented behaviour**. The auto-allocator is deliberately cheap on gas; strategy weight distribution happens through `_deployToStrategies()` which is called by the keeper. The `_autoAllocate` path is specifically the "idle overflow top-off" hook; it should not simulate a full rebalance.
- Follow-up: add a `@dev` NatSpec block above the function clarifying that callers needing weight-respecting distribution should invoke the keeper path (not auto-allocate). Not in-scope for this sprint — purely documentation.

## I-04 — `SolanaBridgeStrategy.isValuationReady()` always returns true (Linear 4626-385)

- File: `contracts/vault/strategies/SolanaBridgeStrategy.sol` line 74
- Disposition: **Accepted with explicit documentation required**. Returning `true` is consistent with the explicit design choice in the Solana-spoke hub/spoke model: Solana allocation is intentionally counted as zero for on-chain valuation (the Solana side is treated as an off-chain valuation channel reconciled by keeper).
- Follow-up: add a NatSpec `@dev` block above `isValuationReady()` stating "Solana allocation is treated as zero on-chain; this always returns true so that vault rebalances do not block." Not in-scope for this sprint.

## I-05 — `CCALaunchStrategy.launchAuction()` parameters silently ignored (Linear 4626-386)

- File: `contracts/vault/strategies/CCALaunchStrategy.sol` lines 557–566 and 573–581 (`launchAuctionWithReserve`)
- Current code: `floorPrice;` and `auctionSteps;` are used as explicit "no-op statements" so the Solidity compiler does not emit an unused-parameter warning, but they are not forwarded to `_launchAuctionInternal`.
- Disposition: **Accepted**. The ABI preserves two historical parameters for off-chain tooling compatibility. Removing them is a breaking change; adding `require(floorPrice == 0 && auctionSteps.length == 0)` is a behavioural tightening that would brick existing keeper calls that pass non-zero defaults.
- Follow-up: schedule a batch ABI cleanup for the next strategy upgrade window; include parameter removal, tooling updates, and a version bump in `IStrategy`.

## I-06 — `BribeDepot` sweep for pre-epoch deposits (Linear 4626-387)

- File: `contracts/governance/bribes/BribeDepot.sol`
- Confidence in source body: "Missing Evidence".
- Disposition: **Spec-level follow-up required**. `BribeDepot` does not expose a public sweep for deposits keyed to an epoch that was never initialised. The current deposit path requires a valid epoch argument, so a pre-epoch direct ERC-20 transfer into the contract is the only way this could happen — which is operator error, not a user-facing bug.
- Follow-up: add a `rescueTokens(address token, address to)` admin function guarded by `onlyOwner` for the operator-error case; or document in SECURITY.md that raw-transfer deposits are unsupported. Tracked as a post-audit cleanup item.

## I-07 — `ConcentratedStrategy._calculateLiquidity()` stub geometric mean (Linear 4626-388)

- File: `contracts/vault/strategies/univ4/ConcentratedStrategy.sol` lines 770–784 (`_calculateLiquidity`); `return _sqrt(creatorCoinAmount * pairedAmount);` is on line 784.
- Disposition: **Known limitation — tracked under L-05**. This is the same stub math flagged in L-05 (`L-05-FullRangeStrategy-stub-valuation.md`) and applies here too. Replacing with full V4 `LiquidityAmounts.getAmountsForLiquidity()` requires adopting the V4 math library and refactoring both strategies' valuation paths.
- Follow-up: bundle with the L-05 remediation (FullRangeStrategy); single PR replacing both stubs with the canonical V4 math library.

## I-08 — `DeploymentBatcher` Phase3Helper trust assumption (Linear 4626-389)

- File: `contracts/helpers/batchers/DeploymentBatcher.sol` lines 187–189
- Current code: `if (!IAjnaVaultAuthConfigurator(out.ajnaVaultAuth).isAdmin(address(this))) revert Phase3HelperLostAdmin();` followed by `transferAdmin(protocolTreasury)`.
- Disposition: **No action required** — the finding body itself says "FIX F-21 confirmed effective". Documenting for coverage completeness. The trust assumption ("Phase3Helper is deployed at the expected address") is inherent to any helper-contract architecture and is already enforced by `create2Deployer` + deployment-script checks.

## I-09 — Temp/scratch workflow file committed (Linear 4626-390)

- Pattern: `cre/cre-workflows/.workflow-temp-*.ts`
- Verification: `find cre/cre-workflows -name ".workflow-temp*"` returns no files at current `HEAD`. `.gitignore` lines 220–221 already have `**/.workflow-temp-*.ts` and `**/.workflow-temp-*.json`.
- Disposition: **Already fixed** — no temp files exist and the gitignore pattern is in place. No commit required beyond this acceptance doc.

## I-10 — `profiles` and core tables RLS model undocumented (Linear 4626-391)

- Files: `supabase/migrations/*`
- Fix: this sprint adds `supabase/migrations/20260422231500_document_service_role_only_tables.sql` which attaches `COMMENT ON TABLE ... IS 'RLS enabled, service-role only ...'` to every service-role-only table. The migration is idempotent (`DO $$ ... EXCEPTION WHEN undefined_table`) so it is safe to apply across environments even if a given table is not yet provisioned.
- Disposition: **Fixed**.

## I-11 — CORS allowed origins populated from env with no audit trail (Linear 4626-392)

- File: `frontend/server/_lib/infra/origin.ts` `getAllowedOriginsFromEnv()`
- Fix: `getAllowedOriginsFromEnv()` now hard-fails in production if `CORS_ALLOWED_ORIGINS` contains `*` or `null`. Prior behaviour silently dropped the invalid value (the URL parser rejects bare `*`), which satisfied the spec but gave no operator feedback.
- Disposition: **Fixed**.

## I-12 — `agent-registration.ts` wildcard CORS on public endpoint (Linear 4626-393)

- File: `frontend/api/agent-registration.ts` `setPublicCors()`
- Fix: added a detailed `/** ... */` comment above `setPublicCors()` explaining the wildcard is intentional (ERC-8004 public identity artifact, no session/cookies/secrets, non-GET rejected) and pointing future maintainers at this acceptance doc if they consider narrowing the allowlist.
- Disposition: **Fixed**.

## I-14 — `TYPOGRAPHY_AUDIT.md` references non-existent asset files (Linear 4626-395)

- Verification: `grep -n "woff2\|design/fonts\|../design" TYPOGRAPHY_AUDIT.md` returns no matches at current `HEAD`. The broken asset references described in the finding body are not present.
- Disposition: **Stale — no action required**.

## I-15 — `SECURITY.md` lacks formal bug bounty program details (Linear 4626-396)

- Current `SECURITY.md` (lines 97–125) contains `## Bug Bounty and Rewards`, `## Disclosure Policy`, and `## Safe Harbor` sections with language spelling out the disclosure expectations, good-faith testing protections, and what counts as out-of-scope behaviour.
- Disposition: **Accepted — not a formal paid bounty by choice**. The doc already states explicitly: "4626 does not currently run a paid public bug bounty program. We may provide public credit for accepted reports and may offer discretionary rewards in exceptional cases." Running a formal paid bounty is a business/legal decision with operational implications (scope definition, triage process, payout custody) beyond the audit-remediation scope.
- Follow-up: if a paid bounty is launched later, populate SECURITY.md with reward tiers and scope table.

## I-16 — `docs/security/index.md` potentially stale test coverage (Linear 4626-397)

- File: `docs/security/index.md` "Test Coverage" section
- Fix: added a "Last verified: 2026-04-22 against commit `main`" note at the top of the section, clarifying that the "88 edge cases" number is lottery-specific (not global Foundry fuzz/invariant counts) and cross-linking the `M-38` / `M-39` acceptance docs for broader-suite coverage.
- Disposition: **Fixed**.

## I-17 — Ajna adversarial-audit Solana transfer hook "Already Mitigated" disposition (Linear 4626-398)

- Files checked: `docs/audits/ajna/adversarial-audit.md`, `docs/audits/charm/adversarial-audit.md` (the finding body references the latter despite the title pointing at the former).
- Verification: `grep -in "transfer hook\|forged entry\|already mitigated"` on both files returns **zero matches** at current `HEAD`. The finding's cited disposition text is not present.
- Disposition: **Stale — no action required**.

---

## Summary

- **Fixed this sprint:** I-10 (RLS comment migration), I-11 (CORS wildcard guard), I-12 (agent-registration wildcard comment), I-16 (coverage-claim provenance note).
- **Already fixed / stale:** I-08, I-09, I-14, I-17.
- **Accepted with follow-up tracking:** I-01, I-02, I-03, I-04, I-05, I-06, I-07, I-15.

Commit footers reference each individual Linear ID so per-finding tracking is preserved.
