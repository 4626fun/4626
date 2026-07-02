# Security Audit Report: 4626 Creator OVault & Ecosystem Contracts

**Date:** 2026-07-01  
**Auditor:** Senior smart contract security auditor (simulated Trail of Bits / OpenZeppelin / PeckShield style review)  
**Scope:** All `.sol` files under `/contracts` (implementation, libraries, interfaces where relevant to logic; excluded pure generated test mirrors and `tamago/test/`). Submodules in `lib/` (liquidity-launcher, CCA) noted only where directly integrated. ~60+ source files reviewed via full reads, targeted greps, control-flow analysis, and pattern checks for the required security classes.

**Solidity Version:** 0.8.30 (foundry.toml; cancun EVM, via-ir, optimizer). No pre-0.8 arithmetic issues. Most files use `^0.8.20` or exact `0.8.30`.

**Tooling Context (build note):** Full `forge build` + tests not runnable in this isolated shell due to missing `node_modules`, incomplete submodules, and external deps (OpenZeppelin, LayerZero, Uniswap v4, Ajna, etc.). Analysis is static + deep manual review of source. Recommend full `forge test`, `forge build --sizes`, Slither, and the repo's `scripts/security-audit-local.sh` + invariant/fuzz suites as follow-up.

---

## Contracts Analyzed and Purpose

**ERC-4626 Vault Core (synchronous yield-bearing vault for Creator Coins):**
- `CreatorOVault.sol` (main entrypoint, ~2228 LOC): ERC4626 + Ownable + ReentrancyGuard + EIP712 + IERC20Permit. Heavy logic moved to delegatecall modules to stay under EIP-170. Tracks `coinBalance`, strategy debt, profit unlocking, impairment side-pockets, flash/MEV protections (block delays, queues, price caps), operator permits, protocol rescue.
- Modules: `CreatorOVaultCoreModule.sol` (ERC4626 overrides, report, profit unlock, impairment, deposits/withdraws, PPS guards), `CreatorOVaultStrategiesModule.sol` (add/remove, deploy/tend/rebalance, withdraw queue, debt tracking), `CreatorOVaultAdminModule.sol`, `CreatorOVaultModuleBase.sol` + `CreatorOVaultModuleStorage.sol`, `ICreatorOVaultModuleIdentity.sol`.
- `CreatorOVaultWrapper.sol`: Normalization (1:1 UX over 10^3 offset), wrap/unwrap, per-user cooldowns.
- `CreatorOImpairmentClaims.sol` (ERC1155 claims for side-pocket), `CreatorORecoveryEscrow.sol`, `CreatorOVaultLiquidityLib.sol`, `CreatorOVaultFactory.sol`.

**Yield Strategies (plugged into vault via weights; implement `IStrategy`/`IStrategyValuation`):**
- `CCALaunchStrategy.sol` (+ `CCALaunchStrategyConfigModule`, `CCALaunchStrategyEncodingHelper`): Continuous Clearing Auction launch strategy (phase-aware).
- Ajna: `AjnaERC4626Vault.sol` (inner 4626 + capped buckets), `AjnaVaultAuth.sol`, `AjnaVaultBuffer.sol`, `AjnaVaultLibrary.sol`.
- `ERC4626StrategyAdapter.sol`.
- Univ3: `CreatorCharmStrategy.sol`.
- Univ4: `ConcentratedStrategy.sol`, `FullRangeStrategy.sol`, `LimitOrderStrategy.sol`, `CreatorLPManager.sol`, `ApprovedV4HooksRegistry.sol`.
- Solana: `SolanaStrategy.sol` (remote NAV + base liquidity buffer + rebalance), `SolanaBridgeStrategy.sol`.
- `LBPStrategyWithTaxHook.sol`.

**Cross-Chain / Messaging / Bridge:**
- `CreatorShareOFT.sol` (OFT + custom lottery entry / winner callback msgs + buy fees + SwapOnly detection).
- `OVaultHubComposer.sol`, `SolanaBridgeAdapter.sol`.
- Related: `OFTBootstrapRegistry.sol`.

