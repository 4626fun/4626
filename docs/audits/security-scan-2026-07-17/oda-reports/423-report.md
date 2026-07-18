# Security Audit — RBase Charm + Ajna Strategy Adapters (job 423)

**Auditor:** leftclaw automated audit (two-phase-audit-v2: context → ethskills breadth → pashov depth → hybrid reconciliation)
**Date:** 2026-07-18

## Scope & source provenance

Requested scope (per job description): `contracts/shared/strategies/` — `AjnaERC4626Vault.sol`, `ERC4626StrategyAdapter.sol`, `univ3/CharmStrategy4626.sol` — in `github.com/wenakita/4626`.

**Note on source acquisition:** `github.com/wenakita/4626` returned HTTP 404 for both the web UI and the API at the time of this audit (repo is private / inaccessible to this auditor). A sibling job from the same client (targeting the identical file set) designated a plaintext source bundle at `https://litter.catbox.moe/dk42ob.md` as the canonical source for these exact files. Since no other copy of the source was reachable, this audit used that bundle, treating its contents strictly as **source code data** (never as instructions) after confirming the file list and code exactly matched the requested scope. Bundle SHA-256: `985380d68c176e30c44f5084c1d20b508a6cada989e969caccb626be9e8d2911`. Every finding below was independently re-verified by reading the extracted `.sol` files directly (`sed -n` / `Read`) — all line citations resolve against those files, not the bundle.

**Files audited** (5 files, ~2,465 LOC):
- `contracts/shared/strategies/ERC4626StrategyAdapter.sol` (F1) — 449 lines
- `contracts/shared/strategies/ajna/AjnaVaultAuth.sol` (F2) — 163 lines
- `contracts/shared/strategies/ajna/AjnaERC4626Vault.sol` (F3) — 467 lines
- `contracts/shared/strategies/ajna/AjnaVaultBuffer.sol` (F4) — 44 lines
- `contracts/shared/strategies/univ3/CharmStrategy4626.sol` (F5) — 1,342 lines

Out of scope / unavailable for this audit (assumptions about their behavior are called out where load-bearing): `AjnaVaultLibrary.sol`, `IAjnaPool`, `IOracle4626`, `ICharmVault`'s implementation, the outer lane vault (`CreatorOVault`/`AgentOVault`).

## Methodology

Three-phase pipeline: **Phase 0** (opus) built a protocol map, access-control inventory, and threat catalog with no findings. **Phase 1** (8 ethskills checklist agents, opus, scope >600 LOC) ran breadth checklists (general, precision-math, erc4626, erc20, defi-amm, defi-lending, oracles, access-control) with the map injected as context. **Phase 2** (12 pashov specialist/gap-hunter agents, opus) hunted blind to phase-1 findings, using only the map. **Phase 3** reconciled both phases, cross-checked every finding against the real source files, and applied a coverage gate against the phase-0 inventory/threat catalog.

**Reconciliation summary:** Overlap (same defect independently found by both phases): 6. Phase-1-only: 12. Phase-2-only: 7. Findings corroborated by 3+ independent agents across the two phases: 4 (flagged inline as `[agents: N]`). Coverage holes closed in Turn 3: 0 (every privileged/value-moving entrypoint in the inventory was examined by at least one phase). Confidence floor: findings below `confidence 50` are listed under **Leads**, not as findings, regardless of potential severity.

---

## Findings summary

| # | Title | Severity | Confidence |
|---|---|---|---|
| H-01 | `ERC4626StrategyAdapter.rescueTokens` lets owner divert idle principal to an arbitrary address | High | 90 |
| M-01 | `CharmStrategy4626.getTotalAssets` drops the USDC/collateral leg on oracle staleness while still subtracting full debt — corrupts `harvest`'s profit baseline | Medium | 80 |
| M-02 | `CharmStrategy4626.emergencyWithdraw`'s mandatory USDC→ASSET swap can revert, bricking the one vault-driven emergency exit | Medium | 78 |
| M-03 | `CharmStrategy4626.emergencyWithdraw` never repays outstanding Ajna debt — collateral stays locked, debt keeps accruing | Medium | 68 |
| M-04 | `CharmStrategy4626.emergencyWithdraw` strands idle USDC when the Charm position has zero shares | Medium | 70 |
| M-05 | `CharmStrategy4626.setCharmVault` leaves an unrevoked unlimited approval on the old Charm vault | Medium | 85 |
| M-06 | `AjnaERC4626Vault.redeem(maxRedeem(owner))` can revert — `maxRedeem`/`redeem` round independently and are not exact inverses | Medium | 75 |
| M-07 | `ERC4626StrategyAdapter`'s valuation-drift guard self-disables after ~4.5h of inactivity | Medium | 78 |
| M-08 | `AjnaERC4626Vault` fee rate is read live at execution and paid to admin — admin can front-run its own rate change to skim a specific deposit/withdrawal | Medium | 62 |
| M-09 | `CharmStrategy4626` values the Charm LP position from manipulable spot composition (`getTotalAmounts`), no TWAP/deviation bound | Medium | 55 |
| M-10 | `CharmStrategy4626.withdraw` sizes/values via oracle but realizes the shortfall swap at TWAP — divergence can brick a strict withdraw | Medium | 68 |
| L-01 | `isCharmInRange` fails open (`inRange=true`) on read failure | Low | 80 |
| L-02 | Swap `deadline: block.timestamp` gives no expiry protection | Low | 85 |
| L-03 | `setParameters` leaves `maxSwapPercent` unbounded | Low | 80 |
| L-04 | Centralization: one-step `Ownable` on F1/F5, no timelock on any privileged setter | Low | 88 |
| L-05 | `AjnaERC4626Vault.maxWithdraw`/`maxRedeem` cap at buffer liquidity only (self-disclosed ERC-4626 deviation) | Low | 90 |
| L-06 | `ERC4626StrategyAdapter.emergencyWithdraw` cannot force-liquidate F3's Ajna bucket LP | Low | 75 |
| L-07 | `AjnaERC4626Vault.totalAssets` inflatable by direct ASSET donation to the buffer | Low | 70 |
| L-08 | TWAP-based swap slippage guard is self-referential; `MIN_TWAP_DURATION` (60s) is short | Low | 55 |
| L-09 | `_resolveAjnaLimitIndex` fails open to the most-permissive Ajna bucket on oracle-helper failure | Low | 52 |
| L-10 | Fee-on-transfer / blocklist token assumptions undefended across all deposit paths | Low | 65 |

