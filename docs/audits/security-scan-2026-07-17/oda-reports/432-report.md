# Security Review — CreatorGaugeController

**Audit date**: 2026-07-18
**Methodology**: Two-phase audit v2 (context → ethskills breadth → pashov depth, blind → hybrid reconciliation)
**Target**: Solidity source bundle supplied by client (`https://litter.catbox.moe/8q3r8g.md`), NOT `github.com/wenakita/CreatorVault` (explicitly out of scope per client instructions).

## Scope

| | |
|---|---|
| **File reviewed** | `contracts/creator/revenue/CreatorGaugeController.sol` (1276 LOC) |
| **Out of scope (referenced, not audited)** | `ICreatorOVault`, `ICreatorOVaultWrapper`, `ILotteryManager4626`, `ISwapRouter` (hardcoded Uniswap V3 router on Base), `Ive4626GaugeVoting`, `Ive4626VoterRewardsDistributor`, `IOracle4626` |
| **Solidity version** | ^0.8.20 |
| **Chain** | Base only (chain-id asserted at construction) |

This contract is a per-creator "trade fee collector": it receives ShareOFT (■, a LayerZero-bridged token) buy-fees and WETH fees from a Uniswap v4 tax hook, splits both by fixed basis-point constants (burn 9.61% / lottery 69% / creator 0%, dormant / voters 21.39%) into a jackpot reserve, a ve4626 voter-rewards lane, and a vault-share burn. The WETH path additionally swaps WETH→CreatorCoin via Uniswap V3 (oracle-TWAP-bounded slippage), deposits into the vault, then applies the same split to the resulting vault shares. The source shows extensive prior audit remediation (`FIX:` tags referencing G-11, G-12, G-19, G-24, H-03, L-01, L-03, L-4, M01/M-02, S-C02) — this engagement ran fully fresh per its instructions; every finding below comes from this job's own phase-0 map and independent phase-1/phase-2 agent runs.

## Methodology summary

- **Phase 0 (context, opus)**: 3 parallel agents built an access-control inventory, protocol/storage map, and external-surface map.
- **Phase 1 (breadth, opus)**: 7 domain checklist agents (general, precision-math, erc20, defi-amm, oracles, access-control, dos).
- **Phase 2 (depth, opus, blind to phase-1)**: 12 pashov attack-specialty agent runs.
- **Phase 3 (reconciliation)**: cross-phase dedup, hybrid re-examination, and orchestrator source verification of every claim promoted to a Finding.

**Headline result**: no fund-theft path was found by any of the 19 total agent runs across both phases. The contract's central accounting invariant — `accountedOFTBalance == pendingFees + jackpotReserve`, which backs every jackpot payout via `payJackpot` — was independently, exhaustively traced by 6+ separate phase-2 agents and confirmed sound by every one of them. This is unusually strong convergent verification and materially raises confidence in the accounting core, contingent on the out-of-scope wrapper/vault/token behaving 1:1 (see Open Questions).

**Reconciliation summary**: 5 issues found independently in both phases (overlap, all with 2-8x cross-agent corroboration) · 2 phase-1-only issues · 2 phase-2-only issues (both new mechanisms, orchestrator-verified) · Coverage holes closed this pass: 0.

---

## Access-Control Inventory (summary)

| Role | Grant / Revoke | Key powers |
|---|---|---|
| **Owner** | OZ `Ownable`, 1-step transfer/renounce | All config setters, `forceDistribute`, emergency-withdraw lifecycle, and — critically — `setLotteryManager` |
| **lotteryManager** | `setLotteryManager` (onlyOwner, only a zero-address check, **no timelock**) | Sole caller of `payJackpot`; controls all jackpot outflow |
| **wethFeeKeeper** | `setWethFeeKeeper` (onlyOwner) | Uncapped WETH batch processing alongside owner |

**Permissionless entrypoints** (gated by amount/threshold/time, not role): `receiveFees`, `deposit`, `receiveBridgedFees`, `receiveWETHFees`, `receive()` (payable — the sole state-changing entrypoint lacking `nonReentrant`, confirmed by multiple independent agents to be non-exploitable since its only external call targets trusted, callback-free canonical WETH), `distribute()`, `processWETHFees()` (amount capped for non-privileged callers).

