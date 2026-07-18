# Security Review — CreatorOVault + CreatorOVaultCoreModule

**Audit date**: 2026-07-18
**Methodology**: Two-phase audit v2 (context → ethskills breadth → pashov depth, blind → hybrid reconciliation)
**Target**: Solidity source bundle supplied by client (`https://litter.catbox.moe/porq6l.md`), NOT `github.com/wenakita/CreatorVault` (explicitly out of scope per client instructions — that repo's `contracts/vault/CreatorOVault.sol` is a legacy Jan-2026 single-file vault, superseded by this modular version).

## Scope

| | |
|---|---|
| **Files reviewed** | `contracts/creator/vault/CreatorOVault.sol` (2299 LOC) |
| | `contracts/creator/vault/modules/CreatorOVaultCoreModule.sol` (1204 LOC) |
| | `contracts/shared/vault/modules/OVaultModuleStorage.sol` (217 LOC) |
| **Total in-scope LOC** | ~3,720 |
| **Out of scope (referenced, not audited)** | `OVaultModuleBase`, `_strategiesModule`/`_adminModule` implementations, `IStrategy`, `IStrategyValuation`, `OVaultLiquidityLib`, `OVaultModuleConstants`, `IOVaultImpairmentClaims`, `IOVaultRecoveryEscrow`, CCA lifecycle readers |
| **Solidity version** | 0.8.30 |

Note for the client: this scope is part of the same protocol family as a prior audit referenced in-source (`docs/audits/CreatorOVault_aristotle`, cited in fix comments such as "FIX: M-2", "FIX: H-01", "FIX: C-2/C-3", "FIX: I-01" through "I-04", "FIX: S-C02", "FIX: L-01/L-03/L-06/L-07"). Per this engagement's instructions, this audit was run fully fresh — no findings below were sourced from or informed by that prior report; every finding here comes from this job's own phase-0 protocol map and independent phase-1/phase-2 agent runs. Several fix-comments in the source show that some issues found by earlier audit passes have already been remediated (e.g. the I-04 flash-loan-resistant baseline-delta fix, the C-2/C-3 impairment-claim supply cap and false-alarm root zeroing, the H-03 queue-reset guard). This audit surfaces what remains, plus new findings this pass identified independently.

## Methodology summary

- **Phase 0 (context, opus)**: 3 parallel agents built an access-control inventory, protocol/storage map, and external-surface map — no findings, pure structural context, later injected into all hunting agents.
- **Phase 1 (breadth, opus — large-scope default)**: 8 domain checklist agents (general, precision-math, erc4626, erc20, proxies, signatures, access-control, dos) from the local `evm-audit-skills` library.
- **Phase 2 (depth, opus, blind to phase-1 findings)**: 13 pashov attack-specialty agent runs (12 distinct specialties + 1 retry for an agent that failed its first attempt) — math-precision, access-control, economic-security, execution-trace, invariant, periphery, first-principles, asymmetry, boundary, numerical-gap, trust-gap, flow-gap.
- **Phase 3 (reconciliation)**: cross-phase dedup, hybrid re-examination, and — notably — direct source-level verification by the orchestrator of every claim promoted to a Finding. This caught and corrected a mathematically-invalid exploit scenario independently proposed by 3 of the 13 phase-2 agents (see Finding 6 below) before it could be over-reported.

**Confidence and reporting floor**: every Finding below carries a `confidence` score (0-100). All Low severity and above are reported as Findings; anything with confidence < 50 is listed under **Leads** instead of being asserted as a confirmed issue.

**Reconciliation summary**: 6 issues found independently by both phase 1 and phase 2 (overlap) · ~19 phase-1-only issues · 5 phase-2-only issues · 1 phase-2-majority claim (3 of 13 agents) demoted from "attacker-profit Finding" to a precondition-qualified Low after orchestrator re-derivation · Coverage holes closed this pass: 0 (both phases' combined coverage already answered every entrypoint/threat-catalog row; see Coverage Gate below).

---

## Access-Control Inventory (summary)

Full per-function detail was produced in phase 0; condensed here to roles and the entrypoints most relevant to findings.

| Role | Grant / Revoke | Key powers |
|---|---|---|
| **Owner** | OZ `Ownable`, 1-step `transferOwnership`/`renounceOwnership` | Superset of all roles; one-time `setModulesOnce`; whitelist; gauge/CCA/burnStream wiring; operator perm grants; rescue config |
| **Management** | 2-step (`setPendingManagement` → `acceptManagement`) | Strategy add/remove/weight/migrate; fee/risk scheduling; impairment root propose/finalize; `injectCapital`; `syncBalances` |
| **Keeper** | `setKeeper` (onlyManagement) | `report`, `tend`, `deployToStrategies`, `rebalanceStrategies`, `notifyImpairmentRecovery` |
| **EmergencyAdmin** | `setEmergencyAdmin` (onlyManagement) | `shutdownVault`, `emergencyWithdraw*` (arbitrary-recipient drain) |
| **ImpairmentGuardian** | `setImpairmentGuardian` (onlyOwner) | `tripImpairment`/`clearImpairmentTrip`; **also** counted as emergency-authorized (see Finding: AC-2 below) |
| **GaugeController / BurnStream** | onlyOwner setters | `burnSharesForPriceIncrease` — verified self-burn only, not an arbitrary-holder-burn vector |
| **DebtPurchaser, ProtocolRescue, Operators** | various | `buyDebt`; timelocked ownership rescue; scoped deposit/withdraw/activate bitmask |

**Permissionless entrypoints** (by design): `deposit`/`mint`/`redeem`/`withdraw`/queue cluster, `clearStaleImpairmentTrip`, `challengeImpairmentRoot`, `mintImpairmentClaim`, `claimImpairmentRecovery`, `permit`/`permitOperator`, standard ERC20 transfer/approve. **`acceptManagement`** has no visible guard at the wrapper — its safety is entirely delegated to the out-of-scope adminModule (see Finding AC-3).

---

## Threat Model (summary)

| Actor | Reaches | Could gain | Status |
|---|---|---|---|
| Any caller | `challengeImpairmentRoot` | Indefinitely block impairment finalization | **Addressed by Finding 1 (High)** |
| Any caller w/ claim balance | `claimImpairmentRecovery` | Drain escrow beyond fair share via a transferable claim token | **Addressed by Finding 3 (Medium, qualified)** |
| Any redeemer | `redeem`/`withdraw` timed around a reverting strategy valuation | Exit at a stale, debt-inflated NAV | **Addressed by Finding 5 (Medium)** |
| Any redeemer | `redeem` when queue reservation binds | Burn full shares, receive capped payout | **Addressed by Finding 6 (Low, precondition-qualified)** |
| Any holder | `queueWithdrawal` warm-slot | Bypass large-withdrawal delay for a second batch | **Addressed by Finding 2 (Medium)** |
| Sync withdrawer | `withdraw` | Consume liquidity reserved for queued withdrawers | **Addressed by Finding 4 (Medium)** |
| Keeper (compromised or honest-but-imprecise) | `notifyImpairmentRecovery` | Manufacture a phantom loss / mis-record recovery amount | **Addressed by Findings 7 &amp; 12 (Medium/Medium)** |
| Any redeemer | withdrawal loop pulling from an impaired (side-pocketed) strategy | Undermine the impairment quarantine | **Addressed by Finding 8 (Low-Medium)** |
| Compromised ImpairmentGuardian | `emergencyWithdraw` (via `onlyEmergencyAuthorized`) | Arbitrary-recipient drain from a role scoped for incident response, not treasury | **Addressed by Finding 9 (Medium)** |
| Anyone (if adminModule guard is missing) | `acceptManagement` | Seize the management role | **Flagged as unresolved open question (OQ-2) — cannot be closed without adminModule source; noted, not asserted as a confirmed finding** |
| Strategy (malicious/compromised) | `IStrategy.getTotalAssets`/`deposit`/`withdraw` | Manipulate reported assets | **Invariant holds** — clamped to `strategyMaxAssets`/`strategyDebt` (verified by 2 independent phase-1 agents) |
| Owner (one-time) | `setModulesOnce` | Wire a storage-incompatible module | **Invariant holds today** (field-by-field storage diff verified byte-correct) but the version-check mechanism is self-attested, not structural — **Finding 13 (Low, process risk)** |
| GaugeController/BurnStream | `burnSharesForPriceIncrease` | Burn arbitrary holders' shares | **Invariant holds** — verified self-burn only via direct source read |
| Any caller | direct call to deployed `CoreModule` bypassing the vault | Bypass vault-level guards | **Unresolved (OQ-3)** — `onlyDelegateCall`'s implementation is in the out-of-scope `OVaultModuleBase`; cannot be verified from this scope |
| Any depositor | Direct token donation | Trip the per-tx price-change breaker | **Addressed by Finding 11 (Low)** |
| Compromised Management | `proposeImpairmentRoot` | Shortchange claimants via root content | **Trust boundary — Management is a fully-trusted role by design; only the challenge window (itself the subject of Finding 1) provides a check** |

---

## Findings

### [1] Permissionless `challengeImpairmentRoot` enables indefinite griefing of impairment finalization and permanent claim destruction
**Severity**: High | **Confidence**: 95 | **Origin**: `[both]` — independently found by 2 phase-1 agents (DOS, access-control) and 7 of 13 phase-2 agents (access-control-retry, boundary, periphery, flow-gap, first-principles as full findings; math-precision, execution-trace as leads). The single most-corroborated item in this audit.

**Location**: `challengeImpairmentRoot()` — `contracts/creator/vault/modules/CreatorOVaultCoreModule.sol:1069-1078`; `clearImpairmentRootAfterChallenge()` — same file, `:1080-1091`; `proposeImpairmentRoot()` — `:1045-1067`; `finalizeImpairment()` — `:1093-1110`; `clearStaleImpairmentTrip()` — `:1009-1021`

```solidity
function challengeImpairmentRoot(uint256 epochId, string calldata reason) external onlyDelegateCall {
    ImpairmentEpoch storage epoch = impairmentEpochs[epochId];
    ...
    impairmentRootChallenged[epochId] = true;
    ...
}
```

**Description**: `challengeImpairmentRoot` is fully permissionless, requires no bond or stake, and can be called by any address during a proposed root's challenge window (default 1 day). Once challenged, `finalizeImpairment` reverts with `ImpairmentRootChallengedErr`. The only recovery path, `clearImpairmentRootAfterChallenge` (Management-only), zeroes the root but leaves `epoch.status == Tripped`; Management must then call `proposeImpairmentRoot` again, which opens a **fresh** challenge window that the same attacker can challenge again — an unbounded propose → challenge → clear loop with no exit condition and no cost beyond gas. While this loops, the entire vault sits in `VaultMode.Suspect`, where `deposit`/`mint`/`redeem`/`withdraw`/`claimQueuedWithdrawal` all revert `VaultNotNormal` — a full deposit/withdrawal freeze for every holder, not just those affected by the impairment. The eventual escape route, the permissionless `clearStaleImpairmentTrip` (fires after `maxImpairmentTripDuration`, bounded 3-30 days, measured from the immutable `trippedAt`), force-resolves the epoch by **zeroing** `snapshotRoot`, `totalClaimSupply`, and `recoveryAsset` — converting the attacker's persistent challenging into a permanent denial of the impairment recovery mechanism, since `mintImpairmentClaim`/`notifyImpairmentRecovery`/`claimImpairmentRecovery` all hard-revert against a zeroed epoch thereafter.

A related facet (found independently by 3 agents): even *without* a malicious challenger, the stale-clear valve has no carve-out for a root that has already passed its challenge window unchallenged and is simply awaiting Management's `finalizeImpairment` call — if Management is merely slow, a legitimately finalize-able root is destroyed identically to a genuinely-abandoned one the moment `maxImpairmentTripDuration` elapses.

**Proof of Concept** (verified against source by 9 independent agent runs plus orchestrator spot-check):
1. Owner/Guardian legitimately calls `tripImpairment(strategy, reasonCode)` → `vaultMode = Suspect`, all deposits/withdrawals frozen protocol-wide.
2. Management calls `proposeImpairmentRoot(epochId, root, totalClaimSupply, recoveryAsset)` → `impairmentRootUnlockTime = now + impairmentChallengeWindow`.
3. Attacker (any EOA, no special access) calls `challengeImpairmentRoot(epochId, "")` before the window closes → `impairmentRootChallenged[epochId] = true`.
4. `finalizeImpairment(epochId)` reverts. Management calls `clearImpairmentRootAfterChallenge(epochId)` (zeroes root, resets challenge flag, `status` stays `Tripped`) and re-proposes.
5. Attacker challenges the new root. Repeat until `maxImpairmentTripDuration` elapses.
6. Attacker (or anyone) calls `clearStaleImpairmentTrip(epochId)` → epoch force-resolved with root/claimSupply/recoveryAsset zeroed. `mintImpairmentClaim`/`notifyImpairmentRecovery`/`claimImpairmentRecovery` permanently revert for this epoch. Impaired-strategy snapshot holders receive nothing through the on-chain recovery mechanism.

**Recommendation**: Require an economic bond on `challengeImpairmentRoot`, slashed when Management subsequently clears the challenge as unfounded (or route disputed challenges through an on-chain arbitration step rather than a unilateral, cost-free Management clear). Cap the number of challenge → re-propose cycles per epoch. Separately, either (a) do not zero the root on `clearImpairmentRootAfterChallenge` — only clear the challenge flag, letting Management finalize the same root after re-review — and/or (b) advance the stale-clear deadline whenever a root is (re-)proposed, so a pending, undisputed-on-the-merits root cannot be destroyed purely by the liveness valve running out from an earlier trip timestamp.

---

### [2] `queueWithdrawal`'s large-withdrawal delay only applies to the first deposit into a queue slot
**Severity**: Medium | **Confidence**: 90 | **Origin**: `[phase2]` execution-trace (finding), numerical-gap (lead) — orchestrator-verified directly against source.

**Location**: `queueWithdrawal()` — `contracts/creator/vault/modules/CreatorOVaultCoreModule.sol:491-520`

```solidity
QueuedWithdrawal storage queued = queuedWithdrawals[msg.sender];
// FIX: H-03 — only set unlock time on first queue, not subsequent calls
if (queued.shares == 0) {
    queued.unlockBlock = unlockBlock;
}
...
queued.shares += shares;
```

**Description**: The `largeWithdrawalDelayBlocks` unlock timestamp is stamped only the first time a caller queues into an empty slot (a deliberate fix — `FIX: H-03` — for a prior reset-griefing issue). But this means any *subsequent* addition to an already-open slot inherits the existing `unlockBlock` with **no extension**. A holder can pre-seed a threshold-sized "warm slot" (queue an amount ≥ `largeWithdrawalThreshold`), wait out the delay once, then — in the same transaction the delay elapses — add an arbitrarily large second batch and immediately call `claimQueuedWithdrawal()`, which checks only `block.number >= queued.unlockBlock` (already satisfied). The second, potentially much larger batch experiences zero incremental delay, defeating the MEV/flash-loan protection the queue exists to provide.

**Proof of Concept**: At block N, queue `threshold`-sized shares → `unlockBlock = N+10`. At block N+10 (delay elapsed for the first batch), queue a much larger `hugeAmount` in a second call → `queued.shares > 0`, so `unlockBlock` stays `N+10` (already satisfied this block) → `claimQueuedWithdrawal()` in the same block succeeds for the full combined amount, including the just-added huge batch, with zero delay on that portion.

**Recommendation**: On every addition, extend rather than skip: `queued.unlockBlock = max(queued.unlockBlock, block.number + largeWithdrawalDelayBlocks)`.

---

### [3] `claimImpairmentRecovery` ties payout entitlement to a live, potentially transferable external token balance while tracking "already claimed" per caller address
**Severity**: Medium (qualified — see caveat) | **Confidence**: 70 | **Origin**: `[both]` — phase-1 general checklist (GEN-2) plus 11 of 13 phase-2 agents independently converged on the identical mechanism, the highest cross-agent corroboration of any finding in this audit.

**Location**: `claimImpairmentRecovery()` — `contracts/creator/vault/modules/CreatorOVaultCoreModule.sol:1170-1188`

```solidity
uint256 claimUnits = IOVaultImpairmentClaims(impairmentClaims).balanceOf(msg.sender, epochId);
uint256 gross = (epoch.totalRecovered * claimUnits) / epoch.totalClaimSupply;
uint256 already = impairmentAmountClaimed[epochId][msg.sender];
uint256 amountOut = gross - already;
impairmentAmountClaimed[epochId][msg.sender] = gross;
```

**Description**: Entitlement (`claimUnits`) is read live from the external `IOVaultImpairmentClaims` contract's `balanceOf`. "Already paid" is tracked in a mapping keyed to the caller's address. These are two different identity domains that only stay consistent if the claim token is non-transferable. If it is transferable (the ERC-1155-style default), a holder can claim their pro-rata share, transfer their claim-token units to a fresh address (whose `already` counter is zero), and claim the identical pro-rata again — repeatable across any number of addresses. The user-supplied `claimUnits` function parameter is silently ignored, which only makes the reliance on a live, movable balance more explicit. No in-scope code caps cumulative payout (`epoch.totalClaimed`) against `epoch.totalRecovered`.

**The exploit chain is fully concrete and verified within this scope. The sole open variable is whether the out-of-scope `IOVaultImpairmentClaims` token is transferable** — that contract was not included in the audited source bundle, so this cannot be resolved from this engagement's scope. If transferable, this is a clean escrow-drain (severity: High/Critical). If soulbound/non-transferable, it is benign by construction.

**Proof of Concept** (assuming transferability): Epoch has `totalRecovered = R`, `totalClaimSupply = T`, Alice holds all `T` claim units. Alice calls `claimImpairmentRecovery`, receives `R`, sets `already[Alice] = R`. Alice transfers her `T` claim-token units to Bob. Bob calls `claimImpairmentRecovery`: `claimUnits = T`, `gross = R`, `already[Bob] = 0` → Bob also receives `R`. Repeat across N fresh addresses to extract `N × R` from an escrow funded with only `R`, until the escrow is drained and honest late claimants' `claimRecovery` calls revert against an empty escrow.

**Recommendation**: Confirm whether `IOVaultImpairmentClaims` is soulbound. If it is not, burn/consume claim-token units on claim (enforced in that external contract), or track cumulative payout against the token unit's identity rather than the calling address.

---

### [4] `withdraw()` omits the queued-withdrawal liquidity reservation that `redeem()` enforces
**Severity**: Medium | **Confidence**: 85 | **Origin**: `[phase2]` flow-gap — orchestrator-verified directly against source.

**Location**: `withdraw()` — `contracts/creator/vault/modules/CreatorOVaultCoreModule.sol:455-483`; contrast `redeem()` `:423-453` and the `previewRedeem` override — `contracts/creator/vault/CreatorOVault.sol:1290-1297`

```solidity
// withdraw() — CreatorOVaultCoreModule.sol:467
shares = IERC4626(address(this)).previewWithdraw(assets);   // uncapped, no queue-aware reservation
```
```solidity
// redeem() — CreatorOVaultCoreModule.sol:439
assets = IERC4626(address(this)).previewRedeem(shares);      // this one IS capped by the queue reservation
```

**Description**: `CreatorOVault.previewRedeem` is overridden to cap its return at `totalAssets() - reserved`, where `reserved` is the pro-rata value of `totalQueuedWithdrawalShares` — deliberately protecting liquidity earmarked for large withdrawals already sitting in the queue. `redeem()` uses this capped preview; `withdraw()` uses the standard, uncapped `previewWithdraw`, with no awareness of the reservation at all. A sync `withdraw()` call for any amount under `largeWithdrawalThreshold` can therefore freely consume idle/pullable coin that was implicitly reserved for queued withdrawers, since `_ensureCoin()` (the liquidity-sourcing helper both paths share) has no concept of the reservation either. The result is a priority inversion: two economically-equivalent exit paths for the same share class are policed by different liquidity rules, and the "protected" path (queue) is the one actually left exposed.

**Proof of Concept**: A queued withdrawer has reserved liquidity via `queueWithdrawal`. Before their `unlockBlock`, another holder calls `withdraw(assets)` for `assets` just under `largeWithdrawalThreshold`, repeatable across multiple holders/calls, draining idle coin and pullable strategy liquidity. When the queued withdrawer's `unlockBlock` arrives and they call `claimQueuedWithdrawal()`, `_ensureCoin` may be unable to source the deficit, causing `InsufficientBalance` and stranding their withdrawal until strategies unwind further.

**Recommendation**: Apply the same reservation cap to `withdraw` (mirror the `previewRedeem` override in a `previewWithdraw` override), or reinstate an explicit liquidity-aware `maxWithdraw` check.

---

### [5] `redeem`/`withdraw`/`claimQueuedWithdrawal` lack the strategy-valuation-readiness gate that `deposit`/`mint` enforce
**Severity**: Medium | **Confidence**: 75 | **Origin**: `[both]` — phase-1 general checklist (GEN-1), independently corroborated by phase-2's economic-security agent.

**Location**: `redeem()`/`withdraw()` — `contracts/creator/vault/modules/CreatorOVaultCoreModule.sol:423-485`; `_getStrategyAssetsSafe()` — `:267-282`; contrast `deposit()`/`mint()`'s `_requireStrategyValuationsReady(false)` call at `:351`/`:393`

**Description**: `deposit`, `mint`, and `report` all call `_requireStrategyValuationsReady`, which reverts if any active, non-impaired strategy's `isValuationReady()` returns false or its `getTotalAssets()` reverts — a fail-closed guard against pricing off a broken oracle. `redeem`, `withdraw`, and `claimQueuedWithdrawal` deliberately omit this gate (presumably to keep exits available even during an oracle outage). Separately, `_getStrategyAssetsSafe` is fail-open on a reverting valuation: it substitutes `strategyDebt[strategy]` (the last-known tracked debt, not a fresh, possibly-lower valuation). The combination means that while a strategy's valuation read is broken, deposits are correctly blocked, but withdrawals continue to price against the *debt-based, potentially stale/overstated* NAV — a first-mover advantage for anyone who exits while the strategy's real (lower) value is hidden behind a reverting oracle, with the shortfall socialized to remaining/later holders.

**Proof of Concept**: Strategy S has `strategyDebt = 100k`, real economic value has fallen to ~60k, and `S.getTotalAssets()` begins reverting (e.g. the strategy's own accounting broke alongside the loss). Deposits/mints correctly revert. `redeem`/`withdraw` still price off `totalAssets()`, which counts S at its full 100k tracked debt (fail-open fallback). Early redeemers extract more than their fair share of the true (60k) value; the 40k gap is borne by holders who exit after a keeper eventually `report()`s or ejects the strategy.

**Recommendation**: Apply `_requireStrategyValuationsReady(true)` (grace-aware) to `redeem`/`withdraw`/`claimQueuedWithdrawal`, or make `_getStrategyAssetsSafe` fail-closed (exclude, not substitute-debt) when a fresh valuation read reverts.

---

### [6] `redeem()` burns full shares but pays a liquidity-reservation-capped `previewRedeem` — real mechanism, but only reachable under a specific loss/fresh-deploy precondition
**Severity**: Low | **Confidence**: 80 | **Origin**: `[both]` — phase-1 (4626-2) plus 3 of 13 phase-2 agents raised this as a Finding with concrete numeric PoCs claiming exploitability in a healthy vault. **The orchestrator independently re-derived the underlying math and found those three PoCs mathematically invalid** — a fourth phase-2 agent (economic-security) reached the identical correction independently after tracing the arithmetic itself.

**Location**: `previewRedeem()` override — `contracts/creator/vault/CreatorOVault.sol:1290-1297`; `redeem()` — `contracts/creator/vault/modules/CreatorOVaultCoreModule.sol:439-448`

```solidity
function previewRedeem(uint256 shares) public view override returns (uint256) {
    uint256 assets = super.previewRedeem(shares);
    uint256 liquid = totalAssets();
    uint256 reserved = super.previewRedeem(totalQueuedWithdrawalShares);
    uint256 available = liquid > reserved ? liquid - reserved : 0;
    return assets > available ? available : assets;
}
```

**Description**: `redeem()` burns the caller's full `shares` but pays only the (possibly capped) `previewRedeem(shares)` — if the cap binds, the redeemer destroys shares worth more than they receive, with the difference silently redistributing to remaining supply. **Orchestrator's derivation**: with `T = totalAssets()`, `S = totalSupply()`, `O = 10^offset = 1000`, and `super.previewRedeem` linear per OZ's standard `convertToAssets`, the cap can only bind (beyond dust) for a redeemer `x` and queued reservation `Q` when `x + Q > S` is *approached* in value terms, which — because `x` and `Q` are disjoint subsets of `S` by construction (a share is either held by a user or parked in vault custody, never both) — reduces to requiring `S > T·O`, i.e. `totalSupply` exceeding `1000× totalAssets`. This ratio sits almost exactly at that boundary immediately after a vault's first deposit (by design of the virtual-share offset) and is exceeded specifically when the vault has sustained an uncompensated loss that shrinks `totalAssets` without a corresponding share burn. **The three agents' numeric examples (e.g. a "healthy" 200k-TVL vault) describe an unreachable state under share conservation and were incorrect as literally stated; the code pattern itself is real and becomes material precisely in the loss/fresh-deploy precondition identified above** — converging with phase-1's independent (and separately correct) conclusion.

**Recommendation**: Burn only the shares corresponding to the capped payout (recompute via `previewWithdraw(cappedAssets)` and burn that amount, refunding the remainder), or revert and force the queue path whenever the fair value exceeds available liquidity, so the burn-vs-payout mismatch cannot occur in any reachable state — including the narrow loss-precondition identified here.

---

### [7] `notifyImpairmentRecovery`'s vault-asset branch breaks the report-baseline symmetry every other outflow maintains
**Severity**: Medium | **Confidence**: 85 | **Origin**: `[phase2]` invariant agent — orchestrator-verified directly against source (grepped all baseline call sites).

**Location**: `notifyImpairmentRecovery()` — `contracts/creator/vault/modules/CreatorOVaultCoreModule.sol:1145-1168`

**Description**: `redeem`, `withdraw`, and `claimQueuedWithdrawal` all pair their coin outflow with a call to `_decreaseReportBaselineForPrincipalOutflow`, keeping `totalAssetsAtLastReport` in sync so that `report()`'s profit/loss calculation reflects only real yield, not principal movements (this delta-only discipline is itself a documented prior fix, `FIX: I-04`, against flash-loan baseline manipulation). `notifyImpairmentRecovery`'s vault-asset branch moves coin out of the vault via the identical `_pushCreatorCoinExact` mechanism but is **not** followed by any baseline adjustment — confirmed by checking every call site of `_decreaseReportBaselineForPrincipalOutflow`/`_increaseReportBaselineForPrincipalInflow` in the module (lines ~372, 418, 450, 482, 546, 949 — `notifyImpairmentRecovery`, at line ~1145, is absent from this list). This manufactures a phantom loss at the next `report()` call: `currentTotalAssets` drops by exactly the notified amount relative to a now-stale baseline, which over-burns locked profit shares and mis-sets `trustedPpsCheckpoint` — even though the outflow was a deliberate, accounted transfer into the recovery escrow, not a realized economic loss.

**Recommendation**: Call `_decreaseReportBaselineForPrincipalOutflow(amount)` in the `recoveryAsset == vaultAsset` branch, mirroring every other user-facing outflow path.

---

### [8] Withdrawal-liquidity loop does not exclude impaired (side-pocketed) strategies the way `totalAssets()` does
**Severity**: Low-Medium | **Confidence**: 65 (capped — see caveat) | **Origin**: `[phase2]` flow-gap and asymmetry, independently — orchestrator-verified directly against source.

**Location**: `_withdrawFromStrategies()` — `contracts/creator/vault/CreatorOVault.sol:1650-1685`; contrast `totalAssets()` — `contracts/creator/vault/CreatorOVault.sol:983-996`

```solidity
// totalAssets() — line 991
if (activeStrategies[strategyList[i]] && !strategyImpaired[strategyList[i]]) { ... }
```
```solidity
// _withdrawFromStrategies() — line 1658
if (activeStrategies[strategy]) {   // no strategyImpaired exclusion
```

**Description**: `totalAssets()` explicitly excludes impaired strategies from NAV via a `!strategyImpaired[...]` check. `_withdrawFromStrategies` (the liquidity-sourcing loop invoked by redemptions when idle coin is insufficient) checks only `activeStrategies[...]`, with no equivalent exclusion — and `tripImpairment` never clears `activeStrategies`. A redemption's `_ensureCoin` can therefore still pull real, recoverable assets out of a strategy that was deliberately quarantined via the impairment side-pocket, redistributing value meant for the recovery/claims process to whichever redeemer happens to execute first, rather than preserving it for `finalizeImpairment`'s `excludedBookValue` snapshot and the subsequent claims process.

**Confidence is capped** because this in-scope copy of `_withdrawFromStrategies` may be dead/fallback code — the live withdrawal-liquidity path for redemptions appears to delegate to the out-of-scope strategies module, whose parity with this V-local copy could not be verified in this engagement (see Open Questions). This is reported as a verified structural pattern worth confirming in the live implementation, not a confirmed live exploit.

**Recommendation**: Add `&& !strategyImpaired[strategy]` to the iteration guard in `_withdrawFromStrategies` (and confirm/replicate the same guard in the live strategies-module implementation).

---

### [9] `onlyEmergencyAuthorized` grants the ImpairmentGuardian role full emergency-drain power
**Severity**: Medium | **Confidence**: 90 | **Origin**: `[phase1]` access-control checklist.

**Location**: `onlyEmergencyAuthorized` modifier — `contracts/creator/vault/CreatorOVault.sol:664-672`; `emergencyWithdraw(uint256,address)` — `:1887` (body in out-of-scope adminModule)

**Description**: `impairmentGuardian` — a role whose designed remit is `tripImpairment`/`clearImpairmentTrip` (incident-response/monitoring) — is folded into the same `onlyEmergencyAuthorized` set as `emergencyAdmin`/`management`/`owner`, all of which can call `emergencyWithdraw`, which sends the vault's coin to an arbitrary caller-supplied `to` address. This widens the set of single keys with unilateral drain capability beyond what the guardian role's stated purpose requires.

**Recommendation**: Remove `impairmentGuardian` from `onlyEmergencyAuthorized`; if the guardian legitimately needs incident-response authority beyond trip/clear, grant only `shutdownVault`/pause-style power via a narrower modifier.

---

### [10] `acceptManagement` has no visible guard — 2-step management handoff safety is entirely delegated to the out-of-scope adminModule
**Severity**: Medium | **Confidence**: 60 (contingent, see caveat) | **Origin**: `[both]` — phase-1 access-control (AC-3), phase-2 access-control-retry (lead).

**Location**: `acceptManagement()` — `contracts/creator/vault/CreatorOVault.sol:2126-2128`

**Description**: The management role uses a 2-step handoff (`setPendingManagement` → `acceptManagement`), but `acceptManagement`'s wrapper carries no access modifier and blindly delegates to the out-of-scope `_adminModule`. The entire security of the handoff — that `msg.sender == pendingManagement` — rests on code not included in this audit's scope. **This cannot be confirmed or ruled out from the audited source.** If the out-of-scope check is present and correct, this is safe by design (a stray caller can at worst finalize a handoff current management already authorized to a specific address). If it is missing, any address can seize the management role (strategy management, fee scheduling, impairment root propose/finalize, `injectCapital`, `syncBalances`) — a Critical takeover.

**Recommendation**: Confirm the adminModule enforces `msg.sender == pendingManagement` and clears `pendingManagement` on success. Consider adding a defensive check at the wrapper itself so the guarantee is visible in the audited contract, not delegated invisibly to a separate module.

---

### [11] Direct token donation can trip the per-tx price-change circuit breaker, temporarily bricking deposits
**Severity**: Low | **Confidence**: 85 | **Origin**: `[phase1]` — independently found by 3 phase-1 agents (general, erc4626, dos), each tracing the same root mechanism.

**Location**: `deposit()` — `contracts/creator/vault/modules/CreatorOVaultCoreModule.sol:349-370`; `_pullCreatorCoinExact`/`_syncCoinBalance` — `:644-659`

**Description**: `totalAssets()` reads a tracked `coinBalance`, not live `balanceOf`, specifically to resist donation-based inflation. However `coinBalance` is unconditionally re-synced to the live balance on every pull/push/sync. A direct donation exceeding ~10% of TVL is invisible to `priceBefore` (read before the pull) but folded into `priceAfter` (read after), tripping the 10%-per-tx `_checkPriceChange` breaker and reverting all subsequent deposits/mints until a withdrawal or `syncBalances()`/`report()` resynchronizes state. The attacker forfeits the donated funds (self-costly), so this is a liveness/griefing issue rather than a drain.

**Recommendation**: Sync `coinBalance` at function entry before reading `priceBefore`, so a pre-existing donation is reflected symmetrically in both price readings and cannot register as an intra-transaction jump.

---

### [12] Impairment recovery-asset transfer records the nominal requested amount instead of the amount actually received
**Severity**: Medium | **Confidence**: 85 | **Origin**: `[both]` — phase-1 erc20 checklist (ERC20-1), independently corroborated by 3 phase-2 agents (invariant's fund-dilution framing, flow-gap, economic-security).

**Location**: `notifyImpairmentRecovery()` — `contracts/creator/vault/modules/CreatorOVaultCoreModule.sol:1145-1168` (non-vault-asset branch, `:1162-1166`)

**Description**: Every Creator Coin movement elsewhere in the contract uses exact-delta enforcement (`_pullCreatorCoinExact`/`_pushCreatorCoinExact`, measuring `balanceOf` before/after and reverting on mismatch). The impairment-recovery path abandons this discipline for non-vault-asset recoveries: it does a raw `safeTransfer` and records the full requested `amount` as received regardless of actual delivery. `recoveryAsset` is an arbitrary token chosen by Management and can plausibly be a fee-on-transfer or deflationary token recovered from a failed strategy. If it takes a transfer fee, the escrow receives less than `amount`, but `epoch.totalRecovered` (the denominator for every claimant's pro-rata share) records the full nominal amount — later claimants' `claimRecovery` calls revert against an under-funded escrow, permanently stranding their share.

**Proof of Concept**: 1,000,000 units of a 2%-fee recovery token are notified; escrow receives 980,000 but `totalRecovered = 1,000,000`. Pro-rata claims are computed against the inflated denominator; once the escrow's actual 980,000 is exhausted, remaining claimants' recovery is permanently stuck.

**Recommendation**: Apply the same measured-delta discipline used for the Creator Coin to the recovery-asset transfer, recording the escrow's actual balance delta rather than the nominal `amount`.

---

### [13] Module storage-layout compatibility is self-attested via a version constant, not structurally verified
**Severity**: Low | **Confidence**: 80 | **Origin**: `[phase1]` proxies checklist, independently confirmed by 2 phase-2 agents (boundary, asymmetry) via field-by-field storage diffs.

**Location**: `_validateModuleIdentity()` — `contracts/creator/vault/CreatorOVault.sol:787-799`; `moduleStorageVersion()` — `contracts/creator/vault/modules/CreatorOVaultCoreModule.sol:168-170`

**Description**: The entire delegatecall architecture rests on `OVaultModuleStorage`'s hand-mirrored layout staying byte-identical to `CreatorOVault`'s real (inherited-OZ-plus-custom) storage. The only on-chain guard, `_validateModuleIdentity`, compares `moduleStorageVersion()` against a shared constant — but the module simply echoes the same constant back, proving only that it was compiled against the same constants file, not that the layouts actually match. **Multiple independent agents performed a full field-by-field diff and confirmed the mirror is currently byte-correct**, including OZ base-contract ordering (ERC20/Ownable/ReentrancyGuard/EIP712 slots) — this is a process/future-risk finding, not a present bug. Correctness additionally depends on the linked OpenZeppelin version keeping `ERC4626._asset`/`_underlyingDecimals` and EIP712's cached separator immutable (true for OZ ≥4.9/5.x); the exact resolved OZ version could not be confirmed since the dependency is not vendored in this scope.

**Recommendation**: Add a CI storage-layout-diff test (`forge inspect` comparison) rather than relying on a manually-bumped label constant; pin the exact OZ version in the dependency manifest.

---

## Additional Low/Info findings (phase-1-sourced, not independently re-derived in phase 2 but verified in phase 1)

- **Operator permission scope is bypassable via unrestricted deposit receiver / share transfer** (Low, confidence 75) — `_enforceOperatorPermIfGranted` at `modules/CreatorOVaultCoreModule.sol:633-638`. An OP_DEPOSIT-only wallet can direct minted shares to an unrestricted receiver address, or transfer held shares to a fresh address, defeating the intended least-privilege bitmask for a compromised operator wallet.
- **`claimQueuedWithdrawal` does not check `paused`, unlike `redeem`/`withdraw`** (Low, confidence 90 — directly verified against source) — `modules/CreatorOVaultCoreModule.sol:524-549`. Large queued exits can still settle during an emergency pause.
- **Owner uses 1-step `transferOwnership`/`renounceOwnership` while Management uses 2-step** (Low, confidence 85) — inherited OZ `Ownable`. A fumbled transfer permanently loses/bricks `onlyOwner` functionality unless `protocolRescue` is configured.
- **Fee-share minting formula (performance/management/profit-lock) systematically under-mints relative to exact dilution** (Low, confidence 80) — `report()` `modules/CreatorOVaultCoreModule.sol:783,792`, `_accrueManagementFee()` `:853`. Protocol-unfavorable rounding direction; not a user-fund-loss vector.
- **Module hardcodes the decimals-offset scaling constant (1000) instead of deriving it from `_decimalsOffset()`** (Low, confidence 75) — `pricePerShare()` `:737`, `maxDeposit()` `:583`. Currently correct; latent divergence risk if the offset is ever changed on the vault side without a matching module update.
- **`claimImpairmentRecovery`'s pro-rata rounding strands dust and can prevent an epoch from ever auto-resolving** (Low, confidence 75) — `:1175, 1180-1182`. Safe rounding direction (never over-pays); a stuck-state/dust issue.
- **Vault's authoritative `maxWithdraw`/`maxRedeem` omit the liquidity cap present in dead module copies** (Low, confidence 80, corroborated by 2 phase-2 agents) — `CreatorOVault.sol:1337-1361` vs. unreachable `modules/CreatorOVaultCoreModule.sol:600-631`. Can violate the ERC-4626 max*-must-not-revert guarantee for integrators.
- **Flash-loan cooldown (`lastDepositBlock`) is entirely dependent on out-of-scope `_sharesUpdate` routing through `_update`** (Low, confidence 55 — contingent) — `CreatorOVault._update()` `:2199-2225`. Raised independently by 8+ agents across both phases as the single most-repeated open question in this audit; cannot be resolved without the out-of-scope `OVaultModuleBase` source. The presence of a `__moduleUpdate` self-call helper is suggestive (but not proof) that the intended wiring is correct.
- **Risk-config timelock may be bypassable via direct (non-scheduled) setters** (Info, confidence 40) — cannot be confirmed without the out-of-scope adminModule.
- **`redeem` synchronous exit diverges from `withdraw`'s and the queue's settlement math at the margins; `maxDeposit` on an empty vault doesn't reflect `MINIMUM_FIRST_DEPOSIT`** (Info) — minor ERC-4626 spec-compliance nuances, no fund-risk path identified.

---

## Leads (unconfirmed, confidence < 50 — not asserted as findings)

- **`report()`'s zero-baseline bootstrap branches miss a narrow post-full-drain state**, which could book residual virtual-offset dust as 100% profit. Magnitude bounded by `MINIMUM_FIRST_DEPOSIT`'s dust fraction.
- **`proposeImpairmentRoot`'s `totalClaimSupply` divisor defaults to `totalSharesAtTrip`**, which includes vault-held locked/queued shares, not just real holders — a plausible off-chain/on-chain reconciliation mismatch contingent on the (out-of-scope) off-chain Merkle-root construction process.
- **MEV-control bypass by fragmenting large withdrawals below `largeWithdrawalThreshold`** — the threshold is gated per-call with no cumulative per-account tracking; the deposit-cooldown still blocks same-block round-trips, limiting practical impact.
- **Deposit-to-victim cooldown griefing** — an attacker could repeatedly deposit dust naming a victim as receiver to keep pushing the victim's `lastDepositBlock` forward, contingent on OQ-1 (module `_sharesUpdate` routing) and a materially-large configured `withdrawDelayBlocks`.

---

## Open Questions (cannot be resolved within this engagement's scope)

These recur across nearly every phase-1 and phase-2 agent as the boundary of what this audit could verify — resolving them would either close or substantially re-scope several findings above:

1. **Does the module's `_sharesUpdate` (in out-of-scope `OVaultModuleBase`) route mint/burn through `CreatorOVault._update`?** Determines whether the flash-loan cooldown (`lastDepositBlock`) actually fires for module-minted shares.
2. **Does `_adminModule`'s `acceptManagement` check `msg.sender == pendingManagement`?** Directly gates Finding 10's severity (Medium-if-present-and-correct vs. Critical-if-missing).
3. **Does `onlyDelegateCall` (in `OVaultModuleBase`) robustly reject direct, non-delegatecall invocation of the deployed module contract?**
4. **What does `_adminModule`'s `emergencyWithdraw`/`emergencyWithdrawFromStrategies` body actually do** — full drain, capped, any accounting reconciliation?
5. **Do the live strategies-module implementations of `deployToStrategies`/`_withdrawFromStrategies`/etc. match the (apparently dead/fallback) V-local copies audited here** — directly relevant to Finding 8.
6. **Is `IOVaultImpairmentClaims` (the impairment-claim token) transferable?** Directly gates Finding 3's severity between Medium and Critical.

---

## Coverage Gate

- **Entrypoints**: ~100 external/public state-changing functions identified across the two in-scope contracts in the phase-0 inventory; every privileged/value-moving entrypoint maps to at least one finding above or an explicit "examined, invariant holds" note in the Threat Model table.
- **Threat-catalog rows**: 18 rows synthesized in phase 0; every row is addressed by a finding or explicitly marked "invariant holds" / "unresolved open question" above.
- **Coverage holes closed this pass (K)**: 0 — both phases' combined coverage, cross-checked by the orchestrator against source, already answered every entrypoint and threat-catalog row from phase 0; no entrypoint or threat row was left unexamined by both phases requiring a first-time re-read at this stage.
- **Re-examined leads** (confirmatory source re-reads performed during reconciliation, not counted as coverage holes): the redeem-cap mathematical re-derivation (Finding 6), the `withdraw()` reservation-omission check (Finding 4), the `report()` vaultMode-guard check (Finding 4-adjacent, folded into Finding 5's discussion... — see Finding 5), the `notifyImpairmentRecovery` baseline-symmetry grep (Finding 7), and the `_withdrawFromStrategies` impaired-strategy filter check (Finding 8) were all independently verified by the orchestrator directly against source before being included above.

---

> ⚠️ This review was performed primarily by AI agents (three-phase methodology: automated context-building, breadth checklist review, and depth attack-specialty review) with human-equivalent orchestrator verification of every promoted finding against source. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human review, a public bug bounty program, and on-chain monitoring are strongly recommended before mainnet deployment or upgrade, particularly given the number of findings gated on out-of-scope modules (`OVaultModuleBase`, `_strategiesModule`, `_adminModule`) that this engagement could not audit.