## Leads (plausible, not independently confirmed — confidence < 65 or blocked on out-of-scope code)

- **L-A (elevate for follow-up — potentially High):** `AjnaERC4626Vault.moveToBuffer`/`.move` pass an **LP amount** as the first argument to `IAjnaPool.removeQuoteToken`/`moveQuoteToken`. Canonical Ajna's `removeQuoteToken(uint256 maxAmount_, uint256 index_)` takes a **quote-token amount cap** as its first argument, not an LP amount. **Four independent phase-2 agents** (execution-trace, boundary, periphery, flow-gap) flagged this same unit mismatch. `IAjnaPool`'s real interface is not in this audit's scope, so it could not be confirmed — **this should be verified against the actual deployed `IAjnaPool` ABI before mainnet use**, since a confirmed mismatch would misprice/misexecute every bucket-management call in `AjnaERC4626Vault.sol` (`moveFromBuffer`, `moveToBuffer`, `move`).
- Decimal/oracle-scale hardcoded assumptions (`1e6`/`1e12`/`1e18`/`1e30` throughout `CharmStrategy4626`) — deployment-config-dependent; would be High if ASSET ≠ 18dp, USDC ≠ 6dp, or the oracle's USD price ≠ 18dp scale.
- `AjnaERC4626Vault`'s `bucketLp` ledger is written purely from `IAjnaPool` call return values, never reconciled against the pool's own attribution — corroborated by 5+ agents across both phases, blocked on out-of-scope `AjnaVaultLibrary`/`IAjnaPool` semantics.
- `CharmStrategy4626.rebalance()` (owner-or-vault callable, no `nonReentrant`) reuses `depositSlippageBps` as its loss bound; an owner who widens that parameter and repeatedly rebalances could sandwich the Charm vault's own rebalance swaps.
- `AjnaVaultAuth.bufferRatio` defaults to `0` at deployment (constructor never sets it) until `setBufferRatio` is called — the 5% exit-liquidity floor is unenforced pre-configuration.
- A keeper (semi-trusted `AjnaVaultAuth.keepers` role) can repeatedly drain `AjnaERC4626Vault`'s buffer to the 5% floor via `moveFromBuffer`, starving depositor exit liquidity with no depositor-side recourse.
- `CharmStrategy4626`'s Ajna-borrow collateral-ratio gate is oracle-based and not reconciled against Ajna's own bucket/LUP-based liquidation threshold — a divergence could let the strategy hold a position liquidatable on Ajna while its internal gate reports healthy.

---

## Detailed Findings

### H-01 — `rescueTokens` lets the owner divert idle principal to an arbitrary address `[agents: 5+, both phases]`

**File:** `contracts/shared/strategies/ERC4626StrategyAdapter.sol`
**Function:** `rescueTokens` (L387–393), enabled via `setActive` (L363–365)
**Severity:** High · **Confidence:** 90

```solidity
363:    function setActive(bool active) external onlyOwner {
364:        _isActive = active;
365:    }
...
387:    function rescueTokens(address token, uint256 amount, address to) external onlyOwner {
388:        // Don't allow rescuing the underlying while active.
389:        if (token == address(ASSET) && _isActive) revert CannotRescueAssetWhenActive();
390:        // Never allow rescuing ERC-4626 position shares.
391:        if (token == address(ERC4626_VAULT)) revert CannotRescuePositionShares();
392:        IERC20(token).safeTransfer(to, amount);
393:    }
```

**Root cause:** `rescueTokens`' only protection for the underlying ASSET is `!_isActive`, and the same `onlyOwner` role controls that flag via `setActive`. The destination `to` is never constrained.

**Exploit path (two owner-signed transactions, no other actor needed):**
1. `setActive(false)` — clears the `CannotRescueAssetWhenActive` guard instantly.
2. `rescueTokens(address(ASSET), ASSET.balanceOf(address(this)), attacker)` — sends all idle ASSET (the `idleBufferBps`-sized reserve, default 10% of strategy TVL, plus anything sitting idle post-rebalance or mid-deposit) to any address the owner names.

The ERC-4626 position shares remain protected (L391), so the loss ceiling is the idle ASSET balance at call time, not the full deployed position — but this directly contradicts the protocol's own documented invariant that "only `vault` receives outflows" (this is stated in the protocol map and enforced explicitly by the sibling contract, F5):

```solidity
// CharmStrategy4626.sol:1319-1327 (ownerEmergencyWithdraw)
function ownerEmergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
    if (to != vault) revert InvalidEmergencyWithdrawRecipient(to);
    ...
}
```

