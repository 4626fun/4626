# Unified Security Audit Report — Job 424

**Target:** `CreatorGaugeController` (Base) — `contracts/creator/revenue/CreatorGaugeController.sol`
**Scope:** single file, 1276 lines; all interfaces inline. Base-only (`block.chainid == 8453`).
**Phase model:** Phase 1 = ethskills breadth (7 domains); Phase 2 = pashov depth (11 agents, ran blind to Phase 1). This document is the single hybrid reconciliation pass.

---

## Reconciliation Summary

**Overlap: 5 — Phase-1-only: 13 — Phase-2-only: 0 — Re-examined leads kept: 12, demoted: 1 — Coverage holes closed: 0**

- The two phases converged strongly. **Every Phase-2 finding overlapped a Phase-1 finding** (Phase 2 surfaced no net-new *finding*, though it independently corroborated the highest-value ones and added exploit detail). The fallback-slippage bug was reported by **1 Phase-1 domain group (5 domains) + 8 Phase-2 agents** — the single most-corroborated issue.
- Phase-1-only findings (jackpot-drain via `setLotteryManager`, all-or-nothing swap DoS, emergency-withdraw custody gaps, ownership hygiene, oracle sanity band / TWAP floor / zero-check) were each re-examined against quoted source; 12 kept, 1 (`payJackpot` zero-amount) demoted to a lead on confidence.
- **Completeness: 41 unique (Contract,function) across both phases, 41 covered.**
- **Coverage: 28 entrypoints in inventory, 28 addressed. 19 threat rows, 19 answered. Holes closed this pass: 0** (both phases touched every entrypoint at least as a note; the "examined, no issue" verdicts below are confirmations, not newly-opened gaps).

---

## Access-Control Inventory (from protocol map)

| Function | Guard(s) | Who | Value? |
|---|---|---|---|
| receiveFees (339) | nonReentrant; no auth | anyone | Y |
| deposit (364) | nonReentrant; no auth | anyone | Y |
| receiveBridgedFees (391) | nonReentrant; no auth | anyone | Y |
| receiveWETHFees (422) | nonReentrant; no auth | anyone | Y |
| receive() (461) | none (payable), NOT nonReentrant | anyone | Y |
| processWETHFees (475) | nonReentrant; tiered auth (owner/keeper full, others capped) | owner/keeper/anyone-capped | Y |
| distribute (627) | nonReentrant; no auth | anyone | Y |
| forceDistribute (638) | nonReentrant + onlyOwner | owner | Y |
| payJackpot (840) | nonReentrant; msg.sender==lotteryManager; amount<=reserve; winner!=0 | lotteryManager | Y |
| setVault…setDistributionInterval (874-1027) | onlyOwner (zero-checks vary) | owner | N |
| emergencyWithdraw (1216) | onlyOwner; ZeroAddress/ZeroAmount | owner | N (queue) |
| cancelEmergencyWithdraw (1227) | onlyOwner | owner | N |
| executeEmergencyWithdraw (1240) | onlyOwner; timelock + token-specific guards | owner | Y |
| transferOwnership / renounceOwnership | inherited OZ Ownable (ONE-STEP) | owner | N |

Roles: **owner** (all config, forceDistribute, uncapped WETH processing, timelocked emergency withdraw), **wethFeeKeeper** (uncapped WETH processing), **lotteryManager** (sole `payJackpot` caller), **creatorTreasury / protocolTreasury** (recipients). No pause, no Ownable2Step.

---

## Threat Model (each row answered)

