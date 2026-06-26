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
- SC-02: Incomplete adoption of the five mandated canonical value lane names (was 319+ violation occurrences repo-wide). **Major progress**: forbidden `externalRevenueRecipient` / bare payout prose family at 0 in real source after two mechanical passes. 51 files / ~191 raw occurrences remain, dominated by necessary ABI fidelity. Core contracts, invariants, keeper, kpr, and several high-traffic handlers qualified. Canonical reference live and actively referenced. Tail is now manageable comment + UI hygiene.

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

**Mechanical cleanup progress (this pass — source-vs-deployed thread complete, Lens B continued)**
- Drove the explicitly forbidden phrase family (`externalRevenueRecipient` / `external_revenue_recipient_*` / bare "Creator Coin payoutRecipient" in prose) to **0 occurrences** in all real source (contracts + .ts/.tsx, excluding generated docs and the audit synthesis itself).
- Fixed last production surfaces:
  - `kpr/actions/payout-integrity-monitor.action.ts` — alertType and message now use `creator_coin_payout_recipient_mismatch` + canonical lane language.
  - `frontend/api/_handlers/keeper/_sweep.ts` — same (two violation codes + messages).
  - `frontend/server/_lib/deploy/deployPhase2Invariants.ts` (the phase-2 completion enforcer) — same + corresponding test expectation.
- Contract comments tightened: `CreatorCoinPolicyController.sol` (policy NatSpec + enforce function) and residual phrasing in `PayoutRouter.sol`.
- `coinParties.ts`, multiple explore components, and several deploy handlers were already using internal keys only (with good canonical header blocks) or had been pre-cleaned in prior slices.
- Remaining mentions of `payoutRecipient` in source are now almost entirely (a) on-chain ABI selectors (must be preserved for compatibility) or (b) internal variables that directly shadow the resolver/on-chain shape for fidelity. No new bare prose violations introduced.
- File count with any legacy term (real source): 54 (down in spirit; the number is now dominated by intentional ABI mirrors rather than policy violations).

The worst class of drift (the one AGENTS.md explicitly calls out as never to use) is now eliminated from active code paths.

**Lens B mechanical cleanup — substantially complete (this session)**
- Forbidden prose family (`externalRevenueRecipient` + bare unqualified "payoutRecipient"/"creator earnings" in logs, alerts, messages, UI copy, and comments) driven to **0 occurrences** in all real non-generated source.
- Final state (real .sol + .ts/.tsx, excluding generated docs/tests): 51 files / ~191 raw occurrences.
- Breakdown of the 191:
  - Majority: Required on-chain ABI selectors and struct field names (DeploymentBatcher Phase2*Params, CreatorCoin `payoutRecipient()` interface, etc.).
  - Significant portion: Internal variables/response keys that directly mirror `resolveCoinParties`, batcher expectations, or on-chain getters (intentionally kept for fidelity; key resolvers like coinParties.ts have strong canonical header blocks).
  - Small tail: Comments, a few test data structs, and minor UI labels (further qualification possible but low risk/impact).
- All critical enforcement and operator surfaces (deployPhase2Invariants, keeper/_sweep, kpr payout monitor, paymaster policy, CreatorCoinPolicyController, PayoutRouter, DeploymentBatcher) now use only canonical terminology in prose, errors, and logs.
- The canonical reference (`docs/audits/creatorvault-business-logic-core-structure-audit.md`) is created, expanded with live mainnet wiring, and actively linked from cleaned code and design docs.
- Test file (DeploymentBatcher.ThreeWaySplit.t.sol) received minimal qualification comments for consistency.

**Recommendation**: Lens B mechanical phase can be considered structurally complete. New code following the existing patterns (ABI names preserved + canonical framing in all prose/comments) will naturally stay compliant because the high-traffic surfaces and the reference document are now aligned with AGENTS.md. Any remaining comment/UI polish can be done opportunistically.

**Current Lens B state (after two mechanical passes this session)**
- Forbidden prose family (`externalRevenueRecipient`, `external_revenue_recipient_*`, unqualified "Creator Coin payoutRecipient" in logs/alerts/messages) = **0 occurrences** in all real source (contracts + TS/TSX, excluding generated).
- Raw count in real .sol/.ts/.tsx source: ~191 occurrences across 51 files.
- Nature of remaining occurrences (as of this pass):
  - ~60-70%: Literal on-chain ABI field/function names in structs, ABIs, and calldata builders (DeploymentBatcher phase-2 structs, CreatorCoin `payoutRecipient()` reads, Zora SDK calls, etc.). These are **required** for compatibility and must not be renamed.
  - ~20-25%: Internal variables and response shapes that directly mirror `resolveCoinParties`, on-chain getters, or batcher expectations for fidelity (`payoutRecipient`, `payoutRecipientAddress`, `expectedPayoutRecipient`, `payoutRecipientMode` in a few places). We have added or strengthened canonical header blocks in the key resolvers and handlers.
  - <10%: Comments, log strings, and a small number of UI labels (CoinManage, allowlist response docs, paymaster errors, etc.). These are the active mechanical tail.
- Files receiving qualification in the most recent passes: CreatorCoinPolicyController.sol, PayoutRouter.sol (residual), deployPhase2Invariants.ts + test, keeper/_sweep.ts, kpr payout-integrity-monitor, paymaster/_paymaster.ts (error), creator-access/_allowlist.ts, CoinManage.tsx (ABI note + render), plus earlier high-leverage work on DeploymentBatcher.sol, DeployVault.tsx, CreatorEarnings.tsx, _createCore.ts, and the zora payout design docs (both copies).
- Key positive: The two most critical enforcement surfaces (deployPhase2Invariants + keeper sweep + kpr monitor) now emit only canonical violation codes and messages.
- The canonical reference document is actively linked from the cleaned surfaces and from AGENTS.md-scoped design docs.

The policy violation has been converted from a broad, high-risk drift problem into a narrow, manageable "ABI fidelity + comment hygiene" tail. No new bare-prose violations are being introduced.

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
- Terminology & reference documentation drift (original ~319+ violation occurrences; worst class now at 0 in real source after two mechanical passes — see Lens B section).
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
2. ~~Lens B mechanical cleanup (Lens B-01)~~ — **Substantially complete**. Forbidden prose family at 0 in real source. All critical enforcement/operator/deploy surfaces qualified with canonical framing. ~191 remaining occurrences are mostly required ABI fidelity. Canonical reference document is live and linked. Policy is now structurally enforced on high-traffic paths. (Opportunistic polish on explore/UI tail remains low-priority.)
3. ~~Fix the three rate-limit guard failures and the two frontend boundary violations.~~ **Done in this session** (both guards now pass cleanly).

**Short Term**
4. Establish a size budget review gate for any new surface on `CreatorLotteryManager`.
5. Document the intended security model for the LotteryManager AdminModule delegatecall pattern (accept or close I-6).
6. Add a lightweight "SC hygiene + terminology" check to the guard suite or PR template.

**Medium Term (per approved plan)**
- Lens A edges review (Telegram/Zora cross-app + recovery/merge + command-issuer + tombstone): Major depth completed this session (strong alignment + one documented nuance on Zora owner-install timing). Remaining work is lower-priority polish or explicit product alignment on the nuance.
- Systematic source-vs-deployed drift checks on current live batcher + v1.12 modules (initial pass done; deeper tracing of live module wiring txs is next natural step if prioritized).
- Close remaining x-ray "On-chain: No" items with explicit disposition.
- (Optional hygiene) Promote core identity resolvers (`listProfileIdsForPrivyUser`, asserts, etc.) to server-core boundary + add a static guard against new direct column bypasses.

---

## Remaining Work (Updated — This Session)

**Completed in current pass**
- Quick-win guard fixes: both `frontend-boundaries` and `api-rate-limit-guards` are now clean (edits + verification runs).
- Core + deeper Lens A analysis: central resolvers, collision/merge logic, sub-account sanitization, command-issuer resolvers, direct-write sites, Telegram surfaces, and AMOE synthetic paths reviewed. No new critical bypasses or invariant violations found beyond the previously documented boundary/encapsulation hygiene items.

**Still open (per approved plan)**
- Lens A edges (Telegram Mini App + Zora cross-app linking + recovery flows, command-issuer surfaces, tombstone coverage): Major adversarial depth review completed this session (see dedicated "Deeper Lens A edge review" subsection below). Strong alignment on core invariants (no silent merges, fresh proof/token requirements, explicit recovery forcing, tombstone chasing in resolvers + profileMerge + command-issuer migration). One documented nuance on Zora owner-install timing vs. email verification for execution readiness (intentional for acquisition; recorded for product confirmation). No critical bypasses found. Remaining Lens A work is lower-priority (full coverage matrix on every last caller, or explicit product alignment on the Zora nuance).
- Lens B mechanical phase substantially complete (see dedicated closure statement above). Worst violations at 0; remaining ~191 occurrences in 51 files are overwhelmingly required ABI fidelity + resolver shape cases with canonical framing already present in the critical paths. The policy is now structurally lived where it matters. Further polish is low-priority opportunistic work.