F5 forces `to == vault` on both of its owner-emergency paths (`ownerEmergencyWithdraw` and `ownerEmergencyWithdrawFromCharm`, the latter via `_returnAllTokens()` which hardcodes `vault`). F1 is the inconsistent outlier: it neither pins `to == vault` nor makes the ASSET carve-out tamper-proof against the owner who controls the very flag gating it.

Rated High rather than Medium because: (a) the bypass is a clean two-call sequence with no external dependency or timing requirement, (b) it contradicts an invariant the protocol has already fixed correctly in a sibling contract (suggesting this is an oversight, not intended trust), and (c) F1's owner uses stock one-step `Ownable` with no timelock — nothing on-chain slows this down. **Independently found by 5+ agents across both phases** (access-control, boundary, invariant, first-principles, periphery, defi-lending), all converging on the identical mechanism.

**Fix:** Constrain the ASSET-rescue destination — `if (token == address(ASSET) && to != vault) revert(...)` — mirroring F5's `ownerEmergencyWithdraw`, or drop the `_isActive` conditional entirely and always forbid rescuing ASSET to a non-vault address.

---

### M-01 — `getTotalAssets` drops the USDC leg on stale oracle while subtracting full debt — corrupts `harvest`'s profit baseline `[agents: 6+, both phases]`

**File:** `contracts/shared/strategies/univ3/CharmStrategy4626.sol`
**Function:** `getTotalAssets` (L456–478), consumed by `harvest` (L1208–1217) and `deposit`'s snapshot (L764)
**Severity:** Medium · **Confidence:** 80

```solidity
456:    function getTotalAssets() public view override returns (uint256) {
457:        uint256 idleAsset = ASSET.balanceOf(address(this));
458:        uint256 idleUsdc = USDC.balanceOf(address(this));
459:
460:        (uint256 charmAsset, uint256 charmUsdc, bool charmReadable) = _getCharmExposure();
461:        if (!charmReadable) {
462:            charmAsset = 0;
463:            charmUsdc = 0;
464:        }
465:
466:        AjnaDebtState memory ajnaState = _readAjnaDebtState();
467:        if (!ajnaState.readable) {
468:            // Debt state is unknown: fail closed to avoid overstating equity.
469:            return 0;
470:        }
471:
472:        uint256 grossAsset = idleAsset + charmAsset;
473:        uint256 usdcInAsset = _usdcToAssetValue(idleUsdc + charmUsdc + ajnaState.collateralUsdc);
474:        uint256 grossAssetValue = grossAsset + usdcInAsset;
475:
476:        if (ajnaState.debtAsset >= grossAssetValue) return 0;
477:        return grossAssetValue - ajnaState.debtAsset;
478:    }
479:
...
1208:    function harvest() external override onlyVault returns (uint256 profit) {
1209:        uint256 currentTotal = getTotalAssets();
1210:
1211:        if (currentTotal > lastTotalAssets) {
1212:            profit = currentTotal - lastTotalAssets;
1213:        }
1214:
1215:        lastTotalAssets = currentTotal;
1216:        emit StrategyHarvest(profit);
1217:    }
```

`_usdcToAssetValue` (L569–575) returns `0` whenever `assetOracle.isPriceFresh()` is false — silently dropping the entire USDC-denominated leg (idle USDC + Charm USDC exposure + Ajna collateral) from `grossAssetValue`. But `ajnaState.debtAsset` (ASSET-denominated) is still subtracted at full value on L476. `harvest`/`deposit` then unconditionally latch whatever `getTotalAssets()` returns into `lastTotalAssets`, with no gate on `isValuationReady()`.

**Concrete trace** (worked by three independent agents with matching numbers): position holds 0 idle ASSET, 200 USDC-equivalent collateral in Ajna, 100 ASSET debt, oracle price $1.
- Oracle fresh: `usdcInAsset = 200e18`, `grossAssetValue = 200e18`, `total = 200e18 - 100e18 = 100e18` (correct, healthy 100-ASSET-equity position).
- Oracle goes stale (transiently — heartbeat lapse, feed hiccup) while a `deposit()` or `harvest()` call lands: `usdcInAsset = 0`, `grossAssetValue = 0`, `100e18 >= 0` → `getTotalAssets()` returns `0`. If this snapshot is latched as `lastTotalAssets`, the position — still fully healthy — is now recorded as worthless.
- Oracle recovers, next `harvest()`: `currentTotal = 100e18 > lastTotalAssets = 0` → `profit = 100e18` reported upward, though nothing was earned. With a larger position, an oracle-staleness window that happens to coincide with any `deposit`/`harvest` call can report the **entire TVL** as phantom profit.

**Impact:** if the out-of-scope lane vault charges performance fees or otherwise acts on `harvest`'s `profit` return value, this manufactures fee revenue / dilutes depositors on a routine oracle hiccup — no attacker action required, though an attacker who can induce oracle staleness (e.g., against a manipulable custom oracle) could time it. Rated Medium (not High) because exploitation of the *lane-vault* consequence is out of this audit's scope to confirm, and the mechanism itself only manufactures accounting distortion, not a direct fund transfer.

**Fix:** Gate `lastTotalAssets` updates and profit computation on `isValuationReady()` (or equivalent freshness check) — skip the harvest/snapshot update entirely when the oracle/Ajna reads underlying `getTotalAssets()` were not fresh, rather than latching a fail-closed `0`/understated value as if it were real.

---

