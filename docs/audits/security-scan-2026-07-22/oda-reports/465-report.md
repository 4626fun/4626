# Security Review — Registry4626

**Audit target**: `contracts/shared/core/Registry4626.sol` (single contract, ~1321 lines, `Registry4626 is IRegistry4626, Ownable`).

**Source of truth**: `github.com/4626fun/4626`, tag `audit/oda-2026-07-22`, commit `423e0e3a607884de6e60bccd06f722a8aba770ee` (verified via `git rev-parse HEAD` on the audit clone). Live deployment referenced in the job brief: `0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2`.

**Job scope note**: Per the client's brief, only `contracts/shared/core/Registry4626.sol` was in scope for this job — focus areas requested: one-shot bindings, live rebind, factory authorization, remote OFT peers, and agent-integration metadata. `Registry4626` is a companion contract to `LotteryManager4626` (audited separately, job 460, in this same repo) — this registry is the trusted, `immutable`-referenced dependency that the lottery manager and other vault/OFT contracts read for address resolution. This engagement audits `Registry4626` in isolation; downstream consumer contracts are out of scope and not re-examined here, so several findings below describe a data-integrity gap whose ultimate fund-impact would materialize in those out-of-scope consumers — this is stated explicitly in each finding rather than assumed.

**Methodology**: Three-phase review — (0) context building: a protocol map, access-control inventory, and threat catalog built by 3 parallel agents with no findings; (1) breadth: 5 domain-specialist agents (general, precision-math, access-control, bridges, DoS — routed for this target's profile: an access-control-heavy, LayerZero-config-adjacent registry with no financial arithmetic and no outbound calls) walking curated checklists; (2) depth: 12 attacker-mindset agents (9 single-specialty + 3 cross-lens gap-hunters), run **blind** to phase-1's findings, each independently reading the full source and the phase-0 map. All hunting agents ran on `opus`. This reconciliation cross-checks both phases' raw output against each other and against the phase-0 inventory/catalog (coverage gate below).

**Confidence floor**: All findings below Low+ are reported; anything with an incomplete exploit chain or resting on an unconfirmed precondition is described as such within its finding rather than silently omitted, consistent with this contract's nature (no funds, no outbound calls — its risk is entirely in the integrity of the data it hands to others).

---

## Reconciliation summary

- **Overlap** (found independently by both phases): 4 core findings — the mesh-config missing latch, the cross-factory binding hijack, the canonical-wallet squat, and the LayerZero config staleness — each independently rediscovered by **the large majority of the 12 blind phase-2 agents** in addition to the phase-1 domain agents that first flagged them. This is an unusually strong convergence signal for a contract of this size.
- **Phase-2-only**: 1 new finding (a compounding gap in `setCreator`'s front-run recovery — verified directly by the orchestrator against source) plus 2 minor leads (`getVaultKind` default-value masking, `setHubChain`/EID-map desync).
- **Phase-1-only**: 6 findings (ownership hygiene, factory-codehash TOCTOU, remote-OFT dual-namespace, `getAllTokens` unboundedness).
- **Coverage**: `Entrypoints: ~50 external/public state-changing functions in inventory, all examined by ≥1 domain agent and ≥1 blind attack agent. Threat-catalog rows: 6, 6 answered. Coverage holes closed this pass: 0.`

**The two most important results of this audit**: (1) `setOmnichainVaultMesh`'s missing one-shot latch and (2) the absence of any per-token registrant scoping on the core binding setters (`setVault`/`setShareOFTForToken`/`setOracleForToken`/etc.) were each independently rediscovered by **9 or more of the 12 blind phase-2 agents**, across every specialty lens (access-control, economic-security, execution-trace, asymmetry, boundary, first-principles, invariant, periphery, trust-gap) — the single strongest convergence result of this engagement.

---

## Access-Control Inventory (condensed)

- **`onlyOwner`**: factory authorization (`setAuthorizedFactory`, `approveFactoryCodehash`), `setCreator`, `setTokenStatus`, `setPoolForToken`, all `remove*` peer functions, all chain/LZ/ecosystem setters.
- **`onlyAuthorizedOrOwner`** (`msg.sender==owner() || authorizedFactories[msg.sender]`): `registerToken`, `setVault`, `setShareOFTForToken`, `setWrapperForToken`, `setOracleForToken`, `setGaugeControllerForToken`, `setOmnichainVaultMesh`, `setRemoteOFTPeer`, `setRemoteOFTPeerBytes32`, `setAgentIntegrationMeta`. **This gate is a global allowlist with no per-token scoping** — any authorized factory can act on any registered token, not just tokens it itself registered (see Finding 2).
- **Bespoke inline guard**: `setCanonicalWallet` — `msg.sender == owner() || msg.sender == creator`, and — unlike every sibling per-token binding — **not** gated by `liveRebindEnabled` (see Finding 3).
- **`renounceOwnership()`** is overridden to unconditionally revert — ownership can never be dropped to zero (correct, intentional design, verified by multiple agents).
- **One-shot vs. live-rebind pattern** (`_requireBindingWritable`): first non-zero set always allowed; replacing requires `liveRebindEnabled==true` (owner-toggleable) **and** `msg.sender==owner()`. Applies to the five core bindings and (hand-inlined) to `setRemoteOFTPeerBytes32`/`setAgentIntegrationMeta`. **`setOmnichainVaultMesh` alone has no such latch** (Finding 1).
- **No unguarded state-changing entrypoints.**

## Threat Model

| Actor | Reachable entrypoint | Potential gain | Status |
|---|---|---|---|
| Any authorized factory (semi-trusted, potentially many — the design explicitly supports multiple lanes: creator/agent/future ecosystems) | `setOmnichainVaultMesh` on any registered token | Silently overwrite Solana mesh routing for a token it did not register | **Addressed by Finding 1** |
| Any authorized factory | `setVault`/`setShareOFTForToken`/`setOracleForToken`/`setGaugeControllerForToken`/`setWrapperForToken`/`setRemoteOFTPeer`(+Bytes32)/`setAgentIntegrationMeta` on a token it did not register, before the legitimate factory's follow-up call lands | Permanently (one-shot) plant attacker-controlled addresses into another lane's core bindings | **Addressed by Finding 2** |
| Any token's `creator` (a low-trust principal, supplied unchecked by whichever factory registers a token) | `setCanonicalWallet` | Squat any unclaimed wallet address, permanently blocking its rightful party and hijacking reverse-attribution | **Addressed by Finding 3** |
| Owner (trusted, but a documented operational footgun) | `setChainIdToEid`/`setLayerZeroEndpoint` called after `setLzConfig` on the same chain | Silent state desync between the "effective" LZ config and the canonical EID/endpoint maps | **Addressed by Finding 4** |
| Attacker who front-ran registration, later "corrected" by owner | `setCreator` (recovery) leaves `canonicalWallet` untouched | Retains prize/attribution routing even after the owner's fix | **Addressed by Finding 5** |
| Owner (trusted, broad by design) | Non-conflict-guarded resettable fields (`setDexInfrastructure`, `setLotteryManager`, `setGaugeController`, `setGasReserve`) | Instant, unchecked repointing (including to zero) | By design; noted in Finding 7 |
| Any downstream contract reading a registry getter | — | Trusts stored addresses with no on-chain type/behavior guarantee | Structural, out of this file's scope (documented in protocol map §3) |

---

## Findings

### [1] `setOmnichainVaultMesh` has no one-shot latch — any authorized factory can silently overwrite a token's Solana mesh routing
**Severity**: Medium
**Origin**: `[both]` — ethskills general + access-control agents; independently rediscovered by 9 of 12 blind pashov agents (economic-security, access-control, execution-trace, first-principles, asymmetry, boundary, invariant, periphery, trust-gap), unanimously as a full FINDING, not a lead.
**Location**: `setOmnichainVaultMesh()`, `Registry4626.sol:521-549`.

**Description**: Every other per-token binding in this contract is one-shot (`_requireBindingWritable`, or the hand-inlined equivalents in `setRemoteOFTPeerBytes32`/`setAgentIntegrationMeta`): once written non-zero, replacement requires `liveRebindEnabled && msg.sender == owner()`. `setOmnichainVaultMesh` alone performs a plain, unconditional assignment (`omnichainVaultMeshConfigs[_token] = _cfg;`) gated only by `onlyAuthorizedOrOwner`, with no latch and no restriction that the caller be the factory that registered the token. Because `authorizedFactories` is a flat, global set with no per-token scoping, **any** authorized factory can overwrite an already-correctly-configured token's `hubComposer`, `assetMeshToken`, `shareMeshToken`, `solanaAssetMint`, and `solanaEid` at any time — no owner action needed. These fields are read by `getOmnichainVaultMesh`, `getSolanaAssetMint`, and `isSolanaDepositEligible`, which the contract's own comments describe as the cross-chain Solana OVault routing addresses that out-of-scope consumer contracts trust for deposit routing.

**Proof of Concept**: Owner authorizes factories F1 and F2. F1 registers token T and calls `setOmnichainVaultMesh(T, goodCfg)` with correct routing (`enabled=true`, all fields valid). F2 (any other authorized factory — need not have registered T) calls `setOmnichainVaultMesh(T, evilCfg)` with `enabled=true` and attacker-controlled `hubComposer`/`assetMeshToken`/`shareMeshToken`/`solanaAssetMint` (all non-zero, so validation passes). The write succeeds unconditionally; `getOmnichainVaultMesh(T)` now returns `evilCfg`, and `isSolanaDepositEligible(T)` still returns true. No event distinguishes a legitimate reconfiguration from a hijack. (Note: because there is no latch, the honest party can also write back over the attacker's config — the primitive enables repeated griefing/re-hijacking rather than an irreversible one-time lock.)

**Recommendation**: Apply the same one-shot/`liveRebindEnabled`-owner-only latch used by every sibling binding — a dedicated `omnichainVaultMeshSet[token]` bool (mirroring `agentIntegrationMetaSet`, since an all-zero/disabled config is a valid state and cannot self-signal "unset").

---

### [2] Any authorized factory can front-run and permanently hijack core bindings for a token it did not register
**Severity**: High
**Origin**: `[both]` — ethskills general agent (independently re-verified by the orchestrator against source: `TokenInfo` carries no registering-factory field); independently rediscovered by 6+ of 12 blind pashov agents (economic-security, access-control, execution-trace [implied in the desync trace], boundary, first-principles, periphery) as full FINDINGs.
**Location**: `_requireBindingWritable()` (`Registry4626.sol:318-322`) and its callers: `setVault`, `setShareOFTForToken`, `setWrapperForToken`, `setOracleForToken`, `setGaugeControllerForToken`, `setRemoteOFTPeer`, `setRemoteOFTPeerBytes32`, `setAgentIntegrationMeta`; `registerToken()` (`Registry4626.sol:250-283`).

**Description**: `_requireBindingWritable` allows the *first* non-zero set unconditionally for any `onlyAuthorizedOrOwner` caller — only *replacement* is owner-gated. `TokenInfo` (constructed in `registerToken`) stores no field identifying which factory registered the token, and `authorizedFactories` is a single flat set with no per-token scoping. So any authorized factory — not just the one that called `registerToken` for a given token — can be the one to set-from-zero that token's vault, shareOFT, wrapper, oracle, gauge controller, or remote-OFT peer. Because these bindings are one-shot, whichever factory calls first wins **permanently**, recoverable only via an owner-mediated `liveRebindEnabled` correction. This is rated High rather than Medium because the resulting lock is genuinely permanent absent explicit owner intervention (fitting "permanent DoS"/loss-requiring-specific-conditions), and the precondition — multiple authorized factories — is not a hypothetical edge case but the contract's own explicitly documented design ("supports creator, agent, and future ecosystems," implying multiple concurrent factory grants).

**Proof of Concept**: Factory F1 calls `registerToken(T, ...)`. Before F1's intended follow-up `setVault(T, goodVault)` lands, Factory F2 (any other authorized factory) calls `setVault(T, evilVault)` — `previous == address(0)` so `_requireBindingWritable` returns immediately (allowed), the reverse-conflict check passes (assuming `evilVault` unused elsewhere), and `vaultToToken[evilVault] = T` sticks. F1's later `setVault(T, goodVault)` reverts `BindingAlreadySet`. The identical pattern applies to `setShareOFTForToken`, `setOracleForToken`, `setGaugeControllerForToken`, `setWrapperForToken`, `setRemoteOFTPeer`(+bytes32), and `setAgentIntegrationMeta`.

**Recommendation**: Record the registering factory in `TokenInfo` (or a side mapping) and require binding setters to be called either by the token's own registering factory or the owner; alternatively, scope `authorizedFactories` per lane/ecosystem so factories cannot act on tokens outside their own domain.

---

### [3] `setCanonicalWallet` allows squatting/reverse-attribution hijack of an arbitrary wallet with no proof of control
**Severity**: Medium
**Origin**: `[both]` — ethskills access-control agent; independently rediscovered by 5+ of 12 blind pashov agents (economic-security, access-control, first-principles, boundary, trust-gap) as full FINDINGs.
**Location**: `setCanonicalWallet()`, `Registry4626.sol:486-515`.

**Description**: `setCanonicalWallet` is gated by `msg.sender == owner() || msg.sender == creator` and enforces a strict 1:1 `canonicalWalletToToken` reverse map (`CanonicalWalletAlreadyInUse`). Critically, `_wallet` is accepted with **no signature or proof of control from `_wallet` itself** — a token's creator can bind the token to any address they do not own. Combined with the 1:1 map, this produces: (a) **squatting DoS** — the first creator to claim address `W` as their canonical wallet permanently blocks any other token from ever using `W`; (b) **reverse-attribution hijack** — `getTokenForCanonicalWallet(W)` subsequently resolves to the squatter's token. A source comment nearby even acknowledges the general hijack concern; the 1:1 map trades a double-claim for an uncontested first-come squat, never verifying `W`'s actual owner consents. Unlike core bindings' addresses (protocol-deployed, unpredictable), a canonical wallet is typically a human-chosen, publicly-known address (e.g. a multisig or ENS-resolved address) — which is precisely what makes it a predictable squatting target.

**Proof of Concept**: Attacker gets a token `X` registered with themselves as `creator` (routine — `registerToken`'s `_creator` parameter is never signature-checked, set directly by whichever factory calls it). Attacker calls `setCanonicalWallet(X, W)` where `W` is a victim's known/expected wallet address, which they do not control. All checks pass (`W` non-zero, `canonicalWalletToToken[W] == 0`). `canonicalWalletToToken[W] = X` is now locked; the legitimate party controlling `W` (creator of token `Y`) later calls `setCanonicalWallet(Y, W)` and reverts `CanonicalWalletAlreadyInUse(W, X)`. `getTokenForCanonicalWallet(W)` now resolves to the attacker's token `X`. No `liveRebindEnabled`/owner cooperation is required to perform the initial squat (owner can, however, later free `W` by calling `setCanonicalWallet(X, differentAddr)` on the attacker's own token — a recovery path exists, keeping this Medium rather than higher).

**Recommendation**: Require proof that the caller controls `_wallet` (e.g. a signature from `_wallet` over `(token, wallet)`, or require `msg.sender == _wallet`), or make canonical-wallet binding owner-mediated. At minimum, provide the rightful controller of `W` a documented, obvious path to reclaim it (see also Finding 5).

---

### [4] `getEffectiveLzConfig` returns a stale EID/endpoint after `setChainIdToEid`/`setLayerZeroEndpoint` repoints a chain previously configured via `setLzConfig` — can produce a two-chain EID collision
**Severity**: Medium
**Origin**: `[both]` — ethskills bridges agent; independently rediscovered by 2 of 12 blind pashov agents (execution-trace, flow-gap), with execution-trace additionally identifying a stronger collision amplification.
**Location**: `getEffectiveLzConfig()` (`Registry4626.sol:1049-1066`), `setLzConfig()` (`:1074-1116`), `setChainIdToEid()` (`:1017-1035`), `setLayerZeroEndpoint()` (`:1004-1010`).

**Description**: The registry keeps the same fact in two places. The canonical EID↔chainId relationship lives in `chainIdToEid`/`eidToChainId`, and the canonical endpoint lives in `layerZeroEndpoints`. But `setLzConfig` *also* stores private copies inside the `LzConfig` struct (`lzConfigs[_chainId].eid`, `.endpoint`). `getEffectiveLzConfig` short-circuits to `return config` verbatim whenever `config.isConfigured` is true (which `setLzConfig` always sets) — using the frozen `.eid`/`.endpoint` copies rather than the live canonical maps; the fallback branch (for chains never touched by `setLzConfig`) correctly patches these from the live maps, but the `isConfigured` early-return path skips that patching entirely. Neither `setChainIdToEid` nor `setLayerZeroEndpoint` writes back into `lzConfigs[_chainId]`, so calling either after `setLzConfig` has run on that chain desynchronizes the two sources of truth.

**Proof of Concept**: (1) `setLzConfig(137, E1, eid=30109)` — `lzConfigs[137]={eid:30109,endpoint:E1,isConfigured:true}`, `chainIdToEid[137]=30109`. (2) Owner later calls `setChainIdToEid(137, 30110)` to repoint the chain's EID (a legitimate, expected operational action — LayerZero EIDs are occasionally reassigned) — this correctly updates `chainIdToEid[137]=30110`, `eidToChainId[30110]=137`, and **clears** the stale `eidToChainId[30109]`. (3) Reads now diverge: `getEidForChainId(137)` correctly returns `30110`, but `getEffectiveLzConfig(137).eid` still returns the stale `30109`. (4) **Collision amplification**: since `eidToChainId[30109]` was freed by step 2, a later `setLzConfig(200, E2, eid=30109)` for an unrelated chain 200 passes the `EidAlreadyMapped` guard cleanly — after which `getEffectiveLzConfig(137).eid` and `getEffectiveLzConfig(200).eid` are **both** `30109`, so a downstream consumer preferring `getEffectiveLzConfig()` (whose name implies it is the authoritative, resolved config) over `getEidForChainId` would address cross-chain messages for chain 137 to chain 200's identity.

**Recommendation**: Eliminate the duplicated source of truth — have `getEffectiveLzConfig` always overwrite `config.eid`/`config.endpoint` from the live `chainIdToEid`/`layerZeroEndpoints` maps even on the `isConfigured` path (the fallback branch already does this correctly), or make `setChainIdToEid`/`setLayerZeroEndpoint` also write back into `lzConfigs[_chainId]` when a config exists.

---

### [5] `setCreator`'s front-run recovery doesn't clear the displaced attacker's `canonicalWallet` binding
**Severity**: Low
**Origin**: `[phase2 only]` — pashov trust-gap agent; independently verified by the orchestrator directly against source.
**Location**: `setCreator()`, `Registry4626.sol:291-301` (own docstring: "Owner correction for a token's immutable-by-default `creator` authority... recovers from front-run / mis-registration").

**Description**: `setCreator` writes only `tokenInfos[_token].creator` — it never touches `canonicalWallet` or `canonicalWalletToToken`. This is a compounding gap on top of Finding 3: if an attacker front-ran a token's registration as its `creator` and then called `setCanonicalWallet(token, attackerWallet)` (a value the code's own comments describe as the "lottery prize recipient" / "primary asset holder"), the owner's documented recovery path — calling `setCreator(token, legitimateCreator)` — fixes the `creator` field but silently leaves `canonicalWallet` pointed at the attacker's address. The new, legitimate creator must independently notice and separately call `setCanonicalWallet` to complete the recovery; the "correction" primitive gives the impression of a full recovery but is not one.

**Proof of Concept**: Verified directly against source — `setCreator` (lines 291-301) contains only `tokenInfos[_token].creator = _creator;` plus event emission; no reference to `canonicalWallet`/`canonicalWalletToToken` anywhere in the function body.

**Recommendation**: Either have `setCreator` also clear the token's `canonicalWallet` (and its reverse entry) when correcting a mismatched creator, or document prominently that `setCreator` does not undo any state the displaced creator wrote via `setCanonicalWallet`, so operators know to check and re-bind it manually.

---

### [6] Factory codehash pin is checked only at authorization time, not at each call (TOCTOU)
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills access-control agent.
**Location**: `setAuthorizedFactory()`/`approveFactoryCodehash()`, `Registry4626.sol:224-241`.

**Description**: `approvedFactoryCodehashes` was added as an audit mitigation to pin an authorized factory to specific bytecode, but `extcodehash` is verified only inside `setAuthorizedFactory`, and only when a pin is non-zero (opt-in). It is never re-validated at `registerToken` or any binding setter. If an authorized factory is a proxy (upgradeable) or a metamorphic CREATE2 redeploy, its code can change after authorization with no re-check — the persistent `authorizedFactories[F]` boolean retains full privileges regardless.

**Recommendation**: Re-validate the pin at call time inside `onlyAuthorizedOrOwner` when a pin exists, or document/enforce that authorized factories must be immutably deployed.

---

### [7] One-step `transferOwnership` and owner-centralized, unguarded ecosystem-address setters
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills access-control agent.
**Location**: inherited `Ownable.transferOwnership` (not overridden); `setLotteryManager`/`setGaugeController`/`setGasReserve` (`Registry4626.sol:1151-1176`); `setDexInfrastructure` (`:959-974`); `setDefaultLzConfig` (`:1123-1145`).

**Description**: The contract does not use `Ownable2Step`, so `transferOwnership` is single-step; combined with `renounceOwnership` being disabled (correctly, by design), a transfer to a wrong-but-nonzero address permanently and irrevocably hands over all administration with no confirmation step. Separately, `setLotteryManager`/`setGaugeController`/`setGasReserve` accept the zero address with no check (inconsistent with the per-token setters), and all ecosystem/DEX/default-LZ setters are instantly re-settable with no timelock and no conflict guard.

**Recommendation**: Adopt `Ownable2Step`; add zero-address checks to the ecosystem setters for consistency; consider a timelock/multisig for owner-only critical repointing.

---

### [8] Remote-OFT peer namespaces (EVM address vs. bytes32) are fully independent with no cross-namespace uniqueness check
**Severity**: Low
**Origin**: `[both]` — ethskills bridges agent; independently rediscovered by 2 of 12 blind pashov agents (flow-gap, invariant) as leads.
**Location**: `remoteOFTPeers`/`remoteOFTToToken` vs. `remoteOFTPeersBytes32`/`remoteOFTBytes32ToToken`; `setRemoteOFTPeer()` (`:575`), `setRemoteOFTPeerBytes32()` (`:694`).

**Description**: For a single `(token, eid)`, both an address peer and a bytes32 peer can be registered simultaneously (up to 128 total EID entries per token across both namespaces, since the 64-entry cap is enforced separately per namespace), and their uniqueness guards never consult each other. A 20-byte EVM address `X` bound to token A via the address namespace does not prevent a bytes32 value that left-zero-pads to the same `X` from being bound to a *different* token B via the bytes32 namespace — a consumer normalizing a cross-chain sender to bytes32 could attribute a message from `X` to the wrong token.

**Recommendation**: If a given `(token, eid)` should only ever hold one representation, have each setter check the other namespace before allowing a write; or forbid registering a bytes32 peer whose high 12 bytes are zero (aliasing an EVM address format).

---

### [9] `getAllTokens()` returns an unbounded array; the token cap is not a meaningful gas-DoS bound
**Severity**: Low
**Origin**: `[phase1 only]` — ethskills DoS agent.
**Location**: `getAllTokens()`, `Registry4626.sol:836-838`.

**Description**: `getAllTokens()` copies the entire `registeredTokens` array with no bound (the code's own comment acknowledges this). `MAX_REGISTERED_TOKENS`=999999 does not prevent the problem — an on-chain caller iterating the return value would hit block-gas-limit issues at a few thousand tokens. Growth is semi-trusted (`onlyAuthorizedOrOwner`), and a bounded alternative (`getTokensPaginated`) exists.

**Recommendation**: Document that `getAllTokens()` must never be called from an on-chain/state-changing path; ensure in-protocol consumers use `getTokensPaginated`/`getTokenCount`.

---

## Leads (not scored as findings — conditional or unconfirmed against out-of-scope consumers)

- **`getVaultKind` masks unset/gap state as `Creator`** — `getVaultKind` (`:1255-1259`) returns `VaultKind.Agent` only if the stored `AgentIntegrationMeta.vaultKind` is exactly `Agent`; since `registerToken` and `setAgentIntegrationMeta` are separate calls, a genuine Agent-kind token reads as `Creator` in the window between registration and the meta write (or permanently, if the meta is never written). `[pashov: periphery]`
- **`setHubChain` doesn't reconcile with `chainIdToEid`/`eidToChainId`** — `setHubChain(chainId, eid)` writes `hubChainId`/`hubChainEid` independently of the canonical EID map; if they're set to inconsistent values, `hubChainEid` and `getEidForChainId(hubChainId)` can disagree. Owner-only, so not unprivileged-attacker-reachable. `[pashov: invariant]`
- **`registerChain`/`setChainIdToEid` with `chainId=0` collides with the "unset" sentinel** — chain ID 0 doubles as the "not registered"/"not mapped" sentinel throughout the contract; registering or mapping an EID to chain 0 produces state that other functions (`isChainSupported`, `EidAlreadyMapped`) cannot correctly reason about. Owner-only and chain 0 is not a real chain, so low impact, but worth an explicit `_chainId != 0` guard. `[pashov: boundary]`
- **`getTokensPaginated` computes `offset + limit` before clamping** — an absurdly large `limit` overflows and reverts rather than clamping to the array end; fails closed, caller-controlled, not exploitable against another party. `[ethskills: dos]`
- **Bytes32→address lossy cast in a revert-error argument only** (`setRemoteOFTPeerBytes32`'s `BindingAlreadySet` error) — cosmetic, does not influence storage or control flow. `[ethskills/pashov: precision-math, boundary]`
- **PUSH0/floating pragma (`^0.8.20`) on an explicitly multichain target** — a deployment-portability hazard for chains lacking PUSH0 support, not an on-chain exploit. `[ethskills: general]`

## Verified-safe / Info (checked, no action required)

- **Reverse-mapping unconditional-delete safety** — the five core bindings' unconditional reverse-delete on rebind was traced by multiple agents across both phases and cannot clobber another token's entry, because the reverse-conflict guard always fires before any delete and forward/reverse are only ever written together.
- **Remote-OFT reverse-mapping cleanup lifecycle (within each namespace)** — no dangling reverse without forward and no premature reverse-clear while another EID still references the same peer; verified with concrete multi-EID trace sequences by 3+ agents.
- **EID↔chainId bidirectional map integrity** (setChainIdToEid vs. setLzConfig, excluding the embedded-copy staleness in Finding 4) — the canonical maps themselves stay a true bijection; `EidAlreadyMapped` makes cross-assignment unreachable.
- **`renounceOwnership` disabled** — correct, intentional design, not a defect.
- **Swap-and-pop removal arithmetic** (`removeRemoteOFTPeer`/`removeRemoteOFTPeerBytes32`) — verified safe at every boundary (last-element, length-1, non-present-eid) by 2 independent agents; no underflow or corruption reachable.

---

## Completeness

Every unique (Contract, function) raised by any of the 17 sub-agents across both phases appears above, either as a numbered finding or in the Leads/Info sections. `Entrypoints: ~50 external/public state-changing functions in inventory, all examined. Threat-catalog rows: 6, 6 answered. Coverage holes closed this pass: 0.`

> ⚠️ This review was performed by AI auditor agents. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Note that several findings here (1, 2, 3, 5) describe data-integrity gaps in this registry whose full fund-impact depends on how out-of-scope downstream consumer contracts (vaults, OFTs, lottery managers) use the affected getters — an independent review of those consumers alongside this registry is recommended to fully size the risk.
