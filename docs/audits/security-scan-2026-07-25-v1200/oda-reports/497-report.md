# 🔐 Security Review — CreatorOVault + CreatorOVaultCoreModule (ODA v1.20.0 greenfield candidate)

leftclaw job #497 · 4626fun/4626 · branch `audit/oda-v1200-greenfield-candidate` · commit `82688294f7765f20f7763175aa566e046eca95af`

---

## Scope

|                                  |                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Mode**                         | Named files (2 primary + 3 shared)                                                                 |
| **Files reviewed**               | `contracts/creator/vault/CreatorOVault.sol` (2345 LOC) · `contracts/creator/vault/modules/CreatorOVaultCoreModule.sol` (1355 LOC)<br>`contracts/shared/vault/modules/OVaultModuleBase.sol` · `OVaultModuleConstants.sol` · `OVaultModuleStorage.sol` (288 LOC combined) |
| **Out of scope**                 | `_strategiesModule` / `_adminModule` bodies (referenced by delegatecall, code not in this repo); `IStrategy`/`IStrategyValuation`/`OVaultLiquidityLib`/`IOVaultImpairmentClaims`/`IOVaultRecoveryEscrow` (unresolved imports, no `interfaces/` dir in this deliberately trimmed public audit repo) |
| **Prior context**                | Delta review vs. full ODA audit dated 2026-07-22 (pin `423e0e3`); P0 remediations landed in PR #757 / commit `413f060`. Prior related jobs: ODA 462, 480. This is an independent, from-scratch re-audit per this engagement's terms — no findings below were sourced from prior reports. |
| **Confidence threshold (1–100)** | 50 (findings below 50 are listed as Leads, not findings)                                            |

## Methodology

Three-phase audit: **Phase 0** (context) — three parallel agents built a protocol map, access-control inventory, and threat catalog with zero findings. **Phase 1** (breadth) — 8 domain checklist agents (evm-audit-general, precision-math, erc20, erc4626, proxies, signatures, access-control, dos), each given the protocol map for routing. **Phase 2** (depth) — 12 attacker-mindset agents (9 single-specialty + 3 cross-lens gap-hunters) run **blind to Phase 1's findings**, given only the protocol map. **Phase 3** — this document: cross-phase reconciliation, a coverage gate against the Phase 0 inventory/threat catalog, and a hybrid re-examination pass that **directly disproved one claim four independent agents made** (see "Rejected findings" below) via source-verified mathematics before it could reach this report. All model agents ran on Opus given the scope size (~4,000 in-scope LOC).

**Reconciliation summary**: Overlap (both phases): 2 · Phase-1-only: 15 · Phase-2-only: 8 · Re-examined leads kept: 6, demoted: 1, rejected: 1 (with proof) · Coverage holes closed this pass: 0 (both phases already covered the full inventory and threat catalog — see Coverage Gate below).

---

## Findings

[80] **1. `claimImpairmentRecovery` pays pro-rata entitlement from a live external balance while tracking "already claimed" per address — double-claimable if the claim token is transferable**

`CreatorOVaultCoreModule.claimImpairmentRecovery` · Confidence: 80 (mechanism confirmed in-scope; triggering condition — transferability of the out-of-scope `OVaultImpairmentClaims` contract — could not be verified from this repo, but standard ERC-1155 tokens are transferable by default and no soulbound marker exists on the interface exposed here)

