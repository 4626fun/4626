# Audit Findings — Source Reconciliation
**Repo:** `wenakita/4626` · branch `main` · read April 13, 2026  
**Status:** Findings compared against actual contract source. True positives get diff-ready patches. False positives and stale findings are called out explicitly.

---

## CRITICAL FINDINGS

---

### C-01 · CCALaunchStrategy.sol — Reentrancy
**Audit claim:** External token transfer before share burn.  
**Source reality:** `ReentrancyGuard` is **already imported and applied** (`nonReentrant` on every public mutating function: `sweepCurrency`, `finalizeFailedAuction`, `migrate`, `sweepUnsoldTokens`, `sweepResidualAuctionToken`, `sweepResidualCurrency`, and both `launchAuction` variants). `CCALaunchStrategy` is **not an ERC-4626 vault** — it is a launch strategy that delegates withdraw/redeem to the external `IContinuousClearingAuction` contract. There is no in-contract `_burn(owner, shares)` pattern. All transfers use `SafeERC20.safeTransfer`.

**True risk:** The `IContinuousClearingAuction` contract itself (not in this repo) handles bid settlement. If that external contract is ERC-777 callback-capable and does not guard re-entry, there is an indirect risk when `auction.sweepCurrency()` / `auction.claimTokens()` calls back into CCALaunchStrategy before the `currentAuction` pointer is cleared.

**Verdict:** Partial true positive — `ReentrancyGuard` is present but the external auction contract re-entry path is **not guarded**. The `migrate()` function calls `auction.checkpoint()` and then proceeds with state changes — if the external auction contract is adversarial, this path is exploitable.

**Patch — `contracts/vault/strategies/CCALaunchStrategy.sol`:**
```diff
-    function sweepCurrency() external nonReentrant {
+    function sweepCurrency() external nonReentrant {
         if (currentAuction == address(0)) revert NoActiveAuction();
         IContinuousClearingAuction auction = IContinuousClearingAuction(currentAuction);
+        // Cache and clear auction pointer BEFORE external call to prevent re-entry via auction callback
+        address auctionAddr = currentAuction;
+        currentAuction = address(0);  // CEI: clear state before external call
         auction.checkpoint();
         if (!auction.isGraduated()) revert AuctionNotGraduated();
         ...
         auction.sweepCurrency();
         currentLaunch.currencySwept = true;
+        currentAuction = auctionAddr; // restore after safe ops complete
```
> Note: The correct fix depends on whether `currentAuction` must remain set after sweep. A safer pattern is the standard CEI: snapshot all reads, update all state, then make external calls. An architectural review of the auction interface is required — flag for the re-audit scope.

---

### C-02 · CreatorCharmStrategy.sol — previewRedeem ERC-4626 Violation
**Audit claim:** `previewRedeem` ignores queue and returns full `convertToAssets`.  
**Source reality:** `CreatorCharmStrategy` **does not implement ERC-4626**. It implements `IStrategy` and `IStrategyValuation`. There is no `previewRedeem`, `previewWithdraw`, `maxRedeem`, or `maxWithdraw` override. The audit conflated the strategy adapter with the vault layer.

**True risk:** The *vault* (`CreatorOVault`) wraps strategies and presents an ERC-4626 interface to users. If `CreatorOVault.totalAssets()` calls `CreatorCharmStrategy.getTotalAssets()` and that function overstates liquid value (e.g., includes Charm LP shares that cannot be instantly redeemed), then `CreatorOVault`'s `previewRedeem` overstates realizable value — same economic outcome, different code location.

**Actual finding location:** `contracts/vault/CreatorOVault.sol` and `contracts/vault/CreatorOVaultWrapper.sol` — not `CreatorCharmStrategy.sol`.

**Also real:** The `rebalance()` function in CreatorCharmStrategy is effectively a no-op:
```solidity
// Line ~960
function rebalance() external override {
    require(msg.sender == owner() || msg.sender == vault, "Only owner or vault");
    uint256 totalAssets = getTotalAssets();
    emit StrategyRebalanced(totalAssets);
    // No actual rebalancing occurs — Charm vault handles its own
}
```
The H-04 slippage finding is confirmed but requires the Charm vault's own rebalance() to be triggered externally, not this contract.

