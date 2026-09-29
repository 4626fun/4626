# IMD: physical shorts and oracle integration review

Review package for `4626fun/4626`, prepared 2026-09-29.

- Archive: [IMD_PHYSICAL_SHORTS_ARCHIVE.b64](IMD_PHYSICAL_SHORTS_ARCHIVE.b64) (base64-encoded ZIP)
- Archive SHA-256: `9013890821d4db97684171d8414cb850399edb1a13bd1b23fa0192cf018872ba`
- Upstream source: `wenakita/4626` @ `2a9e1334d5b9a13a555c6672e0ec0e735da24bf4`
- 31 exact upstream files; five suites; baseline **78 passed, 0 failed, 0 skipped**.
- Source and test manifest, pinned build dependencies, reproduction instructions and complete review brief are inside.

## Ready-to-paste review request

Review the physical-short and oracle-integration snapshot in IMD_PHYSICAL_SHORTS_ARCHIVE.b64 from this branch. Decode base64 to IMD_PHYSICAL_SHORTS_REVIEW.zip. Pin this public branch's commit before starting. Verify the ZIP SHA-256 `9013890821d4db97684171d8414cb850399edb1a13bd1b23fa0192cf018872ba`, extract it, and follow imd-physical-shorts/BRIEF.md. Do not review the older contracts tree at public main instead. Verify all 31 source hashes before and after testing.

Investigate collateral sizing under caps, Ajna interest/debt reconciliation, multi-position close/liquidation accounting, flash callback and NFT authorization, and oracle freshness/recovery. Treat the brief's concerns as hypotheses to reproduce or refute. Add regression and stateful invariant tests; preserve production source and existing tests. Require a different reviewer to inspect tests and findings, or explicitly disclose that independent review was unavailable. Deliver artifacts/report.md and artifacts/imd-tests.zip with actual test source, hashes, exact commands/exit codes, prerequisites, fixes and coverage gaps. Pin any real Ajna version/fork used and distinguish mock results from deployment evidence. No deployment or production edits.

## Extract and verify

```sh
base64 -d IMD_PHYSICAL_SHORTS_ARCHIVE.b64 > IMD_PHYSICAL_SHORTS_REVIEW.zip
sha256sum IMD_PHYSICAL_SHORTS_REVIEW.zip
python3 -m zipfile -e IMD_PHYSICAL_SHORTS_REVIEW.zip .
cd imd-physical-shorts
python3 verify_manifest.py
```

Continue with README.md to install pinned dependencies and run tests. This package prepares a review; no IMD payment or job submission has been made.

---

# IMD review: 4626 physical shorts and oracle integration

Prepared 2026-09-29. Review only the snapshot in this package, not the older public repository contracts tree.

## Target and scope

Upstream: `wenakita/4626` at `2a9e1334d5b9a13a555c6672e0ec0e735da24bf4`.
`SOURCE_MANIFEST.json` lists 31 exact upstream files, with Git blob and SHA-256 hashes. All source bytes were verified against upstream Git blob hashes before packaging. The private repository need not be accessible: the selected source is supplied here.

Primary contracts: PhysicalShortManager, ShortPositionNFT, PhysicalShortMath, LeverageCapacityMath, ShortRiskMath, LeverageMath, Oracle4626MarkAdapter and MarkPriceOracleAdapter. Included interfaces, mocks, five existing Foundry suites and PHYSICAL_LTV_SHORT.md supply build and design context. Build configuration and npm files are a focused review harness, not the upstream monorepo configuration.

## Requested work

1. Verify archive and source hashes before running anything. Run the existing suites and record tool versions, exact commands and exit codes. Stop and report missing source or dependencies; do not silently substitute public main.
2. Review authorization, collateral and debt conservation, rounding, slippage, flash callbacks, NFT transfers, reentrancy, liquidation incentives and oracle lifecycle. Trace multiple concurrent positions sharing one Ajna borrower.
3. Add meaningful regression and stateful invariant tests under `test/imd/`. Exercise open, close, liquidate, transfer, interest accrual, price updates and time advancement in randomized sequences. Test several positions and realistic 6/18-decimal conversions. Never change production source, existing tests or configuration to make results pass.
4. Have a different reviewer independently inspect the new tests and findings. Name each reviewer/seat and describe their contribution. Self-review is not an independent review; explicitly report if a second reviewer was unavailable.
5. Deliver an evidence-backed report plus the actual added test files. Classify each concern as reproduced, refuted, intended/trusted-admin behavior or unresolved. Separate code facts from assumptions about deployed contracts. Include minimal fix proposals, not production modifications.

## Questions to investigate (unconfirmed hypotheses)

These are review leads from static inspection, not confirmed vulnerabilities or severity assignments. Try to disprove them.

- When a user/book/bind cap clips notional, does pledged collateral still satisfy both the target collateral ratio and the size-factor limit after refunds? Can any permitted configuration open a position already eligible for liquidation? Check preview and execution consistency, cap boundaries and rounding.
- Does positionDebtWad use the same up-to-date inflator and rounding as the real Ajna repay path? Can close/liq remove a ticket while leaving attributable t0 debt, or fail to release collateral? Check idle interest accrual, origination charges, partial repayment and closing positions in different orders. Mocks alone cannot establish compatibility with real Ajna.
- Can a persistent price move beyond maxMoveBps prevent Oracle4626MarkAdapter from refreshing until its last observation becomes stale? Trace both user exits and liquidation during the stale period, available recovery permissions and economic exposure. Examine USD-denominated oracle values versus USDC settlement assumptions.
- Across direct and flash unwind, are debt, collateral, proceeds, keeper incentives and refunds conserved and attributed to the right position/recipient? Are callback commitments and NFT ownership checks sufficient?
- Does the liquidation event identify the actual keeper in both direct and flash paths? Distinguish telemetry issues from asset loss.

## Integration evidence and limits

For any Ajna integration claim, pin the exact upstream commit/version used. If a fork test is possible, record chain, pool address and block. Do not assume Ajna master equals a deployed pool or assert that this package addresses a reported Ajna-core incident. If chain/version details or RPC access are absent, report the gap and use an explicitly labeled integration model. Do not invent deployment addresses.

The package excludes the full production Oracle4626 implementation, real Ajna pool code, Uniswap V4 swap adapters, vaults, governance, deployment wiring and frontend. Uniswap v4-core is a pinned type dependency required by the oracle interface; its inclusion does not extend this review to V4 swaps. No live-bytecode equivalence or full-protocol safety claim is possible from this snapshot. External dependencies retain their own licenses.

## Deliverables and acceptance

- `artifacts/report.md`: target/hash, scope, environment, baseline and added-test results, findings with file/line references, prerequisites, impact, reproduction command, remediation, independent review record, coverage gaps and open questions.
- `artifacts/imd-tests.zip`: actual new tests and any isolated test support, a README with copy/run instructions, and a SHA-256 manifest. No credentials, dependencies, caches or production changes.
- Include useful stateful invariants, or explain precisely why unavailable. Record fuzz seeds/runs and invariant runs/depth actually executed.
- Clearly label any passing test that asserts defective behavior; passing such a test confirms the behavior, not safety.
- Preserve and recheck all source hashes after testing. Report any deviation from baseline; do not claim a completed independent audit merely because baseline tests pass.

No deployment, wallet actions or production edits are requested. This package is preparation for review, not a paid job submission.
