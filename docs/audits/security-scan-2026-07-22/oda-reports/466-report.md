# Security Review — Charm + Ajna ERC4626 Strategies

**Audit target** (6 files, ~2695 LOC):
- `contracts/shared/strategies/ERC4626StrategyAdapter.sol`
- `contracts/shared/strategies/univ3/CharmStrategy4626.sol`
- `contracts/shared/strategies/ajna/AjnaERC4626Vault.sol`
- `contracts/shared/strategies/ajna/AjnaVaultAuth.sol`
- `contracts/shared/strategies/ajna/AjnaVaultBuffer.sol`
- `contracts/shared/strategies/ajna/AjnaVaultLibrary.sol`

**Source of truth**: `github.com/4626fun/4626`, tag `audit/oda-2026-07-22`, commit `423e0e3a607884de6e60bccd06f722a8aba770ee`.

**Job scope note**: Per the client's brief, the audit target is the ERC4626 strategy adapters — a generic `ERC4626StrategyAdapter`, a Charm (Uniswap V3 managed-liquidity) strategy with an Ajna borrow backstop, and the Ajna-backed `AjnaERC4626Vault` (+ its `AjnaVaultAuth` role hub, `AjnaVaultBuffer` idle reserve, `AjnaVaultLibrary` math helper) that sits behind it. Requested focus areas: rescue/drain paths, valuation, withdraw realizability, fee/timelock, oracle coupling. The interfaces `IAjnaPool`, `IOracle4626`, `IStrategy` are referenced via a `@4626/` remapping and were **not vendored in this checkout** — several findings below are marked as depending on the deployed Ajna pool's exact ABI/field semantics, which could not be independently confirmed from this repo alone. The out-of-scope "lane vault" (`CreatorOVault`/`AgentOVault`) that calls these strategies was not re-examined.

**Methodology**: Three-phase review — (0) context building: a protocol map, access-control/rescue-path inventory, and threat catalog built by 3 parallel agents with no findings; (1) breadth: 7 domain-specialist agents (general, precision-math, ERC4626, DeFi-lending, DeFi-AMM, oracles, access-control) walking curated checklists; (2) depth: 12 attacker-mindset agents (9 single-specialty + 3 cross-lens gap-hunters), run **blind** to phase-1's findings (one agent's first attempt was invalidated by a tool-name collision and was successfully re-run), each independently reading the full source and the phase-0 map. All hunting agents ran on `opus` given the scope. This reconciliation cross-checks both phases' raw output against each other and against the phase-0 inventory/catalog.

**Confidence floor**: All findings Low+ are reported; items resting on an unconfirmed precondition (most commonly: the exact mechanics of the out-of-scope Ajna pool) are explicitly flagged as such within their own finding rather than silently omitted or silently promoted.

---

## Reconciliation summary

- **Overlap** (found independently by both phases, several by 5+ of the 12 blind agents): the two spot-valuation clusters (Charm composition, Ajna bucket ratio), the `rebalance()` sandwich, the `setCharmVault`/`setAjnaPool` approval bypass, and the `withdraw()` over-swap.
- **Phase-2-only, newly discovered and independently verified against source by the orchestrator**: an incoherent-NAV bug when the oracle is stale (zeroes collateral value but not debt), a deposit/harvest accounting bug (undeposited-principal-as-profit), a self-referential Charm withdraw slippage floor, an un-timelocked oracle rewire enabling a deposit-timing attack, and a valuation-guard bypass via PPS-truncation-to-zero.
- **Phase-1-only**: several Low findings (ownership hygiene, `getAllTokens`-style unbounded reads N/A here, fee-on-transfer assumptions, etc.)
- **Coverage**: `Entrypoints: ~40 external/public state-changing functions across 6 files, all examined by ≥1 domain agent and ≥1 blind attack agent. Threat-catalog rows: 6, 6 answered.`

**The single most important structural fact of this audit**: nearly every hunting agent, regardless of assigned specialty, independently converged on the same root defect from different angles — **both of the system's two "total assets" computations (`CharmStrategy4626.getTotalAssets()`'s Charm-composition leg, and `AjnaERC4626Vault.totalAssets()`'s Ajna-bucket leg) are unguarded, un-timelocked, single-block spot reads with no staleness, deviation, or TWAP defense, and both feed directly into the lane vault's user-facing share price.** This is the load-bearing risk of the entire system; every other Medium+ finding below is either a direct consequence of it or an independent, unrelated defect.

---

## Access-Control Inventory & Rescue-Path Summary (condensed)

