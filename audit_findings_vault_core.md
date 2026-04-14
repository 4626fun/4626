# Security Audit: CreatorOVault Core + Modules
**Auditor:** Internal Security Review  
**Scope:** `CreatorOVault.sol`, `CreatorOVaultWrapper.sol`, `modules/CreatorOVaultCoreModule.sol`, `modules/CreatorOVaultStrategiesModule.sol`, `modules/CreatorOVaultAdminModule.sol`, `modules/CreatorOVaultModuleStorage.sol`, `modules/CreatorOVaultModuleBase.sol`  
**Date:** 2025

---

## Summary Table

| ID | Severity | Title | Contract |
|----|----------|-------|----------|
| H-01 | HIGH | Division by zero in `report()` when total assets reach zero | CoreModule |
| H-02 | HIGH | `emergencyWithdrawFromStrategies()` does not update `strategyDebt`/`totalDebt`, causing permanent double-counting in `totalAssets()` | AdminModule |
| H-03 | HIGH | Queue withdrawal unlock timer is fully reset on each subsequent `queueWithdrawal()` call, locking already-matured funds | CoreModule |
| M-01 | MEDIUM | Flash-loan protection is per-wrapper-contract, not per-user — one deposit blocks all wrapper users from redeeming in the same block | CreatorOVaultWrapper |
| M-02 | MEDIUM | `removeStrategy()` uses strict withdrawal and reverts if strategy returns a shortfall, permanently trapping funds when a strategy is insolvent or adversarial | StrategiesModule |
| M-03 | MEDIUM | `emergencyWithdrawFromStrategies()` and `emergencyWithdraw()` lack `nonReentrant` guard; a malicious strategy can re-enter the vault | AdminModule / CreatorOVault |
| M-04 | MEDIUM | `injectCapital()` is callable by any address with no access control, allowing untrusted callers to manipulate the price-per-share checkpoint and grief users | CoreModule / CreatorOVault |
| M-05 | MEDIUM | `maxDeposit()` returns share-denominated value (not assets) when total supply is zero, violating ERC-4626 and breaking compliant integrators | CoreModule / CreatorOVault |
| M-06 | MEDIUM | Ownership rescue can be initiated with `rescueDelay = 0` if owner resets delay to zero via `setRescueDelay` (only bounded at set-time, not at initiation-time) | AdminModule |
| L-01 | LOW | `maxWithdraw()` / `maxRedeem()` return 0 when paused, but `redeem()` / `withdraw()` themselves are not paused — ERC-4626 non-compliance and integrator confusion | CoreModule / CreatorOVault |
| L-02 | LOW | Fee-on-transfer token risk in `emergencyWithdrawFromStrategies()` — the afterBal check uses the vault's own balance, not the strategy's reported amount | AdminModule |
| L-03 | LOW | `pricePerShare()` ignores ERC-4626 virtual shares offset, producing a slightly inflated PPS that diverges from `previewRedeem(1e18)/1e18`, creating inaccurate price-change guards | CoreModule / CreatorOVault |
| L-04 | LOW | `addStrategy()` / `removeStrategy()` / `updateStrategyWeight()` lack `nonReentrant` — a malicious strategy added via `addStrategy` could reenter the vault during the `isActive()` / `asset()` checks | StrategiesModule |
| L-05 | LOW | `setProtocolRescue(address(0))` silently disables the rescue mechanism without an explicit acknowledgement / warning event | AdminModule |
| L-06 | LOW | Donation attack: direct token transfers inflate `totalAssets()`, which on next `report()` creates artificial profit, minting performance-fee shares to the fee recipient at donors' expense | CreatorOVault |
| L-07 | LOW | `queueWithdrawal` overwrites `queued.receiver` on every call; a user with a pending queue can silently redirect their own withdrawal to a new address after the lock period passes, which is unexpected | CoreModule |
| I-01 | INFO | `burnSharesForPriceIncrease()` has no `nonReentrant` modifier (uses assembly `_delegate`) | CreatorOVault |
| I-02 | INFO | Storage layout comment says "must match vault exactly" but is never verified on-chain at upgrade time; a version mismatch would silently corrupt state | ModuleStorage |
| I-03 | INFO | `report()` bootstrap guard (`previousTotalAssets == 0 && trustedPpsCheckpoint == 0`) can be triggered again after a full vault drain, resetting the profit/loss baseline | CoreModule |
| I-04 | INFO | `_decreaseReportBaselineForPrincipalOutflow` rebuilds baseline from live `totalAssets()` when baseline is zero, allowing a flash-loan-assisted vault drain to reset the accounting baseline | CoreModule / CreatorOVault |

---

## Detailed Findings

---

### H-01 — Division by Zero in `report()` When Total Assets Reach Zero

**Severity:** HIGH  
**Contract:** `modules/CreatorOVaultCoreModule.sol`  
**Lines:** 614–638

