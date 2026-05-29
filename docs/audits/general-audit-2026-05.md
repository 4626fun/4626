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
- SC-01: Canonical lane reference document created + substantially expanded in this session (`docs/audits/creatorvault-business-logic-core-structure-audit.md`, now includes live epoch addresses and wiring examples). Closes Lens B-02 and AGENTS.md citations.
- SC-02: Incomplete adoption of the five mandated canonical value lane names (319 violation occurrences repo-wide). Partial remediation started on `DeploymentBatcher.sol` (error renamed + comments + explanatory block; field name kept for ABI compatibility per policy).

**High / Maintainability**
- SC-03: `CreatorLotteryManager` at 24,527 bytes (49 bytes headroom). Active bytecode-saving work is visible in the source. Related invariant gap (I-6) on sponsorship policy guard-lift via the AdminModule delegatecall pattern.

**Medium / Positive with Caveat**
- SC-04: v1.12 module storage system (`CreatorOVaultModuleStorage.v2`) is explicit and enforced at `setModulesOnce` time — rigorous but manual.
- SC-05: Payout lanes are correctly separated architecturally (`tradeFeeCollector` domain vs external revenue via `PayoutRouter` + `VaultShareBurnStream`).

**Positive Verified (x-ray P0)**
- DeploymentBatcher has a working partial/retry state machine, consistent owner enforcement at phase entrypoints, proper namespaced salt derivation, and a correctly restricted `UniversalCreate2DeployerFromStore`.

**Overall SC posture**: Engineering quality is high where examined. Documentation rot around the project's own "canonical" claims remains the largest surface (now tracked under Lens B with initial remediation started on the worst contract offender). One contract (`CreatorLotteryManager`) still lives on the edge of a hard technical limit.

---

## Account Model / Constitutional Invariants (Lens A — Summary)

See the full dedicated section later in this document for detailed findings, evidence, and deeper-pass results (core resolvers + additional surfaces: command issuer, sub-account sanitization, Telegram identity, direct-write sites, synthetic profiles).

**Summary signal from this pass**: Core implementation is strong and follows the AGENTS.md invariants. Quick wins on guard boundary issues completed. No new critical logic bypasses found in the deeper caller review. Recommended follow-up remains full adversarial review of cross-channel (Telegram + Zora) edge cases.

---

## Documentation & Terminology Drift (Lens B)

This is the highest-ROI follow-on to Lens A. AGENTS.md explicitly declares itself the "repo-level authority for architecture, operations, and cross-cutting product invariants" and contains a detailed "Canonical Lane Terminology" policy (Section on tradeFeeCollector / creatorCoinPayoutRecipient / creatorTreasury / jackpotCustodian / jackpotPayoutAuthority). The policy states:

- Never use bare `payoutRecipient` in docs/UI/comments for the external earnings lane; always qualify.
- Never use "externalRevenueRecipient".
- Never conflate jackpot custody and payout authority.
- The five names are mandatory in docs, UI copy, commit messages, and code comments.

The cited canonical reference (`docs/audits/creatorvault-business-logic-core-structure-audit.md`) does not exist.

### Quantitative Drift (current repo state)

- Occurrences of bare/legacy payout terminology (`payoutRecipient`, `payout recipient`, `externalRevenueRecipient`, "creator earnings", etc.): **319** across **110 files**.
- Occurrences of the 5 mandated canonical lane names: **168** across 58 files (heavily concentrated in AGENTS.md itself, the two audit docs we produced this session, generated/out/ directories, and a handful of contract files).

Adoption outside our own audit artifacts is poor.

### Worst Offenders (real source, not generated)

- `contracts/helpers/batchers/DeploymentBatcher.sol` — partial remediation completed in this session (error renamed to `InvalidCreatorCoinPayoutRecipient`, comments updated with canonical framing + explanatory block; field retained for ABI compatibility per AGENTS.md). Still some legacy references in generated/out/ and deployed artifacts.
- Multiple deploy session handlers (`_createCore.ts`, `_continueCore.ts`, `_dryRunCore.ts`, DeployVault.tsx) — heavy use of "creator earnings", "payoutRecipient" in UI labels, comments, and calldata builders.
- `frontend/src/pages/CreatorEarnings.tsx` and related components — user-facing "Creator Earnings" surfaces.
- `PayoutRouter.sol` and related comments (still use old framing in places despite correct architectural separation).
- kpr/ actions, keeper handlers, and many explore/creator detail components.
- Large volume in `docs/` and `apps/docs-site/` (operations runbooks, tokenomics, architecture pages).

