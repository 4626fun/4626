# 🔐 Security Review — Registry4626

---

## Audit Target (pinned)

| | |
|---|---|
| **Client-designated source of truth** | `https://litter.catbox.moe/d8goxq.md` |
| **SHA-256 of fetched bundle** | `40d923fa8c751df191a1a6958ab4eae295a52106d669fe72840d6d500e973302` |
| **Fetched** | 2026-07-18 10:32 UTC |
| **File audited** | `contracts/shared/core/Registry4626.sol` (1151 lines) |
| **Repo** | `github.com/wenakita/4626` (private) — audited via the client-supplied markdown source bundle above, per the job's explicit instruction. `github.com/wenakita/CreatorVault` (a legacy/different repo) was explicitly excluded from scope and was not consulted. |
| **Live reference (not the audit source)** | Base `0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2` |
| **Client-stated focus areas** | One-shot bindings, `setAgentIntegrationMeta` overwrite, live rebind, factory auth, remote OFT peers |
| **Methodology** | Three-phase: context mapping (protocol map + access-control inventory + threat catalog) → breadth (6 domain checklists: general, precision-math, access-control, bridges, assembly, dos) → depth (12 attacker-mindset agents, blind to breadth-phase findings) → hybrid reconciliation |

---

## Scope

|                                  |                                                        |
| -------------------------------- | ------------------------------------------------------ |
| **Mode**                         | Client-specified file only |
| **Files reviewed**               | `Registry4626.sol` |
| **Confidence threshold (1-100)** | 45 |

---

## Reconciliation Summary

**Overlap: 5 · Breadth-only: 13 · Depth-only: 0 · Re-examined leads kept: all · Coverage holes closed: 0**

This is a pure-storage, zero-outbound-call registry — client-flagged focus areas (factory auth, one-shot bindings, remote OFT peers, `setAgentIntegrationMeta`) map almost exactly onto where both phases independently converged. The standout result of this audit is the depth phase's convergence rate: **11 of 12 blind attacker-mindset agents independently rediscovered the same reverse-map hijack bug** (Finding 1) from their own distinct specialty lens — the strongest signal observed in this engagement — and one agent (trust-gap) surfaced a critical amplifying detail (the hijack is unrecoverable via the obvious repair call) that no other agent found. **9 of 12** depth agents independently confirmed a second bug (Finding 2, the remote-OFT reverse-map orphaning) that breadth had already found via the general and bridges checklists.

**Coverage gate** (against the phase-0 protocol map): 30 external/public state-changing entrypoints in the inventory, 30 addressed — every privileged function either maps to an explicit finding or was traced and confirmed sound (e.g., the one-shot binding lock was specifically attacker-tested by multiple depth agents attempting placeholder-then-replace bypasses, and confirmed airtight against factories). 6 threat-catalog rows from the phase-0 map, 6 answered. **Holes closed this pass: 0** — both phases already achieved full coverage independently.

---

## Findings

[95] **1. Reverse-map conflict guard missing on 4 of 6 parallel binding setters — the resulting hijack is silent and unrecoverable via the normal repair path**

`Registry4626.setVault` / `setWrapperForToken` / `setOracleForToken` / `setGaugeControllerForToken` · Confidence: 95 · Severity: **High** · Origin: **[both]** — breadth: general, access-control (independently found, identical root cause); depth: 10 of 12 attacker-mindset agents independently confirmed as a FINDING (math-precision, access-control, economic-security, execution-trace, invariant, periphery, first-principles, asymmetry, boundary, flow-gap), with the trust-gap agent adding the critical unrecoverability detail

**Description**
`setShareOFTForToken` (L323-334) and `setCanonicalWallet` (L440-443) both carry an explicit reverse-map conflict guard — before writing their respective entity→token reverse map, they check whether the entity is already reverse-mapped to a *different* token and revert if so (`ReverseMappingConflict`/`CanonicalWalletAlreadyInUse`). `setVault` (L292-309), `setWrapperForToken` (L343-360), `setOracleForToken` (L365-382), and `setGaugeControllerForToken` (L387-408) — four functions structurally identical to `setShareOFTForToken` in every other respect — omit this guard entirely. Any authorized factory can therefore bind an entity address already claimed by one registered token to a *second* registered token, silently overwriting the reverse map with no revert, no event flagging the conflict, and no cleanup of the first token's now-stale forward record.