**Code Snippet:**
```solidity
// CoreModule.sol, line 614
uint256 lossShares = supply > 0 ? (loss * supply) / currentTotalAssets : 0;
```

**Description:**  
Inside `report()`, the loss path calculates `lossShares` as `(loss * supply) / currentTotalAssets`. If a strategy suffers a total loss (all deployed assets go to zero), `currentTotalAssets` evaluates to `0` while `supply` remains positive (shareholders still hold shares). Solidity will produce a division-by-zero panic, causing `report()` to revert permanently.

**Attack / Trigger Scenario:**
1. All assets are deployed to a single strategy that suffers a complete loss (bug, rug, or exploit).
2. `totalAssets()` returns `0`; `totalSupply()` > 0.
3. The keeper or management calls `report()`.
4. Execution reverts with a panic at the division.
5. The vault is permanently bricked: no profit reporting, no new PPS checkpoint, no performance fee collection.

**Impact:**  
The vault can never process the loss event, leaving `totalAssetsAtLastReport` permanently stale. `trustedPpsCheckpoint` is never updated, preventing future deposits (the PPS deviates too far). The vault is effectively frozen even though funds may remain elsewhere.

**Recommended Fix:**
```solidity
// If currentTotalAssets == 0, all locked shares should be burned (100% loss absorbed)
uint256 lossShares;
if (currentTotalAssets == 0) {
    lossShares = totalLockedShares; // burn all locked profit shares
} else if (supply > 0) {
    lossShares = (loss * supply) / currentTotalAssets;
}
```

---

### H-02 — `emergencyWithdrawFromStrategies()` Does Not Update `strategyDebt` / `totalDebt`

**Severity:** HIGH  
**Contract:** `modules/CreatorOVaultAdminModule.sol`  
**Lines:** 82–99

**Code Snippet:**
```solidity
// AdminModule.sol, lines 82–99
function emergencyWithdrawFromStrategies() external onlyDelegateCall {
    IERC20 coin = _creatorCoin();
    uint256 length = strategyList.length;
    for (uint256 i = 0; i < length; i++) {
        address strategy = strategyList[i];
        if (!activeStrategies[strategy]) continue;

        uint256 beforeBal = coin.balanceOf(address(this));
        try IStrategy(strategy).emergencyWithdraw() returns (uint256) {
            uint256 afterBal = coin.balanceOf(address(this));
            if (afterBal >= beforeBal) {
                coinBalance = afterBal;          // updates coinBalance only
            } else {
                coinBalance = coin.balanceOf(address(this));
            }
        } catch {}
    }
    // NO update to strategyDebt[strategy] or totalDebt
}
```

**Description:**  
When `emergencyWithdrawFromStrategies()` is called, it pulls funds back from all strategies using a best-effort `try/catch`. However, it updates only `coinBalance`; it never zeroes `strategyDebt[strategy]` or subtracts from `totalDebt`. After this call, `totalAssets()` double-counts: the vault's live token balance now includes the recovered funds, but `_getStrategyAssetsSafe()` still returns the stale `strategyDebt` for each strategy (fallback when `getTotalAssets()` reverts, or the actual reported value which may also be stale).

**Attack / Trigger Scenario:**
1. Emergency is declared; `emergencyWithdrawFromStrategies()` is called.
2. Strategy returns 1,000,000 tokens to vault. `coinBalance` is updated.
3. `totalAssets()` returns: `balanceOf(vault)` (includes 1M) + `strategyDebt[strategy]` (still 1M) = **2M** instead of 1M.
4. Share price appears doubled.
5. Any redemption, report, or deposit operates with an inflated PPS, potentially allowing over-redemption or incorrect fee minting.

**Impact:**  
Critical accounting inflation. Users redeeming after the emergency call receive more tokens than their pro-rata share; the last redeemers receive nothing.

**Recommended Fix:**  
Update `strategyDebt` and `totalDebt` inside the loop:
```solidity
uint256 recovered = afterBal - beforeBal;
uint256 debt = strategyDebt[strategy];
uint256 reduction = recovered > debt ? debt : recovered;
strategyDebt[strategy] -= reduction;
totalDebt -= reduction;
coinBalance = afterBal;
```

---

### H-03 — Queued Withdrawal Unlock Timer Reset on Every Subsequent Queue Call

**Severity:** HIGH  
**Contract:** `modules/CreatorOVaultCoreModule.sol`  
**Lines:** 352–373

**Code Snippet:**
```solidity
// CoreModule.sol, lines 368–371
QueuedWithdrawal storage queued = queuedWithdrawals[msg.sender];
queued.shares += shares;           // accumulates
queued.unlockBlock = unlockBlock;  // always reset to block.number + largeWithdrawalDelayBlocks
queued.receiver = receiver;        // receiver also overwritten
```