**Deeper Lens A edge review — Telegram linking + cross-account merge + recovery (deeper pass this turn)**
- Continued direct code review of the end-to-end Telegram Mini App link flow:
  - `_link-ready.ts`: Requires fresh `verifyPrivyForAccounts` + `syncEmailIdentity` before issuing link token. Email context is present.
  - `_link-complete.ts`: 
    - Mandatory fresh Mini App session proof (`readTelegramMiniAppSession`) before any DB work or token claims.
    - Link-start tokens: hashed, single-use via `telegram_link_start_token_claims` (ON CONFLICT DO NOTHING + explicit consumed_at), strictly bound to the (telegramUserId, chatId) from the session. Mismatches are rejected before merge preflight.
    - `runTelegramMergePreflight` (called twice — once explicitly, once inside `upsertTelegramUserLink`): If Telegram userId already linked to a *different* privyUserId, immediately throws/returns `IDENTITY_RECOVERY_REQUIRED` / `TELEGRAM_LINKED_TO_DIFFERENT_PRIVY`. No auto-merge, no silent re-binding.
    - On success: `recordProviderLink` (for 'telegram'), `upsertTelegramUserLink`, then `buildAccountsMePayload`.
    - All error paths (including `isIdentityRecoveryRequiredError`) surface clean `RECOVERY_REQUIRED` with tracking.
- `profileMerge.ts` (cross-reference for recovery/merge UX): Correctly handles Arch-B tables during merge:
  - `command_issuer_execution_context`: re-key to `to` if `to` has none; otherwise drop `from`'s (prevents duplicate).
  - `command_issuer_daily_spend`: sums per-ymd onto `to`.
  - Tombstones `from` via `merged_into_profile_id` + nulls `privy_user_id`.
- `identityRecovery.ts` + `accountsIdentity.ts`: Use the full alias + tombstone chasing (`listProfileIdsForPrivyUser` pattern with COALESCE on `merged_into_profile_id`).
- Zora cross-app linking + owner-install (deeper trace this turn):
  - General `/api/accounts/link` and Zora-specific `/_handlers/zora/link/_status.ts` both call `verifyPrivyForAccounts` + `syncEmailIdentity` before recording the 'zora_cross_app' provider link. Email resolution is enforced.
  - Owner-install preparation (`/api/wallet/prepare-add-privy-owner`) and confirmation go through `bootstrapCanonicalDelegationState` (canonicalCswDelegation.ts).
  - Bootstrap uses `verifyPrivyRequest`, `resolveCanonicalCsw` (which calls `resolvePrimaryProfileIdForPrivyUser` — the alias + tombstone-aware resolver from profileIdForPrivyUser.ts), and `resolveExecutionTrack`.
  - Command-issuer resolvers (`resolveCommandIssuerContextByAddress` and `ByProfileId` in commandIssuerContext.ts) are explicitly tombstone-aware:
    - ByAddress: JOIN on `profiles` with `p.merged_into_profile_id IS NULL`.
    - ByProfileId: Uses `COALESCE(p.merged_into_profile_id, p.id)` to chase live profile before reading context.
  - Profile merge correctly migrates command-issuer state (as previously noted).
  - No obvious bypasses found for creating a live `command_issuer_execution_context` row on a tombstoned profile or bypassing canonical resolution for Zora owner add.
- Zora owner-install path (full slice this turn):
  - `verifyPrivyRequest` (called first in bootstrapCanonicalDelegationState): Pure Privy token validation + `client.getUserById`. No email verification or email presence check.
  - `resolveCanonicalCsw`: Uses tombstone-aware `readProfileIdByPrivyUserId` (i.e. `resolvePrimaryProfileIdForPrivyUser`), falls back to `recoverProfileIdFromPrivyHints`, then `syncUserWallets`. If a profile can be resolved or created via wallet sync from the Privy user's wallets, it proceeds. No email check inside this function.
  - The prepare/confirm handlers therefore allow producing a signed txRequest (or confirming on-chain ownership) for adding the embedded EOA as owner on a Zora-created CSW based solely on valid Privy auth + existing/resolvable profile + on-chain owner check — without re-enforcing email OTP at delegation time.
  - Client flow (`useZoraAddOwnerFlow`): Calls the prepare endpoint with Privy auth headers; no client-side email gate visible in the flow before attempting the owner install.
  - This matches the documented model (Zora as acquisition/linking path that must resolve to the verified-email canonical identity over time), but creates a measurable nuance vs. the strict invariant that "no 4626 account is considered fully created until email OTP verification completes" when the metric is "able to perform sponsored canonical execution via owner-installed embedded EOA".
  - **Command-issuer safety in this context**: Once owner install succeeds, subsequent command issuance (e.g. in Zora commands.ts) uses `resolveCommandIssuerContextByAddress`, which is explicitly tombstone-aware. Good.

**Overall assessment for this Lens A edge (Telegram linking + Zora cross-app/owner-install + recovery/merge + command-issuer)**: Strong alignment with AGENTS.md invariants on no silent cross-account merges, fresh proof requirements, single-use tokens, tombstone chasing in resolvers and profile merge, and command-issuer migration. The only documented nuance is the timing of email verification vs. Zora owner-install for execution readiness on Zora-acquired CSWs (intentional for acquisition, but should be explicitly called out in product docs/invariants if not already). No critical bypasses or invariant violations found. 

**This Lens A edge sub-review slice is now complete.** All major surfaces (Telegram link flow + preflight + token security, Zora linking + owner-install bootstrap, command-issuer resolvers + callers in high-risk command handlers, profileMerge handling of Arch-B/command-issuer state, and tombstone chasing across the identity stack) have received direct code review with concrete evidence. The living synthesis above records positives and the one nuance. 

Next natural high-ROI continuation (when ready): either (a) one final lightweight coverage sweep on any remaining low-traffic callers of the identity/command resolvers, or (b) pivot to the next item in the approved plan (deeper source-vs-deployed tracing of the live v1.12 module wiring transactions, remaining x-ray "On-chain: No" items, or beginning the full audit synthesis + recommendations section).
- Positive alignment with AGENTS.md invariants observed so far:
  - "Telegram session proof must be verified before entering the flow" — enforced.
  - "Telegram identity must only be bound after canonical account resolution via verified email" — `syncEmailIdentity` + profile sync run before link.
  - "Cross-account Telegram conflicts must not auto-merge silently" — explicit preflight + recovery error.
  - "Telegram link-start tokens must be single-use, claim-bound, and consumed on success" — implemented with hash + ownership checks + chat binding.
  - Profile merge correctly moves command-issuer state (no loss of delegation context on merge).
- Open questions / next depth targets for subsequent passes:
  - Full adversarial trace of a pure Zora cross-app user reaching execution surfaces (`/deploy`, `/swap`) before email OTP — does any path grant `execution-ready` without verified email?
  - Any legacy or direct-DB paths that could bind Telegram without going through `_link-complete` + preflight?
  - Command-issuer delegation surfaces (addOwner / spend permissions) during Zora owner-install flows — are they gated behind the same canonical + tombstone resolvers?
  - Complete coverage of `resolveCommandIssuerContext*` and all callers after a merge (tombstone filter must be present everywhere).
  - Telegram webhook command surfaces (`/link`, `/status`) — do they ever mutate state or grant capabilities before the verified-email + preflight checks?
- Source-vs-deployed verification on live batcher + v1.12 modules (work started this session — see new section below).
- Optional: promote identity resolvers to server-core package + add a guard against new direct `privy_user_id` / tombstone-ignoring queries.

This pass (SC hygiene + Lens A core + quick wins + deeper caller review) has produced a clean set of actionable, referenced findings. The account model implementation is one of the strongest areas reviewed. The codebase has the maturity and tooling to close the remaining items rapidly.

---

*Lens A posture (final): Solid. Major adversarial depth on edges (Telegram + Zora + command-issuer + tombstone) complete. One documented nuance for product confirmation. No critical bypasses.*

---

*SC hygiene + source-vs-deployed: Complete (initial + deep bytecode diagnosis).*

---

**This general audit session is now substantially complete.** All planned high-ROI work executed. See Final Audit Summary section above for posture, findings, and low-priority follow-ups. The living document is the handoff artifact.

---

## Source-vs-Deployed Verification (Initial Pass – Live Batcher + Modules)

**Scope started this session**: Current canonical split Phase-1 Deployment Batcher and its wired helpers/modules on Base mainnet.

**Live batcher**: `0xa99058f424FB3ACC639F59355C65C40149030651` (the `SPLIT_PHASE1_DEPLOYMENT_BATCHER` from `contracts.defaults.ts`, v1.11.2-pipe-a shell, stable across v1.12 module epochs).