- Two authority models: OZ `Ownable` (one-step, no timelock) in both strategies; `AjnaVaultAuth` role hub (admin two-step transfer, swapper/keeper one-step, 24h timelock on fee changes only).
- `ERC4626StrategyAdapter`'s only approval target is the immutable `ERC4626_VAULT` — verified safe (exact-amount approvals, reset to 0 on failure).
- **`CharmStrategy4626.setCharmVault`/`setAjnaPool` are owner-settable approval targets** — see Finding 3.
- `AjnaERC4626Vault` fully overrides ERC4626 `deposit/mint/withdraw/redeem` to be callable only by `AUTH.swapper()` — end users never interact with it directly; the adapter is effectively the sole shareholder.
- Rescue paths: `ERC4626StrategyAdapter.rescueTokens` (position shares always blocked; ASSET only to `vault` while inactive; other tokens to arbitrary `to`, unrestricted); `CharmStrategy4626.ownerEmergencyWithdraw`/`ownerEmergencyWithdrawFromCharm` (destination forced to `vault`; core tokens blocked while `active`, though `active` is owner-flippable immediately before rescuing — a speedbump, not a real barrier, but the vault-only destination lock independently contains the impact of that gap); `AjnaVaultAuth.retrieveFees` (verified to only ever sweep the Auth contract's own — normally empty — balance; user principal never sits there, so its NatSpec warning about not sweeping collateral is effectively moot).

---

## Findings

### [1] Both of the system's "total assets" computations are unguarded, single-block spot reads with no staleness/deviation/TWAP defense — the system-wide root risk
**Severity**: High
**Origin**: `[both]` — independently found and elevated to full FINDING status by an overwhelming majority of agents across both phases (ethskills: general, oracles ×2, defi-amm, defi-lending, erc4626; pashov: economic-security, first-principles, invariant [with a complete numeric proof], trust-gap, boundary, periphery).
**Location**: `CharmStrategy4626.getTotalAssets()`/`_getCharmExposure()` (lines 467-494, 518-559); `AjnaVaultLibrary.lpToAssets()` (41-48) consumed by `AjnaERC4626Vault.totalAssets()` (85-92).

**Description**: Two related but independent gaps feed the same class of downstream harm (mispriced lane-vault shares):

1. **Charm leg**: `_getCharmExposure()` splits the strategy's Charm inventory into ASSET/USDC using a **spot** read of `charmVault.getTotalAmounts()` — the code's own comments flag this as an accepted residual (ODA-423-M09). A flash-swap in the underlying Uniswap V3 pool shifts this composition within a block; since the shifted leg is then valued at the (unmoved) external oracle price, `getTotalAssets()` moves with the composition skew. Critically, the withdraw path is protected (`_realizableTotalAssets()` uses `min(oracle, TWAP)`), but the **deposit/mint-side** NAV read is not.
2. **Ajna leg**: `AjnaVaultLibrary.lpToAssets` computes bucket value as `lpAmount * bucketDeposit / bucketLpTotal`, reading both quantities live from `pool.bucketInfo()` with **zero staleness, deviation, or TWAP guard** — the sole valuation source for bucket positions, feeding directly into `AjnaERC4626Vault.convertToAssets()`/share price, which the adapter then reports upward as `getTotalAssets()` to the outer lane vault.

One pashov agent (invariant specialty) constructed a complete numeric proof of the extraction mechanism for the Ajna leg: with buffer=1000, one bucket at true value 1000, total=2000, supply=2000 shares, an attacker holding 1000 shares who can transiently inflate the bucket's reported value to 5000 (total→6000) can then `withdraw(1000)` — burning only 333 shares against the inflated NAV (`previewWithdraw` divides by the inflated total) while receiving the full 1000 real (buffer) assets. After the inflation reverts, the attacker holds 667 shares worth 400 more than their original stake, extracted directly from remaining holders. **The one load-bearing precondition this proof depends on — whether an Ajna bucket's `bucketDeposit/bucketLpTotal` ratio can actually be moved within a single transaction without proportional LP mint/burn — could not be confirmed from these 6 files** (the Ajna pool interface is not vendored in this checkout); one ERC4626-domain agent argued that ordinary permissionless `addQuoteToken`/`removeQuoteToken` on the same bucket move deposit and LP proportionally (ratio-neutral), which would mean the obvious "donation" path does not work — but interest accrual and liquidation-driven bucket state changes were not ruled out as alternative levers. Given this, the mechanism is High-confidence and the numeric proof of impact-given-the-precondition is exact, but the precondition itself is a Lead pending confirmation against the deployed Ajna pool.

**Proof of Concept**: See the numeric trace above for the Ajna leg (mechanism proven; triggering precondition unconfirmed). For the Charm leg: attacker flash-swaps the Charm/Uniswap V3 pool to shift ASSET/USDC composition, times a lane-vault deposit or withdrawal around the skewed `getTotalAssets()` read, then reverts the price — profit is bounded by the composition shift times the price divergence and the attacker's capital, and requires the out-of-scope lane vault to consult `getTotalAssets()` without its own independent bound (which the adapter and Charm strategy do not enforce on the deposit side).

**Recommendation**: For the Charm leg, reconstruct the position's token composition from the TWAP tick and position range (OracleLibrary-style) rather than trusting spot `getTotalAmounts()`, or bound spot composition against a TWAP-derived expected value and fail closed on deviation. For the Ajna leg, add a per-bucket cached exchange-rate with a per-block/per-window deviation cap (mirroring the adapter's own `_isWithinValuationBounds` pattern, which exists but is never applied to this input), and — most importantly — extend whatever guard is built to gate `getTotalAssets()`/deposits/withdrawals directly, not merely an advisory view.