**Description:**  
The `queueWithdrawal` function accumulates `shares` by adding to `queued.shares`, but always overwrites `queued.unlockBlock` with a fresh `block.number + largeWithdrawalDelayBlocks`. If a user calls `queueWithdrawal` a second time while an existing entry exists — even after the original unlock block has passed — the entire combined position's unlock time is reset to the new timestamp. The user's originally mature shares are re-locked.

**Attack / Trigger Scenario (griefing):**
1. User queues 100k shares. `unlockBlock = N + 10`.
2. At block N+11, user calls `queueWithdrawal(1 share, ...)` again (1 share which is still ≥ threshold after addition).
3. `unlockBlock` is reset to `N + 11 + 10 = N + 21`. All 100001 shares now locked until block N+21.
4. An adversarial miner / MEV bot can spam tiny queues every block to permanently lock the user.

**Self-inflicted scenario:**  
A user who accidentally calls `queueWithdrawal` twice loses access to already-matured funds until the new delay expires.

**Impact:**  
Withdrawal griefing. Users can be permanently denied access to their queued funds by a persistent adversary performing minimal-cost dust calls each block.

**Recommended Fix:**  
Only update `unlockBlock` if there is no existing pending entry, or track each queue entry separately:
```solidity
if (queued.shares == 0) {
    queued.unlockBlock = unlockBlock;
}
queued.shares += shares;
queued.receiver = receiver; // optionally revert if existing entry
```
Alternatively, require cancellation of the existing entry before a new one can be queued.

---

### M-01 — Flash Loan Protection Is Per-Wrapper, Not Per-User

**Severity:** MEDIUM  
**Contract:** `CreatorOVaultWrapper.sol`  
**Lines:** 268–299, `CreatorOVault.sol` lines 1746–1772

**Code Snippet:**
```solidity
// Wrapper.sol, line 276: receiver is the wrapper, not the end user
uint256 vaultShares = vault.deposit(amount, address(this));

// Vault._update, line 1768: lastDepositBlock is set for the RECEIVER
lastDepositBlock[to] = block.number;  // 'to' = address(wrapper)
```

**Description:**  
The vault's flash-loan protection tracks `lastDepositBlock[owner_]` and requires `block.number >= lastDepositBlock[owner_] + withdrawDelayBlocks` before allowing a redeem. When users interact through the wrapper, the vault's `deposit()` is called with `receiver = address(wrapper)`, so `lastDepositBlock[wrapper]` is stamped each time any user deposits. When any user then calls `withdraw()`, `vault.redeem(vaultShares, ..., address(this))` checks `lastDepositBlock[wrapper]`, not the individual user's block.

Consequently:
- Any deposit through the wrapper refreshes the cooldown for **all** wrapper users.
- An attacker can deposit a small amount through the wrapper in every block, permanently blocking all synchronous redemptions through the wrapper.
- Conversely, if no deposits have occurred recently, the per-user time gap is not tracked at all — a user could deposit and immediately redeem through the wrapper if enough blocks have passed since the last any-user deposit.

**Impact:**  
Flash-loan protection completely ineffective at the per-user level when routed through the wrapper. Griefing vector to permanently DoS wrapper redemptions.

**Recommended Fix:**  
The wrapper should maintain its own `lastDepositBlock[user]` mapping and enforce the same delay before calling `vault.redeem()`. Alternatively, the vault should accept an `owner` parameter distinct from `receiver` for the deposit cooldown tracking.

---

### M-02 — `removeStrategy()` Reverts on Shortfall, Permanently Trapping Funds

**Severity:** MEDIUM  
**Contract:** `modules/CreatorOVaultStrategiesModule.sol`  
**Lines:** 97–124

**Code Snippet:**
```solidity
// StrategiesModule.sol, lines 101–106
uint256 currentDebt = strategyDebt[strategy];
if (currentDebt > 0) {
    uint256 withdrawn = _withdrawFromStrategyMeasured(strategy, currentDebt);
    if (withdrawn < currentDebt) revert StrategyWithdrawShortfall(currentDebt, withdrawn);
    // ...
}
```

**Description:**  
`removeStrategy()` calls the strict `_withdrawFromStrategyMeasured()` which requires the strategy to return exactly `currentDebt` tokens. If the strategy has experienced any loss (market slippage, partial insolvency, deliberate refusal), the vault has recorded more debt than the strategy can return, and `removeStrategy()` reverts with `StrategyWithdrawShortfall`. There is no force-remove path.

A malicious or buggy strategy can use this to brick the strategy slot permanently — management cannot remove it, add replacements (MAX_STRATEGIES = 5), or reassign its weight.

**Attack Scenario:**
1. Attacker convinces management to add a malicious strategy.
2. Some funds are deployed to it via `tend()` / `deployToStrategies()`.
3. Malicious strategy's `withdraw()` always returns 0 (or less than expected).
4. `removeStrategy()` reverts every time.
5. The slot remains occupied, the strategy weight is locked, and deployment to good strategies is proportionally constrained.