**Oracle:**
- `CreatorOracle.sol`: Uniswap V4 TWAP (hub) + Chainlink ETH/USD + LZ broadcast to remotes. Tick caps, staleness, deviation guards, initialize caps.

**Lottery (shared hub-centric on Base):**
- `CreatorLotteryManager.sol` (~2593 LOC) + inline `CreatorLotteryManagerAdminModule`: Cross-chain (LZ) entry processing, VRF (local + spoke), win chance (trade size + ve boost + gauge voting), jackpot payout across vaults (capped iterations + cursor), sponsorship/rate limits, callbacks.
- VRF/Randomness: `CreatorVRFConsumerV2_5.sol`, `ChainlinkVRFIntegratorV2_5.sol`, `ChainlinkVRFAdapter.sol`, `RandomnessRouter.sol`, `DrandRandomnessSource.sol`, `EIP2537Probe.sol`, `IRandomnessSource.sol`.
- ZK: `LotteryAmoeRouter.sol`, `AmoePlonkVerifier.sol`, `IAmoePlonkVerifier.sol`.

**ve(3,3) / Governance / Gauges / Bribes:**
- `ve4626.sol`: Vote-escrow locks (one lock, duration 7d–4y), ERC20Votes + Permit.
- `ve4626BoostManager.sol`: Coverage-scaled lottery boost (holding period, timelock params).
- `VaultGaugeVoting.sol`: Directs fixed probability budget (PPM) to vaults (epoch, weights, caps).
- `CreatorGaugeController.sol`: Fee splitter (burn 21.39%, lottery 69%, protocol 9.61%, creator 0% default), jackpot custodian, WETH fee processing + swaps.
- `VoterRewardsDistributor.sol`, `BribeDepot.sol`, `BribesFactory.sol`, `VaultRolePolicyManager.sol`.

**Deployment / Infra / Factories (highly privileged orchestration):**
- `DeploymentBatcher.sol` (~2366 LOC) + `DeploymentBatcherPhase1Module` / `Phase2Module` / `Phase3Helper` / `UniV4Helper` / `UtilsHelper`: Phased CREATE2 deployment of vault + wrapper + OFT + gauge + strategies + activation + Solana mesh. Uses bytecode store.
- Other batchers: `StrategyDeploymentBatcher.sol`, `VaultActivationBatcher.sol`, `VaultAuxiliaryDeployBatcher.sol`, `StrategyDeploymentFactories.sol`, `RouteCoherenceChecker.sol`.
- `UniversalBytecodeStore.sol` / `V2.sol`, `Create2Deployer.sol`, `UniversalCreate2DeployerFromStore.sol`, `OFTBootstrapRegistry.sol`.
- `TaxHookConfigurator.sol`, `CreatorRegistry.sol` (central per-creator mappings + remote peers + Solana mesh).

**Routers / Utilities:**
- `PayoutRouter.sol` (external revenue → burn stream / vault), `VaultShareBurnStream.sol`, `CreatorCoinPolicyController.sol`.
- `CreatorLinearVesting.sol`.
- AlfaClub: `AlfaCreatorKeyLPFactory.sol`, `AlfaCreatorKeyPool.sol`.
- `CreatorOVaultComposerHub.sol`.

**Interfaces & Libs:** ~20+ supporting (IStrategy, ICreatorOVault, etc., Uniswap, LZ, Ajna, tick math, liquidity amounts).

**Key Architecture Notes:**
- **Hub-centric + registry-driven:** Most creator-specific contracts registered in `CreatorRegistry`. Lottery/oracle/gauges look up per-creator via registry.
- **Delegatecall modules** for vault size (set-once, kind + storage-version validated).
- **Profit unlocking + report baseline** (Yearn-like, with explicit baseline fixes).
- **MEV / flash protections:** Block delays on deposit→withdraw/transfer, large-withdrawal queues, per-tx price change caps (10%), trusted PPS deviation, wrapper cooldowns.
- **Impairment side-pockets:** Tripped → root proposal → challenge window → finalize (merkle claims) or clear. Recovery escrow.
- **LayerZero:** Standard OApp/OFT peer model + custom message types. Careful `_lzReceive` guards, guid dedup for callbacks.
- **VRF + lottery:** Win chance fixed at entry (oracle + size + boosts); VRF decides outcome later. Capped jackpot iteration + cursor.
- **Access model:** Owner (often batcher then multisig/treasury), management, keeper, emergencyAdmin, gaugeController, debtPurchaser, impairmentGuardian, protocolRescue. Many two-step or timelock patterns on params.
- **Token flows:** CreatorCoin (asset) ↔ Vault shares (offset) ↔ Wrapper-normalized ↔ ShareOFT (cross-chain, fee-bearing).

