# 🔐 Security Review — DeploymentBatcher 4626 CREATE2 Orchestrator (Phase1/Phase2 Modules)

**Job:** leftclaw.services #429 · **Client focus:** privilege, CREATE2 address/salt reuse, init-code
hash validation, Phase trust boundaries.

## Scope

| | |
|---|---|
| **Mode** | Client-supplied source-of-truth markdown bundle (`https://litter.catbox.moe/lrsfsn.md`), audited against live Base-mainnet (chain 8453) addresses |
| **DeploymentBatcher** (main) | `0xa18169caf37fa0347285B16aAFC2B09eCB43F145` |
| **DeploymentBatcherPhase1Module** | `0x33ABACC30a4179444d9d565245561B3988650bF5` |
| **DeploymentBatcherPhase2Module** | `0xC3Af8F49492Db7Ba0B851F3A16c13CCAa94af9Ad` |
| **protocolTreasury** (on-chain confirmed) | `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` |
| **Files reviewed** | `contracts/shared/deploy/batchers/DeploymentBatcher.sol` — single file, 2564 lines, six contracts: `DeploymentBatcherPhase3Helper` · `DeploymentBatcherShareMeshHelper` · `DeploymentBatcherUtilsHelper` · `DeploymentBatcherPhase1Module` · `DeploymentBatcherPhase2Module` · `DeploymentBatcher` |
| **Methodology** | Three-phase: (0) context — protocol map + ~85-entrypoint access-control inventory + threat catalog (3 opus agents) → (1) breadth — 8 ethskills domain checklists (opus) → (2) depth — 12 pashov attack agents, blind to phase-1 (opus) → reconcile |
| **Confidence threshold** | 50 |

**On-chain wiring verified consistent with the supplied source** at audit time: both modules'
`extcodehash` match `approvedPhaseModuleCodehashes`; `phase1Module`/`phase2Module` both report
`batcher()==` the shell; `codeIdAllowlistEnabled==true`, `codeIdAllowlistFrozen==false`,
`vaultRolePolicyManager==0` (inert), `solanaDestination` non-zero. This is an independent, from-scratch
run per engagement terms — every finding below comes from this job's own phase 0/1/2 agents re-reading
the current source, not from any prior report.

---

## Reconciliation summary

