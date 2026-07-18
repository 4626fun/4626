# Security Review — CreatorVaultDeployer.sol / DeploymentBatcher (CreatorVault protocol)

**Prepared for**: leftclaw job #421
**Target (live, as named in the job)**: `DeploymentBatcher` `0xa18169caf37fa0347285B16aAFC2B09eCB43F145` and `Phase2Module` `0xC3Af8F49492Db7Ba0B851F3A16c13CCAa94af9Ad`, Base mainnet (chain 8453)
**Target (audited)**: `contracts/helpers/batchers/CreatorVaultDeployer.sol` (675 lines) + `contracts/helpers/infra/UniversalBytecodeStore.sol` (72 lines)
**Repository**: `github.com/wenakita/CreatorVault`
**Commit audited**: `971da642861b070067aefa5f70aa82546aae5af6` (branch `main`, 2026-01-29)
**Methodology**: three-phase review — context mapping (opus) → ethskills breadth checklist (4 domain agents, opus) → pashov-style depth/attack-mindset review (12 agents, opus, run blind to phase-1 findings) → hybrid reconciliation.

---

## ⚠️ Scope note — live contract vs. audited source (read first)

The job description named `github.com/wenakita/4626` (returns HTTP 404, does not exist) and files `DeploymentBatcher.sol`/`Phase2Module.sol` (not found anywhere in the real repository, on any of its 16 branches). The **live addresses are real**, however: both hold substantial deployed bytecode on Base (~19KB each, confirmed via RPC). We extracted function selectors from the live bytecode and called its view functions directly on-chain; the resolved function names (`deployPhase2Core`, `finalizePhase2`, `phase2Module()`, `phase1SplitStates`, `deployPhase3Strategies`, `vaultActivationBatcher()`, `registry()`, `lotteryManager()`, etc.) and linked-contract addresses **exactly cross-verify** against other jobs in this client's queue — `registry()` returns `0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2` (job 422's target) and `lotteryManager()` returns `0xB45E68a5867935a5734E4185977F81c528006650` (job 418's target) — and against canonical Base infrastructure (USDC, Uniswap V3 factory, Permit2). This confirms the live contract is the real, currently-active deployment orchestrator for this exact protocol.

`contracts/helpers/batchers/CreatorVaultDeployer.sol` in the real repository is the **closest available reference source**: same author, same Phase 1/2/3 architecture, same `vaultActivationBatcher` immutable wiring, and its `deployPhase3Strategies` function matches the live contract's selector by name and argument-tuple shape. It is **not proven byte-identical** to the live bytecode — the live contract's Phase 2 has apparently been split into a separate `phase2Module()` contract (the live selectors `deployPhase2Core`/`finalizePhase2`/`phase1SplitStates` don't exist in this file, which instead has a monolithic `deployPhase2AndLaunch`). Findings on Phase 1 and Phase 3 logic (including the report's headline finding) rest on a structural pattern — the deployer never relinquishing the vault's `management` role — that we independently confirmed both here and in a separate completed audit of the vault contract itself (job 419, same repo/commit) this session; that vault-side confirmation is not affected by the Phase 2 refactor. **The client should verify the live `DeploymentBatcher`/`Phase2Module` bytecode directly (e.g., via a decompiler or by requesting the current private source) before treating any finding below as certain for the exact deployed instance** — this audit's confidence is high for the underlying *pattern* and *architecture*, not verified byte-for-byte against the live contract.

---

## Scope

| | |
|---|---|
| **Files reviewed** | `contracts/helpers/batchers/CreatorVaultDeployer.sol` (675 LOC) · `contracts/helpers/infra/UniversalBytecodeStore.sol` (72 LOC) |
| **Confidence floor** | All findings Low severity and above are reported below; items below confidence 50 are listed separately under **Leads** |

---

## Reconciliation summary

- **Phase 1** (4 ethskills domain agents: general, precision-math, access-control, assembly) and **Phase 2** (12 pashov attack-mindset agents, run blind to Phase 1) were reconciled against each other and against the Phase-0 protocol map.
- **Unprecedented cross-agent convergence**: the two headline findings below were independently rediscovered by 2 of 4 phase-1 agents and 9 of 12 phase-2 agents — 11 of 19 total hunting agents, working blind to each other, several going further to directly cross-reference the actual `CreatorOVault.sol` vault-contract source (available on disk from this session's separately-completed job 419 audit) to trace the exploit mechanism end-to-end rather than relying on structural inference.
- **Overlap**: 2 Critical/High-severity clusters, plus a Medium (shareOFT salt collision) found by both phases independently.
- **Phase-1-only / Phase-2-only**: none at Medium+ severity — every substantive finding was cross-phase corroborated. Several Low-severity leads (tick-spacing scale confusion, permit front-run, fee-on-transfer desync) were raised in both phases with consistent framing.
- **Coverage holes closed this pass**: 0 — both phases, between them, examined every state-changing entrypoint in the contract.
- **Confidence floor used**: findings below confidence 50 are demoted to the Leads section.

---

## Access-Control Inventory

`CreatorVaultDeployer` has **no owner, no admin, no privileged role of any kind** — it inherits only `ReentrancyGuard`, not `Ownable`/`AccessControl`. All 14 configuration addresses are `immutable`, set once at construction. The only access check anywhere in the contract is `_requireOwner(address owner)` (`CreatorVaultDeployer.sol:605-607`): `if (msg.sender != owner) revert NotOwner();` — checked against a **caller-supplied struct field**, not any stored or authorized address, and therefore trivially satisfiable by any caller setting that field to their own address. `UniversalBytecodeStore` likewise has no owner/admin; its `store()` function (line 54) has zero access control.

**State-changing entrypoints**: `deployPhase1`, `deployPhase2AndLaunch`, `deployPhase2AndLaunchWithPermit`, `deployPhase3Strategies` (all `nonReentrant`, all gated only by the self-satisfiable `_requireOwner`), and `UniversalBytecodeStore.store` (fully unguarded — no caller check at all, relying only on content-addressing/append-only logic for its own integrity). Every one of these is effectively callable by anyone.

**Downstream role handling**: every contract this deployer CREATE2-deploys is constructed with `tempOwner = address(this)` as its owner/admin. At the end of Phase 2, only the vault's OZ `owner()` role is transferred to `params.owner` (line 473); wrapper/shareOFT/gauge/CCA/oracle ownership goes to a fixed `protocolTreasury` (lines 474-478). **The vault's `management` role (and, per the vault's own constructor logic confirmed in job 419's audit, also `keeper` and `emergencyAdmin`) is never transferred away from the deployer at any point** — confirmed by whole-file grep across every phase-1 and phase-2 agent: zero occurrences of `setManagement`/`setPendingManagement`/`acceptManagement`/`setKeeper`/`setEmergencyAdmin`.

---

## Threat Model

| Actor | Reach | Potential gain | Status |
|---|---|---|---|
| Any caller | `deployPhase3Strategies` with `params.vault` = any vault ever deployed via this contract's own Phase 1 | Register an attacker-controlled strategy (built from attacker-registered bytecode) with up to 100% weight into the target vault; once `setAutoAllocate(true)`, subsequent deposits auto-route funds into it | Addressed by **Finding 1 (Critical)** |
| Any caller | `deployPhase2AndLaunch`/`...WithPermit` with `params.vault`/`wrapper`/`shareOFT` = another party's Phase-1-only (not-yet-Phase-2'd) deployment | Claim final `owner` role on the victim's vault; wire it to attacker-controlled gauge/oracle infrastructure; permanently lock out the legitimate creator | Addressed by **Finding 2 (High)** |
| Any caller | `UniversalBytecodeStore.store` | Register arbitrary CREATE2 creation bytecode and obtain a usable `codeId` for any Phase 1/2/3 call | This is the enabling primitive for Finding 1, not independently exploitable — addressed together with Finding 1 |
| Any caller | `deployPhase1`/`deployPhase2*`/`deployPhase3*` with `params.owner = msg.sender` for a token they don't administer | Deploy a full vault stack for a `creatorToken` address they don't control | **Intentional** — this is a permissionless deploy-for-yourself factory by design; the token contract's own authorization (e.g. `setPayoutRecipient`) gates whether the deployment is *useful* to an impersonator, not this contract's responsibility |
| Same owner, different `creatorToken` | Reusing `(symbol, version)` across two different Phase-1 deployments | Second deployment's shareOFT collides with the first's CREATE2 address | Addressed by **Finding 3 (Medium)** |

---

## Findings

### [Critical-1] Permissionless strategy injection into any vault this deployer has ever created — permanently retained `management` role + unbound caller-supplied vault address

**Severity**: Critical · **Confidence**: 98
**Location**: `deployPhase3Strategies()`, `contracts/helpers/batchers/CreatorVaultDeployer.sol:498-599` (gate at 502, vault check at 504, `addStrategy` calls at 580/582, `setAutoAllocate` at 585); `UniversalBytecodeStore.store()`, `contracts/helpers/infra/UniversalBytecodeStore.sol:54-63`; cross-referenced against `CreatorOVault.sol:508` (`management = _owner`), `978-1001` (`addStrategy`, `onlyManagement`), `1208-1232` (`_autoAllocateToStrategy`) — all confirmed in this session's separate audit of that vault contract (job 419, same repo/commit).

**Description**: `deployPhase3Strategies`'s only authorization gate is `_requireOwner(params.owner)` (line 502) — `if (msg.sender != owner) revert NotOwner()` (line 605-607) against a caller-supplied struct field, trivially satisfied by any caller setting `params.owner = msg.sender`. `params.vault` receives **only a non-zero check** (line 504) — weaker even than Phase 2's `code.length != 0` check — and is never bound to any prior Phase-1 deployment; the contract holds no mutable state whatsoever (confirmed by whole-file grep: no `mapping`, only `immutable`s and constants).

Every vault this deployer creates is constructed with `tempOwner = address(this)` as its `_owner` constructor argument (Phase 1, line 329-330). `CreatorOVault`'s constructor assigns `management = _owner` (verified directly in this session's job 419 audit, `CreatorOVault.sol:508`) — so the deployer becomes, and **permanently remains**, `management` of every vault it deploys. Phase 2 transfers only the vault's `owner()` role (line 473); no `setManagement`/`setPendingManagement`/`acceptManagement` call exists anywhere in this file. `addStrategy` on the vault is `onlyManagement` (`CreatorOVault.sol:978`, modifier at line 430 admits `management || owner()`), so the deployer's call `ICreatorOVaultStrategyManager(params.vault).addStrategy(out.charmStrategy, params.charmWeightBps)` (line 580) succeeds against **any vault this deployer has ever created, for that vault's entire lifetime** — not limited to any deployment window.