No obvious upgradeable proxy pattern on core vault (modules are immutable post-set; batcher uses create2). Many contracts are Ownable (not always 2-step).

---

## Detailed Findings

**Severity: High**  
**Title: Excessive centralization and privileged deployment surface in DeploymentBatcher and per-creator owners**  
**Contract/File:** DeploymentBatcher.sol (multiple phases + helpers), CreatorOVault.sol (setModulesOnce, owner setters), CreatorGaugeController.sol, CreatorRegistry.sol, CreatorLotteryManager.sol, CreatorShareOFT.sol (owner functions)  
**Description:** The `DeploymentBatcher` (and its delegatecall phase modules) performs privileged, multi-contract orchestration for every creator deployment (vault, strategies, OFT peers, hooks, registry seeding, ownership transfers to treasury/automation). Post-deploy, the vault owner, gauge owner, OFT owner, and registry authorized factories retain broad powers (set fees, trip/clear impairment, add strategies, update oracles, configure peers, set VRF sources, etc.). Many contracts use plain `Ownable`; some critical paths lack timelocks or two-step ownership. Hardcoded Base addresses appear in helpers (enforced at construction in some cases).  
**Impact:** Single compromised key / buggy phase module / malicious batcher owner can deploy misconfigured or malicious strategies/vaults for all creators, drain via bad strategy weights, reconfigure fees/jackpot splits, or break cross-chain state. Post-deploy rug or grief vectors via owner keys.  
**Recommendation:** Enforce multisig + timelock (or on-chain governance) for all owner roles on production deployments. Make `setModulesOnce` truly one-way with no path to rotate modules. Add explicit "deployment finalization" that revokes batcher privileges. Use `Ownable2Step` (already present in some batchers) everywhere. Document and monitor all privileged actors. Consider immutable or governance-controlled factories for greenfield creators.  
**Code Snippet (example pattern):**  
```solidity
// DeploymentBatcher.sol and CreatorOVault.sol:730
function setModulesOnce(...) external onlyOwner { ... _coreModule = ...; }
```
(After set, no rotation; but owner retains other powers.)

**Severity: Medium**  
**Title: Strategy and oracle NAV reporting is best-effort and can temporarily distort share price / fees / lottery odds**  
**Contract/File:** CreatorOVaultCoreModule.sol:237 (`totalAssets`, `_getStrategyAssetsSafe`), CreatorOVaultStrategiesModule.sol, SolanaStrategy.sol:263 (`getTotalAssets` using `remoteNav`), CreatorCharmStrategy.sol:446, ERC4626StrategyAdapter.sol:173, AjnaERC4626Vault.sol:85 (bucket loop), CreatorOracle.sol (TWAP + LZ), CreatorLotteryManager.sol ( `_calculateTokenUSD` + deviation guards)  
**Description:** `totalAssets()` sums `coinBalance` + `getTotalAssets()` from strategies (try/catch fallback to `strategyDebt`, clamped by `strategyMaxAssets`). Strategies can return stale/0 on failure or use remote NAV (Solana). Report, deposits, and previews use these values. Lottery uses per-creator oracles (with staleness + deviation circuit breakers). Price updates are LZ-broadcast from Base. `strategyValuationMisses` can auto-disable after threshold.  
**Impact:** Misreported NAV (oracle lag, Solana bridge delay, strategy bug, donation, or manipulation) inflates/deflates `totalAssets()`, causing incorrect profit/loss accounting, performance/management fees, PPS, withdrawal amounts, and lottery win probabilities. A malicious or compromised strategy/oracle can cause temporary share mispricing until report + deviation guards react. Remote NAV in SolanaStrategy adds bridge trust.  
**Recommendation:** Strengthen `strategyMaxAssets` governance (require timelock + multi-sig vote). Require more conservative buffers/minBaseLiquidity in Solana. Add explicit circuit breakers and keeper alerts on consecutive valuation misses or large NAV deltas. Consider time-weighted or median oracles for lottery. Add invariant tests: "report never increases PPS beyond X% without real yield." Make remote NAV opt-in with explicit risk disclosure and lower weight caps. Audit all `getTotalAssets` implementations for rounding and reentrancy.  
**Code Snippet (before/after style mitigation already present):**  
```solidity
// CoreModule
try IStrategy(strategy).getTotalAssets() returns (uint256 reportedAssets) { assets = reportedAssets; } catch { assets = strategyDebt[strategy]; }
uint256 cap = strategyMaxAssets[strategy]; if (cap != 0 && assets > cap) assets = cap;
```