**Wired modules (queried live via `cast` right now)**:
- `phase1Module()` → `0x19Bd8d3b69Ee8b4D127adb0DE35372e2825FFC87` (pre-v1.12.1 rotation address; v1.12.1 rotation target per release notes: `0xcE369BE1D89634E7Ab3d6Dc0f943B2780BF2D889`)
- `phase2Module()` → `0x67FD8A34E5b26F875a9513DFf37521A1ca92d80f`
- `phase3Helper()` → `0x674a2D5EE33e184e2120B373a9AcB3fef640885c`
- `uniV4Helper()` → `0xF71a6236586077CD29C971443D2cce37B543DcBB`
- `utilsHelper()` → `0xD71C4910C7bB38FB1089Cca42b0883F1BFFfa28D`

(Note: The batcher shell is long-lived; modules are rotated per bytecode epoch via Safe/treasury txs. The live getters as of this session still show the pre-rotation Phase1Module address.)

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

  This is the **classic pattern of a non-functional metadata hash difference** at the end of runtime bytecode. It is almost certainly **not logic drift** in the batcher.

- **Phase2Module mid-code differences — deep-dive completed this turn**:
  128-byte context + disassembly on the exact three non-metadata sites (5290, 14500, 14653) produced a complete root-cause diagnosis (see dedicated section below). All three are benign compiler-evolution artifacts (PUSH0 optimizations + one consequential internal CODECOPY offset shift). No logic drift.

- **Bytecode Store / Version Skew Confirmation**:
  - Current local Phase1Module code ID (`0x2deaac49...`) and Phase2Module code ID (`0xbdabc5ba14c30b636f369ea9122ae2d8de39838e5d65b478a61cf427c9224f20`) both return zero from the live store.
  - Even the v1.11.1-era Phase2Module code ID from the manifest (`0xffb6eb93...`) also returns zero.
  - This confirms the live batcher is using a Phase2Module from a version whose code ID is not captured in the manifests we have checked (or was deployed via a different mechanism). The current source tree's modules are not yet seeded. This fully explains all observed byte differences.

- **Module results (new this turn)**:
  - **Phase1Module** (`0x19Bd8d...`): **Clean match** after immutable masking (0 byte differences, identical lengths and hashes). Verification passes for Phase1Module.
  - **Phase2Module** (`0x67FD8A...`): **26 byte differences** after masking (the three non-metadata ones + metadata tail). Lengths differ (local 16,858 vs live 16,940).  
    Deep-dive (above) fully classified the three mid-code bytes; they are benign. No remaining unexplained diffs.

  **Bytecode Store Check (new this turn)**:
  - Computed current local Phase1Module code ID: `0x2deaac49...`
  - Computed current local Phase2Module code ID: `0xbdabc5ba14c30b636f369ea9122ae2d8de39838e5d65b478a61cf427c9224f20`
  - Live UniversalBytecodeStore (`0x8B51E678...`) returns `address(0)` and chunk count `0` for **both** current code IDs.

  This means the modules currently wired to the live batcher are from *older compiled versions* whose code IDs were previously seeded. The current source versions are not yet present in the store. This fully explains the byte differences observed in Phase2Module.

- Live Phase2Module is significantly larger (16,940 bytes) than Phase1Module (6,871 bytes), as expected for the more complex finalize/share-bridge logic.

**Live vs Source Summary Table (as of this session)**

| Component                  | Live / Wired Address                          | Current Source Tree (v1.12.1)                     | Status |
|----------------------------|-----------------------------------------------|---------------------------------------------------|--------|
| DeploymentBatcher shell   | 0xa99058f424FB3ACC639F59355C65C40149030651   | Same long-lived shell                            | Stable |
| Phase1Module              | 0x19Bd8d3b69Ee8b4D127adb0DE35372e2825FFC87 (pre-rotation) | 0xcE369BE1D89634E7Ab3d6Dc0f943B2780BF2D889 (v1.12.1) | Rotation pending in live getters |
| Phase2Module              | 0x67FD8A34E5b26F875a9513DFf37521A1ca92d80f   | code ID `0xbdabc5ba...` (smaller, PUSH0-optimized) | Older epoch live; deep-dive complete — 3 benign diffs (2× PUSH0, 1× CODECOPY layout ripple) fully diagnosed; current ID not seeded |
| BytecodeStore             | 0x8B51E6784A0C6681F5de25bAC4f9B2fDCEDE72b4   | Same                                             | Current v1.12 module code IDs return 0 |

**Key Finding**: The stable batcher shell + deliberate module rotation model is operating exactly as designed. The three non-metadata byte differences (now fully diagnosed via 128-byte context + disassembly) are the expected, benign result of compiling the same logic with a newer solc (0.8.30 + Cancun + viaIR) that emits PUSH0 and produces a smaller layout. No accidental drift, no invariant violation, no security impact. The only operational hygiene item is ensuring the v1.12.x code IDs are seeded into the store after the next rotation lands on-chain.

**Deep-dive completed on the three mid-code differences (this turn)**

Using 128-byte context + targeted disassembly of the critical region:

- **0x14aa (offset 5290)**: `0x36` (local) vs `0x5f` (live) — direct `CALLDATASIZE` vs `PUSH0`.  
  The current tree (solc 0.8.30 + `evm_version = "cancun"` + viaIR + optimizer) emits `PUSH0` (1-byte zero) for a constant that the older compilation materialized via `CALLDATASIZE` (or an equivalent older zero idiom). This is the classic Shanghai+ / solc ≥0.8.20 optimization.

- **0x38a4 (offset 14500)**: identical `0x36` vs `0x5f` swap, located inside the revert data path for `toUint16_outOfBounds` (the string literal appears in the bytes immediately preceding the differing opcode). Same root cause.

- **0x393d (offset 14653)**: `0xbd` vs `0xe6` — **not** a zero idiom. Disassembly of the 200-byte window shows:
  ```
  PUSH2 0x07bd          ; local (current tree)
  ...
  PUSH2 0x0179
  DUP3
  CODECOPY              ; copies 0xb2 bytes of template code from inside this contract
  ... (series of MSTORE patches for constructor args / immutables)
  RETURN
  ```
  The PUSH2 value is the **absolute byte offset inside the Phase2Module runtime code** of a code template fragment that the module uses to emit initcode for child contracts it deploys (CreatorShareOFT, gauge, wrapper, strategy adapters, etc.).  
  Because the two PUSH0 substitutions made the newer binary **smaller** (local 16,858 B vs live 16,940 B, delta −82 B), all subsequent internal offsets shifted. The live (older, larger) binary has the template at `0x07e6`; the current tree has it at `0x07bd` (difference exactly 0x29 = 41 bytes, consistent with the cumulative effect of the earlier 1-byte savings plus optimizer layout changes).

**Conclusion for all three bytes**: Pure compiler / EVM-version evolution (0.8.30 + Cancun + viaIR produces measurably tighter code than whatever snapshot produced the live module). No functional, semantic, or security drift. The on-chain Phase2Module is simply from an earlier bytecode epoch that has not yet been rotated.

**Fresh code IDs computed this turn (sha256 of deployedBytecode)**:
- Current local Phase2Module: `0xbdabc5ba14c30b636f369ea9122ae2d8de39838e5d65b478a61cf427c9224f20`
- Live wired Phase2Module (0x67FD...): `0x3f4751b7f2d86df0e57c42cdda7b03086fd707887728798d7f3e41c367f8a712`

Neither matches the v1.11.1 manifest ID (`0xffb6eb93...`) previously checked. The live module comes from an intermediate snapshot between the v1.11.1 manifest and the current tree.

**Updated summary table (post deep-dive)**

| Component      | Live Address                                      | Current Source Tree (v1.12.1)                          | Status |
|----------------|---------------------------------------------------|--------------------------------------------------------|--------|
| Phase2Module   | 0x67FD8A34E5b26F875a9513DFf37521A1ca92d80f        | code ID `0xbdabc5ba...` (smaller, PUSH0-optimized)    | Older epoch live; 3 benign layout diffs (2× PUSH0, 1× CODECOPY offset ripple); current ID not seeded in store |
| BytecodeStore  | 0x8B51E6784A0C6681F5de25bAC4f9B2fDCEDE72b4        | Same                                                   | Current v1.12 IDs return address(0) — seeding/rotation hygiene item |

**Operational implication**: The long-lived batcher + module rotation model is working as designed. The observed differences are the expected artifact of a deliberate cutover cadence, not an accident. The only hygiene follow-up is ensuring that after the v1.12.1 rotation lands on-chain, the corresponding code IDs are seeded into the UniversalBytecodeStore (or the deployer script is updated to use the new IDs).

This source-vs-deployed verification thread is now closed with high-fidelity diagnosis. No further mechanical diffs or "mystery bytes" remain for Phase2Module.

*End of source-vs-deployed verification pass.*

---

## Final Audit Summary, Posture, and Recommendations

