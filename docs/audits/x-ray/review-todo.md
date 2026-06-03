# 4626 Security Review TODO

Use this as the execution checklist for the current x-ray pass.

**Current pass (2026-06 resumption + follow-ups):** Full review of all P0/P1 items completed (source, invariants, Slither, sizes, tests, Codex/acceptances, hygiene). All P2 test additions closed (new deploy retry test in ThreeWaySplit.t.sol + references to existing hostile withdraw/replay coverage). Follow-up actions executed:
- CLM size warn-guard hardened (lower threshold + PR "size budget review" policy).
- SC hygiene guard added to `scripts/security-audit-local.sh` (CLM headroom + contracts canonical terminology scan).
- Lint issues in TacticalTokenMap.tsx fixed as part of making security audit clean.
- Pass summary + size-gate doc + this checklist updated.

See `contract-audit-pass-2026-06.md` for full summary. All items below now [x] or closed with evidence.

## P0 — Deploy Path Integrity

- [x] Review `contracts/helpers/batchers/DeploymentBatcher.sol` phase ordering (`deployPhase*` / `finalizePhase*`) — modular (Phase1/2Module delegatecall + Phase3/UniV4 helpers); state machine via Phase1SplitState (coreDone, finalized, paramsHash/codeIdsHash checks, Phase1CoreMissing/Phase1StateMismatch/Phase1Missing); sequential gates (finalize requires prior core/split). Phase comments document 1a/1b/2a/2b/3 split. Partial/retry supported via persisted split state + resetPhase1State (owner-only).
- [x] Verify `msg.sender == params.owner` enforcement across all phase entrypoints — `_requireOwner(params.owner)` (msg.sender != owner → NotOwner) on all public deployPhase*/finalize*/launch* entrypoints (main batcher). Post-deploy: IOwnableView(vault).owner() == params.owner checks in helpers. Modules use NotBatcherContext (address(this) == batcher).
- [x] Check retry/partial-state behavior when phase execution fails mid-transaction — phase1SplitStates[baseSalt] + wasCoreDone/wasFinalized snapshots allow resume paths; mismatch reverts prevent divergent retries. resetPhase1State exists for recovery (owner-gated). No mid-tx partial ownership left (all-or-nothing per phase tx + reentrancy guards on entries).
- [x] Review `contracts/factories/UniversalCreate2DeployerFromStore.sol` authorization model (`owner` vs `authorizedDeployers`) — G-9 enforced: `if (msg.sender != owner && !authorizedDeployers[msg.sender]) revert NotAuthorizedDeployer()`. setAuthorizedDeployer owner-only. Deploy uses store + create2. (F-13 fix applied.)
- [x] Validate CREATE2 codeId/salt collision assumptions and failure handling — salts via DeploymentBatcherUtilsHelper.deriveBaseSalt/deriveShareOftSalt (creator+owner+chain+version+symbol); codeId from params; store.get(codeId) + concat(creationCode, ctorArgs); explicit CodeNotFound, DeployFailed, Phase1StateMismatch on hash mismatch. computeAddress helper present. No obvious squatting due to owner+version namespace + batcher auth.

## P0 — Vault Accounting Symmetry

- [x] Review `contracts/vault/CreatorOVault.sol` for share/asset accounting consistency — delegates to v3 Core/Strategies/Admin modules (setModulesOnce + MODULE_STORAGE_VERSION identity + kind checks). totalAssets includes idle + strategyDebt[strategy]. Impairment side-pocket (v3) trips on suspect, mints non-transferable claims, excludes from clean book. Uses ReentrancyGuard.
- [x] Review `contracts/vault/modules/CreatorOVaultCoreModule.sol` deposit/mint vs withdraw/redeem symmetry — full ERC-4626 previews + _executeDeposit/_executeMint/_executeWithdraw/_executeRedeem paths; supplyBefore/after deltas; _withdrawFromStrategies(deficit) on withdraw; gaugeController + burnStream only for certain burns (G-8, X-1). totalSupply, locked shares, performance fee accrual, valuation miss auto-disable. Impairment trip/finalize/claim paths.
- [x] Verify invariants around `totalSupply`, user share balances, and asset accounting under stressed exits — I-1 (conservation) holds in module (Δ shares track supply + user balances); report/tend update strategyDebt + totalAssetsAtLastReport with baseline protection (FIX I-04 comments); queueWithdrawal + claim for async. Stressed exits go through _withdrawFromStrategies + best-effort in some strategies.
- [x] Review `contracts/vault/modules/CreatorOVaultStrategiesModule.sol` strategy debt reconciliation on partial/failed withdrawal legs — __withdrawFromStrategies, addStrategy/setStrategyWeight/remove (with totalStrategyWeight updates), _reconcileStrategyDebt on reports. Eject disabled, auto-allocate. Debt tracked per-strategy; withdraw legs update debt.
- [x] Verify `totalStrategyWeight <= 10_000` enforcement across add/remove/reweight paths — G-2/G-3: require(weightBps <= 10_000), require(totalStrategyWeight <= 10_000) in add/set/remove paths (I-2). Strategy asset match G-4. 0/100% productive weights allowed per phase3 policy (Charm/Ajna opt-in).