| # | Actor → surface | Verdict |
|---|---|---|
| 1 | Anyone → receiveBridgedFees reclassify jackpot OFT | **Invariant holds** — sweep is `balance − accountedOFTBalance` (397-399); jackpot credits also bump `accountedOFTBalance` (664-666), so reserve is never swept. (But see **F4** for the *inverse*: un-swept bridged OFT vs emergency withdraw.) |
| 2 | Anyone → receiveFees/deposit balance-delta skew | **Invariant holds** — assumes honest non-reentrant `balanceOf`; shareOFT is trusted standard OFT (see Lead L2). |
| 3 | Anyone → receive() inflate pendingWETHFees | **Addressed by F6** (griefs WETH emergency withdraw). |
| 4 | Anyone (capped) → processWETHFees sandwich | **Addressed by F1** (fallback) + **F5** (partial-fill DoS); oracle-on path bounded ≤ swapSlippageBps. |
| 5 | Anyone → distribute timing/external calls | **Invariant holds** — nonReentrant + interval + value conservation; dust-distribute is interval-bounded (Lead L4). |
| 6 | MEV → _processWETHFees swap | **Addressed by F1** (fallback collapses both slippage layers) + **F14/F15** (TWAP floor / no sanity band). |
| 7 | Malicious lotteryManager → payJackpot drain | **Addressed by F2** — and the owner can *become* lotteryManager instantly. |
| 8 | Owner → executeEmergencyWithdraw drain | **Addressed by F3** (creatorCoin/vaultShares unguarded) + **F4** (un-swept bridged OFT). |
| 9 | Owner → forceDistribute timing bypass | **Invariant holds** — timing only, value conservation intact. |
| 10 | Owner → weaken slippage config | **Addressed by F1/F12/F13/F14/F15**. |
| 11 | Owner → setLotteryManager/setWethFeeKeeper reassign | **Addressed by F2** (lottery) ; keeper is de-escalation-only (examined, no issue). |
| 12 | Owner → setVault/setWrapper/setCreatorCoin repoint | **Addressed by F12** (no timelock); deeper wrapper/vault honesty is out-of-scope (Lead L3). |
| 13 | Malicious oracle → _calculateMinOutput | **Addressed by F15** (no sanity band). |
| 14 | Malicious wrapper → wrap/unwrap over-credit | **Lead L3** — out-of-scope dependency (`ICreatorOVaultWrapper`). |
| 15 | Malicious distributor → notifyRewards reenter | **Invariant holds** — try/catch, allowance-bounded ≤ toVoters, spent clamped (783). |
| 16 | Malicious vault → deposit over-report | **Lead L3** — out-of-scope dependency. |
| 17 | Fee-on-transfer/rebasing shareOFT → drift | **Lead L2** — outbound decrements by requested amount; depends on OFT being strict 1:1 (out of scope). |
| 18 | Attacker at deploy → pre-wiring interaction | **Invariant holds** — intake accrues, distribution/processing/payJackpot revert until deps set; chainid gated. Related liveness: **F8**. |
| 19 | Griefer → emergencyWithdraw re-queue timer reset | **Lead L5** — owner-self-grief only. |
| (+) | Reentrancy across value entrypoints | **Invariant holds** — nonReentrant on all value movers; state zeroed before external calls; receive() only wraps ETH (see F6). |

---

# Findings

## Medium

### M-1. Fallback swap minimum-output floor mixes WETH input units with creatorCoin output units, collapsing both slippage layers
- **Severity:** Medium
- **Category:** swap-slippage / decimal-mismatch
- **Origin:** [both] — Phase 1: evm-audit-general, precision-math, defi-amm, oracles, erc20; Phase 2: math-precision, economic-security, execution-trace, invariant, periphery, first-principles, boundary, numerical-gap, trust-gap
- **Location:** `_calculateMinOutput` lines 557-561; consumed at 504-509 (`_processWETHFees`) and 452 (`receiveWETHFees` auto-process)
- **Confidence:** 80

**Description.** When the oracle is disabled or unset, the swap floor is computed as a raw fraction of the WETH input, denominated in WETH, but used directly as `amountOutMinimum` (creatorCoin units) and as the basis for `sqrtPriceLimitX96`:
```solidity
557  if (!useOracleSlippage || address(oracle) == address(0)) {
558      if (fallbackMinOutputBps > 0) {
559          return (wethAmount * fallbackMinOutputBps) / MAX_BPS;
560      }
561      return 0;
```
No creatorCoin-per-WETH price and no decimal normalization is applied (contrast the oracle branch at 576: `Math.mulDiv(wethAmount, creatorPerEth, 1e18)`). The comment at line 139 states the incorrect assumption explicitly: *"90% of input value assumed 1:1 as floor."* Because the same value seeds `_sqrtPriceLimitX96` (509 → 608-610), **both** slippage layers fail together. For any creatorCoin priced well below ETH (the normal case) the floor is orders of magnitude below fair output → zero protection; if creatorCoin were priced above ETH / had fewer decimals, the floor is unreachable → every swap reverts (WETH processing DoS).