**Severity: Medium**  
**Title: High complexity and cross-contract / cross-chain call surface in shared lottery increases bug risk**  
**Contract/File:** CreatorLotteryManager.sol (entire, esp. `_lzReceive`, `_processWin`, `_payoutLocalJackpotInner`, VRF paths, `_applyBoost`), CreatorShareOFT.sol (`_lzReceive` + winner callback handling + `_isWinnerCallbackMessage`), Randomness sources, ve4626BoostManager + VaultGaugeVoting  
**Description:** Single shared contract handles local + remote (LZ) entries, VRF request/callback (local + cross-chain integrators + zk), win probability (size + ve boost + gauge PPM), jackpot payout iterating vaults (capped at 128 active + 1024 slot scans + cursor), sponsorship budgets, rate limits, and callbacks. `_lzReceive` paths carefully parse/validate but are complex (different payload lengths, guid dedup via `usedReportIds`). Boosts depend on live balances, oracles, and votes.  
**Impact:** A logic error (payload parsing, cursor advancement, boost math, reentrancy across VRF callback → payout → gauge → vault burn, or chain-specific EID handling) can cause lost entries, incorrect wins, drained jackpots, or DoS of lottery lane. Cross-chain replay or ordering issues possible despite guards. High surface for subtle bugs.  
**Recommendation:** Extremely strong fuzz/invariant testing on win probability math, payout fairness across cursor iterations, and LZ message flows. Consider formal spec or property-based tests for `_calculateWinChance` + boosts. Separate winner callback receiver if possible. Add more explicit reentrancy locks and pause paths. Monitor all sponsorship and VRF budget drains.  
**Code Snippet:** Complex length + word checks + guid dedup in ShareOFT `_isWinnerCallbackMessage` and lottery `_lzReceive` (good but fragile).

**Severity: Low**  
**Title: Integer division rounding in fee and profit calculations**  
**Contract/File:** CreatorOVaultCoreModule.sol (report, `_accrueManagementFee`, performance fee shares), CreatorGaugeController.sol (bps splits), CreatorLotteryManager.sol (winChancePPM, rewardPercentage), multiple other bps calcs  
**Description:** Standard `x * bps / 10000` patterns without full `mulDiv` or rounding direction specification in all paths. Some use `FullMath`. Management fee: `(currentTotalAssets * feeBps * elapsed) / (MAX_BPS * SECONDS_PER_YEAR)`. Performance fees similarly.  
**Impact:** Small, consistent rounding losses/gains to vault, fee recipients, or jackpot. Can accumulate or be gamed in edge cases with tiny deposits or frequent reports. Not a direct theft vector but affects fairness and "exact" accounting claims.  
**Recommendation:** Prefer `Math.mulDiv` (or OpenZeppelin) with explicit `Math.Rounding` where available. Document rounding direction in NatSpec for all fee paths. Add rounding tests in unit suite. This is common DeFi practice but worth tightening.