**Impact:**  
Strategy slot DoS. Funds may be recoverable via `emergencyWithdrawFromStrategies()` but the slot cannot be freed, limiting the vault to 4 usable strategies.

**Recommended Fix:**  
Add a `forceRemoveStrategy(address strategy)` that skips the shortfall check, zeroes out the debt (accepting the loss), and removes the strategy:
```solidity
function forceRemoveStrategy(address strategy) external onlyManagement onlyDelegateCall {
    uint256 debt = strategyDebt[strategy];
    // best-effort withdrawal
    if (debt > 0) {
        try IStrategy(strategy).withdraw(debt) returns (uint256 withdrawn) {
            // ignore shortfall
        } catch {}
    }
    totalDebt -= strategyDebt[strategy];
    strategyDebt[strategy] = 0;
    // ... rest of removal logic
}
```

---

### M-03 — `emergencyWithdrawFromStrategies()` and `emergencyWithdraw()` Lack `nonReentrant`

**Severity:** MEDIUM  
**Contract:** `CreatorOVault.sol` lines 1512–1518; `modules/CreatorOVaultAdminModule.sol` lines 82–112

**Code Snippet:**
```solidity
// CreatorOVault.sol, line 1512 — no nonReentrant
function emergencyWithdrawFromStrategies() external onlyEmergencyAuthorized {
    _delegate(_adminModule);
}

// CreatorOVault.sol, line 1516 — no nonReentrant
function emergencyWithdraw(uint256 amount, address to) external onlyEmergencyAuthorized {
    _delegate(_adminModule);
}
```

**Description:**  
Both functions use `_delegate()` (assembly `return` variant) which bypasses Solidity's `nonReentrant` epilogue. Neither function is decorated with `nonReentrant`. Inside `emergencyWithdrawFromStrategies()`, external calls are made to each strategy's `emergencyWithdraw()`. A malicious strategy could re-enter the vault during this call.

Additionally, since `_delegate()` uses an assembly `return`, even if `nonReentrant` were added, the modifier's epilogue (resetting `_status`) would never execute.

**Impact:**  
If an adversarial strategy is ever added (even by a compromised management key), it could re-enter `emergencyWithdraw()`, `shutdownVault()`, or other admin functions during the emergency withdrawal loop, potentially draining idle funds before accounting is updated.

**Recommended Fix:**  
Switch to `_delegateAndReturn()` so modifiers work correctly, and add `nonReentrant`:
```solidity
function emergencyWithdrawFromStrategies() external nonReentrant onlyEmergencyAuthorized {
    _delegateAndReturn(_adminModule);
}
```

---

### M-04 — `injectCapital()` Has No Access Control

**Severity:** MEDIUM  
**Contract:** `CreatorOVault.sol` line 1433; `modules/CreatorOVaultCoreModule.sol` lines 665–674

**Code Snippet:**
```solidity
// CreatorOVault.sol, line 1433
function injectCapital(uint256 amount) external nonReentrant whenNotPaused {
    _delegateAndReturn(_coreModule);
}

// CoreModule.sol, lines 665–674
function injectCapital(uint256 amount) external onlyDelegateCall {
    if (amount == 0) revert ZeroAmount();
    uint256 priceBefore = pricePerShare();
    _pullCreatorCoinExact(msg.sender, amount);
    uint256 priceAfter = pricePerShare();
    _checkPriceChange(priceBefore, priceAfter);
    emit CapitalInjected(msg.sender, amount, priceAfter);
}
```

**Description:**  
`injectCapital()` allows anyone to deposit creator coins directly into the vault without minting shares, thereby increasing the price-per-share for all existing holders. While this is described as intended for the "protocol treasury," it is callable by any EOA or contract. The `_checkPriceChange` guard limits single-transaction impact to 10%, but there is no rate limit, identity restriction, or minimum amount.

**Impact:**
1. **Price manipulation**: Any holder can call `injectCapital()` to inflate PPS by up to 10% per transaction. This can cause `_checkTrustedPpsDeviation` to trigger (if checkpoint was recently set within a tight band), DoS-ing deposits.
2. **Fee grief**: Injecting capital just before a `report()` causes the injected amount to be counted as vault "profit," generating performance fee shares for the fee recipient at the injector's cost — a self-sacrifice grief that unfairly enriches the fee recipient.
3. **Whitelist bypass**: Even when `whitelistEnabled = true`, non-whitelisted addresses can inject capital (changing vault state and PPS) without being whitelisted.

**Recommended Fix:**  
Restrict `injectCapital()` to `onlyOwner` or a dedicated role:
```solidity
function injectCapital(uint256 amount) external nonReentrant whenNotPaused onlyManagement {
    _delegateAndReturn(_coreModule);
}
```

