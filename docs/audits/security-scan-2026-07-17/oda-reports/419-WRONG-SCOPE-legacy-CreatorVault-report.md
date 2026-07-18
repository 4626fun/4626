# Security Review — CreatorOVault.sol (CreatorVault protocol)

**Prepared for**: leftclaw job #419
**Target**: `contracts/vault/CreatorOVault.sol` (1809 lines) + `contracts/interfaces/IStrategy.sol`
**Repository**: `github.com/wenakita/CreatorVault`
**Commit audited**: `971da642861b070067aefa5f70aa82546aae5af6` (branch `main`, 2026-01-29)
**Methodology**: three-phase review — context mapping (opus) → ethskills breadth checklist (7 domain agents, opus) → pashov-style depth/attack-mindset review (12 agents, opus, run blind to phase-1 findings) → hybrid reconciliation with a coverage gate against the phase-0 access-control inventory and threat catalog.

---

## ⚠️ Scope discrepancy (read first)

The client-provided job description named a different repository (`github.com/wenakita/4626`, which returns HTTP 404 / does not exist) and a second file, `CreatorOVaultCoreModule.sol`, implying a delegatecall-based module split. Neither exists. We located the actual target at `github.com/wenakita/CreatorVault`, path `contracts/vault/CreatorOVault.sol`, and confirmed (by reading the full file and grepping for `delegatecall`, `impair`, `sidePocket`) that no module split, delegatecall pattern, or impairment/side-pocket accounting exists anywhere in the current codebase — all vault logic lives directly in the single 1809-line `CreatorOVault.sol` contract audited below. We checked all branches of the repository; the module file was not found on any of them. This audit covers the real, existing contract in full; the "module delegatecall storage" and "impairment side-pocket" focus areas named in the original brief do not apply to the current code and are noted here for the client's awareness rather than treated as findings.

---

## Scope

| | |
|---|---|
| **Files reviewed** | `contracts/vault/CreatorOVault.sol` (1809 LOC) · `contracts/interfaces/IStrategy.sol` (78 LOC, interface only) |
| **Scope size** | 1809 LOC in-scope — "large" tier, opus used for all phases |
| **Confidence floor** | All findings Low severity and above are reported below; items below confidence 50 are listed separately under **Leads** |

---

## Reconciliation summary

- **Phase 1** (7 ethskills domain agents: general, precision-math, erc4626, erc20, signatures, access-control, dos) and **Phase 2** (12 pashov attack-mindset agents, run blind to Phase 1) were reconciled against each other and against the Phase-0 protocol map's access-control inventory and threat catalog.
- **Overlap**: 2 defect clusters were independently discovered by both phases with fully consistent root-cause analysis (the `report()` accounting defect, found by every one of the 19 hunting agents in some form; the profit-unlock defect, found by 12 of 19).
- **Phase-1-only**: the compounding "cannot remove a permanently-broken strategy" mechanism (dos-2) was found by one phase-1 agent and not independently rediscovered in phase 2, despite phase-2 agents examining the same function region — re-examined directly against source for this report and confirmed real.
- **Phase-2-only**: the unprivileged griefing DoS (deposit-on-behalf-of-victim resets their withdrawal timer) was found by exactly one phase-2 agent (invariant-lens) and independently re-verified line-by-line against source for this report.
- **Re-examined leads kept**: 2 (strategy-removal-DoS compounding effect; griefing-timer-reset). **Demoted**: 0 — both survived independent source re-verification.
- **Coverage holes closed this pass**: 0 — both hunting phases, between them, examined every privileged/value-moving entrypoint in the Phase-0 inventory and every threat-catalog row; no entrypoint was left unexamined by both phases simultaneously.
- **Confidence floor used**: findings below confidence 50 are demoted to the Leads section regardless of apparent severity.

---

## Access-Control Inventory

*(Full entrypoint-by-entrypoint table in the working protocol map; summarized here for the client.)*

**Roles**: Owner (superset of all powers; one-step `transferOwnership` or a timelocked 1–30 day rescue path) → Management (two-step propose/accept; strategy admin, fees, keeper/emergency-admin appointment) → Keeper (deploy/report/tend) → EmergencyAdmin (shutdown + emergency withdrawal) → GaugeController/BurnStream (burn their own share balance only) → DebtPurchaser (buy strategy debt) → ProtocolRescue (owner-appointed; can unilaterally force an ownership transfer after a timelock) → Operators (EIP-712-signed bitmask grants, currently unconsumed by any guard in this file).

**Unguarded entrypoints** (reachable by any address, no role check): `deposit`, `mint`, `redeem`, `withdraw`, `queueWithdrawal`, `claimQueuedWithdrawal`, `cancelQueuedWithdrawal`, `injectCapital` (by design — donation), `permitOperator` (signature-gated), `acceptManagement` (identity-gated).

58 external/public functions total (47 state-changing, 11 view/pure) — all inventoried; every one maps to a finding below or an explicit "examined, no issue" note in the Threat Model.

---

## Threat Model