**PoC.**
1. Owner enables the fallback per its documented intent: `setFallbackMinOutputBps(9000)`, and oracle is disabled (`setOracleConfig(_,false)` or `setOracle(0)`). To make it permissionlessly triggerable, `maxPermissionlessWethProcess > 0`.
2. creatorCoin trades at 1 WETH = 1,000,000 creatorCoin (18 dec). `pendingWETHFees` includes 1 WETH.
3. `processWETHFees()` (or auto-process): `_calculateMinOutput(1e18) = 1e18*9000/10000 = 0.9e18` = 0.9 creatorCoin vs a fair ~1,000,000e18. `_sqrtPriceLimitX96(1e18, 0.9e18)` produces a ~1:1 price bound (or clamps to `MIN_SQRT_RATIO+1`) — no real bound.
4. An MEV bot front-runs to push the pool, the swap fills down to ~0.9 creatorCoin (passes `amountOutMinimum` at 529 and the exact-spend check at 536), bot back-runs, capturing ~100% of the WETH batch value.

**Recommendation.** Do not treat WETH raw units as a creatorCoin floor. Either:
- **Option A** (verbatim, majority): "remove the fallback and keep failing closed (leave fees pending) when the oracle is unavailable" — the default `fallbackMinOutputBps=0` already fails closed; delete `setFallbackMinOutputBps`.
- **Option B** (verbatim): "compute the fallback floor from an actual WETH→creatorCoin price with correct decimal conversion (e.g., a spot/TWAP quote scaled by creatorCoin decimals), never a raw bps of the WETH input" — and do not derive `sqrtPriceLimitX96` from the fallback value.

---

### M-2. Owner can drain the entire jackpot reserve instantly via `setLotteryManager` → `payJackpot`, bypassing the emergency-withdraw timelock and `JackpotReserveProtected` guard
- **Severity:** Medium
- **Category:** access-control / centralization
- **Origin:** [phase1: evm-audit-access-control]
- **Location:** `setLotteryManager` 895-899 + `payJackpot` 840-850; guard defeated at 1255
- **Confidence:** 75

**Description.** The contract deliberately protects jackpot custody from the owner: `executeEmergencyWithdraw` reverts `JackpotReserveProtected` while `jackpotReserve>0 || pendingFees>0` (1255) behind a 1-day timelock. But `setLotteryManager` (895) is an instant `onlyOwner` setter with only a zero-check, and `payJackpot` authorizes solely on `msg.sender == address(lotteryManager)` (841) and permits sending up to the full reserve to any nonzero `winner`:
```solidity
895  function setLotteryManager(address _lotteryManager) external onlyOwner {
896      if (_lotteryManager == address(0)) revert ZeroAddress();
...
841      if (msg.sender != address(lotteryManager)) revert OnlyLotteryManager();
842      if (amount > jackpotReserve) revert InsufficientJackpot();
843      if (winner == address(0)) revert ZeroAddress();
845      jackpotReserve -= amount;
847      shareOFT.safeTransfer(winner, amount);
```
So the owner, in two transactions with **zero delay**, sets `lotteryManager` to an address they control and calls `payJackpot(attacker, jackpotReserve)`, defeating I4/I5 and the entire emergency-withdraw protection. The 1-day timelock and `JackpotReserveProtected` give false assurance because a faster unguarded path to the same funds exists.

**PoC.** (1) owner `setLotteryManager(attackerEOA)` — instant. (2) from attackerEOA, `payJackpot(attackerEOA, jackpotReserve)` — all three checks pass, full reserve transferred. No timelock applies.

**Recommendation.** Subject `setLotteryManager` reassignment to the same queue+1-day-delay used for emergency withdrawal (or a 2-step handover), so watchers can react before jackpot-payout authority changes. Document that `lotteryManager` is a fully-trusted, funds-controlling role equivalent to owner.

---

### M-3. `sqrtPriceLimitX96` + strict exact-spend check make WETH swaps all-or-nothing, enabling sandwich-griefing / spurious DoS of the WETH fee path
- **Severity:** Medium
- **Category:** dos / defi-amm
- **Origin:** [phase1: evm-audit-dos] (corroborated as leads by Phase-2 math-precision, invariant, boundary, first-principles, numerical-gap)
- **Location:** `_processWETHFees` 509 (limit derivation), 516-532 (router call), 536 (revert)
- **Confidence:** 65