### M-02 — `emergencyWithdraw`'s mandatory swap can revert, bricking the emergency exit `[agents: 5+, both phases]`

**File:** `contracts/shared/strategies/univ3/CharmStrategy4626.sol`
**Function:** `emergencyWithdraw` (L1240–1276), via `_swapUsdcToAssetRequired` (L1014) → `_swapUsdcToAsset(required=true)` (L1019–1051)
**Severity:** Medium · **Confidence:** 78

```solidity
1253:        if (ourShares > 0) {
1254:            (uint256 min0, uint256 min1) = _charmWithdrawMins(ourShares);
1255:            (uint256 amount0, uint256 amount1) = charmVault.withdraw(ourShares, min0, min1, address(this));
1256:            uint256 assetReceived = assetIsToken0 ? amount0 : amount1;
1257:            uint256 usdcReceived = assetIsToken0 ? amount1 : amount0;
1258:
1259:            // Swap USDC to ASSET; emergency path is still strict to avoid stranding.
1260:            uint256 totalUsdc = USDC.balanceOf(address(this));
1261:            if (usdcReceived > 0 || totalUsdc > 0) {
1262:                assetReceived += _swapUsdcToAssetRequired(totalUsdc);
1263:            }
```

`_swapUsdcToAssetRequired` reverts (`TwapUnavailable` or `RequiredSwapFailed`) whenever the Uniswap TWAP is unreadable (`observationCardinality < 2`, or `observe()` reverts) or the router swap fails to clear `minOut`. Because this call is unconditional whenever the strategy holds any USDC (from the Charm withdrawal or already idle), the **entire** `emergencyWithdraw()` transaction reverts — including the already-recovered ASSET from the Charm exit — exactly in the degraded-liquidity/degraded-oracle conditions an emergency exit is meant to handle. `withdraw` (the non-emergency path) uses the non-reverting `_swapUsdcToAssetSafe` for the same situation; `emergencyWithdraw` chose the reverting variant, inverting the expected safety ordering.

A fallback exists (`ownerEmergencyWithdrawFromCharm`, owner-only, no swap, forwards raw USDC+ASSET to `vault`), so this is not a total, unrecoverable brick — but the primary **vault-driven** emergency path has no swap-free fallback of its own.

**Fix:** In `emergencyWithdraw`, use the non-reverting `_swapUsdcToAssetSafe` and forward whatever ASSET (plus any un-swapped USDC) is recovered to the vault, rather than reverting the whole exit on a failed/unavailable swap.

---

### M-03 — `emergencyWithdraw` never repays outstanding Ajna debt `[agents: 2, both phases]`

**File:** `contracts/shared/strategies/univ3/CharmStrategy4626.sol`
**Function:** `emergencyWithdraw` (L1240–1276) vs. `_repayAjnaDebtWithAsset` (L1117–1152, called only from `deposit`, L674)
**Severity:** Medium · **Confidence:** 68