Overlap (both phases, same root cause): **3** clusters (the CREATE2 reuse/writer-set defect, the
squatting-DoS on vault/wrapper, and the helper-hot-swap parity gap) · Phase-1-only: **6** · Phase-2-only:
**8** (1 promoted to Finding via source re-verification; the headline finding itself is
phase-1-**and**-phase-2, corroborated by 3 phase-1 agents + 9 of 12 phase-2 agents — the strongest
convergence observed across either of this auditor's jobs to date) · Re-examined leads kept: **4**,
demoted: **0** · Coverage holes closed this pass: **0**.

---

## Access-Control Inventory (condensed)

**~85 external/public functions**, all inventoried (full detail in phase-0 transcripts). `protocolTreasury`
is a **permanent immutable single key** — no transfer, renounce, or timelock function exists anywhere
in scope — gating all 14 config setters, the phase-module hot-swap, and the codeId allowlist. Ordinary
deploy entrypoints (`deployPhase1CoreWithSalt`, `finalizePhase1WithSalt`, `deployPhase2Core(...)`,
`finalizePhase2(...)`, `launchDeferredAuction`, `deployPhase3Strategies`, `deployShareMeshLpManager`) are
gated by `_requireOwner(params.owner)` — caller-asserted (`msg.sender==owner`) or delegated via
`authorizedPhaseCallers` — examined and confirmed **not** exploitable for cross-user impersonation:
salts/state are owner-scoped and Phase3/ShareMesh independently re-verify `vault.owner()==params.owner`.

Phase1/Phase2 core logic runs via `delegatecall` into two module contracts that are, notably,
**stateless under delegatecall** (Phase1Module has zero mutable storage; Phase2Module's one storage
variable, `pendingInitCodeHash`, is written/read only via direct/external self-calls on the module's own
address, never through the delegatecall context) — independently re-derived and confirmed by 2 separate
agents with **no storage-collision surface**, unlike some prior admin-module patterns this auditor has
reviewed. `phase3Helper`/`shareMeshHelper`/`utilsHelper` hot-swap with **no codehash validation** (only
phase1/phase2 modules get that check via `_validatePhaseModuleCodehash`) — an asymmetry that matters
because `utilsHelper` computes the storage keys (`baseSalt`) the whole system indexes by.

**Unguarded (arbitrary caller) state-changing entrypoints:** effectively none in the traditional sense
(see coverage gate below for the one deliberate direct-callable exception, `setPendingInitCodeHashes`).

---

## Threat Model

| Actor | Reaches | Could gain | Status |
|---|---|---|---|
| Any address on the **external CREATE2 factory's `authorizedDeployers` allowlist** (treasury does not manage this set) | `Phase2Module.setPendingInitCodeHashes` directly, plus the ability to deploy arbitrary bytecode via the factory | Substitute malicious gauge/cca/oracle into any pending phase-2 deployment, OR grief/DoS any pending deployment | **Addressed by [C1] below — this is the audit's headline finding** |
| Compromised/malicious `protocolTreasury` | Every config setter, module hot-swap, codeId approval | Full protocol capture (no timelock defends against this anywhere in scope) | Disclosed as a structural fact (out of scope to "fix" without a governance redesign); not separately scored as it is by-design admin trust |
| External CREATE2 bytecode-store operator | `codeId → bytecode` resolution | Substitute bytecode under an approved `codeId` | Out-of-scope dependency; disclosed |
| Creator/launcher (`params.owner`, self-asserted) | Full phase 1/2/3 deploy surface for their own identity | Deploy with adversarial params within allowed codeIds/bounds; **repeat `deployPhase3Strategies` with disjoint weights** | **Addressed by [M1] below** for the weight-accumulation gap; other self-scoped params examined, forced-parameter constraints hold |
| Anyone able to CREATE2 at a predicted, fully-public salt (squatting) | Vault/wrapper deploy addresses | Front-run and permanently DoS a `(creatorToken, owner, version)` tuple's core deployment | **Addressed by [L1] below** |
| Treasury (via `resetPhase1State`) | Clears stuck, non-finalized Phase-1 state | Re-attempt a deployment | Examined — does not affect finalized state or active pending auctions; a genuine but narrower recovery gap for stuck pending auctions is captured as a Lead |

Coverage: **6 threat-catalog rows, 6 addressed.** Entrypoints: **~85 in inventory, ~85 addressed.**
Holes closed this pass: **0**.

---

## Findings

[95] **1. CREATE2 reuse path adopts pre-existing code at a predicted address with no bytecode-integrity check, and the steering hash is writable by an external, treasury-unmanaged allowlist**

`DeploymentBatcherPhase2Module._deployOrExisting` / `setPendingInitCodeHashes` · Confidence: 95 · **Severity: Critical**

**Description**

Verified at `DeploymentBatcher.sol:1159-1190`:

```solidity
bytes32 publishedHash = DeploymentBatcherPhase2Module(moduleSelf).pendingInitCodeHash(salt);
bytes32 resolvedHash = publishedHash;
if (resolvedHash == bytes32(0)) {
    ... // legacy path: derive from store
}
addr = create2Deployer.computeAddress(salt, resolvedHash);
if (addr.code.length > 0) {
    return addr;                              // <-- NO integrity check on this branch
}
// Optional integrity: if a hash was published, redeploy must match it.
if (publishedHash != bytes32(0)) {
    bytes memory creationCode = IUniversalBytecodeStoreView(storeAddr).get(codeId);
    if (keccak256(bytes.concat(creationCode, constructorArgs)) != publishedHash) {
        revert InitCodeHashMismatch();
    }
}
```

The integrity check (comparing the resolved hash against the store's *actual* bytecode for the
requested `codeId`) runs **only** when the predicted address is still empty. When code already exists
there, it is accepted verbatim as "the deployment" with zero verification that it corresponds to the
treasury-approved `codeIds.gauge`/`codeIds.cca`/`codeIds.oracle`.

The hash that determines the predicted address, `pendingInitCodeHash[salt]`, is writable
(`setPendingInitCodeHashes`, `DeploymentBatcher.sol:1025-1034`, called directly on the module — not via
delegatecall) by:

```solidity
if (msg.sender != protocolTreasury && !create2Deployer.authorizedDeployers(msg.sender)) {
    revert NotAuthorizedInitCodeHashWriter();
}
```

The second clause delegates a security-critical write to an **external CREATE2 factory's own
allowlist** — a set this contract neither owns, manages, nor can enumerate. This is strictly broader
than every other privileged surface in the contract, all of which are `protocolTreasury`-only.

**Proof of Concept** (attacker = any address on `create2Deployer.authorizedDeployers`, targeting a
known/pending `(creatorToken, owner, version)` tuple):

1. Salts are fully public and deterministic: `baseSalt = keccak256(creatorToken, owner, 8453, "4626:deploy:", version)` (`deriveBaseSalt`), `gaugeSalt = keccak256(baseSalt, "gauge")` (and similarly for `cca`/`oracle`).
2. Attacker deploys attacker-controlled bytecode via the external factory at `computeAddress(gaugeSalt, H)` for a hash `H` of their choosing (any `codeId` the store will resolve for them, or a fresh registration).
3. Attacker calls `phase2Module.setPendingInitCodeHashes([gaugeSalt, ccaSalt, ...], [H, ...])` — permitted as an authorized deployer.
4. Victim (or anyone, since deploy entrypoints are permissionless-per-owner) calls `deployPhase2Core(...)`. Inside `_deployOrExisting(gaugeSalt, codeIds.gauge, gaugeArgs)`: `resolvedHash = H`; `addr = computeAddress(gaugeSalt, H)` = the attacker's contract; `addr.code.length > 0` → returned **without ever consulting `codeIds.gauge`'s real bytecode**.
5. The batcher wires the attacker's contract as the vault's `gaugeController`, and/or as `ccaLaunchArm` and `oracle` (`DeploymentBatcher.sol:1125-1147`). At `finalizePhase2Execution`, 10% of the minted share supply is transferred to `ccaLaunchArm` (line 1225); later, `launchDeferredAuction` routes the retained 30% auction reserve through it as well (line 1357-1359) — up to **~40% of a launch's share supply** flows to attacker-controlled contracts, and a malicious oracle can additionally drive the CCA's launch floor toward zero to let the attacker acquire the auctioned reserve for a fraction of its value.
6. The same mechanism, used purely destructively (publish a mismatching hash with no code at the target address), forces `InitCodeHashMismatch` and bricks `deployPhase2Core` for that tuple indefinitely — a cheap, repeatable griefing primitive requiring only the treasury clearing the poisoned entry each time.

**Verification/corroboration:** independently found and gate-cleared as a FINDING by **9 of 12** blind
Phase-2 attack agents (access-control, economic-security, execution-trace, invariant, periphery,
first-principles, asymmetry, boundary, trust-gap) and, independently, by **3 of 8** Phase-1 checklist
agents (general, access-control, dos) — 12 of 20 total hunting agents across both phases converged on
this exact mechanism from independent angles. This is the strongest multi-agent convergence in either
of this auditor's two most recent engagements.

**Fix**

```diff
     addr = create2Deployer.computeAddress(salt, resolvedHash);
     if (addr.code.length > 0) {
-        return addr;
+        // Always re-verify the reused address's code matches the approved codeId's
+        // real bytecode before trusting it — do not exempt the "already deployed" branch.
+        bytes memory creationCode = IUniversalBytecodeStoreView(storeAddr).get(codeId);
+        bytes32 realHash = keccak256(bytes.concat(creationCode, constructorArgs));
+        if (realHash != resolvedHash) revert InitCodeHashMismatch();
+        return addr;
     }
```
Additionally, restrict `setPendingInitCodeHashes` to `protocolTreasury` only (drop the
`create2Deployer.authorizedDeployers(msg.sender)` clause) so the write authority for a value that
steers core protocol wiring sits entirely inside the treasury trust boundary rather than an external,
unmanaged allowlist.

---

[80] **2. `deployPhase3Strategies` has no cumulative weight tracking — repeated calls can push a vault's total strategy allocation past 100%**

`DeploymentBatcher.deployPhase3Strategies` / `Phase3Helper.deployPhase3Strategies` · Confidence: 80 · **Severity: Medium**

**Description**

Verified at `DeploymentBatcher.sol:172-174` (inside `Phase3Helper`):
```solidity
if (params.charmWeightBps > 10_000 || params.ajnaWeightBps > 10_000) revert InvalidWeight();
uint256 totalProductiveWeight = params.charmWeightBps + params.ajnaWeightBps;
if (totalProductiveWeight == 0 || totalProductiveWeight > 10_000) revert InvalidWeight();
```
This bound is checked **per call only**. Nothing in `DeploymentBatcher` (the outer shell,
`sol:2298-2320`) or `Phase3Helper` tracks a running total of weight already allocated to the vault
across multiple invocations. Because `vault.management()` remains the batcher after `finalizePhase2`
(only vault *ownership* transfers to the creator), the owner remains authorized to call
`deployPhase3Strategies` repeatedly, and because Charm and Ajna strategies use distinct CREATE2 salts
(`saltFor(baseSalt, "charmStrategyV3")` vs. Ajna-specific labels), a second call allocating a
*different* sleeve does not collide with the first.

**Proof of Concept**:
1. Owner calls `deployPhase3Strategies({charmWeightBps: 10_000, ajnaWeightBps: 0, ...})`. Per-call check: `10_000 ≤ 10_000` ✓. Charm strategy deployed; `vault.addStrategy(charmStrategy, 10_000)`.
2. Owner calls `deployPhase3Strategies({charmWeightBps: 0, ajnaWeightBps: 10_000, ...})` again. Charm branch is skipped (no CREATE2 collision since `charmWeightBps==0`); Ajna's salts were never touched by call 1, so they deploy cleanly. Per-call check: `10_000 ≤ 10_000` ✓. `vault.addStrategy(ajnaStrategy, 10_000)`.
3. The vault now carries `20_000` bps (200%) of allocated strategy weight — double the intended cap — with every individual boundary check having passed.

**Fix**

Track cumulative strategy weight per vault on the batcher side (e.g. a
`mapping(address vault => uint256 totalWeightBps)` incremented on each successful `addStrategy` call
and checked against `10_000` before allowing a new allocation), or read the vault's own aggregate
weight via a view function if one exists, and reject any call whose *cumulative* total would exceed
the cap. Alternatively, record a per-`baseSalt` "phase3 done" flag and reject re-entry into
`deployPhase3Strategies` entirely once any strategy has been added.

---

[55] **3. Vault/wrapper CREATE2 deployment has no adopt-existing fallback, unlike the ShareOFT path — enabling front-run squatting DoS**

`DeploymentBatcherPhase1Module.deployPhase1Core` · Confidence: 55 · **Severity: Medium** (escalates to
High if the external `create2Deployer.deploy()` is callable by an unrestricted set of addresses rather
than a tightly-held `authorizedDeployers` list — unverifiable from this file)

**Description**

Verified at `DeploymentBatcher.sol:794` and `:798`: the vault and wrapper are deployed with bare,
unguarded `create2Deployer.deploy(salt, codeId, args)` calls. By contrast, the ShareOFT deployment in
`finalizePhase1Split` (`:852-869`) deliberately wraps its `deploy()` call in a `try/catch` and, on the
"already exists" revert, adopts the existing address after verifying its bytecode hash and that its
bound `vault()` is unset-or-self. Vault and wrapper have no equivalent fallback: `salt`/args are fully
public (derived from `creatorToken`, `owner`, `chainId`, `version`, and fixed labels), so any address
able to call the external factory's `deploy()` can pre-occupy the predicted vault/wrapper address with
byte-identical init code before the legitimate deployer's transaction lands, causing that transaction
to revert on the now-occupied CREATE2 address. Recovery requires bumping `version` (a fresh salt), which
is itself front-runnable again by the same actor.

Note this is *not* a hijack vector — a different bytecode/args combination yields a *different*
CREATE2 address, so an attacker cannot redirect the vault to malicious code this way, only squat and
block the legitimate one.

**Fix**

Apply the same deploy-or-adopt pattern already used for the ShareOFT: wrap the vault/wrapper `deploy()`
calls in `try/catch`, and on the "already exists" branch, verify the existing contract's init-code hash
against the store-derived value (and any owner/binding invariant) before adopting it, rather than
reverting.

---

## Leads

_Trails with concrete code smells where either the exploitability depends on an unverifiable
external-store/factory convention, or the trigger is owner/treasury-gated with no unprivileged
amplifier — high-signal for manual review, not scored findings._

- **`deployPhase1Core`'s OFT-bootstrap-registry address may be miscomputed** —
  `create2Deployer.computeAddress(oftBootstrapSalt, codeIds.oftBootstrap)` (`DeploymentBatcher.sol:788`)
  passes a `codeId` label where the interface expects a real init-code hash; every other CREATE2 path
  in the file (including this same function's own ShareOFT logic) derives the hash as
  `keccak(store.get(codeId) ++ args)` instead. This is only correct if the external bytecode store is
  content-addressed (`codeId == keccak(creationCode)`) for this specific, empty-constructor-arg
  template. Since `oftBootstrapSalt` is a **global constant** (not per-deployment), if the assumption
  is false, the computed address never matches the real deployment address, and — because the
  existence check reads the wrong (permanently empty) address — every Phase-1 deployment after the
  very first would attempt to redeploy the shared singleton and revert, a full-system Phase-1 DoS; the
  wrong address would also be persisted and baked into every ShareOFT's constructor args. Independently
  raised by **6 of 12** Phase-2 agents (access-control, execution-trace, invariant, periphery,
  first-principles, asymmetry) — very strong convergence, but resolution requires the external store's
  addressing convention, which is out of scope. **Flagged for the client to confirm immediately**,
  regardless of whether the live system has processed more than one Phase-1 deployment yet.
- **Tautological "integrity" check in the ShareOFT adopt path** — `finalizePhase1Split`
  (`shareOftInitCodeHash` at line 851 vs. `verifyHash` at line 862) computes the identical
  `keccak(store.get(codeId) ++ args)` expression twice from the same store in the same transaction, so
  the comparison at line 863 can never fail. Not itself exploitable (the real protection is the CREATE2
  address derivation plus the vault-binding check), but it is a false-safety signal that would mask a
  real regression if the two hash-derivation paths ever diverged. `[periphery, first-principles]`
- **`resetPhase1State` cannot recover a permanently-stuck pending auction** — the only writer for
  `hasActivePendingAuction` (other than `finalizePhase2`) is a *successful* `launchDeferredAuction`; if
  the CCA launch arm becomes permanently unable to accept the launch (e.g. driven to a terminal
  lifecycle state by another approved launcher) or the batcher's retained share balance drops below the
  recorded pending amount, the 30% auction reserve is stranded and `finalizePhase2` is barred for every
  version of that (token, owner) with no in-scope recovery path.
- **`utilsHelper`/phase-module hot-swap has no parity assertion against the shell's own config
  immutables** and, for `utilsHelper` specifically, no codehash validation at all (only phase1/phase2
  get `_validatePhaseModuleCodehash`) — since `utilsHelper` computes the storage keys (`baseSalt`) the
  entire system indexes by, a treasury-triggered swap mid-lifecycle (between a deployment's
  `deployPhase1Core` and its later `finalizePhase1Split`/`deployPhase2Core`) can orphan in-flight state.
  `[asymmetry, flow-gap, invariant]`
- **Registry writes are skip-if-currently-zero rather than assert-equal** — a prior or foreign
  registration of the same `creatorToken` in the shared `IRegistry4626` lets a `finalizePhase2` complete
  in full (deposit, split, bridge, ownership transfers) while the registry continues to authoritatively
  resolve that token to a different party's vault/wrapper/shareOFT.
- **`protocolTreasury` is a permanent, immutable single key** with no transfer, renounce, or timelock —
  simultaneously gates all config, is the ownership sink for nearly every deployed contract, and can
  hot-swap the delegatecall modules. `freezeCodeIdAllowlist` gives a false sense of finality (only pins
  the enabled flag; individual codeIds remain addable/removable after freeze).
- **A compromised `authorizedPhaseCaller` can pre-occupy any victim owner's phase-1 state slot** with
  adversarial metadata, forcing `Phase1StateMismatch` on the victim's real deployment attempt until
  treasury intervenes.
- **`deployPhase2CoreWithRolePolicy` lets the gated caller supply their own `rolePolicyId`**, bypassing
  the treasury-configured global policy id used by the plain `deployPhase2Core` — currently inert
  (`vaultRolePolicyManager==0`).
- **Permit2 no-witness binding** in `finalizePhase2EntryWithPermit2` — a signature is bound to
  spender=batcher and owner=caller but not to the specific deployment's parameters, so a signer's own
  signature (intended for one deployment) could be consumed by a different one of their own
  deployments. Self-scoped only; no cross-user impact. Examined and confirmed **not** exploitable for
  third-party fund loss (all standard Permit2 nonce/deadline/chainId/malleability guarantees hold).
  `[both phases]`
- **Excess LayerZero-fee refund reverts the entire `finalizePhase2`** if the caller is a contract unable
  to receive ETH — self-inflicted DoS, avoidable by using an EOA or funding with the exact quoted fee.
- **First deposit has no minimum-shares/slippage floor** — the orchestrator's own
  `wrapper.deposit(depositAmount)` call accepts any returned share count, including a heavily deflated
  one from a pre-funded/donated predictable vault address; bounded by the out-of-scope vault's own
  documented `MINIMUM_FIRST_DEPOSIT`.
- **Deposit-bound scale assumption**: the 50M–100M deposit guard is enforced on the creator-token
  *principal*, while the quantity actually split across auction/vesting/Solana/LP lanes is the
  *minted shares* — equivalent only if the vault mints 1:1 on first deposit and the ShareOFT is
  18-decimal (the realistic case here).
- **Caller-controlled initial AMM price** for a freshly-created Phase-3 Uniswap V3 pool, feeding into
  the Charm LP band and an Ajna borrow backstop — bounded to the creator's own launch.
- **Solana bridge peer trust**: the LayerZero peer used to route the bridged 30% share allocation is
  read from the external token registry, a trust root distinct from the treasury-controlled destination
  pubkey; a wrong/malicious registry peer could redirect the bridged allocation, but registry
  write-authorization is out of scope.

## Cleared as sound (no finding) — independently re-verified

Phase1Module/Phase2Module are genuinely stateless under delegatecall (re-derived independently by
multiple agents across both phases — no storage-collision surface, unlike some delegatecall-module
patterns this auditor has seen elsewhere). Permit2 signer/spender/destination bindings prevent any
cross-user fund pull. 30/30/30/10 share-split arithmetic is exact for all inputs (remainder-based LP
bucket absorbs all rounding, cannot leave dust or fail to sum). Double-finalize is blocked (incidentally
— vesting CREATE2's timestamp-dependent salt plus non-idempotent ownership transfers — flagged as
fragile-but-holding, not broken, in the leads above). `launchDeferredAuction`'s per-shareOFT balance and
identity binding prevents cross-tenant reserve drainage. `_requireOwner`'s caller-asserted semantics
correctly prevent cross-user impersonation. All state-changing entrypoints are `nonReentrant`; the one
raw-value external call (Solana bridge fee refund) has no reachable reentry target. `_validatePhaseModuleCodehash`
cannot be bypassed or front-run; no `selfdestruct` exists anywhere in scope, closing the
metamorphic-module risk class entirely.

---

> ⚠️ This review was performed by an AI-orchestrated multi-agent audit pipeline (23 agents across 3
> phases: 3 context, 8 breadth checklist, 12 depth attack). AI analysis can never verify the complete
> absence of vulnerabilities and no guarantee of security is given. Given Finding 1's severity and its
> dependency on an external, unmanaged `authorizedDeployers` allowlist, we strongly recommend the team
> (a) patch the reuse-branch integrity check before any further Phase-2 deployments run in production,
> and (b) confirm the external bytecode store's `codeId`-addressing convention referenced in the Leads
> section, given the potential for a full-system Phase-1 DoS if that assumption does not hold.