**Description.** `sqrtPriceLimitX96` is derived from the **average** acceptable price (`minAmountOut/amountIn`, 608-610), but Uniswap V3 treats it as a **marginal** stop price. For any swap with meaningful price impact, the marginal price crosses the derived limit before the full `amountIn` is consumed, producing a partial fill. Line 536 then reverts the whole call because consumption is not exact:
```solidity
535  uint256 wethAfter = IERC20(WETH).balanceOf(address(this));
536  if (wethAfter > wethBefore || wethBefore - wethAfter != wethAmount) revert SwapFailed();
```
This is fail-closed (no value loss — fees stay pending), but it is directly griefable: an MEV bot front-runs a permissionless `processWETHFees()` (when `maxPermissionlessWethProcess>0`) or an auto-processing `receiveWETHFees()`, nudges the pool price toward the derived limit so the full-amount swap would cross it, forcing the 536 revert, then back-runs to restore price. The public WETH→vault path can thereby be kept indefinitely unprocessable, stranding fees in `pendingWETHFees`. Owner/keeper can still process privately.

**PoC.** (1) `setWethProcessingConfig(cap>0, false)`. (2) WETH accrues. (3) attacker front-runs a `processWETHFees()` tx with a pool swap moving price so consuming full `wethAmount` crosses the limit; victim partial-fills; 536 reverts. (4) attacker back-runs to restore. Repeat per block.

**Recommendation.** Do not enforce full-input consumption when a `sqrtPriceLimitX96` is supplied. Either:
- **Option A** (verbatim): "drop the strict `wethBefore - wethAfter != wethAmount` equality … and rely on amountOutMinimum for slippage, accepting partial fills."
- **Option B** (verbatim): "pass sqrtPriceLimitX96 = 0 and rely solely on amountOutMinimum (oracle-derived) for slippage protection, which never partial-fills for exact-input."

---

## Low

### L-1. `executeEmergencyWithdraw` has no pending-balance protection for creatorCoin / vaultShares / any non-shareOFT-non-WETH token
- **Severity:** Low
- **Category:** access-control / centralization
- **Origin:** [phase1: evm-audit-access-control] (Phase-2 invariant-agent & access-control-agent noted balances are usually transient)
- **Location:** `executeEmergencyWithdraw` 1240-1274; guards only cover shareOFT (1255) and WETH (1271); everything else falls through to 1274
- **Confidence:** 60

**Description.** Only shareOFT and WETH are guarded. creatorCoin and vaultShares (swap output / burn intermediary) and any other token fall straight to `IERC20(token).safeTransfer(to, amount)` (1274) with `to` fully owner-controlled, after the 1-day delay. These balances are normally transient (consumed atomically inside `_processWETHFees`/`_distributeVaultShares`), so there is usually little standing to drain — hence Low — but dust, a partially-reverted step, or inbound transfers/airdrops are fully sweepable.

**Recommendation.** Whitelist withdrawable tokens, or extend pending-balance guards to creatorCoin/vaultShares, or at minimum document that all non-shareOFT/non-WETH balances are owner-drainable.

### L-2. `executeEmergencyWithdraw` can redirect un-swept bridged ShareOFT to the owner, bypassing the fee split
- **Severity:** Low
- **Category:** evm-audit-general / custody
- **Origin:** [phase1: evm-audit-general] (Phase-2 invariant-agent lead)
- **Location:** guard 1255-1264 vs bridged-sweep 391-402
- **Confidence:** 60

**Description.** The shareOFT guard blocks withdrawal only while `jackpotReserve>0 || pendingFees>0`. ShareOFT minted to this contract by LayerZero but **not yet swept** by `receiveBridgedFees()` is not reflected in `pendingFees`/`jackpotReserve`/`accountedOFTBalance`. At the normal resting state (`jackpotReserve==0 && pendingFees==0`), the owner can queue+execute `emergencyWithdraw(shareOFT, N, owner)`; the guard passes, `accountedOFTBalance` floors to 0 (1260-1263), and N transfers to the owner — funds that should have been swept and split 69/21.39/9.61. Mitigations: 1-day timelock, and anyone may front-run `receiveBridgedFees()` to fold the balance into `pendingFees` (re-arming the 1255 guard).

**Recommendation.** Fold un-accounted ShareOFT into `pendingFees` (invoke the bridged-sweep logic) at the start of `executeEmergencyWithdraw`, or base the shareOFT guard on real custody rather than tracked buckets only.

### L-3. Anyone can indefinitely block the owner's WETH `emergencyWithdraw` by donating dust ETH to `receive()`
- **Severity:** Low
- **Category:** dos / griefing
- **Origin:** [both] — Phase 1: evm-audit-dos; Phase 2: access-control, economic-security, boundary
- **Location:** `receive()` 461-470 (credits `pendingWETHFees += msg.value`, no delta, not nonReentrant); guard 1271-1272
- **Confidence:** 70

