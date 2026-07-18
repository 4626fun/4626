# Unified Security Audit Report — Job 422

**Target:** Registry4626 — Base `0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2`
**In-scope file:** `/Users/admin/audits/422/src/contracts/shared/core/Registry4626.sol`
**Interface (context only, out of scope for findings):** `/Users/admin/audits/422/src/contracts/shared/interfaces/core/IRegistry4626.sol`
**Phase:** Final hybrid reconciliation of Phase-1 (breadth) + Phase-2 (depth) raw output.

> Registry4626 is a non-upgradeable OZ-Ownable configuration registry / on-chain name-service. It holds no funds, moves no value, and makes no outbound contract calls (the only EVM-level external op is `extcodehash`). There are **no Critical or High findings** — no value-moving path exists, so every issue is data-integrity / access-asymmetry / operational, capped at Medium. All findings below were verified against the exact source lines.

---

## Reconciliation Summary

**Overlap: 7 — Phase-1-only: 2 — Phase-2-only: 1 — Re-examined leads kept: 1, demoted: 4 — Coverage holes closed: 0**

- **Overlap (corroborated across both phases):** F1 (core-setter conflict guard), F2 (setAgentIntegrationMeta), F3 (remote-peer no one-shot gate), F4 (remote reverse-map wipe on shared address), F5 (eid==0 EVM path), F6 (stale eidToChainId), F8 (factory codehash blocks deauth).
- **Phase-1-only:** F7 (Ownable renounce / one-step transfer), F10 (unbounded remote-OFT loops gas DoS).
- **Phase-2-only:** F9 (setCanonicalWallet squatting) — re-examined, kept at Low.
- **Demoted to Leads (confidence < 50):** getTokensPaginated overflow, removeRemoteOFTPeerBytes32 missing registration check, setPoolForToken missing validation/one-shot, setOmnichainVaultMesh no one-shot gate.

**Completeness: 30 unique (Contract,function) mutators across both phases (+ constructor + 2 inherited OZ), 30 covered.** Every privileged entrypoint is either an examined finding or carries an explicit "examined, no issue" note in the Coverage section.

**Coverage: 33 entrypoint rows in inventory (30 source + constructor + transferOwnership/renounceOwnership), 33 addressed. 15 threat rows, 15 answered. Holes closed this pass: 0.**

---

## Access-Control Inventory (from protocol map, verified)

Guard primitives:
- `onlyOwner` (OZ) — reverts unless `msg.sender == owner()`.
- `onlyAuthorizedOrOwner` (178-183) — reverts `NotAuthorized()` unless owner OR `authorizedFactories[msg.sender]`.
- `_requireBindingWritable(token,existing,next)` (283-287) — one-shot gate on the 5 core bindings: if `existing != 0 && existing != next`, requires `liveRebindEnabled` else `BindingAlreadySet`, AND `msg.sender==owner()` else `LiveRebindOwnerOnly`.