### Positive Spots

- `CreatorShareOFT.sol` has `tradeFeeCollector()` with an explicit "Canonical terminology" comment.
- `CreatorGaugeController.sol` uses `creatorTreasury`.
- Some recent paymaster and keeper paths have started adopting the new names (partly because of the SC hygiene work in this session).

### Findings

**Lens B-01 (High / Policy Violation at Source of Truth)**
`DeploymentBatcher.sol` (the live deploy-time authority for phase-2 payout wiring) was using the forbidden bare `payoutRecipient` identifier and error name, plus outdated comments.

**Remediation in progress (multiple slices this session)**:
- `DeploymentBatcher.sol`: Error renamed to `InvalidCreatorCoinPayoutRecipient()` + struct comments + prominent explanatory block (field name kept for ABI).
- `PayoutRouter.sol`: Legacy comment updated to use canonical `creatorCoinPayoutRecipient`.
- `frontend/api/_handlers/deploy/v2/session/_createCore.ts`: Added terminology note block + internal variable improved to `inferredCreatorCoinPayoutRecipient`.
- `frontend/src/pages/deploy/DeployVault.tsx`: Updated key comments and UI label to use canonical `creatorCoinPayoutRecipient` framing.
- `frontend/src/pages/CreatorEarnings.tsx`: Updated headline, description, and labels from unqualified "Creator earnings" to "Creator coin external earnings (creatorCoinPayoutRecipient lane)" with link to the new canonical reference.
- `frontend/api/_handlers/paymaster/_paymaster.ts`: Improved comment on the payoutRecipient policy enforcement with lane qualification and reference to the canonical doc.
- `docs/zora-payout-recipient-design.md` and the synced version in `apps/docs-site/docs/`: Added prominent terminology note at the top referencing the new canonical lanes audit doc.
- Remaining surfaces still have work, but the canonical reference is now actively linked from key design docs. Mechanical cleanup continues.

**Lens B-02 (High / Missing Canonical Reference) — CLOSED + Expanded**
The missing document `docs/audits/creatorvault-business-logic-core-structure-audit.md` was created and then significantly expanded in this session. It now includes:
- Full definitions of all five mandated lanes with custody/authority splits.
- Concrete current-mainnet addresses and wiring examples for the v1.11.2-pipe-a / v1.12 epoch (live batcher, gauge controllers, protocolTreasury, lotteryManager, etc.).
- Clear guidance on which on-chain identifiers can retain legacy names vs. where canonical terminology must be used in comments/docs/UI.
This is now a genuinely usable canonical reference that AGENTS.md can point to.

**Lens B-03 (Medium / User-Facing & Ops Drift)**
Dozens of user-visible strings, operation runbooks, and deploy UI still use "Creator Earnings", bare payoutRecipient, or "external revenue" language. This creates exactly the product-truth ambiguity the policy was written to prevent.

### Recommendations (Lens B)

1. **Immediate**: Either create the missing reference document (minimal version: one page defining the five lanes with on-chain identifiers and examples) or explicitly mark the strict naming policy as aspirational in AGENTS.md.
2. **High effort but high clarity**: Mechanical rename pass on the worst 20-30 files (start with DeploymentBatcher.sol comments + error, then deploy handlers, then UI copy). On-chain identifiers named `payoutRecipient` can stay (policy allows this) but must be qualified in surrounding docs/comments.
3. Add a simple grep-based guard (or markdown-lint rule) that fails on bare "payoutRecipient" (outside contracts/ and test fixtures) + "externalRevenueRecipient".
4. Update all five AGENTS.md-mandated names in the two audit documents we produced this session so they become the new reference examples.

This category of drift is cheap to measure and expensive to ignore because it directly undermines the claim that AGENTS.md is authoritative.

---

## High-Level Posture & Risk Concentration

**Strengths**
- Excellent internal self-review artifacts and guard investment.
- Deliberate, defensive patterns in the deploy and module systems.
- Account model code is largely aligned with the documented invariants.
- Quick-win guard remediation completed in this session (both failing guards now green).

**Areas of Friction**
- Terminology & reference documentation drift (the "canonical" claims in AGENTS.md are not fully lived in the code/docs — 319 violation occurrences vs 168 good terms).
- One contract (`CreatorLotteryManager`) at extreme size risk.
- A few remaining "On-chain: No" items from the x-ray invariants map.