**Description.** `receive()` is permissionless and does `pendingWETHFees += msg.value` with no minimum, and `executeEmergencyWithdraw` reverts `PendingWethFeesProtected` whenever `token==WETH && pendingWETHFees>0`. A griefer front-runs the owner's post-timelock WETH withdrawal with 1 wei of ETH to force the revert. For pure-dust residuals, `_calculateMinOutput` can round to 0 (→ `MinOutputUnavailable`) so the dust is not reliably clearable. No theft (WETH stays in the contract); impact is blocking an owner-only rescue path.

**Recommendation.** Let the owner withdraw WETH in excess of `pendingWETHFees` (`amount <= WETH.balanceOf(this) - pendingWETHFees`), and/or track earmarked WETH via an explicit accounted counter mirroring `accountedOFTBalance`.

### L-4. Shared `lastDistribution` timer couples the WETH and OFT paths; WETH processing resets the OFT distribution interval
- **Severity:** Low
- **Category:** state-coupling / griefing
- **Origin:** [both] — Phase 1: evm-audit-general; Phase 2: asymmetry, boundary, flow-gap, first-principles, economic-security, trust-gap, periphery
- **Location:** writer `_distributeVaultShares` 694 (and `_distributeInternal` 658); readers 356/407/446/647
- **Confidence:** 75

**Description.** A single `lastDistribution` gates both fee streams. `_distributeVaultShares` (WETH path) writes `lastDistribution = block.timestamp` (694) with no interval gate of its own, while `_distribute()` reverts `TooSoon` on `block.timestamp < lastDistribution + distributionInterval` (647) and the auto-distribute checks read the same value (356/407). When permissionless WETH processing is enabled (`maxPermissionlessWethProcess>0`), an actor can cheaply fund `pendingWETHFees` (via `receive()`/`receiveWETHFees`) and call `processWETHFees()` each interval to keep resetting the OFT clock, indefinitely delaying permissionless `distribute()` and auto-distribution of OFT fees (jackpot funding, voter rewards, PPS burns). Even absent an attacker, normal WETH activity silently throttles OFT cadence. Funds stay safe as `pendingFees`; owner `forceDistribute()` bypasses the interval.

**Recommendation.** Use separate timestamps (`lastOftDistribution`, `lastWethProcess`), each gated on its own timer; do not have the WETH path write the timer that gates OFT distribution.

### L-5. Auto-distribution inside permissionless fee intake reverts if a distribution dependency is unset/reverting, potentially bricking the intake (buy-fee) path
- **Severity:** Low
- **Category:** dos / liveness
- **Origin:** [phase1: evm-audit-dos] (Phase-2 periphery lead)
- **Location:** `receiveFees` 356-357 / `receiveBridgedFees` 407-408 → `_distributeInternal` 652 → `_burnShareOftSlice` 760-768 / `_wrapVaultSharesToShareOft` 752-757
- **Confidence:** 55

**Description.** `receiveFees()`/`receiveBridgedFees()` auto-invoke `_distribute()` once `pendingFees ≥ distributionThreshold` and the interval elapsed. `_distributeInternal` only checks `vault` is set (653); it then unconditionally calls `_burnShareOftSlice`, which reverts `WrapperNotSet` if the wrapper is unset (762) and bubbles any revert from `wrapper.unwrap` / `vault.burnSharesForPriceIncrease` / `vault.pricePerShare` (none in try/catch, unlike the voter path). During the init window where `vault` is set but `wrapper` is not (or a temporarily reverting dep), every `receiveFees()` at/above threshold reverts. Since `receiveFees()` is the documented hook called by `CreatorShareOFT` on buy-fee collection, this can propagate into and block the buy flow unless the caller wraps it in try/catch. `deposit()` (never auto-distributes) is unaffected. Config/dependency-failure DoS (deps are owner-set/trusted), hence Low.

**Recommendation.** Decouple auto-distribution from intake: wrap the auto-`_distribute()` in try/catch (as done for the voter distributor), gate auto-distribution on all required deps (wrapper + vault) being set, or move distribution to a keeper flow.

### L-6. WETH auto-process gate compares a WETH balance against an OFT-denominated threshold (`distributionThreshold / 10`)
- **Severity:** Low
- **Category:** units-mismatch
- **Origin:** [both] — Phase 1: evm-audit-general/precision-math (Info); Phase 2: asymmetry, trust-gap, numerical-gap
- **Location:** `receiveWETHFees` 445
- **Confidence:** 60