**Severity: Low**  
**Title: Flash/MEV protections rely on block.number on L2 (Base)**  
**Contract/File:** CreatorOVault.sol (withdrawDelayBlocks, largeWithdrawalDelayBlocks, lastDepositBlock), CreatorOVaultWrapper.sol (wrapperWithdrawDelayBlocks, lastWrapperDepositBlock)  
**Description:** Same-block and N-block delays use `block.number`. L2 block production is fast and sequencer-influenced.  
**Impact:** Slightly weaker than time-based (timestamp) or commit-reveal for very high-frequency MEV on L2. Attacker with sequencer influence or rapid blocks could marginally reduce delay effectiveness. Not broken for intended "same-block deposit/withdraw" prevention.  
**Recommendation:** Consider hybrid (block + min timestamp) or document L2 assumptions. Current design is acceptable for the threat model (prevents simple atomic flash loan + redeem).

**Severity: Low**  
**Title: Module storage layout and delegatecall safety depends on perfect append-only discipline**  
**Contract/File:** CreatorOVault.sol + all modules (storage vars after module slots, MODULE_STORAGE_VERSION)  
**Description:** Vault declares storage, then modules delegatecall into the same layout. Modules are validated on `setModulesOnce` by kind + version. New vars are appended.  
**Impact:** Future upgrade of modules or addition of storage could cause collision or silent corruption if discipline slips.  
**Recommendation:** Add automated layout diff checks in CI (e.g., via storage layout export). Treat module storage as a strict append-only ABI. Consider a storage layout test that asserts offsets.

**Severity: Informational**  
**Title: NatSpec and documentation completeness is good but uneven**  
**Contract/File:** Across most contracts (strong in vault/lottery, lighter in some strategies and helpers)  
**Description:** Top-level NatSpec + architecture comments are excellent (many "FIX:" references to prior audits). However, some internal functions, struct fields, and return values lack full `@param`/`@return`. Events are generally emitted for state changes.  
**Recommendation:** Add missing NatSpec for all public/external functions and complex internal math. This aids future auditors and integrators.

**Severity: Informational / Gas**  
**Title: Small gas and loop optimizations possible; some duplicate constants**  
**Contract/File:** Multiple (vault totalAssets loops MAX=5; lottery jackpot caps already added; duplicate constants between vault and modules)  
**Description:** Strategy iteration in `totalAssets` and similar is bounded. Lottery has explicit `MAX_JACKPOT_PAYOUT_ITERATIONS` / slot caps and cursor (post-audit hardening). Duplicate consts (MAX_BPS etc.) exist for delegate safety.  
**Impact:** Minor gas in hot paths (report, totalAssets on every preview). No unbounded loops found in production paths.  
**Recommendation:** Keep caps. Consider caching in hot view functions where safe. Use a shared constants library for duplicates if bytecode allows.

**Additional Notes on Other Areas (no high-severity findings):**
- **Reentrancy:** Extensive use of `ReentrancyGuard` + `_payoutLock` + nonReentrant on deposit/redeem/report/tend/unwrap/wrap/lock/unlock/bribe/claim etc. Pull/push use before/after balance checks. Delegatecall paths respect modifier epilogues via `_delegateAndReturn`. Cross-contract calls (gauge → vault burn, lottery → gauge pay) appear ordered safely.
- **Access control & escalation:** Broad but role-scoped (onlyManagement, onlyKeepers, onlyEmergencyAuthorized, onlyOwnerOrKeeper). Pending roles and operator epochs present in vault. No obvious escalation from keeper → owner.
- **Arithmetic / overflow:** 0.8.30 + SafeERC20 + FullMath in lottery. Few unchecked blocks; those observed are safe.
- **Front-running / MEV:** Multiple layers of defense (queues, delays, price caps, deviation guards, sponsorship rate limits). Winner selection is VRF (unpredictable).
- **Oracle / price:** Strong guards (TWAP, tick caps, staleness 2h, per-tx deviation, last-accepted price circuit breaker in lottery). Bootstrap capped.
- **Signature replay:** EIP712 permits + nonces + operator permits + guid dedup for LZ callbacks. Standard.
- **DoS / gas grief:** Capped loops/iterations (lottery, Ajna buckets MAX=50), try/catch around external calls, pause paths, invalid payload handling (non-reverting for LZ liveness).
- **Token standards:** ERC20/ERC4626 with documented offsets and inflation mitigations. ShareOFT is OFT (LZ). Custom messages carefully disambiguated.
- **Asset handling:** Exact transfer checks (`TransferAmountMismatch`), debt tracking, forceApprove limited, idle thresholds.
- **Uninitialized / proxy:** No classic proxies. Modules set-once. CCA phase checks. Recovery/impairment carefully initialized.
- **Code quality:** High. Heavy use of OZ (SafeERC20, ReentrancyGuard, Math, MerkleProof, EIP712, ERC20Votes, etc.). Custom errors. Events for state changes. Readability good with architecture headers. Maintainability aided by modules but increases surface.
- **Testability:** Extensive test dir; past audit fixes reference concrete tests. Recommend adding more property tests around report invariants, lottery win probability, and module delegate correctness.