---

### [2] `rebalance()` is vulnerable to a sandwich attack — the slippage guard is measured instantaneously in the same manipulated block and cannot detect the loss
**Severity**: High
**Origin**: `[both]` — ethskills-defi-amm; independently confirmed by pashov economic-security and flow-gap agents.
**Location**: `CharmStrategy4626.rebalance()`, lines 1285-1300.

**Description**: `rebalance()` (callable by `owner()` OR the immutable `vault`) calls `charmVault.rebalance()`, which burns the Charm/Uniswap-V3 position and re-mints liquidity centered on the pool's **current spot price**. The only protection is `require(totalAfter + maxLoss >= totalBefore)` where `maxLoss = totalBefore * depositSlippageBps / 10000` (5% default, cap 20%) and both values come from `getTotalAssets()` (Finding 1's unguarded input). This cannot detect a sandwich: it is measured inside the same block the price was manipulated in, so `totalAfter ≈ totalBefore` even at an attacker-pushed price — the real loss only materializes after the price reverts and the freshly re-centered position sits off-center. There is no calm-period/TWAP-deviation gate before triggering re-deployment — the same pattern behind the ~$1.2M Beefy CLM incident.

**Proof of Concept**: Attacker observes an owner/vault `rebalance()` tx in the mempool → front-runs with a flash-swap to push the Charm pool tick far from fair value → `rebalance()` executes and re-mints centered on the fake tick; the guard passes since both bounds see the manipulated spot → attacker back-runs to revert the price and captures the difference via arbitrage against the now-mispriced position.

**Recommendation**: Before calling `charmVault.rebalance()`, require the pool's spot tick to be within a bounded deviation of `_getPoolPriceTWAP(twapDuration)` (a calm-period check), and reject if the deviation exceeds a small fixed bound.

---

### [3] `setCharmVault`/`setAjnaPool` grant unlimited token approval to an owner-settable, unvalidated address — bypassing the "outflows to vault only" destination lock
**Severity**: Medium
**Origin**: `[both]` — ethskills-access-control; independently confirmed as a full FINDING by pashov access-control and asymmetry agents.
**Location**: `CharmStrategy4626.setCharmVault()` (229-242), `setAjnaPool()` (274-305).

**Description**: The strategy's documented design intent (evident from `ownerEmergencyWithdraw`'s hard-coded `to == vault` check) is that owner-triggered outflows can only reach the `vault`. That lock is bypassable: `setCharmVault(_charmVault)` performs **no validation** on `_charmVault` before granting `ASSET.forceApprove(_charmVault, type(uint256).max)` and the same for `USDC`. The owner can set `charmVault` to any address they control, which then holds an unlimited allowance and can `transferFrom` the strategy's idle ASSET/USDC to any destination — exactly what the vault-only destination lock elsewhere in the same file exists to prevent. `setAjnaPool` is a second, weaker vector (gated only by a trivially-satisfiable `quoteTokenAddress()==ASSET`/`collateralAddress()==USDC` check on the attacker's own stub contract). By contrast, `ERC4626StrategyAdapter` has no analogous hole (its only approval target is the immutable `ERC4626_VAULT`, with exact-amount, reset-on-failure approvals).

**Proof of Concept**: Owner calls `setCharmVault(attackerAddr)` → grants `attackerAddr` unlimited ASSET/USDC allowance with zero checks → from `attackerAddr`, owner calls `ASSET.transferFrom(strategy, anywhere, ASSET.balanceOf(strategy))` (and the same for USDC) — funds leave to `anywhere`, never touching `vault`, fully bypassing `ownerEmergencyWithdraw`'s destination lock. Additionally, `setCharmVault` (unlike its sibling `setAjnaPool`, which refuses to rewire while a position is open) has no open-position guard, so rewiring while the strategy holds Charm LP also silently strands that LP out of NAV and out of the normal redemption path.