**Critical amplification**: the corruption cannot be repaired through the obvious path. `setVault` opens with:
```solidity
address previous = tokenInfos[_token].vault;
_requireBindingWritable(_token, previous, _vault);
if (previous == _vault) return;
```
If the legitimate owner of the hijacked token (A) calls `setVault(A, V)` again to reassert its claim, `tokenInfos[A].vault` still equals `V` (it was never overwritten — only the *reverse* map was stolen), so `previous == _vault` is true and the function **returns immediately**, before ever reaching the line that would rewrite `vaultToToken[V] = A`. The reverse map stays permanently pointed at the attacker's token. The only recovery route is the registry owner enabling the global `liveRebindEnabled` flag — which simultaneously exposes *every* registered token's core bindings to owner-initiated replacement — followed by a two-step `V → V2 → V` rebind dance.

**Proof of Concept**
1. Token A registered; authorized factory calls `setVault(A, V)` → `vaultToToken[V] = A`, `tokenInfos[A].vault = V`.
2. Token B registered (same or a different authorized factory — the trust grant is global, not per-token, per the related Finding below). Factory calls `setVault(B, V)` — the identical address `V`.
3. `tokenInfos[B].vault == address(0)`, so `_requireBindingWritable(B, 0, V)` treats this as B's legitimate first-set (no `liveRebindEnabled` required). No conflict guard exists on this code path.
4. `vaultToToken[V]` is overwritten to `B`. `tokenInfos[A].vault` still equals `V` — the forward and reverse records now permanently disagree.
5. `getTokenForVault(V)` and `isRegisteredVault(V)` — documented in-code as a "gauge voting registry-gate" (L788 comment) — now attribute vault `V`'s activity to attacker's token B instead of legitimate token A. A's attempted self-repair (`setVault(A, V)`) is a silent no-op per the amplification above.

**Fix**
```diff
 function setVault(address _token, address _vault) external override onlyAuthorizedOrOwner {
     if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);
     if (_vault == address(0)) revert ZeroAddress();

     address previous = tokenInfos[_token].vault;
     _requireBindingWritable(_token, previous, _vault);
     if (previous == _vault) return;

+    address reverseOwner = vaultToToken[_vault];
+    if (reverseOwner != address(0) && reverseOwner != _token) {
+        revert ReverseMappingConflict(_vault, reverseOwner, _token);
+    }
+
     if (previous != address(0)) {
         delete vaultToToken[previous];
     }

     tokenInfos[_token].vault = _vault;
     vaultToToken[_vault] = _token;
     ...
 }
```
Apply the identical guard, in the identical position, to `setWrapperForToken`, `setOracleForToken`, and `setGaugeControllerForToken` — mirroring the guard already present and working correctly in `setShareOFTForToken`.

---

[88] **2. `removeRemoteOFTPeer`/`removeRemoteOFTPeerBytes32` unconditionally delete a reverse mapping shared across multiple EIDs, orphaning a still-live peer**

`Registry4626.removeRemoteOFTPeer` / `removeRemoteOFTPeerBytes32` · Confidence: 88 · Severity: **Medium** · Origin: **[both]** — breadth: general, access-control, bridges (independently found, identical root cause); depth: 9 of 12 attacker-mindset agents independently confirmed as a FINDING

**Description**
`setRemoteOFTPeer` deliberately permits the same `_remoteOFT` address to be registered under two *different* EIDs for the *same* token — its conflict check passes when the existing reverse-owner equals the token being written (`reverseOwner == _token`). This is realistic and intentional: CREATE2-deterministic deployment commonly places a token's ShareOFT at the identical address across multiple chains. However, `removeRemoteOFTPeer` (L555-578) and `removeRemoteOFTPeerBytes32` (L658-677) delete the shared `remoteOFTToToken`/`remoteOFTBytes32ToToken` reverse entry **unconditionally** when clearing any one EID's forward peer — with no check for whether another EID of the same token still references that address. The set path guards this exact scenario (an in-code "F-11" conditional delete); the remove path does not.

**Proof of Concept**
1. `setRemoteOFTPeer(T, eid1, X)` → `remoteOFTPeers[T][eid1] = X`, `remoteOFTToToken[X] = T`.
2. `setRemoteOFTPeer(T, eid2, X)` — same address `X`, a different EID. The conflict check passes (`reverseOwner (T) == _token (T)`). State: `remoteOFTPeers[T][eid1] = X`, `remoteOFTPeers[T][eid2] = X`, `remoteOFTToToken[X] = T`.
3. Owner calls `removeRemoteOFTPeer(T, eid1)` — ordinary maintenance, e.g. decommissioning one stale chain. L562 executes `delete remoteOFTToToken[X]` **unconditionally**.
4. Resulting corruption: `remoteOFTPeers[T][eid2]` still equals `X` (a live, still-forward-registered peer), but `getTokenForRemoteOFT(X)` now returns `address(0)`.