---

### M-05 — `maxDeposit()` Returns Shares Instead of Assets When Supply Is Zero

**Severity:** MEDIUM  
**Contract:** `CreatorOVault.sol` lines 964–976; `modules/CreatorOVaultCoreModule.sol` lines 419–432

**Code Snippet:**
```solidity
// CreatorOVault.sol, line 973
if (supply == 0) return remainingShares; // BUG: remainingShares is in shares, not assets
```

**Description:**  
Per ERC-4626, `maxDeposit(address)` MUST return the maximum amount of **assets** that can be deposited. When `totalSupply() == 0` (vault is empty), the function returns `remainingShares = maxTotalSupply - currentSupply`, which is a share count. Due to the `_decimalsOffset() = 3` virtual offset, depositing `maxTotalSupply` assets would actually mint far fewer shares than `maxTotalSupply`. The returned value overstates the true asset ceiling by approximately `NORMALIZATION_FACTOR` (1000×).

**Impact:**  
ERC-4626-compliant integrators (aggregators, routers, DeFi protocols) that rely on `maxDeposit()` to determine how many tokens to send will attempt to deposit up to 1000× more than the vault actually accepts. This breaks integrator UX and violates the EIP standard. On the first deposit, the call would fail with `FirstDepositTooSmall` or `InvalidAmount` if the overstated amount exceeds supply cap.

**Recommended Fix:**  
When supply is zero, compute the correct asset equivalent:
```solidity
if (supply == 0) {
    // Convert max remaining shares to approximate assets
    // First deposit: shares ≈ assets * 10^decimalsOffset (virtual offset)
    return remainingShares / (10 ** _decimalsOffset());
}
```

---

### M-06 — Rescue Can Be Initiated with Delay of Zero if Owner Clears `rescueDelay`

**Severity:** MEDIUM  
**Contract:** `modules/CreatorOVaultAdminModule.sol` lines 185–193

**Code Snippet:**
```solidity
// AdminModule.sol, lines 185–193
function initiateOwnershipRescue(address newOwner) external onlyDelegateCall {
    if (pendingRescueOwner != address(0)) revert RescueAlreadyPending(pendingRescueOwner);
    if (newOwner == address(0) || newOwner == _owner) revert InvalidRescueOwner(newOwner);

    pendingRescueOwner = newOwner;
    uint64 unlockTime = uint64(block.timestamp) + rescueDelay;  // rescueDelay can be 0!
    rescueUnlockTime = unlockTime;
    ...
}
```

**Description:**  
`setRescueDelay()` enforces a minimum of `MIN_RESCUE_DELAY` (1 day). However, the constructor sets `rescueDelay = 7 days`, and `setRescueDelay` allows resetting to any value ≥ 1 day. The concern is more subtle: if the owner (or a compromised owner) calls `setProtocolRescue(address(0))` and then somehow `rescueDelay` is zeroed via an uninitialized state (e.g., storage collision in an upgrade scenario or new vault deployment before constructor runs), `initiateOwnershipRescue` would set `unlockTime = block.timestamp + 0 = block.timestamp`, allowing `finalizeOwnershipRescue()` to be called in the same transaction.

More practically: since `setRescueDelay` is callable by the owner, a malicious or compromised owner can reduce delay to `MIN_RESCUE_DELAY` (1 day), greatly shortening the timelock.

**Additional Note:**  
`initiateOwnershipRescue()` does not verify that `protocolRescue != address(0)`, though the vault-level `onlyProtocolRescue` modifier provides this check before the delegatecall reaches the module. The module itself has no independent guard.

**Recommended Fix:**  
Add a guard in `initiateOwnershipRescue()`:
```solidity
if (rescueDelay < MIN_RESCUE_DELAY) revert RescueDelayOutOfBounds(rescueDelay, MIN_RESCUE_DELAY, MAX_RESCUE_DELAY);
```

---

### L-01 — `maxWithdraw()` / `maxRedeem()` Return 0 When Paused, But Redeem/Withdraw Still Execute

**Severity:** LOW  
**Contract:** `modules/CreatorOVaultCoreModule.sol` lines 444–463; `CreatorOVault.sol` lines 903–927

**Code Snippet:**
```solidity
// CoreModule.sol
function maxWithdraw(address owner_) external view onlyDelegateCall returns (uint256) {
    if (paused) return 0;  // says 0...
    // ...
}

// CreatorOVault.sol — redeem has NO whenNotPaused
function redeem(uint256 shares, address receiver, address owner_)
    public override nonReentrant returns (uint256 assets)
{
    bytes memory ret = _delegateAndReturn(_coreModule);  // succeeds even when paused
}
```