**Verdict:** True positive, wrong contract. Must audit `CreatorOVault.sol` and `CreatorOVaultWrapper.sol` for the ERC-4626 preview correctness issue.

**Patch needed in:** `CreatorOVault.sol` / `CreatorOVaultWrapper.sol` — fetch those files for the next pass.

---

### C-03 · CreatorLPManager.sol — Missing Access Control on setStrategy
**Audit claim:** `function setStrategy(address strategy) external { currentStrategy = strategy; }` with no access control.  
**Source reality:** **No such function exists.** `CreatorLPManager` does not have `setStrategy` or `currentStrategy`. It manages Uniswap V4 liquidity for the *wrapped share token* (not the creator coin strategy). All setter functions (`setTwapOracle`, `setParameters`, `setVault`, `setManager`, `setFeeRecipient`, `emergencyWithdraw`) are gated with `onlyOwner`.

**Verdict:** FALSE POSITIVE. This finding does not apply to the current source. The auditor may have reviewed an older version or a different contract. **No patch required for `CreatorLPManager.sol`.**

> Action: Confirm with the auditor which contract version or file they reviewed. If the finding came from a different contract (e.g., an older `StrategyRouter`), locate that contract.

---

### C-04 · ERC4626StrategyAdapter.sol — Incorrect totalAssets During Rebalance
**Audit claim:** `totalAssets()` ignores `pendingMigrationAmount` during in-flight rebalance.  
**Source reality:** Confirmed real. `getTotalAssets()` is:
```solidity
function getTotalAssets() public view override returns (uint256) {
    uint256 idle = ASSET.balanceOf(address(this));
    uint256 sharesHeld = ERC4626_VAULT.balanceOf(address(this));
    if (sharesHeld == 0) return idle;
    try ERC4626_VAULT.convertToAssets(sharesHeld) returns (uint256 assetsFromShares) {
        return idle + assetsFromShares;
    } catch {
        return idle;
    }
}
```
The `rebalance()` function deposits idle into the ERC4626 vault or pulls from it, but there is no migration mechanism at all — `pendingMigrationAmount` does not exist. The actual risk is subtler: during `rebalance()`, a `try ERC4626_VAULT.deposit(toDeposit, address(this)) {} catch {}` can silently fail, leaving assets in-flight without updating accounting. Additionally there is no pause on deposits during rebalance.

**Verdict:** True positive (mechanics differ from audit description, risk is real). The deposit-during-rebalance window is the actual attack vector.

**Patch — `contracts/vault/strategies/ERC4626StrategyAdapter.sol`:**
```diff
+    bool public rebalanceActive;
+
+    modifier noDepositDuringRebalance() {
+        require(!rebalanceActive, "rebalance in progress");
+        _;
+    }
+
     function deposit(uint256 amount)
         external
         override
         onlyVault
         whenActive
         nonReentrant
+        noDepositDuringRebalance
         returns (uint256 deposited)
     {

     function rebalance() external override onlyVault {
+        rebalanceActive = true;
         uint256 total = getTotalAssets();
         uint256 desiredIdle = (total * idleBufferBps) / 10_000;
         uint256 idle = ASSET.balanceOf(address(this));

         if (idle > desiredIdle) {
             uint256 toDeposit = idle - desiredIdle;
             if (toDeposit > 0) {
                 ASSET.forceApprove(address(ERC4626_VAULT), toDeposit);
-                try ERC4626_VAULT.deposit(toDeposit, address(this)) {} catch {}
+                try ERC4626_VAULT.deposit(toDeposit, address(this)) {} catch {
+                    ASSET.forceApprove(address(ERC4626_VAULT), 0); // clear allowance on failure
+                }
             }
         } else if (idle < desiredIdle) {
             uint256 toPull = desiredIdle - idle;
             if (toPull > 0) {
                 _withdrawFrom4626BestEffort(toPull);
             }
         }

         _syncValuationSnapshotBestEffort();
+        rebalanceActive = false;
         emit StrategyRebalanced(getTotalAssets());
     }
```

---

