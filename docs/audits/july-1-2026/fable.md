Security Audit Report — 4626 Protocol Solidity Contracts
Auditor: Senior Smart Contract Security Review Scope: All Solidity in /contracts — 103 .sol files, ~26,835 LOC Compiler: 0.8.30 (checked arithmetic), via_ir=true, optimizer_runs=200, EVM cancun, bytecode_hash=none Dependencies: OpenZeppelin 5.4, LayerZero V2 (OFT/OApp), Chainlink VRF v2.5, Uniswap v3/v4 Baseline: forge build succeeds (exit 0); only a non-blocking unsafe-typecast lint warning in SolanaBridgeAdapter.sol:854.

Method note (validation honesty): I ran forge build (passed). I did not run forge test in this pass. All findings below are from manual review of source I read directly; the highest-severity items (report() accounting, VRF cherry-pick, cross-chain lottery routing, emergency-reset bribe drift, permissionless vesting seed) were re-verified by me against the exact lines cited.

1. Contracts Analyzed and Purpose
Vault core (ERC-4626)
Contract	Purpose
vault/CreatorOVault.sol
Main ERC-4626 vault. ERC4626, Ownable, ReentrancyGuard, EIP712, IERC20Permit. Uses per-function delegatecall to three fixed module addresses sharing storage.
vault/modules/CreatorOVaultCoreModule.sol
deposit/mint/withdraw/redeem, report(), profit unlocking, impairment logic.
vault/modules/CreatorOVaultAdminModule.sol
Fee/role/risk config setters.
vault/modules/CreatorOVaultStrategiesModule.sol
Strategy add/remove/deploy/withdraw.
vault/modules/CreatorOVaultModuleStorage.sol
Shared storage layout (v3) enforced by MODULE_STORAGE_VERSION.
vault/modules/CreatorOVaultModuleBase.sol
onlyDelegateCall base + self-call interface.
vault/CreatorOVaultWrapper.sol
Creator-coin ⇄ vault-share wrapper; queues on burn stream.
vault/CreatorOImpairmentClaims.sol / CreatorORecoveryEscrow.sol
Side-pocket ERC-1155 claims + epoch-scoped recovery escrow.
vault/libraries/CreatorOVaultLiquidityLib.sol
Liquidity snapshot helper.
Strategies
vault/strategies/CCALaunchStrategy.sol (+ ConfigModule, EncodingHelper) — continuous clearing auction launch; ERC4626StrategyAdapter.sol — wraps external 4626; SolanaStrategy.sol / SolanaBridgeStrategy.sol — cross-chain NAV.

Lottery / gauge / oracle / rewards
utilities/lottery/CreatorLotteryManager.sol — jackpot payout authority (VRF winner selection); governance/CreatorGaugeController.sol — jackpot custody + fee-split routing; utilities/oracles/CreatorOracle.sol — Chainlink+TWAP price hub with LZ broadcast; governance/VoterRewardsDistributor.sol — protocol reward routing.

ve(3,3) governance
governance/ve4626.sol — voting escrow (ERC20Votes); ve4626BoostManager.sol — lottery boost multiplier; VaultGaugeVoting.sol — epoch gauge voting; VaultRolePolicyManager.sol — role policy; bribes/BribeDepot.sol + factories/BribesFactory.sol — bribe markets.

Cross-chain
utilities/messaging/CreatorShareOFT.sol — LayerZero OFT with local tax plane + lottery/winner messaging; OVaultHubComposer.sol (+ services/ovault/CreatorOVaultComposerHub.sol) — LZ compose handler for cross-chain deposit/redeem; utilities/bridge/SolanaBridgeAdapter.sol — Base⇄Solana twin bridge.