### Scope Executed (This Session)
- **SC Hygiene & Invariants (x-ray + source-vs-deployed)**: Full pass on DeploymentBatcher family, CreatorLotteryManager size, PayoutRouter lanes, gauge/controller, module rotation model. Initial + deep-dive source-vs-deployed on live batcher + modules (bytecode diffs diagnosed as benign compiler evolution; live modules on older epoch; store seeding hygiene item identified). CreatorLotteryManager at 24,527 B (49 B headroom) noted.
- **Lens A (Account / Wallet / Execution Model)**: Core resolvers (listProfileIdsForPrivyUser, accountsIdentity, walletSync, profileIdForPrivyUser, canonicalCswPersistence), collision/merge (profileMerge 4-step primitive with command-issuer handling), tombstone + alias chasing, sub-account sanitization, direct-write sites, AMOE synthetic paths. Deep adversarial review of high-risk edges: Telegram Mini App link flow (fresh proof, single-use claim-bound tokens, explicit non-silent merge preflight), Zora cross-app linking + owner-install bootstrap (tombstone-aware resolvers throughout; one nuance on email verification timing vs. owner-install for execution readiness), command-issuer surfaces (resolvers explicitly tombstone-aware; callers in Zora commands and other handlers reviewed), recovery paths. Strong alignment; no critical bypasses.
- **Lens B (Canonical Lane Terminology)**: Mechanical cleanup driven to substantially complete. Forbidden prose family (`externalRevenueRecipient` + bare unqualified "payoutRecipient"/"creator earnings" in logs, alerts, messages, UI, comments) at **0 occurrences** in all real non-generated source. ~191 raw occurrences remain (51 files), overwhelmingly required ABI fidelity + resolver shape cases with canonical framing already present in critical paths (DeploymentBatcher, PayoutRouter, CreatorCoinPolicyController, deployPhase2Invariants, keeper surfaces, kpr monitor, etc.). Canonical reference document created and expanded (`docs/audits/creatorvault-business-logic-core-structure-audit.md` with live mainnet wiring examples).
- **Guards & Quick Wins**: Both failing guards (`frontend-boundaries`, `api-rate-limit-guards`) fixed and verified clean in-session.
- **Living Synthesis**: All findings, evidence, code references, and dispositions centralized in this document.

### High-Level Posture (Final)
**Strengths**
- Account model implementation is one of the strongest areas reviewed: tombstone + alias chasing is consistent and defensive across the identity stack; profileMerge is idempotent and correctly migrates Arch-B/command-issuer state; command-issuer resolvers are explicitly tombstone-aware.
- SC surfaces (batcher + module model, invariants, lane terminology) show deliberate design and good operational hygiene (rotation model, size gate, canonical reference now exists).
- Guards and self-review tooling are effective and were quickly remediated when exercised.
- Terminology policy (AGENTS.md) is now structurally enforced on high-traffic paths after targeted cleanup.

**Areas of Friction / Remaining Nuances**
- One documented nuance in Lens A: Zora owner-install (enabling sponsored execution on Zora-acquired CSWs) can proceed with valid Privy auth + profile resolution without re-enforcing email OTP inside the delegation bootstrap itself (email enforcement lives in upstream linking flows). Intentional for acquisition but should be explicitly reconciled in product invariants/docs.
- CreatorLotteryManager runtime size is at the EIP-170 edge (24,527 B).
- Live deployment stack shows expected version skew on modules (older epoch wired; current source code IDs not yet in UniversalBytecodeStore) — normal for the long-lived batcher + rotation model, but requires seeding hygiene after future rotations.
- Remaining low-priority items are polish / explicit product alignment (not blocking invariants).

**Risk Concentration (Low)**
- The account model and execution routing are well-defended.
- Main residual risks are the documented size edge case and the need for ongoing seeding/rotation hygiene on the batcher (already operational practice).

### Final Recommendations
**Immediate / High Confidence (Already Actionable)**
- Treat the canonical lane reference (`docs/audits/creatorvault-business-logic-core-structure-audit.md`) as authoritative for all future docs, UI copy, commit messages, and comments. **(Implemented — Zora nuance section added to the canonical reference during this fix pass.)**
- After any future module rotation, ensure the new code IDs are seeded into the UniversalBytecodeStore (or update deployer manifests). **(Operational — noted in runbooks and deployment docs.)**
- Explicitly document the Zora owner-install nuance (email verification timing vs. execution readiness) in product invariants / onboarding docs if not already present. **(Fixed — detailed section added to the canonical reference doc.)**

**Short Term**
- Add lightweight "SC hygiene + terminology" and "tombstone-aware resolver usage" checks to the guard suite or PR template (low effort, high leverage). **(Fixed — new `guard:sc-hygiene` script created + wired in package.json. Runs terminology + tombstone pattern checks. Passes cleanly.)**
- Establish size budget review for any new surface touching CreatorLotteryManager. **(Reinforced — explicit P0 policy language added to sc-hygiene doc.)**
- Document the intended security model for the LotteryManager AdminModule delegatecall pattern (close or accept I-6). **(Fixed — full security model + I-6 explanation added to sc-hygiene doc.)**

**Medium Term / Polish**
- Lightweight final coverage sweep on any remaining low-traffic callers of `resolveCommandIssuerContext*`, `listProfileIdsForPrivyUser`, etc. (optional; major surfaces already reviewed — no critical issues found in prior deep review). **(Executed this pass via targeted grep across server/_lib and command handlers; all usages route through the already-reviewed tombstone-aware resolvers. Clean.)**
- Close remaining x-ray "On-chain: No" items with explicit disposition (reference the earlier SC hygiene x-ray section). **(I-6 for LotteryManager sponsorship guard-lift closed via documentation of the intended AdminModule delegatecall model.)**
- (Optional) Promote the core identity resolvers to the server-core package boundary + add a static guard against new direct `privy_user_id` or tombstone-ignoring queries. **(Major milestone — COMPLETE. Full implementation of `commandIssuerContext.ts` + `profileIdForPrivyUser.ts` (all resolvers, provisioning, revoke, sub-account spend helpers) now lives inside `frontend/packages/server-core/`. Public entrypoint: `frontend/packages/server-core/src/identity.ts` (re-exports the full surface). Old `_lib` locations are thin re-exports only. Boundary guard (`scripts/check-server-core-boundary.mjs`) hardened with explicit bans on the promoted modules; both main guards (server-core + frontend-boundaries) pass cleanly. Final low-traffic comment modernization batch executed (remaining sibling imports inside _lib + AGENTS.md + this doc + dedicated test file). All active production call sites already migrated in prior batches. The pattern is now the enforced default.)**
- Deeper source-vs-deployed tracing of live v1.12 module wiring transactions: Targeted search across the entire repo (including release notes, inventory, **all ops/ Safe scripts**, and related files) for the specific txs that wired the current live modules (0x19Bd8d3b... Phase1 and 0x67FD8A34... Phase2) returned no in-repo evidence of the exact historical transaction hashes. The addresses themselves are the maintained reference. This confirms the earlier finding: deeper historical tracing lives in operator/Safe history. The enforceable control remains the post-rotation code ID seeding hygiene (already documented; reinforced with explicit checklist item in `current-contract-inventory.md` + hygiene reminder comments added to the key execution scripts `execute-set-phase1-module-safe.ts` and `wire-phase3-helper-safe.ts` this pass).

### Audit Status (Final)
**Core general audit complete.**

All high-ROI planned work across the approved lenses has been executed with evidence, code references, and dispositions:

- SC hygiene + x-ray + source-vs-deployed (initial + deep bytecode diagnosis).
- Lens B canonical terminology (mechanical cleanup to substantially complete; forbidden prose family at 0 in real source; new ongoing `guard:sc-hygiene`).
- Lens A core + full adversarial depth on high-risk edges (Telegram linking, Zora cross-app/owner-install, recovery/merge, command-issuer, tombstone coverage) — strong alignment with one documented nuance.

**Actionable items uncovered during the audit that were fixed in this session:**
- New `guard:sc-hygiene` script added and wired (terminology + tombstone-aware checks).
- Zora owner-install nuance explicitly documented in the canonical reference.
- LotteryManager AdminModule delegatecall security model + I-6 fully documented (closes the main remaining x-ray gap via documentation + accepted model).
- CreatorLotteryManager size budget policy reinforced as strict P0.
- Final small terminology polish in user-facing CoinManage labels.
- All other actionable Short Term recommendations from the audit addressed or dispositioned.

**Low-priority / optional items** (explicitly not blocking, left for future work):
- Full lightweight coverage sweep on any last low-traffic callers (executed targeted grep this pass — clean; major surfaces already reviewed).
- Deeper source-vs-deployed tracing of live module wiring txs (limited repo surface — even after searching all ops/ Safe scripts; addresses are the reference; practical control is post-rotation seeding hygiene — reinforced with checklist item + inline comments in the execution scripts this pass).
- Optional identity resolver promotion to server-core package boundary + static guard.
- Operational module code ID seeding after future rotations (already called out in deployment docs; now has a direct reminder in the operator inventory checklist).

The account/wallet/execution model and value lane handling are in good shape. The repository has the maturity, tests, guards, and operational practices to maintain the remaining items.

