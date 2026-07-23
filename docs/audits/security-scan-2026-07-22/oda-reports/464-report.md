# 🔐 Security Review — DeploymentBatcher.sol (4626fun)

---

## Scope

|                                  |                                                        |
| -------------------------------- | ------------------------------------------------------ |
| **Target**                       | `contracts/shared/deploy/batchers/DeploymentBatcher.sol` — 6 in-file contracts: `DeploymentBatcher` (shell), `DeploymentBatcherPhase1Module`, `DeploymentBatcherPhase2Module` (delegatecall), `DeploymentBatcherPhase3Helper`, `DeploymentBatcherShareMeshHelper`, `DeploymentBatcherUtilsHelper` |
| **Repo / commit**                 | `github.com/4626fun/4626` @ tag `audit/oda-2026-07-22`, commit `423e0e3a607884de6e60bccd06f722a8aba770ee` (verified: local clone HEAD matches exactly) |
| **Live deployment (Base, chain 8453)** | Shell `0xa18169caf37fa0347285B16aAFC2B09eCB43F145` · Phase2Module `0x1217bA070DBf64303117939301788925030295d1` · Phase1Module `0xb64bA38aBAe1f64Ff0ca4541bFFF5333d2C0Fd61` · `protocolTreasury` `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` — all confirmed live via `cast call` against Base RPC at audit time; `codeIdAllowlistEnabled=true`, `codeIdAllowlistFrozen=false` |
| **Methodology**                  | Three-phase: (0) context — protocol map, access-control inventory, threat catalog (opus) → (1) breadth — 8 ethskills domain checklists (opus) → (2) depth — 12 pashov attack agents, run blind to phase-1 findings (opus) → reconciliation + coverage gate |
| **Client-stated focus**          | Privilege / access control, CREATE2 reuse, init-code hashes, Phase trust boundaries |
| **Confidence threshold reported**| All Low severity and above; findings with confidence < 50 are listed separately under **Leads** |

**Scope note:** per the client's instructions, this audit used `github.com/4626fun/4626` at the pinned tag/commit as the sole source of truth and did not reference `github.com/wenakita/CreatorVault` or the private `wenakita/4626` repository. Two out-of-scope files (`contracts/creator/vault/CreatorOVault.sol`, `contracts/creator/vault/CreatorOVaultWrapper.sol`) were read on a targeted basis solely to verify/refute one candidate finding (see Finding F-06) — no independent audit of those files was performed, and no findings below are based on undisclosed assumptions about their behavior beyond what was directly verified.

---

## Reconciliation Summary