**Recommendation**: Do not grant `type(uint256).max` to mutable, unvalidated addresses — approve exact per-operation amounts and reset to 0 after each op (as the adapter does), and/or restrict `charmVault`/`ajnaPool` rewiring to validated, code-bearing addresses behind a timelock, mirroring `setAjnaPool`'s open-position guard onto `setCharmVault` as well.

---

### [4] `getTotalAssets()` computes an incoherent NAV when the oracle is stale: it zeroes every USDC-denominated asset leg but still subtracts the full outstanding Ajna debt
**Severity**: Medium
**Origin**: `[phase2 only]` — pashov first-principles agent; independently verified by the orchestrator directly against source.
**Location**: `CharmStrategy4626.getTotalAssets()`, lines 467-494; `_usdcToAssetValue()`, 619-625.

**Description**:
```solidity
usdcInAsset = _usdcToAssetValue(idleUsdc + charmUsdc + ajnaState.collateralUsdc);
// ... grossAssetValue = idleAsset + charmAsset + usdcInAsset;
if (ajnaState.debtAsset >= grossAssetValue) return 0;
```
`_usdcToAssetValue` returns 0 whenever the oracle is not fresh (`!fresh`). So a stale oracle zeroes **every** USDC-denominated asset leg — idle USDC, the Charm position's USDC leg, and the USDC pledged as Ajna collateral — while `ajnaState.debtAsset` (the ASSET-denominated liability against that same collateral) is still subtracted in full. This is not a conservative "fail closed" — it is economically incoherent: it prices the loan but erases the collateral backing it. A healthy, well-over-collateralized position (e.g. 10,000 USDC collateral backing 5,000 ASSET debt at 125%+ ratio) reports NAV of exactly 0 the moment the oracle blips stale, even though nothing about the position's actual solvency changed. This is the number the outer lane vault reads for share pricing — `getTotalAssets()` is not itself gated by `isValuationReady()`.

**Proof of Concept**: Collateral 10,000 USDC backs 5,000 ASSET Ajna debt (healthy, ~125%+ ratio). Fresh oracle: NAV ≈ value(10,000 USDC) − 5,000 ≈ 5,000. Oracle blips stale (`isPriceFresh()` returns false, even momentarily): NAV = 0 − 5,000 → function returns 0. Share price computed off this number craters to zero for a healthy position, opening a mispricing/DoS window until the oracle recovers.

**Recommendation**: When the oracle is not fresh and Ajna debt is nonzero, fail closed *symmetrically* — either revert/signal "valuation unavailable" rather than returning a number, or exclude the debt subtraction proportionally to the zeroed collateral, rather than letting one economic side (assets) go stale-to-zero while the other (liabilities) stays at full value.

---

### [5] A deposit that lands while `isValuationReady()` is false skips updating the harvest baseline, so its principal is later reported as profit
**Severity**: Medium
**Origin**: `[phase2 only]` — pashov flow-gap agent; independently verified by the orchestrator directly against source.
**Location**: `CharmStrategy4626.deposit()` (lines 811-814), `harvest()` (lines 1268-1281).

**Description**:
```solidity
// deposit():
if (this.isValuationReady()) {
    lastTotalAssets = getTotalAssets();
}
```
```solidity
// harvest():
if (!this.isValuationReady()) { return 0; }
uint256 currentTotal = getTotalAssets();
if (currentTotal > lastTotalAssets) { profit = currentTotal - lastTotalAssets; }
lastTotalAssets = currentTotal;
```
`deposit()` pulls the deposited `amount` into the strategy (it enters `getTotalAssets()` immediately), but only updates the `lastTotalAssets` baseline **if** `isValuationReady()` returns true at that moment. If a deposit lands during a window where valuation is not ready (oracle momentarily stale, Ajna debt transiently exceeding `ajnaMaxDebt`, or collateral ratio transiently below the minimum — any of which `isValuationReady()` checks), the newly-deposited principal enters `getTotalAssets()` but is **not** folded into the baseline. The very next `harvest()` call that runs while valuation is ready then computes `profit = currentTotal - lastTotalAssets`, and that difference includes the un-baselined deposit — principal is reported as yield.

**Proof of Concept**: t0 (oracle fresh): `lastTotalAssets = 1000`. t1 (oracle momentarily stale): lane vault deposits 500 ASSET; `getTotalAssets()` is now 1500, but `isValuationReady()` returns false so `lastTotalAssets` stays at 1000. t2 (oracle fresh again): `harvest()` passes its readiness gate, computes `profit = 1500 - 1000 = 500` — exactly the deposited principal — and reports it as harvested profit.