**Description:**  
ERC-4626 specifies that `maxWithdraw` and `maxRedeem` returning 0 for a user implies that `withdraw` / `redeem` MUST revert for that user. Here, `maxWithdraw` / `maxRedeem` return 0 when paused, but `redeem()` and `withdraw()` do not have a `whenNotPaused` modifier. They will succeed as long as other conditions pass.

**Impact:**  
ERC-4626 non-compliance breaks integrators that query `maxWithdraw` to gate redemptions. Some vaults/protocols check `maxWithdraw > 0` before calling `withdraw` and would incorrectly infer that withdrawal is impossible.

**Recommended Fix:**  
Either add `whenNotPaused` to `redeem()` and `withdraw()`, or remove the pause check from `maxWithdraw`/`maxRedeem` (allowing exits even when paused). The former is more conservative.

---

### L-02 — `emergencyWithdrawFromStrategies()` Incorrectly Handles Strategy Balance Delta on Error

**Severity:** LOW  
**Contract:** `modules/CreatorOVaultAdminModule.sol` lines 82–99

**Code Snippet:**
```solidity
try IStrategy(strategy).emergencyWithdraw() returns (uint256) {
    uint256 afterBal = coin.balanceOf(address(this));
    if (afterBal >= beforeBal) {
        coinBalance = afterBal;
    } else {
        coinBalance = coin.balanceOf(address(this));  // redundant double-call
    }
} catch {}
```

**Description:**  
The `else` branch (when `afterBal < beforeBal`) calls `coin.balanceOf(address(this))` a second time. This is functionally identical to using `afterBal` (since no state changes occur between the two reads), so this branch is dead code — it just costs extra gas. Additionally, if the strategy's `emergencyWithdraw()` causes a net decrease in the vault's token balance (e.g., via a fee-on-transfer token, or a deflationary rebasing), `coinBalance` is updated to the reduced balance but no error is reported, silently losing track.

**Recommended Fix:**
```solidity
uint256 afterBal = coin.balanceOf(address(this));
coinBalance = afterBal;
// No else needed — afterBal is already the current balance
```

---

### L-03 — `pricePerShare()` Ignores ERC-4626 Virtual Shares Offset

**Severity:** LOW  
**Contract:** `modules/CreatorOVaultCoreModule.sol` lines 555–559; `CreatorOVault.sol` lines 1781–1785

**Code Snippet:**
```solidity
function pricePerShare() public view returns (uint256) {
    uint256 supply = _totalSupply;  // raw supply, no virtual offset
    if (supply == 0) return 1e18;
    return (totalAssets() * 1e18) / supply;
}
```

**Description:**  
The vault uses `_decimalsOffset() = 3`, meaning OZ's ERC-4626 bakes in 10^3 = 1000 "virtual" shares in its conversion math (`previewDeposit`, `convertToShares`, etc.). `pricePerShare()` computes PPS using raw `_totalSupply` without adding the virtual offset, producing a result that diverges from `previewRedeem(1e18)` by a factor related to the virtual offset.

This affects:
- `_checkPriceChange()` — may incorrectly flag legitimate deposit/withdraw operations as price manipulation
- `_checkTrustedPpsDeviation()` — the saved checkpoint uses the naive formula, so deviations include the noise from the virtual offset mismatch
- `report()` — `trustedPpsCheckpoint` is set to the naive PPS

**Impact:**  
Minor imprecision in price guards; not exploitable but could cause false-positive circuit-breaker triggers on very small vaults where the virtual offset is proportionally large.

**Recommended Fix:**  
Match the OZ conversion formula:
```solidity
return ((totalAssets() + 1) * 1e18) / (_totalSupply + 10 ** _decimalsOffset());
```

---

### L-04 — Strategy Management Functions Lack `nonReentrant`

**Severity:** LOW  
**Contract:** `CreatorOVault.sol` lines 1187–1231; `modules/CreatorOVaultStrategiesModule.sol`

**Code Snippet:**
```solidity
// CreatorOVault.sol, line 1187 — no nonReentrant
function addStrategy(address strategy, uint256 weight) external onlyManagement {
    _delegate(_strategiesModule);
}

// CreatorOVault.sol, line 1206 — no nonReentrant  
function removeStrategy(address strategy) external onlyManagement {
    _delegate(_strategiesModule);
}
```

**Description:**  
`addStrategy()`, `removeStrategy()`, and `updateStrategyWeight()` all use `_delegate()` (the assembly `return` variant) without `nonReentrant`. The `_delegate()` call cannot safely coexist with `nonReentrant` anyway (would leave the guard permanently set), but the lack of reentrancy protection means that during `addStrategy()`, the external call to `IStrategy(strategy).isActive()` or `IStrategy(strategy).asset()` can re-enter the vault.

**Scenario:**
- Management calls `addStrategy(maliciousStrategy, weight)`.
- `maliciousStrategy.isActive()` re-enters `addStrategy()` with a different (legitimate) strategy address.
- The inner call succeeds first, occupying a slot. The outer call may then exceed `MAX_STRATEGIES` or corrupt `totalStrategyWeight`.

