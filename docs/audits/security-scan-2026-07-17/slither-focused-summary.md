# Slither focused scan summary (2026-07-17)
Pinned: slither-analyzer==0.11.5, `--fail-none`, `slither.config.json`.

## CreatorOVault
Total detectors: 141

- **High/Medium** `reentrancy-balance`: Reentrancy in CreatorOVault._withdrawFromStrategyMeasured(address,uint256) (contracts/creator/vault/CreatorOVault.sol#1431-1440):
- **High/Medium** `reentrancy-balance`: Reentrancy in CreatorOVault._ensureCoin(uint256) (contracts/creator/vault/CreatorOVault.sol#1485-1498):
- **High/Medium** `reentrancy-balance`: Reentrancy in CreatorOVault._depositIntoStrategyMeasured(address,uint256) (contracts/creator/vault/CreatorOVault.sol#1414-1426):
- **Medium/Medium** `divide-before-multiply`: CreatorOVault._processProfitUnlock() (contracts/creator/vault/CreatorOVault.sol#930-973) performs a multiplication on the result of a division:
- **Medium/Medium** `reentrancy-no-eth`: Reentrancy in CreatorOVault._autoAllocateToStrategy() (contracts/creator/vault/CreatorOVault.sol#1726-1750):
- **Medium/Medium** `reentrancy-no-eth`: Reentrancy in CreatorOVault._withdrawFromStrategies(uint256) (contracts/creator/vault/CreatorOVault.sol#1650-1688):
- **Medium/Medium** `reentrancy-no-eth`: Reentrancy in CreatorOVault._deployToStrategies() (contracts/creator/vault/CreatorOVault.sol#1609-1645):
- **Medium/Medium** `unused-return`: CreatorOVault._depositIntoStrategyMeasured(address,uint256) (contracts/creator/vault/CreatorOVault.sol#1414-1426) ignores return value by IStrategy(strategy).deposit(amount) (contracts/creator/vault/CreatorOVault.sol#141
- **Medium/Medium** `unused-return`: CreatorOVault._firstStrategyValuationNotReady() (contracts/creator/vault/CreatorOVault.sol#1031-1058) ignores return value by IStrategy(strategy).getTotalAssets() (contracts/creator/vault/CreatorOVault.sol#1047-1054)

## CreatorShareOFT
Total detectors: 37

- **Medium/Medium** `unused-return`: CreatorShareOFT.flushFees(SendParam,MessagingFee) (contracts/creator/vault/CreatorShareOFT.sol#707-728) ignores return value by this.send{value: msg.value}(_sendParam,_fee,address(msg.sender)) (contracts/creator/vault/Cr

## DeploymentBatcher
Total detectors: 65

- **Medium/Medium** `reentrancy-no-eth`: Reentrancy in DeploymentBatcher._deployPhase1CoreInternal(DeploymentBatcher.Phase1Params,DeploymentBatcher.CodeIds,bytes32) (contracts/shared/deploy/batchers/DeploymentBatcher.sol#2024-2054):
- **Medium/Medium** `reentrancy-no-eth`: Reentrancy in DeploymentBatcher.launchDeferredAuction(DeploymentBatcher.DeferredAuctionParams) (contracts/shared/deploy/batchers/DeploymentBatcher.sol#2252-2288):
- **Medium/Medium** `reentrancy-no-eth`: Reentrancy in DeploymentBatcher._finalizePhase1InternalSplit(DeploymentBatcher.Phase1Params,DeploymentBatcher.CodeIds,bytes32) (contracts/shared/deploy/batchers/DeploymentBatcher.sol#2056-2085):
- **Medium/Medium** `unused-return`: DeploymentBatcherPhase2Module._bridgeShareAllocationToSolana(address,uint256) (contracts/shared/deploy/batchers/DeploymentBatcher.sol#1310-1340) ignores return value by IOFT(shareOFT).send{value: fee.nativeFee}(sendParam
- **Medium/Medium** `unused-return`: DeploymentBatcherShareMeshHelper.deployShareMeshLpManager(DeploymentBatcher.ShareMeshDeployParams,DeploymentBatcher.ShareMeshCodeIds,bytes32) (contracts/shared/deploy/batchers/DeploymentBatcher.sol#393-447) ignores retur
- **Medium/Medium** `unused-return`: DeploymentBatcherPhase1Module.deployPhase1Core(DeploymentBatcher.Phase1Params,DeploymentBatcher.CodeIds,DeploymentBatcher.Phase1SplitState,bytes32) (contracts/shared/deploy/batchers/DeploymentBatcher.sol#751-812) ignores
- **Medium/Medium** `unused-return`: DeploymentBatcherPhase2Module._bridgeShareAllocationToSolana(address,uint256) (contracts/shared/deploy/batchers/DeploymentBatcher.sol#1310-1340) ignores return value by (None,None,oftReceipt) = IOFT(shareOFT).quoteOFT(se

## LotteryAmoeRouter
Total detectors: 14

_No High/Medium findings after noise filter (uninitialized-state / incorrect-equality / uninitialized-local stripped)._

## LotteryManager4626
Total detectors: 224

- **High/Medium** `controlled-delegatecall`: LotteryManager4626._payoutLocalJackpot(address,address,uint16) (contracts/shared/lottery/manager/LotteryManager4626.sol#1712-1735) uses delegatecall to a input-controlled function id
- **High/Medium** `controlled-delegatecall`: LotteryManager4626._delegateAdmin() (contracts/shared/lottery/manager/LotteryManager4626.sol#1774-1781) uses delegatecall to a input-controlled function id
- **High/Medium** `reentrancy-eth`: Reentrancy in LotteryManager4626.processSwapLottery(address,address,uint256,uint256) (contracts/shared/lottery/manager/LotteryManager4626.sol#648-700):
- **High/Medium** `reentrancy-eth`: Reentrancy in LotteryManager4626._requestCrossChainVRFWithSource(address,address,uint256,uint256,uint32,bytes32,uint256) (contracts/shared/lottery/manager/LotteryManager4626.sol#1343-1471):
- **High/Medium** `reentrancy-eth`: Reentrancy in LotteryManager4626._handleLotteryEntry(uint32,bytes32,bytes) (contracts/shared/lottery/manager/LotteryManager4626.sol#1199-1306):
- **Medium/Medium** `unused-return`: LotteryManager4626._calculateTokenUSD(address,address,uint256) (contracts/shared/lottery/manager/LotteryManager4626.sol#1014-1031) ignores return value by LotteryManager4626PricingLib.calculateTokenUSD(address(registry),
- **Medium/Medium** `unused-return`: LotteryManager4626._requestCrossChainVRFWithSource(address,address,uint256,uint256,uint32,bytes32,uint256) (contracts/shared/lottery/manager/LotteryManager4626.sol#1343-1471) ignores return value by (sequence) = vrfInteg

## Registry4626
Total detectors: 124

_No High/Medium findings after noise filter (uninitialized-state / incorrect-equality / uninitialized-local stripped)._