---

## Threat Model (summary)

| Actor | Reaches | Could gain | Status |
|---|---|---|---|
| Owner (compromised or self-serving) | `setLotteryManager` → `payJackpot` | Instantly drain the full jackpot reserve, bypassing the deliberate 1-day `JackpotReserveProtected` timelock | **Addressed by Finding 1 (Medium)** |
| Owner (during an oracle outage) | `setOracle(0)`/`useOracleSlippage=false` + `setFallbackMinOutputBps` | Enable a swap-slippage floor that provides near-zero real protection | **Addressed by Finding 2 (Medium)** |
| Any caller (when permissionless WETH processing enabled) | `processWETHFees` repeatedly | Stall permissionless OFT distribution via a shared timer | **Addressed by Finding 3 (Low-Medium)** |
| Any caller | Large WETH batch through `_processWETHFees` | Trigger a spurious revert even at an acceptable average execution price | **Addressed by Finding 4 (Low-Medium)** |
| N/A (extreme/unrealistic price ratio) | `_sqrtPriceLimitX96`'s Q192 computation | Permanently lock pending WETH fees | **Addressed by Finding 5 (Low)** |
| lotteryManager (fully trusted role) | `payJackpot` | Size payouts arbitrarily up to reserve | **Trust boundary by design — no bug; the reserve itself was independently verified always fully backed by 6+ agents** |
| Malicious/compromised out-of-scope wrapper, vault, oracle, or voter-distributor | Various | Corrupt `accountedOFTBalance`/`jackpotReserve` accounting, or brick distribution | **Cannot be verified in this scope — see Open Questions** |
| Any caller | `receive()` (missing `nonReentrant`) | Reenter during ETH intake | **Invariant holds — independently confirmed non-exploitable by 6+ agents; only external call targets trusted, callback-free canonical WETH** |

---

## Findings

### [1] Owner can bypass the deliberate jackpot-custody timelock via `setLotteryManager`
**Severity**: Medium | **Confidence**: 90 | **Origin**: `[both]` — independently found by phase-1's access-control checklist and re-derived blind by 2 phase-2 pashov agents (access-control, trust-gap). Orchestrator-verified directly against source twice.

**Location**: `setLotteryManager()` — `contracts/creator/revenue/CreatorGaugeController.sol:895-899`; `payJackpot()` — same file, `:840-850`; contrast the deliberate protection at `executeEmergencyWithdraw()` `:1254-1257`

```solidity
function setLotteryManager(address _lotteryManager) external onlyOwner {
    if (_lotteryManager == address(0)) revert ZeroAddress();
    lotteryManager = ILotteryManager4626(_lotteryManager);
    emit LotteryManagerSet(_lotteryManager);
}
```
```solidity
function payJackpot(address winner, uint256 amount) external nonReentrant {
    if (msg.sender != address(lotteryManager)) revert OnlyLotteryManager();
    if (amount > jackpotReserve) revert InsufficientJackpot();
    if (winner == address(0)) revert ZeroAddress();
    jackpotReserve -= amount;
    accountedOFTBalance -= amount;
    shareOFT.safeTransfer(winner, amount);
    emit JackpotPaid(winner, amount);
}
```

**Description**: `executeEmergencyWithdraw` deliberately protects the jackpot reserve — a comment tagged `FIX: AUDIT-2026-07-01-M01` explicitly states the intent "block jackpot custody drain while reserves remain" — reverting (`JackpotReserveProtected`) whenever an owner attempts to withdraw `shareOFT` while `jackpotReserve > 0 || pendingFees > 0`, on top of a mandatory 1-day (`EMERGENCY_WITHDRAW_DELAY`) timelock. `setLotteryManager` completely undermines this design intent: it is a plain `onlyOwner` setter with only a non-zero-address check — no timelock, no 2-step confirmation, no restriction against the owner naming itself or a self-controlled address. Since `payJackpot`'s only gates are `msg.sender == lotteryManager` and `amount <= jackpotReserve`, the owner can instantly become the lottery manager and drain the entire reserve in the very next transaction — a strictly easier, faster, and completely unprotected route to the exact funds the M01 fix was built to lock down.

