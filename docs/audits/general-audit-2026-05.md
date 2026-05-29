# General Audit — 4626 Monorepo (May 2026)

**Type**: Meta-audit / consistency & boundary review (not a full re-security audit)  
**Date**: Current session  
**Framing**: How well does the current system follow the project's own stated constitutional rules, recent internal review artifacts (x-ray, bug-audit-worksheet), and its own guardrails?

**Status**: Complete for this pass. SC hygiene lens is the most mature section; other lenses have initial signals and clear recommended follow-up.

---

## Executive Summary

The 4626 monorepo demonstrates **strong engineering maturity** in several dimensions: custom architectural guardrails (mostly effective), thoughtful internal checklists (`x-ray/review-todo.md`, `bug-audit-worksheet.md`), and deliberate patterns in the deploy and module systems.

However, there is noticeable **drift** between the project's own "constitutional" documents (AGENTS.md, canonical lane policy, ACCOUNT_MODEL.md) and day-to-day reality, particularly around terminology and reference documentation. One contract (`CreatorLotteryManager`) is operating at extreme technical risk (49 bytes from EIP-170).

**Overall posture**: Solid foundation with clear, addressable hygiene and maintainability issues. The team has the tools and culture to fix them quickly.

---

## Scope & Approach

Followed the approved plan:
- 6 primary lenses + one added scoped smart-contracts hygiene lens (at user request).
- Heavy reliance on existing high-quality artifacts rather than starting from scratch.
- Ran the project's own guard scripts as primary evidence.
- Focused on drift vs. stated rules and maintainability.

**Detailed SC findings**: See [general-audit-2026-05-sc-hygiene.md](./general-audit-2026-05-sc-hygiene.md) (now complete, including explicit mapping to x-ray P0 items).

---

## Guard & Process Hygiene (Lens C — Boundary Enforcement)

**Results** (current session):
- Majority of guards passed cleanly.
- Notable failures:
  - `guard:frontend-boundaries` — 2 violations (cross-feature + API → src/ leakage).
  - `guard:api-rate-limit-guards` — 3 handlers missing actual rate-limit enforcement despite using the guard wrapper.
- Positive: Strong culture of custom, enforceable guards in CI. Most surfaces respect the intended boundaries.

**Observation**: Process maturity is high. The failures are narrow and low-risk to fix.

---

## Smart Contracts — Scoped Hygiene Lens

**Top findings** (full detail in the sub-document):

**High / Documentation & Terminology**
- SC-01: Canonical lane reference document (`creatorvault-business-logic-core-structure-audit.md`) is referenced in AGENTS.md and multiple places but does not exist.
- SC-02: Incomplete adoption of the five mandated canonical value lane names. Bare `payoutRecipient` still lives in `DeploymentBatcher` (the actual wiring point) and supporting comments.

**High / Maintainability**
- SC-03: `CreatorLotteryManager` at 24,527 bytes (49 bytes headroom). Active bytecode-saving work is visible in the source. Related invariant gap (I-6) on sponsorship policy guard-lift via the AdminModule delegatecall pattern.

**Medium / Positive with Caveat**
- SC-04: v1.12 module storage system (`CreatorOVaultModuleStorage.v2`) is explicit and enforced at `setModulesOnce` time — rigorous but manual.
- SC-05: Payout lanes are correctly separated architecturally (`tradeFeeCollector` domain vs external revenue via `PayoutRouter` + `VaultShareBurnStream`).

**Positive Verified (x-ray P0)**
- DeploymentBatcher has a working partial/retry state machine, consistent owner enforcement at phase entrypoints, proper namespaced salt derivation, and a correctly restricted `UniversalCreate2DeployerFromStore`.

**Overall SC posture**: Engineering quality is high where examined. The dominant issues are documentation rot around the project's own "canonical" claims and one contract living on the edge of a hard technical limit.

---

## Account Model / Constitutional Invariants (Lens A — Early Signals)

Started review of the files recommended in `bug-audit-worksheet.md` (highest-ROI lens per the plan).

**Early observations** (positive):
- `executionTrack.ts` is a clean, pure classifier that correctly implements the `legacy-owner-install` vs `sub-account` vs `none-yet` model described in AGENTS.md and the ERC-4337 rules.
- `canonicalCswPersistence.ts` + `walletSync.ts` properly route through policy checks and avoid overwriting canonical CSW addresses with owner EOAs.
- `profileMerge.ts`, `identityRecovery.ts`, `accountsIdentity.ts`, and `profileIdForPrivyUser.ts` all implement the required tombstone chasing (`merged_into_profile_id`) and alias (`privy_user_aliases`) behavior demanded by the account invariants.
- Collision guards (`assertNoWalletPrivyCollision`, email collision paths) are present and used at profile creation/sync points.

**Signal**: The core account model plumbing appears to be following the constitutional rules. Deeper adversarial review of edge cases (especially Telegram + Zora cross-app flows) is recommended as follow-up.

---

## High-Level Posture & Risk Concentration

**Strengths**
- Excellent internal self-review artifacts and guard investment.
- Deliberate, defensive patterns in the deploy and module systems.
- Account model code is largely aligned with the documented invariants.

**Areas of Friction**
- Terminology & reference documentation drift (the "canonical" claims are not fully lived in the code/docs).
- One contract (`CreatorLotteryManager`) at extreme size risk.
- Narrow but real guard failures in rate limiting and frontend boundaries.
- A few remaining "On-chain: No" items from the x-ray invariants map.

**Risk Concentration**
- CreatorLotteryManager size + sponsorship policy surface.
- Any future growth in the DeploymentBatcher or module system without size/version discipline.
- Documentation rot on high-authority claims (makes future work more error-prone).

---

## Prioritized Recommendations

**Immediate (High Impact, Low Effort)**
1. Resolve the missing canonical lane reference document (or explicitly retire the strict naming policy).
2. Decide on and execute (or document exception for) the remaining `payoutRecipient` usages in `DeploymentBatcher`.
3. Fix the three rate-limit guard failures and the two frontend boundary violations.

**Short Term**
4. Establish a size budget review gate for any new surface on `CreatorLotteryManager`.
5. Document the intended security model for the LotteryManager AdminModule delegatecall pattern (accept or close I-6).
6. Add a lightweight "SC hygiene + terminology" check to the guard suite or PR template.

**Medium Term (per approved plan)**
- Complete Lens A (full adversarial review of account model edges, especially cross-channel flows).
- Systematic source-vs-deployed drift checks on recent batcher/module changes.
- Close remaining x-ray "On-chain: No" items with explicit disposition.

---

## Remaining Work

- Full depth on Lens A (account model) and Lens B (non-contract documentation drift).
- Source vs deployed verification on the current live batcher and v1.12 modules.
- Any quick-win fixes from the guard failures and terminology issues.
- Optional: lightweight SC hygiene guard addition.

This pass has produced actionable, referenced findings with clear ownership and next steps. The codebase has the maturity to absorb and act on them rapidly.

---

*End of current pass. SC hygiene sub-document is complete.*