**Impact:**  
Exploitable only by management adding a malicious strategy. Under normal trust assumptions this is low severity, but defense in depth is recommended.

**Recommended Fix:**  
Switch to `_delegateAndReturn()` and add `nonReentrant`:
```solidity
function addStrategy(address strategy, uint256 weight) external nonReentrant onlyManagement {
    _delegateAndReturn(_strategiesModule);
}
```

---

### L-05 — `setProtocolRescue(address(0))` Silently Disables Rescue Without Event Clarity

**Severity:** LOW  
**Contract:** `modules/CreatorOVaultAdminModule.sol` lines 170–174

**Code Snippet:**
```solidity
function setProtocolRescue(address rescue) external onlyDelegateCall {
    if (pendingRescueOwner != address(0)) revert RescueAlreadyPending(pendingRescueOwner);
    protocolRescue = rescue;
    emit RescueConfigured(rescue, rescueDelay);  // emits even with rescue=address(0)
}
```

**Description:**  
The owner can set `protocolRescue = address(0)` to disable the rescue mechanism. The same `RescueConfigured` event is emitted whether the rescue address is being set to a real address or to zero, making off-chain monitoring ambiguous. Additionally, there is no separate confirmation or acknowledgement required before this "disable" action takes effect.

**Impact:**  
An attacker who gains owner access can silently disable the rescue mechanism and then have no recovery path for users if the owner key is subsequently lost.

**Recommended Fix:**  
Emit a dedicated `RescueDisabled` event when `rescue == address(0)`:
```solidity
if (rescue == address(0)) {
    emit RescueDisabled();
} else {
    emit RescueConfigured(rescue, rescueDelay);
}
```

---

### L-06 — Donation Attack: Direct Transfers Inflate `totalAssets()` and Generate Artificial Fees

**Severity:** LOW  
**Contract:** `CreatorOVault.sol` lines 789–801

**Code Snippet:**
```solidity
function totalAssets() public view override returns (uint256) {
    uint256 total = CREATOR_COIN.balanceOf(address(this));  // reads live balance
    // ...
}
```

**Description:**  
`totalAssets()` reads the live `CREATOR_COIN.balanceOf(address(this))` without subtracting any "untracked" balance. If anyone directly transfers creator coins to the vault without calling `deposit()`, those tokens inflate `totalAssets()` immediately. On the next `report()`, this extra balance appears as "profit," causing performance fee shares to be minted to the fee recipient at no cost to shareholders — the donor effectively subsidises the fee recipient.

**Scenario:**
1. Vault has 1M tokens. Attacker sends 100k tokens directly to vault.
2. `totalAssets()` = 1.1M. `totalAssetsAtLastReport` = 1M.
3. Keeper calls `report()`. Profit = 100k. Performance fee (e.g. 20%) = 20k tokens worth of shares minted to fee recipient.
4. Attacker "donated" 100k to permanently enrich the fee recipient, diluting existing shareholders.

**Impact:**  
Griefable performance fee extraction. Not catastrophic but noteworthy for protocols sharing vaults with adversarial parties.

**Recommended Fix:**  
Track accounted idle balance via `coinBalance` and use it instead of live `balanceOf`, or subtract `unaccountedBalance = balanceOf - coinBalance` in `totalAssets()`:
```solidity
function totalAssets() public view override returns (uint256) {
    uint256 total = coinBalance;  // use tracked balance
    // ...
}
```
Note: `coinBalance` must be kept rigorously synchronized; a separate audit of all `coinBalance` update paths would be required.

---

### L-07 — `queueWithdrawal` Overwrites `receiver` on Subsequent Calls

**Severity:** LOW  
**Contract:** `modules/CreatorOVaultCoreModule.sol` lines 368–371

**Code Snippet:**
```solidity
QueuedWithdrawal storage queued = queuedWithdrawals[msg.sender];
queued.shares += shares;
queued.unlockBlock = unlockBlock;  // reset
queued.receiver = receiver;         // overwritten
```

**Description:**  
On every call to `queueWithdrawal`, `queued.receiver` is unconditionally overwritten with the new `receiver` argument. If a user has an existing queued withdrawal destined for address A, and subsequently calls `queueWithdrawal(1 share, addressB)`, the entire combined position (original + new shares) will be sent to `addressB` when claimed. The original `receiver` is silently lost.

**Impact:**  
Funds may be misdirected to the wrong address. While this requires the user to call `queueWithdrawal` again (likely an accident), it could be triggered by a malicious dApp front-end.

**Recommended Fix:**  
Revert if a pending entry already exists with a different receiver:
```solidity
if (queued.shares > 0 && queued.receiver != receiver) {
    revert QueuedWithdrawalReceiverMismatch(queued.receiver, receiver);
}
```

---