**Proof of Concept**: `jackpotReserve = R > 0`. Owner calls `setLotteryManager(attackerControlled)` — succeeds instantly. `attackerControlled` calls `payJackpot(attacker, R)` — passes all checks, transfers the full `R` shareOFT immediately. The 1-day timelock and `JackpotReserveProtected` guard on the parallel `emergencyWithdraw` path are never invoked and provide no protection against this route.

**Recommendation**: Route `setLotteryManager` through the same timelock discipline as `emergencyWithdraw` (queue the new manager, apply only after `EMERGENCY_WITHDRAW_DELAY`), and/or add a per-payout rate limit to `payJackpot` so a freshly-installed manager cannot atomically drain the full reserve.

---

### [2] Fallback slippage floor treats WETH and CreatorCoin as 1:1 by value — provides near-zero real protection
**Severity**: Medium | **Confidence**: 85 | **Origin**: `[both]` — phase-1's oracles (ORACLE-2) and general (GEN-1) checklists, independently re-derived and escalated with concrete extraction math by phase-2's economic-security agent, further corroborated by 4 additional phase-2 agents (6 of 19 total agent runs).

**Location**: `_calculateMinOutput()` fallback branch — `contracts/creator/revenue/CreatorGaugeController.sol:557-561`; the source's own comment at `:138-139` documents the flawed assumption

```solidity
// FIX: G-12 — fallback minimum output percentage when oracle is disabled/unavailable
// Expressed in bps (e.g., 9000 = 90% of input value assumed 1:1 as floor)
uint256 public fallbackMinOutputBps = 0;
...
if (!useOracleSlippage || address(oracle) == address(0)) {
    if (fallbackMinOutputBps > 0) {
        return (wethAmount * fallbackMinOutputBps) / MAX_BPS;
    }
    return 0;
}
```

**Description**: When the oracle is disabled or unset — precisely the "oracle outage" scenario this fallback was built (`FIX: G-12`) to survive — the minimum acceptable swap output is computed as a percentage of the raw WETH *input* amount, then used directly as `amountOutMinimum` for the CreatorCoin *output*. This equates one wei of WETH with one raw unit of CreatorCoin — a valid assumption only if CreatorCoin trades near 1:1 with ETH, which it structurally cannot for a creator memecoin. For a coin priced at ~1e-6 ETH (a realistic order of magnitude), a `fallbackMinOutputBps=9000` ("90% protection") floor computes to roughly 0.9 tokens against a true expected output on the order of 1,000,000 tokens — a shortfall of over 99.9999% of intended protection. Because the secondary `sqrtPriceLimitX96` guard is derived from this same broken `minOut` value, both slippage defenses degrade in lockstep, leaving the swap fully exposed to sandwich extraction while the owner may believe protection is active.

**Proof of Concept**: Owner sets `useOracleSlippage=false` (or the oracle becomes unavailable) and configures `fallbackMinOutputBps=9000` believing this provides 90% slippage protection. WETH fees accumulate and `processWETHFees()` is called (permissionlessly, by a keeper, or by the owner). `_calculateMinOutput` returns `0.9 * wethAmount` in CreatorCoin raw units — negligible relative to true output. An MEV actor sandwiches the swap: front-runs to depress the pool price, lets the victim's swap fill at just above the near-zero floor, back-runs to restore price and capture the difference — extracting close to the full value of the WETH batch.

**Recommendation**: Derive the fallback floor from an actual price reference (a stored last-known oracle rate, or a manually-configured `fallbackCreatorPerEth` rate applied with correct decimal scaling), not directly from the WETH input amount. If no trustworthy price source is available during an outage, prefer leaving fees pending (fail-closed, the current default behavior when `fallbackMinOutputBps=0`) over offering a floor that is silently meaningless.

