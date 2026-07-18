# Aderyn High Issues — condensed triage notes
Source: aderyn 0.6.8 full report (126 files, 26790 nSLOC). Full raw at agent artifact path.
## H-1: `abi.encodePacked()` Hash Collision (11 instances)
- contracts/agent/vault/AgentShareOFT.sol
- contracts/creator/vault/CreatorShareOFT.sol
- contracts/shared/deploy/batchers/DeploymentBatcher.sol
- contracts/shared/deploy/batchers/DeploymentBatcher.sol
- contracts/shared/deploy/batchers/DeploymentBatcher.sol

## H-2: Contract locks Ether without a withdraw function (5 instances)
- contracts/agent/revenue/AgentGaugeController.sol
- contracts/creator/revenue/CreatorGaugeController.sol
- contracts/shared/deploy/batchers/DeploymentBatcher.sol
- contracts/shared/deploy/factories/OVaultFactory4626.sol

## H-3: EnumerableSet.remove Corrupts Order (2 instances)
- contracts/shared/governance/ve4626GaugeVoting.sol
- contracts/shared/governance/ve4626GaugeVoting.sol

## H-4: Loop contains `msg.value` (3 instances)
- contracts/agent/oracles/AgentOracle.sol
- contracts/creator/oracles/CreatorOracle.sol
- contracts/shared/lottery/manager/LotteryManager4626.sol

## H-5: Reentrancy: State change after external call (146 instances)
- contracts/agent/oracles/AgentOracle.sol
- contracts/agent/oracles/AgentOracle.sol
- contracts/agent/oracles/AgentOracle.sol
- contracts/agent/oracles/AgentOracle.sol
- contracts/agent/oracles/AgentOracle.sol

## H-6: Contract Name Reused in Different Files (69 instances)
- contracts/agent/interfaces/IAgentOVault.sol
- contracts/agent/oracles/AgentOracle.sol
- contracts/agent/revenue/AgentGaugeController.sol
- contracts/agent/revenue/AgentGaugeController.sol
- contracts/agent/revenue/AgentGaugeController.sol

## H-7: Storage Array Edited with Memory (1 instances)
- contracts/shared/shareoft-mesh/cca/CCALaunchArm.sol

## H-8: Dangerous strict equality checks on contract balances (2 instances)
- contracts/agent/revenue/AgentRevenueRouter.sol
- contracts/creator/revenue/CreatorPayoutRouter.sol

## H-9: Tautological comparison (2 instances)
- contracts/agent/revenue/AgentGaugeController.sol
- contracts/creator/revenue/CreatorGaugeController.sol

## H-10: Unsafe Casting of integers (9 instances)
- contracts/agent/oracles/AgentOracle.sol
- contracts/agent/oracles/AgentOracle.sol
- contracts/creator/oracles/CreatorOracle.sol
- contracts/creator/oracles/CreatorOracle.sol
- contracts/shared/strategies/univ3/CharmStrategy4626.sol

## H-11: Weak Randomness (4 instances)
- contracts/agent/oracles/AgentOracle.sol
- contracts/shared/governance/ve4626GaugeVoting.sol
- contracts/shared/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol
- contracts/shared/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol

## H-12: Yul block contains `return` (10 instances)
- contracts/creator/vault/CreatorOVault.sol
- contracts/shared/lottery/zk/AmoePlonkVerifier.sol
- contracts/shared/lottery/zk/AmoePlonkVerifier.sol
- contracts/shared/lottery/zk/AmoePlonkVerifier.sol
- contracts/shared/lottery/zk/AmoePlonkVerifier.sol