**Impact**: this reverse lookup is documented in-code as the mechanism used "when a remote OFT sends a lottery entry and we need to identify the creator." A legitimate cross-chain message arriving from the still-valid peer on the surviving EID can no longer be attributed to its token — triggered by ordinary owner maintenance (not requiring any attacker), reachable simply by decommissioning one of several chains a token is deployed to.

**Fix**
```diff
 function removeRemoteOFTPeer(address _token, uint32 _chainEid) external override onlyOwner {
     if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);

     address remoteOFT = remoteOFTPeers[_token][_chainEid];
     if (remoteOFT == address(0)) return;

     delete remoteOFTPeers[_token][_chainEid];
-    delete remoteOFTToToken[remoteOFT];

     uint32[] storage chains = remoteOFTChains[_token];
+    bool stillReferenced;
     for (uint256 i; i < chains.length;) {
         if (chains[i] == _chainEid) {
             chains[i] = chains[chains.length - 1];
             chains.pop();
             break;
         }
+        else if (remoteOFTPeers[_token][chains[i]] == remoteOFT) {
+            stillReferenced = true;
+        }
         unchecked { ++i; }
     }
+    if (!stillReferenced) delete remoteOFTToToken[remoteOFT];

     emit RemoteOFTPeerRemoved(_token, _chainEid);
 }
```
Apply identically to `removeRemoteOFTPeerBytes32`, and add the `tokenInfos[_token].token != address(0)` registration check that function is currently missing (its address-flavor sibling has it) for interface symmetry.

---

[85] **3. Unvalidated, immutable `creator` parameter lets any authorized factory front-run registration and permanently hijack a token's canonical-wallet authority**

`Registry4626.registerToken` / `setCanonicalWallet` · Confidence: 85 · Severity: **High** · Origin: **[phase1: access-control]**

**Description**
`registerToken` stores the caller-supplied `_creator` argument verbatim with zero validation. No function anywhere can change `creator` afterward, and re-registration of an already-registered token address is permanently blocked (`TokenAlreadyRegistered`) — there is no de-registration path at all. `setCanonicalWallet` — the only privileged action available to a non-owner — authorizes on `msg.sender == owner() || msg.sender == creator`. Token addresses are frequently deterministic (CREATE2) and thus predictable before deployment, so whoever wins the race to call `registerToken` for a given address permanently fixes who — besides the registry owner — may ever set that token's canonical wallet, documented as the ERC-4337 account, vault owner, primary asset holder, and lottery prize recipient.

**Proof of Concept**
1. Token address `T` is deterministically known ahead of deployment.
2. A rogue or compromised authorized factory calls `registerToken(T, name, symbol, attacker, pool, fee)` — `_creator = attacker` — before the legitimate factory registers `T`.
3. The legitimate factory's subsequent `registerToken(T, ...)` reverts `TokenAlreadyRegistered` — permanent registration denial, no recovery path.
4. `attacker == tokenInfos[T].creator` permanently satisfies `setCanonicalWallet`'s guard. The attacker calls `setCanonicalWallet(T, attackerWallet)` and controls the token's canonical identity / prize-recipient wallet indefinitely.

**Fix**: Bind `creator` authority to a verifiable source rather than trusting the registering factory's raw argument — e.g. require a signature from the claimed creator over `(token, creator)`. Separately, provide an owner-gated correction path for `creator` (and a de-registration/override mechanism) so a front-run registration is recoverable rather than a permanent DoS + hijack.

---

[70] **4. Authorization is global, not per-token — any authorized factory can bind or hijack modules on any registered token**

`onlyAuthorizedOrOwner` modifier (L178-183); all per-token setters · Confidence: 70 · Severity: **Medium** · Origin: **[phase1: access-control]**

**Description**: The modifier resolves to `owner() ∪ {f : authorizedFactories[f]}` with no association between a token and the factory that registered it. Once any factory is authorized, it can operate on *every* registered token — not only ones it created. This is the structural precondition that makes Finding 1 exploitable by a factory with no connection to the victim token.