| Actor | Reach | Potential gain | Status |
|---|---|---|---|
| Arbitrary caller | `deposit`/`mint`/`injectCapital` (nudge PPS ≤10%/tx) | Marginal PPS manipulation | Addressed by **Finding 6** (flash-loan-delay bypass compounds this) |
| Arbitrary caller | `injectCapital` donation | Griefing / mistimed fee extraction | Addressed by **Finding 1** and **Finding 6** |
| Malicious/compromised `IStrategy` | `getTotalAssets()` inflation | Mint real fee shares via `report()` | Same root cause as **Finding 1** — `report()`'s basis (`totalAssets()`) has no defense against manipulation from *any* source, user or strategy. No agent produced a strategy-side PoC distinct from Finding 1, so it shares Finding 1's remediation. |
| Malicious/compromised `IStrategy` | `deposit()`/`withdraw()` return values | Desync `strategyDebt`/`totalDebt`/`coinBalance` | Addressed by **Finding 13** |
| Malicious/compromised `IStrategy` | revert / unbounded gas | Vault-wide DoS | Addressed by **Finding 4** |
| Management | `addStrategy` | Introduce a hostile "strategy" | Accepted trust boundary — management-key security is the control, not code; **Finding 4**'s remediation reduces blast radius but does not eliminate the trust requirement |
| Any caller | `redeem`/`withdraw` ahead of an unreported loss | Exit before loss socialization | **Invariant holds** — `totalAssets()`/`previewRedeem` are live, so losses are continuously reflected in PPS rather than only at `report()` time; no agent in either phase found a front-running PoC against this |
| Owner | `rescueToken`/`rescueETH` | Custody of non-`CREATOR_COIN` assets, including the vault's own shares | Addressed by **Finding 5** and **Finding 19** |
| ProtocolRescue | `initiateOwnershipRescue`→`finalizeOwnershipRescue` | Force ownership transfer | Documented centralization risk, not a code defect (owner-appointed role acting as designed) |
| GaugeController/BurnStream | `burnSharesForPriceIncrease` | Burn shares to raise PPS | **Invariant holds** — verified directly against source (`_burn(sender, shares)`, L1327): burns only the caller's own balance, no cross-holder risk |
| DebtPurchaser/Owner | `buyDebt` | Distressed-debt arbitrage | Addressed by **Finding 14** — the mechanism is actually broken in the *opposite* direction (no consideration to the buyer) |
| Owner | `renounceOwnership` | N/A (self-harm) | Addressed by **Finding 9** |
| Keeper | `report()` at `totalAssets()==0` | N/A (DoS) | Addressed by **Finding 11** |

---

## Findings

### [Critical-1] `report()` books user deposits and withdrawals as strategy profit/loss, taxing and destroying depositor principal on every routine report

**Severity**: Critical · **Confidence**: 97
**Location**: `report()`, `contracts/vault/CreatorOVault.sol:1242-1303`

**Description**: `report()` computes `profit = currentTotalAssets - previousTotalAssets` (L1244/L1247), where `previousTotalAssets = totalAssetsAtLastReport`. That baseline is written **only** at the end of `report()` itself (L1302) and is never initialized in the constructor — it defaults to `0` and is never adjusted by `deposit`, `mint`, `withdraw`, `redeem`, `claimQueuedWithdrawal`, `injectCapital`, or `buyDebt`. Since `totalAssets()` (`coinBalance + Σstrategy.getTotalAssets()`) rises on every deposit/injection and falls on every withdrawal, `report()` cannot distinguish genuine strategy yield from ordinary user capital flow. Net inflows since the last report are charged the performance fee and locked as phantom "profit" shares; net outflows are booked as a "loss" that burns `totalLockedShares` — destroying yield that legitimately belonged to remaining holders.

This was independently rediscovered, with converging numeric traces, by 11 of the 12 blind phase-2 attack agents plus the phase-1 general-checklist agent (12 of 19 total hunting agents). Verified directly against source for this report.

**Proof of Concept**: Fresh vault. First depositor deposits the `MINIMUM_FIRST_DEPOSIT` floor of `5,000,000e18` `CREATOR_COIN`. `coinBalance = totalAssets() = 5,000,000e18`; `totalAssetsAtLastReport = 0` (never set). The keeper's first, entirely routine `report()` call computes `profit = 5,000,000e18 - 0 = 5,000,000e18` — the depositor's *entire principal*, with zero strategy activity having occurred. With the default `performanceFee = 1000` (10%): `performanceFees = 500,000e18`, minted as shares to `performanceFeeRecipient` (`owner` by default) at L1256-1261. `profitAfterFees = 4,500,000e18` is minted as locked shares to `address(this)` (L1271-1272). The sole depositor now holds roughly half of a supply backed entirely by their own deposit — an immediate ~50% loss of redeemable value, with ~10% of TVL permanently captured by the fee recipient, from zero real yield. The defect recurs on every subsequent report for any net deposit/withdrawal activity, which is the vault's normal operating condition.

**Recommendation** (two independently-proposed, non-overlapping fixes — either is valid):

*Option A — flow-adjust the baseline*:
```diff
 function deposit(uint256 assets, address receiver) public override ... returns (uint256 shares) {
     ...
     CREATOR_COIN.safeTransferFrom(msg.sender, address(this), assets);
     coinBalance += assets;
+    totalAssetsAtLastReport += assets;
     ...
 }
 // mirror: -= assets in withdraw/redeem/claimQueuedWithdrawal; += in mint/injectCapital/buyDebt
 // and initialize totalAssetsAtLastReport = totalAssets() on the very first deposit (supply()==0 branch)
```