**Recommendation**: In `deposit()`, always advance the baseline by the deposited principal (e.g. `lastTotalAssets += amount` unconditionally after a successful pull) rather than gating the update on `isValuationReady()`.

---

### [6] `_charmWithdrawMins`'s slippage floor is computed from the same spot composition it is checked against, providing no real protection against composition manipulation
**Severity**: Medium
**Origin**: `[phase2 only]` — pashov periphery agent (retry run).
**Location**: `CharmStrategy4626._charmWithdrawMins()` (1363-1374), also inlined in `withdraw()` (1030-1036).

**Description**: When redeeming Charm LP shares, the strategy computes a "don't accept less than this" floor as `expected = total * shares / totalShares` (from `charmVault.getTotalAmounts()` — a live, spot read) then `min = expected * (10000 - depositSlippageBps) / 10000`. But `charmVault.withdraw()` itself returns amounts derived from that **same** spot composition. So if a third party skews the Charm/Uniswap V3 pool's composition in the same block, both the computed floor and the actual returned amounts shift together — the min-check compares a manipulated value against a floor computed from the same manipulated value, and always passes. This applies to both the standard `withdraw()` path and, more critically, `emergencyWithdraw()`/`ownerEmergencyWithdrawFromCharm()`, neither of which have any independent price reference to fall back on.

**Proof of Concept**: An attacker skews the Charm pool's underlying Uniswap V3 composition so the position reports (say) 95% of its value in the currently-cheap token. `_charmWithdrawMins` computes `expected0`/`expected1` off that same skewed 95/5 split; `charmVault.withdraw()` returns exactly that skewed split; the `>= min` check trivially passes since both sides derive from the identical manipulated read. The strategy realizes the skewed (worse) token composition, with the loss borne by remaining lane-vault holders.

**Recommendation**: Derive `min0`/`min1` from a manipulation-resistant source — the same TWAP-priced expected value used in `_realizableTotalAssets`/`_usdcToAssetValueRealizable` — rather than from the live `getTotalAmounts()` split that the withdrawal itself will also return.

---

### [7] `CharmStrategy4626`'s Ajna borrower position has no health-maintenance or standalone repay/close path
**Severity**: Medium
**Origin**: `[phase1 only]` — ethskills defi-lending.
**Location**: `_tryAjnaBorrow()` (1113-1175), `_repayAjnaDebtWithAsset()` (1177-1212); absence of any owner/keeper repay-or-topup entrypoint.

**Description**: As a borrower, the strategy draws ASSET debt against USDC collateral in Ajna, with `ajnaMinCollateralRatioBps` (125% default) enforced only at draw time against the fresh oracle price. After the draw there is no monitoring or defensive action available — debt accrues interest continuously with zero repayment absent a deposit/emergency-withdraw event, and if ASSET appreciates relative to USDC the position's ratio degrades toward liquidation with no way for a keeper to proactively repay or top up collateral.

**Proof of Concept**: Enable `ajnaBorrowEnabled`; a withdrawal borrows ASSET against USDC at 125%; no further deposits occur; ASSET price rises and/or interest accrues; the position falls below Ajna's liquidation threshold; an Ajna kicker liquidates it, seizing USDC collateral at a penalty, with no code path to have intervened.

**Recommendation**: Add a permissioned `repayAjna(uint256)`/`addAjnaCollateral(uint256)` callable by owner/keeper, plus an off-chain-checkable health view.

---

### [8] `ERC4626StrategyAdapter.getTotalAssets()` marks illiquid target-vault claims at full spot value, while the target's `maxWithdraw` is deliberately buffer-only
**Severity**: Medium
**Origin**: `[phase1 only]` — ethskills erc4626.
**Location**: `ERC4626StrategyAdapter.getTotalAssets()` (186-197); interaction with `AjnaERC4626Vault.maxWithdraw()` (176-182).

**Description**: The adapter's `getTotalAssets()` = `idle + ERC4626_VAULT.convertToAssets(sharesHeld)`. For the intended Ajna target, `convertToAssets` reflects full NAV per Finding 1, but the target deliberately caps `maxWithdraw`/`maxRedeem` at buffer liquidity only (`isPartialWithdrawVault()==true`). The adapter never consults this signal and applies no liquidity haircut, so it reports a NAV to the outer lane vault that can materially exceed what it can actually deliver on demand — and `_withdrawFrom4626BestEffort` silently returns less than requested rather than reverting or surfacing the shortfall.