**Description.** `pendingWETHFees >= distributionThreshold / 10` gates WETH auto-processing, but `distributionThreshold` (default `100e18`) is ShareOFT-denominated and used for OFT distribution, while `pendingWETHFees` is WETH. The two have no guaranteed price relationship, so the WETH trigger is coupled to an unrelated OFT config (default fires at 10 WETH, likely far from intended). Also, if `distributionThreshold < 10`, integer division yields 0, making the size gate always true (any dust triggers an auto-processed public swap, subject to `cap>0` and `minOut>0`). Impact limited: auto-process is off by default.

**Recommendation.** Introduce a dedicated WETH-denominated `wethProcessingThreshold` instead of deriving from `distributionThreshold/10`.

### L-7. One-step ownership transfer (Ownable, not Ownable2Step) risks permanent admin lockout
- **Severity:** Low
- **Category:** access-control
- **Origin:** [phase1: evm-audit-access-control] (Phase-2 access-control-agent lead)
- **Location:** line 71 (`is Ownable`); `transferOwnership` inherited, not overridden
- **Confidence:** 80

**Description.** The contract uses OZ `Ownable`, so `transferOwnership` is a single-step immediate transfer with no acceptance step. Given how much is owner-gated (every dependency address, swap/oracle config, thresholds, keeper, `forceDistribute`, the emergency lifecycle), a mistyped/uncontrollable target permanently strands all administration (permissionless intake/`payJackpot` survive).

**Recommendation.** Adopt `Ownable2Step`.

### L-8. `renounceOwnership` is not disabled; renouncing permanently bricks configuration and emergency response
- **Severity:** Low
- **Category:** access-control
- **Origin:** [phase1: evm-audit-access-control]
- **Location:** line 71 (`is Ownable`); `renounceOwnership` inherited, not overridden
- **Confidence:** 78

**Description.** `renounceOwnership()` sets `owner()==address(0)`, after which all `onlyOwner` paths (`setVault`, `setOracle*`, `setWethProcessingConfig`, `forceDistribute`, the entire emergency-withdraw flow) revert forever with no recovery. The contract cannot operate correctly without an owner.

**Recommendation.** Override `renounceOwnership()` to revert.

### L-9. Economically-sensitive setters have no timelock (unlike `emergencyWithdraw`), enabling instant repointing of oracle/vault/wrapper/slippage
- **Severity:** Low
- **Category:** access-control / centralization
- **Origin:** [phase1: evm-audit-access-control]
- **Location:** `setOracle` 971, `setSwapConfig` 936, `setVault` 874, `setWrapper` 885, `setCreatorCoin` 925, `setve4626VoterRewardsDistributor` 1007
- **Confidence:** 58

**Description.** The contract timelocks `emergencyWithdraw` (1 day) yet leaves all value-sensitive setters instant. In a single block the owner can set `oracle=0` (no zero-check), widen `swapSlippageBps` to 10%, or repoint `vault`/`wrapper`/`creatorCoin` to attacker contracts, then trigger a swap/distribution — with no window for watchers to react. Combined with permissionless `processWETHFees`/`distribute`, this is a same-block value-extraction surface gated only by owner honesty.

**Recommendation.** Route oracle/vault/wrapper/creatorCoin/swap-config changes through the same queue+delay as emergency withdrawal.

### L-10. `setOracle` lacks a zero-address check
- **Severity:** Low
- **Category:** oracles / access-control
- **Origin:** [phase1: evm-audit-oracles] (Phase-2 access-control-agent lead)
- **Location:** `setOracle` 971-974
- **Confidence:** 62

**Description.** Unlike `setVault`/`setWrapper`/etc., `setOracle` writes with no zero-check. `setOracle(0)` routes `_calculateMinOutput` to the fallback branch (557). With default `fallbackMinOutputBps==0` this fails closed (swaps revert `MinOutputUnavailable`), but if `fallbackMinOutputBps>0` was previously set, zeroing the oracle silently downgrades to the broken 1:1 fallback (see M-1) with no signal.

**Recommendation.** Add `if (_oracle == address(0)) revert ZeroAddress();`, or if disabling is intended, require `useOracleSlippage=false` and `fallbackMinOutputBps==0` at the same time.