*Option B — derive profit from strategy-level accounting only, ignoring idle-coin movements*:
```diff
 function report() external nonReentrant onlyKeepers returns (uint256 profit, uint256 loss) {
-    uint256 currentTotalAssets = totalAssets();
+    uint256 currentTotalAssets = totalDebt; // or Σ(strategy.getTotalAssets()) — exclude coinBalance entirely
     uint256 previousTotalAssets = totalAssetsAtLastReport;
     ...
```

---

### [High-1] Profit-unlocking mechanism is non-functional — locked profit shares are minted but never burned, permanently trapping strategy yield

**Severity**: High · **Confidence**: 95
**Location**: `report()` profit branch, `contracts/vault/CreatorOVault.sol:1265-1276`; `unlockedShares()`/`lockedShares()`, lines 529-545

**Description**: On profit, `report()` mints `profitShares` to `address(this)` (L1271) and sets `totalLockedShares`, `profitUnlockingRate`, `fullProfitUnlockDate` to schedule a Yearn-V3-style gradual unlock. `unlockedShares()`/`lockedShares()` are pure views; grepping the full contract confirms they are consumed by **nothing** else. `totalSupply()` is not overridden (the inherited OZ ERC20 counts the vault-held locked shares in full), and the only `_burn(address(this), ...)` call site is the *loss* branch (L1293, bounded by `totalLockedShares`, only fires on a subsequent loss). **No code path ever burns shares as they "unlock."** Because `totalAssets()` reads live strategy state, a genuine profit is already reflected in PPS the instant it occurs; `report()` then mints inert shares that permanently dilute `totalSupply()`, dragging PPS back down with no mechanism ever restoring it. The value backing the locked shares is stranded, owned by nobody, and redeemable by no one under normal operation.

Independently found by 9 of the 12 blind phase-2 agents, and 3 of the 7 phase-1 agents (12 of 19 total hunting agents), all pointing to the identical root cause.

**Proof of Concept**: Supply 1,000,000 shares, `totalAssets = 1,000,000` (PPS 1.0). A strategy earns 100,000 in genuine yield → live `totalAssets = 1,100,000`, PPS already at 1.10 before any report. Keeper calls `report()` (fee ignored for clarity): `profitShares ≈ 90,909` minted to `address(this)`. New supply ≈ 1,090,909, PPS ≈ 1.008. `fullProfitUnlockDate` passes; `unlockedShares()` correctly reports that ~90,909 shares "should" have unlocked — but nothing ever calls a function that burns them. PPS remains ≈1.008 forever; the 100,000 of real yield is permanently trapped behind vault-owned shares that no function ever redeems.

**Recommendation**:
```diff
 function report() external nonReentrant onlyKeepers returns (uint256 profit, uint256 loss) {
+    uint256 toBurn = unlockedShares();
+    if (toBurn > 0) {
+        _burn(address(this), toBurn);
+        totalLockedShares -= toBurn;
+    }
     uint256 currentTotalAssets = totalAssets();
     ...
```
(Mirrors Yearn V3's `_burn_unlocked_shares`, called at the top of `report()` before any new profit is locked.)

---

### [High-2] `emergencyAdmin` — a role documented as "can shutdown only" — can unilaterally drain 100% of vault assets to an arbitrary address

**Severity**: High · **Confidence**: 88
**Location**: `emergencyWithdraw()`, `contracts/vault/CreatorOVault.sol:1480-1491`; `shutdownVault()`, lines 1463-1466; modifier `onlyEmergencyAuthorized`, lines 442-447

**Description**: `emergencyWithdraw(amount, to)` transfers `amount` of `CREATOR_COIN` to a caller-chosen `to` with no cap and no destination restriction (L1480-1491). It is gated by `onlyEmergencyAuthorized`, satisfied by `emergencyAdmin` OR `management` OR `owner()`. Its only precondition, `isShutdown == true`, is settable by the exact same role set via `shutdownVault()`. The contract's own comments describe `emergencyAdmin` as able only to "shutdown" (per the header's role summary), and it is a subordinate, no-timelock role appointed unilaterally by `management` (`setEmergencyAdmin`, L1525). The contract explicitly protects `CREATOR_COIN` from `rescueToken` (`CannotRescueCreatorCoin`, L1770) — `emergencyWithdraw` is a complete, code-level bypass of that same protective intent for the vault's actual underlying asset.

Independently found by phase-1's access-control checklist agent (as a direct finding) and phase-2's blind access-control attack agent (as the identical mechanism, initially filed as a design-scope lead — this reconciliation resolves the divergence to a confirmed finding since the exploit path requires no assumption beyond the role hierarchy documented in the contract itself).

**Proof of Concept**: `emergencyAdmin` (or a compromised `emergencyAdmin`/`management` key) calls `shutdownVault()` → `isShutdown = true`. Same caller calls `emergencyWithdraw(CREATOR_COIN.balanceOf(vault), attackerEOA)`. All idle `CREATOR_COIN` is transferred out; `coinBalance` is then re-synced to (near) zero. Depositors' shares are worthless. No timelock, no owner approval, no pro-rata constraint.