**Proof of Concept**: Target vault has buffer=100, buckets=900 → `convertToAssets(adapterShares)=1000`; adapter reports ~1000. A redemption for 500 routes to `adapter.withdraw(500)`; `_withdrawFrom4626BestEffort` is capped at `maxWithdraw≈100` → adapter silently returns `withdrawn≈100`, shorting the request by ~400 with no revert.

**Recommendation**: When the target reports `isPartialWithdrawVault()`, value only `min(convertToAssets(shares), maxWithdraw)` in `getTotalAssets()`, or have `withdraw()` revert (not silently short) when it cannot realize the requested amount.

---

### [9] Owner-configurable Uniswap TWAP window down to 60 seconds approaches spot-manipulability
**Severity**: Medium
**Origin**: `[phase1 only]` — ethskills oracles.
**Location**: `_getPoolPriceTWAP()` (644-671), `setTwapDuration()` (254-261), `MIN_TWAP_DURATION = 60`.

**Description**: `twapDuration` is owner-settable anywhere in `[60s, 1 day]`. At the 60s floor, a thin ASSET/USDC pool's TWAP is cheap to move — an attacker holds a displaced price for ~60s and the geometric-mean tick barely averages it out. This TWAP drives swap `minOut`, the realizable exit cap, and the Ajna auto-bucket-index suggestion, so a manipulated short-window TWAP weakens all three simultaneously.

**Recommendation**: Raise `MIN_TWAP_DURATION` to at least 1800s (the existing default) — there is no legitimate reason to allow 60s for a valuation/slippage oracle.

---

### [10] `setAssetOracle` is instant and un-timelocked — an oracle rewire produces an un-smoothed NAV jump an unprivileged depositor can back-run
**Severity**: Medium
**Origin**: `[phase2 only]` — pashov trust-gap agent.
**Location**: `CharmStrategy4626.setAssetOracle()` (248-252); `getTotalAssets()`'s oracle-priced USDC leg (467-494, 619-632).

**Description**: `AjnaVaultAuth` deliberately timelocks `toll`/`tax` changes 24h "so rewires cannot front-run flows" — but those fee parameters move NAV by at most ~10%. `setAssetOracle`, which can move the entire USDC leg of NAV with no bound and no delay, has no equivalent protection. `isValuationReady()` does not catch this either — it only checks the *new* oracle's self-reported freshness, never whether the price *source* changed; a newly-pointed oracle reporting a fresh-but-different price passes cleanly. Because `_realizableTotalAssets()` (the `min(oracle,TWAP)` conservative bound) only applies to the withdraw path, an oracle rewire's NAV jump on the deposit side is undefended, letting an unprivileged party time a deposit around a (even honest, routine) oracle migration to mint disproportionate shares at existing holders' expense.

**Proof of Concept**: Owner migrates `assetOracle` from a source reporting ASSET=$1.00 to one reporting ASSET=$0.90. In that block, the USDC leg's ASSET-denominated value jumps ~11%, producing a discrete, un-smoothed NAV move with no timelock and no drift guard. An attacker (or an MEV searcher watching the mempool for the `setAssetOracle` tx) deposits immediately after, minting shares against the now-favorable price.

**Recommendation**: Timelock `setAssetOracle` the same way `AjnaVaultAuth` timelocks fee changes, and/or route the deposit-side NAV through the same `min(oracle, TWAP)` conservative bound already used for exits.

---

### [11] `AjnaERC4626Vault.totalAssets()`/`lpToAssets` ignores Ajna bucket bankruptcy and the bucket's collateral leg, both of which can mis-state recoverable value
**Severity**: Medium
**Origin**: `[both]` — ethskills defi-lending, erc4626; independently corroborated by pashov invariant, first-principles.
**Location**: `AjnaVaultLibrary.lpToAssets()` (41-48).

**Description**: In addition to the general lack of any staleness/deviation guard (Finding 1), `lpToAssets` only accounts for a bucket's quote-deposit leg (`bucketDeposit`), discarding two Ajna-specific realities: (a) **bucket bankruptcy** — if a bucket takes bad debt beyond its collateral, Ajna marks it bankrupt and pre-bankruptcy LP becomes worthless, but the vault's stored `bucketLp[index]` is never reset or checked against a bankruptcy marker, so a subsequent lender re-seeding that bucket can make the vault's stale LP appear to claim a share of the *new* lender's deposit; (b) **collateral accrued during liquidation** — when a bucket's quote deposit is partially converted to collateral via a liquidation take, that value is invisible to `lpToAssets` (which reads only the deposit leg) and the vault has no `removeCollateral` call anywhere, so any such collateral is both unaccounted-for in NAV and permanently unrecoverable.