Two hunting phases were run independently and blind to each other (Phase 1 saw only the protocol map; Phase 2 saw only the protocol map, not Phase 1's findings), then cross-checked in this reconciliation pass.

`Overlap: 8 themes independently found by both phases · Phase-1-only: 10 · Phase-2-only: 7 · Re-examined leads kept: 1 (narrowed, not dropped) · demoted: 1 (refuted after targeted re-read of out-of-scope vault source) · Coverage holes closed this pass: 0 (both phases independently covered the full access-control inventory and threat catalog; the one targeted re-read was confirming a phase-2-unique lead, not filling a coverage gap).`

Confidence floor: all findings Low severity and above are reported below; anything with confidence < 50 is listed under **Leads** only (no severity score, no fix block), per the audit's coverage-gate discipline.

The single most load-bearing convergence: **four independent hunting passes** (ethskills general-checklist agent, and three separate pashov attack-specialty agents — access-control, execution-trace, first-principles) each independently discovered the same root cause: `_requireOwner`'s self-naming pattern combined with first-writer-wins registry writes allows permissionless registry squatting. This is Finding F-01 below.

---

## Findings

### [85] F-01. Permissionless Registry4626 squatting via self-named `params.owner` — a legitimate creator's token registration can be permanently hijacked for the cost of gas alone

`DeploymentBatcherPhase2Module._deployPhase2CoreBody` · lines 1179–1187, 1232–1245 · Confidence: 85

**Description**
`_requireOwner(address owner)` (`DeploymentBatcher.sol:2586-2588`) authenticates only `msg.sender == owner`, where `owner` is a caller-supplied calldata field with no on-chain proof it represents `params.creatorToken`. Reaching Phase 2a (`deployPhase2Core`) requires **no token deposit** — only Phase 1 (`deployPhase1CoreWithSalt`/`finalizePhase1WithSalt`, gas only) and Phase 2a (gas only; the deposit lives in the later `finalizePhase2`). Inside `_deployPhase2CoreBody`:
```solidity
if (reg.getTokenInfo(params.creatorToken).token == address(0)) {
    (string memory name, string memory symbol) = _readTokenMetadata(params.creatorToken);
    reg.registerToken(params.creatorToken, name, symbol, params.owner, address(0), 0);
}
_setVaultKindMeta(params.creatorToken, params.vault, vaultKind);
```
Registration is guarded only by `token == address(0)` — first-writer-wins, with **no check that `msg.sender`/`params.owner` has any legitimate claim on `params.creatorToken`**. `_setVaultKindMeta` unconditionally calls `reg.setAgentIntegrationMeta(token, meta)`, and for `VaultKind.Agent` sets `meta.nativeAgentVault = params.vault` — the attacker's own vault. A legitimate creator deploying later for the same token (different `baseSalt`, since `owner` differs) finds `getTokenInfo(token).token != address(0)` and is silently skipped by every `info.X == address(0)` guard in the codebase — permanently squatted, with no admin override anywhere in this file to reassign or clear a `registerToken` entry.

**Aggravating consequence (requires the attacker to also complete a real deposit).** The five component fields (`vault`/`wrapper`/`shareOFT`/`gaugeController`/`oracle`) are written only in `_ensureRegistryAndShareOftPeerWired` (lines 1306-1344), called from `finalizePhase2Execution`'s Solana branch — i.e. only after the attacker deposits 50M–100M of `creatorToken`. If they do (e.g. using a real token they've acquired, or their own lookalike token), `Phase3Helper._resolveCreatorOracle` (line 284) later reads `registry.getTokenInfo(token).oracle` and feeds it into the **legitimate creator's own** Charm↔Ajna synergy wiring: `setAssetOracle(attacker's oracle)`, `setAjnaBorrowConfig(true, type(uint256).max, type(uint256).max, 12_500, 0, 0)` — mispricing collateral for the real vault's own borrow backstop. This consequence is demonstrated entirely within this file's own logic (`Phase3Helper`), not speculative about undisclosed downstream contracts.

**Proof of Concept**
```
attacker (any EOA, zero creatorToken balance required for the core squat):
 1. deployPhase1CoreWithSalt({creatorToken: VICTIM_TOKEN, owner: attacker, version: "v1", …}, approvedCodeIds, 0)
 2. finalizePhase1WithSalt(same params)
 3. deployPhase2Core({creatorToken: VICTIM_TOKEN, owner: attacker, vault: <p1 vault>, …}, approvedCodeIds)
       → batcher delegatecalls Phase2Module → reg.registerToken(VICTIM_TOKEN, name, symbol, attacker, 0, 0)
                                              → reg.setAgentIntegrationMeta(VICTIM_TOKEN, {nativeAgentVault: attacker's vault})
 // Registry now permanently maps VICTIM_TOKEN → attacker as registered owner. Total cost: gas for 2 phases, 3 CREATE2 deploys.
 // A later legitimate creator's deploy for VICTIM_TOKEN under owner=creator hits getTokenInfo(VICTIM_TOKEN).token != 0
 // at line 1181 and is silently skipped — their registration never lands.
```

**Fix**
```diff
- if (reg.getTokenInfo(params.creatorToken).token == address(0)) {
-     (string memory name, string memory symbol) = _readTokenMetadata(params.creatorToken);
-     reg.registerToken(params.creatorToken, name, symbol, params.owner, address(0), 0);
- }
+ // Require proof of creatorToken control before writing the canonical registry binding —
+ // e.g. require params.owner == IOwnableView(params.creatorToken).owner(), or gate first-time
+ // registerToken calls behind authorizedPhaseCallers/treasury rather than any self-named caller.
+ _requireCreatorTokenControl(params.creatorToken, params.owner);
+ if (reg.getTokenInfo(params.creatorToken).token == address(0)) {
+     (string memory name, string memory symbol) = _readTokenMetadata(params.creatorToken);
+     reg.registerToken(params.creatorToken, name, symbol, params.owner, address(0), 0);
+ }
```

---

### [70] F-02. CREATE2 codeId allowlist binds to a mutable bytecode-store label, not to bytecode content — the "verify before adopt" reuse checks are tautological no-ops

`DeploymentBatcherPhase1Module._deployOrAdopt` (lines 941–953) · `DeploymentBatcherPhase2Module._deployOrExisting` (lines 1194–1227) · `requireApprovedCodeId`/`approvedCodeIds` (lines 2470–2504) · Confidence: 70

**Description**
The entire CREATE2 reuse/allowlist safety story rests on a `bytes32 codeId` **label**, never a bytecode hash. The real creation bytecode is fetched at deploy time from an external `bytecodeStore.get(codeId)`, whose backing store the code itself treats as only semi-trusted (comment at line 1051-1054 explicitly warns against relying on the CREATE2 factory's own `authorizedDeployers` allowlist). Critically, both "verify an existing CREATE2 occupant before adopting it" implementations recompute the **identical expression twice from the same unchanged state within one call** and compare the two results to each other:
```solidity
// Phase1Module._deployOrAdopt, lines 945-949
bytes32 initCodeHash = _deriveInitCodeHash(codeId, constructorArgs);          // keccak256(store.get(codeId) ++ args)
addr = create2Deployer.computeAddress(salt, initCodeHash);
if (addr.code.length > 0) {
    bytes32 verifyHash = keccak256(bytes.concat(bytecodeStore.get(codeId), constructorArgs)); // identical expression
    if (verifyHash != initCodeHash) revert Phase1StateMismatch();  // can never fire
```
The same pattern recurs in `Phase2Module._deployOrExisting`'s unpublished-hash branch (`publishedHash==0`, lines 1210 vs 1217). The only *genuinely* independent check in the file is Phase2's *published*-hash path (`pendingInitCodeHash`, treasury-set via `setPendingInitCodeHashes`), which compares the store's live value against a value committed **before** this call. Everywhere else, "verified" reuse safety is provided only by CREATE2's own address-binding (an occupant with different bytecode simply couldn't exist at that address under normal deployer behavior) — not by anything this file's comments claim to be checking. If the codeId→bytecode mapping in the external store were ever repointed by an actor distinct from the codeId-approving treasury, the allowlist and the "verify" logic would both silently accept the substitution.

**Proof of Concept** (structural, trust-dependent — not independently confirmable without the bytecodeStore's own access-control source): `setApprovedCodeId(codeId_X, true)` is called by treasury while `bytecodeStore` maps `codeId_X → benignBytecode`. If the bytecodeStore's own owner (a separate external singleton per this file's own comments) later repoints `codeId_X → maliciousBytecode`, `requireApprovedCodeId(codeId_X)` still passes (the label is still approved) and `_deployOrAdopt`/`_deployOrExisting` deploy the new bytecode with no independent detection, since every "verify" step re-derives from the same live, mutable source it's supposedly checking.

**Fix**
```diff
- mapping(bytes32 => bool) public approvedCodeIds;
+ mapping(bytes32 => bytes32) public approvedCodeIdBytecodeHash; // codeId => expected keccak256(creationCode)
  ...
- function setApprovedCodeId(bytes32 codeId, bool approved) external onlyProtocolTreasury {
+ function setApprovedCodeId(bytes32 codeId, bytes32 expectedBytecodeHash) external onlyProtocolTreasury {
      if (codeId == bytes32(0)) revert InvalidCodeId();
-     approvedCodeIds[codeId] = approved;
+     approvedCodeIdBytecodeHash[codeId] = expectedBytecodeHash; // require and check at every deploy site
  }
```
And verify `keccak256(bytecodeStore.get(codeId)) == approvedCodeIdBytecodeHash[codeId]` at every deploy/adopt site, independent of the CREATE2-address-derived hash.

---

### [80] F-03. `finalizePhase2` liveness is hard-coupled to LayerZero→Solana bridge availability — a transient bridge/config gap reverts the entire deposit, vesting, and ownership handoff for every deployment

`DeploymentBatcherPhase2Module.finalizePhase2Execution` (lines 1247–1291) · `_bridgeShareAllocationToSolana` (lines 1347–1377) · Confidence: 80

**Description**
`result.solanaAmount = (shareTokens * 30) / 100` is non-zero for any valid deposit (the deposit floor `MIN_FIRST_DEPOSIT = 50_000_000e18` guarantees this), so the Solana bridge block executes **unconditionally** on every finalize call, with no try/catch and no fallback. It reverts the entire `finalizePhase2Execution` — the deposit pull, the 4-way split, the vesting deploy, and **all six ownership transfers** — if any of: `ovaultRuntimeConfig.enabled==false`, `solanaEid==0`, `solanaDestination==0`, the registry has no OFT peer configured for that Solana EID, or `msg.value` underpays the quoted LayerZero fee. This makes a purely Base-side deployment's completion depend on cross-chain infrastructure health with **no recovery path in this file**: any owner submitting a valid, well-funded `finalizePhase2` during a LayerZero outage, an unconfigured Solana lane, or a treasury-side misconfiguration gets a full revert with no partial-progress option, and must simply retry later. This reaches any unprivileged user through entirely ordinary operational conditions, not just a malicious actor.

Separately (related, narrower): the LZ send options hardcode `DEFAULT_SHARE_BRIDGE_GAS_LIMIT = 200_000` and a `0` native-drop value with no configurability short of a full module hot-swap; if the Solana-side handler needs more compute or the destination token account needs rent-funding, the source-side tokens are already debited with no in-file retry or clawback.

**Proof of Concept**: Treasury has not yet called `setOVaultRuntimeConfig(enabled=true, ...)` for a newly-supported Solana lane, or the LayerZero route to Solana is congested/paused. An owner calls `finalizePhase2` with a valid 50M+ deposit and a correctly-estimated `msg.value` — the call reverts at the Solana block (`SolanaShareBridgeNotConfigured`/`SolanaShareOftPeerNotConfigured`/an LZ-side revert), and the deposit, vesting, and ownership handoff — which have nothing to do with Solana — never happen.

**Fix**
```diff
- if (result.solanaAmount > 0) {
-     IDeploymentBatcherSolanaConfig config = IDeploymentBatcherSolanaConfig(batcher);
-     IDeploymentBatcherSolanaConfig.OVaultRuntimeConfig memory runtime = config.getOVaultRuntimeConfig();
-     _ensureRegistryAndShareOftPeerWired(params, runtime.solanaEid);
-     _bridgeShareAllocationToSolana(params.shareOFT, result.solanaAmount);
- }
+ if (result.solanaAmount > 0) {
+     IDeploymentBatcherSolanaConfig config = IDeploymentBatcherSolanaConfig(batcher);
+     IDeploymentBatcherSolanaConfig.OVaultRuntimeConfig memory runtime = config.getOVaultRuntimeConfig();
+     if (runtime.enabled && runtime.solanaEid != 0) {
+         try this.bridgeSolanaAllocation(params, result.solanaAmount, runtime.solanaEid) {}
+         catch { /* escrow result.solanaAmount for a separate retryable admin/owner call instead of reverting finalize */ }
+     }
+ }
```
(Illustrative — the concrete fix is to decouple core finalization from the cross-chain send: escrow-and-retry rather than revert-everything.)

---

### [80] F-04. Fee-on-transfer or otherwise non-standard `creatorToken` permanently bricks Phase-2b finalize with no recovery path

`DeploymentBatcherPhase2Module.finalizePhase2Entry` (line 1461) · `finalizePhase2Execution` (lines 1253–1254) · `DeploymentBatcher.resetPhase1State` (lines 2551–2566) · Confidence: 80

**Description**
The deposit path never measures a balance delta — it uses the nominal `params.depositAmount` throughout: `safeTransferFrom(msg.sender, address(this), depositAmount)` (line 1461), then `forceApprove(wrapper, depositAmount)` and `wrapper.deposit(depositAmount)` (lines 1253-1254). `creatorToken` is a fully arbitrary, permissionless, creator-chosen ERC20 with no allowlist anywhere in this file. If it is fee-on-transfer (or otherwise delivers less than the nominal amount), the batcher receives `depositAmount·(1−fee)` but `wrapper.deposit(depositAmount)` still attempts to pull the full nominal amount from the batcher's own balance and reverts (insufficient balance). Because Phase 1 is already `finalized` by the time Phase 2b runs, `resetPhase1State` explicitly refuses to clear finalized state (`if (state.finalized) revert Phase1AlreadyFinalized()`, line 2562) — **there is no path in this file to recover that `(creatorToken, owner, version)` tuple.** The deployment is permanently stuck: not because of an attacker, but because a creator's own token choice is incompatible with an unstated assumption.

**Proof of Concept**: A creator deploys with a 2%-fee-on-transfer `creatorToken`. Phase 1 and Phase 2a complete normally (no token movement). At `finalizePhase2`, `safeTransferFrom` delivers `depositAmount·0.98` to the batcher; `wrapper.deposit(depositAmount)` then reverts on insufficient balance. Every subsequent finalize attempt reverts identically. `resetPhase1State` cannot help (Phase 1 is finalized). The `(creatorToken, owner, version)` tuple is permanently un-launchable.

**Fix**
```diff
+ uint256 balanceBefore = IERC20(params.creatorToken).balanceOf(address(this));
  IERC20(params.creatorToken).safeTransferFrom(msg.sender, address(this), params.depositAmount);
+ uint256 received = IERC20(params.creatorToken).balanceOf(address(this)) - balanceBefore;
  ...
- IERC20(params.creatorToken).forceApprove(params.wrapper, params.depositAmount);
- uint256 shareTokens = IOVaultWrapper4626(params.wrapper).deposit(params.depositAmount);
+ IERC20(params.creatorToken).forceApprove(params.wrapper, received);
+ uint256 shareTokens = IOVaultWrapper4626(params.wrapper).deposit(received);
```

---

### [65] F-05. Batcher's permanent `management` retention lets a self-named vault owner install strategies and obtain a live Charm `rebalanceDelegate` role beyond their direct vault permissions

`DeploymentBatcher.deployPhase3Strategies` (lines 2335–2378) · `DeploymentBatcherPhase3Helper._deployCharmPipeline` (line 313) · Confidence: 65

**Description**
`finalizePhase2Execution` transfers vault *ownership* to `params.owner` but never *management* — `Phase3Helper` asserts `vault.management() == batcher` (line 168), confirming this retention is permanent by design so Phase 3 can keep functioning. `addStrategy`/`setAutoAllocate` are management-gated on the vault (the owner cannot call them directly), so `deployPhase3Strategies` effectively lends the batcher's management authority to whoever merely proves `vault.owner() == params.owner` — installing allowlisted-codeId strategies up to 100% cumulative weight, and toggling `setAutoAllocate(true)`, on the owner's behalf. Additionally, the newly-created Charm vault is configured with `rebalanceDelegate: params.owner` (line 313) — handing the self-named, otherwise-unprivileged owner a live operational role (triggering Charm range rebalances) over protocol-owned LP. `params.creatorToken` used to build the strategy pipeline is never cross-checked against the vault's actual underlying asset.

**Proof of Concept**: The vault's true owner calls `deployPhase3Strategies({vault: myVault, creatorToken: X, owner: me, charmWeightBps: 10000, ...}, allowlistedCodeIds)` where `X` is not `myVault`'s real asset. The batcher — acting as management, an authority the owner does not themselves hold — installs an `X`-denominated strategy at 100% weight on `myVault`, an action the owner could never perform by calling the vault directly. Separately, the owner becomes Charm `rebalanceDelegate` on a freshly-created Charm vault and can now time rebalances to their advantage within Charm's TWAP-deviation bounds (±5% over a 300s window).

**Fix**: Bind `params.creatorToken` to the vault's actual configured asset (revert on mismatch) before invoking the Charm/Ajna pipeline, and reconsider granting `rebalanceDelegate` to `params.owner` rather than a protocol-controlled address — or document the resulting operational-risk delegation explicitly as intended design.

---

### [70] F-06. Deposit-size guard is asset-denominated while every downstream consumer is share-denominated, and both hardcode an 18-decimal assumption

`DeploymentBatcherPhase2Module._validateFinalizePhase2` (line 1412) · `MIN_FIRST_DEPOSIT`/`MAX_FIRST_DEPOSIT` (lines 967–968) · Confidence: 70

**Description**
The only size guard on `finalizePhase2` is `depositAmount ∈ [50_000_000e18, 100_000_000e18]`, denominated in **creatorToken (asset)** units. Every downstream quantity — the 30/30/30/remainder split, the amount bridged to Solana, the vesting grant, the LP-reserve transfer, and the recorded pending-auction amount — is instead computed from `shareTokens = wrapper.deposit(depositAmount)`, a **share**-denominated value. `creatorToken.decimals()` is never queried anywhere in this file, so the 18-decimal-denominated bound silently mis-sizes the "validated 50M–100M token" economic floor for any non-18-decimal creator token: a 6-decimal token can never satisfy the floor (permanently un-deployable), while a >18-decimal token satisfies the "50M-token minimum" with a trivially small real quantity (e.g. a 24-decimal token needs only ~50 whole tokens).

**Note on scope of this finding — a more severe variant was investigated and refuted.** An initial hypothesis (that PPS manipulation via direct-donation to the vault before finalize could drive `shareTokens` to exactly zero — passing the asset-denominated guard while producing zero allocations everywhere downstream, with ownership still transferring away irreversibly) was checked against the actual out-of-scope vault source (`contracts/creator/vault/CreatorOVault.sol`). That vault correctly implements OpenZeppelin's standard ERC4626 virtual-shares inflation-attack mitigation: `_decimalsOffset() = 3` (1000 virtual shares) plus its own `MINIMUM_FIRST_DEPOSIT = 50_000_000e18` re-check (lines 154–184, 2342–2355 of that file). Per the vault's own security comment, an attacker would need to donate roughly 1000× the deposit amount to zero out `shareTokens` — "economically unfeasible." **This more severe scenario is refuted and not included as a finding.** The residual, real issue is the narrower unit/decimals mismatch described above.

**Proof of Concept**: A 6-decimal creator token: "50M tokens" = `50_000_000e6 = 5e13` raw units, far below `MIN_FIRST_DEPOSIT = 5e25` — no valid `depositAmount` exists, so the token can never be finalized. A 24-decimal creator token: `MIN_FIRST_DEPOSIT = 5e25` raw = only 50 whole tokens — the "50M-token minimum-liquidity" guarantee the comment claims is satisfied by 50 tokens, a six-order-of-magnitude under-shoot.

**Fix**
```diff
+ uint8 decimals = IERC20Metadata(params.creatorToken).decimals();
+ uint256 minDeposit = MIN_FIRST_DEPOSIT / 1e18 * (10 ** decimals);
+ uint256 maxDeposit = MAX_FIRST_DEPOSIT / 1e18 * (10 ** decimals);
- if (params.depositAmount < MIN_FIRST_DEPOSIT || params.depositAmount > MAX_FIRST_DEPOSIT) {
+ if (params.depositAmount < minDeposit || params.depositAmount > maxDeposit) {
      revert InvalidDepositAmount();
  }
```

---

## Centralization / Privileged-Role Risks

These require a treasury-controlled action (or key compromise) to realize — they are not exploitable by an unprivileged actor on their own, so they are reported separately from the Findings above rather than confidence-scored as exploits. They matter for evaluating the protocol's trust model.

- **Module hot-swap + permanent vault `management` retention (Low/operational).** `setPhase1Module`/`setPhase2Module` swap delegatecall targets with only a treasury-approved `extcodehash` match, no timelock. Because the batcher shell retains permanent `management` over every vault it ever deploys (by design, so Phase 3 keeps working), a compromised or malicious treasury that swaps in a hostile module gains the ability to call management-gated functions (e.g. `addStrategy`) on every already-deployed vault protocol-wide, not just future ones. *Recommendation: timelock module swaps; consider a path to relinquish `management` per-vault once Phase 3 configuration is complete.*
- **Solana bridge destination is the only finalize recipient not bound against redirection (Low/operational).** `_validateFinalizePhase2` deliberately binds `gaugeController`/`ccaLaunchArm`/`oracle` to the vault's own on-chain wiring ("blocks diverted LP reserve," per its own comment) — but `solanaDestination`/`ovaultRuntimeConfig` are read live from mutable treasury-controlled globals with no per-deployment commitment field, so a treasury change to `setSolanaDestination` between a depositor's review and their `finalizePhase2` call redirects that deployment's 15M–30M bridged shares with no slippage floor. *Recommendation: add an `expectedSolanaDestination`/`expectedSolanaEid` field to `Phase2FinalizeParams` and equality-check it, mirroring the existing recipient-binding pattern.*
- **`codeIdAllowlistEnabled` is togglable and not yet frozen on-chain (Low).** Confirmed live: `enabled=true`, `frozen=false`. While enabled this gates all CREATE2 deploys; treasury can disable it instantly with no timelock (though `freezeCodeIdAllowlist()` — a one-way ratchet — exists and is simply not yet called). *Recommendation: call `freezeCodeIdAllowlist()` in production.*
- **`wireDeploymentHelpers` validates codehash/identity for only 1 of the 4 helpers it installs (Low).** `setPhase2Module`/`setPhase1Module` both enforce `_validatePhaseModuleCodehash` + a `batcher()` back-reference check; `wireDeploymentHelpers` applies this only to `_phase2Module`, installing `_phase3Helper`/`_shareMeshHelper`/`_utilsHelper` with a bare zero-address check. Their outputs feed directly into privileged operations (`phase3Helper`'s returned strategies flow into management-authority `addStrategy` calls; `utilsHelper` computes every CREATE2 salt and Phase-1 idempotency hash). *Recommendation: apply the same validation to all four helpers on this path.*
- **`protocolTreasury` is immutable with no rotation path anywhere, and three independently-constructed copies (shell, Phase2Module, Phase3Helper) are never cross-checked for equality (Info).** Key loss permanently blocks all admin/maintenance; key compromise has no revocation path. *Recommendation: assert the three copies match at deploy/wiring time; consider a two-step rotation mechanism.*
- **`authorizedPhaseCallers[x]` is an unbounded, full owner-impersonation role (Info).** No self-grant path was found (treasury-only setter) — recorded as a trust-boundary note, not an exploit.
- **Delegatecall-module codehash is validated only at hot-swap/registration time, never re-checked at each delegatecall (Info/hardening).** Not currently exploitable — neither module contains `selfdestruct`, and Base is post-Cancun (closing the classic CREATE2+selfdestruct metamorphic-redeploy vector) — but the codehash machinery's own purpose is undermined by not re-asserting at use time.

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path could not be completed in one analysis pass, or which depend on out-of-scope source. Not scored._

- **Stuck deferred-auction flag has no admin recovery** — `DeploymentBatcher.hasActivePendingAuction`/`launchDeferredAuction` — Code smells: version-independent lock set in `_recordFinalizePhase2Effects`, cleared only by a successful CCA auction launch; `resetPhase1State` explicitly does not touch it and cannot run post-finalize. If a CCA becomes permanently unable to launch, every future-version finalize for that (token, owner) reverts forever with no treasury escape hatch, unlike the symmetric recovery that exists for stuck Phase-1 state.
- **`deployPhase2CoreWithRolePolicy` lets the caller choose the policy ID** — `DeploymentBatcher.sol:2142-2172` — Code smells: both the default and "policy-aware" variants share the same treasury-configured `vaultRolePolicyManager`; only the policy *id* differs and it is caller-supplied, so a caller can pick a permissive/no-op id, nullifying the apparent gate.
- **Charm `rebalanceDelegate` granted to the untrusted creator** (see F-05) — needs the deployed Charm factory's exact `rebalanceDelegate` powers (not vendored in this checkout) to size the impact beyond range-placement timing.
- **Unlimited Ajna borrow ceilings in the Charm↔Ajna synergy wiring** — `Phase3Helper._wireCharmAjnaSynergy`, `setAjnaBorrowConfig(true, type(uint256).max, type(uint256).max, 12_500, 0, 0)` — only the 125% collateral ratio constrains borrowing; needs Charm/Ajna source to assess whether the ratio alone is an adequate backstop.
- **ShareMesh readiness gate reads only 3 of a 17-field CCA lifecycle tuple** — `ShareMeshHelper.deployShareMeshLpManager`, omits `failedFinalized`/`unsoldSwept` — needs CCA source to prove the checked/unchecked flag combinations are mutually exclusive.
- **Permissionless pre-creation of the shared Uniswap-V3/Ajna pools** — a third party can create and price the global `(creatorToken, usdc)` V3 pool or Ajna pool before the legitimate creator's Phase 3 runs, which then silently adopts the existing pool with no re-validation of its price/parameters. Shares root cause with F-01.
- **Silent `try/catch{}` swallow on `setModulesOnce` in the vault-adopt path** — `Phase1Module.deployPhase1Core`, lines 797-800 — depends on out-of-scope `IOVault4626.setModulesOnce` access control; likely benign since the adopted vault's constructor pins `owner=batcher`, but the swallow removes the only place a mis-wired occupant could be detected.
- **Registry ground-truth component writes are a side-effect of the Solana-bridge branch**, not an unconditional step of vault deployment — latent only (not reachable today since `SOLANA_ALLOC_PERCENT=30` guarantees `solanaAmount>0` for any valid deposit), but fragile if that constant is ever changed via module hot-swap.
- **Mid-function unbounded-gas refund `.call` in the Solana bridge path**, executing before vesting/ownership transfers — checked by four independent agents (boundary, execution-trace, flow-gap-hunter, economic-security) and confirmed **not exploitable today** (the whole call chain sits under the shell's single shared `nonReentrant` lock; every other mutator is `onlyProtocolTreasury`) — recorded because it is one un-guarded future entrypoint away from a live drain window.

---

## Access-Control Inventory

| Contract.function | Guard | Who can call | Moves value? |
|---|---|---|---|
| Shell: `deployPhase1CoreWithSalt`, `finalizePhase1WithSalt`, `deployPhase2Core`, `deployPhase2CoreWithRolePolicy`, `launchDeferredAuction`, `deployPhase3Strategies`, `deployShareMeshLpManager` | `_requireOwner` (self-named `params.owner` or treasury-granted `authorizedPhaseCallers`), `nonReentrant` | Any address naming itself as owner, or an authorized caller for any owner | No |
| Shell: `finalizePhase2`, `finalizePhase2WithPermit2` | `_requireOwner`, `nonReentrant`, `payable` | Same | **Yes** — pulls creatorToken, bridges native fee |
| Shell: 15 admin functions (module hot-swap, codeId allowlist, Solana config, role-policy config, `resetPhase1State`, `setAuthorizedPhaseCaller`, payout-router whitelisting) | `onlyProtocolTreasury` | `protocolTreasury` only (immutable, no rotation) | No |
| Shell: `requireApprovedCodeId`, `getOVaultRuntimeConfig` + auto getters | none (`view`) | Anyone | No |
| `Phase1Module.deployPhase1Core`/`finalizePhase1Split` | `NotBatcherContext` (delegatecall-only) | Reachable only via shell's `_requireOwner`-gated entrypoints | No |
| `Phase2Module.deployPhase2CoreOrchestrator`/`finalizePhase2*`/`launchDeferredAuctionExecution` | `NotBatcherContext` (delegatecall-only) | Same | `finalizePhase2*`: yes |
| `Phase2Module.setPendingInitCodeHashes` | `msg.sender==protocolTreasury` (module's own immutable copy), called directly (not delegatecall) | `protocolTreasury` | No |
| `Phase3Helper.deployPhase3Strategies` | `NotBatcher` (`msg.sender==batcher`) | Shell only | No (deploys/reassigns ownership of strategy contracts) |
| `ShareMeshHelper.deployShareMeshLpManager` | `NotBatcher` | Shell only | No |
| `UtilsHelper` (8 functions) | none, `pure` | Anyone | No |

**Roles**: `protocolTreasury` — immutable, no setter/rotation anywhere (independently constructed in shell + Phase2Module + Phase3Helper, never cross-checked equal). `authorizedPhaseCallers[addr]` — treasury-settable, grants full owner-impersonation for the 9 owner-gated entrypoints. `approvedPhaseModuleCodehashes`/module hot-swap — treasury sets an expected `extcodehash`, checked only at swap time. `codeIdAllowlistEnabled` (default true, toggleable unless `codeIdAllowlistFrozen`, a one-way ratchet — confirmed live: enabled, not frozen).

**Unguarded/self-service mechanism**: all 9 owner-gated entrypoints authenticate "you are who you claim" (`msg.sender==params.owner`, a caller-supplied value), not "you are entitled to this token/vault." This is the root mechanism behind Finding F-01.

---

## Threat Model

| Actor | Reaches | Could gain | Status |
|---|---|---|---|
| Any self-named "owner" | All 9 owner-gated entrypoints | Deploy/register for a token they don't legitimately control | **Addressed by F-01** (registry squatting confirmed exploitable; CREATE2 address isolation itself confirmed sound — owner is baked into every salt) |
| `authorizedPhaseCallers[x]` | Same 9 entrypoints, for any owner | Full impersonation authority | Addressed — no self-grant path found (treasury-only); realized impact folded into F-05 (Phase 3 confused-deputy) |
| Attacker controlling caller-supplied `params.vault`/`ccaLaunchArm` | Phase3Helper/ShareMeshHelper black-box calls | Pass gating checks with a mock contract | Addressed — Lead (no demonstrated protocol harm from this file alone; baseSalt isolation prevents cross-owner collision) |
| `protocolTreasury` (immutable, no rotation) | All admin/module-hotswap/codeId-allowlist authority | Full config authority; if compromised, no recovery | Addressed — see Centralization/Privileged-Role Risks section |
| Reentrant callee during `finalizePhase2Execution` | Any external call inside the `nonReentrant`-locked delegatecall chain | Re-enter a state-changing path | **Invariant holds** — confirmed safe by 4 independent Phase-2 agents; every mutator is either `nonReentrant` (shared shell lock) or `onlyProtocolTreasury` |
| Solana bridge refund path | Unbounded-gas `.call{value:surplus}` mid-function | Reenter before ownership transfers | **Invariant holds** — see Lead above; contained today, flagged as fragile |
| Anyone (unbounded array) | `ShareMeshHelper.hooksToApprove` loop | Gas-grief their own tx | Addressed — self-inflicted only, no finding |
| `codeIdAllowlistEnabled==false` window | Every CREATE2 deploy path | Deploy unapproved bytecode | Addressed — see Centralization/Privileged-Role Risks (Low, not yet frozen on-chain) |

---

> ⚠️ This review was performed by an AI-orchestrated audit pipeline (context-mapping + breadth checklists + attacker-mindset depth agents, cross-reconciled). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human review, a bug bounty program, and on-chain monitoring are strongly recommended before and after mainnet operation at scale, particularly given F-01's registry-squatting mechanism and the centralization risks noted above.