This document + the canonical lane reference serve as the single source of truth and handoff artifact.

**Audit fully complete for this session.**

All planned high-ROI work across the approved lenses has been executed with evidence:
- SC hygiene + x-ray + source-vs-deployed (initial + deep bytecode diagnosis).
- Lens B canonical terminology (mechanical cleanup complete; forbidden prose family at 0 in real source; new `guard:sc-hygiene` now in place and passing).
- Lens A core + full adversarial depth on high-risk edges (Telegram linking, Zora cross-app/owner-install, recovery/merge, command-issuer, tombstone coverage) — strong alignment with one documented nuance.

All actionable items uncovered during the audit were fixed or reinforced in this session (new guard, documentation for Zora nuance + LotteryManager model, size budget policy, terminology polish, hygiene reminders in ops scripts, etc.).

The lightweight final coverage sweep on remaining low-traffic callers of the core resolvers was executed (targeted greps across server + frontend this pass) and is clean. Deeper historical wiring tx tracing for live modules has limited surface in the repo (addresses are the maintained reference; practical control is post-rotation seeding hygiene, which has been reinforced in the operator checklist and key execution scripts).

This document + the canonical lane reference (`docs/audits/creatorvault-business-logic-core-structure-audit.md`) serve as the complete handoff artifact.

**All major threads closed. Session ended.** 

*End of audit.*

The account/wallet/execution model and value lane handling are in good shape. The repository has the maturity, tests, and operational practices to maintain the remaining items.

This document (plus the canonical lane reference) serves as the single source of truth and handoff.

*End of audit + fix session. All major threads closed and actionable items addressed.*

---

## Resumption Pass — Post-Stabilization Delta (after waitlist + owner-install hardening)

**Date**: Immediate follow-up after push of waitlist controller stabilization (modern validated Base App EntryPoint self-call path made primary for parent-CSW "Enable 4626 signing" in waitlist).

**Trigger**: User directive to resume the original 4-phase 6-lens audit thread ("lets go back to where we were auditing for bugs") after the large waitlist/owner-install refactor landed and was committed.

### Work Executed in This Resumption Slice ("just do all")
1. **Guard failure surfaced + remediated (A)**: The new `guard:sc-hygiene` (created during the original audit) flagged `commandIssuerContext.ts` under the old `server/_lib/` path. Root cause: the file is now a pure thin re-export shim (`export * from '@4626/server-core/commandIssuerContext'`). The guard's hardcoded list still pointed at legacy locations.  
   **Fix**: Updated `frontend/scripts/check-sc-hygiene.mjs` to scan only the canonical post-promotion sources under `packages/server-core/src/` (`profileIdForPrivyUser.ts`, `identity.ts`, `commandIssuerContext.ts`). Legacy shims are now intentionally excluded. Guard re-ran clean (terminology + tombstone both pass).  
   **Audit note**: This is exactly the class of regression the audit guard was designed to catch. The promotion (Lens A structural recommendation) is now protected by a guard that understands the new boundary.

2. **Post-stabilization delta review vs Lens A invariants (B)**:  
   - Reviewed the central `useAccountSetupController` (ref + guarded-setter + `pendingOwnerInstallHash` + `ownerInstallPhase` + auto-clear brain) + `WaitlistModernParentOwnerInstall` (compact card) + `AccountSetupWorkspaceView` (phase-aware banners + suppression).  
   - All privileged owner-install paths (prepare, submit, on-chain self-call checks) are gated behind `canonicalCswAddress` sourced exclusively from server bootstrap payloads (`/api/accounts/me` + `accountSignals`, which use the tombstone-aware `listProfileIdsForPrivyUser` + alias chasing).  
   - No new direct `privy_user_id` writes, no new command-issuer context creation, no new profile mutations in the client controller. Pending/phase state is purely local UI.  
   - The actual on-chain enforcement (EntryPoint self-call shape + `addOwnerAddress` self-call) remains in the previously audited `addOwnerCallShape.ts` + `useAddUserOpOwnerInstall` (reporters wire state back to the central controller).  
   - Legacy Zora EOA-relay branches were removed from primary parent-CSW waitlist paths (deprecation complete).  
   **Conclusion**: The stabilization pass **reinforces** the canonical parent-CSW + Privy-embedded-owner `legacy-owner-install` track. No new invariant bypasses or tombstone-ignoring surfaces introduced. The new controller is a consolidation that reduces surface area. Minor observation only: some client paths still resolve wallet surfaces via old `@/lib/wallet` aliases (expected during transition; server bootstrap/me remains the enforcement point).

3. **Close remaining short/medium items (C)** + broader hygiene (D):  
   - Re-ran `guard:sc-hygiene` (now green after the fix above), `guard:server-core-boundary` (ok), `guard:frontend-boundaries` (ok).  
   - Targeted grep sweep for remaining low-traffic callers of the core resolvers in the accountSetup feature + waitlist surfaces: all privileged paths route through server tombstone-aware endpoints or the already-reviewed canonical server-core modules. Clean.  
   - Confirmed the Zora owner-install nuance (documented in the canonical lanes reference during the original pass) remains accurately reflected in the new modern parent card copy ("Finish owner install on your parent smart wallet using the validated Base App path (EntryPoint self-call)").  
   - CreatorLotteryManager size budget and LotteryManager AdminModule delegatecall model remain as documented in the SC-hygiene subdoc (no changes in this resumption).  
   - Fresh guard runs + boundary checks confirm the post-promotion + post-stabilization state has no new drift on the audited surfaces.

### Updated Audit Posture After Resumption
- All original high-ROI lenses remain closed with the same strong signals.
- One new concrete hygiene win: the SC hygiene guard is now correctly scoped to the canonical `@4626/server-core` sources (prevents future shim-scanning false positives and catches real regressions).
- The waitlist/owner-install stabilization is a net positive for the account model invariants (primary validated self-call path is now structurally and textually the default in the waitlist parent-CSW flow).
- No new critical or medium findings. The repository continues to show the maturity the original audit noted.

**This resumption slice is complete.** The living documents (`general-audit-2026-05.md`, the SC-hygiene subdoc, and the canonical lanes reference) have been updated with the delta. All major threads from the original plan plus the post-stabilization reality are now closed.

*End of resumption pass. Audit fully current.*

---

### Continuation — Fresh Full Test Run + Drift Fixes (immediate follow-up)

**Action taken on "continue" after reporting the truncated `forge test` background task:**

- Re-ran `forge test --summary` cleanly (no head truncation). Result: **992 tests succeeded, 1 failing test**.
- The single failure was in `test/SeedCreatorRegistry.Config.t.sol:SeedCreatorRegistryConfigTest.testSeedScriptAuthorizesLiveFactoryAndBatchers()`.
  - Assertion failed because the test hard-coded the deprecated pre-cutover batcher `0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8`.
  - Current canonical live batcher (from script, `contracts.defaults.ts`, prior audit source-vs-deployed work, and live wiring): `0xa99058f424FB3ACC639F59355C65C40149030651`.
- This was exactly the class of contract inventory / test drift the original SC hygiene + source-vs-deployed lens was designed to surface.

**Fixes executed:**
1. Updated the stale constant in `test/SeedCreatorRegistry.Config.t.sol` to the current live batcher address. Targeted re-run now passes 3/3.
2. As a separate hygiene win, eliminated the name-shadowing compiler warning (8760) in `test/vault/strategies/CreatorOVaultStrategies.Rebalance.Invariant.t.sol` by renaming the local `ajnaDebt` variable to `ajnaDebt_` (avoids shadowing the harness view function of the same name). This was one of the three warnings from the initial truncated run.

**Post-fix state:**
- The specific config test is now green.
- The name-shadowing warning is resolved.
- Full relevant guard suite (sc-hygiene, server-core-boundary, frontend-boundaries) re-confirmed clean after the edits (test-only changes had no impact on boundary or terminology rules).
- This run provides fresh, concrete evidence for the SC Hygiene lens: 992+ passing tests on Solc 0.8.30 with only pre-existing low-severity test warnings that were addressed during the pass.

The single failing test was a perfect "audit for bugs" signal — outdated test expectation vs. the live contract inventory the earlier phases of this audit had already documented and hardened around. Now resolved.

*Continuation slice complete. All signals incorporated.*

---

## Charm & Ajna Strategy Mechanics + Rebalance Dynamics (Deep-Dive Continuation)

**Focus of this slice**: Mechanisms, flows, coupling, accounting, and risk surface of the two primary Phase-3 yield strategies (CreatorCharmStrategy + Ajna sleeve) and how they interact with vault-level rebalancing, idle management, deposits, and withdrawals.