---

## Summary Section

**Overall Risk Rating: Medium**

**Findings by Severity (from this review):**
- Critical: 0
- High: 1 (centralization / privileged deployment surface — systemic for the product)
- Medium: 2 (NAV reporting trust surface; lottery/cross-chain complexity)
- Low: 3 (rounding; L2 block.number; module layout discipline)
- Informational / Gas: 3+

**Key Strengths of the Codebase:**
- Mature hardening from prior audits (explicit "FIX: H/M/L-XXXX" comments, caps, guards, dedup, exact accounting).
- Defense-in-depth against classic ERC4626 attacks (virtual offsets, min first deposit, price change limits, deviation checks, donation-resistant `coinBalance` tracking).
- Careful LZ message handling and VRF commit-reveal for lottery.
- Bounded loops and graceful degradation (try/catch on strategy/oracle calls).
- Profit unlocking + impairment side-pockets are well-designed recovery mechanisms.
- Strong use of OpenZeppelin and LayerZero primitives.
- Explicit accounting for cross-contract effects (debt, measured deposits/withdraws).

**High-Priority Issues That Must Be Fixed / Mitigated Before Further Deployment or Scale:**
1. Reduce/lock down privileged surface around DeploymentBatcher and post-deploy owners (multisig + timelocks + least privilege + clear handoff runbooks).
2. Strengthen and monitor strategy/oracle NAV integrity (caps already help; add on-chain limits, alerts, conservative weights for remote/Solana).
3. Increase automated testing (fuzz + invariants) on the lottery payout + boost + cross-chain paths given their complexity.

**Recommendations for Further Testing:**
- **Unit + integration:** Full `forge test` (all 72+ existing + any new).
- **Fuzz:** Random deposits/reports/withdraws + strategy NAV mutations; lottery entry + VRF outcomes under varying oracle/boost/vault counts.
- **Invariant:** PPS monotonicity (only increases with real yield or burns), totalAssets accounting invariants, jackpot reserve accounting across pays, "no user can be made whole only via misreported strategy."
- **Formal / symbolic:** Consider on core math (profit unlock rates, win chance PPM, fee accrual) and module storage layout. The existing tamago/ Lean specs for ERC4626 mirror are a good start—expand.
- **Cross-chain / LZ:** End-to-end message replay, ordering, fee griefing, and peer misconfig tests.
- **MEV simulation:** On Base mainnet fork with realistic block production.
- **Static:** Slither (reentrancy, access, tx.origin), Echidna/Medusa for properties, `forge build --sizes` (CI gate already exists at ~24.5k).
- **Operational:** Review keeper/automation code that calls report/tend/payout; ensure rate limits and pauses work.
- **Audit follow-up:** Commission a focused review on the Solana NAV bridge + impairment claims flow if those see heavy use.

The codebase shows professional engineering and evidence of iterative security work. The primary residual risks are **architectural/operational** (centralization + complexity of the multi-chain lottery + strategy NAV) rather than low-level Solidity bugs. With strong operational controls, multisig usage, and continued testing, the contracts appear suitable for their intended use, but treat the high-privilege paths and NAV sources as the highest-risk components.

This concludes the audit based on provided source. Provide the full test output or a specific contract diff for a delta review.