The registered strategy is CREATE2-deployed from `codeIds.creatorCharmStrategy` — a fully caller-supplied `codeId` (line 511-512, only non-zero-checked) resolvable through `UniversalBytecodeStore.store()`, which has **zero access control** (no `msg.sender` check at all — anyone may register arbitrary creation bytecode; the function is safe in isolation only because it is content-addressed and append-only, not because it curates content). `addStrategy`'s only validity checks (`CreatorOVault.sol:985-987`: `isActive()==true`, `asset()==CREATOR_COIN`) are trivially satisfiable by attacker-authored bytecode.

With `params.enableAutoAllocate=true` → `setAutoAllocate(true)` (line 585), the complete fund-drain path was independently traced by six separate agents through `CreatorOVault.sol`'s `_autoAllocateToStrategy` (lines 1208-1232): every subsequent user deposit's idle balance auto-routes to `defaultQueue[0]` (the just-injected malicious strategy) via `forceApprove` + `IStrategy.deposit()` — the attacker's `deposit()` implementation simply keeps the approved funds.

**Proof of Concept**:
1. Attacker authors malicious strategy creation bytecode M: `isActive()→true`, `asset()→victimVault'sCREATOR_COIN`, `deposit(amount)→transferFrom(vault, attacker, amount); return amount`, `withdraw()/getTotalAssets()→0`.
2. `UniversalBytecodeStore.store(M)` (no authentication required) → returns `codeId`.
3. Attacker calls `deployPhase3Strategies(params, codeIds)` with `params.owner = attacker` (passes the gate), `params.vault = victimVault`, `params.creatorToken = victimVault`'s real `CREATOR_COIN`, `params.charmWeightBps = 10000` (100%, within the `(0,10000]` bound at line 505), `params.enableAutoAllocate = true`, `codeIds.creatorCharmStrategy = codeId` (the V3-pool precondition at lines 515-521 is satisfiable via the real CREATOR/USDC pool, or by supplying `initialSqrtPriceX96` to create it).
4. The deployer, still `management` of `victimVault`, executes `addStrategy(maliciousStrategy, 10000)` and `setAutoAllocate(true)`.
5. Any subsequent deposit into the victim vault auto-allocates idle funds directly into the attacker's strategy, which the attacker withdraws.

