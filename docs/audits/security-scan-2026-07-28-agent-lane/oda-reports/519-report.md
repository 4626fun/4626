# 🔐 Security Review — 4626 Charm+Ajna Strategies

**Client target:** `wAudit 4626 Charm+Ajna strategies` (job 519)
**Source of truth:** `github.com/4626fun/4626` @ tag `audit/oda-2026-07-28-strategies-revenue`, commit `f09a31ad09fbe6e0c7833bce7b61b8743a2b6293`
**Live deployment context:** per-vault `CREATE2` via Registry `0xF60a1490C4129f2b6ae540734D3C2C8C6111824e` — **implementation-only** audit; this report does not assess any specific deployed instance's runtime configuration.

---

## Scope

| | |
|---|---|
| **Mode** | Named files only |
| **Files reviewed** | `contracts/shared/strategies/ERC4626StrategyAdapter.sol` · `contracts/shared/strategies/ajna/AjnaERC4626Vault.sol`<br>`contracts/shared/strategies/ajna/AjnaVaultAuth.sol` · `contracts/shared/strategies/ajna/AjnaVaultLibrary.sol`<br>`contracts/shared/strategies/ajna/AjnaVaultBuffer.sol` · `contracts/shared/strategies/univ3/CharmStrategy4626.sol` |
| **LOC in scope** | 2,784 |
| **Interfaces read for context (not in-scope)** | `IStrategy.sol`, `IStrategyValuation.sol`, `IAjnaPool.sol` |
| **Confidence threshold (1-100)** | 50 |

**Note on prior work:** the job description references prior jobs 466/431 as "context only," and flags a known design residual around Charm sandwichability. This audit was run fresh, from its own Phase 0 map through independent Phase 1 and Phase 2 hunting, without consulting any prior report. Where this audit's own findings corroborate or sharpen that flagged residual (see Findings #4, #9), that is noted — but every finding below was derived from this job's own analysis.

---

## Methodology

Three-phase pipeline: **Phase 0** (context) — three parallel agents built a protocol map, access-control inventory, and threat catalog with no vulnerability hunting. **Phase 1** (breadth) — 8 domain-specialist agents (general, precision-math, ERC20, DeFi-AMM, DeFi-lending, ERC4626, oracles, access-control) each walked a full published checklist against the code, producing 99 raw findings. **Phase 2** (depth) — 12 attacker-mindset agents (9 specialty + 3 gap-hunter), each given only the Phase 0 map and blind to Phase 1's findings, hunted independently and produced ~90 raw findings/leads. **Phase 3** (this document) — cross-phase dedup by root cause, hybrid re-examination of phase-unique leads, and a coverage gate against the Phase 0 inventory.

**Convergence as a confidence signal.** Because Phase 1 and Phase 2 ran blind to each other, and Phase 2's 12 agents ran blind to each other, independent re-discovery of the same root cause by multiple agents is treated as strong corroborating evidence — not merely "more reports." Several findings below were independently found by 5–10 of the 20 total hunting agents; those are flagged explicitly.

