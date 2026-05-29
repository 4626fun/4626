# General Audit — Smart Contracts Scoped Hygiene Lens (May 2026)

**Scope**: Hygiene, drift, canonical terminology adherence, maintainability, and invariant implementation quality in the Solidity contracts.  
**Not in scope**: Full re-security audit (Codex, system.md, Slither, etc. already exist). Focus is consistency with the project's own stated rules and recent x-ray / bug-audit-worksheet guidance.

**Date of work**: Current session  
**Auditor framing**: Meta-audit style — does the current source match the constitutional documents (AGENTS.md, ACCOUNT_MODEL.md, x-ray invariants, canonical lane policy) and recent internal review artifacts?

---

## Executive Summary (SC Lens)

The contracts show **good engineering discipline** in several places (module wiring, payout lane separation, active bytecode management), but there are clear **documentation rot** and **partial adoption** issues around the canonical value lane terminology that the project itself declared load-bearing.

The most acute technical risk is **CreatorLotteryManager** sitting 49 bytes from the EIP-170 hard cap, with explicit past work to stay under the limit.

Most architectural guards on the broader repo are passing, which is a positive signal.

---

## Key Findings

### SC-01: Canonical Lane Reference Document is Missing (High — Documentation Rot)

**AGENTS.md** (and multiple other high-authority locations) states:

> All docs, UI copy, commit messages, and code comments that reference 4626's value lanes must use the canonical terms defined in `docs/audits/creatorvault-business-logic-core-structure-audit.md`.

The file does not exist in the repository.

Multiple code paths and comments still reference the five required names (`tradeFeeCollector`, `creatorCoinPayoutRecipient`, `creatorTreasury`, `jackpotCustodian`, `jackpotPayoutAuthority`).

**Impact**: One of the most emphasized naming invariants in the project has a dangling reference. This makes the "canonical" claim unenforceable in practice.

**Recommendation**: Either restore/create the canonical document or update AGENTS.md + all references to point to the actual source of truth (or retire the strict naming policy if it is no longer enforced).

---

### SC-02: Incomplete Adoption of Canonical Lane Terminology in Solidity (Medium-High — Drift)

**Evidence**:
- `tradeFeeCollector()` exists on `CreatorShareOFT` with an explicit "Canonical terminology" comment (good).
- `creatorTreasury` is used in `CreatorGaugeController` and `DeploymentBatcher`.
- `creatorCoinPayoutRecipient`, `jackpotCustodian`, and `jackpotPayoutAuthority` are almost absent from `.sol` source.
- The old bare term `payoutRecipient` is still present in:
  - `contracts/helpers/batchers/DeploymentBatcher.sol` (struct fields + explicit `if (params.payoutRecipient != address(0)) revert` in phase 2 paths, with comments calling it "CreatorCoin payout recipient").
  - `PayoutRouter.sol` comments ("Safe CreatorCoin payoutRecipient path").
  - `CreatorCoinPolicyController.sol` comments.

**Impact**: The exact anti-pattern the canonical lane policy was written to eliminate still lives in the most important wiring point (the DeploymentBatcher that actually sets the recipient at deploy time).

**Recommendation**: 
- Decide whether the strict naming policy is still active.
- If yes, migrate the remaining `payoutRecipient` identifiers in DeploymentBatcher (and comments elsewhere) to the qualified names, or add clear internal aliases with the canonical mapping documented.

---

### SC-03: CreatorLotteryManager at Extreme EIP-170 Risk (High — Maintainability)

**Measured size** (from existing artifacts): **24,527 bytes** (49 bytes headroom under the 24,576 EIP-170 cap).

**Evidence of active management**:
- Explicit comment in the AMOE section: "to keep runtime bytecode under EIP-170".
- `CLM-03` fix: compact `uint8 reason` event instead of repeated strings.
- Omission of `AmoeEntryRecorded` event for size reasons (off-chain filtering instead).
- Heavy use of the AdminModule delegatecall pattern to move implementation out of the hub contract.

The CI already has a dedicated warn-only "CreatorLotteryManager size warn-guard (76B headroom)" on top of the hard `--sizes` gate.