Total attacker cost: gas only. No relationship to the vault's creator, no prior token holdings, and no compromised key are required.

**Recommendation**:
```diff
 function deployPhase3Strategies(
     Phase3Params calldata params,
     StrategyCodeIds calldata codeIds
 ) external nonReentrant returns (Phase3Result memory out) {
     _requireOwner(params.owner);
+    require(params.vault == _computePhase1VaultAddress(params.creatorToken, params.owner, params.version), "vault not owned by caller");
     ...
```
Persist a `mapping(address vault => address creator)` recorded at Phase 1 (or recompute the deterministic CREATE2 vault address from `(creatorToken, owner, version)` and require equality), so Phase 3 can only be run by the party who actually deployed the target vault. Additionally, and independently of the above, transfer the vault's `management`/`keeper`/`emergencyAdmin` roles (not just `owner`) to `params.owner`/`protocolTreasury` at the end of Phase 2, so the deployer holds no standing privilege on any vault after deployment completes. Finally, restrict acceptable `codeId`s in `UniversalBytecodeStore`-consuming calls to a protocol-curated allowlist rather than trusting arbitrary caller-supplied bytecode.

---

### [High-1] Vault-ownership hijack of any deployment sitting in the Phase-1-done/Phase-2-pending window

**Severity**: High · **Confidence**: 97
**Location**: `deployPhase2AndLaunch()`/`deployPhase2AndLaunchWithPermit()`/`_deployPhase2AndLaunch()`, `contracts/helpers/batchers/CreatorVaultDeployer.sol:358-488` (vault/wrapper/shareOFT checks at 381-387, ownership transfer at 473, `payoutRecipient` skip at 408-410)