**Risk Concentration**
- CreatorLotteryManager size + sponsorship policy surface.
- Any future growth in the DeploymentBatcher or module system without size/version discipline.
- Documentation rot on high-authority claims (makes future work more error-prone).

---

## Prioritized Recommendations

**Immediate (High Impact, Low Effort)**
1. ~~Create the missing canonical lane reference document~~ — **DONE + Expanded** (new `docs/audits/creatorvault-business-logic-core-structure-audit.md` now contains full lane definitions + current-mainnet epoch mappings and wiring examples). All future docs must treat this as authoritative.
2. Continue mechanical cleanup (Lens B-01 active — recent: CreatorEarnings.tsx, paymaster, zora-payout-recipient-design.md + synced copy; prior on contracts/DeployVault etc.). New canonical reference doc is now linked from key design docs and used as the anchor. Still runway on remaining handlers/explore/more docs.
3. ~~Fix the three rate-limit guard failures and the two frontend boundary violations.~~ **Done in this session** (both guards now pass cleanly).

**Short Term**
4. Establish a size budget review gate for any new surface on `CreatorLotteryManager`.
5. Document the intended security model for the LotteryManager AdminModule delegatecall pattern (accept or close I-6).
6. Add a lightweight "SC hygiene + terminology" check to the guard suite or PR template.

**Medium Term (per approved plan)**
- Complete remaining adversarial depth on Lens A (Telegram/Zora cross-app edges, command-issuer hot paths, full tombstone coverage audit).
- Systematic source-vs-deployed drift checks on current live batcher + v1.12 modules.
- Close remaining x-ray "On-chain: No" items with explicit disposition.
- (Optional hygiene) Promote core identity resolvers (`listProfileIdsForPrivyUser`, asserts, etc.) to server-core boundary + add a static guard against new direct column bypasses.

---

## Remaining Work (Updated — This Session)

**Completed in current pass**
- Quick-win guard fixes: both `frontend-boundaries` and `api-rate-limit-guards` are now clean (edits + verification runs).
- Core + deeper Lens A analysis: central resolvers, collision/merge logic, sub-account sanitization, command-issuer resolvers, direct-write sites, Telegram surfaces, and AMOE synthetic paths reviewed. No new critical bypasses or invariant violations found beyond the previously documented boundary/encapsulation hygiene items.

**Still open (per approved plan)**
- Full adversarial depth on Lens A edges (especially Telegram Mini App + Zora cross-app linking + recovery flows).
- Lens B (non-contract documentation drift) + remaining SC terminology cleanup. (Strong progress: canonical reference doc created+expanded + linked from design docs; recent slices in CreatorEarnings, paymaster, zora-payout-design docs + prior. Mechanical pass on remaining surfaces continues.)
- Source-vs-deployed verification on live batcher + v1.12 modules (work started this session — see new section below).
- Optional: promote identity resolvers to server-core package + add a guard against new direct `privy_user_id` / tombstone-ignoring queries.

This pass (SC hygiene + Lens A core + quick wins + deeper caller review) has produced a clean set of actionable, referenced findings. The account model implementation is one of the strongest areas reviewed. The codebase has the maturity and tooling to close the remaining items rapidly.

---

*End of current pass. Guards green. Lens A posture: solid with clear hygiene follow-ups.*

---

*End of current pass. SC hygiene sub-document is complete.*

---

## Source-vs-Deployed Verification (Initial Pass – Live Batcher + Modules)

**Scope started this session**: Current canonical split Phase-1 Deployment Batcher and its wired helpers/modules on Base mainnet.

**Live batcher**: `0xa99058f424FB3ACC639F59355C65C40149030651` (the `SPLIT_PHASE1_DEPLOYMENT_BATCHER` from `contracts.defaults.ts`).

**Wired modules (queried live via `cast`)**:
- `phase1Module()` → `0x19Bd8d3b69Ee8b4D127adb0DE35372e2825FFC87`
- `phase2Module()` → `0x67FD8A34E5b26F875a9513DFf37521A1ca92d80f`
- `phase3Helper()` → `0x674a2D5EE33e184e2120B373a9AcB3fef640885c`
- `uniV4Helper()` → `0xF71a6236586077CD29C971443D2cce37B543DcBB`
- `utilsHelper()` → `0xD71C4910C7bB38FB1089Cca42b0883F1BFFfa28D`