**Related invariant gap** (from `docs/audits/x-ray/invariants.md` I-6):
> Sponsorship policy changes in lottery manager have a guard-lift mismatch between unrestricted wrapper signatures and `onlyDelegateCall onlyOwner` versions.

The main contract uses stub functions + `_delegateAdmin()` to a separate `CreatorLotteryManagerAdminModule`. Many sponsorship and config setters in the AdminModule correctly carry `onlyDelegateCall onlyOwner`.

**Impact**: Any non-trivial new feature, better error messages, or additional safety checks on this contract risks making the next greenfield deploy or upgrade impossible without further extraction.

**Recommendation**: Treat further growth of this contract as a P0 maintainability item. Consider formalizing a "no new events or public state without size budget review" policy for it.

---

### SC-04: v1.12 Module Storage Hygiene is Explicit but Manual (Medium — Positive with Caveat)

**CreatorOVaultModuleStorage.sol** + `setModulesOnce` + `_validateModuleIdentity` is well implemented:

- Runtime check that the module returns the exact expected `MODULE_STORAGE_VERSION = keccak256("CreatorOVaultModuleStorage.v2")`.
- Additional kind checks, zero-address guards, code existence, and mutual exclusion.
- Called from `DeploymentBatcher` during Phase 1.
- All three modules (`Core`, `Strategies`, `Admin`) implement the identity interface.

The storage contract itself contains this comment:

> Consider adopting ERC-7201 namespaced storage for structural collision immunity.

**Impact**: Current approach works and is enforced at deploy time. It is still a manual discipline rather than a compiler/runtime-enforced namespacing primitive.

**Recommendation**: The current rigor is good. The ERC-7201 suggestion is a reasonable future improvement if more modules are added.

---

### SC-05: Payout Lanes Are Architecturally Separate and Enforceable (Positive)

The two Creator Coin earnings planes are correctly implemented as distinct mechanisms:

- **Trade-fee lane** (`tradeFeeCollector` domain): `CreatorGaugeController._distributeVaultShares()` → burn / lottery (jackpotReserve) / `creatorTreasury` / protocol/voter rewards.
- **External revenue lane** (`creatorCoinPayoutRecipient` domain): `PayoutRouter` (with keeper gating and external swap support) → swap to creatorCoin → vault deposit → `VaultShareBurnStream` (ownerless, only-burn, with failed-burn accumulator cap and recovery).

`VaultShareBurnStream` has received multiple post-audit hardenings (BS-01, BS-03, H-05) and is properly permissionless for the burn path.

This matches the separation described in the (missing) canonical lane document and AGENTS.md.

**Recommendation**: Document this separation clearly in one canonical place and keep the implementation names aligned with the policy.

---

## Guard & Process Signals (Broader Audit Context)

During the same session the following architectural guards were run:

- Most passed cleanly (`server-core-boundary`, `runtime-boundaries`, `api-nonv1-hardening`, `test-file-placement`, `generated-output`, `api-429-retry-after`, etc.).
- `frontend-boundaries`: 2 violations (cross-feature import + API handler reaching into `src/`).
- `api-rate-limit-guards`: 3 handlers using `guardAgentApiRequest` but missing actual rate-limit calls.

This is consistent with a repo that has invested heavily in custom guardrails and mostly keeps them green.

---

## Recommendations (SC Lens)

1. **Resolve the canonical lane reference** (create the doc or update AGENTS.md). This is the highest documentation hygiene item.
2. **Decide on terminology migration** for the remaining `payoutRecipient` usages in `DeploymentBatcher`. Either finish the migration or document the exception.
3. **Treat CreatorLotteryManager size as an ongoing P0 constraint**. Any new public surface on this contract should require an explicit size budget review.
4. **Close or explicitly accept the I-6 sponsorship guard-lift gap** in the lottery manager (document the intended security model for the delegatecall admin module pattern).
5. Consider adding a lightweight "SC hygiene" check (terminology + size headroom on key contracts) to the existing guard suite or pre-PR checklist.

---

## Additional Verified Observations (Deployment Path)

**DeploymentBatcher Phase State Machine & Partial Execution**