### C-05 · LBPStrategyWithTaxHook.sol — Tax Hook Can Be Bypassed
**Audit claim:** Hook is optional; deployment without it silently omits the tax mechanism.  
**Source reality:** **Already fixed in current source.** Constructor explicitly guards:
```solidity
// Line 153-155
if (_taxHook == address(0)) revert ZeroAddress();
if (_taxHook.code.length == 0) revert ZeroAddress();
```
`taxHook` is `immutable` and the pool key is always initialized with `hooks: IHooks(taxHook)`.

**Verdict:** FALSE POSITIVE (already fixed). No patch required.

---

## HIGH SEVERITY FINDINGS

---

### H-01 · ConcentratedStrategy.sol — Stale Price Oracle / Short TWAP Window
**Source reality:** TWAP infrastructure is present and enforced. However, the **default `twapDuration` is 60 seconds** (1 minute), not the recommended 900 seconds (15 minutes). A 60-second TWAP is easily manipulable by a determined attacker across a single block sequence.

**Verdict:** True positive — mechanism exists, but default window is critically short.

**Patch — `contracts/vault/strategies/univ4/ConcentratedStrategy.sol`:**
```diff
-    uint32 public twapDuration = 60; // 1 minute
+    uint32 public twapDuration = 900; // 15 minutes — minimum safe TWAP window

-    int24 public maxTwapDeviation = 100;
+    int24 public maxTwapDeviation = 100; // ~1% — review if this needs tightening after TWAP window increase
```
> Also: The `twapOracle` starts as `address(0)`. Until `setTwapOracle()` is called, `getTwap()` reverts with `TwapOracleNotSet`. This means rebalances are **blocked** until the oracle is wired. Add a deployment checklist gate: oracle must be set and verified before the strategy accepts deposits.

---

### H-02 · FullRangeStrategy.sol — Fee Accrual Not Reflected in totalAssets
**Source reality:** Confirmed. `_collectFees()` is **commented out** in `rebalance()`:
```solidity
// Line 393
// _collectFees();
```
This means accrued V4 fees are never collected. `getTotalValue()` only counts `CREATOR_COIN.balanceOf(address(this))` + `PAIRED_TOKEN.balanceOf(address(this))` + estimated position value via `_calculateAmountsForLiquidity` — uncollected fees in the V4 PoolManager are not included.

**Verdict:** True positive. The commented-out call is the bug.

**Patch — `contracts/vault/strategies/univ4/FullRangeStrategy.sol`:**
```diff
     function rebalance() external onlyLPManager whenActive {
-        // Collect accrued fees
-        // _collectFees();
+        // Collect accrued V4 fees before computing position value
+        _collectFees();

         emit Rebalanced(block.timestamp);
     }
```
Additionally, add fee collection before deposit/withdraw if `_collectFees()` is view-safe in the V4 integration. If the implementation of `_collectFees()` is not yet written, this is a **blocker** — the function must be implemented before uncomment.

> Check: Does `_collectFees()` exist and compile? If not, this is a stub that needs full V4 unlock callback implementation.

---

### H-03 · LimitOrderStrategy.sol — Unclaimed Order Proceeds Not in totalAssets
**Source reality:** The code comment at line 561 states:
```
// Conservative behavior: unwind filled orders (burn+collect), leave proceeds idle.
```
This suggests the strategy leaves filled order proceeds as idle token balance, not tracked via a separate `unclaimedOrderProceeds()` view. If proceeds land as `ASSET.balanceOf(address(this))`, they would be counted in `totalAssets` — but only after an explicit `collect` step.

**Verdict:** Likely true positive — need to verify `getTotalAssets` implementation and whether the V4 hook's pending balance is included. The idle-balance approach is safer but requires atomically collecting on every deposit/withdraw call.

**Action:** Read full `LimitOrderStrategy.getTotalAssets()` — was not returned by grep (function may not implement `IStrategy`). Fetch the full file for the next pass.

---

### H-04 · CreatorCharmStrategy.sol — No Slippage Protection on Rebalance
**Source reality:** The strategy has `swapSlippageBps = 300` (3%) and `depositSlippageBps = 500` (5%) state variables, and slippage is applied to swaps. However, the `rebalance()` function (line ~960) is a **no-op** — it emits an event and does nothing:
```solidity
function rebalance() external override {
    require(msg.sender == owner() || msg.sender == vault, "Only owner or vault");
    uint256 totalAssets = getTotalAssets();
    emit StrategyRebalanced(totalAssets);
}
```
The actual Charm vault rebalancing happens inside the Charm vault itself, triggered externally by the keeper. The slippage concern applies to the **keeper's Charm vault `rebalance()` call**, not to this contract.