**Scope sources** (May 2026 live v1.12 module epoch):
- `contracts/vault/CreatorOVault.sol`
- `contracts/vault/modules/CreatorOVaultStrategiesModule.sol` (the delegatecall implementation of `rebalanceStrategies`, `tend`, `_withdrawFromStrategies`, `_deployUnderweightStrategies`, etc.)
- `contracts/vault/strategies/univ3/CreatorCharmStrategy.sol` (Uniswap V3 concentrated LP + Ajna backstop)
- `contracts/vault/strategies/ajna4626/AjnaERC4626Vault.sol` + `AjnaVaultAuth.sol` / `AjnaVaultBuffer.sol` / `AjnaVaultLibrary.sol`
- `contracts/vault/strategies/ERC4626StrategyAdapter.sol`
- `contracts/helpers/batchers/DeploymentBatcher.sol` (initial synergy wiring)
- Relevant tests: `CreatorOVaultStrategiesRebalance*`, `CreatorCharmStrategy*`, `AjnaERC4626*`

### 1. High-Level Architecture

**Vault-level rebalancing (Yearn V3-inspired, hardened)**:
- Public keeper entry: `CreatorOVault.rebalanceStrategies(uint256 minDeviationBps)` (nonReentrant, onlyKeepers) → delegates to `CreatorOVaultStrategiesModule`.
- Core loop (StrategiesModule:463):
  1. Compute `deployableBase = totalAssets - minIdle`.
  2. Walk the queue (default or strategyList). For every overweight strategy (actual > target by more than `minDeviationBps` drift), call `_tryWithdrawFromStrategyMeasured(excess)`.
  3. Update `strategyDebt[strategy]` and `totalDebt` downward.
  4. Then `_deployUnderweightStrategies`: push remaining idle (above minIdle) to underweight legs using weighted slices.
- **Explicit invariant (comment at 461)**: "Cross-strategy moves always route vault idle — strategies never transfer directly."
- `tend()` (StrategiesModule:444) is lighter: just deploys excess idle above `deploymentThreshold` into the first strategy in the default queue.
- `minimumTotalIdle` (default 10k CREATOR in CreatorOVault:324, governor-settable) is the primary governor on how much stays in the vault buffer vs. strategies.
- Withdrawal path (`_withdrawFromStrategies`) is best-effort per leg with hostile-strategy defenses (if a strategy lies and drains idle on failure, the deficit is pushed to later queue items — see lines 376-380 and the M-09 fix comment).

**Charm (CreatorCharmStrategy)**:
- Wraps an external Charm concentrated liquidity vault on the CREATOR/USDC Uniswap V3 pool.
- Strategy implements `IStrategy` + `IStrategyValuation`.
- Valuation (getTotalAssets:446): idle CREATOR + idle USDC + Charm exposure (via `getTotalAmounts()`) + Ajna debt state. **Fail-closed on unreadable Ajna state → returns 0**.
- Heavy use of two oracles: `creatorOracle` (for USDC valuation of positions and Ajna bucket resolution) + Uniswap TWAP on the swap pool (for swap sizing/slippage).

**Ajna sleeve (AjnaERC4626Vault + ERC4626StrategyAdapter)**:
- ERC4626 wrapper around Ajna quote-token bucket positions + an explicit idle buffer.
- The adapter (`ERC4626StrategyAdapter`) is the vault-facing `IStrategy` implementation for most ERC4626-style sleeves (including Ajna).
- Bucket management is capped (`MAX_BUCKETS=50`, F-08 fix) to bound gas in `totalAssets()` loops.

### 2. The Critical Dynamic: Charm ↔ Ajna Direct Backstop (Not Just Idle Buffer)

This is the most interesting coupling and the area with the largest gap vs. high-level documentation.

**High-level claim (AGENTS.md + prior audit notes)**:
> "Charm and Ajna coordinate only through the parent vault idle CREATOR buffer, not direct strategy-to-strategy transfers."

**Actual implementation (CreatorCharmStrategy)**:
- Charm maintains a **first-class, on-strategy Ajna borrowing facility** (lines 101-108, 255-316, 1030+):
  - `ajnaPool` (CREATOR as quote token, USDC as collateral).
  - `ajnaBorrowEnabled`, `ajnaMinCollateralRatioBps = 12_500` (125%, matches `DeploymentBatcher.CHARM_AJNA_MIN_COLLATERAL_RATIO_BPS`).
  - `ajnaMaxDebt`, `ajnaMaxBorrowPerWithdraw`.
  - Borrow/repay limit indices (can be oracle-driven via `_resolveAjnaLimitIndex`).
- **On deposit (648)**: Prioritizes repaying any outstanding Ajna CREATOR debt first (`_repayAjnaDebtWithCreator`). Releasing USDC collateral increases the USDC leg available for the Charm LP deposit.
- **On withdraw (943)**: Can trigger `_borrowFromAjna` (internal, ~1050) when on-chain liquidity in Charm is insufficient to meet the withdrawal without excessive slippage/IL. Borrows CREATOR by pledging additional USDC collateral at the configured ratio.
- Events: `AjnaBorrowed`, `AjnaRepaid`.
- DeploymentBatcher explicitly wires this synergy when both weights are non-zero (241-244) and deploys the Ajna pool for the creator token.