Deploy / factories / registry / periphery
helpers/batchers/DeploymentBatcher.sol (+ strategy/activation/auxiliary batchers, RouteCoherenceChecker) — multi-phase CREATE2 deploy; factories/* — Create2 deployers + CreatorOVaultFactory; helpers/infra/UniversalBytecodeStore*.sol — on-chain init-code store; core/CreatorRegistry.sol — canonical route registry; utilities/routers/PayoutRouter.sol + VaultShareBurnStream.sol + CreatorCoinPolicyController.sol — earnings lanes; helpers/hooks/TaxHookConfigurator.sol; alfaclub/* — creator-key AMM; utilities/vesting/CreatorLinearVesting.sol; libraries/* — Uniswap math.

Architectural note: The vault uses a delegatecall module pattern (not a proxy — the main contract holds storage; modules are logic-only reached via _delegate/_delegateAndReturn). I verified the storage variable order/types in CreatorOVault match CreatorOVaultModuleStorage.v3 against OZ 5.4 base layout, and that a MODULE_STORAGE_VERSION hash gate blocks module wiring on layout mismatch. No storage-layout divergence was found — this is the single highest-risk area in this design and it is handled correctly.

2. Findings
CRITICAL
None confirmed. The most damaging class (delegatecall storage collision, jackpot custody theft without authority, direct compose forgery) was specifically checked and is mitigated. The items below marked High are the ones that must block deployment.

HIGH
Severity: High Title: report() treats entire NAV as profit when baseline is zero but shares still exist Contract/File: contracts/vault/modules/CreatorOVaultCoreModule.sol:704-744 Description: The bootstrap short-circuit only triggers when previousTotalAssets == 0 && trustedPpsCheckpoint == 0 && _totalSupply == 0. If principal outflows drive totalAssetsAtLastReport to 0 while _totalSupply > 0 (locked profit shares held at address(this), fee-recipient balances, dust), the next report() computes profit = currentTotalAssets - 0 = currentTotalAssets. I verified the guard requires all three conditions and that the profit branch has no floor for the previousTotalAssets == 0, supply > 0 case. Impact: The full remaining NAV is recognized as profit: performance-fee shares minted to performanceFeeRecipient, inflated management-fee accrual, and profit-lock share minting — diluting residual holders. A keeper can trigger this without management action. Recommendation: Add a branch for previousTotalAssets == 0 && _totalSupply > 0 that resets the baseline to currentTotalAssets with zero profit, or clamp profit to a sane post-drain floor. Code Snippet:


CreatorOVaultCoreModule.sol
Lines 704-715
        if (previousTotalAssets == 0 && trustedPpsCheckpoint == 0 && _totalSupply == 0) {
            // ... bootstrap: zero profit ...
            return (0, 0);
        }
        if (currentTotalAssets > previousTotalAssets) {
            profit = currentTotalAssets - previousTotalAssets;
Severity: High Title: Owner can cherry-pick VRF outcomes deferred during pause Contract/File: contracts/utilities/lottery/CreatorLotteryManager.sol:813-849 Description: While paused, _processVRFResult stores pendingRandomWord[requestId] (a public mapping) and does not settle. processPendingVrfResult is onlyOwner. I confirmed the deferred word is publicly readable and settlement is at owner discretion per-requestId. An owner can pause, let callbacks accumulate, read each pending random word, compute win/loss off-chain, and selectively process only desired requests, indefinitely stranding others. Impact: Selective jackpot settlement / win censorship; breaks the fairness guarantee VRF is meant to provide. This is a trust-minimization failure even though CLM-08 restricted the function to owner to stop third-party front-running. Recommendation: Auto-settle all deferred results in FIFO order on unpause(), or make deferred processing permissionless/keeper-driven with mandatory settlement, or emit definitive loss + delete on grace expiry. Settlement must not be discretionary. Code Snippet:


CreatorLotteryManager.sol
Lines 842-848
        if (paused()) {
            if (!hasPendingRandomWord[requestId]) {
                pendingRandomWord[requestId] = randomWords[0];
                hasPendingRandomWord[requestId] = true;
Severity: High Title: Emergency vote reset desynchronizes aggregate vs per-user weights → bribe over-claim Contract/File: contracts/governance/VaultGaugeVoting.sol:491-501, 434-436; contracts/governance/bribes/BribeDepot.sol:115-128 Description: emergencyResetAllVotes zeroes _epochVaultVotes / _epochTotalVotes and bumps _epochResetGeneration, but does not clear _epochUserVaultVotes. I verified getUserVoteWeightAtEpoch returns _epochUserVaultVotes[epoch][user][vault] with no generation check, while BribeDepot.claim divides totalBribes * userWeight / totalWeight using these getters. A user who voted pre-reset and did not re-vote retains phantom userWeight; once any new voter re-establishes a small totalWeight, the stale user can claim a disproportionate (up to entire) share of the bribe pool. The generation guard exists only in _clearUserVotes, not in the bribe-facing getter. Impact: Theft of bribe rewards from legitimate voters after an emergency reset; first stale claimer can drain a pool. Recommendation: Make getUserVoteWeightAtEpoch return 0 when _userVoteGeneration[epoch][user] != _epochResetGeneration[epoch], or clear user records on reset, or stamp generation into bribe claims. Code Snippet:


VaultGaugeVoting.sol
Lines 434-436
    function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256) {
        return _epochUserVaultVotes[epoch][user][vault];
    }
Severity: High Title: getPastVotes / getPastTotalSupply mix block-number clock with timestamp lock math Contract/File: contracts/governance/ve4626.sol:454-490 Description: ve4626 inherits OZ ERC20Votes, whose clock() is not overridden — it defaults to block.number (the code comment at line 104 acknowledges this). Yet getPastVotes(account, timepoint) treats timepoint as a Unix timestamp (userLock.end - timepoint), and reads current lock state rather than historical checkpoints. getPastTotalSupply checkpoints minted supply (not decayed power) keyed by clock() (block number). Impact: Any OZ Governor-style consumer calling getPastVotes(account, proposalBlock) receives nonsense. Because getPastVotes reads live _locks, a user could lock → snapshot → increaseLock/extendLock → vote with inflated historical weight. Exploitability is conditional: no in-scope contract wires ve4626 into a Governor; the live gauge path uses votingPowerAt + epoch storage instead. This is High if/when governance is attached, informational until then. Recommendation: Either override clock()/CLOCK_MODE() to timestamp mode and add per-mutation lock checkpoints that getPastVotes binary-searches, or remove the ERC20Votes historical surface entirely to prevent a future integrator from trusting it. Code Snippet:


ve4626.sol
Lines 454-459
    function getPastVotes(address account, uint256 timepoint) public view override returns (uint256) {
        Lock memory userLock = _locks[account];
        if (userLock.amount == 0) return 0;
        if (timepoint >= userLock.end) return 0;
        uint256 duration = userLock.end - timepoint;
        return (userLock.amount * duration) / MAX_LOCK_DURATION;
Severity: High Title: Permissionless CreatorLinearVesting.seed() allows allocation-griefing / bricking Contract/File: contracts/utilities/vesting/CreatorLinearVesting.sol:46-53 Description: seed() has no access control and is one-shot. I verified it fixes totalAllocation to the current balance and sets seeded = true permanently, with no rescue path. An attacker front-runs the funding transfer with a 1-wei transfer + seed(); totalAllocation locks at 1 wei. The later legitimate 30%-ShareOFT transfer is then unreleasable beyond the seeded amount (vestedAmount caps at totalAllocation). Impact: Creator vesting (30% of ShareOFT supply at finalize) permanently under-allocated for the beneficiary; tokens stranded. Recommendation: Restrict seed() to the deployer/batcher, or seed atomically in the same transaction as funding, or bind seeding to beneficiary. Code Snippet:


CreatorLinearVesting.sol
Lines 46-53
    function seed() external {
        if (seeded) revert AlreadySeeded();
        uint256 bal = token.balanceOf(address(this));
        if (bal == 0) revert ZeroDuration();
        totalAllocation = bal;
        seeded = true;
Severity: High (config-dependent) Title: Remote MSG_TYPE_LOTTERY_ENTRY has no matching handler on the OFT receive path Contract/File: contracts/utilities/messaging/CreatorShareOFT.sol:734-758, 861-886 Description: submitPendingLotteryEntry sends an ABI-encoded 6-field lottery payload via _lzSend(hubEid, ...), which routes to the standard OApp peers[hubEid] (the counterpart OFT). I verified the hub _lzReceive override only branches for winner callbacks (128-byte, hubLotteryPeer sender) and otherwise defers to super._lzReceive, which expects a packed OFT transfer — not a 192-byte ABI payload. CreatorLotteryManager has its own _lzReceive gated by authorizedRemoteOFTs, but a single peers[hubEid] cannot route both token transfers and lottery entries to two different destinations. Impact: If peers are wired OFT→OFT (the normal case), cross-chain lottery entries revert or mis-decode on delivery after the user has paid LZ fees. State is CEI-protected on the send side, so a reverting _lzSend restores the pending entry, but a successful send with failed hub receipt burns fees and drops the entry. Recommendation: Route lottery entries to a dedicated OApp receiver with its own peer wiring (the code comment at lines 890-891 already recommends separating custom messages from the OFT), or add an explicit MSG_TYPE_LOTTERY_ENTRY branch that validates sender and forwards to the hub CreatorLotteryManager.

Severity: High Title: PayoutRouter.emergencyWithdraw can drain all routed revenue Contract/File: contracts/utilities/routers/PayoutRouter.sol:305-317 Description: Owner may withdraw any ERC-20/ETH balance, including creatorCoinPayoutRecipient revenue awaiting conversion/queueing, bypassing the burn-stream policy. Impact: Compromised/misconfigured owner key seizes creator external-earnings before they reach the share-holder-biased burn stream. Recommendation: Timelock + multisig; restrict emergency withdraw to non-core tokens, or re-enforce payout recipient post-withdraw. Code Snippet:


PayoutRouter.sol
Lines 305-308
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
MEDIUM
Severity: Medium Title: Gauge emergencyWithdraw can drain jackpot custody, bypassing lottery authority Contract/File: contracts/governance/CreatorGaugeController.sol:1085-1095 Description: Owner can transfer vaultShares and decrement jackpotReserve directly, circumventing the custody-vs-authority split (payJackpot is otherwise the only outflow, gated by OnlyLotteryManager). Impact: The clean custody/authority separation is undermined by a single owner key; winners could face an emptied reserve. Recommendation: Timelock/multisig; separate jackpot escrow; or forbid vault-share emergency withdraw while jackpotReserve > 0.

Severity: Medium Title: Concurrent lottery wins can over-commit a single jackpot reserve Contract/File: contracts/governance/CreatorGaugeController.sol:716-722; CreatorLotteryManager.sol:1602-1695 Description: payJackpot reverts if shares > jackpotReserve. Two wins settled before reserve accounting is observed both size against the pre-deduction reserve; the second reverts / emits JackpotPayoutFailed. Impact: Winner receives partial payout; reserve accounting diverges from the "one win = 69% of reserves" expectation. Recommendation: Reserve at VRF-request time, per-gauge payout lock, or serialized settlement.

Severity: Medium Title: injectCapital does not update the report baseline Contract/File: contracts/vault/modules/CreatorOVaultCoreModule.sol:882-891 Description: injectCapital pulls creator coin and raises PPS but leaves totalAssetsAtLastReport unchanged, so the next report() recognizes the injection as profit. Impact: Donated principal is fee'd as profit (performance + management + profit-lock minting). Recommendation: Call _increaseReportBaselineForPrincipalInflow(amount) in injectCapital.

Severity: Medium Title: Operator bitmask permissions are implemented but never enforced Contract/File: contracts/vault/CreatorOVault.sol:273-287, 1922-1956; CreatorOVaultCoreModule.sol:311-457 Description: OP_DEPOSIT/OP_WITHDRAW/OP_ACTIVATE, setOperatorPerms, permitOperator, and operator-epoch invalidation exist, but deposit/mint/withdraw/redeem/queueWithdrawal never call isAuthorizedOperator. Impact: On-chain operator grants are inert; integrators assuming delegated execution wallets are bitmask-constrained are mistaken. Recommendation: Enforce the bitmask in the core paths, or remove the dead surface to avoid false assumptions.

Severity: Medium Title: maxWithdraw / maxRedeem overstate redeemability when liquidity is strategy-bound Contract/File: contracts/vault/CreatorOVault.sol:1272-1296; CreatorOVaultCoreModule.sol:568-589 Description: Caps derive from previewRedeem (PPS + queued-share reservation) but ignore idle coin / strategy withdrawability; _ensureCoin can revert InsufficientBalance(). Impact: ERC-4626 aggregators/routers reading maxWithdraw can build reverting transactions — a composability/spec-compliance gap. Recommendation: Cap by min(previewRedeem, idle + optimistic strategy liquidity) via the liquidity lib, or document the deviation.

Severity: Medium Title: Impairment Suspect mode blocks synchronous exits but not the queued-claim path Contract/File: contracts/vault/modules/CreatorOVaultCoreModule.sol:397-401, 494-517 Description: redeem/withdraw require vaultMode == Normal; queueWithdrawal/claimQueuedWithdrawal have no vaultMode gate. Impact: Asymmetric exits during an impairment investigation — queued claimants can exit while synchronous redeemers are frozen. Recommendation: Add a vaultMode gate (or an explicit Suspect-mode allowance flag) to queue/claim.

Severity: Medium Title: No Base L2 sequencer-uptime check on Chainlink reads; auto-TWAP omits answeredInRound Contract/File: contracts/utilities/oracles/CreatorOracle.sol:473-486, 1005-1009 Description: ETH/USD reads apply MAX_STALENESS but no Base sequencer uptime feed; _updatePriceFromTWAP() (swap auto-update) omits the answeredInRound >= roundId guard present in the manual update paths. Impact: During sequencer downtime or incomplete rounds, stale-but-in-threshold prices drive lottery USD sizing, gauge swap protection, and fee routing. Recommendation: Add a sequencer-uptime feed (fail closed on downtime); mirror the answeredInRound guard in the auto path.

Severity: Medium Title: notifyRewards failure reverts the whole fee distribution Contract/File: contracts/governance/CreatorGaugeController.sol:686-688 Description: The protocol slice calls voterRewardsDistributor.notifyRewards without try/catch, unlike the other fallback-protected lanes. Impact: A misconfigured/reverting distributor bricks burn/lottery/creator routing for the batch (DoS). Recommendation: try/catch with fallback to protocolTreasury or jackpot, matching the existing pattern.

Severity: Medium Title: Optional zero mesh peers disable compose-origin authentication Contract/File: contracts/utilities/messaging/OVaultHubComposer.sol:372-385 Description: If mesh.solanaAssetPeer/solanaSharePeer == bytes32(0), any composeFrom on the configured srcEid is accepted (subject to allowlisted OFT + token match). composeFrom is source-supplied. Impact: With zero peers, a misconfigured/malicious same-EID sender could compose deposit/redeem intents impersonating a peer. Recommendation: Require non-zero peers at configureCreatorMesh; fail closed on unset peers.

Severity: Medium Title: Solana lottery relay marks tx consumed before confirming success Contract/File: contracts/utilities/bridge/SolanaBridgeAdapter.sol:669-705 Description: processedSolanaTxs[entry.solanaTxSig] = true is set before the try processSwapLottery; a transient revert (paused lottery, VRF funding) permanently skips that entry. Impact: Permanent loss of lottery entries on transient failures; no retry with the canonical Solana tx sig. Recommendation: Mark consumed only on success, or use a pending→confirmed two-phase pattern.

Severity: Medium Title: Stuck-token recovery gaps in composer and OFT hub fee path Contract/File: contracts/utilities/messaging/OVaultHubComposer.sol:123-130; CreatorShareOFT.sol:559-597 Description: The composer receives OFT credit before lzCompose; a compose revert leaves ERC-20 balances with only rescueETH (no rescueERC20). On the hub, failed receiveFees accumulates pendingFees but flushFees reverts (NotHub) — no hub-side retry/recovery. Impact: Bridged assets / accumulated fees can be locked with no on-chain recovery if downstream config breaks. Recommendation: Add guarded rescueERC20 (e.g. paused-only / above tracked liabilities) and a hub flushFeesToGauge() retry.

Severity: Medium Title: SolanaStrategy.getTotalAssets counts keeper-reported remoteNav, but withdraw returns only Base liquidity Contract/File: contracts/vault/strategies/SolanaStrategy.sol:263-290 Description: NAV = baseLiquid + remoteNav (keeper-reported, delta-bounded) while withdraw transfers only Base-side balance. Impact: Vault share pricing can overstate redeemable assets; a compromised keeper inflates NAV within delta caps. Recommendation: Bound remoteNav by reconciled bridge receipts; add emergency reset; ensure vault withdraw logic accounts for illiquid remote NAV.

Severity: Medium Title: sweepStaleEpochRewards lets owner seize all unclaimed voter rewards after grace Contract/File: contracts/governance/VoterRewardsDistributor.sol:232-255 Description: After staleSweepGraceEpochs (26 ≈ 6 months), owner sweeps the full epochVaultRewards to protocolTreasury regardless of outstanding legitimate claims. Impact: Voters who miss the window lose rewards; centralization risk. Recommendation: Document prominently; consider dust-only sweeps or longer grace; emit outstanding amounts.

Severity: Medium Title: Boost-source setters instant until timelock armed; profit-report resets unlock schedule Contract/File: CreatorLotteryManager.sol:2291-2304; CreatorOVaultCoreModule.sol:729-741 Description: (a) setBoostManager/setVaultGaugeVoting apply instantly until armBoostSourceTimelock() is called — a compromised owner can install a malicious boost source lifting odds toward 15%. (b) Each profitable report() recomputes fullProfitUnlockDate/profitUnlockingRate over old+new locked shares with a fresh window, extending realization for previously-locked profit. Impact: Pre-arming probability manipulation; slower-than-expected PPS accretion. Recommendation: Arm the timelock in the deploy script before production; use additive unlock tranches instead of resetting the timer.

Severity: Medium Title: Activation batchers lack registry validation on several entrypoints Contract/File: contracts/helpers/batchers/VaultActivationBatcher.sol:192-229 Description: batchActivate and some Permit2 operator paths accept arbitrary vault/wrapper/ccaStrategy; registry-coherence checks exist only on a subset. Impact: A malicious UI can route user approvals through attacker contracts while the user approves the genuine creator token. Recommendation: Validate every entrypoint against CreatorRegistry.

Severity: Medium Title: Registry authorized-factories are permanent until manually revoked; hot-swappable deploy modules Contract/File: contracts/core/CreatorRegistry.sol:190-194; helpers/batchers/DeploymentBatcher.sol:2282-2292 Description: A compromised authorized factory can poison registry routes; onlyProtocolTreasury can replace phase-1/phase-2 modules (executed via delegatecall) with no timelock/codehash allowlist. Impact: Registry poisoning affects lottery, routing, and mesh; module swap can alter finalize semantics or strand deploys. Recommendation: Timelock + codehash allowlist for module swaps and factory authorization; monitor events.

Severity: Medium Title: ERC4626StrategyAdapter.deposit silently swallows inner-vault deposit failures Contract/File: contracts/vault/strategies/ERC4626StrategyAdapter.sol:204-208 Description: try ERC4626_VAULT.deposit(...) {} catch {} leaves assets idle while getTotalAssets still counts them. Impact: Vault believes the strategy is deployed while yield is not accruing; unexpected withdraw/rebalance behavior. Recommendation: Emit a mandatory failure event / health bit, or revert when valuation is ready.

LOW
Admin external call without reentrancy guard — CreatorOVault.sol:1852-1854 / CreatorOVaultAdminModule.sol:207-211: setBurnStreamAuthorizedQueuer uses _delegate (assembly return, no nonReentrant). Low given owner-gated + trusted burn stream.
Risk timelock bypass for fee recipient / unlock time — CreatorOVaultAdminModule.sol:443-453: recipient and profitMaxUnlockTime changes are instant while fee rates are timelocked. Route through the same schedule.
impairmentGuardian set but never read — CreatorOVaultAdminModule.sol:378-382: dead role → false sense of oversight. Wire it or remove.
setLotteryManager(address(0)) bricks payouts — CreatorGaugeController.sol:763-765: add zero-address check.
Remote oracle accepts hub broadcast with no deviation cap — CreatorOracle.sol:1201-1229: a compromised hub can push arbitrary spoke prices; enforce a deviation cap on inbound.
Lottery _lzReceive lacks nonReentrant — CreatorLotteryManager.sol:1064-1081: unlike processSwapLottery; add the guard.
Bribe claim marks claimed even when payout rounds to 0 — BribeDepot.sol:121-128: small voters lose dust entitlement. Revert on zero payout or accumulate.
votingPowerAt uses current lock for historical epochs — ve4626.sol:359-366: self-grief / stale weight after mid-epoch lock changes without re-vote. Document / callback re-weight.
burnExpiredLock leaves ghost lock struct — ve4626.sol:287-301: burns ve but keeps _locks[user].amount; confuses amount > 0 consumers.
extendLock allowed on expired locks without explicit guard — ve4626.sol:185-215.
setMinVotingPower has no timelock — ve4626BoostManager.sol:164-167, unlike other boost params.
PayoutRouter.convertAndQueue ignores minOut on direct creator-coin deposits — PayoutRouter.sol:345-349 (documented 1:1).
PayoutRouter._claimProtocolRewards uses hardcoded magic selectors — PayoutRouter.sol:443-449: brittle to Zora API changes.
CCALaunchStrategy.setFeeRecipient repointable post-deploy — CCALaunchStrategyConfigModule.sol:291-294: can redirect away from tradeFeeCollector. Make immutable after launch or assert gauge equality.
AjnaERC4626StrategyFactory.deploy permissionless — StrategyDeploymentFactories.sol:89-133: spam/grief risk.
VaultShareBurnStream drip halts at MAX_FAILED_BURN_ACCUMULATOR — VaultShareBurnStream.sol:254-267: prolonged vault-burn failure stalls PPS accretion; needs monitoring/runbook.
Solana relay decimal down-scaling truncates small amounts to 0 — SolanaBridgeAdapter.sol:686-692: silent dropped entries; revert on non-zero remainder.
submitPendingLotteryEntry requires exact msg.value — CreatorShareOFT.sol:745-747: no overpay refund (UX/grief).
Adapter accumulates excess native fee with no ETH rescue — SolanaBridgeAdapter.sol:865-866.
INFORMATIONAL
Modulo bias in win selection — CreatorLotteryManager.sol:855 (% 1_000_000): negligible at ≤15% odds.
Default usdMultiplierBps = 10500 and oracleDeviationWindow dead config — CreatorLotteryManager.sol:533, 228: must be reset to 10_000 in deploy; window param never enforced.
Multi-vault jackpot payout capped at 128 iterations — CreatorLotteryManager.sol:1602: winner may receive partial portfolio; document vs "all vaults" copy.
Fee splits immutable (constructor-validated to 10_000 bps) — CreatorGaugeController.sol:301-305: positive; cannot misconfigure post-deploy.
ve design diverges from Solidly bias/slope — decayed power is view-only; ERC20 balanceOf does not decay. Gauge/bribe path (authoritative) uses votingPowerAt; integrators must not use balanceOf.
VaultRolePolicyManager policy id 0 is fully permissive — VaultRolePolicyManager.sol:83.
BribeDepot inherits Ownable with no owner functions — dead ownership.
Centralization surfaces across OFT/adapter/composer/registry — peers, fee bypass, keepers, emergency withdrawals; recommend timelock + multisig + monitoring.
flushThreshold unused; dead vault strategy helpers in main contract — CreatorShareOFT.sol:986-988; CreatorOVault.sol:1544-1685.
SECONDS_PER_YEAR mismatch — 31_556_952 (vault/core) vs 365 days (admin). ~0.07%.
UniversalBytecodeStore permissionless but hash-keyed/append-only — poisoning requires a bytecode preimage collision (infeasible); benign front-run only.
Uniswap math libraries — LiquidityAmounts, V4LiquidityAmounts, TickMathCompat match canonical patterns with Math.mulDiv + toUint128 overflow guards; TickMathCompat intentionally one-directional.
GAS
VoterRewardsDistributor.claimMany / emergencyResetAllVotes / processLotteryEntryFromSolana — caller-controlled unbounded loops (self-grief / emergency DoS at scale).
VaultGaugeVoting.vote O(n²) dedup (bounded at 10, acceptable).
CreatorOVaultCoreModule.lockedShares() extra self external-call; inline the math.
UniversalBytecodeStoreV2.get() linear chunk loop (keep reads off-chain).
3. Summary
Overall risk rating: Medium. The codebase is unusually well-hardened for its size — it carries visible scars from prior audit cycles (fix tags CLM-*, G-*, H-*, M-*, I-*). The two most dangerous structural risks in this design — delegatecall storage-layout collision and jackpot custody paid without authority — were specifically checked and are correctly mitigated. There are no confirmed Critical issues, but several High issues involving accounting correctness, fairness, and centralization must be fixed before deployment.

Findings by severity:

Severity	Count
Critical
0
High
7
Medium
18
Low
~20
Informational
~12
Gas
4
Key strengths:

Delegatecall module storage integrity gated by MODULE_STORAGE_VERSION (v3), verified against OZ 5.4 layout — no divergence.
Reentrancy-guard discipline: guarded entrypoints use _delegateAndReturn (preserving the nonReentrant epilogue), not the assembly-return _delegate.
Inflation/donation resistance: virtual-shares offset (1e3), MINIMUM_FIRST_DEPOSIT, tracked coinBalance (ignores raw donations), per-tx PPS change limit, and trusted-PPS deviation gate.
Exact-transfer enforcement (_pullCreatorCoinExact/_pushCreatorCoinExact) rejects fee-on-transfer/rebasing assets.
Correct ERC-4626 rounding directions and queued-share liquidity honesty in previewRedeem.
Clean jackpot custody/authority split; immutable, constructor-validated fee splits.
VRF callback access control (coordinator-only) and namespaced request keys; per-vault payout isolation with try/catch and gas caps.
LayerZero endpoint-only compose + allowlisted senders + balance-delta invariants; strict Base→Solana decimal conversion (revert-on-dust); Solana twin authentication.
CREATE2 init-code-hash verification on benign front-run; phase-1 state-mismatch detection and treasury reset.
High-priority issues that must be fixed before deployment:

report() zero-baseline profit mis-accounting (H) — CreatorOVaultCoreModule.sol:704-744.
VRF owner cherry-pick during pause (H) — CreatorLotteryManager.sol:813-849.
Emergency-reset bribe over-claim (H) — VaultGaugeVoting.sol:434-436 + BribeDepot.sol.
Permissionless vesting seed() griefing (H) — CreatorLinearVesting.sol:46-53.
PayoutRouter.emergencyWithdraw drain + gauge emergencyWithdraw jackpot drain (H/M) — add timelock/multisig.
Cross-chain lottery-entry routing (H, config-dependent) — verify/fix peer wiring or add a dedicated receiver.
Decide the fate of ve4626's ERC20Votes historical surface before attaching any governor.
Recommendations for further testing:

Unit: the zero-baseline report() path (supply>0, assets=0), injectCapital baseline, emergency-reset→bribe-claim sequence, permissionless seed() front-run.
Fuzz: ERC-4626 round-trip invariants (deposit→redeem never mints value), fee-share minting across supply==0 edges, VRF modulo distribution, fee-split dust.
Invariant (Foundry/Echidna): sum(user shares) == totalSupply - lockedProfit; jackpotReserve only decreases via payJackpot; totalAssets >= sum(strategy debt); bribe pool conservation across reset/claim; ve votingPower monotonic decay.
Cross-chain / fork: LayerZero compose failure → stuck-token recovery; Solana relay replay/truncation; sequencer-down oracle behavior on a Base fork.
Formal verification (Certora/Halmos): the delegatecall storage-layout equivalence between CreatorOVault and CreatorOVaultModuleStorage, and the custody/authority invariant on CreatorGaugeController.payJackpot.
I linked the underlying domain analyses if you want to drill in: ERC-4626 core, lottery/gauge/oracle, ve(3,3) governance, cross-chain/LayerZero, deploy/periphery.

The background build task finished successfully — forge build compiled all contracts (exit 0), which I already folded into the audit baseline. The only compiler output was one non-blocking unsafe-typecast lint warning at SolanaBridgeAdapter.sol:854 (uint64(v) cast). No follow-up action is needed; the audit report above stands as delivered.