### L-11. Oracle TWAP window is owner-configurable down to 60 seconds, enabling cheap TWAP manipulation on low-liquidity creator pools
- **Severity:** Low
- **Category:** oracles
- **Origin:** [phase1: evm-audit-oracles]
- **Location:** `setOracleConfig` 981-986 (`require(_twapDuration >= 60 && _twapDuration <= 7200)`); consumed at 572
- **Confidence:** 52

**Description.** `oracleTwapDuration` may be as low as 60s. It feeds `oracle.getAssetEthTWAP` (572), the sole price source for `amountOutMinimum` and the derived `sqrtPriceLimitX96`. On Base (~2s blocks) a 60s window is ~30 observations; on a low-liquidity creator pool an attacker can skew the TWAP over a few blocks and then satisfy a mis-priced `minOut`. Default is a safer 1800s, but the 60s floor is a live misconfiguration hazard with no liquidity-tied lower bound.

**Recommendation.** Raise the enforced minimum TWAP duration (e.g. ≥ 900-1800s), or scale it with pool liquidity; document the minimum-liquidity assumption.

### L-12. No sanity/deviation band on nonzero oracle price; an anomalous reading under-protects or DoSes swaps
- **Severity:** Low
- **Category:** oracles
- **Origin:** [phase1: evm-audit-oracles]
- **Location:** `_calculateMinOutput` 571-583
- **Confidence:** 50

**Description.** Any nonzero `creatorPerEth` from `getAssetEthTWAP` is used directly (only freshness + nonzero are checked); there is no min/max band and no secondary source. An abnormally low-but-nonzero price makes `minOut` too small (swap can be sandwiched with no revert/alert); an abnormally high price makes `minOut` exceed achievable output (every swap reverts, fees stuck). Distinct from M-1 (that is a unit bug in the fallback; this is the absence of a plausibility band on the primary path). Note: this shares the `_calculateMinOutput` function with M-1 but is a separate defect and is kept separate per dedup rules.

**Recommendation.** Add a configurable min/max plausibility band (or max deviation vs a previous accepted price) before deriving `minOut`; consider a secondary source.

---

## Info

### I-1. Unreachable second `pendingFees` guard in `executeEmergencyWithdraw`
- **Origin:** [both] — Phase 1: evm-audit-general/access-control; Phase 2: asymmetry, execution-trace, invariant, periphery, first-principles, boundary, access-control
- **Location:** 1258-1259
- **Confidence:** 90

For `token == shareOFT`, line 1255 already reverts `JackpotReserveProtected` whenever `pendingFees > 0`, so the `if (pendingFees > 0) revert PendingOftFeesProtected();` at 1259 can never execute. Harmless dead branch. Remove line 1259, or restructure 1255 to key only on `jackpotReserve` if the two guards were meant to differ (matches Open Question 8).

### I-2. `ve4626GaugeVoting` is stored/settable but never read — dead dependency
- **Origin:** [phase1: evm-audit-general]
- **Location:** decl 143, setter 998-1001; no read path anywhere
- **Confidence:** 85

The interface is fully declared and `setve4626GaugeVoting` exists, but no logic reads `ve4626GaugeVoting`. This can mislead integrators/monitors about what governs distribution. Remove it, or document that it is off-chain metadata only (matches Open Question 3).

### I-3. Dead creator-reroute and protocolTreasury-fallback branches (constant `creatorShareBps==0`, `protocolTreasury` always nonzero)
- **Origin:** [phase2: invariant-agent]
- **Location:** creator reroute 672-678 / 716-724; jackpot fallbacks 794-798, 807-811, 816-819
- **Confidence:** 75

`creatorShareBps` is a compile-time `0`, so `toCreator`/`toCreatorVs` are always 0 and the creator branches never execute. The constructor (308) and `setProtocolTreasury` (916) both enforce `protocolTreasury != 0`, so the `protocolTreasury==0` jackpot-fallback branches in `_routeVoterShareOft` are also dead. Not a vulnerability; noted as maintainer-confusing surface. Also `_distributeVaultShares` emits `FeesDistributed` with `toCreatorVs` still nonzero after reroute (738) — cosmetic event inaccuracy, moot since always 0.

---

## Leads (confidence < 50, or out-of-scope dependency)

- **L-a. `payJackpot` accepts `amount == 0`** — [phase1: evm-audit-erc20], `payJackpot` 840-850, confidence 45. Only `amount > jackpotReserve` (842) and `winner==0` (843) are checked; `amount==0` reaches `shareOFT.safeTransfer(winner, 0)` (847), which reverts on tokens that reject zero-value transfers and otherwise emits a `JackpotPaid(winner,0)` for no value. Caller-gated to the trusted lotteryManager and degenerate → demoted from finding to lead. Fix: early-return / revert on `amount==0` for consistency with the other intake paths.