### I-01 — `burnSharesForPriceIncrease()` Has No `nonReentrant`

**Severity:** INFO  
**Contract:** `CreatorOVault.sol` line 1420

**Code Snippet:**
```solidity
function burnSharesForPriceIncrease(uint256 shares) external {
    _delegate(_coreModule);  // uses assembly return — nonReentrant won't work here anyway
}
```

**Description:**  
`burnSharesForPriceIncrease()` uses `_delegate()` (assembly `return`) and has no `nonReentrant`. The function is restricted to `gaugeController` or `burnStream` (checked in the module), so exploitation requires control of those addresses. However, for completeness and defense-in-depth, consider switching to `_delegateAndReturn()` and adding `nonReentrant`.

---

### I-02 — Module Storage Layout Verified Only at Initialization, Never On-Chain at Runtime

**Severity:** INFO  
**Contract:** `modules/CreatorOVaultModuleStorage.sol`

**Description:**  
The storage layout contract carries a comment "MUST match CreatorOVault's storage layout exactly (including OZ bases)." This is validated structurally at contract compile time but has no on-chain runtime enforcement. If a future upgrade deploys a new module with a different OZ base version (e.g., v5.5 adding a new storage field), the `MODULE_STORAGE_VERSION` hash check in `setModulesOnce()` would catch a version string mismatch but not a layout drift within the same version. Any storage layout mismatch would silently corrupt vault state.

**Recommended Fix:**  
Include a deterministic storage layout hash (e.g., derived from Foundry's `storageLayout`) in the module identity verification, or enforce ERC-7201 namespaced storage to make layout collisions structurally impossible.

---

### I-03 — `report()` Bootstrap Guard Re-triggers After a Full Vault Drain

**Severity:** INFO  
**Contract:** `modules/CreatorOVaultCoreModule.sol` lines 574–579

**Code Snippet:**
```solidity
if (previousTotalAssets == 0 && trustedPpsCheckpoint == 0) {
    // bootstrap: set baseline without profit/loss accounting
    return (0, 0);
}
```

**Description:**  
The bootstrap condition fires when `previousTotalAssets == 0 && trustedPpsCheckpoint == 0`. After a complete vault drain and recovery (assets going to 0 and then returning), both conditions could be satisfied simultaneously, silently resetting the profit/loss baseline instead of recognising the recovery as profit.

---

### I-04 — Baseline Rebuild from Live `totalAssets()` Creates Flash-Loan Reset Vector

**Severity:** INFO  
**Contract:** `CreatorOVault.sol` lines 705–731; `modules/CreatorOVaultCoreModule.sol` lines 641–648

**Code Snippet:**
```solidity
// Called on deposit/withdraw — if baseline is 0, it's rebuilt from live totalAssets
if (previousTotalAssets == 0) {
    totalAssetsAtLastReport = totalAssets();  // reads live state
    return;
}
```

**Description:**  
Both `_increaseReportBaselineForPrincipalInflow()` and `_decreaseReportBaselineForPrincipalOutflow()` include a guard: when `totalAssetsAtLastReport == 0`, they rebuild the baseline from live `totalAssets()` instead of applying the delta. A large flash-loan-assisted redemption that drives `totalAssetsAtLastReport` to zero would trigger baseline reconstruction on the next deposit, potentially making subsequent `report()` calls treat previous assets as new profit.

---

## Summary of Recommendations

1. **[H-01]** Guard `report()` loss path against zero `currentTotalAssets`.
2. **[H-02]** Update `strategyDebt` and `totalDebt` inside `emergencyWithdrawFromStrategies()`.
3. **[H-03]** Do not reset `unlockBlock` when adding to an existing queued withdrawal position.
4. **[M-01]** Track per-user cooldown in the wrapper instead of relying on vault's per-receiver tracking.
5. **[M-02]** Provide a `forceRemoveStrategy()` that accepts losses and removes the strategy regardless of debt.
6. **[M-03]** Switch `emergencyWithdrawFromStrategies()` and `emergencyWithdraw()` to `_delegateAndReturn()` and add `nonReentrant`.
7. **[M-04]** Add an access-control modifier to `injectCapital()`.
8. **[M-05]** Fix `maxDeposit()` to return asset amounts when total supply is zero.
9. **[M-06]** Add a `rescueDelay >= MIN_RESCUE_DELAY` guard inside `initiateOwnershipRescue()`.
10. **[L-01]** Align `redeem()`/`withdraw()` pause behavior with `maxWithdraw()`/`maxRedeem()`.
11. **[L-03]** Align `pricePerShare()` formula with the ERC-4626 virtual offset.
12. **[L-04]** Add `nonReentrant` (via `_delegateAndReturn`) to strategy management functions.
13. **[L-06]** Consider using tracked `coinBalance` in `totalAssets()` to prevent donation-based fee extraction.

---

*End of Audit Report*