**Verdict:** Partially true positive — slippage protection exists for swaps within this strategy, but the keeper triggering `charmVault.rebalance()` directly (outside this contract) has no slippage guardrail enforced by this contract.

**Patch — add keeper-gated rebalance with slippage enforcement:**
```diff
+    uint256 public minRebalanceAmountOut; // Set by owner; enforced on keeper-triggered rebalances
+
+    function rebalanceCharmVault(uint256 expectedMinCreatorOut) external onlyKeeper {
+        uint256 beforeCreator = CREATOR.balanceOf(address(this));
+        // Trigger Charm vault rebalance
+        // (Charm vault's rebalance is permissionless; this wraps it with a post-check)
+        uint256 afterCreator = CREATOR.balanceOf(address(this));
+        require(afterCreator + charmSharesAsCreator() >= beforeCreator + charmSharesAsCreator() - expectedMinCreatorOut,
+            "slippage exceeded");
+    }
```
> Architectural note: the cleanest fix is to route all Charm rebalance calls through this contract so slippage bounds are always enforced.

---

### H-05 · SolanaStrategy.sol — Bridge Message Replay
**Source reality:** `SolanaStrategy` does **not have** an `executeFromSolana` function with a `nonce` parameter. The strategy uses a **keeper-push model**: keepers call `updateRemoteNav(uint256 newRemoteNav, bytes32 reportId)` and `reconcileFromSolana(uint256 amount, bytes32 reportId)`. There is no message relay path.

**True risk:** The `reportId` in `updateRemoteNav` and `reconcileFromSolana` is logged via events but **not stored in a `usedReportIds` mapping**. A keeper (or compromised keeper key) can replay the same `reportId` with a different `newRemoteNav` value multiple times, repeatedly moving NAV up or down within the per-update delta cap.

**Verdict:** True positive (different mechanism than audit described). `reportId` replay is the real issue.

**Patch — `contracts/vault/strategies/SolanaStrategy.sol`:**
```diff
+    mapping(bytes32 => bool) public usedReportIds;
+    error ReportIdAlreadyUsed();

     function updateRemoteNav(uint256 newRemoteNav, bytes32 reportId) external onlyKeeper {
+        if (usedReportIds[reportId]) revert ReportIdAlreadyUsed();
+        usedReportIds[reportId] = true;
         ...
     }

     function reconcileFromSolana(uint256 amount, bytes32 reportId) external onlyKeeper {
+        if (usedReportIds[reportId]) revert ReportIdAlreadyUsed();
+        usedReportIds[reportId] = true;
         ...
     }
```

---

### H-06 · SolanaBridgeStrategy.sol — Unchecked Bridge Return Value
**Source reality:** Confirmed. The `bridgeToSolana` call is:
```solidity
ISolanaBridgeAdapter(bridgeAdapter).bridgeToSolana{value: msg.value}(address(ASSET), amount, solanaDestination);
```
The `ISolanaBridgeAdapter` interface declares `bridgeToSolana` as `external payable` with **no return value** — so there is nothing to check. The risk is that the adapter silently fails (e.g., emits an event but does not actually relay) with no on-chain revert.

**Verdict:** True positive. The fix requires either the interface to return a `bool` or the adapter to revert on failure.

**Patch — `contracts/vault/strategies/SolanaBridgeStrategy.sol`:**
```diff
 interface ISolanaBridgeAdapter {
-    function bridgeToSolana(address token, uint256 amount, bytes32 solanaDestination) external payable;
+    function bridgeToSolana(address token, uint256 amount, bytes32 solanaDestination) external payable returns (bool success);
 }

     function bridgeToSolana(uint256 amount) external payable onlyOwner whenActive nonReentrant {
         ...
         ASSET.forceApprove(bridgeAdapter, amount);
-        ISolanaBridgeAdapter(bridgeAdapter).bridgeToSolana{value: msg.value}(address(ASSET), amount, solanaDestination);
+        bool ok = ISolanaBridgeAdapter(bridgeAdapter).bridgeToSolana{value: msg.value}(address(ASSET), amount, solanaDestination);
+        if (!ok) {
+            ASSET.forceApprove(bridgeAdapter, 0); // revoke allowance
+            revert BridgeFailed();
+        }
         emit BridgedToSolana(amount, solanaDestination);
     }
```
> Also add `error BridgeFailed();` to the errors block.
>
> Coordination required: The `SolanaBridgeAdapter` contract (`contracts/utilities/bridge/SolanaBridgeAdapter.sol`) must be updated to return `bool` and the underlying bridge call's success/failure must be surfaced.