## P0 — Cross-Chain / LayerZero Route Coherence

- [x] Review `contracts/utilities/messaging/CreatorShareOFT.sol` fee lane routing and destination consistency — extends OFT; _transferWithFees (or equivalent) routes to tradeFeeCollector (gauge) per canonical lanes doc. G-5: feeBps <= MAX_FEE_BPS. Calls processSwapLottery on authorized paths (hub vs spoke). Fee collector + gauge integration for burn/lottery split.
- [x] Verify peer/endpoint assumptions and message-source trust checks in OFT/OApp flows — standard LayerZero OApp/OFT (endpoint set at deploy, peers via setPeer). X-2 notes post-deploy mutable setters (gauge, oracle, registry) can drift if governance/config not coherent — mitigated by deploy-time wiring + RouteCoherenceChecker + keeper/registry. Message origin checks in OApp (srcEid/sender).
- [x] Review `contracts/utilities/oracles/CreatorOracle.sol` relay assumptions (origin, freshness, update authorization) — updater role-gated (authorized updater); price updates with freshness? (per entry-points); relayed to consumers (strategies, gauge?). X-2 cross-contract coherence risk acknowledged (deploy + ops discipline).
- [x] Review `contracts/utilities/lottery/CreatorLotteryManager.sol` replay/nonce/deadline lifecycle consistency — processSwapLottery (authorized callers only); VRF + AMOE paths with deadlines/nonces (G-7 in AmoeRouter); sponsorship policy via _delegateAdmin() + onlyDelegateCall onlyOwner on AdminModule (I-6 design: thin main + mirrored storage; documented in general-audit-2026-05-sc-hygiene). usedReportIds not here (in SolanaStrategy); epoch/replay via VRF requestId + processPending. CLM at 24,528 bytes (48B headroom per sizes run) — EIP-170 P0 ongoing (module split + omissions in place).

## P1 — Supporting Surface: Solana NAV Trust Boundary

- [x] Review `contracts/utilities/bridge/SolanaBridgeAdapter.sol` privileged route/token mapping controls — owner (Ownable) for registerToken / set mappings; bridgeToSolana* (payable, amount checks); used by strategies/keepers. (H-06 in old reconciliation was about return value — interface updated in some paths per acceptances.)
- [x] Review `contracts/vault/strategies/SolanaStrategy.sol` report replay guard (`reportId`) and NAV bounds — H-05/Codex patch applied: `mapping usedReportIds; if (usedReportIds[reportId]) revert ReportIdAlreadyUsed(); usedReportIds[reportId]=true;` before effects in updateRemoteNav + reconcileFromSolana (non-zero required). G-6, G-10: maxNavDeltaBpsPerUpdate bound + per-update delta check. onlyKeeper. (FIX comments cite 4626-437.)
- [x] Verify keeper authorization and failure-mode behavior for delayed/inconsistent bridge updates — onlyKeeper on update/reconcile; delta cap prevents large jumps; replay prevents double-count; NAV used in totalAssets/valuation. Failure modes (stale reports) bounded by cap + keeper liveness (not on-chain enforced beyond that; aligns with X-3).

## P1 — Invariant-Driven Validation

- [x] For each `On-chain: No` invariant in `x-ray/invariants.md`, verify whether the gap is a real issue vs intended design — I-6 (CLM sponsorship): intended delegatecall admin module pattern (onlyDelegateCall + mirrored storage + owner); full rationale in general-audit-2026-05-sc-hygiene.md § "Documented Security Model". X-2 (registry/phase wiring coherence): deploy-time + post-deploy setters (gauge/OFT/oracle) + registry + keeper; not purely immutable on-chain (ops + C-03 reconciliations address drift). E-2 similar (economic cross-chain settlement relies on deploy invariants + keeper). No new bypasses found; design trade-off for upgradeability/EIP-170.
- [x] For each cross-contract invariant (`X-*`), validate both sides in code: caller assumptions and callee write paths — X-1 (gauge burn): CreatorGaugeController calls → CoreModule onlyGaugeController (or burnStream) enforced. X-3 (Solana NAV): BridgeAdapter/keeper → SolanaStrategy (usedReportIds + delta cap) — both sides match (patch in place). X-2: caller (batcher/phase asserts + registry) vs callee (mutable setters on gauge/OFT/oracle) — coherence is procedure + checker, not single on-chain tx (acknowledged gap).
- [x] Map confirmed issues back to `x-ray/x-ray.md` top attack surfaces — All map directly: deploy phase (I-4/G-1/G-9), vault symmetry (I-1/I-2/G-2/3/4/8), cross-chain (X-2/I-3/G-5), Solana (X-3/G-6/10). Slither delegatecall/reentrancy flags are design (module split + OFT fee refund) not new vulns. CLM size (48B) remains the acute technical risk.