**Description**: `_deployPhase2AndLaunch` accepts `params.vault`/`params.wrapper`/`params.shareOFT` as raw caller calldata, validating only non-zero (line 382) and `code.length != 0` (line 387, `Phase1Missing`) — never that these addresses were produced by a Phase-1 call from the same caller. No `mapping` or any mutable state exists in the contract to bind them. During the window after a victim's Phase 1 completes but before their own Phase 2 runs, the deployer still owns those contracts (`tempOwner = address(this)`, set at Phase-1 construction). An attacker supplying `params.vault = victimVault`, `params.owner = attacker` passes every check; every owner-gated wiring call succeeds; `ICreatorOVault(params.vault).transferOwnership(params.owner)` (line 473) hands the victim's vault to the attacker. Since the vault's CREATE2 address is deterministic, the legitimate creator cannot simply redeploy to reclaim it, and their own later Phase-2 attempt reverts (the deployer no longer owns the vault) — a permanent lock-out.

**Proof of Concept (zero-cost variant, converged across multiple independent agents)**: `params.payoutRecipient = address(0)` skips the one call that would otherwise require creator-token-specific authorization (`setPayoutRecipient`, lines 408-410). `params.depositAmount` is set to exactly the vault's `MINIMUM_FIRST_DEPOSIT` of its real `CREATOR_COIN` (the one real cost to the attacker — but fully recovered, since with `params.owner = attacker` and `auctionPercent = 0`, 100% of the resulting wrapped shares vest back to the attacker over the standard 365-day schedule). Execution reaches line 473 and the victim vault's owner becomes the attacker. The attacker also gains every owner-gated function on the vault: `setPaused`, `setProtocolRescue`, `setPerformanceFeeRecipient`, `rescueToken`, `setGaugeController`, etc. (cross-referenced from this session's completed job 419 audit of `CreatorOVault.sol`).

**Recommendation**: Recompute the expected Phase-1 CREATE2 addresses for `(params.creatorToken, params.owner, params.version)` inside `_deployPhase2AndLaunch` and `require` they equal the supplied `params.vault`/`wrapper`/`shareOFT` before any wiring or ownership-transfer call:
```diff
 function _deployPhase2AndLaunch(
     Phase2Params calldata params,
     CodeIds calldata codeIds
 ) internal returns (Phase2Result memory out) {
     if (params.creatorToken == address(0) || params.owner == address(0)) revert ZeroAddress();
     if (params.vault == address(0) || params.wrapper == address(0) || params.shareOFT == address(0)) revert ZeroAddress();
+    bytes32 baseSalt = _deriveBaseSalt(params.creatorToken, params.owner, params.version);
+    require(params.vault == create2Deployer.computeAddress(_saltFor(baseSalt, "vault"), codeIds.vault), "vault provenance mismatch");
+    require(params.wrapper == create2Deployer.computeAddress(_saltFor(baseSalt, "wrapper"), codeIds.wrapper), "wrapper provenance mismatch");
     ...
```

---

### [Medium-1] shareOFT CREATE2 salt omits `creatorToken`, enabling same-owner cross-deployment address collision

**Severity**: Medium · **Confidence**: 85
**Location**: `_deriveShareOftSalt()`, `contracts/helpers/batchers/CreatorVaultDeployer.sol:643-646`; consumed at `deployPhase1` line 317, deployed line 337; contrast with `_deriveBaseSalt()` line 635-637

**Description**: Every other component's salt (`_deriveBaseSalt`, driving vault/wrapper/gauge/CCA/oracle/strategies) includes `creatorToken`, `owner`, and `block.chainid`. `_deriveShareOftSalt(owner, shareSymbolLower, version)` deliberately excludes `creatorToken` and `chainid`. Since the shareOFT's constructor args also don't vary with `creatorToken` (only `shareName`/`shareSymbolUpper`/the constant `oftBootstrapRegistry`/the constant `tempOwner`), the shareOFT CREATE2 target address is a pure function of `(owner, symbolLower, version, shareName, codeIds.shareOFT)` — completely independent of which creator token is being deployed. A single owner deploying two different creator tokens with the same symbol+version+shareName derives the identical shareOFT salt and address. Note this is a same-owner footgun, not a cross-party attack (`owner` is itself part of the salt and gated by `_requireOwner`, so an attacker cannot pre-occupy a victim-owned address).

**Proof of Concept**: Owner X deploys token A with symbol "AKITA"/version "v1" → shareOFT at address `S`. Owner X later deploys a different token B with the same symbol/version/shareName. The salt and init-code hash are identical, so the target is again `S`, which already has code from A's deployment. The exact outcome depends on the out-of-scope `create2Deployer.deploy` implementation's behavior on an occupied target: either it reverts (permanent DoS on deploying a second same-branding token) or is idempotent and silently re-wires token A's shareOFT (`setVault`/`setMinter`) to point at token B's vault/wrapper — corrupting A's live token/vault binding if A hasn't yet run Phase 2, or bricking with a revert if A has (ownership already moved).

**Recommendation**: Include `creatorToken` in the shareOFT salt derivation, matching `_deriveBaseSalt`'s pattern; unless a chain-stable OFT address is a hard cross-chain requirement, also include `block.chainid`.

---

### [Low-1] `_defaultTickSpacingQ96` mixes a Q96-scaled price with a base-10 divisor

**Severity**: Low · **Confidence**: 70
**Location**: `_defaultTickSpacingQ96()`, `contracts/helpers/batchers/CreatorVaultDeployer.sol:648-651`

**Description**: `spacing = floorPriceQ96 / 100; return spacing > 1 ? spacing : 2;` — the caller-supplied `floorPriceQ96` is a Q96 fixed-point price (scale ≈2^96 ≈ 7.9e28 for a price near 1). Dividing it by the base-10 constant 100 produces a value whose meaning as a "tick spacing" (normally a small integer like 1/10/60/200) depends entirely on the out-of-scope CCA launch strategy's interpretation of `setDefaultTickSpacing`; for realistic prices the result is astronomically large (order 1e26+). Separately, the floor clamp maps both `spacing==0` and `spacing==1` to `2`, so a tick spacing of exactly `1` is never producible.

**Proof of Concept**: `floorPriceQ96 = 2^96` (price = 1.0) → `spacing ≈ 7.92e26`, forwarded to `ICCALaunchStrategy.setDefaultTickSpacing`. Concrete downstream impact (revert vs. silently-corrupted tick math vs. an intended-but-undocumented Q96-domain spacing) could not be confirmed since the CCA strategy consumer is out of scope for this audit.

**Recommendation**: Make the intended scaling explicit and document it; if the goal is genuinely a small integer tick-spacing count, derive it from the pool's actual tick spacing rather than a raw `/100` of a Q96-scaled price.

---

### [Low-2] Raw `IERC20Permit.permit` call with no try/catch — front-run griefing on `deployPhase2AndLaunchWithPermit`

**Severity**: Low · **Confidence**: 80
**Location**: `_permitAndPull()`, `contracts/helpers/batchers/CreatorVaultDeployer.sol:613-616`

**Description**: `_permitAndPull` calls `IERC20Permit(creatorToken).permit(owner, address(this), amount, ...)` raw (line 614) before `safeTransferFrom`. Standard permit front-run: anyone observing the victim's transaction in the mempool can extract and submit the `permit(...)` call directly to the token first, consuming the nonce and reverting the victim's `deployPhase2AndLaunchWithPermit` call. Impact is limited — the victim can resubmit via the non-permit `deployPhase2AndLaunch` after a normal `approve`.

**Recommendation**: Wrap the `permit` call in try/catch and proceed to `safeTransferFrom` if the allowance is already sufficient, so a front-run doesn't brick the deployment attempt.

---

### [Low-3] Phase 2 deposit and Phase 3's fee-on-transfer assumptions use requested amounts with no balance measurement

**Severity**: Low · **Confidence**: 65
**Location**: `_pullCreatorTokens()` lines 609-611; `_deployPhase2AndLaunch()` lines 433-437

**Description**: The pulled and deposited amounts both use `params.depositAmount` directly with no before/after balance measurement. A fee-on-transfer or rebasing `creatorToken` would desync the deposit from actual tokens received, most likely causing the subsequent `vault.deposit()` call to revert (self-DoS) rather than a silent accounting error. Since `creatorToken` is fully caller-supplied, this self-harms only the deploying caller in the ordinary (non-attack) usage pattern.

**Recommendation**: Measure the actual received balance delta around the transfer and deposit that amount instead of the requested amount, or explicitly document that fee-on-transfer/rebasing creator tokens are unsupported.

---

### [Low-4] Phase 3 omits the `code.length` existence check that Phase 2 performs

**Severity**: Low · **Confidence**: 75
**Location**: `deployPhase3Strategies()` line 504 vs. `_deployPhase2AndLaunch()` line 387

**Description**: Phase 2 requires `params.vault.code.length != 0` (`Phase1Missing` on failure); Phase 3 checks only that `params.vault != address(0)`. The subsequent high-level `addStrategy` call would revert on a codeless address regardless (implicit EXTCODESIZE check), but Phase 3 first performs the V3-pool creation and up to two full CREATE2 strategy deployments before failing on an EOA `params.vault` — wasted gas and orphaned strategy contracts.

**Recommendation**: Add `if (params.vault.code.length == 0) revert Phase1Missing();` early in `deployPhase3Strategies`, mirroring Phase 2's guard (though note this alone does not address Finding 1 — a provenance check is still required).

---

## Info / Code-Quality Notes (no security impact)

- **`UniversalBytecodeStore`'s `_SSTORE2` inline-assembly is correct**: independently hand-verified by multiple agents (the 11-byte init-code prefix `600B5981380380925939F3` decodes to the canonical SSTORE2 stub; `create` failure is checked; the STOP-byte prefix/offset handling is off-by-one-free; the stored data can never be executed).
- **`abi.encodePacked` salt derivations are free of the classic dynamic-type packing-collision pattern** — every packed call has at most one trailing dynamic argument preceded only by fixed-width fields (verified by three independent agents).
- **Weight-bps validation, `auctionPercent` bound, and the auction/vesting split arithmetic are all correct** (multiply-before-divide order, no overflow, full-conservation invariant `auctionAmount + remaining == wsTokens` holds by construction, truncated dust routes entirely to vesting rather than being lost).
- **`uint16(block.chainid)` downcast** (lines 326-327, LayerZero endpoint wiring) is currently correct only because the deployment targets Base mainnet (chain 8453, fits in `uint16`); would silently truncate/alias on chains with id > 65535 (e.g. Base Sepolia 84532) — informational since the current target is unaffected.

---

## Leads

*Concrete code smells where the full exploit path could not be verified in this pass — high-signal but not scored as findings.*

- **`setPayoutRecipient` cross-user redirect** — `contracts/helpers/batchers/CreatorVaultDeployer.sol:408-410` — Code smells: the deployer calls a privileged setter (`ICreatorCoin(params.creatorToken).setPayoutRecipient(params.payoutRecipient)`) on a caller-supplied `creatorToken` with a caller-chosen `payoutRecipient`. If any already-deployed creator token grants this factory standing authority over `setPayoutRecipient` (plausible from a prior legitimate same-owner deploy), a stranger could invoke Phase 2 naming that victim token to redirect its revenue stream. Unverified — depends on the out-of-scope `ICreatorCoin` implementation's authorization model.
- **Auction-leftover accounting relies on arithmetic, not measured balance** — `contracts/helpers/batchers/CreatorVaultDeployer.sol:439-460` — Code smells: `remaining = wsTokens - auctionAmount` is computed by arithmetic rather than by re-measuring the batcher's `shareOFT` balance after `launchAuction` returns; if the CCA strategy pulls fewer than `auctionAmount` tokens (partial fill, rounding), the vesting transfer under-transfers and residual tokens are stranded in the batcher. Unverified — depends on the out-of-scope CCA strategy's exact consumption behavior.
- **Phase-1 idempotency asymmetry** — `contracts/helpers/batchers/CreatorVaultDeployer.sol:322-337` — Code smells: the OFT-bootstrap-registry deploy branch is guarded by an existence check (`if (out.oftBootstrapRegistry.code.length == 0)`, line 322) before calling `deploy`; the vault/wrapper/shareOFT branches immediately following it are not. Re-invoking `deployPhase1` with identical parameters reverts on the first occupied CREATE2 address rather than no-op'ing. Low-severity recoverability/griefing note rather than a fund-risk finding.

---

## Coverage gate

Every state-changing entrypoint in the Access-Control Inventory maps to a finding above or an explicit "intentional by design" note in the Threat Model. Both hunting phases, between them, had already examined every entrypoint before this reconciliation pass — zero first-time coverage holes were closed in Turn 3.

---

> ⚠️ This review was performed by an AI-orchestrated multi-agent audit pipeline. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. **This audit covers the closest available reference source, not verified byte-for-byte against the live `DeploymentBatcher`/`Phase2Module` bytecode at the addresses named in the job** (see the Scope Note at the top of this report) — the client should independently confirm the live contracts share the "management never relinquished" pattern documented here before relying on Finding 1's Critical rating for the deployed instance specifically. Independent human security review, source-code disclosure/verification of the live contracts, and a public bug bounty are strongly recommended before continuing to operate this deployment infrastructure, particularly given Finding 1's unconditional, unauthenticated fund-drain path against every vault the pattern applies to.