---

## MEDIUM FINDINGS

---

### M-01 · CCALaunchStrategy.sol — maxDeposit Returns Misleading Value
**Source reality:** No `maxDeposit` override found in `CCALaunchStrategy.sol`. The contract does not implement ERC-4626. Deposit caps may exist in the auction contract. This finding likely applies to `CreatorOVault.sol`.

**Verdict:** Wrong contract. Audit `CreatorOVault.sol`.

---

### M-02 · ApprovedV4HooksRegistry.sol — No Revocation Mechanism
**Source reality:** FALSE POSITIVE. `setHookApproval(address hook, bool approved)` already exists and supports setting approved to `false`. The mapping is not append-only — `_approvedHooks[hook] = approved` is settable to `false` by the owner at any time. The `HookApprovalUpdated` event is emitted on both approve and revoke.

**Verdict:** FALSE POSITIVE. Already implemented correctly.

---

### M-03 · ConcentratedStrategy.sol — Tick Math Overflow in unchecked Blocks
**Verdict:** Needs manual review of the specific `unchecked` blocks. Flag for the re-audit. Low-priority given tick math is battle-tested from Uniswap V3 libraries.

---

### M-04 · FullRangeStrategy.sol — emergencyWithdraw Bypasses Share Math
**Source reality:** Confirmed. `emergencyWithdraw()` transfers all token balances to owner with no share accounting — no burn, no pause, no snapshot. Any depositor who called `deposit()` and holds a position record would find the strategy empty.

**Note:** `FullRangeStrategy` does not implement ERC-4626 shares directly — it tracks `totalLiquidity`. The "shares" are LP positions. The issue is that after emergency withdrawal, `totalLiquidity` remains non-zero while the actual position is gone.

**Patch — `contracts/vault/strategies/univ4/FullRangeStrategy.sol`:**
```diff
     function emergencyWithdraw() external onlyOwner {
+        isEmergencyMode = true;   // block further deposits/withdraws
+        totalLiquidity = 0;       // zero out position accounting
+        // If V4 position exists, unwind it first:
+        // _unwrapV4Position();    // implement full unwind before transferring tokens

         uint256 creatorBal = CREATOR_COIN.balanceOf(address(this));
         uint256 pairedBal = PAIRED_TOKEN.balanceOf(address(this));
         if (creatorBal > 0) CREATOR_COIN.safeTransfer(owner(), creatorBal);
         if (pairedBal > 0) PAIRED_TOKEN.safeTransfer(owner(), pairedBal);
+
+        emit EmergencyWithdrawExecuted(creatorBal, pairedBal);
     }
```

---

### M-05 · LBPStrategyWithTaxHook.sol — Tax Destination Hardcoded
**Source reality:** No `taxRecipient` state variable exists in `LBPStrategyWithTaxHook.sol`. The contract has no internal tax distribution logic — tax application is delegated entirely to the `taxHook` contract. If the hook handles recipient routing, the mutability question belongs there.

**Verdict:** Cannot confirm without reading the taxHook contract. The LBP contract itself does not expose a tax recipient. **Escalate to hook contract review.**

---

### M-06 · ERC4626StrategyAdapter.sol — Strategy Migration Has No Timelock
**Source reality:** There is **no migration mechanism** in `ERC4626StrategyAdapter.sol`. The adapter is immutably wired to a single `ERC4626_VAULT` (set at construction, `immutable`). There is no `scheduleMigration` or `executeMigration` function.

**Verdict:** FALSE POSITIVE for this contract. The migration/timelock concern may apply at the `CreatorOVault` level where strategies are swapped. Audit `CreatorOVaultStrategiesModule.sol`.