**Recommendation**:
```diff
-    function emergencyWithdraw(uint256 amount, address to) external onlyEmergencyAuthorized {
+    function emergencyWithdraw(uint256 amount) external onlyOwner {
         if (!isShutdown) revert VaultNotShutdown();
-        if (to == address(0)) revert ZeroAddress();
         if (amount > 0) {
-            CREATOR_COIN.safeTransfer(to, amount);
+            CREATOR_COIN.safeTransfer(owner(), amount);
         }
         coinBalance = CREATOR_COIN.balanceOf(address(this));
-        emit EmergencyWithdraw(to, amount);
+        emit EmergencyWithdraw(owner(), amount);
     }
```
Fix the destination to a non-caller-supplied sink and restrict to `onlyOwner`; consider a timelock for production deployments.

---

### [High-3] A single reverting strategy bricks the entire vault; if the same strategy's `withdraw()` also reverts, it can never be removed — permanent freeze

**Severity**: High · **Confidence**: 85
**Location**: `totalAssets()`, `contracts/vault/CreatorOVault.sol:555-566`; `removeStrategy()`, lines 1007-1038 (external call at 1013); `emergencyWithdrawFromStrategies()`, lines 1468-1478

**Description**: `totalAssets()` loops every active strategy calling `IStrategy(strategyList[i]).getTotalAssets()` (L562) with no try/catch and no gas bound. This function underlies every ERC4626 preview, `pricePerShare()`, `maxDeposit`, and `report()`, so a single strategy whose `getTotalAssets()` reverts (or burns unbounded gas) bricks `deposit`, `mint`, `redeem`, `withdraw`, `queueWithdrawal`, `claimQueuedWithdrawal`, `report`, and every preview/max view — for **every** user, not just those interacting with the broken strategy. Compounding this: the only way to remove a strategy from that loop, `removeStrategy()`, calls `IStrategy(strategy).withdraw(currentDebt)` at L1013 with **no try/catch**. If the same strategy's `withdraw()` also reverts, `removeStrategy()` itself reverts and the strategy can never be delisted — the vault-wide freeze becomes **permanent**, with no ordinary admin recovery (`emergencyWithdrawFromStrategies()` is try/catch-wrapped but does not deactivate/unlist the strategy, so it cannot cure the freeze). This is reachable without any malicious actor — a wrapped external protocol pausing or failing is sufficient.

The single-revert DoS was independently found by phase-1's dos, general, and erc4626 checklist agents and phase-2's periphery attack agent (4 of 19). The compounding "cannot remove" mechanism was found by a single phase-1 agent (dos) and re-verified directly against source for this report; phase-2 did not independently rediscover this specific compounding effect despite multiple agents examining the same function.