- **L-b. Outbound shareOFT accounting assumes strict 1:1 (fee-on-transfer/rebasing drift)** — [phase1 & phase2 leads], 670/847/792/805/810/819/1274 vs intake 343-345. Intake uses balance-delta but all outbound paths decrement `jackpotReserve`/`accountedOFTBalance` by the *requested* amount. A fee-on-transfer or rebasing-down OFT would drift accounting above real balance → later `payJackpot`/emergency revert or under-deliver. Depends on the out-of-scope ShareOFT (LayerZero OFT) being strictly 1:1 (Open Question 6). Verify no transfer fee / rebase / reentrant hooks on the token.

- **L-c. Wrapper wrap/unwrap and vault deposit returns trusted with no reconciliation** — [phase1 & phase2 leads], 705-709/717-723/757/765 (wrapper), 542 (vault). `jackpotReserve`/`accountedOFTBalance`/`totalSharesBurned` and downstream share splits are credited directly from external return values with no balance-delta check (unlike intake). An over-reporting wrapper/vault inflates `jackpotReserve` above real shareOFT balance (→ later `payJackpot` reverts) or misstates splits. Out-of-scope deps (`ICreatorOVaultWrapper`, `ICreatorOVault`) — Open Questions 1, 2.

- **L-d. Oracle scaling/decimals assumption** — [phase1 & phase2 leads], 575-576, 1167. `expectedOut = mulDiv(wethAmount, creatorPerEth, 1e18)` hardcodes 1e18 and assumes `getAssetEthTWAP` returns creatorCoin-per-ETH already baking creatorCoin's decimals. If creatorCoin is non-18-decimal or the oracle scales differently, `minOut` (and `sqrtPriceLimitX96`) are mis-scaled. `IOracle4626` implementation is out of scope (Open Question 5).

- **L-e. `emergencyWithdraw` re-queue resets the 1-day timer with no "already pending" guard** — [phase1 & phase2 leads], 1216-1225. Re-queuing overwrites the pending slot and resets `pendingEmergencyWithdrawAt`. Owner-only self-grief; a watcher relying on a stable `executeAfter` could be surprised. Not third-party exploitable.

- **L-f. `distribute()` permits dust distributions (no threshold check)** — [phase2: access-control-agent], 627-647. Unlike auto-distribute, permissionless `distribute()` enforces only `pendingFees!=0` + interval, so anyone can force a tiny distribution once per interval, rounding sub-wei slices into burn. Interval-bounded, no fund loss.

- **L-g. `previewSwap` returns (0,0,false) when oracle inactive, not the enforced fallback `minOut`** — [phase2: numerical-gap], 1153-1173. Off-chain monitors reading `previewSwap` see "no protection" while on-chain swaps proceed under the (broken) fallback of M-1. Monitoring accuracy only.

---

## "Examined, no issue" (entrypoint coverage confirmations)

- **deposit (364):** identical accounting to `receiveFees` minus auto-distribute; no auto-distribute means L-5 does not apply. No issue.
- **distribute (627) / forceDistribute (638):** nonReentrant + interval (or owner); value conservation holds regardless of caller/timing. See L-f for dust-timing lead.
- **setCreatorTreasury (905):** may be 0 only while `creatorShareBps>0` is false (constant 0), guarded by `CreatorTreasuryRequired`. No issue.
- **setProtocolTreasury (915):** zero-address guarded. No issue.
- **setWethFeeKeeper (947):** no zero-check is intentional (0 disables keeper); keeper only grants uncapped WETH processing, not custody. De-escalation. No issue.
- **setWethProcessingConfig (958):** enables the permissionless/auto paths that feed M-1/M-3/L-4; the setter itself is owner-only and correct.
- **setve4626VoterRewardsDistributor (1007):** no zero-check, but unset/failing distributor is handled by the treasury/jackpot fallbacks in `_routeVoterShareOft`. No issue.
- **setDistributionThreshold (1016) / setDistributionInterval (1025):** owner config; threshold feeds L-6, interval feeds L-4, but the setters are correct.
- **cancelEmergencyWithdraw (1227):** clears all four pending slots; guarded by `NoPendingEmergencyWithdraw`. No issue.
- **constructor (304):** chainid + BPS-sum asserts, zero-checks on shareOFT/protocolTreasury. No issue.