---

### [3] Shared `lastDistribution` timer couples the OFT and WETH distribution lanes
**Severity**: Low-Medium | **Confidence**: 90 | **Origin**: `[both]` — phase-1's dos checklist (DOS-2), independently re-derived by 8 of 12 phase-2 agents (asymmetry, execution-trace, invariant, periphery, boundary, first-principles, numerical-gap, flow-gap) — the single most cross-corroborated observation in this audit besides the accounting-soundness confirmation. Orchestrator-verified directly against source.

**Location**: Single `lastDistribution` variable (`contracts/creator/revenue/CreatorGaugeController.sol:177`), written by both `_distributeInternal()` (`:658`, OFT lane) and `_distributeVaultShares()` (`:694`, WETH lane); read by both lanes' auto-trigger gates (`:356`, `:407`, `:446`) and `_distribute`'s `TooSoon` check (`:647`)

**Description**: One shared timestamp gates two functionally-independent fee lanes (ShareOFT intake/distribution and WETH intake/processing/distribution). When permissionless WETH processing is enabled (`maxPermissionlessWethProcess > 0`, off by default), a caller can repeatedly trigger `processWETHFees()` to keep bumping `lastDistribution` forward every block, indefinitely suppressing the OFT lane's permissionless `distribute()`/auto-distribution (which reverts `TooSoon`) — bounded by the owner's `forceDistribute()` escape hatch (funds are delayed, not lost) and by the griefer's own real WETH cost per round. Even absent malicious intent, ordinary WETH traffic delays OFT distribution and vice versa. Despite exhaustive attempts by multiple phase-2 agents specifically hunting for a value-extraction extension of this coupling, none was found — it remains purely a liveness/timing issue.

**Recommendation**: Use two independent timestamps, one per lane, so processing one fee stream cannot delay the other's distribution window.

---

### [4] `sqrtPriceLimitX96` enforces a marginal-price bound while `amountOutMinimum` enforces an average-price bound — the mismatch causes spurious reverts on legitimately-priced swaps
**Severity**: Low-Medium | **Confidence**: 80 | **Origin**: `[phase2]` — periphery and flow-gap agents independently derived the same mechanism; orchestrator-verified directly against source.

**Location**: `_processWETHFees()` — `contracts/creator/revenue/CreatorGaugeController.sol:534-536` (exact-spend check), combined with the `sqrtPriceLimitX96` parameter at `:530`

```solidity
uint256 creatorCoinReceived = ISwapRouter(SWAP_ROUTER).exactInputSingle(
    ISwapRouter.ExactInputSingleParams({
        ..., amountOutMinimum: minAmountOut, sqrtPriceLimitX96: sqrtPriceLimitX96
    })
);
uint256 wethAfter = IERC20(WETH).balanceOf(address(this));
if (wethAfter > wethBefore || wethBefore - wethAfter != wethAmount) revert SwapFailed();
```

**Description**: `amountOutMinimum` is an average-execution-price floor over the entire swap — the router guarantees total output meets this bar for the full `amountIn` spent. `sqrtPriceLimitX96`, by contrast, is a *marginal* (final-tick) price wall: when the pool's price reaches this bound mid-swap, Uniswap V3 stops trading and returns a **partial fill** — it does not revert on its own. This contract's own exact-spend check (line 536) then unconditionally reverts the entire transaction whenever the swap did not consume the full `wethAmount`, i.e. whenever the price-limit guard bound. Since both `amountOutMinimum` and `sqrtPriceLimitX96` derive from the same underlying oracle-TWAP value at roughly the same slippage-tolerance level, any WETH batch whose price impact exceeds `swapSlippageBps` (default 1%) — a realistic outcome for a large accumulated batch against a modest-depth pool — will partial-fill and then hard-revert, even though the average execution price actually achieved was within the intended tolerance. This is a real, structurally-present mechanism (not requiring an extreme or unrealistic price ratio, unlike Finding 5 below).