**Proof of Concept**: Owner authorizes factories F1 (legitimate) and F2 (later compromised) — multi-factory authorization is an explicitly supported design. F1 registers token T; before F1 sets `vault`/`oracle`/etc., F2 (unrelated to T) calls `setVault(T, attackerVault)` — passes `onlyAuthorizedOrOwner` and the first-set check. F1's later legitimate call reverts `BindingAlreadySet`.

**Fix**: Record the registering factory (or an owner-approved per-token operator) in `TokenInfo`, and gate per-token setters on `msg.sender == owner() || msg.sender == tokenInfos[_token].registrar`. At minimum, document that all authorized factories are mutually fully trusted across every token, and keep that set minimal.

---

[70] **5. `setAgentIntegrationMeta` has no registration check and unconditionally overwrites on every call — any authorized factory can silently reclassify any address's `vaultKind` at any time**

`Registry4626.setAgentIntegrationMeta` · Confidence: 70 · Severity: **Medium** · Origin: **[both]** — client-flagged focus area; breadth: general, access-control; depth: 2 agents confirmed as FINDING (access-control, first-principles), 9 more corroborated as LEAD — unanimous on the underlying code-level defect, split only on severity ceiling pending unverifiable downstream consumer behavior

**Description**: Every other per-token writer checks `tokenInfos[_token].token != address(0)`, and the core module bindings additionally enforce one-shot immutability. `setAgentIntegrationMeta` does neither — it validates only `token != address(0)`, then performs a full-struct overwrite on *every* call, for *any* address, including ones never passed to `registerToken`. Gated only by `onlyAuthorizedOrOwner` (a global, not per-token, trust grant per Finding 4), any authorized factory can write or repeatedly rewrite a token's `vaultKind` classification — which drives `getVaultKind`'s downstream routing/classification result — at any time, with no lock.

**Proof of Concept**: An authorized-but-malicious/compromised factory F calls `setAgentIntegrationMeta(anyToken, meta{vaultKind: Agent})` for a token it never registered; `getVaultKind(anyToken)` immediately reflects this. F can call again with a different value to flip it back, oscillating arbitrarily, and can pre-seed classification for not-yet-registered addresses. The confirmed, in-scope impact is unrestricted/oscillating reclassification; whether this rises to a fund-relevant severity depends on whether any out-of-scope downstream consumer treats `getVaultKind` as security-relevant routing rather than purely informational (unresolved from this file alone — all 11 agents that examined it flagged this exact dependency).