**Proof of Concept**: Lead-strength — full exploitability of the bankruptcy-overstatement path depends on Ajna pool internals not vendored in this repo, but the structural gap (no bankruptcy check, no collateral-leg accounting, no `removeCollateral` path) is confirmed directly from the in-scope code.

**Recommendation**: Read and honor the bucket's bankruptcy marker (value LP predating it at 0 and untrack); include the bucket's collateral leg pro-rata in valuation, or add a keeper-callable collateral-recovery path.

---

### [12] `withdraw()` swaps the entire idle USDC balance instead of only the shortfall, leaking value on every liquidity-constrained exit
**Severity**: Medium
**Origin**: `[both]` — ethskills defi-amm; independently elevated to a full FINDING by pashov execution-trace agent with a concrete numeric example.
**Location**: `CharmStrategy4626.withdraw()`, lines 1049-1055.

**Description**: When post-Charm-withdrawal ASSET is still short of the requested `amount`, the fallback swaps the **entire** idle USDC balance (`_swapUsdcToAssetSafe(totalUsdc)`), not just the deficit. Any idle USDC beyond what's needed is force-converted, paying pool fee + up to `swapSlippageBps` (3% default, cap 20%) on the unnecessary portion — a real, recurring loss borne by remaining shareholders, and it drifts the strategy composition so the next deposit must swap back (paying the spread twice).

**Proof of Concept**: Strategy holds 10,000 USDC idle plus a Charm position; a withdrawal's deficit after Charm redemption is only 100 USDC-worth of ASSET. The code swaps all 10,000 USDC, paying fee+slippage on the full 10,000 rather than ~100.

**Recommendation**: Compute the USDC required for the deficit via the TWAP, add a slippage buffer, and swap `min(that, totalUsdc)` instead of the entire balance.

---

## Leads / Info (lower-confidence or minor items — not scored as full findings)