**Recommendation**: Either stop hard-reverting on a partial fill (accept and correctly account for the actual amount spent/received instead), or derive the `sqrtPriceLimitX96` bound more loosely than `amountOutMinimum` so the marginal-price wall is never tighter than the average-price floor for the same nominal slippage tolerance.

---

### [5] `_sqrtPriceLimitX96`'s Q192 pre-scale can overflow at extreme price ratios, combining with the emergency-withdraw pending-WETH block to create a genuine fund lock
**Severity**: Low | **Confidence**: 70 (contingent on out-of-scope creator-coin pricing — see caveat) | **Origin**: `[both]` — phase-1's precision-math checklist (MATH-1), independently re-derived by 6 of 12 phase-2 agents (math-precision, economic-security, boundary, periphery, first-principles, numerical-gap). Orchestrator-verified the mechanism and the compounding interaction directly against source.

**Location**: `_sqrtPriceLimitX96()` — `contracts/creator/revenue/CreatorGaugeController.sol:593-617` (the `Math.mulDiv(..., Q192, ...)` calls); compounds with `executeEmergencyWithdraw()`'s `PendingWethFeesProtected` guard at `:1271-1273`

**Description**: `Math.mulDiv` reverts if its true result doesn't fit in 256 bits. Since `Q192 = 2^192`, the price-ratio scaling used here (`minAmountOut * Q192 / amountIn` or its inverse) overflows whenever the underlying token-price ratio exceeds roughly `2^64`. For an 18-decimal creator coin, this corresponds to a price of roughly 5.4e-20 ETH or lower (or, in the inverse token-ordering case, an implausibly *high*-priced coin) — outside typical creator-memecoin ranges but not impossible for a sufficiently micro-cap or newly-launched token. Because `_sqrtPriceLimitX96` is called unconditionally inside `_processWETHFees` with no fallback, hitting this overflow permanently reverts every attempt to process WETH fees for that specific coin. Critically, this is not merely a liveness pause: `executeEmergencyWithdraw` refuses to release WETH while `pendingWETHFees > 0`, and since the processing path that would drain `pendingWETHFees` is itself permanently broken, the accumulated WETH becomes genuinely locked with no in-scope recovery path short of an owner-initiated code fix or redeployment.

**Recommendation**: Compute the sqrt price ratio using Uniswap's own decomposed method (`sqrt(minAmountOut) * 2^96 / sqrt(amountIn)`) to avoid the 2^192 pre-scale's overflow ceiling, or clamp to `MIN_SQRT_RATIO`/`MAX_SQRT_RATIO` on an overflow condition instead of allowing the call to revert.

---

## Additional Low/Info findings

- **Fee-on-transfer `creatorCoin` can permanently trap `pendingWETHFees`** (Medium, confidence 70, phase-1 ERC20-1) — `_processWETHFees` trusts the swap router's returned `amountOut` verbatim (no balance-delta check on the CreatorCoin leg, unlike the WETH leg), so a fee-on-transfer `creatorCoin` (owner-configurable) causes `vault.deposit`'s internal transfer to revert every time, permanently bricking WETH processing — with the same `PendingWethFeesProtected` compounding effect as Finding 5.
- **`receiveWETHFees`'s auto-process threshold reuses an OFT-denominated constant for a WETH comparison** (Info, confidence 85, source-verified, corroborated by 4 phase-2 agents) — line 445: `pendingWETHFees >= distributionThreshold / 10`, where `distributionThreshold` is documented as "100 OFT tokens." Errs toward a higher (safer) effective threshold, not lower — a correctness/naming nuisance, gated behind `autoProcessWethFees` (off by default).
- **`swapFeeTier` accepts any `uint24` with no validation against real Uniswap tiers** (Low, confidence 80, phase-1 GEN-4/AMM-1, corroborated by 3 phase-2 agents) — owner-misconfiguration footgun; self-correcting, no fund loss.
- **Owner uses 1-step `transferOwnership`/`renounceOwnership`** (Low, confidence 85, phase-1 AC-4) — standard OZ pattern; weighted by the fact owner's real leverage is `setLotteryManager` (Finding 1).
- **`executeEmergencyWithdraw` does not protect `vaultShares`/`creatorCoin` residuals** (Low, confidence 75, phase-1 GEN-3/AC-2, corroborated by 2 phase-2 agents) — bounded by both tokens being structurally expected to be fully disposed within each call; contingent on out-of-scope wrapper/vault exactness.
- **`previewSwap` omits the `isPriceFresh()` gate the real swap path enforces** (Info, confidence 80, phase-1 ORACLE-4, corroborated by numerical-gap) — view-only mismatch, no on-chain consumer identified.