**Fix**: Add `if (tokenInfos[token].token == address(0)) revert TokenNotRegistered(token);`. Scope writes to the registering factory or owner (per Finding 4's fix), and add one-shot immutability (or restrict replacement to `onlyOwner`) consistent with the core-binding trust model.

---

[65] **6. Factory codehash pin is a one-time check at authorization time, never re-verified — defeated by proxy factories, and skippable entirely**

`setAuthorizedFactory` (assembly `extcodehash` read); no re-check anywhere else · Confidence: 65 · Severity: **Medium** · Origin: **[both]** — breadth: assembly, access-control; depth: 6+ agents corroborated as LEAD

**Description**: The single inline-assembly block in the contract reads `extcodehash(_factory)` and compares it against an owner-pinned `approvedFactoryCodehashes[_factory]` — but only at the instant `setAuthorizedFactory` is called. No other function references `extcodehash` or the pin; the boolean `authorizedFactories[F]` is the sole gate every subsequent `registerToken`/`set*ForToken` call consults, permanently decoupled from the codehash it was pinned against. If `F` is a proxy, `extcodehash(F)` reflects only the proxy's invariant shell — it never changes when the delegatecall implementation is swapped, so the pin provides zero protection against a proxy factory whose logic is later swapped to malicious code (no `selfdestruct` or pre-Cancun chain required). Separately, the check is entirely optional: a factory authorized with no prior `approveFactoryCodehash` call skips verification completely.

**Proof of Concept**: F is deployed as a minimal proxy pointing at benign, audited logic. Owner pins `approveFactoryCodehash(F, keccak256(proxy_runtime_code))`, then `setAuthorizedFactory(F, true)` — passes, since `extcodehash(F)` matches the proxy shell hash. F's admin later swaps the implementation to malicious logic — `extcodehash(F)` is unchanged, `authorizedFactories[F]` is still `true`. F, now running malicious logic, calls `registerToken`/`setVault`/etc. with attacker-controlled values — every check passes on the boolean alone.

**Fix**: Re-verify the pin at point of use (inside `onlyAuthorizedOrOwner` or the hot-path functions, when a pin exists). This still does not defend against a proxy factory — additionally document that authorized factories must not be upgradeable/proxy contracts, and treat authorization as revocable, actively-monitored operational state.

---

[60] **7. `liveRebindEnabled` is a single global flag with no per-token scoping; de-authorizing a compromised factory does not remediate bindings it already placed**

`liveRebindEnabled` (L59), `setLiveRebindEnabled` · Confidence: 60 · Severity: **Medium** · Origin: **[phase1: access-control]**

**Description**: The one-shot lock is genuinely airtight against factories (confirmed by multiple depth agents specifically attempting bypasses) — but that airtightness cuts both ways. De-authorizing a compromised factory (`setAuthorizedFactory(factory, false)`) does not undo any bindings it already wrote while authorized; a maliciously-set core binding is now permanently locked. The *only* remediation is the registry owner globally enabling `liveRebindEnabled` — which simultaneously exposes *every* token's core bindings to owner-initiated replacement, not just the compromised one, for the duration of the fix.

**Fix**: Scope rebind authority per token (e.g. `mapping(address => bool) liveRebindEnabledFor`) so an emergency migration or remediation touches only the intended token. Put the flag and critical setters behind a timelock so the exposure window is bounded and observable.

---

[55] **8. Remote OFT peers have no one-shot protection and set/remove authorization is asymmetric**

`setRemoteOFTPeer(Bytes32)` (`onlyAuthorizedOrOwner`, no lock) vs `removeRemoteOFTPeer(Bytes32)` (`onlyOwner`) · Confidence: 55 · Severity: **Medium** · Origin: **[phase1: access-control]**

**Description**: Unlike the five core module bindings, remote-OFT-peer setters carry no one-shot lock — any authorized factory can freely repoint a token's peer at will (subject only to the reverse-map conflict check). Combined with the set/remove authorization asymmetry, a rogue factory can either (a) silently overwrite a legitimate peer with an attacker-controlled address with no lock to stop it, or (b) bind an address to a throwaway token, permanently blocking that address from legitimate registration until the *owner* (not the setting factory) clears it — a factory cannot self-correct its own mistaken binding.

**Fix**: Either allow the setting factory to remove peers it set, or add one-shot/owner-only-replacement protection to the remote-peer setters so they match the core-binding trust model.

---

[55] **9. `setChainIdToEid`/`setLzConfig` repoint the bidirectional chainId↔eid mapping with no orphan guard**

`setChainIdToEid`, `setLzConfig`; consumer `getEffectiveLzConfig` · Confidence: 55 · Severity: **Medium** · Origin: **[both]** — breadth: general, bridges; depth: 6+ agents corroborated as LEAD

**Description**: Both writers set the forward/reverse pair with no check that either side is already bound to a different counterpart. Repointing an EID to a new chain leaves the old chain's forward entry stale — `chainId → eid → chainId` no longer round-trips, and `getEffectiveLzConfig` can resolve a chain's config to an EID the registry simultaneously claims belongs to a different chain, misrouting downstream LayerZero consumers.

**Fix**: Before repointing, clear the stale counterpart on both sides, or revert on an attempted repoint of an already-bound EID/chainId, forcing an explicit unset first.

---

[50] **10. Unbounded per-token remote-OFT-chains array combined with linear-search removal can permanently brick the owner's ability to remove any peer for that token**

`removeRemoteOFTPeer`/`removeRemoteOFTPeerBytes32` (linear scan before swap-and-pop); array grown by the set functions · Confidence: 50 · Severity: **Medium** · Origin: **[phase1: dos]**

**Description**: The per-token chain-list arrays grow via cheap O(1) pushes with no cap (reusing the same peer address across many EIDs is permitted, per Finding 2's precondition). Removal linear-scans the entire array before swap-and-pop. An authorized factory can cheaply inflate a single token's array far enough that a full scan exceeds the block gas limit, permanently bricking `removeRemoteOFTPeer` for that token. Live deployment target is Base — cheap enough for this to be economically viable for a compromised factory.

**Fix**: Store the array index alongside each peer entry so removal is O(1), or cap the number of distinct EIDs registrable per token.

---

[45] **11. Raw `setLzConfig` can silently zero out a chain's LayerZero endpoint, unlike `setLayerZeroEndpoint`**

Confidence: 45 · Severity: **Low** · Origin: **[phase1: general]**

**Description**: Two functions write the same endpoint storage slot with inconsistent zero-address validation.

**Fix**: Add the same zero-address check to `setLzConfig`.

---

[45] **12. Address-flavor and bytes32-flavor remote-OFT-peer namespaces have no cross-validation**

Confidence: 45 · Severity: **Low** · Origin: **[phase1: bridges]**

**Description**: The two namespaces use entirely disjoint storage with zero cross-consistency enforcement — nothing prevents registering contradicting values for the same `(token, eid)` pair across the two flavors.

**Fix**: Enforce per-(token, eid) flavor exclusivity, or document which flavor is authoritative.

---

[45] **13. `getEffectiveLzConfig`'s default fallback inherits `isConfigured: true` even when never explicitly configured**

Confidence: 45 · Severity: **Low** · Origin: **[phase1: bridges]**

**Description**: A chain that was never mapped via `setChainIdToEid` yields a fallback config reporting `isConfigured: true` with `eid: 0` — a consumer gating on `isConfigured` proceeds with a meaningless EID.

**Fix**: In the fallback path, set `effective.isConfigured = false` rather than inheriting the default's `true`.

---

[45] **14. No `Ownable2Step`; `renounceOwnership` can permanently brick the entire registry's administration**

Confidence: 45 · Severity: **Low** · Origin: **[both]** — breadth: access-control; depth: 4+ agents corroborated as LEAD

**Description**: Single-step `Ownable` with no confirmation step; because the entire authorization model is owner-gated, `renounceOwnership()` would permanently brick all future administration.

**Fix**: Adopt `Ownable2Step`; consider overriding/disabling `renounceOwnership`, or routing ownership through a multisig/timelock.

---

Findings List

| # | Confidence | Title |
|---|---|---|
| 1 | [95] | Reverse-map conflict guard missing on 4 of 6 binding setters — unrecoverable hijack |
| 2 | [88] | `removeRemoteOFTPeer`/`Bytes32` unconditional reverse-delete orphans still-live peers |
| 3 | [85] | Unvalidated `creator` param enables registration front-running + wallet hijack |
| 4 | [70] | Authorization is global, not per-token |
| 5 | [70] | `setAgentIntegrationMeta` unrestricted overwrite, no registration check |
| 6 | [65] | Factory codehash pin is one-time, defeated by proxy factories |
| 7 | [60] | Global `liveRebindEnabled`; de-authorization doesn't remediate |
| 8 | [55] | Remote OFT peers no one-shot, asymmetric set/remove auth |
| 9 | [55] | chainId↔eid bidirectional repoint orphan |
| 10 | [50] | Unbounded array + linear search bricks peer removal |
| 11 | [45] | `setLzConfig` can silently zero out endpoint |
| 12 | [45] | Dual address/bytes32 namespace no cross-validation |
| 13 | [45] | `getEffectiveLzConfig` fallback over-reports `isConfigured` |
| 14 | [45] | No `Ownable2Step`; `renounceOwnership` bricks admin |

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path could not be completed in one analysis pass, or where impact depends on unverifiable out-of-scope consumer behavior. Not scored._

- **`getVaultKind` semantic overloading** — `getVaultKind()` — Code smells: an address with no metadata ever set is indistinguishable from one explicitly classified `Creator` (the zero-value default). Add an explicit `Unknown`/`None` sentinel if any consumer needs to distinguish "unset."
- **`getAllTokens()` unbounded array** — `getAllTokens()` — Already acknowledged in-code (F-25 comment); confirmed via full-file search that no state-changing function iterates `registeredTokens`, so this is an unusable view at scale, not a protocol-breaking DoS. `getTokensPaginated` already provides the mitigated path.
- **`getTokensPaginated`'s `offset + limit` overflow-vs-clamp** — `getTokensPaginated()` — A caller passing a very large `limit` as a "no limit" sentinel triggers an overflow revert instead of reaching the clamp-to-`total` logic. Pure self-grief (view function, no protocol impact) — confirmed by both a breadth and a depth agent independently.
- **`pragma solidity ^0.8.20` PUSH0 multichain hazard** — pragma L2 — This registry's own chain-symbol helper evidences intent to deploy across numerous EVM/alt-EVM chains, some historically lacking PUSH0 support. Pin `evmVersion` for non-Shanghai targets.

---

> ⚠️ This review was performed by an AI-driven three-phase audit pipeline (context mapping → breadth checklist review → depth attacker-mindset review → hybrid reconciliation). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human security review, a public bug bounty program, and on-chain monitoring are strongly recommended before or alongside mainnet deployment at scale, particularly given Findings 1-3 involve silent, hard-to-detect data corruption reachable by any authorized factory (a role likely broader than the registry owner alone).