- **`isValuationReady()`'s `currentAssetsPerShare == 0` sentinel conflates "no exposure" with "PPS truncated to 0 by `mulDiv` despite non-zero shares held."** With `sharesHeld=2e18` and `convertToAssets` returning 1 wei, the guard returns `true` (bypassing the drift check entirely) exactly when the underlying position has collapsed to near-worthless — the opposite of the intended fail-closed behavior. Gated on the out-of-scope lane vault actually consulting this view. `[pashov: numerical-gap]`
- **Ajna pool return values (`addQuoteToken`/`removeQuoteToken`/`moveQuoteToken`) are written directly into `bucketLp[]` with no independent balance-delta verification**, unlike `CharmStrategy4626._tryAjnaBorrow`, which measures real before/after deltas for the same class of pool interaction. Multiple agents additionally flagged a possible **unit mismatch**: `burnableLp()`/`move()` pass an LP-denominated amount as the first argument to `removeQuoteToken`/`moveQuoteToken`, which canonical Ajna documents as a quote-token-denominated `maxAmount_` — this could cause under/over-sized bucket removals whenever a bucket's LP:deposit exchange rate isn't 1:1. **This must be reconciled against the deployed Ajna pool's actual ABI before relying on this code**, since the interface isn't vendored in this repo. `[ethskills: general, defi-lending; pashov: economic-security, execution-trace, boundary]`
- **`move()` unconditionally tracks its destination bucket (`_trackBucket(toIndex)`) while its sibling `moveFromBuffer` gates the identical call on `mintedBucketLp > 0`.** If a move returns zero destination LP, an empty bucket permanently occupies a `MAX_BUCKETS` (50) slot with no cleanup path, eventually bricking further bucket moves via `MaxBucketsReached`. `[pashov: boundary]`
- **Best-effort Ajna repay can silently fail on Ajna's minimum-debt floor**, leaving debt (and, on emergency exit, USDC collateral) stranded with no standalone force-close function. `[ethskills: defi-lending]`
- **`AjnaVaultAuth.minBucketIndex` defaults to 0 (disabled)**, permitting deposits into the highest-price/highest-liquidation-risk Ajna buckets out of the box. `[ethskills: defi-lending]`
- **`getTotalAssets()` collapses to 0 (rather than degrading gracefully) when the Ajna pool read itself is unreadable** (distinct from Finding 4's stale-oracle case) — same class of mispricing risk. `[ethskills: defi-lending]`
- **`AjnaERC4626Vault`'s `max*`/`preview*` views are not wrapped in try/catch around `pool.bucketInfo()`**, so a reverting Ajna pool read cascades into a revert on views EIP-4626 requires to degrade gracefully. `[ethskills: erc4626]`
- **Adapter discards the shares returned by the target vault's `deposit()`** and unconditionally reports `deposited = amount`; if the target mints 0/dust shares, assets transfer with no proportional claim recorded. `[ethskills: erc4626]`
- **Adapter's withdraw fallback redeems the entire share balance** if `previewWithdraw` also reverts, over-liquidating the position for what may have been a small request (funds still go to the legitimate vault — a liquidity-management defect, not theft). `[ethskills: erc4626]`
- **Direct-transfer donation to `AjnaVaultBuffer` inflates `totalAssets()`** since buffer balance is read via raw `balanceOf`; donor cannot retract, so this is NAV-noise/griefing rather than a profit vector on its own. `[ethskills: general; pashov: math-precision]`
- **The adapter's valuation-drift snapshot is refreshed by the same operation it's meant to guard**, letting a manipulated PPS progressively become the trusted baseline across successive in-band windows; the guard also gates only the advisory `isValuationReady()` view, never `getTotalAssets()` or withdrawals. `[ethskills: general, oracles; pashov: invariant, trust-gap]`
- **`harvest()`/`rebalance()`/`emergencyWithdraw()` lack `nonReentrant`** in one or both strategies; independently traced by 4+ agents across both phases and confirmed **not exploitable** — every state-changing entrypoint is gated to `vault`/`owner`, which a substituted external dependency cannot satisfy. Recommended as defense-in-depth only.
- **`_resolveAjnaLimitIndex`'s "safety" adjustment moves the Ajna limit index in the *permissive* direction** (higher index = lower price = more permissive LUP limit) rather than the conservative direction the comment implies; impact bounded by the separate `ajnaMinCollateralRatioBps` pre-check. `[pashov: periphery]`
- **`_findBestFeeTier`'s auto-selection uses spot `liquidity()`**, griefable via JIT liquidity to route swaps through a disadvantageous tier; bounded to griefing since `minOut` still gates the fill and `autoFeeTier` is off by default. `[ethskills: defi-amm; pashov: periphery]`
- **Hardcoded decimal/scale assumptions** (ASSET=18dec, USDC=6dec, oracle price=1e18) throughout `CharmStrategy4626`'s USD conversions with no `decimals()` validation — internally consistent under the intended deployment convention, but silently wrong by orders of magnitude if ever violated; the same 18-decimal assumption may also be missing in `AjnaERC4626Vault`'s Ajna-WAD conversions (unlike Charm's explicit `USDC_TO_AJNA_WAD` handling), an inconsistency worth reconciling. `[ethskills: oracles, precision-math; pashov: math-precision, economic-security]`
- **Deposit range-gating (`isCharmInRange`) uses the same manipulable spot tick that feeds NAV**, allowing griefing (deferred deposits) but not fund loss. `[ethskills: defi-amm]`
- **One-step `Ownable`** in both strategies (vs. `AjnaVaultAuth`'s correct two-step admin transfer) — operator-error risk, not a hijack window. `[ethskills: access-control]`
- **Trust-critical dependencies (`charmVault`, `swapPool`, `assetOracle`, `ajnaPool`, `uniFactory`) are owner-repointable instantly with no timelock** beyond Finding 10's oracle case — compounds Finding 3's severity and independently reduces user reaction time. `[ethskills: access-control, general]`
- **Swap `deadline=block.timestamp` and `sqrtPriceLimitX96=0`** — the sole slippage defense is the TWAP-derived `amountOutMinimum`, confirmed never bypassable to 0 and hard-capped at 20%; acceptable given that bound, but worth tightening as defense-in-depth. `[ethskills: defi-amm; pashov: boundary]`
- **`maxSwapPercent` has no upper bound in `setParameters()`** — values >100 would attempt to swap more than the full ASSET balance; bounded in practice since the swap simply reverts-to-0 on an over-large input. `[ethskills: defi-amm]`

## Completeness

Every unique (Contract, function) flagged by any of the 3 phase-0 + 7 phase-1 + 13 phase-2 sub-agents appears above, either as a numbered finding or in the Leads/Info section. The central Phase-0 open question (whether buffer-only withdrawal vs. full-NAV pricing creates an extraction asymmetry in `AjnaERC4626Vault`) was resolved analytically: the mechanism is fair by construction **given an honest valuation input** — the entire residual risk is concentrated in Finding 1's unguarded spot valuations, exactly as the numeric proof under Finding 1 demonstrates.

> ⚠️ This review was performed by AI auditor agents. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Several findings here (1, 2, 6, and the Ajna-units Lead) depend on the exact behavior/interface of the out-of-scope Ajna pool and Charm vault contracts, and on how the out-of-scope lane vault consumes these strategies' `getTotalAssets()`/`isValuationReady()` — independent verification against the deployed Ajna/Charm contracts and the lane vault is strongly recommended to fully size the risk before mainnet reliance at scale.