**A note on the Ajna LP/quote-token unit question (Finding #3).** Several independent agents concluded that this codebase's `AjnaERC4626Vault.moveToBuffer`/`move` pass an LP quantity into Ajna pool parameters that (per Ajna Finance's real, public interface) expect a quote-token amount. This repo does **not** vendor Ajna's actual source — its own `IAjnaPool.sol` interface comments assert the LP-denominated reading the code follows. I could not independently execute or decompile the deployed Ajna pool to settle this with certainty from files in scope alone. I report it because (a) it was independently reached by ~9 of 20 agents using general protocol knowledge, without access to each other's reasoning, (b) it matches this auditor's own knowledge of Ajna Finance's public `IPoolLenderActions` interface, and (c) the codebase's own `AjnaVaultLibrary.lpToAssets` helper — which exists specifically to convert LP → quote-token amounts — is written but never called at the one site (`moveToBuffer`/`move`) where, if the concern is correct, it is needed. That internal inconsistency is itself the strongest evidence of an unintentional bug. Confidence is capped accordingly (65) rather than the near-certainty most agents individually claimed.

---

## Reconciliation summary

Phase 1 findings: 99 raw (8 agents) → Phase 2 findings: ~35 raw findings + ~55 leads (12 agents) → **Overlap (same root cause, both phases): 11 · Phase-1-only: ~55 · Phase-2-only: 9 (5 genuinely novel, not raised in Phase 1) · Re-examined leads kept: 6, demoted: 3 · Coverage holes closed this pass: 0** (both phases independently covered every privileged/value-moving entrypoint; see Coverage Gate below). Findings below are organized by unified severity, each tagged with its phase-1/phase-2 origin and total independent-agent corroboration count. Confidence floor: findings below confidence 50 are listed under **Leads**, not as findings.

---

## Findings

[92] **1. `AjnaVaultLibrary.lpToAssets` permanently zero-values any bucket that has ever been bankrupt, regardless of the vault's own deposit timing — enables a NAV round-trip depositors can arbitrage**

`AjnaVaultLibrary.lpToAssets` · Confidence: 92 · **[both — corroborated by ~10/20 agents across both phases]**

**Description**

```solidity
// AjnaVaultLibrary.sol:44-49
// ODA-466-11: bankrupt buckets have worthless pre-bankruptcy LP.
(uint256 bucketLpTotal,, uint256 bankruptcyTime, uint256 bucketDeposit,) = pool.bucketInfo(bucketIndex);
if (bankruptcyTime != 0) return 0;
if (bucketLpTotal == 0 || bucketDeposit == 0) return 0;

return (lpAmount * bucketDeposit) / bucketLpTotal;
```

The comment's own qualifier — "*pre*-bankruptcy LP" — describes the correct rule, but the code doesn't implement it. Ajna's `bankruptcyTime` is a permanent per-bucket timestamp that is **never cleared**; only LP whose lender `depositTime <= bankruptcyTime` is void. LP added to the same bucket *after* the bankruptcy is fully valid and redeemable. The data needed to make that distinction is one call away — `pool.lenderInfo(index, lender)` returns exactly `(lpBalance, depositTime)`, and the library's own sibling helper `bucketAssets` (line 52-55) already reads it — but `lpToAssets` never calls it, checking only the bucket-wide `bankruptcyTime != 0`.

This function is the sole pricing primitive for `AjnaERC4626Vault.totalAssets()` (line 90) and `bucketAssets()` (line 412), which in turn drive `ERC4626StrategyAdapter.getTotalAssets()` (via `convertToAssets`) and the entire lane-vault share price.

**Proof of Concept**

1. Ajna bucket 4000 was bankrupted at some point in the pool's history by an unrelated liquidation settlement — `bucketInfo(4000).bankruptcyTime = T0`, permanently nonzero. Ajna itself continues to accept fresh deposits into bucket 4000 after `T0`.
2. Vault state: `totalAssets() = 2,000,000` (buffer 1,000,000 + no bucket exposure yet). `totalSupply = 2,000,000` shares, PPS = 1.0.
3. The adapter owner (or authorized swapper) calls `moveFromBuffer(4000, 1,000,000)` — a routine, non-malicious operation; nothing in the vault surfaces that bucket 4000 was ever bankrupted. Ajna mints real, fully-redeemable LP with `depositTime = now > T0`.
4. `AjnaERC4626Vault.totalAssets()` = `bufferAssets() (1,000,000)` + `lpToAssets(pool, 4000, mintedLp)`. Because `bankruptcyTime != 0`, `lpToAssets` returns **0**. Reported total collapses to 1,000,000 against 2,000,000 shares — PPS halves to 0.5, instantly and for no economic reason.
5. **Unprivileged extraction window:** any observer sees the PPS collapse (`ERC4626StrategyAdapter.getTotalAssets()`/`isValuationReady()` reflect it) and deposits into the lane vault at the halved price, buying shares cheaply.
6. When the operator later calls `moveToBuffer(4000, …)` (to rebalance, or during any routine bucket management), `removeQuoteToken` returns the *real* redeemed quote token amount — the position was never actually impaired — and `totalAssets()` snaps back to its true value. The depositor from step 5 now holds shares worth double what they paid, extracted from the pre-existing holders.
7. This is a real, non-hypothetical mechanism: any Ajna pool with meaningful liquidation activity over its lifetime will have bankrupted at least one bucket, and bucket reuse is not something the vault's bucket-selection logic (`validateBucketIndex`, which only checks index bounds) avoids.

**Fix**

```diff
  function lpToAssets(IAjnaPool pool, uint256 bucketIndex, uint256 lpAmount) internal view returns (uint256) {
      if (lpAmount == 0) return 0;

-     // ODA-466-11: bankrupt buckets have worthless pre-bankruptcy LP.
-     (uint256 bucketLpTotal,, uint256 bankruptcyTime, uint256 bucketDeposit,) = pool.bucketInfo(bucketIndex);
-     if (bankruptcyTime != 0) return 0;
+     (uint256 bucketLpTotal,, uint256 bankruptcyTime, uint256 bucketDeposit,) = pool.bucketInfo(bucketIndex);
+     // Only LP deposited before the bucket's most recent bankruptcy is void;
+     // this vault's own lender record carries the timestamp needed to tell the two apart.
+     (, uint256 depositTime) = pool.lenderInfo(bucketIndex, address(this));
+     if (bankruptcyTime != 0 && depositTime <= bankruptcyTime) return 0;
      if (bucketLpTotal == 0 || bucketDeposit == 0) return 0;

      return (lpAmount * bucketDeposit) / bucketLpTotal;
  }
```

---

[85] **2. `AjnaVaultLibrary.lpToAssets` ignores a bucket's collateral balance — value converted by a third-party Ajna liquidation take is under-valued and, with no `removeCollateral` path anywhere in scope, permanently unrecoverable**

`AjnaVaultLibrary.lpToAssets` · Confidence: 85 · **[phase2, corroborated by 3+ agents; phase1 4626-3/Math-5]**

**Description**

`IAjnaPool.bucketInfo` (this repo's own interface, `IAjnaPool.sol:87-98`) returns five fields including `collateral` ("Total collateral in bucket"). `lpToAssets` destructures the tuple but discards that field:

```solidity
// AjnaVaultLibrary.sol:45
(uint256 bucketLpTotal,, uint256 bankruptcyTime, uint256 bucketDeposit,) = pool.bucketInfo(bucketIndex);
//                     ^ collateral discarded here
...
return (lpAmount * bucketDeposit) / bucketLpTotal;   // line 49 — quote-deposit leg only
```

In Ajna, a `bucketTake`/`arbTake` — callable by any third party against a borrower in liquidation — exchanges a bucket's quote-token deposit for the auctioned collateral, crediting that collateral *into the bucket*. Existing LP holders' claim shifts from "quote deposit" to "quote deposit + collateral," proportionally. `lpToAssets` values only the quote-deposit half. When a bucket's deposit is fully converted (`bucketDeposit == 0`), the `if (bucketLpTotal == 0 || bucketDeposit == 0) return 0` branch zeroes the *entire* position even though it may still hold substantial collateral value.

Critically, this repo's `IAjnaPool` interface (verified above, `IAjnaPool.sol:10-140`) declares **no `removeCollateral` function at all** — and neither `AjnaERC4626Vault` nor `ERC4626StrategyAdapter` has any code path that could call one. Once a bucket's deposit converts to collateral, that portion of the vault's position has no on-chain reclaim mechanism in this codebase.

**Proof of Concept**

1. Vault lends 1,000,000 quote-token-equivalent into bucket 3200 at a 1:1 LP:deposit ratio. `bucketInfo(3200) = (lpTotal=1,000,000, collateral=0, bankruptcy=0, deposit=1,000,000, scale)`. `bucketAssets(3200)` correctly reports 1,000,000.
2. An Ajna borrower using bucket 3200's price range as their liquidation bucket defaults; any unprivileged third party calls Ajna's `bucketTake` naming index 3200, exchanging 400,000 of the bucket's deposit for the equivalent collateral (paid a take-reward for doing so).
3. `bucketInfo(3200)` now reads `(lpTotal≈1,000,000, collateral=C>0 worth 400,000, bankruptcy=0, deposit=600,000, scale)`. `lpToAssets` = `1,000,000 × 600,000 / 1,000,000` = **600,000** — a reported 40% loss with zero economic loss having occurred; the vault's actual claim (600,000 deposit + 400,000-equivalent collateral) is still worth 1,000,000.
4. `totalAssets()` falls 40% in one block; downstream, `ERC4626StrategyAdapter.isValuationReady()` trips its drift guard (default max 30% over 3 windows), freezing lane-vault deposits, and any redemption processed in the interim is priced against the phantom loss.
5. The 400,000-equivalent collateral leg is not recoverable by any function in scope: `moveToBuffer`'s only exit is `removeQuoteToken`, which is capped by the bucket's *deposit*, not its collateral.

**Fix**

Value LP against Ajna's real bucket exchange rate (`(deposit + collateral × bucketPrice(index)) / lpTotal`), and add a swapper-gated `removeCollateral(uint256 maxAmount, uint256 index)` forwarding path (plus the corresponding call on `IAjnaPool`) so the collateral leg is actually recoverable, not just correctly priced.

---

[65] **3. `AjnaERC4626Vault.moveToBuffer`/`move` pass Ajna LP amounts into pool parameters that (per Ajna's real interface) expect quote-token amounts — bucket exits systematically under-execute, buckets never fully untrack, and the emergency drain silently strands the accrued-interest fraction of every position**

`AjnaERC4626Vault.moveToBuffer`, `AjnaERC4626Vault.move` · Confidence: 65 (see methodology note above on why this is capped below the ~90 several individual agents claimed) · **[both — corroborated by ~9/20 agents]**

**Description**

```solidity
// AjnaERC4626Vault.sol:373-376 (moveToBuffer)
burnedBucketLp = AjnaVaultLibrary.burnableLp(bucketLp[fromIndex], bucketLpAmount);
(pulledAssets, burnedBucketLp) = AJNA_POOL.removeQuoteToken(burnedBucketLp, fromIndex);
bucketLp[fromIndex] -= burnedBucketLp;
_untrackBucketIfEmpty(fromIndex);

// AjnaERC4626Vault.sol:393-394 (move)
uint256 trackedLp = AjnaVaultLibrary.burnableLp(bucketLp[fromIndex], bucketLpAmount);
(fromBucketLp, toBucketLp,) = AJNA_POOL.moveQuoteToken(trackedLp, fromIndex, toIndex, block.timestamp + 1 hours);
```

Multiple independent agents, reasoning from general knowledge of Ajna Finance's public interface (not available in this repo), state that Ajna's real `removeQuoteToken(uint256 maxAmount_, uint256 index_)` and `moveQuoteToken(uint256 maxAmount_, ...)` take `maxAmount_` as a **quote-token** ceiling, returning the LP actually burned as a *separate* output — not the reverse. This repo's own `IAjnaPool.sol` documents the parameter as "Amount of LP tokens to burn" (line 54) / "Maximum amount of LP to move" (line 65), which is what the vault code follows.

The strongest evidence this is an unintentional bug rather than a deliberate match to a custom pool: `AjnaVaultLibrary.lpToAssets` (Finding #1/#2) exists specifically to convert an LP quantity into its quote-token value — but it is never called before `moveToBuffer`/`move` invoke the pool. If the vault genuinely needed to pass LP amounts, that conversion helper would be unnecessary dead weight; instead it sits unused at exactly the site an LP→quote conversion would be needed if the real semantics are quote-denominated.

**If the concern is correct**, the practical effect: once any tracked bucket's exchange rate rises above 1.0 (any accrued lending interest), passing the LP quantity as a quote-token cap under-removes by `1 - 1/rate`. `bucketLp[fromIndex]` never reaches exactly 0, `_untrackBucketIfEmpty` never fires, and the bucket stays tracked forever — consuming one of only `MAX_BUCKETS = 50` slots. `ERC4626StrategyAdapter._drainBucketsToBufferBestEffort()` (called from `emergencyWithdraw()`) makes exactly one non-retrying pass per bucket and counts any non-reverting call as fully processed (`processed++`, no re-check of remaining `bucketLp`), so an emergency exit would report `AjnaBucketsDrained(N, 0)` — a clean sweep — while the accrued-interest fraction of every position stays stranded in Ajna. Numeric illustration at a 10% accrued rate: `moveToBuffer(idx, 1,000,000e18)` on a bucket now worth 1,100,000e18 removes exactly 1,000,000e18 quote and redeems `1,000,000e18/1.1 ≈ 909,091e18` LP, leaving `≈90,909e18` LP (worth ≈100,000e18, 9.1% of the position) permanently behind.

**Fix**

If confirmed against the actual deployed Ajna pool's ABI: convert tracked LP to a quote-token amount before calling the pool — `AjnaVaultLibrary.lpToAssets(AJNA_POOL, fromIndex, requestedLp)` (or `type(uint256).max` for a full exit) — passed as the pool's `maxAmount_`, continuing to decrement `bucketLp` by the pool's returned `redeemedLP_`. **Before shipping any fix, verify this finding directly against the actual deployed Ajna pool's bytecode/ABI** — this is the one recommendation in this report that depends on external ground truth this audit could not access.

---

[80] **4. `CharmStrategy4626` prices the Charm LP leg from live pool composition while the USDC leg is converted at an independent, unmanipulable oracle price — NAV is minimized at the true price and inflates with displacement in either direction, exploitable in a single transaction**

`CharmStrategy4626._getCharmExposure`, `getTotalAssets`, `_realizableTotalAssets` · Confidence: 80 · **[both — corroborated across AMM/ERC4626/oracle domains in phase 1 and by 3+ phase-2 agents with independent numeric traces; sharpens the job description's flagged "Charm sandwich" residual with a concrete, quantified mechanism]**

**Description**

```solidity
// CharmStrategy4626.sol:513-528 — spot composition
try charmVault.getTotalAmounts() returns (uint256 a0, uint256 a1) { total0 = a0; total1 = a1; }
...
assetAmount = assetIsToken0 ? (total0 * ourShares) / totalShares : (total1 * ourShares) / totalShares;
usdcAmount  = assetIsToken0 ? (total1 * ourShares) / totalShares : (total0 * ourShares) / totalShares;

// CharmStrategy4626.sol:457-458 — USDC leg priced at the independent oracle
uint256 usdcInAsset = _usdcToAssetValue(idleUsdc + charmUsdc + ajnaState.collateralUsdc);
uint256 grossAssetValue = grossAsset + usdcInAsset;
```

`charmVault.getTotalAmounts()` reflects the Charm/Uniswap-V3 position's *current* token split, which is a direct, single-block function of the pool's spot price and is manipulable via any large enough swap (including a flash loan). `_usdcToAssetValue`'s price comes from `assetOracle` (or, on the realizable path, `min(oracle, TWAP)`) — a source the pool-price manipulation does not move within one transaction. Composing a manipulable quantity with an unmanipulable price is the textbook LP-valuation attack: for a concentrated-liquidity position, value `V(p') = amountASSET(p')·p_oracle + amountUSDC(p')` is minimized exactly at `p' = p_oracle` and increases as the pool is pushed in *either* direction, because the position necessarily converts to more of whichever leg was under-priced relative to the push.

`isValuationReady()` (`CharmStrategy4626.sol:373-395`) does not guard against this — it checks oracle freshness and the Ajna collateral ratio, never a spot-vs-TWAP deviation on the Charm position itself. `_realizableTotalAssets`'s `min(oracle, TWAP)` bounds only the *conversion rate* of the USDC leg (line 538-541); it does nothing to bound the manipulated *composition* feeding both legs.

**Proof of Concept** (numbers from the phase-1 AMM agent's trace, independently reproduced in shape by two phase-2 agents)

1. Charm base range ≈ ±10% around spot; strategy's pro-rata share of the position ≈ 500,000 ASSET-equivalent, roughly balanced 50/50 at the true price.
2. Attacker pushes the underlying Uniswap V3 pool price up ~5% with a single swap (flash-loanable). In-range LP math rotates the position USDC-heavy — illustratively from 50/50 to ~30/70.
3. `getTotalAssets()` reads the new (USDC-heavy) composition via `getTotalAmounts()`, but converts the now-larger USDC leg at the **unmoved** oracle price → reported NAV inflates roughly in proportion to the displacement (the AMM agent's concrete trace: a 5% push at a ±10% range yields +0.61% NAV; at the 10% range edge, +2.32%; wider ranges amplify this further — up to +20% at a `[0.5P,2P]` range).
4. Attacker redeems lane-vault shares in the same transaction at the inflated `previewRedeem`, then reverses the swap.
5. Cost is roughly 2× the pool fee tier on the pushed notional; profit scales with the inflation captured. The mirror push (down) instead lets an attacker mint shares cheaply, diluting existing holders on the way in.

**Fix**

Do not value the Charm leg from live `getTotalAmounts()`. Reconstruct the position's token amounts at the TWAP-implied tick (`LiquidityAmounts.getAmountsForLiquidity` at `TickMath.getSqrtRatioAtTick(twapTick)`) so composition and price share the same, manipulation-resistant source. As defense in depth, add a bounded `|spot tick − TWAP tick|` deviation gate to `isValuationReady()` and fail closed beyond it.

---

[78] **5. `AjnaVaultAuth.pause()` freezes the exit paths it should be protecting — `ERC4626StrategyAdapter.emergencyWithdraw()` completes "successfully" while returning near-zero, and the strategy is marked inactive with capital still locked**

`AjnaVaultAuth.pause`, `AjnaERC4626Vault.withdraw/redeem/moveToBuffer`, `ERC4626StrategyAdapter.emergencyWithdraw` · Confidence: 78 · **[both — corroborated by 8+ agents across both phases, the single most-corroborated access-control finding]**

**Description**

```solidity
// AjnaVaultAuth.sol:123-126
function pause() external onlyAdmin {
    paused = true;
    emit Paused();
}
```

One call, no timelock, no expiry, held by `AjnaVaultAuth.admin` — a principal distinct from both `ERC4626StrategyAdapter.owner` (treasury) and the lane vault. `notPaused` gates `AjnaERC4626Vault.withdraw` (line 282), `redeem` (line 309), and — critically — `moveToBuffer` (line 369), the *de-risking* direction, alongside the entry-side functions. `maxWithdraw`/`maxRedeem` additionally short-circuit to 0 while paused (lines 177, 188).

`ERC4626StrategyAdapter.emergencyWithdraw()` is built entirely from paths this disables:
```solidity
// ERC4626StrategyAdapter.sol:306-325
function emergencyWithdraw() external override onlyVault nonReentrant returns (uint256 totalWithdrawn) {
    _isActive = false;
    _drainBucketsToBufferBestEffort();       // every moveToBuffer reverts VaultPaused → caught → residualBuckets++
    uint256 maxAssets = _maxWithdrawBestEffort();  // returns 0 (paused)
    if (maxAssets > 0) { _withdrawFrom4626BestEffort(maxAssets); }  // skipped
    totalWithdrawn = ASSET.balanceOf(address(this));  // adapter-idle only
    ...
}
```

The function does not revert — it completes, sets `_isActive = false` (permanent unless the owner calls `setActive(true)` — a *third* principal), and reports a near-zero recovery as a success. Meanwhile `getTotalAssets()` (line 221-231) reads `ERC4626_VAULT.convertToAssets(sharesHeld)`, which has no pause gate at all — the lane vault continues to price and allocate against assets it cannot currently reach.

**Proof of Concept**

1. Adapter holds 1,000,000 in inner-vault value: 100,000 idle buffer, 900,000 across Ajna buckets (default `idleBufferBps = 1000`).
2. `AjnaVaultAuth.admin` calls `pause()` — one transaction.
3. Lane vault calls `adapter.emergencyWithdraw()`. Stage 1: every `moveToBuffer` reverts `VaultPaused`, caught, `residualBuckets` incremented. Stage 2: `maxWithdraw` returns 0, skipped. `totalWithdrawn = ASSET.balanceOf(adapter) = 0`.
4. The call **returns successfully**, emitting `AjnaBucketsDrained(0, N)` and `EmergencyWithdraw(vault, 0)`. `_isActive` is now `false`.
5. `adapter.getTotalAssets()` still reports ≈1,000,000 (`convertToAssets` unaffected by pause). The lane vault's NAV, and any redemptions serviced from other strategies against that NAV, continue as if the funds were live.
6. Recovery requires `AjnaVaultAuth.admin` to voluntarily `unpause()` — a principal the lane vault, the adapter owner, and depositors have no on-chain leverage over.

**Fix**

Remove `notPaused` from `withdraw`, `redeem`, and `moveToBuffer` (pause should stop new exposure, never exit), and drop the `AUTH.paused()` short-circuit from `maxWithdraw`/`maxRedeem`. As defense in depth, have `getTotalAssets()`/`isValuationReady()` reflect a paused inner vault so the lane vault does not keep pricing frozen capital as live.

---

[75] **6. `AjnaVaultAuth.setSwapper` is one-step and instant, and the default `minBucketIndex == 0` disables the only price floor on Ajna deposits — a misrouted or hijacked swapper both permanently bricks the adapter's withdraw path and can park up to ~95% of vault principal in Ajna's most extreme price bucket**

`AjnaVaultAuth.setSwapper`, `AjnaVaultLibrary.validateBucketIndex` · Confidence: 75 · **[both — phase1 AC-1/General-2; corroborated as a finding by one phase-2 agent, as a lead by three more]**

**Description**

```solidity
// AjnaVaultAuth.sol:111-116
function setSwapper(address nextSwapper) external onlyAdmin {
    // FIX: F-09 — prevent setting swapper to zero which would lock withdraw/redeem
    if (nextSwapper == address(0)) revert ZeroAddress();
    swapper = nextSwapper;
    emit SwapperSet(nextSwapper);
}
```

The zero-check acknowledges that a bad `swapper` locks `withdraw`/`redeem` — but *any* non-zero wrong address has the identical effect, and unlike `transferAdmin` (two-step, `AjnaVaultAuth.sol:98-109`) or `setToll`/`setTax` (24h-timelocked after arming), this is one call with no delay. `onlyAdapterAuthorized` (`AjnaERC4626Vault.sol:56-59`) resolves `AUTH.swapper()` live on every `deposit`/`mint`/`withdraw`/`redeem`/`moveFromBuffer`/`move` call.

Separately, `AjnaVaultLibrary.validateBucketIndex` (`AjnaVaultLibrary.sol:18-22`) only enforces its price-floor argument when `minBucketIndex != 0` — and `minBucketIndex` is a plain `uint256 public` in `AjnaVaultAuth` with **no constructor assignment** (confirmed: the constructor at `AjnaVaultAuth.sol:72-75` sets only `admin`), defaulting to 0. Until an admin explicitly calls `setMinBucketIndex`, every bucket index from 1 (Ajna's highest price point) upward is accepted.

**Proof of Concept**

1. `AUTH.admin` calls `setSwapper(newAddress)` — whether by hijack, operator-rotation error, or migration mistake. One transaction, no delay.
2. The adapter (no longer `AUTH.swapper()`) fails `onlyAdapterAuthorized` on every inner call. `ERC4626StrategyAdapter._withdrawFrom4626BestEffort`/`_drainBucketsToBufferBestEffort` catch every resulting revert and degrade to returning 0 — `adapter.withdraw()` silently returns 0, and `emergencyWithdraw()` behaves exactly as in Finding #5 (near-zero recovery, `_isActive` set false).
3. If `newAddress` is instead attacker-controlled (or the admin key itself is compromised), the new swapper calls `AjnaERC4626Vault.moveFromBuffer(1, bufferAssets * 95 / 100)`. `validateBucketIndex(1, 0)` passes (`minBucketIndex == 0`, floor skipped); `ensureBufferRatio`'s 5% floor is the only remaining constraint.
4. Vault quote tokens are deposited at Ajna bucket index 1 — an extreme price point — where any Ajna borrower can draw debt against negligible pledged collateral at that LUP.
5. The adapter's `getTotalAssets()` does not reflect this until the bucket's reported `deposit` collapses; the lane vault continues allocating fresh capital on the strength of a stale NAV.

**Fix**

Route `setSwapper` through the same two-step-plus-timelock pattern already used for `transferAdmin`/`setToll`. Initialize `minBucketIndex` to a sane non-zero floor in the `AjnaVaultAuth` constructor (or make bucket operations revert while it is 0, rather than treating 0 as "no floor").

---

[70] **7. `ERC4626StrategyAdapter.isValuationReady()` has no permissionless refresh path — 90 minutes of inactivity permanently blocks all lane-vault deposits and mints until a privileged operation happens to occur**

`ERC4626StrategyAdapter.isValuationReady`, `_syncValuationSnapshotBestEffort` · Confidence: 70 · **[phase2-only, independently found by 3 of 12 blind attack agents]**

**Description**

```solidity
// ERC4626StrategyAdapter.sol:205-209
if (valuationCheckWindow > 0 && lastValuationTimestamp > 0) {
    uint256 elapsed = block.timestamp > lastValuationTimestamp ? block.timestamp - lastValuationTimestamp : 0;
    if (elapsed > valuationCheckWindow * MAX_VALUATION_WINDOWS) return false;
}
```

With the shipped defaults (`valuationCheckWindow = 30 minutes`, `MAX_VALUATION_WINDOWS = 3`), `isValuationReady()` unconditionally returns `false` once 5,401 seconds (~90 minutes) have elapsed since `lastValuationTimestamp` was last written. That timestamp is written **only** by `_syncValuationSnapshotBestEffort()` (`ERC4626StrategyAdapter.sol:624-631`), whose only callers are the constructor and the `onlyVault`/`onlyOwner` functions `deposit`/`withdraw`/`emergencyWithdraw`/`rebalance`/`moveFromBuffer`/`move`/`moveToBuffer`/`drainBucketsToBuffer`. Notably, `harvest()` — the one function a keeper would call on a routine cadence — does **not** refresh it. There is no public `poke()`/`syncValuation()` anywhere in the contract.

**Proof of Concept**

1. The adapter has deployed capital (`sharesHeld > 0` in the inner vault) and no `deposit`/`withdraw`/`rebalance`/bucket-op has been called for 91 minutes — plausible during any lull in user activity or if the operator's keeper only calls `harvest()`.
2. `isValuationReady()`: `_readCurrentAssetsPerShare()` succeeds and returns a nonzero PPS; `snapshot != 0`; but `elapsed (5401s) > 1800×3 (5400s)` → returns `false`.
3. Every lane-vault `deposit()`/`mint()` that checks `_requireStrategyValuationsReady` (referenced independently by three agents as the outer vault's gating call) reverts for this strategy — with the underlying position perfectly healthy and unchanged.
4. Continued inactivity accrues valuation misses toward automatic strategy ejection at the outer vault's `report()` cadence.
5. Any subsequent privileged call (even a single dust `withdraw(1)`) clears the block by re-syncing the snapshot — so the DoS is self-healing but entirely dependent on someone happening to trigger a privileged op, which is not guaranteed by the protocol's own design (`harvest()` alone does not do it).

**Fix**

Add a permissionless `syncValuation()` (or `poke()`) that calls `_syncValuationSnapshotBestEffort()` — it is already a pure read-and-latch with no side effects requiring privilege — and/or have `harvest()` refresh the snapshot.

---

[68] **8. `_syncValuationSnapshotBestEffort()` re-anchors the valuation drift guard to whatever price it currently observes, with no bounds check — a tripped guard is cleared by the next adapter operation, including a 1-wei withdrawal any lane-vault holder can trigger**

`ERC4626StrategyAdapter._syncValuationSnapshotBestEffort`, `isValuationReady` · Confidence: 68 · **[phase2-only, independently found by 2 of 12 blind attack agents as a finding, by 4+ more as a lead]**

**Description**

```solidity
// ERC4626StrategyAdapter.sol:624-631
function _syncValuationSnapshotBestEffort() internal {
    (bool ok, uint256 currentAssetsPerShare) = _readCurrentAssetsPerShare();
    if (!ok) return;

    lastValuationAssetsPerShare = currentAssetsPerShare;
    lastValuationTimestamp = block.timestamp;
    emit ValuationSnapshotSynced(currentAssetsPerShare, block.timestamp);
}
```

This function is the sole writer of `lastValuationAssetsPerShare` — the reference value `isValuationReady()`'s drift check (`_isWithinValuationBounds`) compares the *current* PPS against. It writes unconditionally: no call to `_isWithinValuationBounds` gates the write, so it will happily latch a PPS that is itself outside the configured drift bounds. It runs at the tail of every state-changing adapter function, including `withdraw()` (line 302), which is `onlyVault`-gated but reachable by any lane-vault user redeeming even 1 wei.

**Proof of Concept**

1. Snapshot = 1.0e18, `valuationMaxIncreaseBps = 1000` (10%).
2. Anyone transfers ASSET directly to `AjnaVaultBuffer` (no access control on receiving tokens — see Finding #14) large enough to push the inner vault's PPS to 1.5e18. `isValuationReady()` now correctly returns `false` (50% move exceeds the 10% band) — lane-vault deposits are blocked, as intended.
3. Any lane-vault holder calls a redemption that reaches `adapter.withdraw(1)`. At the tail of that call, `_syncValuationSnapshotBestEffort()` reads the still-manipulated PPS (1.5e18) and writes it as the new trusted snapshot, unconditionally.
4. The next `isValuationReady()` check compares 1.5e18 against the now-identical 1.5e18 snapshot — `increase = 0` — returns `true`. The guard that was supposed to protect against exactly this manipulation is defeated by the manipulation's own aftermath, via an action any unprivileged user can trigger.

**Fix**

```diff
  function _syncValuationSnapshotBestEffort() internal {
      (bool ok, uint256 currentAssetsPerShare) = _readCurrentAssetsPerShare();
      if (!ok) return;

+     if (lastValuationAssetsPerShare != 0 && !_isWithinValuationBounds(lastValuationAssetsPerShare, currentAssetsPerShare)) {
+         return; // leave the tripped snapshot stale until an owner explicitly re-arms it
+     }
      lastValuationAssetsPerShare = currentAssetsPerShare;
      lastValuationTimestamp = block.timestamp;
      emit ValuationSnapshotSynced(currentAssetsPerShare, block.timestamp);
  }
```

---

[70] **9. `CharmStrategy4626.withdraw`'s slippage floors are derived from the same live Charm composition the redemption is sized against — the guard cannot detect the manipulation it exists to catch, and the sizing itself uses total-equity in the numerator against Charm-only value in the denominator, causing systematic over-liquidation**

`CharmStrategy4626.withdraw` · Confidence: 70 · **[both — phase1 AMM-1 (High, standalone quantified trace) + phase2 P2-10 (5+ agents, different but related mechanism in the same function)]**

**Description — mechanism A (self-referential slippage floor, phase-1 AMM-1):**

```solidity
// CharmStrategy4626.sol:953-961
uint256 totalShares = charmVault.totalSupply();
(uint256 total0, uint256 total1) = charmVault.getTotalAmounts();
uint256 expected0 = totalShares > 0 ? Math.mulDiv(total0, sharesToWithdraw, totalShares) : 0;
uint256 expected1 = totalShares > 0 ? Math.mulDiv(total1, sharesToWithdraw, totalShares) : 0;
uint256 min0 = Math.mulDiv(expected0, 10_000 - depositSlippageBps, 10_000);
uint256 min1 = Math.mulDiv(expected1, 10_000 - depositSlippageBps, 10_000);
try charmVault.withdraw(sharesToWithdraw, min0, min1, address(this)) {} catch {}
```

Charm's `withdraw` redeems pro-rata from the *same* `getTotalAmounts()`/`totalSupply()` this code just read, so the "5% slippage floor" is always satisfied by construction — it cannot detect that the pool price (and thus the composition) was manipulated moments earlier. Quantified: pushing spot ~3% ahead of a redemption rotates the LP composition, routes the resulting shortfall through a swap priced off the same manipulated state, and extracts on the order of 3% of the affected leg per redemption (phase-1 agent's full numeric trace).

**Mechanism B (wrong denominator, phase-2, 5+ independent agents):**

```solidity
// CharmStrategy4626.sol:947-950
uint256 charmValueInAsset = charmAssetExposure + _usdcToAssetValueRealizable(charmUsdcExposure);
uint256 sharesToWithdraw =
    charmValueInAsset > 0 ? Math.ceilDiv(ourShares * amount, charmValueInAsset) : ourShares;
if (sharesToWithdraw > ourShares) sharesToWithdraw = ourShares;
```

`amount` (the numerator driver) is sized against **total** strategy equity — idle ASSET, idle USDC, Ajna collateral, and Charm combined (per `_realizableTotalAssets`, which clamped it at line 938). `charmValueInAsset` (the denominator) is **Charm-only**. Any idle balance in the strategy causes the Charm LP to be redeemed for more than its actual share of the request — up to a full, unplanned liquidation of the position for a withdrawal that idle inventory alone could have covered.

**Proof of Concept (mechanism B, concrete)**

1. Strategy holds 50,000 idle ASSET and a Charm position worth 50,000 ASSET-equivalent (`ourShares = 1000`, no Ajna leg). `_realizableTotalAssets() = 100,000`.
2. Lane vault calls `withdraw(50,000)`. `realizable (100,000) >= amount`, no clamp.
3. `charmValueInAsset = 50,000`. `sharesToWithdraw = ceilDiv(1000 × 50,000, 50,000) = 1000` — **100% of the Charm position**, even though the idle 50,000 ASSET alone fully covers the request.
4. The entire LP position is torn down (paying Charm's exit rounding plus up to `depositSlippageBps` of allowed slippage, per mechanism A above) to serve a withdrawal that needed none of it, and will need to be re-seeded — paying entry costs again — on the next deposit.

**Fix**

For mechanism A: derive `min0`/`min1` from a TWAP-reconstructed composition (`LiquidityAmounts.getAmountsForLiquidity` at the TWAP sqrt price), not live `getTotalAmounts()`. For mechanism B: net off already-available balances before sizing the Charm redemption — `uint256 shortfall = amount > ASSET.balanceOf(address(this)) ? amount - ASSET.balanceOf(address(this)) : 0;` and use `shortfall` (not `amount`) as the `sharesToWithdraw` numerator, skipping the Charm branch entirely when it is zero.

---

[62] **10. `CharmStrategy4626`'s "Ajna-first" withdraw policy can ratchet all liquid USDC into pledged collateral with no code path anywhere in the contract to voluntarily repay and reclaim it, other than as a side effect of a future deposit**

`CharmStrategy4626.withdraw`, `_tryAjnaBorrow`, `_repayAjnaDebtWithAsset`, `isValuationReady` · Confidence: 62 · **[phase1 Lending-1/6/7 (High), corroborated structurally by phase2's independent analysis of `_repayAjnaDebtWithAsset`]**

**Description**

`withdraw()` tries Ajna borrowing before falling back to a swap (`CharmStrategy4626.sol:969-970`: `_tryAjnaBorrow(assetNeeded)` runs first). Every successful borrow pledges `ajnaMinCollateralRatioBps` (default 125%) worth of USDC to deliver 1x ASSET — collateral that then becomes invisible to the swap fallback (`totalUsdc = USDC.balanceOf(address(this))` only sees *idle* USDC). Grep-confirmed: `_repayAjnaDebtWithAsset` — the only function in the entire contract that reduces Ajna debt or releases pledged collateral — is reachable **only** from `deposit()` and `emergencyWithdraw()`. There is no owner- or keeper-callable repay function anywhere in `CharmStrategy4626.sol`.

This compounds with `isValuationReady()`'s own health gate (`CharmStrategy4626.sol:388-391`): once the collateral ratio drops below `ajnaMinCollateralRatioBps`, `isValuationReady()` returns `false`, which (per the outer vault's deposit gating referenced throughout this audit) blocks new lane-vault deposits into this strategy — precisely the inflow that would trigger `deposit()`'s repay-first policy and restore health. A position that needs deleveraging cannot receive the capital that would deleverage it.

**Proof of Concept**

1. Strategy holds 1,250 USDC idle, no debt. Vault calls `withdraw(1,000)` with `availableAsset = 0`.
2. `_tryAjnaBorrow(1,000)`: collateral capacity computation admits the full ask; `drawDebt` pledges all 1,250 USDC, delivers 1,000 ASSET.
3. State: 1,250 USDC pledged as collateral (illiquid), 1,000 ASSET debt, 0 idle of either token. `getTotalAssets() = 1,250 - 1,000 = 250` (still positive equity).
4. A second `withdraw(250)` call: `_tryAjnaBorrow` computes `maxTotalDebtFromCollateral = 1,000` (unchanged, no new collateral available) `<= state.debtAsset (1,000)` → returns 0. Swap fallback: `totalUsdc == 0` → skipped. `withdrawn = 0`.
5. The 250 of real, positive equity is reported by NAV but cannot be delivered by any code path unless a fresh `deposit()` brings in enough ASSET to trigger `_repayAjnaDebtWithAsset` — which itself may not fully succeed (see Lead below on stale-inflator repay sizing).

**Fix**

Add an owner/keeper-callable `repayAjnaDebt`/`pledgeAjnaCollateral` pair, and prefer swapping idle USDC over opening new Ajna debt whenever USDC is genuinely liquid (only borrow when the swap path is unavailable or insufficient).

---

### Medium-severity findings (confirmed against source; grouped, condensed)

[58] **11. `ERC4626StrategyAdapter.getTotalAssets()` values the inner-vault position with `convertToAssets` (fee-blind, un-overridden by `AjnaERC4626Vault`) instead of the tax-netting `previewRedeem`, permanently overstating lane-vault NAV by up to `AUTH.tax()` (capped 10%) and making the same fee invisible to the valuation drift guard.** `getTotalAssets()`/`_readCurrentAssetsPerShare()` both call `ERC4626_VAULT.convertToAssets(sharesHeld)` (`ERC4626StrategyAdapter.sol:226`, `:591`); `AjnaERC4626Vault` overrides `previewRedeem` to apply `_netFromGross(gross, AUTH.tax())` (`AjnaERC4626Vault.sol:223-226`) but leaves `convertToAssets` as OZ's fee-free base. First-mover redeemers extract the gap from remaining holders. **[both — phase1 4626-4, phase2 P2-11, 5+ total agents]** Fix: use `previewRedeem(sharesHeld)` (falling back to `convertToAssets` on revert) in both call sites.

[55] **12. `ERC4626StrategyAdapter.deposit()` hard-reverts on any inner-vault deposit failure — including routine states (paused, at deposit cap) set by a third-party admin — unlike the graceful degrade-to-idle handling in the near-identical `rebalance()`, bricking all lane-vault user deposits.** `deposit()` lines 261-270 (`catch { revert InnerDepositFailed(); }`) vs. `rebalance()` lines 349-357 (`catch (bytes memory reason) { emit RebalanceDepositFailed(...); }`) — same author, opposite policy, on the identical failure. **[both — phase1 General-12 (related), phase2 P2-12, 4 agents]** Fix: clamp `toDeposit` to `ERC4626_VAULT.maxDeposit(address(this))` and, on failure, emit and leave assets idle instead of reverting.

[55] **13. `CharmStrategy4626.deposit`'s post-swap allocation branch does not clamp the ASSET leg to what the just-swapped USDC can actually pair with, so Charm's proportional-deposit check rejects the mismatch and the deposit silently no-ops (swap cost paid, nothing deployed).** `finalAsset = totalAsset` is set unconditionally at line 749 after a capped swap, while the sibling "can't swap enough" branch at lines 753-755 correctly clamps (`assetUsable = (totalUsdc * charmAsset) / charmUsdc`). The mismatch fails Charm's 95% `minAsset` floor and is swallowed by the empty `catch {}` at `_depositToCharmSafe` (lines 884-885). **[both — phase1 AMM-5, phase2 P2-13]** Fix: apply the same proportional clamp in the post-swap branch before calling `_depositToCharmSafe`.

[52] **14. `CharmStrategy4626.setSwapPool` performs zero validation — no zero-check, no code-length probe, no token-pair check — unlike its siblings `setCharmVault`/`setAjnaPool`, which fully validate before granting approvals; it is the sole price source for every swap's slippage floor and the TWAP leg of realizable NAV.** `setSwapPool(address _swapPool) external onlyOwner { swapPool = IUniswapV3Pool(_swapPool); }` (lines 1701-1703, verbatim). **[both — the single most cross-corroborated item in this audit: phase1 AC-5/AMM-4/Oracle-2/Oracle-3/General-3, phase2 by multiple agents — 7+ total]** Fix: mirror `setCharmVault`'s validation (code-length, `token0()`/`token1()` pair check against ASSET/USDC).

[50] **15. `ERC4626StrategyAdapter._drainBucketsToBufferBestEffort`/`emergencyWithdraw` treat any non-reverting `moveToBuffer` call as a fully-completed drain, never re-checking the bucket's remaining LP — a partial redemption (normal under Ajna bucket utilization, and the expected outcome if Finding #3 is confirmed) is reported as a clean exit with `residualBuckets = 0` while capital remains stranded.** `ERC4626StrategyAdapter.sol:448-452`: `try ops.moveToBuffer(idx, lpAmount) { processed++; } catch { residualBuckets++; }` — no post-call read of `ops.bucketLp(idx)`. **[phase2, 3 of 12 agents]** Fix: re-read `bucketLp(idx)` after each call and count any nonzero remainder toward `residualBuckets`.

[50] **16. `CharmStrategy4626.emergencyWithdraw` can return/emit a nonzero `withdrawn` while transferring zero ASSET to the vault, when the Ajna debt repay consumes the entire post-Charm-exit balance.** `withdrawn` is set from the Charm-redeem branch at line 1257; it is only *conditionally* overwritten at line 1277 (`if (totalAsset > 0)`) after `_repayAjnaDebtWithAsset` runs — if that repay consumes the whole balance, `totalAsset == 0`, the transfer is skipped, and the stale pre-repay value is what gets returned and emitted. **[phase2, 1 agent, code-confirmed]** Fix: initialize `withdrawn = 0` and derive it only from the actual post-repay transferred amount.

[50] **17. `AjnaVaultAuth.setToll`/`setTax`'s 24h timelock is armed only by the first call ever, not by construction — a deployment left at the natural `toll=tax=0` default retains a permanent, un-timelocked, front-runnable fee lever (up to the 1000bps cap).** `tollArmed`/`taxArmed` default `false`; the constructor (`AjnaVaultAuth.sol:72-75`) sets only `admin`; `setToll`/`setTax` (lines 152-164, 177-188) take the instant, unguarded branch on `!tollArmed`/`!taxArmed`. Separately, `executeTollUpdate`/`executeTaxUpdate` (lines 166-175, 190-199) have no expiry once matured — a queued change can be held indefinitely and detonated in an attacker-chosen block. **[phase2-only, 5 of 12 agents independently, novel — not raised in phase 1, whose AC-3/General-9 found only the related expiry gap]** Fix: arm both flags in the constructor (taking initial values as constructor args); add an expiry window to the execute functions.

[50] **18. `ERC4626StrategyAdapter.setValuationGuard` accepts `maxIncreaseBps`/`maxDecreaseBps == 10_000`, which fully disables the drift guard it exists to enforce, contradicting the code's own stated purpose ("cannot self-disable, ODA-423-M07").** `if (maxIncreaseBps > 10_000 || maxDecreaseBps > 10_000) revert InvalidBps();` (line 553) admits exactly 10,000; `_allowedBpsForElapsedWindows` short-circuits `if (perWindowBps >= 10_000) return 10_000;` (line 602). **[phase2, 1 agent, code-confirmed]** Fix: bound both parameters strictly below 10,000 (e.g. `< 5_000`).

[50] **19. `AjnaERC4626Vault.move` calls `_trackBucket(toIndex)` before `_untrackBucketIfEmpty(fromIndex)` — a count-neutral bucket rotation reverts at exactly `MAX_BUCKETS = 50`, even though the untrack step immediately after would have freed the needed slot.** Lines 399-402. **[phase2, 1 agent, code-confirmed]** Fix: reorder to untrack the source before tracking the destination.

[50] **20. `CharmStrategy4626._resolveAjnaLimitIndex`'s borrow branch can return the unclamped sentinel index `0` with `ready = true`, silently disabling the Ajna borrow backstop (Ajna will reject index 0; the failure is swallowed by `_tryAjnaBorrow`'s catch).** Line 1159 is the only one of four return paths not routed through `_clampAjnaBucketIndex` (contrast lines 1147, 1161); `0` doubles as this same function's own "unavailable" sentinel elsewhere (line 1151). Triggered whenever `oracleBucket <= safetySteps` (`safetySteps = 50` at the default 125% collateral ratio). **[both — phase1 Lending-12/Math-2/General-20, phase2 boundary agent, 4 total]** Fix: route the borrow branch through `_clampAjnaBucketIndex`, or return `(0, false)` instead of `(0, true)`.

[50] **21. `CharmStrategy4626.isCharmInRange` fails open on read failure while every other unavailability path in the file fails closed, and a `slot0()`-specific revert inside the try body is not actually caught by the adjacent `catch`.** `catch { inRange = true; }` (line 849) is the sole fail-open default in the contract (contrast `_getPoolPriceTWAP`, `_getFreshAssetPrice`, `_getCharmExposure`, all fail-closed). Separately: `pool.slot0()` (line 833) sits inside the `try charmVault.pool()` success block rather than its own `try`, so a revert there propagates uncaught rather than being handled by the `catch` at line 848 — the function can both fail open *and* revert-brick `deposit()`/`_depositToCharmSafe()`, in different failure modes. Also: `currentTick >= lower && currentTick <= upper` (line 847) treats the upper boundary tick as in-range, when Uniswap V3 positions are half-open `[lower, upper)`. **[both — phase1 AMM-8/Oracle-7/General-5/General-19, phase2 3+ agents]** Fix: fail closed on any read failure; move `slot0()` into its own `try`; use `<` for the upper bound.

---

### Low / Info findings (condensed — confirmed patterns, lower individual impact)

- **One-step `Ownable`** (not `Ownable2Step`) on both `ERC4626StrategyAdapter` and `CharmStrategy4626`, inconsistent with `AjnaVaultAuth`'s deliberate two-step admin transfer. Loss of either owner key permanently strands bucket-management/oracle-repoint capability. `[both]`
- **Unbounded, unenumerated keeper set** (`AjnaVaultAuth.setKeeper`) can unilaterally drain all Ajna buckets to buffer (value-destructive via any early-withdrawal fee) with only the admin — not the adapter owner who bears the loss — able to revoke. `[phase1 AC-7]`
- **`AjnaVaultBuffer.totalAssets()`** is a raw `balanceOf` with no internal accounting and no `_decimalsOffset()` hardening on the parent vault — donations can trip the valuation drift guard or, pre-first-deposit, zero-share-brick the first allocation. `[both, 5+ agents]`
- **Hardcoded 18-decimal ASSET / 6-decimal USDC assumptions** with no runtime `decimals()` assertion, across ~10 scaling constants in `CharmStrategy4626` and in `AjnaERC4626Vault`'s Ajna WAD handling — silent mis-scaling if deployed against non-standard-decimal tokens. `[both, 9+ agents across both phases — the most-corroborated Low-severity item]`
- **Fee-on-transfer / deflationary ASSET hard-reverts** `AjnaERC4626Vault.deposit`/`mint` (assumes requested == delivered across a double-hop buffer transfer) and, if the fee activates mid-life, `withdraw`/`redeem` too, with no rescue path. `[both, 3+ agents]`
- **Floating `pragma solidity ^0.8.20`** across all six files — PUSH0 deployment risk on non-Shanghai chains given the codebase's explicit multi-lane/multi-chain reuse design.
- **`AjnaVaultAuth.retrieveFees`** documents a fee-sweep flow that cannot occur (fees route directly to `admin`, never through the `AjnaVaultAuth` contract itself) — currently inert but a documentation/code mismatch that could become live if a future change routes fees differently.
- **`CharmStrategy4626.rebalance()`**'s slippage-loss bound is per-call, not cumulative, with no cooldown — repeated calls can each individually satisfy the bound while compounding a large total drawdown.
- **`_repayAjnaDebtWithAsset`'s repay/collateral-pull coupling** (`CharmStrategy4626.sol:1100-1132`): a plausible mechanism (not independently confirmable from files in this repo) by which the stale locally-read debt figure vs. Ajna's live-accrued debt at execution time causes full-repay attempts to revert and be silently swallowed, compounding Finding #10.

---

## Leads

_Trails with concrete code smells where the full exploit path could not be completed to confidence ≥ 50 in this pass. Not scored; worth manual follow-up._

- **`CharmStrategy4626.getTotalAssets`** returns exactly `0` for both "Ajna debt state unreadable" and "any nonzero debt + stale oracle" (lines 437-448), and `_readAjnaDebtState` rounds debt **up** (`Math.Rounding.Ceil`, line 569), so a single wei of Ajna rounding residue makes the zero-return condition permanent. Several agents argue this is exploitable because the outer lane vault's `redeem`/`withdraw` path is *not* gated by `isValuationReady()` (only `deposit`/`mint`/`report` are) — letting real redemptions settle against a fabricated 100% loss. **This audit could not verify the outer-vault gating claim from files in `~/audits/519/repo/`** (the referenced `CreatorOVaultCoreModule` is out of scope) — flagged as a lead pending that verification, not a finding.
- **`AjnaERC4626Vault.maxRedeem`**'s share-decrement `while` loop (lines 199-203) is bounded to ~1-2 iterations under normal PPS, but could in principle run many iterations if PPS collapses far below 1 following a large loss (e.g., Finding #1/#2 realized) — potential gas-DoS on `redeem`, not independently constructed to a concrete trigger.
- **`CharmStrategy4626`/`ERC4626StrategyAdapter` harvest baselines** (`lastTotalAssets`) are incremented on deposit but never decremented on withdraw/emergencyWithdraw — plausible profit-suppression after any material exit, but no caller of `harvest()`'s return value was found within the in-scope files to confirm downstream impact.
- **Ajna deployment version drift**: this repo's `IAjnaPool.sol` declares a 3-argument `addQuoteToken`; if the actual target is a newer Ajna release with a 4-argument signature, every bucket deposit would revert on a selector mismatch. Unconfirmed — no deployment config or Ajna source is vendored in this repo to check against.
- **Router swap calls** use `deadline: block.timestamp` (a no-op — always satisfied by definition) and `sqrtPriceLimitX96: 0` (no in-pool price ceiling), removing a second layer of protection beyond the TWAP-derived `minOut` used throughout `CharmStrategy4626`'s swap helpers.

---

## Access-Control Inventory

| Role | Granted / Transferred | Unlocks |
|---|---|---|
| `ERC4626StrategyAdapter.owner` | `Ownable`, **one-step** | Bucket-move forwards, `setActive`, `setIdleBufferBps`, `setValuationGuard`, `rescueTokens` |
| `ERC4626StrategyAdapter.vault` | immutable, no transfer | `deposit`/`withdraw`/`emergencyWithdraw`/`harvest`/`rebalance` (`onlyVault`) |
| `AjnaVaultAuth.admin` | **two-step** (`transferAdmin`→`acceptAdmin`) | `setSwapper` (one-step, no timelock — Finding #6), `setKeeper`, `pause`/`unpause` (Finding #5), `setDepositCap`, `setBufferRatio`, `setToll`/`setTax` (Finding #17), `setMinBucketIndex`, `retrieveFees` |
| `AjnaVaultAuth.swapper` | one-step, non-zero enforced | `AjnaERC4626Vault.deposit`/`mint`/`withdraw`/`redeem`/`moveFromBuffer`/`move` |
| `AjnaVaultAuth.keepers` | admin-set allowlist, unbounded | `AjnaERC4626Vault.moveToBuffer` only |
| `AjnaVaultBuffer.vault` | immutable = deployer (the `AjnaERC4626Vault`) | `depositFromVault`/`withdrawToVault` |
| `CharmStrategy4626.owner` | `Ownable`, **one-step** | All config setters (incl. zero-validated `setSwapPool`, Finding #14), `ownerEmergencyWithdraw*`, shares `rebalance()` with `vault` |
| `CharmStrategy4626.vault` | immutable, no transfer | `deposit`/`withdraw`/`emergencyWithdraw`/`harvest`, shares `rebalance()` with `owner` |

**Unguarded (arbitrary caller, state-changing):** none with zero caller check. `AjnaVaultAuth.acceptAdmin()` is modifier-free but checks `msg.sender == pendingAdmin`; `CharmStrategy4626.rebalance()` is modifier-free but checks `owner()||vault` inline; `AjnaERC4626Vault`'s inherited ERC-20 share transfer functions are ungated by design.

## Threat Model (selected rows; findings above address the material ones)

| Actor | Reaches | Invariant that must hold |
|---|---|---|
| Any unprivileged depositor | Buy shares during a Finding #1/#2-triggered mispricing window | `lpToAssets` prices Ajna positions correctly — **does not hold** (Findings #1, #2) |
| Any unprivileged trader with flash-loan access | Manipulate Charm/Ajna swap pool spot price within one transaction | NAV and swap `minOut` derive from manipulation-resistant sources — **does not hold** (Findings #4, #9, #14) |
| `AjnaVaultAuth.admin` | `pause`, `setSwapper`, `setToll`/`setTax` | These levers cannot freeze user funds or extract value without notice — **does not hold** (Findings #5, #6, #17) |
| Any Ajna pool participant (third-party liquidator) | `bucketTake`/`arbTake` against a bucket the vault lends in | Collateral converted into the vault's bucket claim remains valued and recoverable — **does not hold** (Finding #2) |
| Lane vault (trusted, out of scope) | All `onlyVault` entrypoints | Standard trust assumption — invariant holds by construction (`onlyVault` correctly wired) |

---

## Coverage

Every privileged/value-moving entrypoint enumerated in the Phase-0 access-control inventory was examined by at least one Phase-1 domain agent and at least one Phase-2 attack agent (8 + 12 = 20 independent hunting passes over 6 files / 2,784 LOC). `Coverage: 8 privileged/value-moving contracts-worth of entrypoints in inventory, 8 addressed. Threat-catalog rows: all addressed by a finding above or by "examined, no issue" via the two phases' combined analysis. Holes closed this pass (Turn 3, first-time-examined): 0` — both phases independently reached full coverage; Turn 3 work was reconciliation and hybrid re-examination of phase-unique leads, not new-territory exploration.

---

> ⚠️ This review was performed by an autonomous AI audit pipeline (phase-0 context building + phase-1 breadth + phase-2 depth, both blind hunting phases reconciled in phase-3). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human review, a public bug bounty, and on-chain monitoring are strongly recommended before or alongside mainnet deployment at scale — particularly for Finding #3 (Ajna LP/quote-token unit semantics), which this audit could not settle without access to the deployed Ajna pool's actual bytecode, and for the "Charm sandwich" family (Findings #4, #9), which the client's own job description flags as a known design residual under active consideration.