## Leads (unconfirmed, confidence < 50 — not asserted as findings)

- **`_routeVoterShareOft` double-count edge case**: if a non-standard voter-rewards distributor both pulls its full allowance and pushes tokens back into the contract within the same `notifyRewards` call, the balance-delta reconciliation could compute zero "spent" and double-pay the remainder. Requires a distributor that is simultaneously owner-trusted and adversarially non-standard.
- **`executeEmergencyWithdraw` can drain bridged-but-unswept shareOFT** — LayerZero-minted tokens not yet swept via `receiveBridgedFees` into `pendingFees` aren't covered by the jackpot-reserve check. Mitigated by permissionless sweeping during the 1-day timelock window.
- **Reverting distribution can DoS fee intake itself** (phase-1 DOS-1, corroborated by phase-2 first-principles/asymmetry) — a hostile/reverting out-of-scope vault or wrapper could brick `receiveFees` itself, but no attacker-controlled trigger for such a revert was found by any agent.
- **Oracle/creatorCoin decimal-scaling assumption in the primary (non-fallback) `_calculateMinOutput` path** — `expectedOut = mulDiv(wethAmount, creatorPerEth, 1e18)` assumes 18-decimal CreatorCoin and a matching oracle scale; cannot be verified without the out-of-scope oracle implementation.

## Open Questions (cannot be resolved within this engagement's scope)

1. **Do `wrapper.wrap()`/`wrapper.unwrap()` and `vault.deposit()` return exact 1:1 amounts?** This is the sole remaining assumption underlying the otherwise-verified-sound `accountedOFTBalance`/`jackpotReserve` accounting invariant — every agent that checked found the in-scope arithmetic clean, but all outbound wrapper/vault return values are trusted verbatim with no balance-delta check (unlike the delta-hardened inbound intake).
2. **What decimal/scale convention does `IOracle4626.getAssetEthTWAP` use, and how many decimals does the deployed CreatorCoin have?** Directly determines whether the primary (oracle-enabled) slippage floor is correctly scaled.
3. **Does the ShareOFT contract propagate a `receiveFees` revert up into the token's own buy-fee-collection flow?** Determines the real-world severity of the reverting-distribution-DoS lead.

---

## Coverage Gate

- **Entrypoints**: ~40 external/public functions identified in the phase-0 inventory; every privileged/value-moving entrypoint maps to a finding above or an explicit "invariant holds" note in the Threat Model.
- **Threat-catalog rows**: 8 rows synthesized in phase 0; every row is addressed by a finding or explicitly marked resolved/invariant-holds above.
- **Coverage holes closed this pass (K)**: 0 — both phases' combined coverage, cross-checked by the orchestrator against source, already answered every entrypoint and threat-catalog row.
- **Re-examined leads** (confirmatory source re-reads performed during reconciliation): the `setLotteryManager`/`payJackpot` bypass, the `fallbackMinOutputBps` comment, the `_calculateMinOutput` fallback branch, the shared `lastDistribution` write/read sites, the exact-spend/`sqrtPriceLimitX96` interaction, and the WETH-threshold unit mismatch were all independently verified by the orchestrator directly against source before inclusion above.

---

> ⚠️ This review was performed primarily by AI agents (three-phase methodology: automated context-building, breadth checklist review, and depth attack-specialty review) with orchestrator verification of every promoted finding against source. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human review and on-chain monitoring are recommended, particularly for the findings gated on out-of-scope modules (vault, wrapper, oracle, lottery manager, voter-rewards distributor) that this engagement could not audit.