| Function (line) | Guard | Who | Notes |
|---|---|---|---|
| constructor (189) | deploy | deployer | sets owner, currentChainId, immut LZ endpoint, Base seeds |
| setAuthorizedFactory (212) | onlyOwner | owner | codehash pin 214-221 — **F8** |
| approveFactoryCodehash (226) | onlyOwner | owner | examined, no issue |
| registerToken (238) | onlyAuthorizedOrOwner | owner/factory | examined, no issue |
| setLiveRebindEnabled (277) | onlyOwner | owner | examined, no issue |
| setVault (292) | onlyAuthorizedOrOwner + gate | owner/factory | **F1** |
| setShareOFTForToken (315) | same + conflict guard 324 | owner/factory | reference (guard present) |
| setWrapperForToken (343) | onlyAuthorizedOrOwner + gate | owner/factory | **F1** |
| setOracleForToken (365) | onlyAuthorizedOrOwner + gate | owner/factory | **F1** |
| setGaugeControllerForToken (387) | onlyAuthorizedOrOwner + gate | owner/factory | **F1** |
| setTokenStatus (413) | onlyOwner | owner | examined, no issue |
| setCanonicalWallet (430) | inline owner-or-creator (436) | owner/creator | **F9** |
| setOmnichainVaultMesh (465) | onlyAuthorizedOrOwner | owner/factory | Lead (no one-shot) |
| setPoolForToken (498) | onlyOwner | owner | Lead (no validation) |
| setRemoteOFTPeer (519) | onlyAuthorizedOrOwner | owner/factory | **F3, F4, F5** |
| removeRemoteOFTPeer (555) | onlyOwner | owner | **F4, F10** |
| setRemoteOFTPeerBytes32 (627) | onlyAuthorizedOrOwner | owner/factory | **F3, F4** |
| removeRemoteOFTPeerBytes32 (658) | onlyOwner | owner | **F4, F10**, Lead (no registration check) |
| registerChain (845) | onlyOwner | owner | examined, no issue |
| setDexInfrastructure (872) | onlyOwner | owner | examined, no issue |
| setChainStatus (889) | onlyOwner | owner | examined, no issue |
| setLayerZeroEndpoint (917) | onlyOwner | owner | examined, no issue |
| setChainIdToEid (930) | onlyOwner | owner | **F6** |
| setLzConfig (970) | onlyOwner | owner | **F6** |
| setDefaultLzConfig (1006) | onlyOwner | owner | examined, no issue |
| setLotteryManager (1034) | onlyOwner | owner | examined, no issue |
| setGaugeController (1043) | onlyOwner | owner | examined, no issue |
| setGasReserve (1052) | onlyOwner | owner | examined, no issue |
| setHubChain (1064) | onlyOwner | owner | examined, no issue |
| setAgentIntegrationMeta (1111) | onlyAuthorizedOrOwner | owner/factory | **F2** |
| transferOwnership (OZ) | onlyOwner | owner | **F7** (one-step) |
| renounceOwnership (OZ) | onlyOwner | owner | **F7** (reachable) |

No unguarded state-changing entrypoint exists. All ungated functions are view/pure or compiler getters.

---

## Threat Model (from protocol map — each row answered)

| # | Actor → Reaches → Gain | Resolution |
|---|---|---|
| 1 | Authorized factory → first-time core binding → bind attacker-chosen address a consumer later trusts | **Invariant holds** — INV-1 one-shot freezes first non-zero set; factories are trusted per model. No bypass found. |
| 2 | Authorized factory → setVault/setWrapper/setOracle/setGauge on a NEW token whose address already reverse-maps to another token | **Addressed by F1** (missing cross-token conflict guard). |
| 3 | Authorized factory → setRemoteOFTPeer/Bytes32 (no one-shot) → repoint existing peer, misattribute inbound cross-chain lottery entries | **Addressed by F3 + F4**. |
| 4 | Authorized factory → setRemoteOFTPeer with `_chainEid == 0` (EVM path unchecked) | **Addressed by F5**. |
| 5 | Authorized factory → setAgentIntegrationMeta on any address (no registration/one-shot/conflict) | **Addressed by F2**. |
| 6 | Authorized factory → setOmnichainVaultMesh → enable Solana routing with attacker mesh addrs | **Invariant mostly holds** — full-population guard (472-480) enforced; residual overwrite risk is a **Lead** (no one-shot). Downstream trust of mesh addresses is an out-of-scope consumer concern. |
| 7 | Creator → setCanonicalWallet (own token) → point canonical wallet to attacker wallet | **Invariant holds for hijack** (1:1 guard 441-443); squat-first DoS variant **Addressed by F9**. |
| 8 | Compromised/malicious owner → all onlyOwner + rebind | **Accepted centralization assumption** — owner is fully trusted by design; not a finding. |
| 9 | Owner (accidental) → renounceOwnership / one-step transferOwnership | **Addressed by F7**. |
| 10 | Owner → setLayerZeroEndpoint/setLzConfig/setChainIdToEid → wrong LZ topology | **Invariant holds** (operator-entered config, trusted); reverse-map staleness sub-case **Addressed by F6**. |
| 11 | Unauthorized external caller → any mutator | **Invariant holds** — every mutator gated by onlyOwner / onlyAuthorizedOrOwner / inline owner-or-creator. No unguarded mutator (verified across all 30). |
| 12 | Deauthorized/replaced factory → codehash pin blocks removal | **Addressed by F8**. |
| 13 | Any caller (griefing) → getAllTokens / getAllRemoteOFTPeers* after array growth | **Addressed by F10**; getTokens has paginated mitigation (getTokensPaginated). |
| 14 | Any consumer → getters return zero for unregistered token; getVaultKind defaults Creator | **Invariant holds within scope** — documented consumer contract; getVaultKind silent-Creator default noted in F2. Out-of-scope consumer responsibility. |
| 15 | Owner/factory → bindings/peers on non-hub chain (hub not enforced on-chain) | **Accepted operational assumption** — hub-centricity is operational, not enforced; not a code defect. |