**Description**
`claimUnits = IOVaultImpairmentClaims(impairmentClaims).balanceOf(msg.sender, epochId)` (CreatorOVaultCoreModule.sol:1324) sizes the payout from the caller's *current* claim-token balance, while the double-claim guard `impairmentAmountClaimed[epochId][msg.sender]` (1326-1329) is keyed to the caller's *address*. If the claim token can move between wallets, a holder claims their full pro-rata slice, transfers the same units to a fresh address (whose ledger entry is 0), and claims the identical slice again — repeatable across arbitrarily many wallets, draining `impairmentRecoveryEscrow` past `epoch.totalRecovered` at the expense of every other/later claimant. This was independently raised by **11 of the 12 Phase-2 attacker agents plus the Phase-1 general-checklist agent** — the strongest cross-agent convergence in this engagement (`judging.md`'s multi-agent-convergence rule promotes this from lead to finding).

**Proof of Concept**
`totalClaimSupply=100`, holder A holds all 100 claim units. `notifyImpairmentRecovery` sets `epoch.totalRecovered = 100`. A calls `claimImpairmentRecovery`: `gross = 100·100/100 = 100`, pays 100, `impairmentAmountClaimed[epochId][A] = 100`. A transfers the 100 (unburned) claim units to a fresh wallet B. B calls `claimImpairmentRecovery`: `impairmentAmountClaimed[epochId][B] == 0`, `balanceOf(B) == 100`, `gross = 100`, pays another 100. Cumulative payout is 200 against 100 actually recovered — the second payment either comes out of other epochs' escrow balance or reverts on insufficient escrow funds, either way breaking the documented invariant "claim payouts ≤ pro-rata share of totalRecovered" and starving honest late claimants.

**Confirm before shipping**: whether `OVaultImpairmentClaims` (out of this repo) is transferable. If it is soulbound/non-transferable, this finding does not apply.

**Fix**

```diff
-        uint256 claimUnits = IOVaultImpairmentClaims(impairmentClaims).balanceOf(msg.sender, epochId);
-        uint256 gross = (epoch.totalRecovered * claimUnits) / epoch.totalClaimSupply;
-        uint256 already = impairmentAmountClaimed[epochId][msg.sender];
-        if (gross <= already) revert NothingToClaim(epochId, msg.sender);
-        amountOut = gross - already;
-        impairmentAmountClaimed[epochId][msg.sender] = gross;
+        // Burn (or otherwise consume) the claim units atomically with payout so a transferred
+        // unit cannot be re-claimed by its new holder. E.g. have the claims contract expose a
+        // burn-and-report-amount call, or move to per-unit (not per-address) claimed tracking
+        // inside OVaultImpairmentClaims itself.
+        uint256 claimUnits = IOVaultImpairmentClaims(impairmentClaims).balanceOf(msg.sender, epochId);
+        uint256 gross = (epoch.totalRecovered * claimUnits) / epoch.totalClaimSupply;
+        uint256 already = impairmentAmountClaimed[epochId][msg.sender];
+        if (gross <= already) revert NothingToClaim(epochId, msg.sender);
+        amountOut = gross - already;
+        impairmentAmountClaimed[epochId][msg.sender] = gross;
+        // At minimum: assert/require the claims contract enforces non-transferability.
```
Simplest robust fix: require `OVaultImpairmentClaims` to be non-transferable (soulbound) and add that as an explicit invariant check at wiring time, or refactor to burn claim units on payout instead of tracking claimed-amount by address.

---

[75] **2. Impairment root's finalize-eligible time is not ordered against the permissionless stale-clear deadline — a legitimate, near-finalized claim can be wiped**

`CreatorOVaultCoreModule.proposeImpairmentRoot` / `clearStaleImpairmentTrip` · Confidence: 75

**Description**
`proposeImpairmentRoot` sets `unlock = block.timestamp + impairmentChallengeWindow` (CreatorOVaultCoreModule.sol:1176-1177) with no check that `unlock` lands before the permissionless stale-clear deadline `trippedAt + maxImpairmentTripDuration` (checked in `clearStaleImpairmentTrip`, line 1085-1086). Both parameters are independently bounded (`impairmentChallengeWindow`: 1 hour–30 days; `maxImpairmentTripDuration`: 3–30 days — CreatorOVault.sol:110-115) with no coupling enforced between them. The code is aware of a related risk here — the comment at lines 1172-1176 explicitly keeps `trippedAt` fixed (rather than refreshing it on propose) specifically to bound a *different* griefing pattern (indefinite challenge→clear→re-propose freeze, citing prior finding ODA-427-F1) and states "griefing of finalize still needs a bond/cap follow-up" — this finding is that follow-up gap: the fixed `trippedAt` that protects against indefinite freeze also means a **slow-but-legitimate** root proposal can have its finalize window land *after* the stale-clear deadline, letting anyone permissionlessly wipe it first.

**Proof of Concept**
With `impairmentChallengeWindow = 30 days` (in-bounds) and `maxImpairmentTripDuration = 14 days` (default): trip at t=0 → `staleAt = 14d`. Management proposes a root at t=1h → `unlock ≈ 30d`. At t=14d, `finalizeImpairment` is still illegal (unlock not reached), but `clearStaleImpairmentTrip` becomes callable by **anyone**. Calling it zeroes `snapshotRoot`/`totalClaimSupply`/`recoveryAsset` and flips `strategyImpaired[strategy]` back to `false` — the strategy's stale `strategyDebt`-fallback valuation (`_getStrategyAssetsSafe`, C:286-301) re-enters `totalAssets()`, and the entire claims process for that epoch is destroyed. This same failure mode is also reachable under **default** parameters (`impairmentChallengeWindow=1 day`, `maxImpairmentTripDuration=14 days`) if management simply proposes the root later than day 13 — plausible during a slow, careful investigation of a genuinely bad strategy.

**Fix**

```diff
     function proposeImpairmentRoot(
         uint256 epochId,
         bytes32 snapshotRoot,
         uint256 totalClaimSupply,
         address recoveryAsset
     ) external onlyDelegateCall {
         if (snapshotRoot == bytes32(0)) revert InvalidAmount();
         if (recoveryAsset == address(0)) revert ZeroAddress();
         if (impairmentChallengeWindow == 0) revert ChallengeWindowNotConfigured();
         if (epochId == 0 || epochId != activeImpairmentEpoch) revert InvalidImpairmentEpoch(epochId);
 
         ImpairmentEpoch storage epoch = impairmentEpochs[epochId];
         if (epoch.status != ImpairmentEpochStatus.Tripped) revert InvalidImpairmentTransition(epochId);
         if (epoch.snapshotRoot != bytes32(0)) revert ImpairmentRootAlreadyFinalized(epochId);
         if (totalClaimSupply == 0) totalClaimSupply = epoch.totalSharesAtTrip;
 
         epoch.snapshotRoot = snapshotRoot;
         epoch.totalClaimSupply = totalClaimSupply;
         epoch.recoveryAsset = recoveryAsset;
         uint64 unlock = uint64(block.timestamp) + impairmentChallengeWindow;
+        uint64 staleAt = epoch.trippedAt + maxImpairmentTripDuration;
+        if (unlock >= staleAt) revert ImpairmentRootWouldExceedStaleDeadline(unlock, staleAt);
         impairmentRootUnlockTime[epochId] = unlock;
         emit ImpairmentRootProposed(epochId, snapshotRoot, unlock);
     }
```
Alternative: once `snapshotRoot != 0`, have `clearStaleImpairmentTrip` refuse to run (require an authorized `clearImpairmentRootAfterChallenge`/`rejectImpairmentChallenge` path instead once a root exists).

---

[70] **3. `report()` recognizes phantom profit and overcharges performance fees by cycling a strategy through `tripImpairment` → `report()` → `clearImpairmentTrip` → `report()`**

`CreatorOVaultCoreModule.report` / `tripImpairment` / `clearImpairmentTrip` · Confidence: 70 (requires owner/guardian + keeper actions — see note on Gate 3 below; the unprivileged holders are the amplified victims via the fee formula, but this is not a fully permissionless attack)

**Description**
`report()` (CreatorOVaultCoreModule.sol:796) has no `vaultMode == Normal` gate, unlike `deposit`/`mint`/`redeem`/`withdraw`. `tripImpairment` (1043) requires no proof a strategy is actually impaired — any listed, non-impaired strategy can be flagged by `onlyImpairmentAuthorized` (owner or guardian). The moment it's flagged, `totalAssets()` excludes its book value `V` (via `strategyImpaired` in `_getStrategyAssetsSafe`). `report()`'s final baseline write (`totalAssetsAtLastReport = totalAssets()`, line 886) runs unconditionally and ratchets the baseline down by `V`. `clearImpairmentTrip` (false-alarm path, 1067) re-includes `V` in `totalAssets()`. The next `report()` then sees `currentTotalAssets > previousTotalAssets` by `V` and mints performance-fee shares on it (830-837) — there is no high-water mark, so recovering a self-inflicted, never-real loss is taxed as fresh yield.

**Proof of Concept**
`report()` (baseline=T=1,000,000e18) → `tripImpairment(healthyStrategy)` where the strategy's book value V=500,000e18 (totalAssets drops to T−V) → `report()` (books "loss" V, baseline→T−V=500,000e18) → `clearImpairmentTrip` (false alarm; totalAssets restored to T) → `report()` (profit=V=500,000e18; with `performanceFee=2000` (20 bps ×100 = 20%): `performanceFees = 500,000e18 · 2000/10000 = 100,000e18` minted as shares to `performanceFeeRecipient` — 10% of NAV diluted out of honest holders on principal that never left the vault).

**Fix**

```diff
     function report() external onlyDelegateCall returns (uint256 profit, uint256 loss) {
+        if (vaultMode != VaultMode.Normal) revert VaultNotNormal();
         _processProfitUnlock();
         _processValuationHealth();
         _requireStrategyValuationsReady(true);
```
Also add a high-water mark (track the highest `totalAssetsAtLastReport`-equivalent NAV-per-share seen, and only charge performance fee on NAV above that mark) so recovering a previously-booked loss is never re-taxed.

---

[70] **4. Report baseline is decremented by a withdrawal's market value instead of its cost basis, causing phantom-profit fee overcharging on ordinary withdrawals**

`CreatorOVaultCoreModule._decreaseReportBaselineForPrincipalOutflow` (called from `redeem`/`withdraw`/`claimQueuedWithdrawal`) · Confidence: 70 (mechanism fully proven; triggers via completely ordinary, unprivileged usage — any withdrawal between report cycles when there's unreported yield — no attacker or privileged action required at all)

**Description**
`_decreaseReportBaselineForPrincipalOutflow(assetsOut)` (CreatorOVaultCoreModule.sol:972-975) subtracts the withdrawn amount's *current market value* from `totalAssetsAtLastReport` — a baseline meant to track cost-basis / already-reported NAV. Deposits correctly add the deposited amount (which *is* the depositor's cost basis, CreatorOVaultCoreModule.sol:399/450). Withdrawals should symmetrically subtract the withdrawer's proportional share of the *last-reported* NAV, not their current market-value payout (which includes their share of yield accrued since the last report). This is a one-directional accounting bias that fires on completely ordinary vault usage — no attack is required, only a withdrawal happening while yield is unreported.

**Proof of Concept**
Two holders A, B each deposit 100 at PPS 1 → `totalAssetsAtLastReport = 200`, supply 200, TA 200. Vault earns 100 (unreported) → TA 300, PPS 1.5. A withdraws all: burns 100 shares, paid 150 (market value); `_decreaseReportBaselineForPrincipalOutflow(150)` → baseline drops 200→50 (correct value would be 200 − 200·100/200 = 100, i.e. A's cost-basis share). TA is now 150, supply 100. `report()` with `performanceFee=20%`: `profit = 150 − 50 = 100`, but B's real unrecognized yield is only 50 (B's 100 shares grew from 100 to 150 in value = 50 profit). Fee charged: `100·20% = 20` (should be `50·20%=10`) — B is permanently overcharged 10, transferred to `performanceFeeRecipient` on yield B never received.

**Fix**

```diff
-    function _decreaseReportBaselineForPrincipalOutflow(uint256 assetsOut) internal {
-        uint256 baseline = totalAssetsAtLastReport;
-        totalAssetsAtLastReport = assetsOut >= baseline ? 0 : baseline - assetsOut;
-    }
+    function _decreaseReportBaselineForPrincipalOutflow(uint256 sharesBurned, uint256 supplyBeforeBurn) internal {
+        uint256 baseline = totalAssetsAtLastReport;
+        uint256 basisOut = supplyBeforeBurn == 0 ? 0 : (baseline * sharesBurned) / supplyBeforeBurn;
+        totalAssetsAtLastReport = basisOut >= baseline ? 0 : baseline - basisOut;
+    }
```
(Call sites need `sharesBurned`/`supplyBeforeBurn` threaded through instead of `assetsOut`.) This is the same underlying accounting-basis-vs-market-value mismatch that also affects the `notifyImpairmentRecovery` baseline decrement (see Lead below) — fixing the helper's signature fixes both call sites.

---

[65] **5. `queueWithdrawal`/`claimQueuedWithdrawal` omit the `paused` guard that `redeem`/`withdraw` carry — the emergency pause is bypassable for large holders**

`CreatorOVaultCoreModule.queueWithdrawal` (C:536) / `claimQueuedWithdrawal` (C:573) · Confidence: 65 (mechanism fully proven; severity — whether bypassing an emergency freeze for large holders constitutes material harm — is an incident-response judgment, not a fund-theft mechanism)

**Description**
`redeem` (C:459) and `withdraw` (C:491) both carry `if (paused) revert Paused();`, added specifically per a prior fix ("FIX: L-01 — enforce pause on redeem/withdraw to align with maxWithdraw/maxRedeem returning 0"). `queueWithdrawal` and `claimQueuedWithdrawal` carry no such check — `claimQueuedWithdrawal` gates only on `vaultMode != Normal`, a different flag entirely.

**Proof of Concept**
Owner calls `setPaused(true)` during an incident. A holder with shares worth ≥ `largeWithdrawalThreshold` (default 100,000e18) calls `queueWithdrawal` (no guard trips), waits `largeWithdrawalDelayBlocks` (default 10 blocks), then calls `claimQueuedWithdrawal()` — `vaultMode` is still `Normal`, no `paused` check exists, and the withdrawal proceeds, pulling from strategies via `_ensureCoin` and paying out via `_pushCreatorCoinExact`. Meanwhile every holder using `redeem`/`withdraw` is frozen, and `maxWithdraw`/`maxRedeem` advertise 0 — the emergency pause is defeated specifically for large holders routing through the queue.

**Fix**

```diff
     function queueWithdrawal(uint256 shares, address receiver) external onlyDelegateCall {
         _enforceOperatorPermIfGranted(OP_WITHDRAW);
+        if (paused) revert Paused();
         if (shares == 0) revert ZeroShares();
```
```diff
     function claimQueuedWithdrawal() external onlyDelegateCall returns (uint256 assets) {
         if (vaultMode != VaultMode.Normal) revert VaultNotNormal();
+        if (paused) revert Paused();
         _processProfitUnlock();
```

---

## Rejected findings (adversarial self-correction)

**`redeem()` burns full shares but pays a queue-reservation-capped, reduced asset amount — CLAIMED by 4 agents, DISPROVEN by 4 independent agents plus direct source verification.**

Four agents (three Phase-2: first-principles, asymmetry, math-precision; one Phase-1: erc4626 domain) independently claimed `redeem` silently underpays relative to `previewRedeem`'s liquidity cap while burning the caller's full share amount — unlike `withdraw`, which cleanly reverts on the same condition. All four supporting proofs used numeric examples that are structurally impossible (e.g., a queued-withdrawal reservation plus a redeemer's shares whose combined value exceeded 100% of total supply — not achievable since queued shares and a redeemer's owned shares are always disjoint subsets of `totalSupply`). Four other agents (invariant, numerical-gap, economic-security, periphery — all Phase 2) independently traced the same code and mathematically disproved the claim. The orchestrator verified directly against `CreatorOVault.sol:1341-1348`:

```solidity
function previewRedeem(uint256 shares) public view override returns (uint256) {
    uint256 assets = super.previewRedeem(shares);
    uint256 liquid = totalAssets();
    uint256 reserved = super.previewRedeem(totalQueuedWithdrawalShares);
    uint256 available = liquid > reserved ? liquid - reserved : 0;
    return assets > available ? available : assets;
}
```

Let `f(x) = floor(x·(totalAssets+1)/(totalSupply+1000))` (OZ's virtual-offset conversion, offset=3 → 1000 virtual shares). Two facts hold **unconditionally**, for any `totalAssets`, `totalSupply` ≥ 0 (one Phase-2 agent's claim that this "only holds when totalSupply ≤ 1000·totalAssets" was itself checked and found incorrect — the floor operation preserves the bound even far outside that range):
1. `f(totalSupply) ≤ totalAssets` always (the raw quotient is provably `< totalAssets+1` for any input, so its floor is `≤ totalAssets`).
2. `f` is subadditive: `f(a) + f(b) ≤ f(a+b)` for any `a, b ≥ 0` (standard floor-subadditivity for a fixed-multiplier linear function).

Since a redeemer's owned shares and the vault-held queued shares are always disjoint (`shares + totalQueuedWithdrawalShares ≤ totalSupply` structurally, as queued shares have already been moved into vault custody and are no longer the redeemer's), combining (1) and (2) gives `f(shares) + f(queued) ≤ f(shares+queued) ≤ f(totalSupply) ≤ totalAssets`, therefore `available = totalAssets − f(queued) ≥ f(shares) = fairAssets` — **always**. The cap in `previewRedeem` can never actually bind below a legitimate redeemer's fair value. **No finding.**

**Demoted**: `cancelQueuedWithdrawal` missing the `vaultMode == Normal` gate present on every sibling queue/value-flow function (originally raised Low in Phase 1). Three-plus Phase-2 agents independently examined this during the blind hunt and concluded it cannot be turned into a fund-loss or unfair-exit path: cancellation only returns vault-held shares to their original owner (both already counted in `totalSupply`), the impairment snapshot (`totalSharesAtTrip`) is fixed at trip time and unaffected, and the returned shares remain subject to the ongoing impairment exactly as if they'd never been queued. Demoted from Low finding to a structural note — recommend adding the gate for consistency/defense-in-depth, but it is not a security gap.

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path could not be completed, or where impact is real but bounded/contingent. Not scored._

- **Flash-loan withdrawal cooldown bypassable via deposit into a "warm" existing-holder wallet** — `CreatorOVaultCoreModule.deposit/mint` — Code smells: `lastDepositBlock[receiver]` (C:388-392, C:439-443) is only refreshed when `receiver == msg.sender || receiverSharesBefore == 0` — a deliberate anti-grief carve-out that, as a side effect, lets a third party mint fresh shares into any wallet that already holds ≥1 share without resetting that wallet's cooldown, making the new shares immediately redeemable/transferable. Raised independently by 6 of 12 Phase-2 agents; none could construct a same-block profit path (the ±10% `_checkPriceChange`/`_checkTrustedPpsDeviation` guards and keeper-only `report()` block the obvious PPS-manipulation primitives). Recommend refreshing the cooldown on every mint regardless of prior balance.

- **`notifyImpairmentRecovery` trusts an arbitrary keeper-supplied amount and compounds the baseline-basis bug** — `CreatorOVaultCoreModule.notifyImpairmentRecovery` (C:1293-1318) — For vault-asset recovery, pushes a keeper-chosen `amount` of the vault's own idle coin to the escrow with no verification it represents actually-recovered funds, and its baseline decrement (`_decreaseReportBaselineForPrincipalOutflow`) has never had a matching prior increase for recovery inflows — compounding Finding #4's mechanism. Requires keeper error or compromise; two Phase-2 agents flagged this from different angles (idle-funds trust gap vs. baseline asymmetry).

- **Large-withdrawal queue MEV protection is per-call, not per-transaction** — `redeem`/`withdraw` (C:474/508) compare only a single call's asset amount against `largeWithdrawalThreshold`; a contract can loop sub-threshold calls in one transaction to synchronously exit an arbitrarily large position, bypassing the queue delay. Two Phase-2 agents raised this; impact depends on an intra-block PPS-manipulation primitive not established in-scope.

- **Fail-open strategy valuation lets redeemers exit at stale NAV during a valuation outage** — `redeem`/`withdraw` carry no `_requireStrategyValuationsReady` gate (unlike `deposit`/`mint`), and `_getStrategyAssetsSafe` (C:286-301) falls back to stale `strategyDebt` when a strategy's `getTotalAssets()` reverts. Two Phase-2 agents flagged this asymmetric fail-open/fail-closed trust model; severity depends on out-of-scope `IStrategy` revert behavior.

- **Management both proposes and adjudicates impairment challenge bonds it can slash to itself** — `rejectImpairmentChallenge` (C:1231) slashes an honest challenger's bond to `managementFeeRecipient` (management-controlled) while keeping the disputed root, capped at `maxImpairmentChallengesPerEpoch` (default 3). Single-sourced (one Phase-2 agent); impairment-root adjudication is inherently management-trusted by design.

- **Donation-into-`coinBalance` invariant holds only between transfers, not across `report()` cycles** — `_pullCreatorCoinExact`/`_pushCreatorCoinExact`/`_syncCoinBalance` reset `coinBalance = balanceOf(this)` post-transfer, so a direct token donation is absorbed on the next sync path and taxed as profit at the next `report()`. Two Phase-2 agents flagged this; both concluded it is self-harm to the donor with no attacker-profit path.

---

## Access-Control Inventory

_Full per-function table (~100 rows across both files) preserved in the audit working files; condensed by guard class below. See the coverage gate for confirmation every privileged function was examined._

| Guard | Representative functions | Moves value |
|---|---|---|
| `onlyOwner` | setModulesOnce, setImpairmentGuardian/Claims/RecoveryEscrow, setPaused, setGaugeController, setCcaLaunchArm, setBurnStream, setWhitelist*, setDebtPurchaser, setProtocolRescue/RescueDelay, cancelOwnershipRescue, setOperatorPerms, setRiskConfigDelay, setDeploymentParams, setMaxTotalSupply, setFlashLoanProtection, setTrustedPpsDeviationBps, rescueETH, rescueToken | rescueETH/Token: yes; rest: no |
| `onlyManagement` (mgmt‖owner) | impairment param setters, proposeImpairmentRoot, clearImpairmentRootAfterChallenge, rejectImpairmentChallenge, finalizeImpairment, strategy add/remove/reinstate/weight/migrate, queue config, keeper/emergencyAdmin setters, fee setters + scheduleSet*, executePendingRiskConfig, cancelPendingRiskConfig, injectCapital | injectCapital, migrateStrategy, removeStrategy, bond refund/slash: yes |
| `onlyKeepers` (keeper‖mgmt‖owner) | deployToStrategies, report, tend, rebalanceStrategies, notifyImpairmentRecovery | yes (all) |
| `onlyEmergencyAuthorized`/`onlyShutdownAuthorized` | emergencyWithdraw(FromStrategies), shutdownVault | yes (withdraw) |
| `onlyDebtPurchaser` (debtPurchaser‖owner) | buyDebt | yes |
| `onlyProtocolRescue` | initiateOwnershipRescue, finalizeOwnershipRescue | no (transfers owner role) |
| `nonReentrant` + `whenNotPaused/Shutdown` + `onlyWhitelisted`, no role | deposit, mint | yes |
| `nonReentrant` only, permissioned by ownership/allowance | redeem, withdraw, queueWithdrawal, claimQueuedWithdrawal, cancelQueuedWithdrawal | yes |
| **No role — permissionless by design** | `clearStaleImpairmentTrip` (timeout-gated), `challengeImpairmentRoot` (bond-gated), `mintImpairmentClaim` (proof-gated), `claimImpairmentRecovery` (balance-gated — **see Finding #1**), `permitOperator`/`permit` (signature-gated), `acceptManagement` (identity check deferred to out-of-scope admin module — unverifiable from this repo), `burnSharesForPriceIncrease` (wrapper unguarded; enforcing check verified present one layer down in the in-scope core module) | varies |

**Roles**: owner (OZ Ownable, overridden `_transferOwnership` clears pending rescue + pending risk-config + bumps `operatorEpoch`, but **does not clear `pendingManagement`** — see note below), management (two-step handoff), keeper/emergencyAdmin/gaugeController/debtPurchaser/impairmentGuardian/protocolRescue/ccaLaunchArm (one-step owner-set), burnStream (one-time by policy), operators (epoch-scoped bitmask via `setOperatorPerms` or owner-signed `permitOperator`).

**Note (Low, from Phase 1)**: ownership rescue (`finalizeOwnershipRescue`) does not clear `pendingManagement`, so a compromised owner's earlier `setPendingManagement(attacker)` survives a rescue recovery — the attacker can `acceptManagement()` afterward. Fix: clear `pendingManagement` in `_transferOwnership` alongside the other pending-state cleanup.

---

## Threat Model

_Actor × entrypoint × asset catalog. Each row marked addressed by a finding above, or "invariant holds" with the verifying reasoning._

| Actor | Reach | Potential gain | Status |
|---|---|---|---|
| Arbitrary caller | deposit/mint | Mint shares below fair value (inflation attack) | **Invariant holds** — MINIMUM_FIRST_DEPOSIT (50M) + virtual-shares offset (1000) + `InflationAttackDetected` guard + ±10% price-sanity checks verified sufficient by 3+ agents across both phases |
| Arbitrary caller | redeem/withdraw | Extract more coin than share value | **Invariant holds** — see "Rejected findings"; mathematically proven the reservation cap cannot underpay a legitimate redeemer |
| Any holder | cancelQueuedWithdrawal (no vaultMode gate) | Exit during Suspect mode when other flows are frozen | **Invariant holds (demoted)** — only returns shares, no asset movement, impairment accounting unaffected |
| Anyone (unauthenticated) | clearStaleImpairmentTrip | Prematurely wipe a real impairment | **Addressed by Finding #2** — the liveness valve can wipe a legitimate near-finalized root due to unordered timelock parameters |
| Anyone (bonded) | challengeImpairmentRoot | Grief/delay finalization | **Invariant holds** — per-epoch cap + bond + mgmt-only accept/reject verified sufficient; narrower COI concern in Leads |
| Anyone w/ Merkle proof | mintImpairmentClaim | Mint entitlement beyond loss share | **Invariant holds** — root integrity + cumulative `totalClaimSupply` cap verified |
| Claim-token holder | claimImpairmentRecovery | Double-spend recovery payout | **Addressed by Finding #1** — contingent on out-of-scope token transferability |
| Operator (perm-scoped) | deposit/mint/redeem/withdraw/queue/injectCapital | Act outside granted bitmask | **Invariant holds** — `_enforceOperatorPermIfGranted` bit-check verified per function |
| Signature relayer | permitOperator, permit | Replay across time/epoch/chain | **Mostly holds** — `permit` conformant; `permitOperator`'s epoch-omission and global-nonce caveats are Low findings from Phase 1 (P1-L11/L12 in working notes), not promoted here |
| Management | fee setters, scheduleSetX, proposeImpairmentRoot/finalizeImpairment | Extract value via fee hikes or biased resolution | **Partially addressed by Finding #3** (fee extraction via impairment cycling) and the COI lead on bond slashing; risk-config timelock (1-30d) bounds the fee-hike vector |
| Keeper | report() | Mis-report to mint unwarranted fees/burns | **Addressed by Findings #3, #4** |
| EmergencyAdmin/management/owner | emergencyWithdraw(FromStrategies) | Drain funds under "emergency" pretext | **Invariant holds** — role restricted correctly (guardian deliberately excluded) |
| Any large holder | `queueWithdrawal`/`claimQueuedWithdrawal` during `paused` | Bypass emergency freeze | **Addressed by Finding #5** — the `paused` flag is bypassable via the withdrawal queue, which lacks the guard `redeem`/`withdraw` carry |
| ProtocolRescue | initiateOwnershipRescue → finalizeOwnershipRescue | Hostile takeover of owner role | **Mostly holds** — timelocked (1-30d) + owner-cancel + auto-cancel; `pendingManagement` gap noted above |
| gaugeController/burnStream | burnSharesForPriceIncrease | Burn a different holder's shares | **Invariant holds** — verified burns only caller's own balance |
| Strategy contract (black-box) | getTotalAssets/isValuationReady | Skew reported NAV | **Partially addressed** — `strategyMaxAssets` clamp + `valuationMissThreshold` ejection are the defenses; fail-open/fail-closed asymmetry noted in Leads |
| Module deployer (owner, one-time) | setModulesOnce | Wire a module that trivially satisfies the identity check | **Noted, accepted as trusted-deployment risk** — `moduleStorageVersion()` check is tautological (both sides read the same shared constant) but the current layout was verified correct field-for-field; Low finding in Phase 1 working notes recommending CI-enforced layout verification |
| CCA launch-arm (black-box) | phase()/getLifecycleStatus() | Force deposits blocked or wrongly allowed | **Invariant holds** — fail-closed on double-revert verified adequate |

---

## Coverage Gate

- **Entrypoints**: ~100 external/public state-changing functions identified across `CreatorOVault.sol` + `CreatorOVaultCoreModule.sol` in the Phase 0 access-control inventory; every one received a Phase 1 checklist pass and/or Phase 2 attacker-agent examination. No entrypoint was left unexamined by both phases.
- **Threat-catalog rows**: 19 actor×entrypoint rows in the Phase 0 catalog; all 19 answered above (either "invariant holds" with verifying reasoning, or mapped to a numbered finding/lead).
- **Holes closed this pass**: 0. Both phases already covered the full inventory and catalog — the only orchestrator-level work in Phase 3 was (a) resolving the genuine 4-vs-4 agent conflict on the `redeem()` claim via direct mathematical verification against source (a re-examined lead, not a coverage hole — it was already examined by 8 total agents across both phases), and (b) merging/deduplicating overlapping findings.
- **Confidence floor used**: 50. Every finding above (Confidence ≥ 65) reflects a fully-traced mechanism; where a finding's real-world exploitability hinges on an out-of-scope contract's behavior (Finding #1's claim-token transferability), that dependency is stated explicitly rather than assumed.

---

> ⚠️ This review was performed by an AI-orchestrated multi-agent audit pipeline (context-building + breadth checklists + blind depth attackers + adversarial reconciliation). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human review, a public bug bounty, and on-chain monitoring are strongly recommended before mainnet deployment, especially given several findings here are contingent on the behavior of out-of-scope contracts (`_strategiesModule`, `_adminModule`, `OVaultImpairmentClaims`, `OVaultRecoveryEscrow`, `IStrategy`) that could not be inspected in this engagement.