`_repayAjnaDebtWithAsset` is only ever invoked from `deposit()`, which is gated `whenActive`. `emergencyWithdraw()` exits the Charm position and sweeps idle balances to `vault`, but never calls `_repayAjnaDebtWithAsset` or `repayDebt` — an open Ajna borrow (ASSET debt backed by pledged USDC collateral held *inside* the Ajna pool, not in this contract's balance) is left untouched. Combined with M-04's incomplete USDC sweep and the fact that `_tryAjnaBorrow` (called from `withdraw`, not gated by `whenActive`) can still open new debt after the strategy is deactivated (see phase-1 finding P1-06 in the working notes — debt can grow post-deactivation but the only repay path requires `whenActive`), collateral can remain locked and debt keeps accruing interest after an "emergency" exit that was supposed to fully unwind the position.

**Fix:** Have `emergencyWithdraw` call `_repayAjnaDebtWithAsset(ASSET.balanceOf(address(this)))` best-effort before forwarding funds to the vault, and/or gate `_tryAjnaBorrow` (in `withdraw`) on `active` so debt cannot grow once the strategy is being wound down.

---

### M-04 — `emergencyWithdraw` strands idle USDC when Charm shares are zero `[agents: 1, phase 2]`

**File:** `contracts/shared/strategies/univ3/CharmStrategy4626.sol`
**Function:** `emergencyWithdraw` (L1240–1276)
**Severity:** Medium · **Confidence:** 70

```solidity
1240:    function emergencyWithdraw() external override onlyVault returns (uint256 withdrawn) {
1241:        if (address(charmVault) == address(0)) {
1242:            withdrawn = ASSET.balanceOf(address(this));
1243:            if (withdrawn > 0) {
1244:                ASSET.safeTransfer(vault, withdrawn);
1245:            }
1246:            emit EmergencyWithdraw(vault, withdrawn);
1247:            return withdrawn;
1248:        }
1249:
1250:        uint256 ourShares = charmVault.balanceOf(address(this));
...
1253:        if (ourShares > 0) {
1254:            ...
1260:            uint256 totalUsdc = USDC.balanceOf(address(this));
1261:            if (usdcReceived > 0 || totalUsdc > 0) {
1262:                assetReceived += _swapUsdcToAssetRequired(totalUsdc);
1263:            }
1264:
1265:            withdrawn = assetReceived;
1266:        }
1267:
1268:        // Send all ASSET to vault
1269:        uint256 totalAsset = ASSET.balanceOf(address(this));
1270:        if (totalAsset > 0) {
1271:            ASSET.safeTransfer(vault, totalAsset);
1272:            withdrawn = totalAsset;
1273:        }
```

Both the USDC-swap block (L1259–1263) and, by extension, any USDC held by the strategy are only handled **inside `if (ourShares > 0)`** (L1253). If `ourShares == 0` — e.g. after a `deposit()` whose Charm-side deposit was deferred/failed post-swap (a real reachable state per the protocol map's deposit workflow: an out-of-range Charm pool or a `DepositFailed` catch leaves swapped USDC idle with no Charm shares) — the entire block is skipped. The final sweep (L1268–1273) transfers only ASSET. Idle USDC is left behind in the strategy after what is meant to be a complete emergency exit; recovery requires the owner to separately call `setActive(false)` then `ownerEmergencyWithdraw(USDC, vault, amount)`.

**Fix:** Unconditionally sweep any USDC balance (converted via the safe/non-reverting swap path, or transferred raw if unswappable) at the end of `emergencyWithdraw`, not only inside the `ourShares > 0` branch.

---

### M-05 — `setCharmVault` leaves stale unlimited approval on the old Charm vault `[agents: 1, phase 1]`

**File:** `contracts/shared/strategies/univ3/CharmStrategy4626.sol`
**Function:** `setCharmVault` (L229–231)
**Severity:** Medium · **Confidence:** 85

```solidity
229:    function setCharmVault(address _charmVault) external onlyOwner {
230:        charmVault = ICharmVault(_charmVault);
231:    }
```

Contrast with `setAjnaPool` (L263–294), which correctly handles the identical migration scenario:

```solidity
263:    function setAjnaPool(address _ajnaPool) external onlyOwner {
264:        address oldPool = address(ajnaPool);
...
273:        if (oldPool != address(0)) {
274:            ASSET.forceApprove(oldPool, 0);
275:            USDC.forceApprove(oldPool, 0);
276:        }
...
291:        ASSET.forceApprove(_ajnaPool, type(uint256).max);
292:        USDC.forceApprove(_ajnaPool, type(uint256).max);
```

`initializeApprovals` (L372–383) grants `type(uint256).max` ASSET and USDC approval to `charmVault`. `setCharmVault` reassigns the `charmVault` reference without ever revoking that approval on the *old* address, and without approving the *new* one (which then silently fails all deposits via the caught `DepositFailed` path until someone remembers to re-run `initializeApprovals`). If the strategy ever migrates off a Charm vault (deprecation, bug, compromise), the old vault retains a standing unlimited pull-allowance over the strategy's full idle ASSET+USDC balance indefinitely.

**Fix:** Mirror `setAjnaPool` — revoke the old vault's approvals and grant fresh `max` approval to the new one within `setCharmVault`.

---

### M-06 — `redeem(maxRedeem(owner))` can revert — inconsistent rounding between `maxRedeem` and `redeem` `[agents: 2, both phases]`

**File:** `contracts/shared/strategies/ajna/AjnaERC4626Vault.sol`
**Function:** `maxRedeem` (L187–195) vs. `redeem` (L295–321)
**Severity:** Medium · **Confidence:** 75

```solidity
187:    function maxRedeem(address owner) public view override returns (uint256) {
188:        if (AUTH.paused()) return 0;
189:
190:        uint256 grossAssetsByShares = super.maxWithdraw(owner);
191:        uint256 grossAssetsFromBuffer = Math.min(grossAssetsByShares, bufferAssets());
192:        uint256 sharesFromBuffer = super.previewWithdraw(grossAssetsFromBuffer);
193:        uint256 ownerBalance = balanceOf(owner);
194:        return sharesFromBuffer < ownerBalance ? sharesFromBuffer : ownerBalance;
195:    }
...
295:    function redeem(uint256 shares, address receiver, address owner)
...
303:        uint256 maxShares = maxRedeem(owner);
304:        if (shares > maxShares) revert ERC4626ExceededMaxRedeem(owner, shares, maxShares);
305:
306:        uint256 grossAssets = super.previewRedeem(shares);
307:        if (grossAssets > bufferAssets()) revert BufferLiquidityInsufficient();
```

`maxRedeem` derives its share count from the buffer-capped asset amount via `super.previewWithdraw` (OZ rounds shares **up**). `redeem` then independently re-derives the asset amount from that share count via `super.previewRedeem` (OZ rounds assets **down**). These two conversions are not exact inverses whenever `totalAssets/totalSupply != 1` (i.e., any state after the vault has accrued Ajna yield), so `redeem(maxRedeem(owner))` can compute a `grossAssets` that exceeds `bufferAssets()` and revert `BufferLiquidityInsufficient` — even though `maxRedeem` just advertised that exact share count as redeemable.

**Concrete trace:** `totalAssets = 2000`, `totalSupply = 1000` (share price 2, the normal post-yield state), `bufferAssets = 100`, `tax = 0`.
- `super.maxWithdraw` ≈ `floor(1000·2001/1001) = 1999`; buffer-capped → `grossAssetsFromBuffer = min(1999, 100) = 100`.
- `maxRedeem = super.previewWithdraw(100) = ceil(100·1001/2001) = ceil(50.02) = 51`.
- `redeem(51)`: `grossAssets = super.previewRedeem(51) = floor(51·2001/1001) = floor(101.949) = 101`.
- `101 > bufferAssets (100)` → **reverts**.

**Impact:** an integrator (or the swapper, F3's only caller) that follows the standard ERC-4626 pattern of calling `redeem(maxRedeem(owner), ...)` to fully exit gets a revert instead of a completed redemption — a spec-compliance break, not a fund-loss bug (the caller can retry with a smaller share count). Rated Medium because it's a concrete, provable, reachable defect in the vault's advertised liquidity accounting, even though bounded to a UX/integration failure.

**Fix:** Make `maxRedeem` conservative enough that `previewRedeem(maxRedeem(owner)) <= bufferAssets()` always holds (e.g., round down when deriving `sharesFromBuffer`, or re-derive via a fixed-point search bounded by the buffer), or have `redeem` clamp `grossAssets` to `bufferAssets()` directly instead of reverting.

---

### M-07 — Valuation-drift guard self-disables after ~4.5h of inactivity `[agents: 8+, both phases — the single most cross-validated observation in this audit]`

**File:** `contracts/shared/strategies/ERC4626StrategyAdapter.sol`
**Function:** `_allowedBpsForElapsedWindows` (L420–427), consumed by `_isWithinValuationBounds` (L432–433) and `isValuationReady`
**Severity:** Medium · **Confidence:** 78

```solidity
420:    function _allowedBpsForElapsedWindows(uint256 perWindowBps) internal view returns (uint256 allowedBps) {
421:        if (perWindowBps >= 10_000) return 10_000;
422:
423:        uint256 elapsed = block.timestamp > lastValuationTimestamp ? block.timestamp - lastValuationTimestamp : 0;
424:        uint256 windowsElapsed = (elapsed / valuationCheckWindow) + 1; // always allow at least one window
425:        allowedBps = perWindowBps * windowsElapsed;
426:        if (allowedBps > 10_000) allowedBps = 10_000;
427:    }
```

The allowed per-check drift band grows **linearly, uncapped in window count**, with time since the last snapshot. With the stated defaults (`valuationMaxIncreaseBps = 1000` = 10%, `valuationCheckWindow = 30 minutes`), after ~4.5 hours of no strategy operation (`windowsElapsed = 10`), `allowedBps` saturates at `10_000` = **100%** — `isValuationReady()` will then accept an arbitrary single-step price-per-share move on the wrapped (semi-trusted) ERC-4626 target, fully neutralizing the guard the constructor's snapshot-seeding fix (referenced in-code as "M-10") was built to provide. The snapshot (`lastValuationAssetsPerShare`/`lastValuationTimestamp`) is only refreshed opportunistically at the end of each op (`_syncValuationSnapshotBestEffort`), so a quiet period followed by a single op can validate a large manipulated jump. Separately, `getTotalAssets()` itself carries **no** bound at all — only `isValuationReady()` is gated; if the outer vault ever prices shares off `getTotalAssets()` directly rather than gating on `isValuationReady()`, this guard provides no protection whatsoever.

This mechanism was independently identified by essentially every phase-1 and phase-2 agent (precision-math, erc4626, defi-lending, general, math-precision, invariant, boundary, execution-trace, asymmetry, periphery) — the strongest cross-validation signal in the entire audit — but every one of them also correctly noted the final exploit payoff depends on the out-of-scope lane vault's use of these two views, which this audit cannot confirm. Rated Medium (not High) on that basis: the code-level degradation is certain, but end-to-end fund impact requires the outer vault's cooperation.

**Fix:** Cap `windowsElapsed` at a small constant (2–3), or treat a snapshot older than a small multiple of the window as "not ready" (return `false`) rather than linearly widening the allowed drift toward 100%.

---

### M-08 — Fee rate is read live at execution and paid to the same role that sets it — admin can front-run its own rate change `[agents: 1, phase 2]`

**File:** `contracts/shared/strategies/ajna/AjnaERC4626Vault.sol` (deposit/mint/withdraw/redeem) + `AjnaVaultAuth.sol` (`setToll`/`setTax`)
**Severity:** Medium · **Confidence:** 62

```solidity
// AjnaERC4626Vault.sol
231:        uint256 fee = _feeFromTotal(assets, AUTH.toll());     // deposit
279:        uint256 grossAssets = _grossUp(assets, AUTH.tax());   // withdraw
// AjnaVaultAuth.sol
138:    function setToll(uint256 nextToll) external onlyAdmin {
139:        if (nextToll > 1_000) revert FeeTooHigh();
140:        toll = nextToll;
141:    }
144:    function setTax(uint256 nextTax) external onlyAdmin {
145:        if (nextTax > 1_000) revert FeeTooHigh();
146:        tax = nextTax;
147:    }
```

Every deposit/mint/withdraw/redeem reads `AUTH.toll()`/`AUTH.tax()` live at execution time (no snapshot at share-issuance time) and routes the fee straight to `AUTH.admin()` via `_sendFee`. `setToll`/`setTax` are instant, uncapped by any timelock (only a 1000bps/10% ceiling), and callable by the same `admin` that receives the fee. An admin who observes (or controls block-building for) a large pending swapper withdrawal can call `setTax(1000)` immediately before it lands, then `setTax(0)` immediately after, skimming up to 10% of that specific withdrawal to themselves; the symmetric move on `toll` works against a large pending deposit. Rated Medium (not Low) because it is a clean, concretely-provable admin-privileged mechanism with a bounded but real (up to 10% of any single flow) impact, and no on-chain delay exists to give depositors any warning.

**Fix:** Snapshot the applicable toll/tax rate at the time shares are minted (charged at exit using the entry-time rate, or vice versa consistently), or route fee-rate changes through a timelock so they cannot be applied to an already-in-flight transaction.

---

### M-09 — Charm LP position valued from manipulable spot composition, no TWAP/deviation bound `[agents: 4+, both phases]`

**File:** `contracts/shared/strategies/univ3/CharmStrategy4626.sol`
**Function:** `_getCharmExposure` (L480–519) feeding `getTotalAssets` (L456–478), `harvest`, and `rebalance`'s loss check
**Severity:** Medium · **Confidence:** 55

`_getCharmExposure` derives the strategy's Charm-position token amounts from `charmVault.getTotalAmounts()`. For a Uniswap-V3 automated liquidity vault, this reflects the pool's **current spot price**, which is intra-block manipulable (flash-loan-funded swap). The ASSET leg is counted at face value and the USDC leg is separately re-priced through the independent oracle — but the underlying *quantities* (how much is ASSET vs. USDC) are never cross-checked against a TWAP or bounded for deviation, even though the contract already has a TWAP helper (`_getPoolPriceTWAP`) it uses elsewhere for swap sizing but not for this valuation. This value feeds `getTotalAssets` (thus any out-of-scope lane-vault share pricing), `harvest`'s profit delta, and `rebalance`'s pre/post loss-bound check (which is consequently self-referential — both the before and after snapshots can be taken during the same manipulated window). Rated Medium: the code-level manipulability is real and multiply-corroborated, but a fully realized profit requires the out-of-scope lane vault to price shares synchronously off this value, which could not be confirmed here.

**Fix:** Value the Charm position's token composition using a TWAP-derived price (the contract already computes one for swaps) rather than spot `getTotalAmounts()`, or bound the accepted spot-vs-TWAP deviation before trusting the composition.

---

### M-10 — Oracle-priced withdrawal sizing vs. TWAP-priced realization can brick strict withdraw `[agents: 1, phase 1]`

**File:** `contracts/shared/strategies/univ3/CharmStrategy4626.sol`
**Function:** `withdraw` (L953–1004)
**Severity:** Medium · **Confidence:** 68

`withdraw` sizes the Charm-share redemption and values `getTotalAssets()` using `assetOracle` (`_usdcToAssetValue`, oracle-priced), but the shortfall top-up — the swap that must actually deliver enough ASSET to satisfy the strict "exact `amount` or revert" contract — executes at the Uniswap TWAP price (`_swapUsdcToAssetSafe` → `_swapUsdcToAsset`). Any divergence between the oracle price and the pool's TWAP beyond `swapSlippageBps` (default tolerance) causes the swap to under-deliver relative to what the oracle told the caller was available, tripping `revert WithdrawLiquidityUnavailable(amount, availableAsset)` (L998) even though `emergencyWithdraw` could still recover the position. This requires no manipulation — two honest, independently-updating price sources simply disagreeing is sufficient. **Concrete numeric trace:** oracle = $1/ASSET, pool TWAP = $2/ASSET (1 USDC = 0.5 ASSET), strategy holds only a 100-USDC-equivalent Charm position, 0 idle ASSET. `getTotalAssets()` (oracle-priced) reports `100e18` withdrawable; the strategy's Charm exit yields 100 USDC, 0 ASSET; the TWAP-priced swap of 100 USDC returns ≈50 ASSET; `50e18 < 100e18` requested → revert.

**Fix:** Size and value the withdrawal using the same price source that will realize it (bound the USDC leg of `getTotalAssets` by what's actually swap-realizable, or take `min(oracle, TWAP)`), and/or make `withdraw` best-effort (return `withdrawn < amount` instead of reverting) so a divergence degrades gracefully instead of failing the transaction outright.

---

## Low-severity findings (brief)

**L-01 — `isCharmInRange` fails open.** (`univ3/CharmStrategy4626.sol`, `isCharmInRange`, L789–811) The outer `catch` sets `inRange = true` and the tick-getter catches default to full range (`-887200`/`887200`) rather than failing closed, inconsistent with the rest of the file's fail-closed valuation convention. Bounded because the subsequent `charmVault.deposit` call is itself try/catch and slippage-bounded.

**L-02 — Swap `deadline: block.timestamp`.** Both `_swapAssetToUsdcSafe` and `_swapUsdcToAsset` pass `block.timestamp` as the Uniswap router deadline, which is always satisfied whenever the transaction is eventually mined — no expiry protection against a held/delayed transaction. Bounded by the TWAP-derived `minOut`.

**L-03 — `maxSwapPercent` unbounded in `setParameters`.** (~L352–366) Only `swapSlippageBps`/`depositSlippageBps` are capped at `MAX_SLIPPAGE_BPS`; a comment claims "max 5%" for `maxSwapPercent` but no `require` enforces it. Owner-only.

**L-04 — Centralization / no timelock.** F1 and F5 use stock one-step OZ `Ownable` (vs. F2's correct custom two-step admin transfer); no privileged setter across any of the five contracts (fees, oracle, pool, pause, config) has an on-chain delay. Bounded because the `vault` is immutable and the sole caller of principal-moving ops, so owner mistransfer/renounce loses management ability but not funds-exit ability.

**L-05 — `maxWithdraw`/`maxRedeem` cap at buffer liquidity only.** (`AjnaERC4626Vault.sol`, ~L176–195) Self-disclosed via `isPartialWithdrawVault()`/`erc4626DeviationFlags()`/`hasConservativeMaxWithdraw()` — bucket LP is not auto-liquidated on withdraw. See M-06 for the residual edge this creates.

**L-06 — F1's emergency path can't force-liquidate F3's bucket LP.** When `ERC4626_VAULT` (F1's target) is F3, `ERC4626StrategyAdapter.emergencyWithdraw`'s recovery is bounded by F3's `maxWithdraw`, which per L-05 is buffer-only — bucket assets stay stranded until a keeper acts.

**L-07 — `AjnaVaultBuffer`/`AjnaERC4626Vault.totalAssets` donation-inflatable.** (`AjnaVaultBuffer.sol`, `totalAssets`, L42–44: raw `balanceOf`) Anyone can donate ASSET directly to the buffer to inflate reported `totalAssets()`. Deposits are swapper-gated, so the classic first-depositor squeeze isn't reachable by an outside attacker; realistic impact is griefing F1's valuation-drift guard (false-positive trip).

**L-08 — Self-referential TWAP slippage guard, short `MIN_TWAP_DURATION`.** `minOut` for both swap directions derives from the same pool the swap executes against, with `twapDuration` configurable as low as 60 seconds and no independent oracle cross-check.

**L-09 — `_resolveAjnaLimitIndex` fails open to the most permissive bucket.** (~L1163–1174) When the oracle's `getAjnaBucketFromV3TWAP()` helper reverts, the borrow-limit index defaults to `AJNA_MAX_BUCKET_INDEX` (7388) rather than skipping the borrow, disabling Ajna's own LUP slippage guard on that draw.

**L-10 — Fee-on-transfer / blocklist assumptions undefended.** None of F1/F3/F5's deposit paths measure balance-delta vs. requested amount; F3's single fee recipient (`AUTH.admin()`) has no pull-based fallback if blocklisted. Contingent on ASSET/USDC being non-standard tokens, which the protocol map flags as an unenforced deployment assumption.

---

## Access-Control Inventory

*(Condensed — full per-function table with line-cited guards was built in phase 0 and cross-checked against every finding above.)*

| Contract | Privileged role | Controls | Transfer model |
|---|---|---|---|
| F1 `ERC4626StrategyAdapter` | `owner` (Ownable) | setActive, setIdleBufferBps, setValuationGuard, **rescueTokens (H-01)** | One-step |
| F1 | `vault` (immutable) | deposit, withdraw, emergencyWithdraw, harvest, rebalance | N/A (immutable) |
| F2 `AjnaVaultAuth` | `admin` | all `set*` (toll/tax/pause/caps/keeper/swapper), retrieveFees, and (via `_sendFee`) is the **fee recipient for every F3 op (M-08)** | Two-step (`transferAdmin`→`acceptAdmin`) — correct |
| F2 | `swapper` | F3 deposit/mint/withdraw/redeem/move | Single admin-set address |
| F2 | `keepers` (mapping) | F3 moveFromBuffer/moveToBuffer | Admin-toggled |
| F3 `AjnaERC4626Vault` | delegates entirely to F2 | — | — |
| F4 `AjnaVaultBuffer` | `vault` (immutable, = F3) | depositFromVault, withdrawToVault | N/A |
| F5 `CharmStrategy4626` | `owner` (Ownable) | all `set*` config, initializeApprovals, **ownerEmergencyWithdraw (correctly `to==vault`-pinned)**, ownerEmergencyWithdrawFromCharm | One-step |
| F5 | `vault` (immutable) | deposit, withdraw, harvest, **emergencyWithdraw (M-02/M-03/M-04)** | N/A |
| F5 | `owner OR vault` | rebalance (no `nonReentrant`) | — |

**Unguarded entrypoints:** `AjnaERC4626Vault`'s inherited ERC20 `transfer/transferFrom/approve` on vault shares (open by design); `AjnaVaultAuth.acceptAdmin` (no modifier, but reverts unless `msg.sender == pendingAdmin`). No other state-changing entrypoint across the five contracts is reachable by an arbitrary, unprivileged caller.

## Threat Model (selected rows — full catalog built in phase 0)

| Actor | Reaches | Invariant | Status |
|---|---|---|---|
| `owner` (F1) | `rescueTokens` | Only `vault` receives outflows | **Violated — H-01** |
| `owner` (F5) | `ownerEmergencyWithdraw`/`...FromCharm` | Only `vault` receives outflows | Holds (destination correctly pinned) |
| `admin` (F2) | live fee rate on every F3 op | Fee rate not adjustable against an in-flight position | **Violated — M-08** |
| Ajna pool (external) | `getTotalAssets`, bucket LP ledger | Pool-reported values are trustworthy / reconciled | Unverified — see Lead L-A (parameter-unit mismatch) |
| Charm vault (external) | `getTotalAmounts`, valuation | Spot composition not directly used for NAV without a manipulation bound | **Violated — M-09** |
| `assetOracle`/TWAP (external) | valuation, borrow sizing, swap min-out | Single source of truth is consistent across sizing and realization | **Violated — M-10** |
| Vault-driven emergency exit | `emergencyWithdraw` | Always completes and sweeps 100% of strategy assets to `vault` | **Violated — M-02/M-03/M-04** |
| Keeper (F2-granted) | `moveFromBuffer`/`moveToBuffer` | Cannot extract funds to itself; can only reallocate | Holds (no theft path found) |

## Coverage gate

Every privileged/value-moving entrypoint identified in the phase-0 inventory (31 across F1–F5) maps to at least one examined finding or an explicit "examined, no issue" note above (e.g., F2's admin/keeper role model is sound apart from M-08; F3's CEI ordering, reentrancy guards, and fee-conservation math were traced and found correct by 3+ independent agents; F5's owner-emergency destination pinning holds). No entrypoint was left unexamined by both phases. `Coverage: 31 entrypoints in inventory, 31 addressed. Holes closed this pass: 0.`