---

## Findings

### F1 — [Medium] Missing cross-token reverse-map conflict guard on setVault / setWrapperForToken / setOracleForToken / setGaugeControllerForToken
- **Category:** reverse-map-corruption / inconsistent-guard
- **Location:** Registry4626.sol setVault (292-310, write 306), setWrapperForToken (343-360, write 356), setOracleForToken (365-382, write 378), setGaugeControllerForToken (387-408, write 404)
- **Origin:** [both] — phase1: evm-audit-general, evm-audit-access-control, evm-audit-bridges; phase2: access-control-agent, economic-security-agent, execution-trace-agent, invariant-agent, periphery-agent, first-principles-agent, asymmetry-agent, boundary-agent, flow-gap-agent (single most corroborated finding).
- **Confidence:** 85

**Description.** `setShareOFTForToken` guards its reverse map against cross-token theft:
```solidity
324  address reverseOwner = shareOFTToToken[_shareOFT];
325  if (reverseOwner != address(0) && reverseOwner != _token) {
326      revert ReverseMappingConflict(_shareOFT, reverseOwner, _token);
327  }
```
The four sibling core setters omit this guard entirely and clear-then-write unconditionally, e.g. setVault:
```solidity
296  address previous = tokenInfos[_token].vault;
297  _requireBindingWritable(_token, previous, _vault);
298  if (previous == _vault) return;
301  if (previous != address(0)) { delete vaultToToken[previous]; }
305  tokenInfos[_token].vault = _vault;
306  vaultToToken[_vault] = _token;
```
`_requireBindingWritable` (283-287) inspects only the **current token's** previous value, which is `address(0)` for a freshly registered token — so a first-time set on token B always passes even when `_vault` already reverse-maps to token A.

**PoC (step-by-step).**
1. Authorized factory: `registerToken(A,…)`; `setVault(A, V)` → `tokenInfos[A].vault = V`, `vaultToToken[V] = A`.
2. Same/any authorized factory: `registerToken(B,…)`; `setVault(B, V)`.
   - Line 293 `tokenInfos[B].token != 0` ✓; line 294 `V != 0` ✓.
   - Line 296 `previous = tokenInfos[B].vault = address(0)`.
   - Line 297 `_requireBindingWritable(B, 0, V)` returns immediately (existing==0, line 284).
   - Line 298 `previous == V` false; line 301 delete skipped (previous==0).
   - Line 305-306 execute: `tokenInfos[B].vault = V`, `vaultToToken[V] = B`.