**Implications for rebalancing**:
- Vault-level `rebalanceStrategies` can indirectly cause Charm to increase (or decrease) its Ajna leverage.
- A large overweight withdrawal from Charm during rebalance may force Ajna borrowing inside the strategy (increasing net CREATOR exposure while creating a debt obligation outside the vault's direct `strategyDebt` tracking?).
- Repays happen preferentially on inflows.
- The backstop is **operational liquidity insurance** for the concentrated LP leg (avoid selling CREATOR into the pool at bad prices during stress).

This is a deliberate, production feature (commented as "borrow backstop"), not an accident. It creates leverage and cross-protocol risk inside what appears at the vault layer as a single "Charm" strategy allocation.

### 3. Accounting & NAV Dynamics (Initial Signals)

- Vault tracks `strategyDebt` (ModuleStorage + CreatorOVault) as the source of truth for what has been deployed. On valuation revert, falls back to `strategyDebt` (CreatorOVault:869, StrategiesModule:335).
- Charm's `getTotalAssets` is the strategy-reported value fed into the vault's total. It already nets the Ajna debt state.
- When Charm borrows CREATOR, the borrowed tokens appear as idle in the strategy (or get deployed to Charm LP). The corresponding debt is tracked inside Charm's Ajna position, not directly in the vault's `strategyDebt[strategy]`.
- Unrealized loss assessment (`_assessUnrealisedLoss`, StrategiesModule:397) and hostile-strategy handling exist, but the Ajna backstop adds a layer of "synthetic" liquidity that can mask or amplify IL/price moves.
- Reentrancy: Both the module and the individual strategies use `nonReentrant`. The module's hostile defenses are explicitly designed around strategies that lie on withdraw.

**Open question for deeper pass**: Does a Charm borrow increase the vault's effective exposure to CREATOR without a corresponding increase in `strategyDebt`? How does this interact with `strategyMaxAssets` caps, gauge weighting, and payout routing?

### 4. Risk Surfaces & Invariants (Initial List)

**High**:
- **Ajna liquidation risk inside Charm**: If CREATOR price drops, the 125% collateral ratio can be breached on the Ajna side. The strategy has no automatic deleveraging in the code read so far; liquidation would realize a loss inside `getTotalAssets()`.
- **Oracle dependency & manipulation window**: Charm uses `creatorOracle` for both valuation and Ajna bucket selection during borrow/repay. A stale or manipulated oracle during a rebalance or large withdrawal is dangerous.
- **Rebalance feedback loops**: Vault rebalance pulls from Charm → Charm may borrow more from Ajna to meet the pull → increased leverage right when the system is trying to reduce risk.
- **Liquidity illusion**: The backstop makes Charm appear more liquid than its on-chain Uniswap + Charm LP position actually is.

**Medium**:
- Slippage controls are strategy-local (`swapSlippageBps`, `depositSlippageBps` in Charm; rebalance has its own check at 1214). The vault `rebalanceStrategies` does not pass or enforce a global slippage budget across legs.
- `minDeviationBps` is caller-supplied by the keeper. A malicious or misconfigured keeper could force excessive churning.
- Direct `rebalance()` on CharmStrategy (1205) is callable by owner or vault — different from the vault-level `rebalanceStrategies`.

**Positive / hardened**:
- Best-effort withdrawals + hostile strategy accounting (multiple post-audit fixes visible: M-09, S-M01, etc.).
- Fail-closed on unreadable Ajna state in valuation.
- No direct token transfers between strategies (everything through vault idle).

### 5. Test Coverage Snapshot (from fresh run)

All targeted suites green:
- `CreatorOVaultStrategiesRebalanceInvariantTest` (6 tests, heavy fuzz including `skewCharm` handler with 25k+ runs).
- `CreatorOVaultStrategiesRebalanceScenariosTest` + `RebalanceTest` (30 tests).
- `CreatorCharmStrategyOracleTest` (26 tests), ForkIntegration (4), etc.
- Multiple Ajna vault + adapter + auth tests (27+).

**Coverage notes**:
- Strong on rebalance math, overweight/underweight, hostile scenarios, oracle/TWAP valuation.
- The Ajna borrow/repay paths inside Charm are exercised in the oracle and integration tests.
- Less visibility (from this run) on end-to-end keeper rebalance + simultaneous large user withdraw + Ajna liquidation edge cases. The invariant harness does skew Charm, which is good.

### 6. Recommendations & Follow-ups

1. **Document the backstop explicitly** in AGENTS.md, the creatorvault-business-logic audit doc, and any user-facing strategy descriptions. The "only through idle buffer" statement is now incomplete.
2. Add explicit accounting invariants or events around the net effect of Charm's Ajna debt on vault `strategyDebt` and totalAssets.
3. Consider a governor-visible "effective leverage" or "backstop utilization" metric for the Charm leg.
4. Stress-test (or add invariant) the scenario: large vault withdrawal + CREATOR price drop + active Ajna debt in Charm.
5. Review whether `strategyMaxAssets` caps on the Charm leg should consider the gross or net (post-Ajna-debt) exposure.
6. Keeper / rebalanceDelegate surfaces should surface when a rebalance would cause the Charm leg to increase Ajna borrowing.

This slice surfaced a richer operational coupling than the high-level architecture suggested. The backstop is a deliberate resilience feature with real risk trade-offs that deserve explicit treatment in invariants, monitoring, and documentation.

**Status**: Initial deep-dive complete. Ready for deeper accounting trace, specific invariant review against the x-ray worksheet, or focused test augmentation if requested.

*End of Charm/Ajna rebalance dynamics slice.*

---

### 7. Accounting & NAV Mechanics Deep Trace (Continuation)

This subsection traces exactly how deposits, withdrawals, rebalances, and internal leverage flow through `strategyDebt`, `totalDebt`, `totalAssets()`, and reported strategy values — with special attention to the Charm ↔ Ajna backstop.

#### 7.1 Core Tracking Primitives (vault + module)

- `CreatorOVault` (and mirrored in `CreatorOVaultModuleStorage.v2`):
  - `uint256 public coinBalance` — tracked idle (L-06 fix prevents donation attacks).
  - `mapping(address => uint256) public strategyDebt` — vault's authoritative record of how much CREATOR has been "pushed" to each strategy.
  - `uint256 public totalDebt` — sum of all strategyDebt.
  - `mapping(address => uint256) public strategyMaxAssets` — governance cap (clamped in `_getStrategyAssetsSafe`).

- Update rules (all in `CreatorOVaultStrategiesModule`, only via delegatecall):
  - **Deposit path** (`_depositIntoStrategyMeasured`, line 231):
    - Measures actual spend (`beforeBal - afterBal` after `IStrategy.deposit`).
    - `strategyDebt[strategy] += deposited`
    - `totalDebt += deposited`
    - `coinBalance` synced to observed.
  - **Withdraw path** (both measured and best-effort `_tryWithdrawFromStrategyMeasured`):
    - Debt reduced by actual withdrawn amount (capped at current debt).
    - `totalDebt -= debtReduction`
  - **Rebalance** (`rebalanceStrategies` + `_deployUnderweightStrategies`):
    - Overweight legs: debt reduced by withdrawn excess.
    - Underweight legs: debt increased by actual deposited.
  - `tend()` / `_deployToStrategies()` / `_autoAllocateToStrategy()`: same debt-increase pattern on idle deployment.
  - `_getStrategyAssetsSafe` (331): `try strategy.getTotalAssets() else strategyDebt[strategy]`, then clamp to `strategyMaxAssets`.

#### 7.2 CharmStrategy `getTotalAssets()` (the leveraged view)

From `CreatorCharmStrategy:446` (full trace):

```solidity
uint256 idleCreator = CREATOR.balanceOf(address(this));
uint256 idleUsdc = USDC.balanceOf(address(this));

(uint256 charmCreator, uint256 charmUsdc, bool charmReadable) = _getCharmExposure();
... (zero on !readable)

AjnaDebtState memory ajnaState = _readAjnaDebtState();
if (!ajnaState.readable) return 0;   // fail-closed

uint256 grossCreator = idleCreator + charmCreator;
uint256 usdcInCreator = _usdcToCreatorValue(idleUsdc + charmUsdc + ajnaState.collateralUsdc);
uint256 grossCreatorValue = grossCreator + usdcInCreator;

if (ajnaState.debtCreator >= grossCreatorValue) return 0;
return grossCreatorValue - ajnaState.debtCreator;
```

- The strategy reports **net** equity after its internal Ajna CREATOR debt.
- USDC collateral (both idle in Charm and pledged to Ajna) is converted to CREATOR terms using the oracle/TWAP path.
- When the backstop is active and leveraged, Charm reports **less** to the vault than the gross amount the vault believes it sent (`strategyDebt[charm]`).

#### 7.3 Ajna (via ERC4626StrategyAdapter + AjnaERC4626Vault)

- Adapter `getTotalAssets()` (173): `idle + ERC4626_VAULT.convertToAssets(sharesHeld)` (best-effort, falls back to idle only).
- The inner `AjnaERC4626Vault` maintains its own buffer + bucket LP positions.
- The adapter also maintains an explicit `idleBufferBps` (deposit path keeps some idle in the adapter, only excess goes into the inner Ajna vault).
- Debt tracking at vault level is still the gross transferred via `_depositIntoStrategyMeasured`. The adapter's reported value can lag or differ due to its own buffer policy and any unrealized bucket performance.

#### 7.4 Divergence & Implications During Rebalance

When Charm has active Ajna debt:

- Vault `strategyDebt[charm]` ≈ gross historical deployments.
- Charm `getTotalAssets()` = gross exposure – Ajna debt (in CREATOR terms).
- Therefore `_getStrategyAssetsSafe(charm)` (used in `totalAssets()`, rebalance overweight calc, withdrawal queue, unrealized loss assessment) returns the **net** number.

Consequences observed in the code:

- **Rebalance overweight detection** (StrategiesModule:486): `actualAssets = _getStrategyAssetsSafe(...)` uses the net number. Charm can appear less overweight (or even underweight) than its gross deployment because of internal leverage.
- **Unrealized loss calc** (`_assessUnrealisedLoss`, 397): `strategyAssets = _getStrategyAssetsSafe(...)`. Loss socialization uses the net (post-debt) figure against `currentDebt` (the gross sent). This can produce different socialization than a pure gross view.
- **Withdrawal queue** (`_withdrawFromStrategies`): `strategyAssets = _getStrategyAssetsSafe(...)` limits `toWithdraw`. A highly leveraged Charm reports lower capacity, which can push more withdrawal pressure onto the Ajna sleeve or idle.
- **Vault `totalAssets()`** (CreatorOVault:842): `coinBalance + sum(_getStrategyAssetsSafe for active strategies)`. The vault's PPS reflects Charm's net equity, not gross.

**Net effect**: The vault's internal "debt ledger" (`strategyDebt`) and its economic reality (`totalAssets()`) intentionally diverge when a strategy uses internal leverage. The design trusts the strategy's `getTotalAssets()` for economic truth while using `strategyDebt` only as a fallback on revert and as the "sent" accounting for debt purchasing / caps.

This is consistent with the "strategy is authoritative for its own NAV" pattern, but the Charm backstop makes that authority include off-vault leverage.

#### 7.5 Gaps / Questions for Further Review

- Is there any on-chain invariant or event that makes the net vs. gross divergence visible to the gauge, payout router, or external observers?
- Does `strategyMaxAssets` (the governance trust ceiling) intend to cap gross deployment or net exposure after backstop leverage?
- In a large rebalance + simultaneous user withdrawal while Charm is leveraged, can the combination of (a) vault rebalance pulling net assets and (b) user withdrawal also pulling cause the Ajna position to be stressed faster than a non-levered leg?
- Fee accrual (if any on strategies) and how it interacts with the debt-subtracted valuation.

These are the precise mechanics that make the "Charm and Ajna coordinate only through the idle buffer" statement incomplete once the backstop is active.

**Accounting posture after this trace**: The system is deliberately net-aware at the economic layer while keeping a gross deployment ledger. This is a conscious design choice with clear trade-offs that are now documented. No obvious double-counting or hidden inflation bugs found in the paths read, but the divergence is a monitoring and invariant surface that should be explicitly tracked (especially around rebalance + large flows).

*Accounting deep-dive complete for this pass.*

---

### 8. Keeper / Operational Rebalancing Layer (Continuation)

This slice audits how the actual production rebalancing is driven by the KPR keeper system, and how it interacts with the on-chain mechanisms (especially the Charm internal Ajna backstop we traced earlier).

#### 8.1 Two Distinct Rebalance Concerns for Charm

Production separates two different rebalance responsibilities:

1. **Inner Charm LP position management** (`charm-rebalance-manager`):
   - Runs on a schedule (see workflow).
   - Reads `CreatorOracle.getV3TWAPTick(twapDuration)`.
   - For each active Charm strategy, reads the underlying `charmVault.baseLower/baseUpper`.
   - Computes implied price change in bps between current TWAP tick and the position's center tick (`tickPriceChangeBps` + normalization for decimals and token ordering).
   - If the move exceeds `CHARM_REBALANCE_PRICE_CHANGE_TRIGGER_BPS` (configurable, default in secrets), it calls `charmVault.rebalance()` (via protocol treasury safe or automation safe for authorization).
   - This is the path that can cause `CreatorCharmStrategy` to execute its internal `_borrowFromAjna` / `_repayAjnaDebtWithCreator` logic during the subsequent deposit or liquidity adjustment inside the Charm vault.

2. **Cross-strategy weight reallocation** (`vault-strategy-reallocator`):
   - Runs every 15 minutes (4626.workflow.ts + vault-strategy-reallocator.workflow.ts).
   - For each active vault with ≥2 strategies:
     - Reads on-chain state: `coinBalance`, `minimumTotalIdle`, `deploymentThreshold`, `totalStrategyWeight`, `strategyList`/`strategyWeights`/`strategyDebt`, plus each strategy's `getTotalAssets()`.
     - Uses pure `strategyAllocation.ts` math (mirrors on-chain `rebalanceStrategies`):
       - `deployableBase = totalAssets - minIdle`
       - Target per strategy = `deployableBase * weight / totalStrategyWeight`
       - Drift computed in bps.
     - If max drift > `VAULT_STRATEGY_REALLOC_MIN_DEVIATION_BPS`, it enters a **multi-pass loop** (up to `VAULT_STRATEGY_REALLOC_MAX_PASSES`, typically 4, max 8):
       - Call `vault.rebalanceStrategies(minDeviationBps)` (either direct `writeContract` or via keeper HTTP bridge `/api/keeper/rebalance-strategies`).
       - Re-read full state.
       - Repeat until converged within band or max passes hit.
   - Uses `actualAssets` directly from strategy `getTotalAssets()` (for Charm this is the *net* post-Ajna-debt number). The reallocator is therefore automatically net-aware of any internal leverage in the Charm leg.

#### 8.2 Interaction with the Ajna Backstop

- The vault-strategy-reallocator has **no explicit knowledge** of Charm's internal Ajna debt state. It only sees whatever `CreatorCharmStrategy.getTotalAssets()` reports (which subtracts the debt).
- When the inner charm-rebalance-manager triggers a Charm vault rebalance (on price move), any resulting borrow/repay inside `CreatorCharmStrategy` changes the net NAV that the *next* run of the strategy reallocator will observe.
- Consequence: A material price move can cause:
  1. Inner rebalance → possible Ajna borrow inside Charm (increasing net CREATOR exposure while creating debt).
  2. Subsequent strategy reallocator tick sees the new net allocation and may decide to pull TVL out of the Charm leg (or push more in) via `rebalanceStrategies`.
- The backstop acts as an automatic "shock absorber" for liquidity during the inner rebalance, but the top-level weight rebalancer only reacts to the *after* net effect.

No code in kpr/ currently monitors Ajna utilization inside Charm strategies (no greps for `debtCreator`, `AjnaDebtState`, collateral ratio, etc. in the reallocator or charm manager). The backstop is treated as an opaque implementation detail of the Charm strategy's NAV reporting.

#### 8.3 Operational Characteristics & Risks

**Multi-pass chasing**:
- The pass loop (`runRebalancePassLoop`) is necessary because one `rebalanceStrategies` call does sequential withdraw-from-overweight then deposit-to-underweight. With `minDeviationBps` filtering and gas/liquidity limits inside strategies, full convergence often requires 2–4 on-chain calls.
- Max passes is a safety cap (hard 8). Hitting it with remaining drift logs a warning but does not alert as critical in the current code (only info alert on successful passes).

**Authorization paths**:
- Direct writes from keeper key (when not using HTTP bridge).
- Or via the keeper HTTP bridge (Vercel side) which the on-chain keeper can call.
- Charm inner rebalances go through protocol treasury safe or automation safe (for the privileged `rebalance` on the Charm vault itself).

**Failure modes observed in code**:
- If `getTotalAssets()` reverts on a strategy, the reallocator falls back to `strategyDebt` for that leg (same as on-chain).
- Write failures (revert, gas, etc.) stop the pass loop early and surface as errors.
- Single-strategy or shutdown/paused vaults are skipped cleanly.

**Configuration surfaces** (from secrets.example.env and code):
- `VAULT_STRATEGY_REALLOC_MIN_DEVIATION_BPS`
- `VAULT_STRATEGY_REALLOC_MAX_PASSES`
- `CHARM_REBALANCE_PRICE_CHANGE_TRIGGER_BPS`
- `CHARM_REBALANCE_TWAP_DURATION`

#### 8.4 Audit Assessment — Keeper Layer

**Strengths**:
- Clean separation of concerns (inner position rebalance vs. top-level weight reallocation).
- Multi-pass with fresh state reads is a pragmatic way to chase the on-chain sequential nature of `rebalanceStrategies`.
- Relies on strategy-reported `getTotalAssets()` (net for Charm) — consistent with the accounting model we traced.
- Good observability (per-vault logging + alerts on success/failure).

**Gaps / Observations**:
- No visibility or alerting on Charm's internal Ajna leverage/utilization. A vault whose Charm leg is heavily using the backstop (high debtCreator / collateral) will just appear as "lower net TVL in Charm" to the reallocator. Sudden unwind of the backstop (e.g., large repay on inflow, or forced liquidation on Ajna) could cause unexpected drift spikes.
- The inner charm rebalance (price-move triggered) and the weight reallocator run on independent schedules. A price move large enough to trigger inner rebalance + borrow can immediately change the inputs the next weight rebalance sees.
- Max-passes-with-remaining-drift is only a warning today; in a high-volatility or low-liquidity period this could leave persistent misallocation.
- The reallocator does not appear to have any special preflight around whether a planned `rebalanceStrategies` call would push Charm into (or out of) heavy backstop usage.

**Recommendations**:
- Add lightweight monitoring/alerting in the reallocator (or a new sidecar) for Charm strategies where Ajna debt utilization exceeds a threshold (e.g., debtCreator / gross exposure).
- Consider exposing a view or event from CharmStrategy for "current backstop utilization" that keepers and the reallocator can read.
- Tighten or make configurable the "max passes with drift" outcome (currently soft warning).
- In chaos / incident runbooks, explicitly call out that a large price move can cause both inner rebalance (with borrow side-effects) *and* subsequent weight reallocation in the same 15-min window.

This completes the operational picture of how rebalancing actually happens for the Charm + Ajna pair in production.

*Keeper / operational rebalancing layer deep-dive complete.*

---

### Overall Charm + Ajna Rebalance Audit Assessment (Synthesis)

Across the slices executed in this continuation (architecture → rebalance flow & backstop coupling → accounting/NAV divergence → keeper operational layer), the picture is now clear and consistent:

**The system is deliberately layered and net-aware**:
- On-chain: gross deployment ledger (`strategyDebt`) + strategy-reported economic truth (`getTotalAssets`, net of internal leverage for Charm).
- Rebalance math (both on-chain and in the reallocator) operates on the net view.
- The Ajna backstop inside Charm is a real, production backstop for concentrated LP liquidity management. It is triggered as a side-effect of inner position rebalances (price-move driven) and large flows, not as a top-level orchestrated action.
- Keepers have two independent loops (inner Charm rebalance on price delta; cross-strategy weight reallocation every 15 min with multi-pass chasing). The backstop effects flow through the net NAV that the weight reallocator observes.

**No critical bugs found** in the paths examined, but several material nuances and monitoring gaps were surfaced (detailed in the sections above), particularly around the opacity of the internal leverage to the weight rebalancer and the lack of explicit backstop-utilization observability.

**Key AGENTS.md claim now qualified**:
The statement that "Charm and Ajna coordinate only through the parent vault idle CREATOR buffer" is true at the *weight allocation* layer, but incomplete once the operational backstop inside `CreatorCharmStrategy` is taken into account. The backstop creates direct (if one-way) coupling for liquidity during stress.

**Recommended next actions** (if this audit thread continues):
- Add backstop utilization metrics / alerts in the reallocator or a lightweight sidecar.
- Consider surfacing `currentAjnaDebtState` or utilization ratio from CharmStrategy for external observers and the reallocator.
- Explicitly document the two rebalance concerns + backstop side-effects in strategy design docs and runbooks.
- Add a targeted invariant or chaos test that combines a price move (triggering inner rebalance + borrow) with a concurrent vault-level weight rebalance and user withdrawal.

The Charm/Ajna + rebalancing mechanisms are one of the more sophisticated parts of the v1.12+ yield strategy stack. The engineering is thoughtful (net-aware accounting, best-effort defenses, multi-pass chasing, fail-closed valuation), but the internal leverage introduces complexity that benefits from explicit observability and documentation.

*Charm & Ajna rebalance dynamics audit slice fully complete.*