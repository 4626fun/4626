// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/helpers/batchers/DeploymentBatcher.sol";

contract DeploymentBatcherThreeWaySplitTest is Test {
    DeploymentBatcher internal batcher;

    function setUp() public {
        batcher = new DeploymentBatcher(
            makeAddr("registry"),
            makeAddr("bytecodeStore"),
            makeAddr("create2Deployer"),
            makeAddr("protocolTreasury"),
            makeAddr("poolManager"),
            makeAddr("taxHook"),
            makeAddr("chainlinkEthUsd"),
            makeAddr("vaultActivationBatcher"),
            makeAddr("lotteryManager"),
            makeAddr("permit2"),
            makeAddr("usdc"),
            makeAddr("uniswapV3Factory"),
            makeAddr("uniswapRouter"),
            makeAddr("ajnaFactory"),
            makeAddr("vaultCoreModule"),
            makeAddr("vaultStrategiesModule"),
            makeAddr("vaultAdminModule")
        );
    }

    function test_deployPhase3Strategies_revertsWhenTotalWeightExceeds10000() public {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: makeAddr("creatorToken"),
            owner: address(this),
            vault: makeAddr("vault"),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHRM",
            charmWeightBps: 7_000,
            ajnaWeightBps: 2_000,
            solanaWeightBps: 1_100,
            solanaKeeper: makeAddr("solanaKeeper"),
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: makeAddr("solanaBridge"),
            enableAutoAllocate: false
        });

        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: bytes32(uint256(1)),
            creatorCharmStrategy: bytes32(uint256(2)),
            ajnaStrategy: bytes32(uint256(3)),
            solanaStrategy: bytes32(uint256(4))
        });

        vm.expectRevert(DeploymentBatcher.InvalidWeight.selector);
        batcher.deployPhase3Strategies(params, codeIds);
    }
}