- Explicit `Phase1SplitState` struct with `coreDone` / `finalized` flags, stored in a mapping keyed by `baseSalt = keccak256(creatorToken, owner, chainId, "4626:deploy:", version)`.
- Phase 1 core and finalize paths check the existing state and early-return with prior results if already completed for that salt (idempotent / retry-safe partial execution).
- There is a privileged `resetPhase1State` (onlyProtocolTreasury) for stuck states, with guards against active pending auctions.

**Owner Enforcement**

- Multiple phase entrypoints (including Phase 3 strategies, UniV4, etc.) perform `if (IOwnableView(params.vault).owner() != params.owner) revert NotOwner();`.
- This validates at execution time that the declared creator owner still controls the vault.

**CREATE2 Factory Authorization (UniversalCreate2DeployerFromStore)**

- Explicit owner + `authorizedDeployers` allowlist (post F-13).
- Deploy calls require `msg.sender == owner || authorizedDeployers[msg.sender]`.
- This is the intended protection against salt squatting on the shared factory.

**Salt Derivation**

- `deriveBaseSalt` in `DeploymentBatcherUtilsHelper`: `keccak256(creatorToken, owner, chainId, "4626:deploy:", version)`.
- Combined with per-label `_saltFor(baseSalt, label)`, this provides strong per-creator/version/chain namespacing.

These items address several P0 entries from `docs/audits/x-ray/review-todo.md` (phase ordering/state machine, owner enforcement, factory authorization model). Implementation appears sound with explicit guards and retry support.

---

## Items Explicitly Reviewed Against Internal Checklists

This work directly addressed multiple entries from `docs/audits/x-ray/review-todo.md` (P0) and `bug-audit-worksheet.md`:

**Deployment Path (P0)**
- Phase ordering / state machine: Verified via `Phase1SplitState` (`coreDone`, `finalized`), early-return logic on repeat calls for the same salt, and `resetPhase1State` guardrails.
- `msg.sender == params.owner` / `NotOwner` enforcement: Present at multiple phase entrypoints (Phase 3, UniV4, etc.) using `IOwnableView`.
- `UniversalCreate2DeployerFromStore` authorization model: Explicit owner + `authorizedDeployers` allowlist (post F-13 fix).
- CREATE2 salt / codeId collision assumptions: `deriveBaseSalt` includes `creatorToken + owner + chainId + version`; per-label `_saltFor` used downstream.

**CreatorLotteryManager (P0)**
- Replay / nonce / deadline lifecycle: Reviewed struct usage, `requestTimestamp`, `vrfResultGracePeriod`, stale result handling, and sponsorship policy paths.
- Guard-lift mismatch on sponsorship setters (I-6 from invariants map) confirmed in the main + AdminModule delegatecall pattern.

**Module System (v1.12)**
- `setModulesOnce` + versioned storage checks (`CreatorOVaultModuleStorage.v2`) reviewed and found rigorous.

**Terminology & Value Lanes**
- Cross-checked against the canonical lane policy stated in AGENTS.md and the (missing) `creatorvault-business-logic-core-structure-audit.md`.

---

## Limitations & Confidence

- Focused on hygiene, drift, and adherence to the project's own stated rules rather than adversarial security review.
- Depth prioritized highest-risk surfaces per internal artifacts (LotteryManager size, DeploymentBatcher, module wiring, terminology).
- Some "On-chain: No" items from the x-ray invariants map were noted but not exhaustively validated in every calling context.
- Test coverage and mutation testing were out of scope for this pass.

**Confidence**: High on the specific findings reported (file-level evidence + direct code reads). Medium on completeness across the entire contract surface.

---

## Out of Scope / Deferred

- Full re-audit of economic/game-theory properties (see `docs/audits/system.md`).
- Detailed review of every recent change since Codex.
- Test coverage depth or mutation testing on the above areas (recommended as follow-up).
- Solana program (Anchor) — out of scope per original plan.
- Comprehensive cross-contract invariant proving.

---

*SC hygiene section complete. This document now serves as a self-contained reference for the smart contracts portion of the general audit.*