3. Final state: `vaultToToken[V] = B` while `tokenInfos[A].vault` is still `V` (A's forward binding is one-shot frozen). `getTokenForVault(V)` (781) now returns B; `isRegisteredVault(V)` (788, documented gauge-voting registry gate) still true but attributed to the wrong token.

The identical call on `setShareOFTForToken` reverts at 325-327 — proving the guard was intended everywhere and its omission here is an oversight. The same trace corrupts `wrapperToToken` (356), `oracleToToken` (378), `gaugeControllerToToken` (404). Note: only `vaultToToken` has an in-contract reader; the wrapper/oracle/gauge reverse maps have no in-scope reader, so their exploit impact depends on out-of-scope consumers — but the desync is real and permanent (both bindings are one-shot frozen after the write).

**Recommendation.** Add the setShareOFTForToken guard to all four setters before the reverse-map write, e.g.:
```solidity
address reverseOwner = vaultToToken[_vault];
if (reverseOwner != address(0) && reverseOwner != _token) revert ReverseMappingConflict(_vault, reverseOwner, _token);
```

---

### F2 — [Medium] setAgentIntegrationMeta has no registration, one-shot, or conflict gate — any authorized factory can overwrite lane metadata (vaultKind, taxRecipient, nativeAgentVault) for any address
- **Category:** missing-one-shot-gate / access-asymmetry
- **Location:** Registry4626.sol setAgentIntegrationMeta (1111-1118), consumed by getVaultKind (1124-1128) / getAgentIntegrationMeta (1120-1122)
- **Origin:** [both] — phase1: evm-audit-general (Low), evm-audit-access-control (Medium), evm-audit-bridges (Medium); phase2: trust-gap-agent (Medium), flow-gap-agent (Medium), plus access-control/economic/invariant/periphery/boundary leads.
- **Confidence:** 72

**Description.** Every other per-token setter first requires `tokenInfos[_token].token != address(0)` (registration) and the five core bindings are one-shot. setAgentIntegrationMeta requires only a non-zero token address and performs a blind full-struct overwrite:
```solidity
1111  function setAgentIntegrationMeta(address token, AgentIntegrationMeta calldata meta)
1112      external onlyAuthorizedOrOwner {
1115      if (token == address(0)) revert ZeroAddress();
1116      agentIntegrationMetas[token] = meta;
1117      emit AgentIntegrationMetaSet(token, meta.vaultKind);
1118  }
```
This is the sole source of `getVaultKind` (Creator/Agent lane classification) and carries economically load-bearing fields (`taxRecipient`, `taxAccountingAdapter`, `nativeAgentVault`, `pairToken`). It can be (a) written for tokens never registered, and (b) freely overwritten on a live token at any time — exactly the post-registration factory power the one-shot model (M-08) was designed to remove.

**PoC.**
1. Token A is live with `meta.taxRecipient = teamTreasury` (set once).
2. Any authorized factory (a different lane factory, or the original with a compromised key) calls `setAgentIntegrationMeta(A, meta{vaultKind: Agent, taxRecipient: attacker, taxAccountingAdapter: attacker, nativeAgentVault: attacker, …})`.
3. Line 1116 overwrites the struct wholesale — no `BindingAlreadySet`, no owner-only gate, no conflict check. The identical actor calling `setVault(A, attackerVault)` would revert with `BindingAlreadySet`.
4. Downstream tax-routing consumers reading `getAgentIntegrationMeta(A).taxRecipient` send fees to the attacker; `getVaultKind(A)` can be flipped between lanes. `getVaultKind` also silently returns Creator when unset (1126-1127), so consumers cannot distinguish "unset" from "explicitly Creator."

The completion of the economic exploit is in out-of-scope consumers, hence Medium (not High). The in-scope defect — inconsistent gating on an economically sensitive setter — is confirmed.

**Recommendation.** Require `tokenInfos[token].token != address(0)`; route mutation of an already-populated meta through the `_requireBindingWritable` / `liveRebindEnabled` owner-only path (or make the sensitive fields one-shot with a dedicated owner-only update). Emit the full struct for auditability.

---

### F3 — [Medium] Remote OFT peer setters lack the one-shot/rebind gate — an authorized factory can repoint a token's existing peer and change cross-chain attribution
- **Category:** missing-one-shot-gate
- **Location:** Registry4626.sol setRemoteOFTPeer (519-550), setRemoteOFTPeerBytes32 (627-653)
- **Origin:** [both] — phase1: evm-audit-access-control (Medium), evm-audit-bridges (Low); phase2: access-control-agent (lead), flow-gap-agent (Medium), trust-gap-agent (lead).
- **Confidence:** 60

**Description.** Unlike the five core bindings, neither remote-peer setter calls `_requireBindingWritable`. The only cross-token protection is the single-valued conflict guard (541-544 / 645-648), which merely refuses to point a **new** peer at a **different** token — it does not stop repointing a token's **own** existing `(token, eid)` peer to a fresh address.

**PoC.**
1. Authorized factory: `setRemoteOFTPeer(A, 30184, OFT1)` → `remoteOFTToToken[OFT1] = A`.
2. Later (compromised factory) `setRemoteOFTPeer(A, 30184, OFT2)` where OFT2 is unclaimed:
   - Line 528 `oldRemoteOFT = OFT1`; line 532 `remoteOFTToToken[OFT1] == A` so it is deleted (533) — OFT1 orphaned.
   - Not a new eid → no push; line 541 `reverseOwner = remoteOFTToToken[OFT2] = 0` → conflict guard passes.
   - Lines 546-547: `remoteOFTPeers[A][30184] = OFT2`, `remoteOFTToToken[OFT2] = A`.
3. Inbound messages from the still-legitimate OFT1 now resolve `getTokenForRemoteOFT(OFT1) == 0` (attribution lost); attacker-chosen OFT2 becomes the trusted peer for A. Same trace for the bytes32/Solana path (627-653).

Attribution correctness ultimately depends on out-of-scope lottery/composer consumers, so Medium not High.

**Recommendation.** If remote peers are meant to be as immutable as core bindings, gate replacement of an already-set `(token, eid)` peer through `_requireBindingWritable` (owner-only under `liveRebindEnabled`). Otherwise document explicitly that any authorized factory may repoint peers and ensure downstream attribution tolerates it.

---

### F4 — [Medium] Remote reverse-map (attribution) is wiped for a still-live peer when one OFT address serves multiple EIDs of the same token
- **Category:** desynchronized-coupling / reverse-map-corruption
- **Location:** Registry4626.sol setRemoteOFTPeer repoint delete (532-534), removeRemoteOFTPeer unconditional delete (562), removeRemoteOFTPeerBytes32 unconditional delete (665)
- **Origin:** [both] — phase1: evm-audit-general (Medium); phase2: invariant-agent (Low), first-principles-agent (Medium), trust-gap-agent (Medium), flow-gap-agent (Low).
- **Confidence:** 68

**Description.** `remoteOFTToToken` is keyed by peer address only, not by `(token, eid)`. The write path explicitly permits the same address across multiple EIDs of one token (line 542 passes when `reverseOwner == _token`), which is realistic because deterministic CREATE2/CREATE3 OFT deployments share the same address across chains. But `removeRemoteOFTPeer` deletes the reverse entry **unconditionally**:
```solidity
561  delete remoteOFTPeers[_token][_chainEid];
562  delete remoteOFTToToken[remoteOFT];
```
It does not check whether another EID of the same token still forward-references `remoteOFT`. Note this is inconsistent with the deliberately conditional delete the write path already applies (F-11, lines 530-534) — and even that conditional check is insufficient because it only checks token ownership, not remaining EID references.

**PoC.**
1. `setRemoteOFTPeer(A, 30110, X)` → chains=[30110], `remoteOFTToToken[X]=A`.
2. `setRemoteOFTPeer(A, 30111, X)` (same deterministic address X on a second chain) → eid 30111 pushed; `reverseOwner==A` passes; `remoteOFTToToken[X]=A`, chains=[30110,30111].
3. `removeRemoteOFTPeer(A, 30110)` → line 562 unconditionally `delete remoteOFTToToken[X]`.
4. Final state: `remoteOFTPeers[A][30111] == X` still live, but `getTokenForRemoteOFT(X) == address(0)`. An inbound cross-chain lottery entry from X on eid 30111 can no longer be attributed to creator A (dropped/misrouted). **Escalation:** the now-free reverse entry can be captured by a second factory via `setRemoteOFTPeer(attackerToken, eidN, X)` (conflict guard passes since `remoteOFTToToken[X]==0`), reattributing X's inbound entries to the attacker's token. The bytes32/Solana path (665) is identical.

**Recommendation.** Before deleting `remoteOFTToToken[remoteOFT]` (lines 532-534, 562) and the bytes32 equivalent (665), scan `remoteOFTChains[_token]` and only delete the reverse entry when no other EID of the token still references that address.

---

### F5 — [Low] setRemoteOFTPeer (EVM path) accepts `_chainEid == 0` while the bytes32 path rejects it
- **Category:** missing-input-validation / asymmetry
- **Location:** Registry4626.sol setRemoteOFTPeer (519-538) vs setRemoteOFTPeerBytes32 (633)
- **Origin:** [both] — phase1: evm-audit-general (Low), evm-audit-bridges (Low); phase2: asymmetry-agent (Low), plus access-control/invariant/boundary/numerical-gap leads.
- **Confidence:** 85

**Description.** `setRemoteOFTPeerBytes32` enforces `require(_chainEid != 0, "Invalid chain EID")` (633), but the EVM `setRemoteOFTPeer` performs no such check (only registration 524 and non-zero address 525). A peer can be registered under EID 0: `remoteOFTPeers[_token][0]=X`, `0` pushed into `remoteOFTChains` (537), `remoteOFTToToken[X]=_token`. EID 0 is not a valid LayerZero endpoint id and is also the value `getEidForChainId` returns for any unconfigured chain, so a consumer resolving a peer by a defaulted eid=0 could pick up this bogus entry.

**PoC.** `setRemoteOFTPeer(T, 0, X)` succeeds; `getRemoteOFTChains(T)` includes 0 and `getRemoteOFTPeer(T,0)==X`. The identical bytes32 call reverts at 633.

**Recommendation.** Add `if (_chainEid == 0) revert(...)` at the top of setRemoteOFTPeer to match the bytes32 variant.

---

### F6 — [Low] Stale eidToChainId reverse entries after remapping a chain's EID (setChainIdToEid / setLzConfig)
- **Category:** bijection-desync
- **Location:** Registry4626.sol setChainIdToEid (930-935), setLzConfig (996-998)
- **Origin:** [both] — phase1: evm-audit-general (Low), evm-audit-bridges (Low); phase2: boundary-agent (lead), periphery-agent (lead).
- **Confidence:** 75

**Description.** Both setters write `chainIdToEid[chainId]=newEid` and `eidToChainId[newEid]=chainId` but never clear the previous `eidToChainId[oldEid]`:
```solidity
931  chainIdToEid[_chainId] = _eid;
932  eidToChainId[_eid] = _chainId;
```
After remapping a chain's EID, the old reverse entry still resolves. The map is no longer a clean bijection.

**PoC.** Constructor seeds `8453 → 30184` / `eidToChainId[30184]=8453`. Owner calls `setChainIdToEid(8453, 40000)`. Now `chainIdToEid[8453]=40000` and `eidToChainId[40000]=8453`, but `eidToChainId[30184]` is still `8453` — `getChainIdForEid(30184)` (942) wrongly returns 8453. Any consumer resolving a chainId from an inbound message's source EID can map a retired EID to the wrong chain.

**Recommendation.** Before overwriting, read `oldEid = chainIdToEid[_chainId]`; if non-zero and `!= _eid`, `delete eidToChainId[oldEid]`. Apply in both functions.

---

### F7 — [Low] Ownership is one-step and renounceable — mistyped transfer or renounce permanently bricks all owner-gated config and the M-08 emergency rebind
- **Category:** centralization / permanent-DoS footgun
- **Location:** Registry4626.sol line 13 (inherits OZ `Ownable`), constructor 189; affects every onlyOwner path and the owner branch of onlyAuthorizedOrOwner / _requireBindingWritable
- **Origin:** [phase1] — evm-audit-general, evm-audit-access-control, evm-audit-bridges, evm-audit-dos (all Low). Not raised as a Phase-2 finding.
- **Confidence:** 85

**Description.** The contract inherits plain `Ownable` (not `Ownable2Step`) and does not override `renounceOwnership`. Owner is the sole principal for `setLiveRebindEnabled`, all core-binding rebinds, all chain/LZ/ecosystem config, `setAuthorizedFactory`, `approveFactoryCodehash`, and all remote-peer removals.

**PoC.**
- Renounce: `renounceOwnership()` → `owner() == address(0)`. Every onlyOwner call reverts forever; `liveRebindEnabled` can never be toggled, so a wrongly-set-but-nonzero core binding is frozen permanently with no recovery, and no peer can be removed.
- Transfer: `transferOwnership(wrongAddr)` hands sole control to an unintended/uncontrolled address in one tx with no accept step.

Requires an owner mistake or key compromise (not third-party reachable), hence Low, but the impact is permanent and irreversible.

**Recommendation.** Adopt `Ownable2Step` (two-step accept) and override `renounceOwnership` to revert, since the registry requires a live owner for ongoing operation and emergency rebinds.

---

### F8 — [Low] Factory codehash pin is enforced on deauthorization — a factory whose bytecode changed cannot be revoked in one call
- **Category:** access-control / incident-response gap
- **Location:** Registry4626.sol setAuthorizedFactory (212-224, pin check 214-221)
- **Origin:** [both] — phase1: evm-audit-access-control (Low), evm-audit-dos (Low); phase2: periphery-agent (lead).
- **Confidence:** 80

**Description.** The codehash pin check (214-221) precedes the write at 222 regardless of `_authorized`, so it runs on deauthorization too:
```solidity
214  bytes32 expected = approvedFactoryCodehashes[_factory];
215  if (expected != bytes32(0)) {
217      assembly { actual := extcodehash(_factory) }
220      if (actual != expected) revert FactoryCodehashMismatch(_factory, expected, actual);
221  }
222  authorizedFactories[_factory] = _authorized;
```
If a pinned factory's bytecode later changes (proxy impl swap, redeploy at same address, selfdestruct→0), `setAuthorizedFactory(F, false)` reverts — blocking the exact revocation the operator needs precisely because the code changed. A workaround exists (owner first calls `approveFactoryCodehash(F, 0)` to clear the pin, then revokes), so it is a non-obvious two-step footgun under incident pressure rather than a hard lockout.

**PoC.** `approveFactoryCodehash(F, hashV1)` + `setAuthorizedFactory(F, true)`; F's code becomes hashV2; `setAuthorizedFactory(F, false)` reverts `FactoryCodehashMismatch(F, hashV1, hashV2)` — F keeps write access until the pin is cleared.

**Recommendation.** Skip the codehash check when `_authorized == false` (only enforce the pin when granting), or add a dedicated unconditional revoke path. Deauthorization should never be blockable by a bytecode mismatch.

---

### F9 — [Low] setCanonicalWallet is first-writer-wins with no proof of wallet control — a creator can squat a victim's predictable wallet address to permanently block them
- **Category:** griefing-dos
- **Location:** Registry4626.sol setCanonicalWallet (430-459, 1:1 guard 440-443)
- **Origin:** [phase2] — economic-security-agent (Medium, conf 0.6); periphery-agent & trust-gap-agent leads. Re-examined this pass; kept at Low.
- **Confidence:** 50

**Description.** `setCanonicalWallet` is reachable by the lowest-privilege role (a token's creator) and accepts any non-zero `_wallet` with no proof the caller controls it. Combined with the 1:1 reverse-map guard:
```solidity
440  address existing = canonicalWalletToToken[_wallet];
441  if (existing != address(0) && existing != _token) {
442      revert CanonicalWalletAlreadyInUse(_wallet, existing);
443  }
```
a malicious creator (of an unrelated registered token) can claim a victim's known deterministic ERC-4337/CREATE2 wallet address first, permanently blocking the legitimate creator from binding it (their call reverts `CanonicalWalletAlreadyInUse`). Only the squatter can release it.

**PoC.** Victim B's canonical wallet W is a deterministic address computable before B binds it. Attacker A (owner of registered tokenA) calls `setCanonicalWallet(tokenA, W)` — passes (436 creator check, 440 no conflict), writes `canonicalWalletToToken[W]=tokenA`. When B calls `setCanonicalWallet(tokenB, W)`, line 441 sees `existing=tokenA != tokenB` → reverts. B is permanently blocked.

**Re-examination note.** The dev comment at 438-439 explicitly acknowledges the hijack tradeoff and deliberately chose first-writer-wins, so this is partly by-design. It requires the attacker to control a registered token (factory-gated registration) and to predict the victim's address, and the concrete downstream harm lives in the out-of-scope lottery/attribution consumer. Kept at Low with this caveat; treat as a design decision to confirm with the client rather than a clear defect.

**Recommendation.** Require proof of control of `_wallet` (EIP-1271 signature, or `msg.sender == _wallet`), or scope reverse-map uniqueness so squatting an unbound arbitrary address cannot deny another creator.

---

### F10 — [Low] Unbounded remote-OFT getters and swap-pop removal loops have no bounded/paginated alternative (block-gas DoS)
- **Category:** gas-dos
- **Location:** Registry4626.sol getAllRemoteOFTPeers loop (607), getAllRemoteOFTPeersBytes32 loop (705), removeRemoteOFTPeer loop (566), removeRemoteOFTPeerBytes32 loop (668); growth via setRemoteOFTPeer push (537) / setRemoteOFTPeerBytes32 push (638)
- **Origin:** [phase1] — evm-audit-dos (Low). Not raised in Phase 2.
- **Confidence:** 58

**Description.** `remoteOFTChains[_token]` / `remoteOFTChainsBytes32[_token]` grow one entry per distinct EID, pushed by any authorized factory. Unlike `registeredTokens` (which got `getTokensPaginated` per fix F-25), the remote-peer arrays have no bounded read path, and the owner-only removal functions linearly scan the array. If a token accumulates a very large number of EIDs (cheap on L2s), on-chain consumers calling `getAllRemoteOFTPeers*` revert out-of-gas, and `removeRemoteOFTPeer*` can exceed the block gas limit — permanently locking a stale `remoteOFTToToken` reverse entry. Growth is privileged-gated (factory/owner), so Low.

**PoC.** Authorized factory calls `setRemoteOFTPeer(token, eid_i, oft_i)` across a large range of distinct eids. `remoteOFTChains[token]` grows to N; `removeRemoteOFTPeer(token, targetEid)` loop at 566 reverts out-of-gas → the peer and its reverse mapping can never be removed; `getAllRemoteOFTPeers(token)` also reverts.

**Recommendation.** Add paginated variants mirroring `getTokensPaginated`, store each EID's index for O(1) swap-pop removal without a linear scan, and consider a per-token cap on remote EIDs.

---

## Leads (confidence < 50 — reported but not raised to findings)

- **getTokensPaginated integer overflow on `offset + limit` (754-763).** `uint256 end = offset + limit` can wrap for a huge `limit`; the subsequent `if (end > total)` does not correct a wrapped value, and `new address[](end - offset)` then reverts. **Confidence 20** — pure `view`, both operands are the caller's own arguments, self-inflicted revert only, no state/value/third-party harm. Origin: [both] phase1 evm-audit-precision-math, phase2 math-precision-agent. Nit: clamp with `limit > total - offset ? total : offset + limit`.
- **removeRemoteOFTPeerBytes32 omits the registration check (658-662)** present in removeRemoteOFTPeer (556). **Confidence 40** — owner-only and reverts on unset peer (662 `require(oldPeer != bytes32(0))`), so no exploitable harm; consistency nit only. Origin: [both] phase1 evm-audit-bridges (Info), phase2 access-control-agent lead. Add the `TokenNotRegistered` guard for parity.
- **setPoolForToken has no zero-check on `_pool`, no non-zero check on `_poolFee`, and no one-shot gate (498-505).** Registration-time pool is likewise unvalidated. **Confidence 40** — owner-only; downstream DEX-routing impact unverified (out of scope). Origin: [phase2] invariant-agent lead.
- **setOmnichainVaultMesh has no one-shot gate (465-493).** An authorized factory can overwrite an already-configured mesh after Solana eligibility is live, redirecting Solana routing to attacker mesh addresses. **Confidence 45** — full-population guard (472-480) is enforced, but overwrite is unrestricted; economic impact depends on the out-of-scope Solana router/composer. Origin: [phase2] trust-gap-agent lead. Consider a one-shot/owner-only gate consistent with the core bindings.

---

## Info / Notes

- **No value-moving path exists.** The contract holds no funds, makes no token transfers/approvals, no oracle reads, no LZ send/quote, no delegatecall/call/create. The only EVM-level outbound is `extcodehash` (deterministic, no call frame). Classic reentrancy / hostile-return / fund-loss analysis is inapplicable. This structurally caps all findings at Medium.
- **getVaultKind silent default (1124-1128)** collapses "unset" and "explicitly Creator" to `VaultKind.Creator`; consumers cannot distinguish them (folded into F2).
- **Getters never revert for unregistered tokens** — they return zero-value structs/addresses. Guarded boolean reads (`isTokenActive`, `isSolanaDepositEligible`, `isChainSupported`, `isRegisteredVault`) do return false on unset. Out-of-scope consumer responsibility to distinguish unset from valid.
- **chainlinkNativeFeed** (ChainConfig) is never written by any function — always `address(0)` after registerChain. Open question whether a setter exists elsewhere or the field is vestigial.
- **wrappedNativeSymbol** is only set at registration from `_getDefaultWrappedNativeSymbol`; no update path.
- Prior audit fixes verified present and correct: F-25 (getTokensPaginated), F-11 (conditional reverse delete on peer write path — note F4 shows it is still insufficient for multi-EID reuse), I-3 (uint256 chainId in setLzConfig), M-08 (one-shot binding model), M-NEW-03 (reverse conflict guard on shareOFT / canonicalWallet / remote peers — note F1 shows it is missing on the four other core setters), M17 (codehash pin — note F8 deauth edge).