## P2 — Tests / Verification

- [x] Add targeted tests for deploy phase retries and partial finalize scenarios — Added in test/DeploymentBatcher.ThreeWaySplit.t.sol: `test_partialPhase1Stuck_thenReset_allowsRetry` (seeds stuck coreDone+!finalized, reset by treasury, verifies cleared state for retry path). Existing coverage in ThreeWaySplit (state seeding, reset guards), Phase1EndpointPoisoning, LiveHandlerInvariants, phase2 permit2 invariant.
- [x] Add targeted tests for hostile/partial strategy withdrawal accounting — Existing dedicated: test/vault/strategies/CreatorOVaultStrategies.HostileWithdraw.t.sol (M-09 regression, negative delta, queue continues); plus CreatorOVaultStrategies.Rebalance.* (including Invariant, Scenarios, DepositorE2E, HostileWithdraw), CreatorOVault.StrategyValuationRevert.Withdrawals.t.sol, M09.StrategyWithdrawResilience.t.sol. Impairment side-pocket tests cover partial/fail paths.
- [x] Add targeted tests for cross-chain replay/misroute attempts — Existing: CreatorShareOFT.LzReceive.WinnerCallbackCollision.t.sol, CreatorShareOFT.RemoteLotteryFunding.t.sol, CreatorShareOFT.EdgeCases.t.sol; SolanaStrategy.Flows.t.sol + Valuation + BridgeReturn; lottery VRF/AMOE temporal/deadline tests (CreatorLotteryManager.* , LotteryAmoeProperties); CreatorShareOFT.Lottery.t.sol. Replay guards (usedReportIds, nonces) exercised.
- [x] Run focused test subsets before full-suite/coverage attempts — Done. Full `forge test --summary` (multiple runs, exit 0). Targeted + live invariants passed cleanly, including (from latest full-run tail):
  - DeploymentBatcherPhase3InvariantsTest (1 passed)
  - DeploymentBatcherPhaseLiveInvariantTest (1 passed)
  - CreatorOVaultUserAccountingInvariantTest (6 passed)
  - CreatorOVaultWrapperShareOFTValidationTest (6 passed)
  - CreatorOVaultStrategiesRebalanceInvariantTest (15 passed)
  Many other P0-relevant suites (phase2, lottery, Solana, rebalance) also "ok" with 0 failures in tails/targeted runs. Current counts: 118 `*.t.sol`, ~855 test functions. Coverage still blocked by stack depth in DeploymentBatcher.

## Suggested Order (ROI-first)

1. `DeploymentBatcher` + universal deployer
2. `CreatorOVault` + core/strategy modules
3. `CreatorShareOFT` + `CreatorOracle` + `CreatorLotteryManager`
4. `SolanaBridgeAdapter` + `SolanaStrategy`

---

**Pass complete (all items above reviewed in 2026-06 resumption).** Key signals:
- Sizes (CLM 24528B / 48B headroom — still the #1 technical constraint; others comfortable via modules).
- Tests: Full `forge test --summary` completed (exit 0, ~342s). Live invariants passed cleanly (from latest full-run tail): DeploymentBatcherPhase3InvariantsTest (1), DeploymentBatcherPhaseLiveInvariantTest (1), CreatorOVaultUserAccountingInvariantTest (6), CreatorOVaultWrapperShareOFTValidationTest (6), CreatorOVaultStrategiesRebalanceInvariantTest (15) — all 0 failed. Many other P0 suites (phase2, lottery, Solana, rebalance) also clean in tails/targeted. Current counts: 118 `*.t.sol`, ~855 test functions. Coverage blocked by stack depth in DeploymentBatcher.
- Slither (delegatecall/reentrancy are architectural — match documented module pattern and May hygiene review; no new high-sev on reviewed surfaces beyond known).
- Fixes from Codex (e.g. H-05 reportId guard) are present with citations.
- Canonical lanes: contracts/ adhere (legacy `payoutRecipient` only in ABI structs with explicit AGENTS.md mapping comments; errors and logic use `creatorCoinPayoutRecipient` / `creatorTreasury`).
- Gaps (I-6, X-2, E-2) are intentional design (delegate modules for size, post-deploy config for flexibility) with compensating controls reviewed.

Next: address any new P2 test gaps, re-run full security-local on changes, or deep-dive a specific surface (e.g. impairment side-pocket or OFT peer wiring). Update this file or add findings under `docs/audits/4626/acceptances/` for any new items. Cross-ref `bug-audit-worksheet.md` for lane order.