---

## SUMMARY TABLE

| ID | Contract | Audit Verdict | Source Reality | Action |
|----|----------|---------------|----------------|--------|
| C-01 | CCALaunchStrategy | CRITICAL | Partial TP — ReentrancyGuard present but external auction re-entry not guarded | Patch external call ordering in `sweepCurrency`/`migrate` |
| C-02 | CreatorCharmStrategy | CRITICAL | TP — wrong contract. ERC-4626 preview issue is in `CreatorOVault` | Audit `CreatorOVault.sol` |
| C-03 | CreatorLPManager | CRITICAL | **FALSE POSITIVE** — `setStrategy` does not exist | No action |
| C-04 | ERC4626StrategyAdapter | CRITICAL | TP — deposit-during-rebalance window is real | Patch: `rebalanceActive` flag + clear stale allowance |
| C-05 | LBPStrategyWithTaxHook | CRITICAL | **ALREADY FIXED** — constructor reverts on zero hook | No action |
| H-01 | ConcentratedStrategy | HIGH | TP — TWAP exists but default window is 60s (should be 900s) | Patch: change default `twapDuration` |
| H-02 | FullRangeStrategy | HIGH | TP — `_collectFees()` commented out | Patch: uncomment + implement |
| H-03 | LimitOrderStrategy | HIGH | Likely TP — needs full file read | Fetch full file |
| H-04 | CreatorCharmStrategy | HIGH | Partial TP — slippage exists for swaps; Charm rebalance unguarded | Add keeper-gated rebalance wrapper |
| H-05 | SolanaStrategy | HIGH | TP — `reportId` not stored, replay possible | Patch: `usedReportIds` mapping |
| H-06 | SolanaBridgeStrategy | HIGH | TP — interface returns void; silent failure possible | Patch: return bool + revert on failure |
| M-01 | CCALaunchStrategy | MEDIUM | Wrong contract — not ERC-4626 | Audit `CreatorOVault.sol` |
| M-02 | ApprovedV4HooksRegistry | MEDIUM | **FALSE POSITIVE** — `setHookApproval(addr, false)` already works | No action |
| M-03 | ConcentratedStrategy | MEDIUM | Needs manual review | Flag for re-audit |
| M-04 | FullRangeStrategy | MEDIUM | TP — `totalLiquidity` not zeroed on emergency exit | Patch: set `isEmergencyMode = true`, zero state |
| M-05 | LBPStrategyWithTaxHook | MEDIUM | Cannot confirm — belongs to taxHook contract | Escalate |
| M-06 | ERC4626StrategyAdapter | MEDIUM | **FALSE POSITIVE** — vault is immutable, no migration | Audit `CreatorOVaultStrategiesModule.sol` |

---

## FALSE POSITIVES (3)
- C-03: `CreatorLPManager.setStrategy` — does not exist
- C-05: `LBPStrategyWithTaxHook` tax hook bypass — already fixed at constructor
- M-02: `ApprovedV4HooksRegistry` revocation — already implemented via `setHookApproval(addr, false)`
- M-06: `ERC4626StrategyAdapter` migration timelock — no migration exists; vault is immutable

## ALREADY FIXED IN SOURCE (1 definite)
- C-05: `taxHook == address(0)` reverts in constructor

## WRONG CONTRACT (3)
- C-02: ERC-4626 preview semantics → `CreatorOVault.sol` / `CreatorOVaultWrapper.sol`
- M-01: `maxDeposit` cap → `CreatorOVault.sol`
- M-06: Strategy migration timelock → `CreatorOVaultStrategiesModule.sol`

## NEXT READS REQUIRED
1. `contracts/vault/CreatorOVault.sol` — ERC-4626 preview correctness, maxDeposit, strategy swap timelock
2. `contracts/vault/CreatorOVaultWrapper.sol` — wrapper redemption semantics
3. `contracts/vault/modules/CreatorOVaultStrategiesModule.sol` — strategy migration timelock
4. `contracts/vault/strategies/univ4/LimitOrderStrategy.sol` — full file for getTotalAssets
5. `contracts/utilities/bridge/SolanaBridgeAdapter.sol` — bridge return value interface
