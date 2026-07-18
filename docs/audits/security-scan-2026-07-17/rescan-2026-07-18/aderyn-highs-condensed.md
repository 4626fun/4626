# Aderyn High Issues — 2026-07-18 rescan (post SCAN patches)
Source: aderyn 0.6.8 full report (126 files, 26841 nSLOC). Same 12 High detector classes as 2026-07-17; no new High class opened.

## H-1: `abi.encodePacked()` Hash Collision (22 file-path mentions)
- `contracts/agent/vault/AgentShareOFT.sol`
- `contracts/agent/vault/AgentShareOFT.sol#L1289)`
- `contracts/creator/vault/CreatorShareOFT.sol`
- `contracts/creator/vault/CreatorShareOFT.sol#L1310)`
- `contracts/shared/deploy/batchers/DeploymentBatcher.sol`
- `contracts/shared/deploy/batchers/DeploymentBatcher.sol#L482)`
- `contracts/shared/deploy/batchers/DeploymentBatcher.sol#L501)`
- `contracts/shared/deploy/batchers/DeploymentBatcher.sol#L511)`

## H-2: Contract locks Ether without a withdraw function (10 file-path mentions)
- `contracts/_archive/strategies/launchpad/LBPStrategyWithTaxHook.sol`
- `contracts/_archive/strategies/launchpad/LBPStrategyWithTaxHook.sol#L65)`
- `contracts/agent/revenue/AgentGaugeController.sol`
- `contracts/agent/revenue/AgentGaugeController.sol#L70)`
- `contracts/creator/revenue/CreatorGaugeController.sol`
- `contracts/creator/revenue/CreatorGaugeController.sol#L71)`
- `contracts/shared/deploy/batchers/DeploymentBatcher.sol`
- `contracts/shared/deploy/batchers/DeploymentBatcher.sol#L1457)`

## H-3: EnumerableSet.remove Corrupts Order (4 file-path mentions)
- `contracts/shared/governance/ve4626GaugeVoting.sol`
- `contracts/shared/governance/ve4626GaugeVoting.sol#L362)`
- `contracts/shared/governance/ve4626GaugeVoting.sol#L657)`

## H-4: Loop contains `msg.value` (6 file-path mentions)
- `contracts/agent/oracles/AgentOracle.sol`
- `contracts/agent/oracles/AgentOracle.sol#L1293)`
- `contracts/creator/oracles/CreatorOracle.sol`
- `contracts/creator/oracles/CreatorOracle.sol#L1239)`
- `contracts/shared/lottery/manager/LotteryManager4626.sol`
- `contracts/shared/lottery/manager/LotteryManager4626.sol#L900)`

## H-5: Reentrancy: State change after external call (292 file-path mentions)
- `contracts/_archive/strategies/launchpad/LBPStrategyWithTaxHook.sol`
- `contracts/_archive/strategies/launchpad/LBPStrategyWithTaxHook.sol#L208)`
- `contracts/_archive/strategies/launchpad/LBPStrategyWithTaxHook.sol#L209)`
- `contracts/_archive/strategies/launchpad/LBPStrategyWithTaxHook.sol#L214)`
- `contracts/_archive/strategies/launchpad/LBPStrategyWithTaxHook.sol#L222)`
- `contracts/agent/oracles/AgentOracle.sol`
- `contracts/agent/oracles/AgentOracle.sol#L306)`
- `contracts/agent/oracles/AgentOracle.sol#L383)`

## H-6: Contract Name Reused in Different Files (138 file-path mentions)
- `contracts/agent/interfaces/IAgentOVault.sol`
- `contracts/agent/interfaces/IAgentOVault.sol#L13)`
- `contracts/agent/oracles/AgentOracle.sol`
- `contracts/agent/oracles/AgentOracle.sol#L1525)`
- `contracts/agent/revenue/AgentGaugeController.sol`
- `contracts/agent/revenue/AgentGaugeController.sol#L11)`
- `contracts/agent/revenue/AgentGaugeController.sol#L26)`
- `contracts/agent/revenue/AgentGaugeController.sol#L30)`

## H-7: Storage Array Edited with Memory (2 file-path mentions)
- `contracts/shared/shareoft-mesh/cca/CCALaunchArm.sol`
- `contracts/shared/shareoft-mesh/cca/CCALaunchArm.sol#L627)`

## H-8: Dangerous strict equality checks on contract balances (4 file-path mentions)
- `contracts/agent/revenue/AgentRevenueRouter.sol`
- `contracts/agent/revenue/AgentRevenueRouter.sol#L423)`
- `contracts/creator/revenue/CreatorPayoutRouter.sol`
- `contracts/creator/revenue/CreatorPayoutRouter.sol#L521)`

## H-9: Tautological comparison (4 file-path mentions)
- `contracts/agent/revenue/AgentGaugeController.sol`
- `contracts/agent/revenue/AgentGaugeController.sol#L907)`
- `contracts/creator/revenue/CreatorGaugeController.sol`
- `contracts/creator/revenue/CreatorGaugeController.sol#L906)`

## H-10: Unsafe Casting of integers (18 file-path mentions)
- `contracts/agent/oracles/AgentOracle.sol`
- `contracts/agent/oracles/AgentOracle.sol#L936)`
- `contracts/agent/oracles/AgentOracle.sol#L951)`
- `contracts/creator/oracles/CreatorOracle.sol`
- `contracts/creator/oracles/CreatorOracle.sol#L949)`
- `contracts/creator/oracles/CreatorOracle.sol#L964)`
- `contracts/shared/strategies/univ3/CharmStrategy4626.sol`
- `contracts/shared/strategies/univ3/CharmStrategy4626.sol#L615)`

## H-11: Weak Randomness (8 file-path mentions)
- `contracts/agent/oracles/AgentOracle.sol`
- `contracts/agent/oracles/AgentOracle.sol#L1058)`
- `contracts/shared/governance/ve4626GaugeVoting.sol`
- `contracts/shared/governance/ve4626GaugeVoting.sol#L221)`
- `contracts/shared/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol`
- `contracts/shared/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol#L129)`
- `contracts/shared/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol#L132)`

## H-12: Yul block contains `return` (3743 file-path mentions)
- `contracts/creator/vault/CreatorOVault.sol`
- `contracts/creator/vault/CreatorOVault.sol#L831)`
- `contracts/shared/lottery/zk/AmoePlonkVerifier.sol`
- `contracts/shared/lottery/zk/AmoePlonkVerifier.sol#L246)`
- `contracts/shared/lottery/zk/AmoePlonkVerifier.sol#L261)`
- `contracts/shared/lottery/zk/AmoePlonkVerifier.sol#L1014)`
- `contracts/shared/lottery/zk/AmoePlonkVerifier.sol#L1029)`
- `contracts/shared/lottery/zk/AmoePlonkVerifier.sol#L1039)`