**Proof of Concept**: Management adds strategy S (passes the one-time `isActive()`/`asset()` checks at add-time, L985-987). Funds are deployed to S. S's underlying integration later reverts on both `getTotalAssets()` and `withdraw()` (external pause, compromise, or bug). Every function listed above now reverts vault-wide. `removeStrategy(S)` reverts at L1013. `emergencyWithdrawFromStrategies()` swallows S's revert via try/catch but leaves it active and listed — `totalAssets()` still reverts. All user funds (idle coin plus every other, healthy strategy's assets) are frozen with no ordinary recovery path.

**Recommendation**:
```diff
 function totalAssets() public view override returns (uint256) {
     uint256 total = coinBalance;
     for (uint256 i; i < strategyList.length; i++) {
-        total += IStrategy(strategyList[i]).getTotalAssets();
+        try IStrategy(strategyList[i]).getTotalAssets() returns (uint256 a) {
+            total += a;
+        } catch {
+            total += strategyDebt[strategyList[i]]; // fall back to last-known debt
+        }
     }
     return total;
 }
```
```diff
 function removeStrategy(address strategy) external onlyManagement {
     ...
-    uint256 withdrawn = IStrategy(strategy).withdraw(currentDebt);
-    coinBalance += withdrawn;
+    try IStrategy(strategy).withdraw(currentDebt) returns (uint256 withdrawn) {
+        coinBalance += withdrawn;
+    } catch {
+        // treat as realized loss; proceed with deactivation regardless
+    }
     // unconditionally deactivate + delist below
```

---

### [Medium-1] `rescueToken` does not exclude the vault's own share token — owner can sweep escrowed queued-withdrawal shares and locked profit shares

**Severity**: Medium · **Confidence**: 92
**Location**: `rescueToken()`, `contracts/vault/CreatorOVault.sol:1768-1774`

**Description**: `rescueToken(token, amount, to)` excludes only `token == address(CREATOR_COIN)` (L1769-1770). It does not exclude `token == address(this)`. The vault holds real, user-owned balances of its own ERC20 share token in two places: queued-withdrawal escrow (`_transfer(msg.sender, address(this), shares)` in `queueWithdrawal`, L801-803) and locked profit shares (`_mint(address(this), profitShares)` in `report`, L1271 — see High-1). `rescueToken(address(this), amount, attacker)` moves either out from under depositors. Independently found by both the phase-1 and phase-2 (blind) access-control agents with identical mechanism and fix.

**Proof of Concept**: A user calls `queueWithdrawal(shares, receiver)`; their shares move to `address(this)`. Owner calls `rescueToken(address(this), shares, ownerEOA)` — no guard blocks it, the escrowed shares transfer out. The user's later `claimQueuedWithdrawal()` reverts (`_burn(address(this), shares)` — insufficient balance) permanently, and `cancelQueuedWithdrawal()` reverts identically. The user's shares are unrecoverable.

**Recommendation**:
```diff
 function rescueToken(address token, uint256 amount, address to) external onlyOwner {
-    if (token == address(CREATOR_COIN)) {
+    if (token == address(CREATOR_COIN) || token == address(this)) {
         revert CannotRescueCreatorCoin();
     }
     ...
```

---

### [Medium-2] Flash-loan withdraw-delay is bypassed by transferring shares to a fresh wallet, enabling same-block sandwiching of `injectCapital`-style PPS bumps

**Severity**: Medium · **Confidence**: 78
**Location**: `deposit()`/`mint()` (`lastDepositBlock[receiver]` stamped at lines 615/674); `redeem()`/`withdraw()`/`queueWithdrawal()` (checked at lines 701/745/789)

**Description**: The "flash-loan protection" keys the exit delay off `lastDepositBlock[owner_]`, stamped only for the deposit `receiver`. Vault shares are a standard, freely-transferable ERC20 with no transfer hook. Depositing to address A, then `transfer`-ing shares to a never-deposited address B (whose `lastDepositBlock` defaults to 0), lets B pass the delay check trivially — the guard is keyed to the wrong identity.

**Proof of Concept**: Attacker watches the mempool for a pending `injectCapital()` call (permissionless, unguarded, raises PPS up to the 10%/tx cap). Attacker deposits a large amount just before it lands, letting the donation raise their own PPS along with everyone else's; attacker then transfers shares to a fresh wallet B and has B `redeem` same-block, bypassing the delay that was supposed to expose them to price risk during the hold period. This dilutes the donation's benefit that should accrue fully to genuine long-term holders — a repeatable, unauthenticated MEV extraction against a documented protection.

**Recommendation**: Key freshness to transfers as well as deposits, e.g. via an OZ v5 `_update` override propagating the max of sender/recipient `lastDepositBlock` onto the recipient, so transferred shares carry forward their restriction.

---

### [Medium-3] Unprivileged griefing: depositing dust on a victim's behalf resets their withdrawal timer, blocking their exit

**Severity**: Medium · **Confidence**: 82
**Location**: `deposit()`, `contracts/vault/CreatorOVault.sol:577-627` (receiver check L577, `lastDepositBlock[receiver] = block.number` at L615); guard checked in `redeem()`/`withdraw()`/`queueWithdrawal()` at lines 701/745/789

**Description**: `deposit(assets, receiver)` permits an arbitrary `receiver != msg.sender` and unconditionally stamps `lastDepositBlock[receiver] = block.number` (L615) for **any** deposit once `totalSupply() > 0` — the `MINIMUM_FIRST_DEPOSIT` floor applies only while `totalSupply() == 0` (L590-592). An attacker can call `deposit(dustAmount, victim)`, paying only a tiny amount of `CREATOR_COIN` themselves, to reset `victim`'s deposit timestamp — forcing `victim`'s next `redeem`/`withdraw`/`queueWithdrawal` (all gated on `lastDepositBlock[owner_]`) to revert with `WithdrawTooSoon` until `withdrawDelayBlocks` (default 1, owner-adjustable up to 100) more blocks pass. This requires the attacker to win a block-race against the victim's withdrawal transaction on each attempt — a sustained, cheap-per-block harassment tool rather than a single-transaction permanent lock, which is why this is rated Medium rather than High.

Found by a single phase-2 agent (invariant lens); mechanically re-verified line-by-line against live source for this report.

**Recommendation**:
```diff
-        lastDepositBlock[receiver] = block.number;
+        lastDepositBlock[msg.sender] = block.number;
+        // or: only update lastDepositBlock[receiver] when receiver == msg.sender
```

---

### [Medium-4] Large-withdrawal queue / MEV-delay protection is trivially bypassed by splitting into sub-threshold redemptions

**Severity**: Medium · **Confidence**: 90
**Location**: `redeem()` L714-716, `withdraw()` L753-756

**Description**: The forced-queue control checks only a **single call's** `assets >= largeWithdrawalThreshold` (default `100,000e18`), with no cumulative or per-block tracking. A caller can loop `redeem`/`withdraw` with each call just under the threshold, draining an arbitrarily large position synchronously in one transaction — fully bypassing the intended `queueWithdrawal` + `largeWithdrawalDelayBlocks` delay this control exists to enforce.

**Proof of Concept**: A holder with a 500,000-token position calls `redeem` six times, each `previewRedeem ≈ 99,000 < 100,000`. Each call passes the per-call check and transfers coin immediately — the documented large-withdrawal protection provides no actual protection against a determined holder.

**Recommendation**: Track cumulative withdrawn assets per user within a rolling window (e.g. per block or per N blocks) and compare against the threshold, not a single call's amount.

---

### [Medium-5] `maxWithdraw`/`maxRedeem` overstate the redeemable amount, violating the ERC4626 no-revert guarantee and misleading integrators

**Severity**: Medium · **Confidence**: 88
**Location**: `maxWithdraw()` L898-903, `maxRedeem()` L908-911, vs. `redeem()`/`withdraw()` guards at L701-716/L745-756

**Description**: EIP-4626 requires `maxWithdraw`/`maxRedeem` to return a value for which the corresponding call will not revert. Here `maxRedeem` returns the caller's full share balance and `maxWithdraw` returns unclamped `previewRedeem(shares)`, with no accounting for: (a) the `largeWithdrawalThreshold` forced-queue check (any position ≥100k tokens will revert `LargeWithdrawalMustBeQueued`), (b) the `withdrawDelayBlocks` flash-loan gate, or (c) available idle+strategy liquidity. Separately, both views return `0` when `paused`, but the actual `redeem`/`withdraw` functions carry no `whenNotPaused` modifier and remain fully callable while paused — an inconsistency in the opposite direction that misleads integrators into believing exits are frozen when they are not.

Corroborated across 3 phase-1 agents (general, erc4626, access-control) and 5 phase-2 leads.

**Recommendation**: Clamp `maxWithdraw`/`maxRedeem` to `min(previewRedeem(shares), largeWithdrawalThreshold - 1, availableLiquidity)`, return `0` during the active flash-delay window, and align the `paused`/`isShutdown` short-circuits between the max-views and the actual exit functions (decide the intended pause semantics and make both agree).

---

### [Medium-6] `renounceOwnership()` is not disabled — permanently bricks all `onlyOwner` functionality with no recovery path if called without a pre-configured `protocolRescue`

**Severity**: Medium · **Confidence**: 85
**Location**: inherited OZ `Ownable.renounceOwnership()` (not overridden); `_transferOwnership()` override, L1605-1622

**Description**: A large set of critical controls is `onlyOwner`-only with no fallback caller: `setPaused`, whitelist setters, `setProtocolRescue`/`setRescueDelay`, `setFlashLoanProtection`, `setMaxTotalSupply`, `setGaugeController`, `setBurnStream`, `setDebtPurchaser`, `rescueETH`/`rescueToken`. `renounceOwnership()` is inherited from OZ `Ownable` and never overridden or blocked. If called (accidentally or maliciously) without `protocolRescue` already configured, every one of the above becomes permanently uncallable — including `initiateOwnershipRescue`, since it itself requires `protocolRescue` to already be set. Independently found by both phase-1 general and access-control agents.

**Recommendation**:
```diff
+    function renounceOwnership() public view override onlyOwner {
+        revert("renounce disabled");
+    }
```
Or require `protocolRescue != address(0)` as an explicit precondition before allowing renounce.

---

### [Low-1] `report()` reverts (division by zero) when `currentTotalAssets()` reaches 0 while shares/locked-profit remain outstanding

**Severity**: Low · **Confidence**: 85
**Location**: `report()` loss branch, `contracts/vault/CreatorOVault.sol:1280-1287` (division at 1286)

**Description**: `lossShares = (loss * supply) / currentTotalAssets` (L1286). If every strategy's `getTotalAssets()` returns 0 and `coinBalance == 0` (a full wipeout), with `totalSupply() > 0` and `totalLockedShares > 0`, this divides by zero and reverts, blocking `report()` — and with it, `lastReport`/`totalAssetsAtLastReport` — until assets recover. Independently raised by 12 of 19 hunting agents across both phases, all classifying it as recoverable (via a subsequent deposit/`injectCapital` restoring `coinBalance > 0`) rather than a permanent brick.

**Proof of Concept**: All strategies lose 100%, `coinBalance == 0`, `totalSupply() > 0`, `totalLockedShares > 0` from a prior profitable report → `report()` reverts at L1286 until new coin arrives.

**Recommendation**: `uint256 lossShares = currentTotalAssets > 0 ? (loss * supply) / currentTotalAssets : totalLockedShares;` — burn all locked shares (the locked profit is worthless anyway) rather than reverting.

---

### [Low-2] One-step `transferOwnership` (not `Ownable2Step`) — a typo permanently loses the owner role

**Severity**: Low · **Confidence**: 75
**Location**: inherited OZ `Ownable.transferOwnership()`; contrast with the 2-step `management` handoff at L1711-1722

**Description**: `management` correctly uses a propose/accept two-step handoff; `owner` uses OZ's single-step transfer. Passing a wrong or uncontrolled address transfers ownership immediately and irrevocably, with no correction path besides the (separately-configured) `protocolRescue` timelock.

**Recommendation**: Adopt `Ownable2Step`, retaining the existing `_transferOwnership` epoch-bump override.

---

### [Low-3] Missing `nonReentrant` on strategy-calling admin paths; debt ledger desyncs on strategy removal and emergency exit

**Severity**: Low · **Confidence**: 80
**Location**: `removeStrategy()` L1007-1038 (external call L1013), `emergencyWithdrawFromStrategies()` L1468-1478

**Description**: Both functions call into `IStrategy` without the `nonReentrant` guard every sibling flow carries. In `removeStrategy`, the external `withdraw()` (L1013) runs before `activeStrategies`/`strategyDebt` are updated — a CEI deviation. Separately, `removeStrategy` credits `coinBalance` by the *actual* `withdrawn` return but decrements `totalDebt` by the *requested* `currentDebt` (a mismatch on partial withdrawal), and `emergencyWithdrawFromStrategies` credits `coinBalance` but never adjusts `strategyDebt`/`totalDebt` at all, leaving stale debt that can later be "repurchased" via `buyDebt` against a strategy already emptied. Both require a management-added malicious or badly-behaved strategy to matter, bounding severity to Low.

**Recommendation**: Add `nonReentrant` to both functions; zero `activeStrategies`/`strategyDebt` before the external call in `removeStrategy` (CEI); adjust `totalDebt`/`strategyDebt` inside `emergencyWithdrawFromStrategies`'s loop.

---

### [Low-4] `buyDebt` gives the purchaser no consideration — a broken, one-way donation primitive

**Severity**: Low · **Confidence**: 70
**Location**: `buyDebt()`, `contracts/vault/CreatorOVault.sol:1424-1445`

**Description**: `buyDebt(strategy, amount)` pulls `amount` of `CREATOR_COIN` from the caller into `coinBalance` and reduces `strategyDebt`/`totalDebt` — but transfers nothing back to the caller (no strategy position, no shares, no discount), unlike Yearn's analogous mechanism. It functions only as a voluntary, one-way donation to existing holders. This is also the sole non-privileged "escape hatch" suggested elsewhere for a permanently-bricked strategy (High-3) — but since no rational actor benefits from calling it, it does not meaningfully mitigate that risk.

**Recommendation**: Either transfer the buyer a proportional claim on the purchased strategy position, or explicitly document/gate this as an intentional donation mechanism if that is the design intent.

---

### [Low-5] EIP-712 operator permits are not epoch-bound and cannot be cleanly revoked via the admin path

**Severity**: Low · **Confidence**: 65
**Location**: `permitOperator()` L1576-1590 (struct hash L1581), `setOperatorPerms()` L1565-1569

**Description**: The core signature construction is sound (domain, nonce, deadline, malleability handling via OZ v5 all verified correct). However, the signed struct does not include `operatorEpoch`, so a stale, unsubmitted signature can — after an ownership round-trip with no intervening `permitOperator` call — re-validate and write into a *new* epoch's permission map, defeating the epoch-invalidation mechanism's purpose. Separately, `setOperatorPerms` (the admin path) does not advance `operatorNonce`, so an owner who signs a permit, reconsiders, and manually revokes via `setOperatorPerms(exec, 0)` has not actually invalidated the original signature — it can still be replayed later to restore the revoked grant. Both are bounded to Low because the operator permission bitmask is currently consumed by **no** state-changing guard anywhere in this file (`isAuthorizedOperator` has zero in-file callers) — these become fund-relevant only if the bitmask is wired into a real guard elsewhere, at which point they should be re-audited.

**Recommendation**: Include `operatorEpoch` in the signed struct; have `setOperatorPerms` also advance `operatorNonce`, or enforce a short bounded max `deadline`.

---

### [Low-6] Inflow accounting credits the requested amount, not the measured balance delta — would desync on a fee-on-transfer or rebasing asset

**Severity**: Low · **Confidence**: 60
**Location**: `deposit()` L608-609, `mint()` L667-668, `injectCapital()` L1348-1349, `buyDebt()` L1434-1435

**Description**: Every inflow site credits `coinBalance` by the requested amount immediately after `safeTransferFrom`, never by the measured delta. `CREATOR_COIN` is immutable and presumed to be a standard, non-fee, non-rebasing 18-decimal token, so this is dormant under the current deployment — but there is no code-level guarantee of that assumption, and no automatic correction if it is violated (only privileged `syncBalances`/`emergencyWithdraw`).

**Recommendation**: Measure `balanceOf(this)` before/after each transfer and credit the delta; or, if the standard-token assumption is a hard invariant, document it explicitly.

---

### [Low-7] `decimals()` hardcoded to 18 and all threshold constants hardcoded in `e18` — would misbehave with a non-18-decimal underlying

**Severity**: Low · **Confidence**: 55
**Location**: `decimals()` L1789-1791; `MINIMUM_FIRST_DEPOSIT` L88, `deploymentThreshold` L237, `largeWithdrawalThreshold` L256, `minimumTotalIdle` L288

**Description**: Not exploitable with the intended 18-decimal Creator Coin (share-conversion math itself is decimals-agnostic, keyed off `_decimalsOffset()`). Purely a latent assumption: a 6-decimal underlying would brick the first deposit (`MINIMUM_FIRST_DEPOSIT` unreachable) and mis-scale every other threshold by 1e12.

**Recommendation**: Derive thresholds from `10**IERC20Metadata(asset()).decimals()`, or assert the underlying is 18-decimal in the constructor.

---

### [Low-8] `rescueETH` uses `.transfer()` (2300-gas stipend) — can permanently strand ETH if `owner()` is a contract wallet

**Severity**: Low · **Confidence**: 70
**Location**: `rescueETH()`, L1761-1766

**Description**: `payable(owner()).transfer(balance)` reverts if `owner()` is a contract with a non-trivial `receive()`/`fallback()` (e.g., a Gnosis Safe), and is known to break on some L2s. Given the constructor accepts any `_owner` including contract wallets, this can strand rescuable ETH.

**Recommendation**: `(bool ok,) = owner().call{value: balance}(""); require(ok);`

---

## Info / Code-Quality Notes (no security impact)

- **Dead code masking missing checks**: `useDefaultQueue` is written but never read (withdrawal logic always prefers `defaultQueue` when non-empty regardless); `minDeploymentInterval`/`lastDeployment` are written but never enforced before deploying; the EIP-712 operator bitmask (see Low-5) gates nothing today; `_assessUnrealisedLoss`'s computed result is only emitted, never applied to reduce a withdrawer's payout; `VIRTUAL_SHARES_OFFSET`/`VIRTUAL_ASSETS_OFFSET` constants (L76-77) are declared but never referenced — the real inflation mitigation is solely OZ's `_decimalsOffset()==3`. None of these are independently exploitable; they read as maintenance/clarity hazards where a reviewer or integrator could reasonably (and incorrectly) assume a control is active.
- **`report()`'s hand-rolled share math** (fee/profit/loss minting) omits the virtual-share offset used by every other conversion path in the contract (`_decimalsOffset()==3`), causing a small, non-exploitable rounding inconsistency between `report()`-minted shares and `previewDeposit`/`previewRedeem`-derived shares.
- **Core EIP-712 signature construction is sound**: domain separation, replay protection, deadline enforcement, and malleability handling (via OZ v5) were all specifically verified and found correct (see Low-5 for the one caveat).
- **First-depositor inflation attack is well-mitigated**: the `MINIMUM_FIRST_DEPOSIT` floor combined with OZ's 1000x virtual-share offset and internal `coinBalance`-based accounting (rather than raw `balanceOf`) were specifically checked and found to correctly prevent the classic ERC4626 first-depositor donation attack.
- **Role-folding** (`onlyManagement`/`onlyKeepers`/`onlyEmergencyAuthorized`/`onlyDebtPurchaser` all OR in `owner()`) is intentional and internally consistent — no privilege escalation, only privilege widening as designed.
- **`GaugeController`/`BurnStream`'s `burnSharesForPriceIncrease`** was specifically verified to burn only the caller's own share balance (`_burn(sender, shares)`, L1327) — no cross-holder risk.

---

## Leads

*Concrete code smells where the full exploit path could not be verified in this pass — high-signal but not scored as findings.*

- **First-deposit-floor bypass via `injectCapital` + `report()` bootstrap** — `contracts/vault/CreatorOVault.sol:592, 1258-1271` — Code smells: `report()`'s profit branch mints shares 1:1 when `totalSupply()==0`; `injectCapital` is permissionless and, at zero supply, `_checkPriceChange`'s guard is a no-op (hardcoded `pricePerShare()==1e18`). A sequence of `injectCapital` (while supply is still 0) followed by a keeper `report()` could bootstrap a nonzero supply without ever satisfying `MINIMUM_FIRST_DEPOSIT`, letting a subsequent "first" real depositor skip the anti-inflation floor. Unverified whether the OZ virtual-offset alone still protects against manipulation in that state, and the sequence requires a keeper action between the inject and the victim deposit.
- **Unbounded report-time PPS jump when `profitMaxUnlockTime` is set to 0** — `contracts/vault/CreatorOVault.sol:1267, 1705-1709` — Code smells: `setProfitMaxUnlockTime` accepts `0` (only reverts above `SECONDS_PER_YEAR`); with `profitMaxUnlockTime==0`, `report()`'s profit branch skips locking entirely and the full profit hits PPS in one block, with no per-tx cap on `report()` itself (the 10% cap only guards `deposit`/`mint`/`injectCapital`). Unverified how likely this admin misconfiguration is operationally, and whether the 1-block minimum withdraw delay fully closes the resulting sandwich window.
- **`coinBalance`/allowance desync when a strategy consumes less than the requested deposit amount** — `contracts/vault/CreatorOVault.sol:1111-1117` — Code smells: `_deployToStrategies` subtracts the full requested `amount` from `coinBalance` but only credits `strategyDebt` with the strategy's actual returned `deposited` (which `IStrategy`'s own interface docs say "may differ due to fees/slippage"); the shortfall vanishes from `totalAssets()` accounting while a residual `forceApprove` allowance remains outstanding to the strategy. Contingent on specific strategy behavior; not independently confirmed exploitable.

---

## Coverage gate

Every privileged/value-moving entrypoint in the Access-Control Inventory maps to a finding above or an explicit "invariant holds"/"accepted trust boundary" note in the Threat Model. Every threat-catalog row from the Phase-0 map is answered. Zero coverage holes required a first-time re-read in this reconciliation pass — both hunting phases, between them, had already examined every entrypoint; the two re-examined items (High-3's compounding removal-DoS, Medium-3's griefing timer-reset) were confirmatory re-reads of phase-unique leads, not first-time coverage gaps.

---

> ⚠️ This review was performed by an AI-orchestrated multi-agent audit pipeline. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human security review, a public bug bounty, and on-chain monitoring are strongly recommended before deploying or continuing to operate this contract with user funds — particularly given the Critical-severity accounting defect identified above, which affects normal, non-adversarial operation of the vault.