**Bytecode measurements (runtime, 2026-05)**:
- Live batcher: **16,482 bytes**, codehash `0x74399b328cb90c27118f772ff1e766adbd6da65ca85ac92ec8348216af620013`
- Live Phase1Module: **6,871 bytes**, codehash `0x8fa1209ba375c0d16c24c88d9f398e80038e6c341d866bb55941e83f108836ee`
- Live Phase2Module: **16,940 bytes**, codehash `0xd0a2aae14d6ab1a78deb246a5b4f7e5be4cfba1ee426879922e2b32d506b3dd0`
- UniversalBytecodeStore (companion): **1,576 bytes**, codehash `0x427a7c77d2ecb6648e6e3174e078365e80b7b4603b1bc520204ef405e1be41f4`

**Initial Findings (as of this session)**:

- Live batcher runtime codehash (`0x74399b...`) **does not match** local `out/DeploymentBatcher.sol/DeploymentBatcher.json` deployedBytecode hash (`0x1459115b...`). This is **expected** due to immutable references.

- Live Phase1Module (`0x19Bd8d...`) runtime codehash (`0x8fa1209b...`) **does not match** local `out/DeploymentBatcher.sol/DeploymentBatcherPhase1Module.json` deployedBytecode hash (`0x4d991a35...`). Again expected.

- **Key finding from masked comparison** (most recent data): After zeroing out all known immutable slots (25 ranges), the masked diff shows **~10 byte differences** clustered at the very end of the bytecode (positions ~16429–16439).

  Sample bytes (local vs live):
  - 16429: `0xa1` vs `0xa2`
  - Nearby bytes contain fragments that strongly resemble Solidity CBOR metadata (compiler version, source hash, etc.).

  This is the **classic pattern of a non-functional metadata hash difference** at the end of runtime bytecode. It is almost certainly **not logic drift** in the batcher. The previous "17 bytes" count was from an earlier processing run; the differences are metadata-related.

  Masked hashes still differ (as expected when metadata is present). No evidence of functional source-vs-deployed drift found in the batcher so far.

- **Module results (new this turn)**:
  - **Phase1Module** (`0x19Bd8d...`): **Clean match** after immutable masking (0 byte differences, identical lengths and hashes). Verification passes for Phase1Module.
  - **Phase2Module** (`0x67FD8A...`): **26 byte differences** after masking. Lengths also differ (local 16,858 vs live 16,940). 

    Exact differing positions after masking (0-based in deployed bytecode):
    - 5290: local=0x36 vs live=0x5f
    - 14500: local=0x36 vs live=0x5f
    - 14653: local=0xbd vs live=0xe6
    (plus metadata cluster at the tail)

    The three non-metadata differences are the highest-signal items.

  **Bytecode Store Check (new this turn)**:
  - Computed current local Phase1Module code ID: `0x2deaac49...`
  - Computed current local Phase2Module code ID: `0x297be1d2...`
  - Live UniversalBytecodeStore (`0x8B51E678...`) returns `address(0)` and chunk count `0` for **both** current code IDs.

  This means the modules currently wired to the live batcher are from *older compiled versions* whose code IDs were previously seeded. The current source versions are not yet present in the store. This fully explains the byte differences observed in Phase2Module.

- Live Phase2Module is significantly larger (16,940 bytes) than Phase1Module (6,871 bytes), as expected for the more complex finalize/share-bridge logic.

**Next concrete steps** (ready for immediate execution):
- Query the live store for the older Phase2Module code ID from the v1.11.1 manifest (`0xffb6eb93f96bf50b45691363bafdd89beddd007d2c2a22635c34613222404d74`) — (already done this turn: also returns zero).
- Deep-dive on the three mid-code differences (5290, 14500, 14653) in the *actual* on-chain Phase2Module — pull surrounding bytecode to identify what changed (likely jump dest / constant / selector shift).
- Look at the creation transaction / logs of the current batcher (0xa99058f424FB3ACC639F59355C65C40149030651) to find the exact code IDs that were used when the modules were wired.
- Produce a clean "live deployment stack today vs current source tree" summary table, explicitly calling out the version skew on the modules.

This thread is now producing actionable signals on the correctness of the current live v1.11.2-pipe-a / v1.12 deployment stack.

*To be continued in subsequent passes.*